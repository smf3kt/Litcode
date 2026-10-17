// Independent task-tracking tools with a durable, lock-guarded JSON store.
//
// This module is self-contained and owns its own store at
// `<workspace>/.agent/tasks.json`. The `.agent` directory is reserved and
// excluded by the generic file tools in `tools.ts`; these task tools are the
// intended owner of that internal store and reach it directly, never through
// the workspace-confined file tools. It touches no shared file and executes no
// model, network, or recovered code: every operation is filesystem + crypto.
//
// Guarantees:
//   - The workspace is canonicalized once via realpath and closed over, so a
//     caller cannot relocate the store with a symlinked or relative workspace.
//   - `.agent`, the store file, and the lock file are lstat-guarded against
//     symlinks; a symlinked component is refused, never followed.
//   - Every mutation holds an exclusive `wx` lock released in `finally`, and
//     persists with a temp file + fsync + rename (atomic).
//   - Reads fail closed: the store is size-capped and schema-validated, and
//     referential integrity (no missing/self/cyclic dependencies) is rechecked.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { ToolContext, ToolDefinition } from "./tools.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_DIR = ".agent";
const STORE_NAME = "tasks.json";
const LOCK_NAME = "tasks.json.lock";
const STORE_VERSION = 1;
const MAX_STORE_BYTES = 8 * 1024 * 1024;
const FALLBACK_MAX_OUTPUT_BYTES = 100_000;
const AGENT_DIR_MODE = 0o700;
const STORE_FILE_MODE = 0o600;
const LOCK_FILE_MODE = 0o600;
const LOCK_FLAGS =
  fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW;

const STATUSES = ["pending", "in_progress", "completed"] as const;
// Harness/bookkeeping metadata that read projections hide from the model.
const INTERNAL_METADATA_KEY = "_internal";

// ---------------------------------------------------------------------------
// Schemas (strict)
// ---------------------------------------------------------------------------

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);

const metadataSchema = z.record(z.string(), jsonSchema);
const statusSchema = z.enum(STATUSES);

const taskSchema = z
  .object({
    id: z.string().uuid(),
    subject: z.string().min(1).max(2000),
    description: z.string().max(100_000),
    activeForm: z.string().min(1).max(2000).optional(),
    owner: z.string().min(1).max(200).optional(),
    metadata: metadataSchema,
    status: statusSchema,
    blockedBy: z.array(z.string().uuid()),
  })
  .strict();

const storeSchema = z
  .object({
    version: z.literal(STORE_VERSION),
    tasks: z.array(taskSchema),
  })
  .strict();

const createSchema = z
  .object({
    subject: z.string().min(1).max(2000),
    description: z.string().max(100_000),
    activeForm: z.string().min(1).max(2000).optional(),
    metadata: metadataSchema.optional(),
  })
  .strict();

const getSchema = z.object({ id: z.string().uuid() }).strict();

const listSchema = z.object({ status: statusSchema.optional() }).strict();

const updateSchema = z
  .object({
    id: z.string().uuid(),
    subject: z.string().min(1).max(2000).optional(),
    description: z.string().max(100_000).optional(),
    activeForm: z.string().min(1).max(2000).optional(),
    status: statusSchema.optional(),
    owner: z.string().min(1).max(200).optional(),
    metadata: metadataSchema.optional(),
    addBlockedBy: z.array(z.string().uuid()).optional(),
    removeBlockedBy: z.array(z.string().uuid()).optional(),
    deleted: z.boolean().optional(),
  })
  .strict();

const reciprocalUpdateSchema = updateSchema.extend({
  addBlocks: z.array(z.string().uuid()).optional(),
  removeBlocks: z.array(z.string().uuid()).optional(),
});

export type TaskRecord = z.infer<typeof taskSchema>;
type TaskStore = z.infer<typeof storeSchema>;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function abortError(): Error {
  const error = new Error("operation aborted before it started");
  error.name = "AbortError";
  return error;
}

function errno(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

/** Resolve a workspace to its canonical real path; this is the closure identity. */
function canonicalWorkspace(workspace: string): string {
  const resolved = path.resolve(workspace);
  try {
    return fs.realpathSync(resolved);
  } catch {
    throw new Error(`workspace does not exist: ${workspace}`);
  }
}

function isWithin(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(root + path.sep);
}

function outputLimit(context: ToolContext): number {
  const value = Math.floor(context.maxOutputBytes);
  return Number.isFinite(value) && value > 0 ? value : FALLBACK_MAX_OUTPUT_BYTES;
}

/** UTF-8-safe head truncation so a byte cut never emits U+FFFD. */
function capOutput(text: string, maxBytes: number): string {
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return text;
  let end = Math.min(maxBytes, buf.length);
  while (end > 0 && end < buf.length && (buf[end]! & 0xc0) === 0x80) end -= 1;
  return `${buf.subarray(0, end).toString("utf8")}\n[tasks: output truncated; ${
    buf.length - end
  } more bytes omitted]`;
}

// ---------------------------------------------------------------------------
// Store directory / file guards
// ---------------------------------------------------------------------------

/** lstat-validate `.agent` as a real directory; create it when missing. */
function ensureAgentDir(root: string): string {
  const dir = path.join(root, AGENT_DIR);
  if (!isWithin(root, dir)) throw new Error(`store path escapes the workspace: ${AGENT_DIR}`);
  try {
    fs.mkdirSync(dir, { mode: AGENT_DIR_MODE });
  } catch (error) {
    if (errno(error) !== "EEXIST") throw error;
  }
  const stat = fs.lstatSync(dir);
  if (stat.isSymbolicLink()) throw new Error(`refusing symlinked "${AGENT_DIR}" store directory`);
  if (!stat.isDirectory()) throw new Error(`"${AGENT_DIR}" exists but is not a directory`);
  return dir;
}

/** lstat-validate `.agent` without creating it; returns null when absent. */
function existingAgentDir(root: string): string | null {
  const dir = path.join(root, AGENT_DIR);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(dir);
  } catch (error) {
    if (errno(error) === "ENOENT") return null;
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error(`refusing symlinked "${AGENT_DIR}" store directory`);
  if (!stat.isDirectory()) throw new Error(`"${AGENT_DIR}" exists but is not a directory`);
  return dir;
}

function emptyStore(): TaskStore {
  return { version: STORE_VERSION, tasks: [] };
}

/** Read + size-cap + schema-validate + integrity-check the store (no side effects). */
function readStore(root: string): TaskStore {
  const dir = existingAgentDir(root);
  if (!dir) return emptyStore();
  const file = path.join(dir, STORE_NAME);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    if (errno(error) === "ENOENT") return emptyStore();
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error("refusing symlinked task store");
  if (!stat.isFile()) throw new Error("task store is not a regular file");
  if (stat.size > MAX_STORE_BYTES) {
    throw new Error(`task store exceeds the ${MAX_STORE_BYTES}-byte size limit`);
  }
  const text = fs.readFileSync(file, "utf8");
  const parsed = storeSchema.parse(JSON.parse(text) as unknown);
  validateGraph(parsed.tasks);
  return parsed;
}

/** Atomic, size-capped store write (temp file + fsync + rename). Mutations only. */
function writeStore(root: string, store: TaskStore): void {
  const dir = ensureAgentDir(root);
  const file = path.join(dir, STORE_NAME);
  let stat: fs.Stats | null;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    if (errno(error) !== "ENOENT") throw error;
    stat = null;
  }
  if (stat) {
    if (stat.isSymbolicLink()) throw new Error("refusing symlinked task store");
    if (!stat.isFile()) throw new Error("task store is not a regular file");
  }
  const json = `${JSON.stringify(store, null, 2)}\n`;
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > MAX_STORE_BYTES) {
    throw new Error(`task store would exceed the ${MAX_STORE_BYTES}-byte size limit (${bytes} bytes)`);
  }
  atomicWrite(dir, file, json);
  for (const listener of taskObservers.get(root) ?? []) {try {listener();} catch { /* Observers own their failures. */ }}
}

const taskObservers = new Map<string, Set<() => void>>();

export function readTaskRecords(workspace: string): TaskRecord[] {
  return structuredClone(readStore(canonicalWorkspace(workspace)).tasks);
}

/** Atomic writes notify immediately; the directory watch includes other local processes. */
export function subscribeTaskChanges(workspace: string, listener: () => void): () => void {
  const root = canonicalWorkspace(workspace);
  let listeners = taskObservers.get(root);
  if (!listeners) {listeners = new Set(); taskObservers.set(root, listeners);}
  listeners.add(listener);
  const directory = existingAgentDir(root);
  let watcher: fs.FSWatcher | undefined;
  try {
    if (directory) {
      watcher = fs.watch(directory, (_event, file) => {if (String(file) === STORE_NAME) listener();});
      watcher.on('error', () => {watcher?.close(); watcher = undefined;});
    }
  } catch { /* In-process notifications remain available. */ }
  return () => {watcher?.close(); listeners!.delete(listener); if (!listeners!.size) taskObservers.delete(root);};
}

function atomicWrite(dir: string, file: string, content: string): void {
  const tmp = path.join(dir, `.${STORE_NAME}.${crypto.randomBytes(6).toString("hex")}.tmp`);
  let fd: number | undefined;
  try {
    fd = fs.openSync(
      tmp,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
      STORE_FILE_MODE,
    );
    fs.writeFileSync(fd, content, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmp, file);
    // Best-effort directory fsync so the rename itself is durable on reopen.
    let dirFd: number | undefined;
    try {
      dirFd = fs.openSync(dir, fs.constants.O_RDONLY);
      fs.fsyncSync(dirFd);
    } catch {
      /* directory fsync is not portable; the file fsync above still applies */
    } finally {
      if (dirFd !== undefined) {
        try {
          fs.closeSync(dirFd);
        } catch {
          /* ignore */
        }
      }
    }
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
// Locking (one exclusive lock per mutation, released in `finally`)
// ---------------------------------------------------------------------------

type Lock = { fd: number; file: string };

function acquireLock(root: string): Lock {
  const dir = ensureAgentDir(root);
  const file = path.join(dir, LOCK_NAME);
  let fd: number;
  try {
    fd = fs.openSync(file, LOCK_FLAGS, LOCK_FILE_MODE);
  } catch (error) {
    if (errno(error) === "EEXIST") {
      // O_EXCL also fails when the lock path is a symlink, so distinguish it.
      let isLink = false;
      try {
        isLink = fs.lstatSync(file).isSymbolicLink();
      } catch {
        /* vanished between open and lstat: treat as a live lock */
      }
      throw new Error(
        isLink
          ? "refusing symlinked task store lock"
          : "task store is locked by another writer",
      );
    }
    if (errno(error) === "ELOOP") throw new Error("refusing symlinked task store lock");
    throw error;
  }
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token: crypto.randomUUID() }), "utf8");
    fs.fsyncSync(fd);
  } catch (error) {
    try {
      fs.closeSync(fd);
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(file, { force: true });
    } catch {
      /* ignore */
    }
    throw error;
  }
  return { fd, file };
}

function releaseLock(lock: Lock): void {
  try {
    fs.closeSync(lock.fd);
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(lock.file, { force: true });
  } catch {
    /* ignore */
  }
}

function withLock<T>(root: string, fn: () => T): T {
  const lock = acquireLock(root);
  try {
    return fn();
  } finally {
    releaseLock(lock);
  }
}

/** Remove one task and unlink it from every dependent's blockedBy. Caller holds the lock. */
function deleteTaskRecord(store: TaskStore, id: string): boolean {
  const index = store.tasks.findIndex((candidate) => candidate.id === id);
  if (index < 0) return false;
  store.tasks.splice(index, 1);
  for (const other of store.tasks) {
    other.blockedBy = other.blockedBy.filter((dep) => dep !== id);
  }
  validateGraph(store.tasks);
  return true;
}

/**
 * Hook rollback path: remove a task the current turn created when its
 * TaskCreated hook blocks. Not exposed as a tool. Mirrors the recovered
 * `XCt` delete-and-unlink behavior (chunk-9xs8s13r.js).
 */
export function removeTask(workspace: string, id: string): boolean {
  const root = canonicalWorkspace(workspace);
  return withLock(root, () => {
    const store = readStore(root);
    if (!deleteTaskRecord(store, id)) return false;
    writeStore(root, store);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Dependency graph validation
// ---------------------------------------------------------------------------

/** Return a cycle path (`a -> b -> a`) when one exists, else null. */
function detectCycle(tasks: TaskRecord[]): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const task of tasks) adjacency.set(task.id, task.blockedBy);
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const task of tasks) color.set(task.id, WHITE);
  const stack: string[] = [];
  let cycle: string[] | null = null;

  const visit = (id: string): boolean => {
    color.set(id, GRAY);
    stack.push(id);
    for (const dep of adjacency.get(id) ?? []) {
      const seen = color.get(dep);
      if (seen === undefined) continue; // missing targets are reported separately
      if (seen === GRAY) {
        cycle = stack.slice(stack.indexOf(dep)).concat(dep);
        return true;
      }
      if (seen === WHITE && visit(dep)) return true;
    }
    stack.pop();
    color.set(id, BLACK);
    return false;
  };

  for (const task of tasks) {
    if (color.get(task.id) === WHITE && visit(task.id)) break;
  }
  return cycle;
}

/** Reject duplicate ids and missing/self/cyclic dependency edges. */
function validateGraph(tasks: TaskRecord[]): void {
  const ids = new Set<string>();
  for (const task of tasks) {
    if (ids.has(task.id)) throw new Error(`duplicate task id: ${task.id}`);
    ids.add(task.id);
  }
  for (const task of tasks) {
    for (const dep of task.blockedBy) {
      if (dep === task.id) throw new Error(`task ${task.id} cannot depend on itself`);
      if (!ids.has(dep)) {
        throw new Error(`dependency ${dep} referenced by task ${task.id} does not exist`);
      }
    }
  }
  const cycle = detectCycle(tasks);
  if (cycle) throw new Error(`dependency cycle detected: ${cycle.join(" -> ")}`);
}

function findTask(store: TaskStore, id: string): TaskRecord {
  const task = store.tasks.find((candidate) => candidate.id === id);
  if (!task) throw new Error(`task not found: ${id}`);
  return task;
}

function newTaskId(store: TaskStore): string {
  const existing = new Set(store.tasks.map((task) => task.id));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = crypto.randomUUID();
    if (!existing.has(id)) return id;
  }
  throw new Error("failed to allocate a unique task id");
}

// ---------------------------------------------------------------------------
// Read projection
// ---------------------------------------------------------------------------

// Read tools project a task for the model: the internal metadata namespace is
// hidden, and dependencies already satisfied (completed) are dropped from the
// projected `blockedBy` so the view shows only outstanding blockers. Writes
// still return the raw persisted record.
function reciprocalBlocks(tasks: TaskRecord[]): Map<string, string[]> {
  const blocks = new Map(tasks.map((task) => [task.id, [] as string[]]));
  for (const task of tasks) {
    for (const dep of new Set(task.blockedBy)) blocks.get(dep)!.push(task.id);
  }
  return blocks;
}

function projectTask(
  task: TaskRecord,
  byId: Map<string, TaskRecord>,
  blocks?: string[],
): TaskRecord & { blocks?: string[]; ready?: boolean } {
  const metadata = { ...task.metadata };
  delete metadata[INTERNAL_METADATA_KEY];
  const blockedBy = task.blockedBy.filter((dep) => byId.get(dep)?.status !== "completed");
  return {
    ...task,
    metadata,
    blockedBy,
    ...(blocks === undefined ? {} : {
      blocks,
      // Readiness means pending with every blocker completed; other statuses are never ready.
      ready: task.status === "pending" && blockedBy.length === 0,
    }),
  };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function taskCreateTool(root: string): ToolDefinition {
  return {
    readOnly: false,
    schema: {
      name: "task_create",
      description:
        "Create a durable task in the workspace task store. New tasks start " +
        "`pending` with no dependencies. Provide `activeForm` for a present-" +
        "continuous label and `metadata` for arbitrary JSON. Returns the created " +
        "task as JSON, including its generated UUID.",
      input_schema: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Short imperative task title." },
          description: { type: "string", description: "Full task description." },
          activeForm: {
            type: "string",
            description: "Present-continuous label, e.g. `Building the harness`.",
          },
          metadata: {
            type: "object",
            description: "Arbitrary JSON object stored with the task.",
            additionalProperties: true,
          },
        },
        required: ["subject", "description"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const parsed = createSchema.parse(input);
      return withLock(root, () => {
        const store = readStore(root);
        const task: TaskRecord = {
          id: newTaskId(store),
          subject: parsed.subject,
          description: parsed.description,
          ...(parsed.activeForm !== undefined ? { activeForm: parsed.activeForm } : {}),
          metadata: parsed.metadata ?? {},
          status: "pending",
          blockedBy: [],
        };
        store.tasks.push(task);
        writeStore(root, store);
        return capOutput(JSON.stringify(task, null, 2), outputLimit(context));
      });
    },
  };
}

function taskGetTool(root: string, reciprocal: boolean): ToolDefinition {
  return {
    readOnly: true,
    schema: {
      name: "task_get",
      description:
        "Read a single durable task by id from the workspace task store. The " +
        "returned view hides the internal metadata namespace and drops already-" +
        "completed dependencies from `blockedBy`. Returns the task as JSON." +
        (reciprocal ? " Includes `blocks` derived from stored dependency edges and `ready`, " +
          "which is true only for a pending task with zero outstanding blockers." : ""),
      input_schema: {
        type: "object",
        properties: { id: { type: "string", description: "Task UUID." } },
        required: ["id"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const { id } = getSchema.parse(input);
      const store = readStore(root);
      const task = findTask(store, id);
      const byId = new Map(store.tasks.map((candidate) => [candidate.id, candidate]));
      const blocks = reciprocal ? reciprocalBlocks(store.tasks).get(id) : undefined;
      return capOutput(JSON.stringify(projectTask(task, byId, blocks), null, 2), outputLimit(context));
    },
  };
}

function taskListTool(root: string, reciprocal: boolean): ToolDefinition {
  return {
    readOnly: true,
    schema: {
      name: "task_list",
      description:
        "List durable tasks from the workspace task store as a JSON array in " +
        "insertion order. Optionally filter by `status`. Each listed task hides " +
        "the internal metadata namespace and drops already-completed dependencies " +
        "from `blockedBy`." +
        (reciprocal ? " Includes `blocks` derived from stored dependency edges and `ready`, " +
          "which is true only for a pending task with zero outstanding blockers." : ""),
      input_schema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: [...STATUSES],
            description: "Only return tasks with this status.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const parsed = listSchema.parse(input == null ? {} : input);
      const store = readStore(root);
      const byId = new Map(store.tasks.map((task) => [task.id, task]));
      const selected = parsed.status
        ? store.tasks.filter((task) => task.status === parsed.status)
        : store.tasks;
      const blocks = reciprocal ? reciprocalBlocks(store.tasks) : undefined;
      const projected = selected.map((task) => projectTask(task, byId, blocks?.get(task.id)));
      return capOutput(JSON.stringify(projected, null, 2), outputLimit(context));
    },
  };
}

function taskUpdateTool(root: string, reciprocal: boolean): ToolDefinition {
  return {
    readOnly: false,
    schema: {
      name: "task_update",
      description:
        "Update a durable task by id. Scalar fields (`subject`, `description`, " +
        "`activeForm`, `status`, `owner`) are replaced when provided; `metadata` " +
        "is shallow-merged, where a `null` value deletes that key. " +
        "`addBlockedBy`/`removeBlockedBy` adjust dependency edges. Set " +
        "`deleted: true` to remove the task and unlink it from other tasks' " +
        "dependencies. Self, missing, and cyclic dependencies are rejected, and " +
        "marking a task `in_progress` or `completed` requires every dependency to " +
        "be completed. Returns the updated task as JSON (or a deletion summary)." +
        (reciprocal ? " `addBlocks`/`removeBlocks` adjust target dependents by updating their " +
          "stored `blockedBy` edges in the same atomic mutation." : ""),
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task UUID to update." },
          subject: { type: "string", description: "New task title." },
          description: { type: "string", description: "New task description." },
          activeForm: {
            type: "string",
            description: "New present-continuous label, e.g. `Building the harness`.",
          },
          status: {
            type: "string",
            enum: [...STATUSES],
            description: "New status.",
          },
          owner: { type: "string", description: "New owner." },
          metadata: {
            type: "object",
            description: "JSON object shallow-merged into metadata; a null value deletes that key.",
            additionalProperties: true,
          },
          addBlockedBy: {
            type: "array",
            items: { type: "string" },
            description: "Task UUIDs this task should additionally depend on.",
          },
          removeBlockedBy: {
            type: "array",
            items: { type: "string" },
            description: "Task UUIDs to remove from this task's dependencies.",
          },
          deleted: {
            type: "boolean",
            description: "When true, delete this task and unlink it from dependents.",
          },
          ...(reciprocal ? {
            addBlocks: {
              type: "array",
              items: { type: "string" },
              description: "Task UUIDs that should additionally depend on this task.",
            },
            removeBlocks: {
              type: "array",
              items: { type: "string" },
              description: "Task UUIDs that should cease depending on this task.",
            },
          } : {}),
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const parsed: z.infer<typeof reciprocalUpdateSchema> = reciprocal
        ? reciprocalUpdateSchema.parse(input)
        : updateSchema.parse(input);
      return withLock(root, () => {
        const store = readStore(root);
        const task = findTask(store, parsed.id);

        if (parsed.deleted === true) {
          // Deleting a task unlinks it from every dependent's blockedBy so the
          // graph stays acyclic and referentially intact (reciprocal cleanup).
          deleteTaskRecord(store, task.id);
          writeStore(root, store);
          return capOutput(
            JSON.stringify({ deleted: true, id: task.id }, null, 2),
            outputLimit(context),
          );
        }

        if (parsed.subject !== undefined) task.subject = parsed.subject;
        if (parsed.description !== undefined) task.description = parsed.description;
        if (parsed.activeForm !== undefined) task.activeForm = parsed.activeForm;
        if (parsed.owner !== undefined) task.owner = parsed.owner;
        if (parsed.metadata !== undefined) {
          const merged: typeof task.metadata = { ...task.metadata };
          for (const [key, value] of Object.entries(parsed.metadata)) {
            if (value === null) delete merged[key];
            else merged[key] = value;
          }
          task.metadata = merged;
        }

        const ids = new Set(store.tasks.map((candidate) => candidate.id));
        const blockedBy = new Set(task.blockedBy);
        for (const dep of parsed.addBlockedBy ?? []) {
          if (dep === task.id) throw new Error(`task ${task.id} cannot depend on itself`);
          if (!ids.has(dep)) throw new Error(`dependency ${dep} does not exist`);
          blockedBy.add(dep);
        }
        for (const dep of parsed.removeBlockedBy ?? []) blockedBy.delete(dep);
        task.blockedBy = [...blockedBy];

        if (parsed.status !== undefined) task.status = parsed.status;

        const changed = new Set([task]);
        for (const id of parsed.addBlocks ?? []) {
          const dependent = findTask(store, id);
          dependent.blockedBy = [...new Set([...dependent.blockedBy, task.id])];
          changed.add(dependent);
        }
        for (const id of parsed.removeBlocks ?? []) {
          const dependent = findTask(store, id);
          dependent.blockedBy = dependent.blockedBy.filter((dep) => dep !== task.id);
          changed.add(dependent);
        }

        // Revalidate the whole graph so an edit cannot introduce missing, self,
        // or cyclic edges (or duplicate ids).
        validateGraph(store.tasks);

        // Gating: a non-pending task may not rest on unfinished dependencies.
        const byId = new Map(store.tasks.map((candidate) => [candidate.id, candidate]));
        for (const changedTask of changed) {
          if (changedTask.status === "pending") continue;
          const unfinished = changedTask.blockedBy.filter(
            (dep) => byId.get(dep)!.status !== "completed",
          );
          if (unfinished.length > 0) {
            throw new Error(
              `cannot mark task ${changedTask.id} ${changedTask.status}: unfinished dependencies: ${unfinished.join(
                ", ",
              )}`,
            );
          }
        }

        writeStore(root, store);
        return capOutput(JSON.stringify(task, null, 2), outputLimit(context));
      });
    },
  };
}

/**
 * Build the four independent task tools bound to one canonical workspace.
 *
 * The canonical (realpath-resolved) workspace is captured in the closure, so
 * every call writes/reads `<canonical workspace>/.agent/tasks.json` regardless
 * of the `workspace` field on the per-call `ToolContext`.
 * Opt into reciprocal read projections and dependency mutations with `reciprocal`.
 * Only blockedBy is persisted; blocks is derived, and ready means pending with
 * zero outstanding blockers. UUID identities and the version-1 store stay intact.
 */
export function createTaskTools(
  workspace: string,
  options?: { reciprocal?: boolean },
): ToolDefinition[] {
  const root = canonicalWorkspace(workspace);
  const reciprocal = options?.reciprocal === true;
  return [taskCreateTool(root), taskGetTool(root, reciprocal), taskListTool(root, reciprocal),
    taskUpdateTool(root, reciprocal)];
}
