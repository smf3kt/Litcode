import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkflowView } from "./workflow.js";

export const workflowTaskSchema = z.object({
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/),
  prompt: z.string().refine(prompt => prompt.trim().length > 0, "Task prompt is empty"),
  depends_on: z.array(z.string().min(1).max(64)).max(32).default([]),
  mode: z.enum(["explore", "general"]).default("explore"),
  model: z.string().trim().min(1).max(256).optional(),
}).strict();
export const workflowDefinitionSchema = z.object({
  tasks: z.array(workflowTaskSchema).min(1).max(32),
  max_parallel: z.number().int().min(1).max(8).default(4),
  background: z.boolean().default(false),
  timeout_ms: z.number().int().min(1).max(1_800_000).default(300_000),
}).strict();
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

const uuid = z.string().uuid();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const viewSchema = z.object({
  id: uuid, status: z.enum(["running", "completed", "failed", "cancelled"]),
  started_at: z.number().finite(), ended_at: z.number().finite().nullable(), error: z.string().nullable(),
  tasks: z.array(z.object({
    id: workflowTaskSchema.shape.id,
    status: z.enum(["pending", "running", "completed", "failed", "skipped", "cancelled"]),
    session_id: uuid.nullable(), summary: z.string(), error: z.string().nullable(),
  }).strict()).min(1).max(32),
  resume_from: uuid.nullable().optional(), reused_tasks: z.array(z.string()).max(32).optional(),
  persistence: z.object({ owner: uuid, input_digest: digest, limitations: z.array(z.string()).max(8) }).strict().optional(),
}).strict();
const recordSchema = z.object({
  version: z.literal(1), owner: uuid, workspace: z.string(), input_digest: digest,
  settings_digest: digest, snapshot_digest: digest, definition: workflowDefinitionSchema, view: viewSchema,
}).strict();
export type WorkflowRecord = z.infer<typeof recordSchema>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function workflowDigest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
export function workflowInputDigest(definition: WorkflowDefinition, settingsDigest: string): string {
  return workflowDigest({ version: 1, definition, settings_digest: settingsDigest });
}

/** Lazy, session-owned snapshots. Only digests of execution settings are stored. */
export class WorkflowStore {
  private readonly workspace: string;
  private readonly directories: string[];
  readonly directory: string;
  private readonly lock: string;
  private readonly token = randomUUID();
  private locked = false;
  private closed = false;
  readonly maxSnapshotBytes: number;
  readonly maxRuns: number;

  constructor(workspace: string, readonly owner: string, options: { maxSnapshotBytes?: number; maxRuns?: number } = {}) {
    this.workspace = fs.realpathSync(workspace);
    if (!fs.statSync(this.workspace).isDirectory()) throw new Error("Workflow workspace must be a directory");
    this.directories = [path.join(this.workspace, ".agent"), path.join(this.workspace, ".agent", "workflows"),
      path.join(this.workspace, ".agent", "workflows", owner)];
    this.directory = this.directories[2]!;
    this.lock = path.join(this.directory, "owner.lock");
    this.maxSnapshotBytes = options.maxSnapshotBytes ?? 2 * 1024 * 1024;
    this.maxRuns = options.maxRuns ?? 128;
    for (const value of [this.maxSnapshotBytes, this.maxRuns]) {
      if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid workflow storage limit");
    }
  }

  private checkDirectories(create = false): void {
    for (const directory of this.directories) {
      if (create) {
        try {
          fs.mkdirSync(directory, { mode: 0o700 });
          const parent = fs.openSync(path.dirname(directory), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
          try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
        }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
      }
      const stat = fs.lstatSync(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Workflow storage requires real workspace directories");
    }
  }

  private readFile(file: string, maxBytes: number): { value: unknown; stat: fs.Stats } {
    const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.size > maxBytes) throw new Error("Invalid or oversized workflow snapshot/lock");
      const bytes = Buffer.alloc(stat.size + 1);
      let size = 0;
      while (size < bytes.length) {
        const read = fs.readSync(fd, bytes, size, bytes.length - size, null);
        if (!read) break;
        size += read;
      }
      if (size !== stat.size) throw new Error("Workflow snapshot/lock changed while reading");
      return { value: JSON.parse(bytes.subarray(0, size).toString("utf8")), stat };
    } finally { fs.closeSync(fd); }
  }

  private assertLock(): void {
    this.checkDirectories();
    const { value } = this.readFile(this.lock, 4096);
    if (z.object({ pid: z.number().int().positive(), token: uuid }).strict().parse(value).token !== this.token) {
      throw new Error("Workflow owner lock changed");
    }
  }

  private acquire(): void {
    if (this.closed) throw new Error("Workflow store is closed");
    uuid.parse(this.owner);
    if (this.locked) { this.assertLock(); return; }
    this.checkDirectories(true);
    let fd: number;
    try { fd = fs.openSync(this.lock, "wx", 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      // Serialize stale-lock reclamation so two recoverers cannot unlink a new live lock.
      const recovery = `${this.lock}.recovery`;
      let recoveryFd: number;
      try { recoveryFd = fs.openSync(recovery, "wx", 0o600); }
      catch (claim) {
        if ((claim as NodeJS.ErrnoException).code !== "EEXIST") throw claim;
        const observed = this.readFile(recovery, 4096);
        const stale = z.object({ pid: z.number().int().positive(), token: uuid }).strict().parse(observed.value);
        try { process.kill(stale.pid, 0); throw new Error(`Workflow lock recovery is active in process ${stale.pid}`); }
        catch (probe) { if ((probe as NodeJS.ErrnoException).code !== "ESRCH") throw probe; }
        // One claim per dead token bounds double-crash recovery without unlink races.
        const tokenClaim = `${recovery}.${stale.token}.claim`;
        let claimFd: number;
        try { claimFd = fs.openSync(tokenClaim, "wx", 0o600); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Workflow guard reclamation is in progress; inspect a stale token claim before removing it");
          throw error;
        }
        try {
          fs.writeFileSync(claimFd, JSON.stringify({ pid: process.pid, token: this.token })); fs.fsyncSync(claimFd);
          const current = this.readFile(recovery, 4096);
          if (current.stat.ino !== observed.stat.ino || current.stat.dev !== observed.stat.dev || current.stat.mtimeMs !== observed.stat.mtimeMs ||
              current.stat.size !== observed.stat.size || JSON.stringify(current.value) !== JSON.stringify(observed.value)) throw new Error("Workflow recovery guard changed; retry");
          try { process.kill(stale.pid, 0); throw new Error(`Workflow lock recovery is active in process ${stale.pid}`); }
          catch (probe) { if ((probe as NodeJS.ErrnoException).code !== "ESRCH") throw probe; }
          fs.unlinkSync(recovery);
          recoveryFd = fs.openSync(recovery, "wx", 0o600);
        } finally { fs.closeSync(claimFd); fs.unlinkSync(tokenClaim); this.syncDirectory(); }
      }
      try {
        fs.writeFileSync(recoveryFd, JSON.stringify({ pid: process.pid, token: this.token })); fs.fsyncSync(recoveryFd);
        const { value, stat } = this.readFile(this.lock, 4096);
        const stale = z.object({ pid: z.number().int().positive(), token: uuid }).strict().parse(value);
        try { process.kill(stale.pid, 0); throw new Error(`Workflow owner is active in process ${stale.pid}`); }
        catch (probe) { if ((probe as NodeJS.ErrnoException).code !== "ESRCH") throw probe; }
        const current = fs.lstatSync(this.lock);
        if (current.ino !== stat.ino || current.dev !== stat.dev || current.mtimeMs !== stat.mtimeMs) {
          throw new Error("Workflow owner lock changed during recovery; retry");
        }
        fs.unlinkSync(this.lock);
        fd = fs.openSync(this.lock, "wx", 0o600);
      } finally {
        const owned = fs.fstatSync(recoveryFd);
        try {
          const current = fs.lstatSync(recovery);
          if (current.ino !== owned.ino || current.dev !== owned.dev) throw new Error("Workflow recovery guard ownership changed");
          fs.unlinkSync(recovery);
        } finally { fs.closeSync(recoveryFd); this.syncDirectory(); }
      }
    }
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token: this.token }));
      fs.fsyncSync(fd);
      this.locked = true;
    } finally { fs.closeSync(fd); }
    this.syncDirectory();
    // A crash can leave unpublished temporary files; they contain no committed state.
    for (const name of fs.readdirSync(this.directory)) {
      if (!/^\.[a-f0-9-]+\.tmp$/.test(name)) continue;
      const file = path.join(this.directory, name);
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Invalid workflow temporary file");
      fs.unlinkSync(file);
    }
  }

  private syncDirectory(): void {
    this.checkDirectories();
    const fd = fs.openSync(this.directory, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  }

  load(id: string): WorkflowRecord {
    uuid.parse(id); this.acquire();
    const record = recordSchema.parse(this.readFile(path.join(this.directory, `${id}.json`), this.maxSnapshotBytes).value);
    const { snapshot_digest, ...content } = record;
    if (record.owner !== this.owner || record.workspace !== this.workspace || record.view.id !== id ||
      snapshot_digest !== workflowDigest(content) ||
      record.input_digest !== workflowInputDigest(record.definition, record.settings_digest) ||
      record.view.persistence?.owner !== this.owner || record.view.persistence.input_digest !== record.input_digest ||
      record.view.tasks.length !== record.definition.tasks.length ||
      record.definition.tasks.some((task, index) => record.view.tasks[index]?.id !== task.id) ||
      record.view.tasks.some(task => task.status === "completed" && !task.session_id) ||
      (record.view.status === "completed" && record.view.tasks.some(task => task.status !== "completed")) ||
      record.definition.tasks.some((task, index) => record.view.tasks[index]?.status === "completed" &&
        task.depends_on.some(id => record.view.tasks.find(view => view.id === id)?.status !== "completed"))) {
      throw new Error("Workflow snapshot identity/digest mismatch");
    }
    return record;
  }

  list(): WorkflowRecord[] {
    if (!fs.existsSync(this.directory)) return [];
    this.acquire();
    const names = fs.readdirSync(this.directory).filter(name => /^[a-f0-9-]+\.json$/.test(name)).sort();
    if (names.length > this.maxRuns) throw new Error("Workflow stored run limit exceeded");
    return names.map(name => this.load(name.slice(0, -5)));
  }

  save(definition: WorkflowDefinition, settingsDigest: string, view: WorkflowView): void {
    this.acquire();
    const content = { version: 1, owner: this.owner, workspace: this.workspace,
      input_digest: workflowInputDigest(definition, settingsDigest), settings_digest: settingsDigest, definition, view };
    const record = recordSchema.parse({ ...content, snapshot_digest: workflowDigest(content) });
    const bytes = Buffer.from(JSON.stringify(record) + "\n");
    if (bytes.length > this.maxSnapshotBytes) throw new Error("Workflow snapshot byte limit exceeded");
    const file = path.join(this.directory, `${view.id}.json`);
    if (fs.existsSync(file)) {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Invalid workflow snapshot destination");
    } else if (fs.readdirSync(this.directory).filter(name => /^[a-f0-9-]+\.json$/.test(name)).length >= this.maxRuns) {
      throw new Error("Workflow stored run limit reached; archive old snapshots explicitly");
    }
    const temporary = path.join(this.directory, `.${randomUUID()}.tmp`);
    const fd = fs.openSync(temporary, "wx", 0o600);
    try {
      fs.writeFileSync(fd, bytes); fs.fsyncSync(fd);
    } catch (error) {
      fs.unlinkSync(temporary); throw error;
    } finally { fs.closeSync(fd); }
    try { this.assertLock(); fs.renameSync(temporary, file); this.syncDirectory(); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }

  close(): void {
    if (this.closed) return;
    try {
      if (this.locked) { this.assertLock(); fs.unlinkSync(this.lock); this.syncDirectory(); }
    } finally { this.closed = true; this.locked = false; }
  }
}
