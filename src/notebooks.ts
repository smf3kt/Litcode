// Jupyter notebook layer for an independent personal agent.
//
// `notebook_read` lists the cells of a workspace `.ipynb`; `notebook_edit`
// inserts, replaces, or deletes one cell. Both are confined to the agent
// workspace exactly like the file tools (realpath, every ancestor symlink
// resolved, `.agent` reserved) and never execute notebook code.
//
// Only nbformat 4 is accepted. Untouched cells, top-level metadata, and cell
// outputs are preserved exactly apart from JSON re-indentation; a code cell
// whose source is replaced has its outputs cleared and execution_count reset.
// Writes are atomic (temporary file in the target directory, fsync, rename).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { ToolContext, ToolDefinition } from "./tools.js";

const AGENT_DIR = ".agent";
const NOTEBOOK_MAX_BYTES = 8 * 1024 * 1024;
const FALLBACK_MAX_OUTPUT_BYTES = 100_000;
const CELL_TYPES = ["code", "markdown", "raw"] as const;
const EDIT_MODES = ["replace", "insert", "delete"] as const;

// ---------------------------------------------------------------------------
// Errors and output capping (local copies: tools.ts keeps its helpers private)
// ---------------------------------------------------------------------------

function abortError(): Error {
  const error = new Error("operation aborted before it started");
  error.name = "AbortError";
  return error;
}

function maxBytesFor(context: ToolContext): number {
  const value = Math.floor(context.maxOutputBytes);
  return Number.isFinite(value) && value > 0 ? value : FALLBACK_MAX_OUTPUT_BYTES;
}

/** Largest prefix length <= maxBytes that ends on a UTF-8 code point boundary. */
function utf8PrefixEnd(buf: Buffer, maxBytes: number): number {
  let end = Math.min(maxBytes, buf.length);
  while (end > 0 && end < buf.length && (buf[end]! & 0xc0) === 0x80) end -= 1;
  return end;
}

function truncateHead(text: string, maxBytes: number, label: string): string {
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return text;
  const end = utf8PrefixEnd(buf, maxBytes);
  const kept = buf.subarray(0, end).toString("utf8");
  return `${kept}\n[${label}: output truncated; ${buf.length - end} more bytes omitted]`;
}

// ---------------------------------------------------------------------------
// Confinement (mirrors the tools.ts contract; that module's helpers are private)
// ---------------------------------------------------------------------------

function isWithin(root: string, candidate: string): boolean {
  if (candidate === root) return true;
  return candidate.startsWith(root + path.sep);
}

function rejectAgentSegment(root: string, target: string): void {
  const rel = path.relative(root, target);
  if (rel === "") return;
  if (rel.split(path.sep).includes(AGENT_DIR)) {
    throw new Error(`path is inside the reserved "${AGENT_DIR}" directory`);
  }
}

/**
 * Resolve `userPath` inside `root`, following every symlink component and
 * rejecting any path that leaves the workspace or aliases the reserved
 * `.agent` directory. Absolute paths are rejected outright.
 */
function confine(root: string, userPath: string, mustExist: boolean): string {
  if (path.isAbsolute(userPath)) {
    throw new Error(`path escapes the workspace (absolute paths are not allowed): ${userPath}`);
  }
  const abs = path.resolve(root, userPath);
  if (!isWithin(root, abs)) {
    throw new Error(`path escapes the workspace: ${userPath}`);
  }
  const rel = path.relative(root, abs);
  if (rel === "") {
    if (mustExist && !fs.existsSync(abs)) {
      throw new Error(`path does not exist: ${userPath}`);
    }
    return root;
  }
  const segments = rel.split(path.sep);
  let current = root;
  for (const seg of segments) {
    if (seg === AGENT_DIR) {
      throw new Error(`path is inside the reserved "${AGENT_DIR}" directory: ${userPath}`);
    }
    const next = path.join(current, seg);
    let stat: fs.Stats | null = null;
    try {
      stat = fs.lstatSync(next);
    } catch {
      stat = null;
    }
    if (stat && stat.isSymbolicLink()) {
      let linkReal: string;
      try {
        linkReal = fs.realpathSync(next);
      } catch {
        throw new Error(`path escapes the workspace through a dangling symlink: ${userPath}`);
      }
      if (!isWithin(root, linkReal)) {
        throw new Error(`path escapes the workspace through a symlink: ${userPath}`);
      }
      rejectAgentSegment(root, linkReal);
      current = linkReal;
    } else {
      if (!stat && mustExist) {
        throw new Error(`path does not exist: ${userPath}`);
      }
      current = next;
    }
  }
  rejectAgentSegment(root, current);
  return current;
}

function workspaceReal(workspace: string): string {
  const resolved = path.resolve(workspace);
  try {
    return fs.realpathSync(resolved);
  } catch {
    throw new Error(`workspace does not exist: ${workspace}`);
  }
}

// ---------------------------------------------------------------------------
// Atomic write
// ---------------------------------------------------------------------------

function atomicWrite(real: string, content: string, mode?: number): void {
  const dir = path.dirname(real);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(real)}.${crypto.randomBytes(6).toString("hex")}.tmp`);
  let fd: number | undefined;
  try {
    fd = fs.openSync(tmp, "wx", mode ?? 0o644);
    fs.writeFileSync(fd, content, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmp, real);
  } catch (error) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
    }
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Notebook model and validation
// ---------------------------------------------------------------------------

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

type Notebook = {
  nbformat: number;
  nbformat_minor: number;
  cells: NotebookCell[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

const notebookReadSchema = z.object({ path: z.string().min(1) }).strict();

const notebookEditSchema = z
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
function parseNotebook(text: string, rel: string): Notebook {
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

/** Flatten a validated cell source (string or list of lines) into one string. */
function sourceText(source: string | string[]): string {
  return Array.isArray(source) ? source.join("") : source;
}

function sourceLines(source: string | string[]): string[] {
  const text = sourceText(source);
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function formatRead(rel: string, nb: Notebook): string {
  const count = nb.cells.length;
  const out: string[] = [
    `${rel} (nbformat ${nb.nbformat}.${nb.nbformat_minor}, ${count} cell${count === 1 ? "" : "s"})`,
  ];
  nb.cells.forEach((cell, index) => {
    const id = typeof cell.id === "string" && cell.id.length > 0 ? cell.id : "(no id)";
    let head = `[${index}] id=${id} type=${cell.cell_type}`;
    if (cell.cell_type === "code") {
      const outputs = Array.isArray(cell.outputs) ? cell.outputs.length : 0;
      const count_ = cell.execution_count === null || cell.execution_count === undefined ? "null" : cell.execution_count;
      head += ` execution_count=${count_} outputs=${outputs}`;
    }
    out.push(head);
    const lines = sourceLines(cell.source);
    if (lines.length === 0) out.push("    (empty)");
    else for (const line of lines) out.push(`    ${line}`);
  });
  return out.join("\n");
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
    if (!/^[0-9]+$/.test(cellId)) {
      throw new Error(`Cell with ID "${cellId}" not found in notebook.`);
    }
    index = Number.parseInt(cellId, 10);
  }
  if (index >= cells.length) {
    throw new Error(`Cell with index ${index} does not exist in notebook (${cells.length} cells).`);
  }
  return mode === "insert" ? index + 1 : index;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function notebookReadTool(): ToolDefinition {
  return {
    readOnly: true,
    schema: {
      name: "notebook_read",
      description:
        "Read a Jupyter notebook (.ipynb) inside the agent workspace and list its " +
        "cells. Each cell is shown with its stable `id` (or `(no id)` when the " +
        "notebook predates cell ids) and 0-based index, so `notebook_edit` can " +
        "target it. Only nbformat 4 is accepted. Paths are workspace-relative and " +
        "confined to the workspace.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Notebook path, relative to the workspace." },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const { path: userPath } = notebookReadSchema.parse(input);
      const root = workspaceReal(context.workspace);
      const real = confine(root, userPath, true);
      if (!real.toLowerCase().endsWith(".ipynb")) {
        throw new Error(`notebook_read: not a Jupyter notebook (.ipynb): ${userPath}`);
      }
      const stat = fs.statSync(real);
      if (!stat.isFile()) {
        throw new Error(`notebook_read: not a regular file: ${userPath}`);
      }
      if (stat.size > NOTEBOOK_MAX_BYTES) {
        throw new Error(
          `notebook_read: notebook exceeds the maximum size (${NOTEBOOK_MAX_BYTES} bytes): ${userPath}`,
        );
      }
      const text = fs.readFileSync(real, "utf8");
      const rel = path.relative(root, real) || userPath;
      const notebook = parseNotebook(text, rel);
      return truncateHead(formatRead(rel, notebook), maxBytesFor(context), "notebook_read");
    },
  };
}

function notebookEditTool(): ToolDefinition {
  return {
    readOnly: false,
    schema: {
      name: "notebook_edit",
      description:
        "Edit one cell of a Jupyter notebook (.ipynb) inside the agent workspace. " +
        "`edit_mode` is `replace` (default), `insert`, or `delete`. `cell_id` names " +
        "the target cell by its stable id (a numeric value falls back to a 0-based " +
        "index); it is required for replace/delete and, when given for insert, the " +
        "new cell is placed after it (otherwise at the top). `cell_type` is required " +
        "for insert. Only nbformat 4 is accepted; untouched cells, metadata, and " +
        "outputs are preserved, while a code cell whose source is replaced has its " +
        "outputs cleared and execution_count reset to null. Changing a cell to type " +
        "`code` initializes its outputs/execution_count; changing a code cell to " +
        "another type removes them. Inserts get a new " +
        "crypto UUID. The write is atomic and confined to the workspace.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Notebook path, relative to the workspace." },
          cell_id: {
            type: "string",
            description: "Target cell id (or a numeric 0-based index fallback).",
          },
          new_source: { type: "string", description: "New cell source text." },
          cell_type: {
            type: "string",
            enum: [...CELL_TYPES],
            description: "Cell type for insert (required) or to change the type on replace.",
          },
          edit_mode: {
            type: "string",
            enum: [...EDIT_MODES],
            description: "replace (default), insert, or delete.",
          },
        },
        required: ["path", "new_source"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const {
        path: userPath,
        cell_id,
        new_source,
        cell_type,
        edit_mode,
      } = notebookEditSchema.parse(input);
      const mode: EditMode = edit_mode ?? "replace";
      const root = workspaceReal(context.workspace);
      const real = confine(root, userPath, true);
      if (!real.toLowerCase().endsWith(".ipynb")) {
        throw new Error("File must be a Jupyter notebook (.ipynb file).");
      }
      const stat = fs.statSync(real);
      if (!stat.isFile()) {
        throw new Error(`notebook_edit: not a regular file: ${userPath}`);
      }
      if (stat.size > NOTEBOOK_MAX_BYTES) {
        throw new Error(
          `notebook_edit: notebook exceeds the maximum size (${NOTEBOOK_MAX_BYTES} bytes): ${userPath}`,
        );
      }
      if (mode === "insert" && !cell_type) {
        throw new Error("Cell type is required when using edit_mode=insert.");
      }
      const rel = path.relative(root, real) || userPath;
      const notebook = parseNotebook(fs.readFileSync(real, "utf8"), rel);
      const cells = notebook.cells;
      const index = resolveIndex(cells, cell_id, mode);

      let resultId: string | undefined;
      if (mode === "delete") {
        resultId = cells[index]!.id;
        cells.splice(index, 1);
      } else if (mode === "insert") {
        const cell: NotebookCell = { cell_type: cell_type!, source: new_source, metadata: {} };
        if (cell.cell_type === "code") {
          cell.execution_count = null;
          cell.outputs = [];
        }
        cell.id = crypto.randomUUID();
        cells.splice(index, 0, cell);
        resultId = cell.id;
      } else {
        const cell = cells[index]!;
        const nextType: CellType = cell_type !== undefined && cell_type !== cell.cell_type ? cell_type : cell.cell_type;
        cell.source = new_source;
        // A code cell carries execution_count/outputs; initialize them when the
        // cell is (or becomes) code and drop them when it stops being code.
        if (nextType === "code") {
          cell.execution_count = null;
          cell.outputs = [];
        } else if (cell.cell_type === "code") {
          delete cell.execution_count;
          delete cell.outputs;
        }
        if (nextType !== cell.cell_type) {
          cell.cell_type = nextType;
        }
        resultId = cell.id;
      }

      const serialized = `${JSON.stringify(notebook, null, 1)}\n`;
      if (Buffer.byteLength(serialized, "utf8") > NOTEBOOK_MAX_BYTES) {
        throw new Error(
          `notebook_edit: edit rejected; the updated notebook would exceed the maximum size ` +
            `(${NOTEBOOK_MAX_BYTES} bytes). The file was left unchanged.`,
        );
      }
      atomicWrite(real, serialized, stat.mode & 0o7777);

      if (mode === "delete") return `Deleted cell ${resultId ?? index} from ${rel}`;
      if (mode === "insert") return `Inserted cell ${resultId} into ${rel}`;
      return `Updated cell ${resultId ?? index} in ${rel}`;
    },
  };
}

export function createNotebookTools(): ToolDefinition[] {
  return [notebookReadTool(), notebookEditTool()];
}
