// Local stdio LSP adapter. Server output is parsed as data, never evaluated.
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { z } from "zod";

import type { ToolContext, ToolDefinition } from "./tools.js";

export const LSP_MAX_FRAME_BYTES = 1024 * 1024;
export const LSP_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const LSP_STDERR_CAP_BYTES = 8192;
export const LSP_REQUEST_TIMEOUT_MS = 30_000;
export const LSP_MAX_DIAGNOSTIC_FILES = 128;
export const LSP_MAX_DIAGNOSTIC_BYTES = 1024 * 1024;
const HEADER_CAP_BYTES = 8192;
const DOCUMENT_CAP = 128;
const DOCUMENT_BYTES_CAP = 8 * 1024 * 1024;
const DIAGNOSTIC_ENTRY_BYTES = 64 * 1024;
const OUTPUT_CAP_BYTES = 100_000;

export const lspServerConfigSchema = z.object({
  command: z.string().min(1).max(4096).refine((s) => !s.includes("\0")),
  args: z.array(z.string().max(65_536).refine((s) => !s.includes("\0"))).max(256).optional(),
  extensions: z.array(z.string().regex(/^\.?[A-Za-z0-9_+-]+$/)).min(1).max(128),
  languageId: z.string().min(1).max(128).optional(),
}).strict();
export const lspConfigSchema = z.record(z.string().min(1).max(128), lspServerConfigSchema)
  .refine((servers) => Object.keys(servers).length <= 64, "LSP server count exceeds 64");
export const lspServersSchema = lspConfigSchema;
export type LspServerConfig = z.infer<typeof lspServerConfigSchema>;
export type LspConfig = z.infer<typeof lspConfigSchema>;
export type LspContext = Pick<ToolContext, "workspace" | "signal" | "maxOutputBytes">;
export type LspOptions = {
  requestTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  reapTimeoutMs?: number;
};
export type LspTools = { tools: ToolDefinition[]; close(): Promise<void> };

export const LSP_OPERATIONS = [
  "diagnostics", "definition", "references", "hover", "document_symbols",
  "workspace_symbols", "implementation", "type_definition", "call_hierarchy",
] as const;
export const lspInputSchema = z.object({
  operation: z.enum(LSP_OPERATIONS),
  path: z.string().min(1).max(4096).optional(),
  line: z.number().int().min(1).max(10_000_000).optional(),
  column: z.number().int().min(1).max(10_000_000).optional(),
  query: z.string().max(4096).optional(),
  direction: z.enum(["prepare", "incoming", "outgoing", "both"]).optional(),
}).strict();
type Input = z.infer<typeof lspInputSchema>;
type Pending = {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
  signal?: AbortSignal;
  abort?: () => void;
};
type Document = { text: string; version: number; bytes: number };
type DiagnosticEntry = { value: unknown; bytes: number; version: number; truncated: boolean };
const methods: Record<Exclude<Input["operation"], "diagnostics" | "call_hierarchy">, [string, string]> = {
  definition: ["textDocument/definition", "definitionProvider"],
  references: ["textDocument/references", "referencesProvider"],
  hover: ["textDocument/hover", "hoverProvider"],
  document_symbols: ["textDocument/documentSymbol", "documentSymbolProvider"],
  workspace_symbols: ["workspace/symbol", "workspaceSymbolProvider"],
  implementation: ["textDocument/implementation", "implementationProvider"],
  type_definition: ["textDocument/typeDefinition", "typeDefinitionProvider"],
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function aborted(): Error {
  return Object.assign(new Error("LSP request aborted"), { name: "AbortError" });
}
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw aborted();
}
function bounded(text: string, limit: number): string {
  const bytes = Buffer.from(text);
  if (bytes.length <= limit) return text;
  let end = limit;
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString("utf8");
}
function errorText(error: unknown): string {
  return bounded(error instanceof Error ? error.message : String(error), 12_000);
}
function within(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === "" || (!path.isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${path.sep}`));
}
function reserved(root: string, target: string): boolean {
  return path.relative(root, target).split(path.sep).includes(".agent");
}
function confine(root: string, userPath: string): string {
  if (path.isAbsolute(userPath) || userPath.includes("\0")) throw new Error("LSP requires a workspace-relative path");
  const target = path.resolve(root, userPath);
  if (!within(root, target)) throw new Error("LSP path escapes the workspace");
  if (userPath.split(/[\\/]/).includes(".agent")) throw new Error("LSP path is inside reserved .agent directory");
  let current = root;
  for (const segment of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = fs.realpathSync(path.join(current, segment));
    if (!within(root, current)) throw new Error("LSP path escapes the workspace through a symlink");
    if (reserved(root, current)) throw new Error("LSP path aliases reserved .agent directory");
  }
  return current;
}
function readDocument(root: string, userPath: string): { file: string; text: string } {
  const file = confine(root, userPath);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw new Error("LSP path must be a regular file");
    if (stat.size > LSP_MAX_FILE_BYTES) throw new Error(`LSP file exceeds ${LSP_MAX_FILE_BYTES} byte limit`);
    const rechecked = confine(root, userPath);
    const current = fs.statSync(rechecked);
    if (rechecked !== file || current.dev !== stat.dev || current.ino !== stat.ino) throw new Error("LSP file changed during path validation");
    const data = Buffer.alloc(Math.min(stat.size + 1, LSP_MAX_FILE_BYTES + 1));
    let used = 0;
    while (used < data.length) {
      const n = fs.readSync(fd, data, used, data.length - used, used);
      if (n === 0) break;
      used += n;
    }
    if (used > stat.size || used > LSP_MAX_FILE_BYTES) throw new Error("LSP file grew during bounded read; retry");
    return { file, text: new TextDecoder("utf-8", { fatal: true }).decode(data.subarray(0, used)) };
  } finally {
    fs.closeSync(fd);
  }
}
function option(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error("Invalid LSP timeout option");
  return value;
}
async function untilExit(exited: Promise<void>, ms: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([exited, new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); })]);
  } finally {
    clearTimeout(timer);
  }
}
// Waiting for another call must remain cancellable without running a queued call.
async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  checkAbort(signal);
  let listener!: () => void;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      listener = () => reject(aborted());
      signal.addEventListener("abort", listener, { once: true });
    })]);
  } finally {
    signal.removeEventListener("abort", listener);
  }
}

/** One configured server, started lazily; close also sweeps its POSIX process group. */
export class LspClient {
  private child?: ChildProcess;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private buffer: Buffer = Buffer.alloc(0);
  private bodyLength?: number;
  private stderr: Buffer = Buffer.alloc(0);
  private failure?: Error;
  private closing = false;
  private killed = false;
  private initialized = false;
  private ready?: Promise<void>;
  private closePromise?: Promise<void>;
  private exited: Promise<void> = Promise.resolve();
  private resolveExit: () => void = () => {};
  private queue: Promise<unknown> = Promise.resolve();
  private documents = new Map<string, Document>();
  private diagnostics = new Map<string, DiagnosticEntry>();
  private capabilities: Record<string, unknown> = {};
  private root?: string;
  private readonly requestTimeout: number;
  private readonly shutdownTimeout: number;
  private readonly reapTimeout: number;
  private readonly config: LspServerConfig;
  private readonly onSessionAbort = () => { void this.close(); };

  constructor(readonly name: string, config: LspServerConfig, private readonly context: LspContext, options: LspOptions = {}) {
    this.config = lspServerConfigSchema.parse(config);
    this.requestTimeout = option(options.requestTimeoutMs, LSP_REQUEST_TIMEOUT_MS, 120_000);
    this.shutdownTimeout = option(options.shutdownTimeoutMs, 500, 5000);
    this.reapTimeout = option(options.reapTimeoutMs, 1000, 5000);
    if (context.signal.aborted) this.closing = true;
    else context.signal.addEventListener("abort", this.onSessionAbort, { once: true });
  }

  async execute(input: Input, signal: AbortSignal): Promise<unknown> {
    checkAbort(signal);
    checkAbort(this.context.signal);
    if (this.closing) throw this.failure ?? new Error("LSP connection closed");
    const previous = this.queue;
    const operation = (async () => {
      await abortable(previous, signal);
      checkAbort(signal);
      checkAbort(this.context.signal);
      if (this.closing) throw this.failure ?? new Error("LSP connection closed");
      return this.perform(input, signal);
    })();
    // An aborted waiter cannot let its successor overtake the still-running call.
    this.queue = Promise.allSettled([previous, operation]);
    return operation;
  }

  private async perform(input: Input, signal: AbortSignal): Promise<unknown> {
    this.root ??= fs.realpathSync(this.context.workspace);
    let file: string | undefined;
    let text: string | undefined;
    const positionOperation = !["diagnostics", "document_symbols", "workspace_symbols"].includes(input.operation);
    if (input.operation !== "workspace_symbols" || input.path !== undefined) {
      if (!input.path) throw new Error("LSP operation requires path");
      ({ file, text } = readDocument(this.root, input.path));
    }
    if (positionOperation) {
      if (input.line === undefined || input.column === undefined) throw new Error("LSP operation requires 1-based line and column");
      const lines = text!.split(/\r\n|\r|\n/);
      if (input.line > lines.length || input.column > lines[input.line - 1]!.length + 1) throw new Error("LSP position is outside the document (columns use UTF-16 code units)");
    }
    checkAbort(signal);
    await this.start(signal);
    checkAbort(signal);
    const capability = input.operation === "call_hierarchy" ? "callHierarchyProvider"
      : input.operation === "diagnostics" ? undefined : methods[input.operation][1];
    if (capability && !this.capabilities[capability]) {
      return { status: "unsupported", server: this.name, operation: input.operation, capability };
    }
    const uri = file ? pathToFileURL(file).href : undefined;
    if (uri && text !== undefined) this.syncDocument(uri, text, file!);
    const position = { line: (input.line ?? 1) - 1, character: (input.column ?? 1) - 1 };
    const params = { textDocument: { uri }, position };
    let result: unknown;
    if (input.operation === "diagnostics") {
      if (this.capabilities.diagnosticProvider) {
        result = await this.request("textDocument/diagnostic", { textDocument: { uri } }, signal);
        return { status: "ok", server: this.name, source: "pull", result: this.coordinates(result) };
      }
      const cached = this.diagnostics.get(uri!);
      return cached ? { status: "ok", server: this.name, source: "publishDiagnostics", version: cached.version, truncated: cached.truncated, result: this.coordinates(cached.value) }
        : { status: "pending", server: this.name, message: "Waiting for publishDiagnostics for the current document version" };
    }
    if (input.operation === "call_hierarchy") {
      const prepared = await this.request("textDocument/prepareCallHierarchy", params, signal);
      if (prepared !== null && !Array.isArray(prepared)) throw new Error("LSP returned invalid call hierarchy items");
      const items = (prepared ?? []) as unknown[];
      const direction = input.direction ?? "both";
      if (items.length > 64) throw new Error("LSP call hierarchy exceeds 64 prepared items");
      const calls: unknown[] = [];
      for (const item of items) {
        checkAbort(signal);
        const entry: Record<string, unknown> = { item };
        if (direction === "incoming" || direction === "both") entry.incoming = await this.request("callHierarchy/incomingCalls", { item }, signal);
        if (direction === "outgoing" || direction === "both") entry.outgoing = await this.request("callHierarchy/outgoingCalls", { item }, signal);
        calls.push(entry);
      }
      result = direction === "prepare" ? items : calls;
    } else {
      const method = methods[input.operation][0];
      result = await this.request(method, input.operation === "workspace_symbols" ? { query: input.query ?? "" }
        : input.operation === "document_symbols" ? { textDocument: { uri } }
        : input.operation === "references" ? { ...params, context: { includeDeclaration: true } } : params, signal);
    }
    return { status: "ok", server: this.name, operation: input.operation, result: this.coordinates(result) };
  }

  private async start(signal: AbortSignal): Promise<void> {
    checkAbort(signal);
    checkAbort(this.context.signal);
    if (this.closing) throw this.failure ?? new Error("LSP connection closed");
    if (!this.ready) {
      this.ready = (async () => {
        this.exited = new Promise<void>((resolve) => { this.resolveExit = resolve; });
        this.child = spawn(this.config.command, this.config.args ?? [], {
          cwd: this.root!, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32",
        });
        this.child.stdin!.on("error", (error) => { if (!this.closing) this.fail(error); });
        this.child.stdout!.on("error", (error) => { if (!this.closing) this.fail(error); });
        this.child.stderr!.on("error", () => {});
        this.child.stdout!.on("data", (chunk: Buffer) => this.ingest(chunk));
        this.child.stdout!.on("end", () => { if (!this.closing) this.fail(new Error("LSP stdout ended")); });
        this.child.stderr!.on("data", (chunk: Buffer) => {
          const tail = Buffer.concat([this.stderr, chunk]);
          this.stderr = Buffer.from(tail.subarray(Math.max(0, tail.length - LSP_STDERR_CAP_BYTES)));
        });
        this.child.once("error", (error) => { this.resolveExit(); this.fail(error); });
        this.child.once("exit", (code, exitSignal) => {
          this.resolveExit();
          if (!this.closing) this.fail(new Error(`LSP server exited (code ${code}, signal ${exitSignal})`));
        });
        const result = await this.request("initialize", {
          processId: process.pid,
          clientInfo: { name: "personal-agent-harness", version: "0.1.0" },
          rootUri: pathToFileURL(this.root!).href,
          workspaceFolders: this.folders(),
          capabilities: {
            general: { positionEncodings: ["utf-16"] },
            workspace: { configuration: true, workspaceFolders: true },
            textDocument: { synchronization: { didSave: false }, publishDiagnostics: { versionSupport: true }, diagnostic: {} },
          },
        }, signal);
        if (!record(result) || !record(result.capabilities)) throw new Error("LSP initialize requires capabilities");
        if (result.capabilities.positionEncoding !== undefined && result.capabilities.positionEncoding !== "utf-16") throw new Error("LSP server requires unsupported position encoding");
        this.capabilities = result.capabilities;
        this.notify("initialized", {});
        this.initialized = true;
      })().catch(async (error) => {
        this.fail(error instanceof Error ? error : new Error(errorText(error)));
        await this.close();
        throw error;
      });
    }
    await abortable(this.ready, signal);
  }

  private syncDocument(uri: string, text: string, file: string): void {
    const previous = this.documents.get(uri);
    if (previous?.text === text) return;
    const bytes = Buffer.byteLength(text);
    if (!previous && this.documents.size >= DOCUMENT_CAP) throw new Error("LSP open document count limit reached");
    const total = [...this.documents.values()].reduce((sum, doc) => sum + doc.bytes, 0) - (previous?.bytes ?? 0) + bytes;
    if (total > DOCUMENT_BYTES_CAP) throw new Error("LSP open document byte limit reached");
    const version = (previous?.version ?? 0) + 1;
    this.diagnostics.delete(uri);
    if (!previous) {
      this.notify("textDocument/didOpen", { textDocument: {
        uri, languageId: this.config.languageId ?? path.extname(file).slice(1), version, text,
      } });
    } else {
      const sync = this.capabilities.textDocumentSync;
      const changeKind = record(sync) ? sync.change : sync;
      if (changeKind !== 1 && changeKind !== 2) throw new Error("LSP server does not advertise document change synchronization");
      // Incremental servers accept a replacement range in the previous version.
      const lines = previous.text.split(/\r\n|\r|\n/);
      const changes = changeKind === 2 ? [{ range: { start: { line: 0, character: 0 }, end: { line: lines.length - 1, character: lines.at(-1)!.length } }, text }] : [{ text }];
      this.notify("textDocument/didChange", { textDocument: { uri, version }, contentChanges: changes });
    }
    this.documents.set(uri, { text, version, bytes });
  }

  private folders(): unknown[] {
    return [{ uri: pathToFileURL(this.root!).href, name: path.basename(this.root!) }];
  }
  private send(message: unknown, duringClose = false): void {
    if (this.failure || (this.closing && !duringClose)) throw this.failure ?? new Error("LSP connection closed");
    const stdin = this.child?.stdin;
    if (!stdin || stdin.destroyed || !stdin.writable) throw new Error("LSP stdin closed");
    const body = Buffer.from(JSON.stringify(message));
    // Only inbound frames are capped at 1 MiB; didOpen may contain a 2 MiB file.
    if (stdin.writableLength + body.length > 16 * 1024 * 1024) throw new Error("LSP outbound buffer limit reached");
    stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]));
  }
  private notify(method: string, params: unknown, duringClose = false): void {
    this.send({ jsonrpc: "2.0", method, params }, duringClose);
  }
  private request(method: string, params: unknown, signal?: AbortSignal, timeout = this.requestTimeout, duringClose = false): Promise<unknown> {
    checkAbort(signal);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const finish = (error: Error) => {
        if (!this.pending.delete(id)) return;
        this.clearPending(pending);
        try { this.notify("$/cancelRequest", { id }, duringClose); } catch {}
        reject(error);
      };
      const pending: Pending = {
        resolve, reject, signal,
        timer: setTimeout(() => finish(new Error(`LSP ${method} timed out after ${timeout}ms`)), timeout),
      };
      pending.abort = () => finish(aborted());
      signal?.addEventListener("abort", pending.abort, { once: true });
      this.pending.set(id, pending);
      try { this.send({ jsonrpc: "2.0", id, method, params }, duringClose); }
      catch (error) {
        this.pending.delete(id);
        this.clearPending(pending);
        reject(error);
      }
    });
  }
  private clearPending(pending: Pending): void {
    clearTimeout(pending.timer);
    if (pending.abort) pending.signal?.removeEventListener("abort", pending.abort);
  }
  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) { this.clearPending(pending); pending.reject(error); }
    this.pending.clear();
  }
  private fail(error: Error): void {
    if (this.failure) return;
    this.failure = new Error(bounded(`${errorText(error)}${this.stderr.length ? `; stderr: ${this.stderr.toString("utf8")}` : ""}`, 12_000));
    this.rejectAll(this.failure);
    void this.close();
  }

  private ingest(chunk: Buffer): void {
    if (this.failure) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    try {
      for (;;) {
        if (this.bodyLength === undefined) {
          const end = this.buffer.indexOf("\r\n\r\n");
          if (end < 0) {
            if (this.buffer.length > HEADER_CAP_BYTES) throw new Error("LSP header exceeds byte limit");
            return;
          }
          if (end > HEADER_CAP_BYTES) throw new Error("LSP header exceeds byte limit");
          const headers = this.buffer.subarray(0, end).toString("ascii").split("\r\n");
          const lengths = headers.filter((h) => /^content-length\s*:/i.test(h));
          if (lengths.length !== 1 || !/^content-length:\s*[0-9]+\s*$/i.test(lengths[0]!)) throw new Error("LSP invalid Content-Length header");
          const length = Number(lengths[0]!.split(":")[1]);
          if (!Number.isSafeInteger(length) || length < 1 || length > LSP_MAX_FRAME_BYTES) throw new Error("LSP frame exceeds byte limit or has invalid length");
          this.bodyLength = length;
          this.buffer = this.buffer.subarray(end + 4);
        }
        if (this.buffer.length < this.bodyLength) return;
        const body = this.buffer.subarray(0, this.bodyLength);
        this.buffer = this.buffer.subarray(this.bodyLength);
        this.bodyLength = undefined;
        this.dispatch(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
        if (this.failure) return;
      }
    } catch (error) { this.fail(new Error(`LSP protocol error: ${errorText(error)}`)); }
  }

  private dispatch(message: unknown): void {
    if (!record(message) || message.jsonrpc !== "2.0") throw new Error("Invalid JSON-RPC message");
    if (typeof message.method === "string") {
      if (message.id !== undefined) {
        if (typeof message.id !== "number" && typeof message.id !== "string") throw new Error("Invalid server request id");
        let result: unknown;
        if (message.method === "workspace/configuration") {
          const items = record(message.params) ? message.params.items : undefined;
          if (!Array.isArray(items) || items.length > 256) {
            this.send({ jsonrpc: "2.0", id: message.id, error: { code: -32602, message: "Invalid configuration items" } }, true);
            return;
          }
          result = items.map(() => null);
        } else if (message.method === "workspace/workspaceFolders") result = this.folders();
        else {
          this.send({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method unsupported by LSP client" } }, true);
          return;
        }
        this.send({ jsonrpc: "2.0", id: message.id, result }, true);
      } else if (message.method === "textDocument/publishDiagnostics") this.cacheDiagnostics(message.params);
      return;
    }
    if (typeof message.id !== "number") throw new Error("Invalid JSON-RPC response id");
    const pending = this.pending.get(message.id);
    if (!pending) return;
    if (("result" in message) === ("error" in message)) throw new Error("JSON-RPC response needs result or error");
    this.pending.delete(message.id);
    this.clearPending(pending);
    if ("error" in message) {
      const error = record(message.error) ? message.error : {};
      pending.reject(new Error(`LSP RPC error ${error.code ?? "unknown"}: ${bounded(String(error.message ?? "unknown error"), 4096)}`));
    } else pending.resolve(message.result);
  }

  private cacheDiagnostics(params: unknown): void {
    if (!record(params) || typeof params.uri !== "string" || !Array.isArray(params.diagnostics)) return;
    const doc = this.documents.get(params.uri);
    if (!doc || (params.version !== undefined && params.version !== doc.version)) return;
    const value: unknown[] = [];
    let bytes = 2;
    for (const diagnostic of params.diagnostics.slice(0, 500)) {
      const size = Buffer.byteLength(JSON.stringify(diagnostic)) + (value.length ? 1 : 0);
      if (bytes + size > DIAGNOSTIC_ENTRY_BYTES) break;
      value.push(diagnostic);
      bytes += size;
    }
    this.diagnostics.delete(params.uri);
    this.diagnostics.set(params.uri, { value, bytes, version: doc.version, truncated: value.length < params.diagnostics.length });
    let total = [...this.diagnostics.values()].reduce((sum, entry) => sum + entry.bytes, 0);
    while (this.diagnostics.size > LSP_MAX_DIAGNOSTIC_FILES || total > LSP_MAX_DIAGNOSTIC_BYTES) {
      const first = this.diagnostics.keys().next().value!;
      total -= this.diagnostics.get(first)!.bytes;
      this.diagnostics.delete(first);
    }
  }

  private coordinates(value: unknown, depth = 0): unknown {
    if (depth > 64) throw new Error("LSP result nesting exceeds limit");
    if (Array.isArray(value)) return value.map((item) => this.coordinates(item, depth + 1));
    if (!record(value)) return value;
    if (Number.isInteger(value.line) && Number.isInteger(value.character)) return { ...value, line: (value.line as number) + 1, column: (value.character as number) + 1, character: undefined };
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      // LSP data is opaque server state and must round-trip without coordinate edits.
      Object.defineProperty(out, key, { value: key === "data" ? item : this.coordinates(item, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    if (typeof value.uri === "string" && value.uri.startsWith("file:")) {
      try {
        const file = fileURLToPath(value.uri);
        if (within(this.root!, file) && !reserved(this.root!, file)) out.path = path.relative(this.root!, file);
      } catch {}
    }
    return out;
  }

  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closing = true;
    this.context.signal.removeEventListener("abort", this.onSessionAbort);
    this.rejectAll(this.failure ?? new Error("LSP connection closed"));
    this.closePromise = (async () => {
      if (!this.child) return;
      try {
        if (this.initialized && !this.failure) {
          try { await this.request("shutdown", null, undefined, this.shutdownTimeout, true); } catch {}
          try { this.notify("exit", undefined, true); } catch {}
          await untilExit(this.exited, this.shutdownTimeout);
        }
      } finally {
        if (!this.killed) {
          this.killed = true;
          try {
            if (process.platform !== "win32" && this.child.pid) process.kill(-this.child.pid, "SIGKILL");
            else this.child.kill("SIGKILL");
          } catch { try { this.child.kill("SIGKILL"); } catch {} }
        }
        await untilExit(this.exited, this.reapTimeout);
        for (const stream of [this.child.stdin, this.child.stdout, this.child.stderr]) stream?.destroy();
        this.rejectAll(new Error("LSP connection closed"));
        this.documents.clear();
        this.diagnostics.clear();
        this.buffer = Buffer.alloc(0);
        this.stderr = Buffer.alloc(0);
      }
    })();
    return this.closePromise;
  }
}

/** Config-only construction: validates definitions, without spawning or reading files. */
export function createLspTools(config: LspConfig, context: LspContext, options: LspOptions = {}): LspTools {
  const servers = lspConfigSchema.parse(config);
  const clients = Object.entries(servers).map(([name, definition]) => new LspClient(name, definition, context, options));
  const extensions = new Map<string, LspClient>();
  for (const client of clients) {
    for (const extension of servers[client.name]!.extensions) {
      const key = `.${extension.replace(/^\./, "").toLowerCase()}`;
      if (extensions.has(key)) {
        for (const item of clients) void item.close();
        throw new Error(`Ambiguous LSP extension: ${key}`);
      }
      extensions.set(key, client);
    }
  }
  return {
    tools: clients.length === 0 ? [] : [{
      schema: {
        name: "lsp",
        description: "Query configured local language servers. Capabilities are pending until lazy initialization; absent providers return explicit unsupported status. Paths are workspace-relative; input and output lines/columns are 1-based UTF-16. Diagnostics report pending until the server publishes them. Call hierarchy prepares items, then queries incoming/outgoing calls; default direction is both.",
        input_schema: {
          type: "object", additionalProperties: false, required: ["operation"],
          properties: {
            operation: { type: "string", enum: [...LSP_OPERATIONS] },
            path: { type: "string", description: "Workspace-relative file; required except workspace_symbols." },
            line: { type: "integer", minimum: 1, description: "1-based line for position operations." },
            column: { type: "integer", minimum: 1, description: "1-based UTF-16 column for position operations." },
            query: { type: "string", description: "Workspace symbol query." },
            direction: { type: "string", enum: ["prepare", "incoming", "outgoing", "both"] },
          },
        },
      },
      readOnly: true,
      async execute(raw, toolContext) {
        const limit = Math.min(OUTPUT_CAP_BYTES,
          Number.isFinite(toolContext.maxOutputBytes) && toolContext.maxOutputBytes >= 1 ? Math.floor(toolContext.maxOutputBytes) : OUTPUT_CAP_BYTES,
          Number.isFinite(context.maxOutputBytes) && context.maxOutputBytes >= 1 ? Math.floor(context.maxOutputBytes) : OUTPUT_CAP_BYTES);
        try {
          checkAbort(toolContext.signal);
          checkAbort(context.signal);
          if (path.resolve(toolContext.workspace) !== path.resolve(context.workspace)) throw new Error("LSP tool workspace differs from its session workspace");
          const input = lspInputSchema.parse(raw);
          const client = input.path ? extensions.get(path.extname(input.path).toLowerCase()) : input.operation === "workspace_symbols" && clients.length === 1 ? clients[0] : undefined;
          if (!client) throw new Error(input.operation === "workspace_symbols" ? "Workspace symbols require a path to select a configured server" : "No configured LSP server for file extension");
          const result = JSON.stringify(await client.execute(input, toolContext.signal));
          return Buffer.byteLength(result) <= limit ? result : bounded(`${bounded(result, Math.max(0, limit - 24))}\n[lsp: output truncated]`, limit);
        } catch (error) {
          const result = JSON.stringify({ status: error instanceof Error && error.name === "AbortError" ? "aborted" : "error", message: errorText(error) });
          return bounded(result, limit);
        }
      },
    }],
    async close() { await Promise.allSettled(clients.map((client) => client.close())); },
  };
}
