// File snapshots/restores; the coordinator may commit history under the restore lock.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ToolContext, ToolDefinition } from "./tools.js";

const FILE_CAP = 2 * 1024 * 1024;
const TOTAL_CAP = 32 * 1024 * 1024;
const ENTRY_CAP = 2000;
const MANIFEST_CAP = 2 * 1024 * 1024;
const RESERVED = new Set([".agent", ".git", "node_modules", ".harness-worktrees"]);
const HASH = /^[a-f0-9]{64}$/;
// Staging names carry the store tag so a sweep can prove ownership from the name alone. W04 records
// that the recovered durable checkpoint transaction was never established, so this is the local
// writer's own contract: the tag is the checkpoint store path's digest prefix.
const STAGING = /^\.checkpoint-([a-f0-9]{12})-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$/;
const STAGING_SCAN_CAP = 10_000;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const nameSchema = z.string().regex(NAME, "Use 1-64 ASCII letters, digits, underscores or hyphens.");
const pageSchema = { offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(200).default(100) };
const entrySchema = z.discriminatedUnion("kind", [
  z.object({ path: z.string(), kind: z.literal("file"), mode: z.number().int().min(0).max(0o7777), size: z.number().int().min(0).max(FILE_CAP), sha256: z.string().regex(HASH) }).strict(),
  z.object({ path: z.string(), kind: z.literal("directory"), mode: z.number().int().min(0).max(0o7777) }).strict(),
  z.object({ path: z.string(), kind: z.literal("symlink"), target: z.string().max(4096) }).strict(),
]);
type Entry = z.infer<typeof entrySchema>;
type FileEntry = Extract<Entry, { kind: "file" }>;
const manifestSchema = z.object({ version: z.literal(1), name: nameSchema, created_at: z.string().datetime(), workspace: z.string(), digest: z.string().regex(HASH), entries: z.array(entrySchema).max(ENTRY_CAP) }).strict();
type Manifest = z.infer<typeof manifestSchema>;
type Snapshot = { entries: Entry[]; digest: string; contents: Map<string, Buffer> };
export type Change = { path: string; status: "added" | "deleted" | "modified"; before?: Entry; current?: Entry };
const fileStateSchema = z.object({ mode: z.number().int().min(0).max(0o7777), size: z.number().int().min(0).max(FILE_CAP), sha256: z.string().regex(HASH) }).strict();
const branchSchema = z.object({ id: z.string().uuid(), source: z.string().uuid(), boundary: z.number().int().min(0), checkpoint: nameSchema,
  digest: z.string().regex(HASH), inode: z.number().int().nonnegative(), device: z.number().int().nonnegative(),
  prefixBytes: z.number().int().min(0).max(64 * 1024 * 1024), prefixSha256: z.string().regex(HASH) }).strict();
export type CheckpointCommit = z.infer<typeof branchSchema>;
const transactionSchema = z.object({ version: z.literal(1), id: z.string().uuid(), workspace: z.string(), state: z.enum(["pending", "committed"]),
  operations: z.array(z.object({ path: z.string(), before: fileStateSchema.nullable(), after: fileStateSchema.nullable() }).strict()).max(ENTRY_CAP),
  directories: z.array(z.object({ path: z.string(), mode: z.number().int().min(0).max(0o7777), inode: z.number().int().nonnegative().nullable(), device: z.number().int().nonnegative().nullable() }).strict()).max(ENTRY_CAP),
  branch: branchSchema.optional() }).strict();
type Transaction = z.infer<typeof transactionSchema>;
type FileState = z.infer<typeof fileStateSchema> | null;
const lockSchema = z.object({ pid: z.number().int().positive(), token: z.string().uuid() }).strict();
const transactionPath = (store: string) => path.join(store, "transaction.json");
// A capture publishes the manifest before the session journal records the association. This intent
// is written first so the next open of that session can append the missing association.
const associationSchema = z.object({ version: z.literal(1), id: z.string().uuid(), session: z.string().uuid(), name: nameSchema,
  boundary: z.number().int().min(0), pid: z.number().int().positive(), created_at: z.string().datetime() }).strict();
type Association = z.infer<typeof associationSchema>;
export type CheckpointAssociation = { file: string; name: string; digest: string; boundary: number };
const ASSOCIATION = /^\.assoc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/;
const ASSOCIATION_CAP = 4096;
const ASSOCIATION_SCAN_CAP = 1024;
const OBJECT_SCAN_CAP = 100_000;
const associationPath = (store: string, id: string) => path.join(store, `.assoc-${id}.json`);

function aborted(context: ToolContext): void {
  if (context.signal.aborted) {
    const error = new Error("Checkpoint operation aborted before filesystem effects.");
    error.name = "AbortError";
    throw error;
  }
}
function hash(bytes: Buffer | string): string { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function fingerprint(entries: Entry[]): string { return hash(JSON.stringify(entries)); }
function exists(target: string): fs.Stats | undefined {
  try { return fs.lstatSync(target); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
function relativePath(value: string): string {
  const parts = value.split("/");
  if (!value || value.length > 1024 || path.isAbsolute(value) || value.includes("\\") || /[\x00-\x1f\x7f:]/.test(value) || parts.some(part => !part || part === "." || part === ".." || RESERVED.has(part.toLowerCase()))) {
    throw new Error(`Invalid or reserved checkpoint path: ${JSON.stringify(value)}`);
  }
  return value;
}
function canonicalRoot(workspace: string): string {
  const root = fs.realpathSync(path.resolve(workspace));
  if (!fs.statSync(root).isDirectory()) throw new Error("Workspace must be a directory.");
  return root;
}
function rootFor(context: ToolContext): string {
  aborted(context);
  return canonicalRoot(context.workspace);
}
// Every existing component must be a real directory; links are never followed.
function targetFor(root: string, relative: string, allowLeafLink = false): string {
  const parts = relative.split("/");
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]!);
    const stat = exists(current);
    if (!stat) continue;
    if (stat.isSymbolicLink() && !(allowLeafLink && i === parts.length - 1)) throw new Error(`Symlink checkpoint path: ${relative}`);
    if (i < parts.length - 1 && !stat.isDirectory()) throw new Error(`Checkpoint ancestor is not a directory: ${relative}`);
  }
  return current;
}
function directory(target: string, create = false): void {
  let stat = exists(target);
  if (!stat && create) {
    fs.mkdirSync(target, { mode: 0o700 });
    stat = fs.lstatSync(target);
  }
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(target) !== target) throw new Error(`Invalid checkpoint metadata directory: ${target}`);
}
function storeFor(root: string, create = false): string {
  const agent = path.join(root, ".agent");
  const store = path.join(agent, "checkpoints");
  directory(agent, create);
  directory(store, create);
  directory(path.join(store, "objects"), create);
  directory(path.join(store, "manifests"), create);
  return store;
}
function readBounded(target: string, cap: number, context: ToolContext): Buffer {
  aborted(context);
  const before = fs.lstatSync(target);
  if (!before.isFile() || before.isSymbolicLink() || before.size > cap) throw new Error(`Checkpoint file exceeds cap or is not regular: ${target}`);
  const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const initial = fs.fstatSync(fd);
    if (!initial.isFile() || initial.dev !== before.dev || initial.ino !== before.ino || initial.size > cap) throw new Error(`Checkpoint file changed during read: ${target}`);
    const bytes = Buffer.alloc(initial.size);
    let offset = 0;
    while (offset < bytes.length) {
      aborted(context);
      const count = fs.readSync(fd, bytes, offset, Math.min(64 * 1024, bytes.length - offset), offset);
      if (!count) throw new Error(`Checkpoint file changed during read: ${target}`);
      offset += count;
    }
    const extra = Buffer.alloc(1);
    const after = fs.fstatSync(fd);
    if (fs.readSync(fd, extra, 0, 1, offset) || after.size !== initial.size || after.mtimeMs !== initial.mtimeMs || after.ctimeMs !== initial.ctimeMs || fs.lstatSync(target).ino !== initial.ino) throw new Error(`Checkpoint file changed during read: ${target}`);
    return bytes;
  } finally { fs.closeSync(fd); }
}
function snapshot(root: string, context: ToolContext): Snapshot {
  const entries: Entry[] = [];
  const contents = new Map<string, Buffer>();
  const paths = new Set<string>();
  let total = 0;
  function visit(relative: string): void {
    aborted(context);
    const target = relative ? targetFor(root, relative) : root;
    for (const name of fs.readdirSync(target).sort()) {
      if (RESERVED.has(name.toLowerCase())) continue;
      const rel = relativePath(relative ? `${relative}/${name}` : name);
      if (paths.has(rel.toLowerCase())) throw new Error(`Checkpoint path has a case alias: ${rel}`);
      paths.add(rel.toLowerCase());
      const full = targetFor(root, rel, true);
      const stat = fs.lstatSync(full);
      if (entries.length >= ENTRY_CAP) throw new Error(`Checkpoint entry count exceeds cap (${ENTRY_CAP}).`);
      if (stat.isSymbolicLink()) {
        const link = fs.readlinkSync(full);
        if (link.length > 4096) throw new Error(`Checkpoint symlink metadata exceeds cap: ${rel}`);
        entries.push({ path: rel, kind: "symlink", target: link });
      } else if (stat.isDirectory()) {
        entries.push({ path: rel, kind: "directory", mode: stat.mode & 0o7777 });
        visit(rel);
      } else if (stat.isFile()) {
        if (stat.size > FILE_CAP || total + stat.size > TOTAL_CAP) throw new Error(`Checkpoint snapshot exceeds byte cap: ${rel}`);
        const bytes = readBounded(full, FILE_CAP, context);
        total += bytes.length;
        if (total > TOTAL_CAP) throw new Error("Checkpoint snapshot exceeds total byte cap.");
        const digest = hash(bytes);
        entries.push({ path: rel, kind: "file", mode: fs.lstatSync(full).mode & 0o7777, size: bytes.length, sha256: digest });
        contents.set(digest, bytes);
      } else throw new Error(`Unsupported checkpoint filesystem entry: ${rel}`);
    }
  }
  visit("");
  entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { entries, digest: fingerprint(entries), contents };
}
function syncDir(target: string): void {
  const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function stagingName(store: string): string {
  return `.checkpoint-${hash(store).slice(0, 12)}-${crypto.randomUUID()}.tmp`;
}
/** Removes staging files this store left behind. Every checkpoint writer holds the store lock for
 *  its whole operation, so under that lock a tagged staging file has no live owner; files tagged
 *  for another store or carrying the old untagged name are left for inspection. */
function sweepStaging(directory: string, tag: string): void {
  let handle: fs.Dir;
  try { handle = fs.opendirSync(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  try {
    for (let seen = 0, entry = handle.readSync(); entry; entry = handle.readSync()) {
      if (++seen > STAGING_SCAN_CAP) return;
      const match = STAGING.exec(entry.name);
      if (!match || match[1] !== tag) continue;
      const target = path.join(directory, entry.name);
      let stat: fs.Stats;
      try { stat = fs.lstatSync(target); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
      if (!stat.isFile()) continue;
      try { fs.unlinkSync(target); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
  } finally { handle.closeSync(); }
}
function atomicWrite(store: string, target: string, bytes: Buffer, mode: number, verify?: () => void, committed?: () => void): void {
  const temporary = path.join(path.dirname(target), stagingName(store));
  let fd: number | undefined;
  try {
    fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    fs.writeFileSync(fd, bytes);
    fs.fchmodSync(fd, mode);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    verify?.();
    fs.renameSync(temporary, target);
    committed?.();
    syncDir(path.dirname(target));
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (exists(temporary)) fs.unlinkSync(temporary);
  }
}
function lock<T>(store: string, operation: () => T): T {
  const target = path.join(store, "lock");
  const token = crypto.randomUUID();
  const fd = acquireLock(target, token);
  try {
    return operation();
  } finally {
    fs.closeSync(fd);
    const owner = readLock(target);
    if (owner.token !== token) throw new Error("Checkpoint lock ownership changed.");
    fs.unlinkSync(target); syncDir(store);
  }
}
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return false; throw error; }
}
function readLock(target: string): { pid: number; token?: string } {
  const bytes = readBounded(target, 4096, { signal: new AbortController().signal } as ToolContext).toString("utf8");
  // Older checkpoint locks contain only their owner PID.
  if (/^[1-9][0-9]*\n?$/.test(bytes)) {
    const pid = Number(bytes.trim());
    if (!Number.isSafeInteger(pid)) throw new Error("Invalid checkpoint lock owner.");
    return { pid };
  }
  return lockSchema.parse(JSON.parse(bytes));
}
function reclaimDeadLock(target: string): void {
  const before = fs.lstatSync(target);
  let owner: ReturnType<typeof readLock>;
  try { owner = readLock(target); } catch { throw new Error("EEXIST: Checkpoint lock owner is invalid; retain for inspection."); }
  if (alive(owner.pid)) throw new Error(`Checkpoint owner is active in process ${owner.pid}.`);
  const current = fs.lstatSync(target);
  if (before.ino !== current.ino || before.dev !== current.dev || before.mtimeMs !== current.mtimeMs || before.ctimeMs !== current.ctimeMs) throw new Error("Checkpoint lock changed during recovery.");
  fs.unlinkSync(target); syncDir(path.dirname(target));
}
function acquireLock(target: string, token: string): number {
  const create = (file: string): number => {
    const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token })); fs.fsyncSync(fd); syncDir(path.dirname(file)); return fd; }
    catch (error) { fs.closeSync(fd); throw error; }
  };
  try { return create(target); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  const guard = `${target}.recovery`;
  let fd: number;
  try { fd = create(guard); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    // Reclamation is bounded. Competing recoverers still compete through wx;
    // inode/timestamp checks prevent removing a replaced live guard.
    reclaimDeadLock(guard);
    fd = create(guard);
  }
  try { if (exists(target)) reclaimDeadLock(target); return create(target); }
  finally {
    fs.closeSync(fd);
    if (readLock(guard).token !== token) throw new Error("Checkpoint recovery guard ownership changed.");
    fs.unlinkSync(guard); syncDir(path.dirname(guard));
  }
}
function fileState(root: string, relative: string, context: ToolContext): FileState {
  relativePath(relative);
  const target = targetFor(root, relative), stat = exists(target);
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Checkpoint recovery target is not regular: ${relative}`);
  const bytes = readBounded(target, FILE_CAP, context);
  return { mode: stat.mode & 0o7777, size: bytes.length, sha256: hash(bytes) };
}
function equalState(left: FileState, right: FileState): boolean { return JSON.stringify(left) === JSON.stringify(right); }
function saveTransaction(store: string, transaction: Transaction): void {
  const bytes = Buffer.from(JSON.stringify(transaction));
  if (bytes.length > MANIFEST_CAP) throw new Error("Checkpoint transaction exceeds metadata cap.");
  atomicWrite(store, transactionPath(store), bytes, 0o600);
}
function saveObject(store: string, bytes: Buffer, context: ToolContext): void {
  const digest = hash(bytes), target = path.join(store, "objects", digest);
  if (exists(target)) { if (hash(readBounded(target, FILE_CAP, context)) !== digest) throw new Error("Checkpoint rollback object digest mismatch."); }
  else atomicWrite(store, target, bytes, 0o600);
}
/** Records the session association a capture is about to publish. Callers clear the returned file
 *  after the journal append; a crash in between leaves it for the next session open. */
export function writeCheckpointAssociation(workspace: string, session: string, name: string, boundary: number): string {
  const root = canonicalRoot(workspace);
  nameSchema.parse(name);
  z.string().uuid().parse(session);
  if (!Number.isSafeInteger(boundary) || boundary < 0) throw new Error("Checkpoint association boundary must be a non-negative integer.");
  const store = storeFor(root, true);
  const intent: Association = { version: 1, id: crypto.randomUUID(), session, name, boundary, pid: process.pid, created_at: new Date().toISOString() };
  const bytes = Buffer.from(JSON.stringify(intent));
  if (bytes.length > ASSOCIATION_CAP) throw new Error("Checkpoint association intent exceeds metadata cap.");
  const file = associationPath(store, intent.id);
  atomicWrite(store, file, bytes, 0o600);
  return file;
}
export function clearCheckpointAssociation(file: string): void {
  if (!ASSOCIATION.test(path.basename(file))) throw new Error("Invalid checkpoint association path.");
  const stat = exists(file);
  if (!stat) return;
  if (!stat.isFile()) throw new Error("Checkpoint association is not a regular file.");
  fs.unlinkSync(file); syncDir(path.dirname(file));
}
function manifestDigest(root: string, name: string): string | undefined {
  nameSchema.parse(name);
  const file = path.join(root, ".agent", "checkpoints", "manifests", `${name}.json`);
  const stat = exists(file);
  if (!stat) return undefined;
  if (!stat.isFile() || stat.size > MANIFEST_CAP) throw new Error(`Invalid checkpoint manifest: ${name}`);
  const manifest = manifestSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (manifest.workspace !== root || manifest.name !== name || manifest.digest !== fingerprint(manifest.entries)) throw new Error(`Checkpoint manifest identity or digest mismatch: ${name}`);
  return manifest.digest;
}
/** Returns this session's intents that still need a journal event. Completed intents and intents
 *  whose capture never published a manifest are cleared; unreadable or foreign files stay. */
export function recoverCheckpointAssociations(root: string, session: string, existing: (name: string) => string | undefined): CheckpointAssociation[] {
  const agent = path.join(root, ".agent"), store = path.join(agent, "checkpoints");
  const agentStat = exists(agent), storeStat = exists(store);
  if (!agentStat || !storeStat || !agentStat.isDirectory() || !storeStat.isDirectory() || agentStat.isSymbolicLink() || storeStat.isSymbolicLink()) return [];
  const pending: CheckpointAssociation[] = [];
  let seen = 0;
  for (const entry of fs.readdirSync(store).sort()) {
    if (++seen > ASSOCIATION_SCAN_CAP) break;
    if (!ASSOCIATION.test(entry)) continue;
    const file = path.join(store, entry);
    let intent: Association;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.size > ASSOCIATION_CAP) continue;
      intent = associationSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
    } catch { continue; }
    if (intent.session !== session) continue;
    let digest: string | undefined;
    try { digest = manifestDigest(root, intent.name); }
    catch { continue; }
    if (digest === undefined) {
      try { fs.unlinkSync(file); syncDir(store); } catch { /* retain for inspection */ }
      continue;
    }
    const saved = existing(intent.name);
    if (saved !== undefined) {
      if (saved === digest) { try { fs.unlinkSync(file); syncDir(store); } catch { /* retain for inspection */ } }
      continue;
    }
    pending.push({ file, name: intent.name, digest, boundary: intent.boundary });
  }
  return pending;
}
/** Sweeps only garbage this store can prove, under its lock and after transaction recovery:
 *  content-addressed objects no manifest references, and intents whose creator died before any
 *  manifest was published. An unreadable manifest, an unknown file or a cap retains the set. */
function sweepStore(root: string, store: string): void {
  let entries: string[];
  try { entries = fs.readdirSync(store).sort(); } catch { return; }
  for (const [seen, name] of entries.entries()) {
    if (seen >= ASSOCIATION_SCAN_CAP) break;
    if (!ASSOCIATION.test(name)) continue;
    const file = path.join(store, name);
    let intent: Association;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.size > ASSOCIATION_CAP) continue;
      intent = associationSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
    } catch { continue; }
    if (alive(intent.pid)) continue;
    try {
      if (manifestDigest(root, intent.name) === undefined) { fs.unlinkSync(file); syncDir(store); }
    } catch { /* an unreadable manifest retains its intent */ }
  }
  const manifests = path.join(store, "manifests");
  let names: string[];
  try { names = fs.readdirSync(manifests).sort(); } catch { return; }
  if (names.length > ENTRY_CAP) return;
  const referenced = new Set<string>();
  for (const file of names) {
    const name = file.endsWith(".json") ? file.slice(0, -5) : "";
    if (!NAME.test(name)) return;
    let manifest: Manifest;
    try {
      const target = path.join(manifests, file), stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.size > MANIFEST_CAP) return;
      manifest = manifestSchema.parse(JSON.parse(fs.readFileSync(target, "utf8")));
    } catch { return; }
    if (manifest.workspace !== root || manifest.name !== name || manifest.digest !== fingerprint(manifest.entries)) return;
    for (const entry of manifest.entries) if (entry.kind === "file") referenced.add(entry.sha256);
  }
  const objects = path.join(store, "objects");
  let files: string[];
  try { files = fs.readdirSync(objects).sort(); } catch { return; }
  if (files.length > OBJECT_SCAN_CAP) return;
  let removed = false;
  for (const file of files) {
    if (!HASH.test(file) || referenced.has(file)) continue;
    const target = path.join(objects, file);
    const stat = exists(target);
    if (!stat || !stat.isFile() || stat.isSymbolicLink()) continue;
    fs.unlinkSync(target); removed = true;
  }
  if (removed) syncDir(objects);
}
function branchProof(root: string, branch: CheckpointCommit, context: ToolContext): { committed: boolean; file?: string; stat?: fs.Stats } {
  const file = path.join(root, ".agent", `${branch.id}.jsonl`), stat = exists(file);
  if (!stat) return { committed: false };
  if (stat.ino !== branch.inode || stat.dev !== branch.device) throw new Error("Checkpoint recovery branch identity changed.");
  const bytes = readBounded(file, 64 * 1024 * 1024, context);
  if (bytes.length < branch.prefixBytes || hash(bytes.subarray(0, branch.prefixBytes)) !== branch.prefixSha256) throw new Error("Checkpoint recovery branch prefix changed.");
  const tail = bytes.subarray(branch.prefixBytes).toString("utf8");
  const expected = [
    { kind: "rewind", source: branch.source, boundary: branch.boundary, checkpoint: branch.checkpoint, digest: branch.digest },
    { kind: "branch", source: branch.source, workspace: root, boundary: branch.boundary, reason: "rewind" },
  ].map(event => JSON.stringify(event) + "\n").join("");
  if (tail === expected) return { committed: true, file, stat };
  if (!expected.startsWith(tail)) throw new Error("Checkpoint recovery branch has unrelated history; retained for inspection.");
  return { committed: false, file, stat };
}
function recoverTransaction(root: string, store: string, context: ToolContext, forceRollback = false, ownBranch = false, applied?: ReadonlySet<string>): "none" | "rolled_back" | "committed" {
  const target = transactionPath(store);
  if (!exists(target)) return "none";
  const transaction = transactionSchema.parse(JSON.parse(readBounded(target, MANIFEST_CAP, context).toString("utf8")));
  if (transaction.workspace !== root) throw new Error("Checkpoint transaction workspace mismatch.");
  const seen = new Set<string>(), buffers = new Map<string, Buffer>();
  let beforeTotal = 0, afterTotal = 0;
  for (const operation of transaction.operations) {
    relativePath(operation.path);
    if (seen.has(operation.path.toLowerCase()) || !operation.before && !operation.after) throw new Error("Invalid checkpoint transaction operations.");
    seen.add(operation.path.toLowerCase());
    for (const [kind, state] of [["before", operation.before], ["after", operation.after]] as const) if (state) {
      if (kind === "before") beforeTotal += state.size; else afterTotal += state.size;
      const bytes = buffers.get(state.sha256) ?? readBounded(path.join(store, "objects", state.sha256), FILE_CAP, context);
      if (bytes.length !== state.size || hash(bytes) !== state.sha256) throw new Error("Checkpoint transaction object mismatch.");
      buffers.set(state.sha256, bytes);
    }
  }
  if (beforeTotal > TOTAL_CAP || afterTotal > TOTAL_CAP) throw new Error("Checkpoint transaction exceeds total byte cap.");
  // The crashed writer held the store lock, so its staging files in the target directories are
  // orphans; sweeping them first also lets a recorded directory that must be removed come empty.
  const tag = hash(store).slice(0, 12), swept = new Set<string>();
  for (const operation of transaction.operations) {
    const directory = path.dirname(targetFor(root, operation.path));
    if (swept.has(directory)) continue;
    swept.add(directory);
    sweepStaging(directory, tag);
  }
  const branch = transaction.branch ? branchProof(root, transaction.branch, context) : undefined;
  // History proof remains authoritative when publishing the commit marker fails.
  const committed = branch?.committed === true || (!forceRollback && transaction.state === "committed");
  if (committed && branch && !branch.committed) throw new Error("Checkpoint commit marker lacks its history proof; transaction retained.");
  const conflicts: string[] = [];
  const branchLock = branch?.file ? `${branch.file}.lock` : undefined;
  if (!forceRollback && !ownBranch && branchLock && exists(branchLock)) {
    const owner = readLock(branchLock);
    if (alive(owner.pid)) throw new Error("Checkpoint recovery branch has an active owner.");
  }
  for (const saved of transaction.directories) {
    relativePath(saved.path);
    const stat = exists(targetFor(root, saved.path));
    if (stat && (saved.inode === null || saved.device === null || !stat.isDirectory() || stat.ino !== saved.inode || stat.dev !== saved.device || (stat.mode & 0o7777) !== saved.mode)) {
      throw new Error(`Checkpoint recovery directory ownership is unknown: ${saved.path}; transaction retained.`);
    }
  }
  // Check every target before any rollback. Outside edits preserve the entire
  // transaction, including already-restored targets, for explicit reconciliation.
  for (const operation of transaction.operations) {
    const current = fileState(root, operation.path, context);
    const untouched = applied !== undefined && !applied.has(operation.path);
    if (committed ? !equalState(current, operation.after) : !equalState(current, operation.before) && (untouched || !equalState(current, operation.after))) {
      if (!forceRollback || committed) throw new Error(`Checkpoint recovery conflict: ${operation.path}; transaction retained.`);
      conflicts.push(operation.path);
    }
  }
  if (!committed) {
    for (const operation of [...transaction.operations].reverse()) {
      if (conflicts.includes(operation.path) || (applied !== undefined && !applied.has(operation.path))) continue;
      const current = fileState(root, operation.path, context);
      if (equalState(current, operation.before)) continue;
      const target = targetFor(root, operation.path);
      const verify = () => { if (!equalState(fileState(root, operation.path, context), operation.after)) throw new Error(`Checkpoint recovery conflict during rollback: ${operation.path}`); };
      if (operation.before) atomicWrite(store, target, buffers.get(operation.before.sha256)!, operation.before.mode, verify);
      else { verify(); fs.unlinkSync(target); syncDir(path.dirname(target)); }
    }
    if (conflicts.length) throw new Error(`Checkpoint recovery conflict: ${conflicts.join(", ")}; transaction retained.`);
    for (const saved of [...transaction.directories].reverse()) {
      relativePath(saved.path);
      const directory = targetFor(root, saved.path), stat = exists(directory);
      if (!stat) continue;
      if (!stat.isDirectory() || stat.ino !== saved.inode || stat.dev !== saved.device || (stat.mode & 0o7777) !== saved.mode || fs.readdirSync(directory).length) throw new Error(`Checkpoint recovery directory changed: ${saved.path}; transaction retained.`);
      fs.rmdirSync(directory); syncDir(path.dirname(directory));
    }
    if (!forceRollback && branch?.file && branch.stat) {
      const current = fs.lstatSync(branch.file);
      if (current.ino !== branch.stat.ino || current.dev !== branch.stat.dev || current.mtimeMs !== branch.stat.mtimeMs || current.ctimeMs !== branch.stat.ctimeMs) throw new Error("Checkpoint recovery branch changed before cleanup.");
      const branchLock = `${branch.file}.lock`;
      if (exists(branchLock)) { const owner = readLock(branchLock); if (alive(owner.pid)) throw new Error("Checkpoint recovery branch has an active owner."); reclaimDeadLock(branchLock); }
      fs.unlinkSync(branch.file); syncDir(path.dirname(branch.file));
    }
  }
  if (committed && branchLock && exists(branchLock)) {
    const owner = readLock(branchLock);
    if (!alive(owner.pid)) reclaimDeadLock(branchLock);
  }
  fs.unlinkSync(target); syncDir(store);
  return committed ? "committed" : "rolled_back";
}
export function recoverCheckpoint(context: ToolContext): { recovery: "none" | "rolled_back" | "committed" } {
  const root = rootFor(context), agent = path.join(root, ".agent"), store = path.join(agent, "checkpoints");
  if (!exists(agent) || !exists(store)) return { recovery: "none" };
  storeFor(root);
  return lock(store, () => {
    const tag = hash(store).slice(0, 12);
    for (const directory of [store, path.join(store, "objects"), path.join(store, "manifests")]) sweepStaging(directory, tag);
    const recovery = recoverTransaction(root, store, context);
    sweepStore(root, store);
    return { recovery };
  });
}
function manifestFor(root: string, name: string, context: ToolContext): { store: string; manifest: Manifest; contents: Map<string, Buffer> } {
  const store = storeFor(root);
  const manifest = manifestSchema.parse(JSON.parse(readBounded(path.join(store, "manifests", `${name}.json`), MANIFEST_CAP, context).toString("utf8")));
  if (manifest.workspace !== root || manifest.name !== name || manifest.digest !== fingerprint(manifest.entries)) throw new Error("Checkpoint manifest identity or digest mismatch.");
  const seen = new Map<string, Entry>();
  let total = 0;
  const contents = new Map<string, Buffer>();
  let previous = "";
  for (const entry of manifest.entries) {
    relativePath(entry.path);
    if (entry.path <= previous || seen.has(entry.path.toLowerCase())) throw new Error("Checkpoint manifest contains duplicate or unsorted paths.");
    previous = entry.path;
    const parent = path.posix.dirname(entry.path);
    if (parent !== "." && seen.get(parent.toLowerCase())?.kind !== "directory") throw new Error("Checkpoint manifest has a missing or invalid parent directory.");
    seen.set(entry.path.toLowerCase(), entry);
    if (entry.kind === "file") {
      total += entry.size;
      if (total > TOTAL_CAP) throw new Error("Checkpoint manifest exceeds total byte cap.");
      const bytes = contents.get(entry.sha256) ?? readBounded(path.join(store, "objects", entry.sha256), FILE_CAP, context);
      if (bytes.length !== entry.size || hash(bytes) !== entry.sha256) throw new Error(`Checkpoint content digest mismatch: ${entry.path}`);
      contents.set(entry.sha256, bytes);
    }
  }
  aborted(context);
  return { store, manifest, contents };
}
function changes(before: Entry[], current: Entry[]): Change[] {
  const left = new Map(before.map(entry => [entry.path, entry]));
  const right = new Map(current.map(entry => [entry.path, entry]));
  return [...new Set([...left.keys(), ...right.keys()])].sort().flatMap(name => {
    const old = left.get(name);
    const now = right.get(name);
    if (JSON.stringify(old) === JSON.stringify(now)) return [];
    return [{ path: name, status: !old ? "added" as const : !now ? "deleted" as const : "modified" as const, before: old, current: now }];
  });
}
function output(value: Record<string, unknown>, context: ToolContext): string {
  const raw = JSON.stringify(value, null, 2);
  const cap = Number.isFinite(context.maxOutputBytes) && context.maxOutputBytes > 0 ? Math.floor(context.maxOutputBytes) : 100_000;
  if (Buffer.byteLength(raw) <= cap) return raw;
  // Keep machine-readable JSON and confirmation digests even when pages are capped.
  const compact: Record<string, unknown> = { ...value, truncated: true };
  for (const key of ["checkpoints", "changes", "operations"] as const) {
    const items = compact[key];
    if (Array.isArray(items)) {
      const kept = [...items];
      compact[key] = kept;
      do {
        compact["returned"] = kept.length;
        compact["next_offset"] = Number(value["offset"] ?? 0) + kept.length;
        if (Buffer.byteLength(JSON.stringify(compact)) <= cap || kept.length === 0) break;
        kept.pop();
      } while (true);
    }
  }
  let text = JSON.stringify(compact);
  if (Buffer.byteLength(text) > cap) text = JSON.stringify({ truncated: true, current_digest: value["current_digest"], checkpoint_digest: value["checkpoint_digest"] });
  return Buffer.byteLength(text) <= cap ? text : cap >= 2 ? "{}" : "";
}
function schema(properties: Record<string, unknown>, required: string[]): ToolDefinition["schema"]["input_schema"] {
  return { type: "object", properties, required, additionalProperties: false };
}
const nameProperty = { type: "string", pattern: NAME.source, description: "Checkpoint name (1-64 ASCII letters, digits, underscores or hyphens)." };
const pageProperties = { offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 200 } };

export function restoreCheckpoint(input: unknown, context: ToolContext, commit?: () => void, branch?: CheckpointCommit): string {
  const args = z.object({ name: nameSchema, expected_current_digest: z.string().regex(HASH), paths: z.array(z.string()).min(commit ? 0 : 1).max(ENTRY_CAP).optional(), remove_new: z.boolean().default(false), dry_run: z.boolean().default(true) }).strict().parse(input);
  const root = rootFor(context);
  if (!args.dry_run) recoverCheckpoint(context);
  const { store, manifest, contents } = manifestFor(root, args.name, context);
  if (exists(transactionPath(store))) throw new Error("Checkpoint transaction requires explicit recovery before preview.");
  const current = snapshot(root, context);
  if (current.digest !== args.expected_current_digest) throw new Error("Checkpoint conflict: workspace changed since diff; run checkpoint_diff again.");
  if (args.remove_new && !args.paths) throw new Error("remove_new requires explicitly enumerated paths from checkpoint_diff.");
  const baseline = new Map(manifest.entries.map(entry => [entry.path, entry]));
  const now = new Map(current.entries.map(entry => [entry.path, entry]));
  const selected = args.paths ?? manifest.entries.filter(entry => entry.kind === "file").map(entry => entry.path);
  const unique = new Set<string>();
  const operations: { path: string; action: "write" | "remove"; entry?: FileEntry }[] = [];
  for (const relative of selected) {
    relativePath(relative);
    if (unique.has(relative.toLowerCase())) throw new Error("Duplicate selected checkpoint path.");
    unique.add(relative.toLowerCase());
    const original = baseline.get(relative);
    const present = now.get(relative);
    targetFor(root, relative);
    if (original && original.kind !== "file") throw new Error(`Only regular file checkpoint paths can be restored: ${relative}`);
    if (present && present.kind !== "file") throw new Error(`Restore target must be a regular file or absent: ${relative}`);
    if (original?.kind === "file") {
      if (JSON.stringify(original) !== JSON.stringify(present)) operations.push({ path: relative, action: "write", entry: original });
    } else if (args.remove_new && present?.kind === "file") operations.push({ path: relative, action: "remove" });
    else throw new Error(`Selected path is absent from checkpoint: ${relative}`);
  }
  aborted(context);
  const result = { name: args.name, behavior: "filesystem_rewind", dry_run: args.dry_run, checkpoint_digest: manifest.digest, current_digest: current.digest, operations: operations.map(({ path: relative, action }) => ({ path: relative, action })) };
  if (args.dry_run) return output(result, context);
  return lock(store, () => {
    storeFor(root);
    aborted(context);
    if (snapshot(root, context).digest !== current.digest) throw new Error("Checkpoint conflict: workspace changed before restore.");
    const state = (entry: FileEntry | undefined): FileState => entry ? { mode: entry.mode, size: entry.size, sha256: entry.sha256 } : null;
    const transaction: Transaction = { version: 1, id: crypto.randomUUID(), workspace: root, state: "pending",
      operations: operations.map(operation => ({ path: operation.path, before: state(now.get(operation.path) as FileEntry | undefined), after: state(operation.entry) })),
      directories: [], ...(branch ? { branch: branchSchema.parse(branch) } : {}) };
    for (const operation of operations) {
      const old = now.get(operation.path);
      if (old?.kind === "file") saveObject(store, current.contents.get(old.sha256)!, context);
    }
    aborted(context);
    saveTransaction(store, transaction);

    // Matching bytes on an unexecuted path can belong to another actor.
    const applied = new Set<string>();
    function ensureParents(relative: string): void {
      const parts = relative.split("/").slice(0, -1);
      for (let i = 1; i <= parts.length; i++) {
        const rel = parts.slice(0, i).join("/");
        const target = targetFor(root, rel);
        if (!exists(target)) {
          const entry = baseline.get(rel);
          const saved = { path: rel, mode: entry?.kind === "directory" ? entry.mode : 0o755, inode: null as number | null, device: null as number | null };
          transaction.directories.push(saved);
          saveTransaction(store, transaction);
          fs.mkdirSync(target, { mode: entry?.kind === "directory" ? entry.mode : 0o755 });

          if (entry?.kind === "directory") fs.chmodSync(target, entry.mode);
          syncDir(path.dirname(target));
          const stat = fs.lstatSync(target);
          saved.inode = stat.ino; saved.device = stat.dev;
          saveTransaction(store, transaction);
        }
      }
    }
    try {
      for (const operation of operations) {
        aborted(context);
        ensureParents(operation.path);
        const target = targetFor(root, operation.path);
        const old = now.get(operation.path);
        const verify = (): void => {
          targetFor(root, operation.path);
          const stat = exists(target);
          if (!old ? !!stat : !stat?.isFile() || (stat.mode & 0o7777) !== (old as FileEntry).mode || hash(readBounded(target, FILE_CAP, context)) !== (old as FileEntry).sha256) throw new Error(`Checkpoint conflict during restore: ${operation.path}`);
        };
        verify();
        if (operation.action === "remove") {
          fs.unlinkSync(target);
          applied.add(operation.path);
          syncDir(path.dirname(target));
        } else atomicWrite(store, target, contents.get(operation.entry!.sha256)!, operation.entry!.mode, verify, () => applied.add(operation.path));
      }
      commit?.();
      transaction.state = "committed";
      saveTransaction(store, transaction);
    } catch (error) {
      if (branch && branchProof(root, branch, { ...context, signal: new AbortController().signal }).committed) {
        throw new Error(`Checkpoint history committed; transaction retained for recovery. ${String(error)}`);
      }
      try { recoverTransaction(root, store, { ...context, signal: new AbortController().signal }, true, false, applied); }
      catch (rollback) { throw new Error(`Checkpoint restore failed; rollback incomplete. ${String(rollback)} Original error: ${String(error)}`); }
      throw error;
    }
    recoverTransaction(root, store, context, false, true);
    return output({ ...result, restored: true }, context);
  });
}

export function captureCheckpoint(name: string, context: ToolContext) {
  nameSchema.parse(name);
  const root = rootFor(context);
  recoverCheckpoint(context);
  const captured = snapshot(root, context);
  aborted(context);
  const store = storeFor(root, true);
  return lock(store, () => {
    const target = path.join(store, "manifests", `${name}.json`);
    if (exists(transactionPath(store))) throw new Error("Checkpoint transaction requires explicit recovery before capture.");
    if (exists(target)) throw new Error(`Checkpoint already exists: ${name}`);
    const manifest: Manifest = { version: 1, name, created_at: new Date().toISOString(), workspace: root, digest: captured.digest, entries: captured.entries };
    const encoded = Buffer.from(JSON.stringify(manifest));
    if (encoded.length > MANIFEST_CAP) throw new Error("Checkpoint manifest exceeds byte cap.");
    for (const [digest, bytes] of captured.contents) {
      aborted(context);
      storeFor(root);
      const object = path.join(store, "objects", digest);
      if (exists(object)) {
        if (hash(readBounded(object, FILE_CAP, context)) !== digest) throw new Error("Checkpoint existing content digest mismatch.");
      } else atomicWrite(store, object, bytes, 0o600);
    }
    aborted(context);
    storeFor(root);
    if (snapshot(root, context).digest !== captured.digest) throw new Error("Checkpoint conflict: workspace changed during snapshot.");
    atomicWrite(store, target, encoded, 0o600);
    return { name, behavior: "filesystem_rewind", checkpoint_digest: captured.digest, entries: captured.entries.length,
      files: captured.entries.filter(entry => entry.kind === "file").length, created_at: manifest.created_at };
  });
}

export function previewCheckpoint(name: string, context: ToolContext) {
  nameSchema.parse(name);
  const root = rootFor(context);
  const { store, manifest } = manifestFor(root, name, context);
  if (exists(transactionPath(store))) throw new Error("Checkpoint transaction requires explicit recovery before preview.");
  const current = snapshot(root, context);
  return { name, checkpoint_digest: manifest.digest, current_digest: current.digest, changes: changes(manifest.entries, current.entries) };
}

export function createCheckpointTools(): ToolDefinition[] {
  return [
    {
      readOnly: false,
      schema: { name: "checkpoint_create", description: "Snapshot bounded workspace regular files and symlink metadata into .agent/checkpoints. Excludes .agent, .git, node_modules and .harness-worktrees; includes .harness/memory and hidden files. Filesystem checkpoint only; conversation history is unchanged. Caps: 2 MiB/file, 32 MiB total, 2000 filesystem entries.", input_schema: schema({ name: nameProperty }, ["name"]) },
      async execute(input, context) {
        const { name } = z.object({ name: nameSchema }).strict().parse(input);
        return output(captureCheckpoint(name, context), context);
      },
    },
    {
      readOnly: true,
      schema: { name: "checkpoint_list", description: "List persisted filesystem checkpoints with validated manifests and content digests. Returns a bounded page; does not rewrite session history.", input_schema: schema(pageProperties, []) },
      async execute(input, context) {
        const { offset, limit } = z.object(pageSchema).strict().parse(input);
        const root = rootFor(context);
        const agent = path.join(root, ".agent");
        if (!exists(agent)) return output({ checkpoints: [], total: 0, offset }, context);
        directory(agent);
        if (!exists(path.join(agent, "checkpoints"))) return output({ checkpoints: [], total: 0, offset }, context);
        const store = storeFor(root);
        if (exists(transactionPath(store))) throw new Error("Checkpoint transaction requires explicit recovery before listing.");
        const names = fs.readdirSync(path.join(store, "manifests")).sort();
        if (names.length > ENTRY_CAP) throw new Error("Checkpoint inventory exceeds entry cap.");
        const checkpoints = names.map(file => {
          if (!file.endsWith(".json") || !NAME.test(file.slice(0, -5))) throw new Error("Invalid checkpoint manifest name.");
          const { manifest } = manifestFor(root, file.slice(0, -5), context);
          return { name: manifest.name, created_at: manifest.created_at, checkpoint_digest: manifest.digest, entries: manifest.entries.length };
        });
        return output({ checkpoints: checkpoints.slice(offset, offset + limit), total: checkpoints.length, offset, next_offset: offset + limit < checkpoints.length ? offset + limit : null }, context);
      },
    },
    {
      readOnly: true,
      schema: { name: "checkpoint_diff", description: "Compare the full workspace fingerprint with a checkpoint. Returns added/deleted/modified paths, counts and current_digest for checkpoint_restore. Symlinks are metadata only. Re-run after any workspace edit.", input_schema: schema({ name: nameProperty, ...pageProperties }, ["name"]) },
      async execute(input, context) {
        const { name, offset, limit } = z.object({ name: nameSchema, ...pageSchema }).strict().parse(input);
        const root = rootFor(context);
        const { store, manifest } = manifestFor(root, name, context);
        if (exists(transactionPath(store))) throw new Error("Checkpoint transaction requires explicit recovery before diff.");
        const current = snapshot(root, context);
        const delta = changes(manifest.entries, current.entries);
        return output({ name, behavior: "filesystem_rewind", checkpoint_digest: manifest.digest, current_digest: current.digest, equal: delta.length === 0, total: delta.length, counts: { added: delta.filter(item => item.status === "added").length, deleted: delta.filter(item => item.status === "deleted").length, modified: delta.filter(item => item.status === "modified").length }, offset, changes: delta.slice(offset, offset + limit), next_offset: offset + limit < delta.length ? offset + limit : null }, context);
      },
    },
    { readOnly: false, schema: { name: "checkpoint_restore", description: "Filesystem rewind of checkpoint regular files. Requires expected_current_digest from checkpoint_diff; defaults to dry_run=true and all checkpoint regular files. Set dry_run=false to apply. Newly added files are kept unless remove_new=true with explicitly enumerated paths from diff. Symlinks and directory targets are rejected. Full manifest/content validation precedes writes; failed writes roll back. Session history is unchanged.", input_schema: schema({ name: nameProperty, expected_current_digest: { type: "string", pattern: HASH.source }, paths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: ENTRY_CAP }, remove_new: { type: "boolean", default: false }, dry_run: { type: "boolean", default: true } }, ["name", "expected_current_digest"]) }, execute: async (input, context) => restoreCheckpoint(input, context) },
  ];
}
