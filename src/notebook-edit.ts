import { z } from "zod";
import type { decodeFileBytes } from "./path-approval-decoder-source.js";

export const NOTEBOOK_MAX_BYTES = 8 * 1024 * 1024;
export const CELL_TYPES = ["code", "markdown", "raw"] as const;
export const EDIT_MODES = ["replace", "insert", "delete"] as const;

type CellType = (typeof CELL_TYPES)[number];
type EditMode = (typeof EDIT_MODES)[number];

type NotebookCell = {
  cell_type: CellType;
  id?: string;
  source: string | string[];
  metadata?: Record<string, unknown>;
  outputs?: unknown[];
  execution_count?: number | null;
  [key: string]: unknown;
};

export type Notebook = {
  nbformat: number;
  nbformat_minor: number;
  cells: NotebookCell[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export const notebookEditSchema = z
  .object({
    path: z.string().min(1),
    cell_id: z.string().optional(),
    new_source: z.string(),
    cell_type: z.enum(CELL_TYPES).optional(),
    edit_mode: z.enum(EDIT_MODES).optional(),
  })
  .strict();

function isCellType(value: unknown): value is CellType {
  return typeof value === "string" && (CELL_TYPES as readonly string[]).includes(value);
}

function isSource(value: unknown): value is string | string[] {
  if (typeof value === "string") return true;
  return Array.isArray(value) && value.every((line) => typeof line === "string");
}

/** Parse and validate a notebook document; throws with a caller-facing reason. */
export function parseNotebook(text: string, rel: string): Notebook {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`notebook is not valid JSON: ${rel}`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`notebook is not a JSON object: ${rel}`);
  }
  const nb = value as Record<string, unknown>;
  if (nb.nbformat !== 4) {
    throw new Error(
      `unsupported notebook format (nbformat=${String(nb.nbformat)}); only nbformat 4 is supported: ${rel}`,
    );
  }
  if (!Array.isArray(nb.cells)) {
    throw new Error(`notebook is missing a "cells" array: ${rel}`);
  }
  const seen = new Set<string>();
  for (const raw of nb.cells) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error(`notebook contains a malformed cell: ${rel}`);
    }
    const cell = raw as Record<string, unknown>;
    if (!isCellType(cell.cell_type)) {
      throw new Error(`notebook cell has an invalid cell_type: ${rel}`);
    }
    if (!isSource(cell.source)) {
      throw new Error(`notebook cell source must be a string or a list of strings: ${rel}`);
    }
    if (cell.id !== undefined) {
      if (typeof cell.id !== "string" || cell.id.length === 0) {
        throw new Error(`notebook cell "id" must be a non-empty string: ${rel}`);
      }
      if (seen.has(cell.id)) {
        throw new Error(`notebook contains duplicate cell id "${cell.id}": ${rel}`);
      }
      seen.add(cell.id);
    }
  }
  if (typeof nb.nbformat_minor !== "number" || !Number.isInteger(nb.nbformat_minor) || nb.nbformat_minor < 0) {
    nb.nbformat_minor = 0;
  }
  return nb as unknown as Notebook;
}

/**
 * Resolve an edit target to a cell array index. An exact `cell_id` match wins;
 * a purely numeric id that matches no cell is treated as a 0-based index
 * fallback. A referenced index that names no existing cell is rejected, and a
 * missing id is reported explicitly rather than silently skipped.
 */
function resolveIndex(cells: NotebookCell[], cellId: string | undefined, mode: EditMode): number {
  if (cellId === undefined || cellId === "") {
    if (mode !== "insert") {
      throw new Error(`cell_id is required when edit_mode is "${mode}".`);
    }
    return 0;
  }
  let index = cells.findIndex((cell) => cell.id === cellId);
  if (index === -1) {
    // vze, sfn1dbxq [3525297,3525411), UTF-16. Retain the CLI's numeric alias.
    const positional = /^cell-(\d+)$/.exec(cellId)?.[1] ?? (/^\d+$/.test(cellId) ? cellId : undefined);
    if (positional === undefined) {
      throw new Error(`Cell with ID "${cellId}" not found in notebook.`);
    }
    index = Number.parseInt(positional, 10);
  }
  if (index >= cells.length) {
    throw new Error(`Cell with index ${index} does not exist in notebook (${cells.length} cells).`);
  }
  return mode === "insert" ? index + 1 : index;
}

// NotebookEdit.call, sfn1dbxq [4179123,4181923), UTF-16. Replay accepts the
// original generated cell ID so serialization is identical across processes.
export function renderNotebookEdit(decoded: ReturnType<typeof decodeFileBytes>, input: z.infer<typeof notebookEditSchema>,
  rel: string, insertId: () => string) {
  const {cell_id, cell_type, new_source, edit_mode: mode = "replace"} = input;
  if (decoded.lossyDecode) throw new Error("notebook_edit: unsupported encoding; invalid UTF-8");
  if (mode === "insert" && !cell_type) throw new Error("Cell type is required when using edit_mode=insert.");
  const notebook = parseNotebook(decoded.content, rel);
  const cells = notebook.cells;
  const index = resolveIndex(cells, cell_id, mode);

  let resultId: string | undefined;
  if (mode === "delete") {
    resultId = cells[index]!.id;
    cells.splice(index, 1);
  } else if (mode === "insert") {
    const id = notebook.nbformat_minor >= 5 ? insertId() : undefined;
    const cell: NotebookCell = { cell_type: cell_type!, ...(id ? { id } : {}), source: new_source, metadata: {} };
    if (cell.cell_type === "code") {
      cell.execution_count = null;
      cell.outputs = [];
    }
    cells.splice(index, 0, cell);
    resultId = cell.id;
  } else {
    const cell = cells[index]!;
    const nextType: CellType = cell_type !== undefined && cell_type !== cell.cell_type ? cell_type : cell.cell_type;
    cell.source = new_source;
    if (cell.cell_type === "code") {
      cell.execution_count = null;
      cell.outputs = [];
    }
    if (nextType !== cell.cell_type) {
      cell.cell_type = nextType;
    }
    resultId = cell.id;
  }

  const json = JSON.stringify(notebook, null, 1);
  const serialized = Buffer.from(decoded.lineEndings === 'CRLF' ? json.replaceAll('\n', '\r\n') : json,
    decoded.encoding === 'utf16le' ? 'utf16le' : 'utf8');
  if (serialized.byteLength > NOTEBOOK_MAX_BYTES) {
    throw new Error(
      `notebook_edit: edit rejected; the updated notebook would exceed the maximum size ` +
        `(${NOTEBOOK_MAX_BYTES} bytes). The file was left unchanged.`,
    );
  }
  return {serialized, json, resultId, index};
}
