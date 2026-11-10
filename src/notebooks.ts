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

import { atomicWriteFile } from "./atomic-write.js";
import { decodeFileBytes, lwe } from "./path-approval-decoder-source.js";
import { readStableDirectoryFile } from "./directory-file-state.js";
import { verifyIdentity, type ResolvedPath } from "./path-identity.js";

import { z } from "zod";

import { captureExternalEdit, confineResolved, consumeWriteApproval, publishExternalEdit, registerBuiltinEdit, requireDirectoryHandle, verifyApprovedEditInput, type ToolContext, type ToolDefinition } from "./tools.js";

import { NOTEBOOK_MAX_BYTES, CELL_TYPES, EDIT_MODES, notebookEditSchema, parseNotebook, renderNotebookEdit, type Notebook } from "./notebook-edit.js";
const FALLBACK_MAX_OUTPUT_BYTES = 100_000;

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

function atomicWrite(real: string, content: Buffer, mode?: number) {
  // Delegated to the shared writer, so a notebook write is verified the same
  // way a text write is.
  return atomicWriteFile(real, content, mode === undefined ? { label: "notebook_edit" } : { mode, label: "notebook_edit" });
}

// NotebookEdit.validateInput/call, sfn1dbxq [4177228,4181923), UTF-16.
async function readNotebookFile(resolved: ResolvedPath, userPath: string, tool: 'notebook_edit' | 'notebook_read',
  context: ToolContext, cacheKey: string) {
  const file = await fs.promises.open(resolved.path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = await file.stat({ bigint: true });
    if (!stat.isFile()) throw new Error(`${tool}: not a regular file: ${userPath}`);
    const identity = { dev: String(stat.dev), ino: String(stat.ino) };
    if (identity.dev !== resolved.identity?.dev || identity.ino !== resolved.identity?.ino)
      throw new Error(`${tool}: file changed before read: ${userPath}`);
    const timestamp = Number(stat.mtimeNs / 1000000n);
    if (tool === 'notebook_edit' && context.readFileCache) {
      const prior = context.readFileCache.get(cacheKey);
      if (!prior) throw new Error('File has not been read yet. Read it first before writing to it.');
      if (timestamp > prior.timestamp || (prior.identity && (prior.realPath !== resolved.path ||
          prior.identity.dev !== identity.dev || prior.identity.ino !== identity.ino)))
        throw new Error('File has been modified since read. Read it again before attempting to write it.');
    }
    if (stat.size > NOTEBOOK_MAX_BYTES) throw new Error(`${tool}: notebook exceeds the maximum size (${NOTEBOOK_MAX_BYTES} bytes): ${userPath}`);
    const decoded = await lwe(file, resolved.path, NOTEBOOK_MAX_BYTES);
    if (decoded.lossyDecode) throw new Error(`${tool}: unsupported encoding; invalid UTF-8`);
    verifyIdentity(resolved);
    context.signal.throwIfAborted();
    return { decoded, identity, timestamp, fileMode: Number(stat.mode & 0o7777n) };
  } finally { await file.close(); }
}

// ---------------------------------------------------------------------------
// Notebook model and validation
// ---------------------------------------------------------------------------

const notebookReadSchema = z.object({ path: z.string().min(1) }).strict();

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

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function notebookReadTool(): ToolDefinition {
  return {
    readOnly: true,
    schema: {
      name: "notebook_read",
      description:
        "Read a Jupyter notebook (.ipynb) in the workspace or an explicitly granted directory and list its " +
        "cells. Each cell is shown with its stable `id` (or `(no id)` when the " +
        "notebook predates cell ids) and 0-based index, so `notebook_edit` can " +
        "target it. Only nbformat 4 is accepted.",
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
      const resolved = confineResolved(root, userPath, true, context.workingDirectories?.(true));
      const real = resolved.path;
      if (context.readApproval && real !== context.readApproval.landing)
        throw new Error('notebook_read: read approval changed');
      if (!real.toLowerCase().endsWith(".ipynb")) {
        throw new Error(`notebook_read: not a Jupyter notebook (.ipynb): ${userPath}`);
      }
      const cacheKey = path.resolve(root, userPath);
      let decoded: ReturnType<typeof decodeFileBytes>, identity: { dev: string; ino: string }, timestamp: number;
      if (isWithin(root, real)) {
        ({decoded, identity, timestamp} = await readNotebookFile(resolved, userPath, 'notebook_read', context, cacheKey));
      } else {
        const grant = requireDirectoryHandle(context, cacheKey, true);
        const signal = AbortSignal.any([grant.signal, context.signal]);
        const read = readStableDirectoryFile({ fd: grant.fd, relative: path.relative(grant.root, cacheKey) }, NOTEBOOK_MAX_BYTES, signal);
        if (!read || read.observation.dev !== resolved.identity?.dev || read.observation.ino !== resolved.identity?.ino)
          throw new Error('notebook_read: directory notebook is unavailable or changed');
        verifyIdentity(resolved);
        decoded = decodeFileBytes(read.bytes);
        if (decoded.lossyDecode) throw new Error('notebook_read: unsupported encoding; invalid UTF-8');
        identity = {dev: read.observation.dev, ino: read.observation.ino};
        timestamp = Number(BigInt(read.observation.mtimeSeconds) * 1000n + BigInt(read.observation.mtimeNanoseconds) / 1000000n);
        context.readGrantWitness?.({owner: grant.owner, incarnation: grant.incarnation});
      }
      const rel = path.relative(root, real) || userPath;
      const notebook = parseNotebook(decoded.content, rel);
      const rendered = formatRead(rel, notebook);
      const content = truncateHead(rendered, maxBytesFor(context), "notebook_read");
      const truncated = rendered !== content;
      const offset = 1, limit = Number.MAX_SAFE_INTEGER;
      context.readFileCache?.set(cacheKey, {content, identity, timestamp, realPath: real,
        isPartialView: truncated, contentNotInModelContext: true, offset, limit});
      context.hostResult?.({kind:'file_read', filePath:real, cacheKey, content, mtimeMs:timestamp, identity, offset, limit, truncated});
      return content;
    },
  };
}

function notebookEditTool(): ToolDefinition {
  return {
    toAutoClassifierInput(input) { const value = notebookEditSchema.parse(input); const mode = value.edit_mode ?? 'replace';
      return { notebook_path: value.path, mode, ...(value.cell_id === undefined ? {} : { cell_id: value.cell_id }),
        ...(mode !== 'delete' && value.cell_type !== undefined ? { cell_type: value.cell_type } : {}),
        ...(mode === 'delete' ? { ignored_source: value.new_source } : { adds: value.new_source }) }; },
    readOnly: false,
    schema: {
      name: "notebook_edit",
      description:
        "Edit one cell of a Jupyter notebook (.ipynb) in the workspace or an explicitly granted directory. " +
        "`edit_mode` is `replace` (default), `insert`, or `delete`. `cell_id` names " +
        "the target cell by its stable id (a numeric value falls back to a 0-based " +
        "index); it is required for replace/delete and, when given for insert, the " +
        "new cell is placed after it (otherwise at the top). `cell_type` is required " +
        "for insert. Only nbformat 4 is accepted; untouched cells, metadata, and " +
        "outputs are preserved, while a code cell whose source is replaced has its " +
        "outputs cleared and execution_count reset to null. A cell-N selector addresses " +
        "the zero-based index N. Inserted cells receive an eight-character ID in nbformat 4.5 and later.",
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
      const parsed = notebookEditSchema.parse(input);
      verifyApprovedEditInput(input, parsed);
      const { path: userPath, edit_mode: mode = "replace", cell_type } = parsed;
      consumeWriteApproval(context, path.resolve(context.workspace, userPath).normalize('NFC'), 'notebook_edit');
      const root = workspaceReal(context.workspace);
      const resolved = confineResolved(root, userPath, true, context.workingDirectories?.(false));
      const real = resolved.path;
      if (!real.toLowerCase().endsWith(".ipynb")) {
        throw new Error("File must be a Jupyter notebook (.ipynb file).");
      }
      if (mode === "insert" && !cell_type) {
        throw new Error("Cell type is required when using edit_mode=insert.");
      }
      const rel = path.relative(root, real) || userPath;
      // NotebookEdit.call, sfn1dbxq [4179123,4181923), UTF-16: readExisting
      // and recheckBeforeWrite refer to the same resolved notebook.
      const cacheKey = path.resolve(root, userPath);
      const external = !isWithin(root, real);
      if (external && (resolved.identity?.size ?? 0) > NOTEBOOK_MAX_BYTES) throw new Error('notebook_edit: notebook exceeds the maximum size');
      const original = external ? await captureExternalEdit(context, resolved, cacheKey,
        { ...parsed, ...(context.notebookInsertId ? { insertId: context.notebookInsertId } : {}) })
        : await readNotebookFile(resolved, userPath, 'notebook_edit', context, cacheKey);
      if ('observed' in original) {
        const prior = context.readFileCache?.get(cacheKey), observation = original.observed;
        if (!prior?.identity) throw new Error('File has not been read yet. Read it first before writing to it.');
        if (prior.realPath !== real || prior.identity.dev !== observation.dev || prior.identity.ino !== observation.ino ||
            Number(BigInt(observation.mtimeSeconds) * 1000n + BigInt(observation.mtimeNanoseconds) / 1000000n) > prior.timestamp)
          throw new Error('File has been modified since read. Read it again before attempting to write it.');
      }
      const { serialized, json, resultId, index } = renderNotebookEdit(original.decoded, parsed, rel,
        () => context.notebookInsertId ?? crypto.randomUUID().slice(0, 8));
      if (!external) context.fileHistory?.(real);
      verifyIdentity(resolved);
      context.signal.throwIfAborted();
      const publication = 'retained' in original ? publishExternalEdit(context, original.retained, cacheKey, serialized)
        : atomicWrite(real, serialized, original.fileMode);
      const landed = { filePath: real, cacheKey, content: json, mtimeMs: publication.mtimeMs, identity: publication.identity };
      context.readFileCache?.clear();
      context.readFileCache?.set(cacheKey, { content: json, timestamp: Math.floor(publication.mtimeMs),
        identity: publication.identity, realPath: real, contentNotInModelContext: true });
      context.hostResult?.({ kind: 'notebook_edit', landed });

      if (mode === "delete") return `Deleted cell ${resultId ?? index} from ${rel}`;
      if (mode === "insert") return `Inserted cell ${resultId ?? index} into ${rel}`;
      return `Updated cell ${resultId ?? index} in ${rel}`;
    },
  };
}

export function createNotebookTools(): ToolDefinition[] {
  return [notebookReadTool(), registerBuiltinEdit(notebookEditTool())];
}
