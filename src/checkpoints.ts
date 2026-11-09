// File snapshots/restores; the coordinator may commit history under the restore lock.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { sessionGateIdentitySchema, sessionLockSchema, type SessionGateIdentity } from "./session-lock-record.js";
import { directoryCheckpointPathsSchema, directoryRewindExternalSchema } from "./directory-file-history.js";
import { DIRECTORY_REWIND_BYTE_CAP, directoryRewindEvidenceSchema, linkedNormalizationSchema } from './directory-rewind-evidence.js';
import { assertDirectoryRewindExecution, verifyDirectoryRewindExecution, type DirectoryRewindExecution } from './directory-rewind-execution.js';
import { directoryRewindRecoveryVerifier } from './directory-rewind-recovery.js';
import { compensateDirectoryRewind } from './directory-rewind-compensation.js';
import { createDirectoryReceipt, reconcileDirectoryReceipts } from './directory-rewind-receipt.js';
import type { Session } from './session.js';
import { observeRetainedDirectoryFile } from './directory-file-state.js';
import { lock as flock } from "./skill-effects.js";
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
// Host rewrite: Fet/Tke/Cwt/E$n, sfn1dbxq [4731316,4733481)/[4734814,4735645)/[4743506,4743628), UTF-16,
// select message snapshots but have no workspace manifest association or recovery receipt.
const manifestAssociationSchema = z.object({ id: z.string().uuid(), session: z.string().uuid(), boundary: z.number().int().nonnegative() }).strict();
const manifestSchema = z.object({ version: z.literal(1), name: nameSchema, created_at: z.string().datetime(), workspace: z.string(), digest: z.string().regex(HASH),
  entries: z.array(entrySchema).max(ENTRY_CAP), association: manifestAssociationSchema.optional() }).strict();
type Manifest = z.infer<typeof manifestSchema>;
type ManifestAssociation = z.infer<typeof manifestAssociationSchema>;
type Snapshot = { entries: Entry[]; digest: string; contents: Map<string, Buffer> };
export type Change = { path: string; status: "added" | "deleted" | "modified"; before?: Entry; current?: Entry };
const fileStateSchema = z.object({ mode: z.number().int().min(0).max(0o7777), size: z.number().int().min(0).max(FILE_CAP), sha256: z.string().regex(HASH) }).strict();
const branchSchema = z.object({ id: z.string().uuid(), source: z.string().uuid(), boundary: z.number().int().min(0), checkpoint: nameSchema,
  digest: z.string().regex(HASH), inode: z.number().int().nonnegative(), device: z.number().int().nonnegative(),
  gate: sessionGateIdentitySchema.optional(), external: directoryRewindExternalSchema.optional(), checkpointPaths: directoryCheckpointPathsSchema.optional(),
  prefixBytes: z.number().int().min(0).max(64 * 1024 * 1024), prefixSha256: z.string().regex(HASH) }).strict();
export type CheckpointCommit = z.infer<typeof branchSchema>;
const transactionSchema = z.object({ version: z.literal(1), id: z.string().uuid(), workspace: z.string(), state: z.enum(["pending", "committed"]),
  operations: z.array(z.object({ path: z.string(), before: fileStateSchema.nullable(), after: fileStateSchema.nullable() }).strict()).max(ENTRY_CAP),
  directories: z.array(z.object({ path: z.string(), mode: z.number().int().min(0).max(0o7777), inode: z.number().int().nonnegative().nullable(), device: z.number().int().nonnegative().nullable() }).strict()).max(ENTRY_CAP),
  branch: branchSchema.optional(), directory: directoryRewindEvidenceSchema.optional() }).strict();
type Transaction = z.infer<typeof transactionSchema>;
type CommittedTransactionIdentity = { id: string; branch: CheckpointCommit; digest: string };
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
function transactionDigest(transaction: Transaction): string {
  const { state, ...identity } = transactionSchema.parse(transaction);
  return hash(JSON.stringify(identity));
}

// Host committed-marker recovery for Cwt/kVr and gft, sfn1dbxq [4734814,4737243),
// 24k7d6mw [38766,45161), UTF-16; source has no workspace transaction or branch gate.
export class CommittedCheckpointTransactionError extends Error {
  readonly identity: CommittedTransactionIdentity;
  constructor(readonly workspace: string, transaction: Transaction, cause: unknown) {
    super(`Checkpoint history committed; transaction retained for recovery. ${String(cause)}`, { cause });
    if (!transaction.branch) throw new Error("Committed checkpoint branch is missing.");
    this.identity = { id: transaction.id, branch: structuredClone(transaction.branch), digest: transactionDigest(transaction) };
  }
}
// gft, 24k7d6mw [38766,45161), UTF-16. Rollback removes the successor
// journal, so the interactive owner must switch before recovery can proceed.
export class PendingRewindHandoff extends Error {
  constructor(readonly source: string, readonly transactionHash: string, readonly journalHash: string,
    readonly verifySource: (source: Session) => void, readonly verifyTransfer: (source: Session) => () => void) {
    super(`External rewind must resume source session ${source} to roll back the interrupted branch`);
  }
}
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
function readBounded(target: string, cap: number, context: ToolContext, durable = false, pinnedFd?: number): Buffer {
  aborted(context);
  const before = fs.lstatSync(target);
  if (!before.isFile() || before.isSymbolicLink() || before.size > cap) throw new Error(`Checkpoint file exceeds cap or is not regular: ${target}`);
  const fd = pinnedFd ?? fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
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
    if (durable) fs.fsyncSync(fd);
    const extra = Buffer.alloc(1);
    const after = fs.fstatSync(fd);
    if (fs.readSync(fd, extra, 0, 1, offset) || after.size !== initial.size || after.mtimeMs !== initial.mtimeMs || after.ctimeMs !== initial.ctimeMs || fs.lstatSync(target).ino !== initial.ino) throw new Error(`Checkpoint file changed during read: ${target}`);
    return bytes;
  } finally { if (pinnedFd === undefined) fs.closeSync(fd); }
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
// Host restart reconciliation for Cwt/kVr and gft, sfn1dbxq [4734814,4737243),
// 24k7d6mw [38766,45161), UTF-16; the source has no workspace transaction lock.
export function withIdleCheckpointStore<T>(workspace: string, operation: () => T): T | undefined {
  const store = storeFor(canonicalRoot(workspace));
  return lock(store, () => exists(transactionPath(store)) ? undefined : operation());
}
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return false; throw error; }
}
function readLock(target: string, session = false): { pid: number; token?: string; gate?: SessionGateIdentity } {
  const bytes = readBounded(target, 4096, { signal: new AbortController().signal } as ToolContext).toString("utf8");
  // Older checkpoint locks contain only their owner PID.
  if (/^[1-9][0-9]*\n?$/.test(bytes)) {
    const pid = Number(bytes.trim());
    if (!Number.isSafeInteger(pid)) throw new Error("Invalid checkpoint lock owner.");
    return { pid };
  }
  return (session ? z.union([lockSchema, sessionLockSchema]) : lockSchema).parse(JSON.parse(bytes));
}
function reclaimDeadLock(target: string, session = false): void {
  const before = fs.lstatSync(target);
  let owner: ReturnType<typeof readLock>;
  try { owner = readLock(target, session); } catch { throw new Error("EEXIST: Checkpoint lock owner is invalid; retain for inspection."); }
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
function saveObject(store: string, bytes: Buffer, context: ToolContext, cap = FILE_CAP): void {
  const digest = hash(bytes), target = path.join(store, "objects", digest);
  if (exists(target)) { if (hash(readBounded(target, cap, context)) !== digest) throw new Error("Checkpoint rollback object digest mismatch."); }
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
function manifestDigest(root: string, name: string, association?: ManifestAssociation): string | undefined {
  nameSchema.parse(name);
  const file = path.join(root, ".agent", "checkpoints", "manifests", `${name}.json`);
  const stat = exists(file);
  if (!stat) return undefined;
  if (!stat.isFile() || stat.size > MANIFEST_CAP) throw new Error(`Invalid checkpoint manifest: ${name}`);
  let manifest: Manifest;
  if (association) {
    const context = { workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 };
    const checked = manifestFor(root, name, context, true);
    for (const dir of [path.join(checked.store, "objects"), path.join(checked.store, "manifests"), checked.store, path.dirname(checked.store), root]) syncDir(dir);
    const after = manifestFor(root, name, context).manifest;
    if (JSON.stringify(checked.manifest) !== JSON.stringify(after)) throw new Error(`Checkpoint manifest changed during recovery: ${name}`);
    manifest = after;
  } else manifest = manifestSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (manifest.workspace !== root || manifest.name !== name || manifest.digest !== fingerprint(manifest.entries)) throw new Error(`Checkpoint manifest identity or digest mismatch: ${name}`);
  if (association && (!manifest.association || manifest.association.id !== association.id || manifest.association.session !== association.session ||
      manifest.association.boundary !== association.boundary)) throw new Error(`Checkpoint association identity mismatch: ${name}`);
  return manifest.digest;
}
export function inspectCheckpointAssociation(workspace: string, name: string, session: string, boundary: number):
  { id: string; digest: string } | undefined {
  try {
    const root = canonicalRoot(workspace), context = { workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 };
    const { manifest } = manifestFor(root, nameSchema.parse(name), context), association = manifest.association;
    if (!association || association.session !== session || association.boundary !== boundary ||
        manifestDigest(root, name, association) !== manifest.digest) return;
    return { id: association.id, digest: manifest.digest };
  } catch { return; }
}
/** Returns this session's intents that still need a journal event. Completed intents and intents
 *  whose capture never published a manifest are cleared; unreadable or foreign files stay. */
export function recoverCheckpointAssociations(root: string, session: string,
  existing: (name: string) => { digest: string; boundary: number } | undefined, confirmExisting: () => void): CheckpointAssociation[] {
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
    try { digest = manifestDigest(root, intent.name, { id: intent.id, session: intent.session, boundary: intent.boundary }); }
    catch { continue; }
    if (digest === undefined) {
      try { fs.unlinkSync(file); syncDir(store); } catch { /* retain for inspection */ }
      continue;
    }
    const saved = existing(intent.name);
    if (saved !== undefined) {
      if (saved.digest === digest && saved.boundary === intent.boundary) {
        confirmExisting();
        try { fs.unlinkSync(file); syncDir(store); } catch { /* retain for inspection */ }
      }
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
  // Archived mixed transactions retain before/after objects needed to inspect
  // native held objects. An unreadable receipt conservatively prevents sweeping.
  if (entries.length > OBJECT_SCAN_CAP) return;
  for (const name of entries) {
    const match = /^directory-(?:rewind|rollback)-([0-9a-f-]{36})\.json$/.exec(name);
    if (!match) continue;
    try {
      const receipt = transactionSchema.parse(JSON.parse(readBounded(path.join(store, name), MANIFEST_CAP,
        { workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: MANIFEST_CAP }).toString('utf8')));
      if (receipt.workspace !== root || receipt.id !== match[1] || !receipt.directory) return;
      for (const operation of receipt.operations) for (const state of [operation.before, operation.after]) if (state) referenced.add(state.sha256);
      for (const operation of receipt.directory.operations) for (const state of [operation.before, operation.after])
        if (state.kind === 'present') referenced.add(state.content.sha256);
    } catch { return; }
  }
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
function branchProof(root: string, branch: CheckpointCommit, context: ToolContext, durable = false,
  rollbackArchive?: string, activeSuccessorJournal?: Buffer): { committed: boolean; file?: string; stat?: fs.Stats; bytes?: Buffer } {
  const original = path.join(root, ".agent", `${branch.id}.jsonl`);
  const file = exists(original) ? original : rollbackArchive ?? original, stat = exists(file);
  if (!stat) return { committed: false };
  if (stat.ino !== branch.inode || stat.dev !== branch.device) throw new Error("Checkpoint recovery branch identity changed.");
  const bytes = readBounded(file, 64 * 1024 * 1024, context, durable);
  if (rollbackArchive && exists(rollbackArchive)) {
    const retained = fs.lstatSync(rollbackArchive);
    if (!retained.isFile() || retained.isSymbolicLink() || retained.ino !== branch.inode || retained.dev !== branch.device ||
        !readBounded(rollbackArchive, 64 * 1024 * 1024, context, durable).equals(bytes))
      throw new Error('Checkpoint rollback branch archive changed; transaction retained');
  }
  if (bytes.length < branch.prefixBytes || hash(bytes.subarray(0, branch.prefixBytes)) !== branch.prefixSha256) throw new Error("Checkpoint recovery branch prefix changed.");
  const tail = bytes.subarray(branch.prefixBytes).toString("utf8");
  const expected = [
    { kind: "rewind", source: branch.source, boundary: branch.boundary, checkpoint: branch.checkpoint, digest: branch.digest },
    { kind: "branch", source: branch.source, workspace: root, boundary: branch.boundary, reason: "rewind", ...(branch.external ? { external: branch.external } : {}),
      ...(branch.checkpointPaths ? { checkpointPaths: branch.checkpointPaths } : {}) },
  ].map(event => JSON.stringify(event) + "\n").join("");
  if (tail === expected || (activeSuccessorJournal?.equals(bytes) && tail.startsWith(expected))) {
    if (file === rollbackArchive) throw new Error('Checkpoint rollback archive cannot prove commitment');
    return { committed: true, file, stat, bytes };
  }
  if (!expected.startsWith(tail)) throw new Error("Checkpoint recovery branch has unrelated history; retained for inspection.");
  return { committed: false, file, stat, bytes };
}

// EVr/RVr, sfn1dbxq [4739632,4743506), UTF-16. Mixed receipts are host
// evidence. This inventory reports recorded outcomes and grants no authority.
export function listRecordedRewindHolds(session: Session) {
  const root = session.config.workspace;
  if (!exists(path.join(root, '.agent', 'checkpoints'))) return [];
  const store = storeFor(root);
  const context = { workspace: root, signal: session.closeSignal, allowShell: false, maxOutputBytes: MANIFEST_CAP };
  const names = fs.readdirSync(store);
  if (names.length > OBJECT_SCAN_CAP) throw new Error('Checkpoint archive scan exceeds file limit');
  const holds = [];
  for (const name of names.sort()) {
    const match = /^directory-(rewind|rollback)-([0-9a-f-]{36})\.json$/.exec(name);
    if (!match) continue;
    const saved = transactionSchema.parse(JSON.parse(readBounded(path.join(store, name), MANIFEST_CAP, context).toString('utf8')));
    const { branch, directory } = saved;
    if (!branch || !directory || saved.workspace !== root || saved.id !== match[2] ||
        branch.source !== directory.checkpoint.owner || branch.id !== directory.owner ||
        branch.digest !== directory.checkpoint.digest || branch.checkpoint !== directory.checkpoint.name ||
        (session.id !== branch.id && session.id !== branch.source)) continue;
    const committed = match[1] === 'rewind';
    if (!committed && saved.state !== 'pending') continue;
    for (const operation of directory.operations) {
      for (const [phase, stage] of [['forward', operation.stage], ['rollback', operation.rollback]] as const) {
        if (stage?.kind !== 'completed') continue;
        const held = stage.result.kind === 'quarantined' ? stage.result.observation : stage.result.held;
        if (held) holds.push({ transaction: saved.id, attempt: stage.id, phase,
          disposition: committed ? 'committed' : 'rolled_back', operation: stage.result.kind === 'quarantined' ? 'remove' : 'replace' });
      }
    }
  }
  return holds;
}

// Host mixed receipt adaptation of EVr/RVr, sfn1dbxq [4739632,4743506),
// and sC, f606a53w [12501,15618), half-open UTF-16.
export function archiveRewindHolds(session: Session, id: string, signal: AbortSignal): number {
  z.string().uuid().parse(id);
  const root = session.config.workspace, store = storeFor(root);
  const context = { workspace: root, signal, allowShell: false, maxOutputBytes: MANIFEST_CAP };
  return lock(store, () => {
    if (exists(transactionPath(store))) throw new Error('Resolve the pending checkpoint transaction before archiving');
    const paths = ['rewind', 'rollback'].map(kind => path.join(store, `directory-${kind}-${id}.json`));
    const matches = paths.filter(file => exists(file));
    if (matches.length !== 1) throw new Error('Terminal rewind receipt unavailable or ambiguous');
    const receiptFile = matches[0]!, committed = receiptFile === paths[0];
    const bytes = readBounded(receiptFile, MANIFEST_CAP, context, true);
    const tx = transactionSchema.parse(JSON.parse(bytes.toString('utf8'))), { branch, directory } = tx;
    if (!branch?.gate || !directory || tx.id !== id || tx.workspace !== root || (!committed && tx.state !== 'pending') ||
        branch.source !== directory.checkpoint.owner || branch.id !== directory.owner ||
        branch.checkpoint !== directory.checkpoint.name || branch.digest !== directory.checkpoint.digest ||
        session.id !== (committed ? branch.id : branch.source))
      throw new Error('Open the terminal rewind session to archive its held files');
    const rollbackFile = committed ? undefined : path.join(store, `rollback-branch-${id}.jsonl`);
    const assertOwner = () => {
      const journal = session.checkpointJournalBytes();
      const proof = branchProof(root, branch, context, true, rollbackFile, committed ? journal : undefined);
      if (proof.committed !== committed || proof.file !== (committed ? session.file : rollbackFile) ||
          (committed && (!proof.bytes?.equals(journal) || !isDeepStrictEqual(branch.gate, session.checkpointGateIdentity()))) ||
          !readBounded(receiptFile, MANIFEST_CAP, context).equals(bytes))
        throw new Error('Terminal rewind branch or receipt changed');
    };
    const gate = acquireBranchGate(root, { id: session.id, gate: session.checkpointGateIdentity() }, assertOwner);
    let source: Session | undefined, archiveFd: number | undefined;
    try {
      source = committed ? session.openCommittedRewindSource(branch.source) : session;
      for (const op of directory.operations) {
        if ((op.stage.kind === 'completed' && !op.receipt) || (op.rollback?.kind === 'completed' && !op.rollbackReceipt))
          throw new Error('Terminal rewind lacks a native receipt');
      }
      const receipts = reconcileDirectoryReceipts(store, directory, session, signal, source);
      const archive = path.join(store, `held-archive-${id}`);
      try { fs.mkdirSync(archive, { mode: 0o700 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
      syncDir(store);
      const fd = archiveFd = fs.openSync(archive, fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      const opened = fs.fstatSync(fd, { bigint: true });
      const assertArchive = () => {
        const named = fs.lstatSync(archive, { bigint: true });
        if (!named.isDirectory() || named.dev !== opened.dev || named.ino !== opened.ino ||
            named.uid !== BigInt(process.geteuid!()) || (named.mode & 0o7777n) !== 0o700n)
          throw new Error('Private rewind archive changed');
      };
      let move = false, count = 0;
      const verify = directoryRewindRecoveryVerifier(source, receipts.record,
        digest => readBounded(path.join(store, 'objects', digest), DIRECTORY_REWIND_BYTE_CAP, context), signal,
        committed ? 'committed' : 'rolled_back', undefined, session, (op, attemptId, kind, expected, digest) => {
          const grant = session.workingDirectories(false).readHandle?.(op.grant.root);
          if (!grant) throw new Error('Regrant the original directory before archiving');
          const relative = path.relative(grant.root, op.path);
          const from = op.rollback?.id === attemptId ? op.after : op.before;
          if (from.kind !== 'present') throw new Error('Rewind hold lacks original parent');
          if (move) { gate.assert(); receipts.verify(); }
          assertArchive();
          const object = path.join(store, 'objects', digest);
          const witness = fs.openSync(object, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
          try {
            const identity = fs.fstatSync(witness, { bigint: true }), named = fs.lstatSync(object, { bigint: true });
            if (!identity.isFile() || identity.size !== BigInt(from.content.bytes) || identity.ino !== named.ino ||
                identity.dev !== named.dev || hash(readBounded(object, from.content.bytes, context, false, witness)) !== digest) throw new Error('Rewind backup changed');
            const rootStat = fs.lstatSync(grant.root, { bigint: true });
            if (!rootStat.isDirectory() || rootStat.dev !== grant.dev || rootStat.ino !== grant.ino || grant.signal.aborted ||
                observeRetainedDirectoryFile({ fd: grant.fd, relative, expected, expectedFd: witness, leaseFd: gate.fd,
                  transactionId: attemptId, archive: { fd, parent: from.observation.parent, move, kind } }).kind !== 'observed')
              throw new Error('Rewind hold archive unconfirmed');
            const after = fs.fstatSync(witness, { bigint: true });
            if (after.ctimeNs !== identity.ctimeNs || after.mtimeNs !== identity.mtimeNs) throw new Error('Rewind backup changed');
            assertArchive();
          } finally { fs.closeSync(witness); }
          if (move) count++;
        });
      receipts.verify(); receipts.verifyCandidates();
      move = true;
      verify();
      if (!count) throw new Error('Transaction has no completed holds');
      move = false;
      verify(); receipts.verify(); gate.assert();
      return count;
    } finally {
      if (archiveFd !== undefined) fs.closeSync(archiveFd);
      if (source && source !== session) void source.close();
      gate.release();
    }
  });
}

// Host restart adaptation of kHs, 24k7d6mw [45367,46476), UTF-16. A
// committed mixed transaction archives its branch identity before unlink.
export function hasArchivedRewindCommit(session: Session): boolean {
  const root = session.config.workspace, store = storeFor(root);
  const context = { workspace: root, signal: session.closeSignal, allowShell: false, maxOutputBytes: MANIFEST_CAP };
  const names = fs.readdirSync(store);
  if (names.length > OBJECT_SCAN_CAP || exists(transactionPath(store))) return false;
  let found = false;
  for (const name of names) {
    const match = /^directory-rewind-([0-9a-f-]{36})\.json$/.exec(name);
    if (!match) continue;
    const saved = transactionSchema.parse(JSON.parse(readBounded(path.join(store, name), MANIFEST_CAP, context).toString('utf8')));
    const branch = saved.branch;
    if (branch?.id !== session.id) continue;
    if (found || saved.workspace !== root || saved.id !== match[1] || !saved.directory ||
        saved.directory.owner !== session.id || saved.directory.operations.some(op => op.stage.kind !== 'completed' || op.rollback) ||
        saved.directory.checkpoint.owner !== branch.source ||
        saved.directory.checkpoint.name !== branch.checkpoint || saved.directory.checkpoint.digest !== branch.digest ||
        !isDeepStrictEqual(branch.gate, session.checkpointGateIdentity())) return false;
    const proof = branchProof(root, branch, context, true);
    if (!proof.committed || proof.file !== session.file || !proof.bytes?.equals(session.checkpointJournalBytes())) return false;
    found = true;
  }
  return found;
}

// Host transaction/gate adaptation for kVr/EVr/RVr, sfn1dbxq [4735645,4737243)/[4739632,4743506), UTF-16.
function acquireBranchGate(root: string, branch: Pick<CheckpointCommit, 'id' | 'gate'>, assertOwner?: () => void): { fd: number; assert: () => void; release: () => void } {
  const lockPath = path.join(root, ".agent", `${branch.id}.jsonl.lock`), gatePath = `${lockPath}.gate`;
  let fd: number;
  try { fd = fs.openSync(gatePath, fs.constants.O_RDWR | fs.constants.O_NOFOLLOW); }
  catch { throw new Error("Checkpoint recovery branch gate unavailable."); }
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    const assert = () => {
      const current = fs.fstatSync(fd, { bigint: true }), named = fs.lstatSync(gatePath, { bigint: true });
      if (!opened.isFile() || !current.isFile() || !named.isFile() || named.isSymbolicLink() ||
          opened.dev !== current.dev || opened.ino !== current.ino || opened.dev !== named.dev || opened.ino !== named.ino ||
          (current.mode & 0o777n) !== 0o600n || (branch.gate && (branch.gate.dev !== String(opened.dev) || branch.gate.ino !== String(opened.ino))))
        throw new Error("Checkpoint recovery branch gate changed.");
      if (exists(lockPath)) {
        const owner = readLock(lockPath, true);
        if (owner.gate && (owner.gate.dev !== String(opened.dev) || owner.gate.ino !== String(opened.ino)))
          throw new Error("Checkpoint recovery branch gate changed.");
        if (!assertOwner && alive(owner.pid)) throw new Error("Checkpoint recovery branch has an active owner.");
      }
      assertOwner?.();
    };
    assert();
    if (!flock(fd, false)) throw new Error("Checkpoint recovery branch gate is busy.");
    assert();
    return { fd, assert, release: () => fs.closeSync(fd) };
  } catch (error) { fs.closeSync(fd); throw error; }
}

function recoverTransaction(root: string, store: string, context: ToolContext, forceRollback = false, ownBranch = false,
  applied?: ReadonlySet<string>, after?: () => void, expectedCommitted?: CommittedTransactionIdentity,
  directory?: DirectoryRewindExecution, coldAuthority?: Session): "none" | "rolled_back" | "committed" {
  const target = transactionPath(store);
  if (!exists(target)) {
    if (expectedCommitted) throw new Error("Expected checkpoint transaction is missing.");
    return "none";
  }
  const transaction = transactionSchema.parse(JSON.parse(readBounded(target, MANIFEST_CAP, context).toString("utf8")));
  if (transaction.workspace !== root) throw new Error("Checkpoint transaction workspace mismatch.");
  const rollbackArchive = transaction.directory && coldAuthority && !forceRollback && !ownBranch
    ? path.join(store, `rollback-branch-${transaction.id}.jsonl`) : undefined;
  // kVr/RVr, sfn1dbxq [4735645,4737243)/[4740702,4743506), UTF-16.
  // Host mixed effects need current directory authority. Prepared or matching
  // file bytes alone cannot authorize rollback or branch/receipt cleanup.
  let verifyColdDirectory: ReturnType<typeof directoryRewindRecoveryVerifier> | undefined;
  let verifyColdBranch: (() => void) | undefined;
  let coldReceipts: ReturnType<typeof reconcileDirectoryReceipts> | undefined;
  let checkpointSource: Session | undefined;
  try {
  if (transaction.directory) {
    if (directory) verifyDirectoryRewindExecution(directory, transaction.directory, forceRollback);
    else if (coldAuthority && !forceRollback && !ownBranch) {
      const branch = transaction.branch;
      if (coldAuthority.config.workspace !== root || !branch || branch.id !== transaction.directory.owner ||
          branch.source !== transaction.directory.checkpoint.owner || branch.checkpoint !== transaction.directory.checkpoint.name ||
          branch.digest !== transaction.directory.checkpoint.digest)
        throw new Error('External rewind branch proof unavailable; transaction retained');
      const proof = branchProof(root, branch, context, true, rollbackArchive);
      if (!proof.file || (!proof.committed && transaction.state !== 'pending'))
        throw new Error('External rewind branch disposition unavailable; transaction retained');
      const successor = coldAuthority.id === branch.id;
      const assertSuccessor = () => {
        if (!proof.bytes || !branch.gate ||
            !isDeepStrictEqual(coldAuthority.checkpointGateIdentity(), branch.gate) ||
            coldAuthority.file !== proof.file || !coldAuthority.checkpointJournalBytes().equals(proof.bytes))
          throw new Error('External rewind requires the original successor journal and gate');
      };
      if (successor) {
        assertSuccessor();
        const record = transaction.directory;
        const grants = record.operations.map(operation => {
          const grant = coldAuthority.workingDirectories(false).readHandle?.(operation.grant.root);
          if (!grant || grant.owner !== branch.id || String(grant.dev) !== operation.grant.dev || String(grant.ino) !== operation.grant.ino)
            throw new Error('External rewind requires an explicit grant for the original directory');
          return grant;
        });
        if (!proof.committed) {
          if (branch.source === branch.id) throw new Error('External rewind source identity is ambiguous');
          const verifyTransfer = (source: Session) => {
            context.signal.throwIfAborted();
            assertSuccessor();
            source.checkpointGateIdentity();
            const copies = grants.map(grant => {
              const copied = source.workingDirectories(false).readHandle?.(grant.root);
              if (grant.signal.aborted || !copied || copied.signal.aborted || copied.owner !== branch.source ||
                  copied.dev !== grant.dev || copied.ino !== grant.ino || copied.incarnation === grant.incarnation || copied.fd === grant.fd)
                throw new Error('External rewind directory grant changed during handoff');
              return copied;
            });
            return () => {
              context.signal.throwIfAborted();
              source.checkpointGateIdentity();
              for (const copy of copies) {
                if (copy.signal.aborted || source.workingDirectories(false).readHandle?.(copy.root)?.incarnation !== copy.incarnation)
                  throw new Error('External rewind source grant changed during handoff');
              }
            };
          };
          const verifySource = (source: Session) => {
            verifyTransfer(source);
            const receipts = reconcileDirectoryReceipts(store, record, source, context.signal);
            directoryRewindRecoveryVerifier(source, receipts.record,
              digest => readBounded(path.join(store, 'objects', digest), DIRECTORY_REWIND_BYTE_CAP, context),
              context.signal, 'uncommitted', receipts.intermediates);
            receipts.verify(); receipts.verifyCandidates();
          };
          throw new PendingRewindHandoff(branch.source, hash(JSON.stringify(transaction)), hash(coldAuthority.checkpointJournalBytes()),
            verifySource, verifyTransfer);
        }
        checkpointSource = coldAuthority.openCommittedRewindSource();
      }
      coldReceipts = reconcileDirectoryReceipts(store, transaction.directory, coldAuthority, context.signal, checkpointSource);
      verifyColdDirectory = directoryRewindRecoveryVerifier(checkpointSource ?? coldAuthority, coldReceipts.record,
        digest => readBounded(path.join(store, 'objects', digest), DIRECTORY_REWIND_BYTE_CAP, context), context.signal,
        proof.committed ? 'committed' : 'uncommitted', coldReceipts.intermediates, coldAuthority);
      verifyColdBranch = () => {
        if (successor) assertSuccessor();
        const current = branchProof(root, branch, context, true, rollbackArchive);
        if (!current.bytes?.equals(proof.bytes!)) throw new Error('External rewind branch proof changed; transaction retained');
      };
    } else throw new Error('Checkpoint external rewind requires live directory reconciliation; transaction retained.');
  }
  if (expectedCommitted && (transaction.id !== expectedCommitted.id || transactionDigest(transaction) !== expectedCommitted.digest ||
      !isDeepStrictEqual(transaction.branch, expectedCommitted.branch))) throw new Error("Checkpoint transaction identity changed; retained for inspection.");
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
  const gate = !forceRollback && !ownBranch && transaction.branch
    ? acquireBranchGate(root, transaction.branch, checkpointSource ? verifyColdBranch : undefined) : undefined;
  try {
  gate?.assert();
  verifyColdBranch?.();
  coldReceipts?.verify();
  coldReceipts?.verifyCandidates();
  verifyColdDirectory?.();
  if (expectedCommitted && (!transaction.branch || !gate || !branchProof(root, transaction.branch, context, true).committed))
    throw new Error("Checkpoint committed branch proof is missing; transaction retained.");
  // The crashed writer held the store lock, so its staging files in the target directories are
  // orphans; sweeping them first also lets a recorded directory that must be removed come empty.
  const tag = hash(store).slice(0, 12), swept = new Set<string>();
  const sweepTargets = () => {
    for (const operation of transaction.operations) {
      const directory = path.dirname(targetFor(root, operation.path));
      if (swept.has(directory)) continue;
      swept.add(directory);
      gate?.assert(); sweepStaging(directory, tag);
    }
  };
  if (!expectedCommitted) sweepTargets();
  const branch = transaction.branch ? branchProof(root, transaction.branch, context, false, rollbackArchive) : undefined;
  if (expectedCommitted && !branch?.committed) throw new Error("Checkpoint committed branch proof changed; transaction retained.");
  // History proof remains authoritative when publishing the commit marker fails.
  const committed = branch?.committed === true || (!forceRollback && transaction.state === "committed");
  if (committed && branch && !branch.committed) throw new Error("Checkpoint commit marker lacks its history proof; transaction retained.");
  const conflicts: string[] = [];
  const branchLock = transaction.branch ? path.join(root, ".agent", `${transaction.branch.id}.jsonl.lock`) : undefined;
  if (checkpointSource && !branch?.committed) throw new Error('External rewind successor commitment changed');
  if (!forceRollback && !ownBranch && !checkpointSource && branchLock && exists(branchLock)) {
    const owner = readLock(branchLock, true);
    if (alive(owner.pid)) throw new Error("Checkpoint recovery branch has an active owner.");
  }
  const verifyWorkspaceRecovery = () => {
  for (const saved of transaction.directories) {
    gate?.assert();
    relativePath(saved.path);
    const stat = exists(targetFor(root, saved.path));
    if (stat && (saved.inode === null || saved.device === null || !stat.isDirectory() || stat.ino !== saved.inode || stat.dev !== saved.device || (stat.mode & 0o7777) !== saved.mode)) {
      throw new Error(`Checkpoint recovery directory ownership is unknown: ${saved.path}; transaction retained.`);
    }
  }
  // Check every target before any rollback. Outside edits preserve the entire
  // transaction, including already-restored targets, for explicit reconciliation.
  for (const operation of transaction.operations) {
    gate?.assert();
    const current = fileState(root, operation.path, context);
    const untouched = applied !== undefined && !applied.has(operation.path);
    if (committed ? !equalState(current, operation.after) : !equalState(current, operation.before) && (untouched || !equalState(current, operation.after))) {
      if (!forceRollback || committed) throw new Error(`Checkpoint recovery conflict: ${operation.path}; transaction retained.`);
      conflicts.push(operation.path);
    }
  }
  };
  verifyWorkspaceRecovery();
  // Host linked normalization: bind its separate receipt before effects, keep
  // the original create receipt, and preflight the complete mixed transaction.
  while (coldReceipts?.linked.size) {
    if (committed || !coldAuthority || !gate || !verifyColdDirectory || !verifyColdBranch)
      throw new Error('External rewind linked normalization requires an uncommitted recovery gate');
    const [entryPath, continuation] = coldReceipts.linked.entries().next().value!;
    gate.assert(); verifyColdBranch(); coldReceipts.verify(); coldReceipts.verifyCandidates(); verifyColdDirectory(); verifyWorkspaceRecovery();
    const assertTransaction = () => {
      if (!isDeepStrictEqual(transactionSchema.parse(JSON.parse(readBounded(target, MANIFEST_CAP, context).toString('utf8'))), transaction))
        throw new Error('External rewind transaction changed during linked normalization');
    };
    assertTransaction();
    const record = coldReceipts.record, operation = record.operations.find(item => item.path === entryPath)!;
    const remaining = coldReceipts.linked.size;
    let receipt: ReturnType<typeof createDirectoryReceipt> | undefined;
    let normalizationId: string | undefined;
    try {
      if (continuation.kind === 'initial') {
        normalizationId = crypto.randomUUID(); receipt = createDirectoryReceipt(store, normalizationId);
        const evidence = linkedNormalizationSchema.parse({ id: normalizationId, receipt: receipt.identity,
          originalReceiptDigest: continuation.evidence.receiptDigest, alias: continuation.evidence.alias, pair: continuation.evidence.observation });
        if (continuation.reverse) operation.rollbackNormalization = evidence;
        else operation.normalization = evidence;
      } else {
        const evidence = continuation.reverse ? operation.rollbackNormalization : operation.normalization;
        if (!evidence) throw new Error('External rewind normalization evidence missing');
        evidence.captured = continuation.evidence;
      }
      if (!isDeepStrictEqual(record, transaction.directory)) {
        transaction.directory = record; saveTransaction(store, transaction);
      }
      gate.assert(); verifyColdBranch(); coldReceipts.verify(); coldReceipts.verifyCandidates(); verifyColdDirectory(); verifyWorkspaceRecovery(); assertTransaction();
      if (continuation.kind === 'initial') {
        if (!receipt || !normalizationId) throw new Error('External rewind normalization receipt missing');
        continuation.normalize(normalizationId, receipt.fd, gate.fd, digest => path.join(store, 'objects', digest));
      } else continuation.publish(gate.fd);
    } finally { receipt?.close(); }
    gate.assert(); verifyColdBranch(); coldReceipts.verify(); verifyColdDirectory.authority(); assertTransaction();
    coldReceipts = reconcileDirectoryReceipts(store, record, coldAuthority, context.signal);
    verifyColdDirectory = directoryRewindRecoveryVerifier(coldAuthority, coldReceipts.record,
      digest => readBounded(path.join(store, 'objects', digest), DIRECTORY_REWIND_BYTE_CAP, context), context.signal, 'uncommitted', coldReceipts.intermediates);
    coldReceipts.verifyCandidates(); verifyWorkspaceRecovery();
    if (coldReceipts.linked.size >= remaining) throw new Error('External rewind linked normalization did not settle');
  }
  // RVr host continuation: every operation is preflighted before publishing
  // an already-captured staged inode. The original receipt stays immutable.
  while (coldReceipts?.captured.size) {
    if (committed || !coldAuthority || !gate || !verifyColdDirectory || !verifyColdBranch)
      throw new Error('External rewind captured continuation requires an uncommitted recovery gate');
    const [entryPath, continuation] = coldReceipts.captured.entries().next().value!;
    gate.assert(); verifyColdBranch(); coldReceipts.verify(); coldReceipts.verifyCandidates(); verifyColdDirectory(); verifyWorkspaceRecovery();
    const assertTransaction = () => {
      if (!isDeepStrictEqual(transactionSchema.parse(JSON.parse(readBounded(target, MANIFEST_CAP, context).toString('utf8'))), transaction))
        throw new Error('External rewind transaction changed during captured continuation');
    };
    assertTransaction();
    const record = coldReceipts.record, operation = record.operations.find(item => item.path === entryPath)!;
    if (continuation.reverse) operation.rollbackContinuation = continuation.evidence;
    else operation.continuation = continuation.evidence;
    if (!isDeepStrictEqual(record, transaction.directory)) {
      transaction.directory = record; saveTransaction(store, transaction);
    }
    gate.assert(); verifyColdBranch(); coldReceipts.verify(); coldReceipts.verifyCandidates(); verifyColdDirectory(); verifyWorkspaceRecovery(); assertTransaction();
    const remaining = coldReceipts.captured.size;
    continuation.publish(gate.fd, digest => path.join(store, 'objects', digest));
    gate.assert(); verifyColdBranch(); coldReceipts.verify(); verifyColdDirectory.authority(); assertTransaction();
    coldReceipts = reconcileDirectoryReceipts(store, record, coldAuthority, context.signal);
    verifyColdDirectory = directoryRewindRecoveryVerifier(coldAuthority, coldReceipts.record,
      digest => readBounded(path.join(store, 'objects', digest), DIRECTORY_REWIND_BYTE_CAP, context), context.signal, 'uncommitted', coldReceipts.intermediates);
    coldReceipts.verifyCandidates(); verifyWorkspaceRecovery();
    if (coldReceipts.captured.size >= remaining) throw new Error('External rewind captured continuation did not settle');
  }
  if (coldReceipts && !isDeepStrictEqual(coldReceipts.record, transaction.directory)) {
    gate?.assert(); verifyColdBranch?.(); coldReceipts.verify(); coldReceipts.verifyCandidates(); verifyColdDirectory?.();
    if (!isDeepStrictEqual(transactionSchema.parse(JSON.parse(readBounded(target, MANIFEST_CAP, context).toString('utf8'))), transaction))
      throw new Error('External rewind transaction changed before receipt reconciliation');
    transaction.directory = coldReceipts.record; saveTransaction(store, transaction);
  }
  if (!committed) {
    if (coldAuthority && transaction.directory && !directory) {
      if (!gate || !verifyColdDirectory || !verifyColdBranch) throw new Error('External rewind recovery gate unavailable');
      verifyColdBranch(); verifyColdDirectory();
      const authority = coldAuthority, evidence = transaction.directory, journal = authority.checkpointJournalBytes();
      const grants = new Map(evidence.operations.map(operation => {
        const grant = authority.workingDirectories(false).readHandle?.(operation.grant.root);
        if (!grant) throw new Error('External rewind grant unavailable');
        return [operation.grant.root, grant] as const;
      }));
      const assertAuthority = () => {
        aborted(context); gate.assert(); verifyColdBranch?.(); authority.checkpointGateIdentity();
        if (!authority.isOpen || authority.isJournalFenced || authority.isDirectoryAuthorityReleased ||
            !authority.checkpointJournalBytes().equals(journal)) throw new Error('External rewind recovery authority changed');
        for (const [root, held] of grants) {
          const current = authority.workingDirectories(false).readHandle?.(root);
          if (!current || held.signal.aborted || current.signal.aborted || current.fd !== held.fd ||
              current.owner !== authority.id || current.incarnation !== held.incarnation || current.dev !== held.dev || current.ino !== held.ino)
            throw new Error('External rewind recovery grant changed');
        }
      };
      const readObject = (digest: string) => readBounded(path.join(store, 'objects', digest), DIRECTORY_REWIND_BYTE_CAP, context);
      let persisted = transactionSchema.parse(JSON.parse(readBounded(target, MANIFEST_CAP, context).toString('utf8')));
      if (!isDeepStrictEqual(persisted, transaction)) throw new Error('External rewind transaction changed before compensation');
      compensateDirectoryRewind(evidence, record => {
        assertAuthority();
        if (!isDeepStrictEqual(transactionSchema.parse(JSON.parse(readBounded(target, MANIFEST_CAP, context).toString('utf8'))), persisted))
          throw new Error('External rewind transaction changed during compensation');
        transaction.directory = record; saveTransaction(store, transaction); persisted = structuredClone(transaction);
      }, readObject, digest => path.join(store, 'objects', digest), {
        assert: assertAuthority, leaseFd: gate.fd, createReceipt: id => createDirectoryReceipt(store, id),
        grant: operation => { const grant = grants.get(operation.grant.root); if (!grant) throw new Error('External rewind grant missing'); return grant; },
      });
      assertAuthority();
      verifyColdDirectory = directoryRewindRecoveryVerifier(authority, transaction.directory, readObject, context.signal, 'rolled_back');
    }
    for (const operation of [...transaction.operations].reverse()) {
      gate?.assert();
      if (conflicts.includes(operation.path) || (applied !== undefined && !applied.has(operation.path))) continue;
      const current = fileState(root, operation.path, context);
      if (equalState(current, operation.before)) continue;
      const target = targetFor(root, operation.path);
      const verify = () => { gate?.assert(); if (!equalState(fileState(root, operation.path, context), operation.after)) throw new Error(`Checkpoint recovery conflict during rollback: ${operation.path}`); };
      if (operation.before) atomicWrite(store, target, buffers.get(operation.before.sha256)!, operation.before.mode, verify);
      else { verify(); fs.unlinkSync(target); syncDir(path.dirname(target)); }
    }
    if (conflicts.length) throw new Error(`Checkpoint recovery conflict: ${conflicts.join(", ")}; transaction retained.`);
    for (const saved of [...transaction.directories].reverse()) {
      gate?.assert();
      relativePath(saved.path);
      const directory = targetFor(root, saved.path), stat = exists(directory);
      if (!stat) continue;
      if (!stat.isDirectory() || stat.ino !== saved.inode || stat.dev !== saved.device || (stat.mode & 0o7777) !== saved.mode || fs.readdirSync(directory).length) throw new Error(`Checkpoint recovery directory changed: ${saved.path}; transaction retained.`);
      fs.rmdirSync(directory); syncDir(path.dirname(directory));
    }
    if (!forceRollback && branch?.file && branch.stat) {
      gate?.assert();
      verifyColdBranch?.(); verifyColdDirectory?.();
      const current = fs.lstatSync(branch.file);
      if (current.ino !== branch.stat.ino || current.dev !== branch.stat.dev || current.mtimeMs !== branch.stat.mtimeMs || current.ctimeMs !== branch.stat.ctimeMs) throw new Error("Checkpoint recovery branch changed before cleanup.");
      if (branchLock && exists(branchLock)) { const owner = readLock(branchLock, true); if (alive(owner.pid)) throw new Error("Checkpoint recovery branch has an active owner."); reclaimDeadLock(branchLock, true); }
      if (rollbackArchive && branch.file !== rollbackArchive) {
        // gft, 24k7d6mw [38766,45161), UTF-16: persist before handoff.
        // Host rollback retains the same inode under an exclusive store name,
        // so another crash never replaces journal proof with matching JSON alone.
        try { fs.linkSync(branch.file, rollbackArchive); }
        catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error; }
        syncDir(store);
        verifyColdBranch?.(); verifyColdDirectory?.();
      }
      if (branch.file !== rollbackArchive) { fs.unlinkSync(branch.file); syncDir(path.dirname(branch.file)); }
    }
  }
  if (committed && !checkpointSource && branchLock && exists(branchLock)) {
    gate?.assert();
    const owner = readLock(branchLock, true);
    if (!alive(owner.pid)) reclaimDeadLock(branchLock, true);
  }
  gate?.assert();
  if (expectedCommitted) { after?.(); gate?.assert(); }
  if (transaction.directory && (committed || transaction.directory.operations.some(operation => operation.rollback || operation.noEffectAttempts?.length))) {
    // Keep native held-object identities after the active transaction is cleared.
    // This receipt is evidence only; it does not authorize later cleanup/replay.
    const receipt = path.join(store, `directory-${committed ? 'rewind' : 'rollback'}-${transaction.id}.json`), bytes = Buffer.from(JSON.stringify(transaction));
    // Live compensation still owns the successor. Preserve its verified inode
    // before discardRewindBranch removes the live name after this transaction.
    if (!committed && forceRollback && directory && transaction.branch) {
      verifyDirectoryRewindExecution(directory, transaction.directory, true);
      const archive = path.join(store, `rollback-branch-${transaction.id}.jsonl`);
      const proof = branchProof(root, transaction.branch, context, true, archive);
      if (proof.committed || !proof.file || !proof.bytes) throw new Error('Compensated rewind branch unavailable');
      if (!exists(archive)) fs.linkSync(proof.file, archive);
      syncDir(store);
      const saved = branchProof(root, transaction.branch, context, true, archive);
      if (saved.committed || !saved.bytes?.equals(proof.bytes)) throw new Error('Compensated rewind branch changed');
    }
    if (exists(receipt)) {
      if (!readBounded(receipt, MANIFEST_CAP, context).equals(bytes)) throw new Error('External rewind receipt differs; transaction retained');
    } else {
      const fd = fs.openSync(receipt, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      syncDir(store);
    }
  }
  if (committed) verifyColdBranch?.();
  coldReceipts?.verify();
  verifyColdDirectory?.();
  fs.unlinkSync(target); syncDir(store);
  if (!expectedCommitted) after?.();
  gate?.assert();
  if (checkpointSource && coldAuthority?.hasCleanRewindBranch()) coldAuthority.inheritCheckpointWitnesses(checkpointSource);
  return committed ? "committed" : "rolled_back";
  } finally { gate?.release(); }
  } finally { void checkpointSource?.close(); }
}

export function recoverCommittedCheckpoint(context: ToolContext, identity: CommittedTransactionIdentity): { bytes: number; sha256: string } {
  const root = rootFor(context), store = storeFor(root);
  let journal: { bytes: number; sha256: string } | undefined;
  return lock(store, () => {
    const recovery = recoverTransaction(root, store, context, false, false, undefined, () => {
      const proof = branchProof(root, identity.branch, context, true);
      if (!proof.committed || !proof.bytes) throw new Error("Checkpoint committed branch proof changed; transaction retained.");
      journal = { bytes: proof.bytes.length, sha256: hash(proof.bytes) };
    }, identity);
    if (recovery !== "committed" || !journal) throw new Error("Checkpoint committed transaction recovery is incomplete.");
    return journal;
  });
}
export function recoverCheckpoint(context: ToolContext, externalAuthority?: Session, handoff?: PendingRewindHandoff): { recovery: "none" | "rolled_back" | "committed" } {
  const root = rootFor(context), agent = path.join(root, ".agent"), store = path.join(agent, "checkpoints");
  if (!exists(agent) || !exists(store)) {
    if (handoff) throw new Error('External rewind transaction missing after handoff');
    return { recovery: "none" };
  }
  storeFor(root);
  return lock(store, () => {
    if (handoff) {
      const saved = transactionSchema.parse(JSON.parse(readBounded(transactionPath(store), MANIFEST_CAP, context).toString('utf8')));
      if (!saved.branch || saved.state !== 'pending' || handoff.source !== externalAuthority?.id ||
          saved.branch.source !== handoff.source || hash(JSON.stringify(saved)) !== handoff.transactionHash)
        throw new Error('External rewind transaction changed during handoff');
      const proof = branchProof(root, saved.branch, context, true);
      if (proof.committed || !proof.bytes || hash(proof.bytes) !== handoff.journalHash)
        throw new Error('External rewind branch changed during handoff');
    }
    const tag = hash(store).slice(0, 12);
    const cleanup = () => {
      for (const directory of [store, path.join(store, "objects"), path.join(store, "manifests")]) sweepStaging(directory, tag);
      sweepStore(root, store);
    };
    const recovery = recoverTransaction(root, store, context, false, false, undefined, cleanup, undefined, undefined, externalAuthority);
    if (recovery === "none") cleanup();
    return { recovery };
  });
}
function manifestFor(root: string, name: string, context: ToolContext, durable = false): { store: string; manifest: Manifest; contents: Map<string, Buffer> } {
  const store = storeFor(root);
  const manifest = manifestSchema.parse(JSON.parse(readBounded(path.join(store, "manifests", `${name}.json`), MANIFEST_CAP, context, durable).toString("utf8")));
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
      const bytes = contents.get(entry.sha256) ?? readBounded(path.join(store, "objects", entry.sha256), FILE_CAP, context, durable);
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

export function restoreCheckpoint(input: unknown, context: ToolContext, commit?: () => void, branch?: CheckpointCommit,
  directory?: DirectoryRewindExecution): string {
  if (directory) assertDirectoryRewindExecution(directory);
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
    directory?.acquire();
    try {
    storeFor(root);
    aborted(context);
    if (snapshot(root, context).digest !== current.digest) throw new Error("Checkpoint conflict: workspace changed before restore.");
    const state = (entry: FileEntry | undefined): FileState => entry ? { mode: entry.mode, size: entry.size, sha256: entry.sha256 } : null;
    const transaction: Transaction = { version: 1, id: crypto.randomUUID(), workspace: root, state: "pending",
      operations: operations.map(operation => ({ path: operation.path, before: state(now.get(operation.path) as FileEntry | undefined), after: state(operation.entry) })),
      directories: [], ...(branch ? { branch: branchSchema.parse(branch) } : {}), ...(directory ? { directory: directory.record } : {}) };
    for (const operation of operations) {
      const old = now.get(operation.path);
      if (old?.kind === "file") saveObject(store, current.contents.get(old.sha256)!, context);
    }
    if (directory) for (const bytes of directory.objects.values()) saveObject(store, bytes, context, DIRECTORY_REWIND_BYTE_CAP);
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
      directory?.apply(record => { transaction.directory = record; saveTransaction(store, transaction); },
        digest => readBounded(path.join(store, 'objects', digest), DIRECTORY_REWIND_BYTE_CAP, context),
        digest => path.join(store, 'objects', digest), id => createDirectoryReceipt(store, id));
      commit?.();
      transaction.state = "committed";
      saveTransaction(store, transaction);
    } catch (error) {
      if (branch && branchProof(root, branch, { ...context, signal: new AbortController().signal }).committed) {
        throw new CommittedCheckpointTransactionError(root, transaction, error);
      }
      try {
        const recoveryContext = { ...context, signal: new AbortController().signal };
        if (directory) {
          const persisted = transactionSchema.parse(JSON.parse(readBounded(transactionPath(store), MANIFEST_CAP, recoveryContext).toString('utf8')));
          if (persisted.id !== transaction.id || !persisted.directory) throw new Error('External rewind transaction changed');
          directory.rollback(persisted.directory, record => { transaction.directory = record; saveTransaction(store, transaction); },
            digest => readBounded(path.join(store, 'objects', digest), DIRECTORY_REWIND_BYTE_CAP, recoveryContext),
            digest => path.join(store, 'objects', digest), id => createDirectoryReceipt(store, id));
        }
        recoverTransaction(root, store, recoveryContext, true, false, applied, undefined, undefined, directory);
      }
      catch (rollback) { throw new Error(`Checkpoint restore failed; rollback incomplete. ${String(rollback)} Original error: ${String(error)}`); }
      throw error;
    }
    recoverTransaction(root, store, context, false, true, undefined, undefined, undefined, directory);
    return output({ ...result, restored: true }, context);
    } finally { directory?.close(); }
  });
}

export function captureCheckpoint(name: string, context: ToolContext, association?: ManifestAssociation) {
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
    if (association) {
      association = manifestAssociationSchema.parse(association);
      const intent = associationSchema.parse(JSON.parse(readBounded(associationPath(store, association.id), ASSOCIATION_CAP, context).toString("utf8")));
      if (intent.id !== association.id || intent.session !== association.session || intent.boundary !== association.boundary || intent.name !== name)
        throw new Error("Checkpoint association intent mismatch.");
    }
    const manifest: Manifest = { version: 1, name, created_at: new Date().toISOString(), workspace: root, digest: captured.digest, entries: captured.entries,
      ...(association ? { association } : {}) };
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
