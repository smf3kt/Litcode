// Same-host session transport: discovery records, per-socket auth keys, a
// connected-peer identity check, recipient admission with a bounded held
// queue, receipts and owned cleanup. Ported from the recovered local peer
// module set; every range below is zero-based UTF-16 half-open in the
// canonical carrier. See research/ports/W186-local-peer.md.
//
// The transport is a separate explicit variant beside child-agent messaging:
// it never routes into AgentRegistry and a pathname alone never stands in for
// the identity the kernel reports on the connected socket.
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { atomicWriteFile } from "./atomic-write.js";
import type { ToolContext, ToolDefinition } from "./tools.js";

// chunk-m7864yc0.js: `J` [4023,4027), `C` [4039,4041), key name `xjn`
// [4042,4075), `Ijn` [4802,4804), `oV` [4852,4892), `STs` [5232,5505),
// `bTs` [6473,6592), `wTs` [6592,7933), `Pjn` [4717,4755), `_Ts` [4755,4802).
const AUTH_TYPE = "auth";
const TOKEN_BYTES = 16;
const KEY_FILE = /^(\d+)\.[0-9a-f]{64}\.key$/;
const KEY_TEMP = /^(\d+)\.[0-9a-f]{64}\.key\.tmp\.[0-9a-f]+$/;
const KEY_READ_LIMIT = 4096;
const TORN_REREAD_MS = 25;
// chunk-6zdc3jq1.js: `z8t` [4063,4074) line cap, `Ve` [15516,15519) macOS
// linger, `we` [15535,17953) send, `q` [17953,18154) probe, `F` [18299,18568)
// enumeration, `G` [18568,20657) record projection, `Z` [21883,22142) pid
// state, `Sao` [22142,22608) discovery, `ee` [23041,23100) spare/parked.
const MAX_LINE = 1024 * 1024;
const MAX_MESSAGE = 1024 * 1024;
const MAX_RECORD = 256 * 1024;
const SEND_TIMEOUT_MS = 5000;
const MACOS_LINGER_MS = 150;
const PROBE_TIMEOUT_MS = 250;
const SOCKET_PATH_MAX = 103;
const SOCKET_DIR_MODE = 0o700;
const SOCKET_MODE = 0o600;
const RECORD_MODE = 0o600;
const KEY_MODE = 0o600;
const FIRST_LINE_MS = 5000;
const PEER_FEATURE = /^[a-z0-9_]{1,32}$/;
// chunk-0ydceggj.js: `F` [~4260,4263) held FIFO cap, `N` [~2500,2503) settle
// budget, `E` [4491,4991) policy, `R` [6012,7011) admission, `ZUt`
// [2525,2968) close expiry.
const HELD_LIMIT = 100;
const HELD_SETTLE_MS = 750;
const RECEIPT_TEXT: Record<PeerReceiptStatus, string> = {
  held: "Your message is held for the recipient user's approval before it reaches their session.",
  denied: "The recipient user declined your message; it was not delivered.",
  expired: "Your held message expired without approval and was not delivered.",
  delivered: "Your previously-held message was approved and released to the recipient session.",
  refused: "The recipient session is not accepting same-host messages; your message was not delivered.",
  dropped: "The recipient's inbox dropped your message (rate limit, duplicate, relay loop, or full queue).",
};

export type PeerReceiptStatus = "held" | "denied" | "expired" | "delivered" | "refused" | "dropped";
export type PeerMode = "bypass" | "prompting";
export type InboundPolicy = "accept" | "hold" | "refuse";
export type HeldCause = "mode-unknown" | "mode-mismatch" | "no-mode-asserted" | "explicit";

export type PeerInfo = { pid: number; uid: number; gid: number };
type AddonPeer = PeerInfo & { pidErrno: number; effectivePid: number; effectivePidErrno: number; uidErrno: number; gid: number };

export type PeerRecord = {
  sock: string;
  cwd: string;
  startedAt: number;
  name?: string;
  kind?: "interactive" | "bg" | "daemon" | "daemon-worker";
  sessionId?: string;
  jobId?: string;
  parkedJobId?: string;
  spare: boolean;
  status?: "busy" | "shell" | "idle" | "waiting";
  waitingFor?: string;
  pid: number;
  procStart?: string;
  procStartFt?: string;
  pidDomain?: string;
  peerFeatures?: string[];
  updatedAt?: number;
  entrypoint?: string;
};

export type PeerView = {
  address: string;
  pid: number;
  session_id?: string;
  workspace: string;
  name?: string;
  kind?: string;
  status?: string;
  proc_start?: string;
};

export type AcceptedMessage = {
  text: string;
  from?: string;
  msgId?: string;
  fromMode?: PeerMode;
  verifiedPeerPid?: number;
  verifiedPeerStart?: string;
  selfSent: boolean;
};

export type HeldMessage = {
  msgId?: string;
  from?: string;
  text: string;
  cause: HeldCause;
  receivedAt: number;
  origin: { from?: string; verifiedPeerPid?: number; verifiedPeerStart?: string; selfSent: boolean; msgId?: string; fromMode?: PeerMode };
};

export type SendStatus = { status: PeerReceiptStatus; reason?: string; at: number };

// ---------------------------------------------------------------------------
// Native connected-peer identity
// ---------------------------------------------------------------------------

let addonLoaded: false | ((fd: number) => AddonPeer) = false;

/**
 * Load the peer-identity addon from the package's own `native/` directory.
 * Returns undefined when the platform has no such lookup or the addon cannot
 * be loaded; callers must treat that as "identity unverifiable", never as
 * "identity matches".
 */
function peerAddon(): ((fd: number) => AddonPeer) | undefined {
  if (addonLoaded !== false) return addonLoaded;
  if (process.platform !== "darwin") { addonLoaded = false; return undefined; }
  const candidates = [
    process.env.LITCODE_PEER_ADDON,
    fileURLToPath(new URL("../native/peer-identity/peer.node", import.meta.url)),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  const require = createRequire(import.meta.url);
  for (const candidate of candidates) {
    try {
      const loaded = require(candidate) as { peer?: unknown };
      if (typeof loaded.peer === "function") {
        addonLoaded = loaded.peer as (fd: number) => AddonPeer;
        return addonLoaded;
      }
    } catch { /* try the next candidate */ }
  }
  addonLoaded = false;
  return undefined;
}

export function peerIdentity(fd: number): PeerInfo | undefined {
  const addon = peerAddon();
  if (!addon || !Number.isInteger(fd) || fd < 0) return undefined;
  try {
    const info = addon(fd);
    if (info.pidErrno !== 0 || !Number.isInteger(info.pid) || info.pid <= 0) return undefined;
    if (info.uidErrno !== 0) return undefined;
    return { pid: info.pid, uid: info.uid, gid: info.gid };
  } catch {
    return undefined;
  }
}

function socketFd(socket: net.Socket): number | undefined {
  const handle = (socket as unknown as { _handle?: { fd?: unknown } })._handle;
  return typeof handle?.fd === "number" ? handle.fd : undefined;
}

// ---------------------------------------------------------------------------
// Process identity
// ---------------------------------------------------------------------------

const startCache = new Map<number, { at: number; promise: Promise<string | undefined>; miss: boolean }>();
const START_HIT_MS = 60_000;
const START_MISS_MS = 5_000;

/** `Ul`/`P` (chunk-3sda67c1.js): `ps -o lstart=` under a stable locale. */
export function processStart(pid: number, options: { skipCache?: boolean } = {}): Promise<string | undefined> {
  const now = Date.now();
  const cached = startCache.get(pid);
  if (!options.skipCache && cached && now - cached.at < (cached.miss ? START_MISS_MS : START_HIT_MS)) return cached.promise;
  const promise = new Promise<string | undefined>(resolve => {
    execFile("ps", ["-o", "lstart=", "-p", String(pid)], {
      timeout: 1000, env: { ...process.env, LC_ALL: "C", TZ: "UTC" }, encoding: "utf8",
    }, (error, stdout) => {
      if (error || typeof stdout !== "string" || !stdout.trim()) { resolve(undefined); return; }
      resolve(stdout.trim());
    });
  });
  const entry = { at: now, promise, miss: false };
  startCache.set(pid, entry);
  void promise.then(value => { if (value === undefined && startCache.get(pid) === entry) entry.miss = true; });
  return promise;
}

/** `Nm` (chunk-3sda67c1.js [2601,2715)): a pid that cannot exist is gone. */
export function processGone(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 1 || pid > 0x7fffffff) return false;
  try { process.kill(pid, 0); return false; } catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH"; }
}

/** `Fy`/`qQ`/`hD`: the birth token field differs on Linux (`procStart`). */
function usesProcStartField(): boolean { return process.platform === "linux"; }
export function recordStart(record: { procStart?: string; procStartFt?: string }): string | undefined {
  return usesProcStartField() ? record.procStart : (record.procStartFt ?? record.procStart);
}
export function birthFields(token: string | undefined): { procStart?: string; procStartFt?: string } {
  if (token === undefined) return {};
  return usesProcStartField() ? { procStart: token } : { procStartFt: token };
}

export function pidDomain(): string { return os.hostname(); }

/** `Ibe`/`J_`: exact token equality, then a fresh lookup. */
export async function pidMatches(pid: number, token: string | undefined): Promise<boolean | undefined> {
  if (token === undefined) return true;
  const current = await processStart(pid, { skipCache: true });
  if (current === undefined) return undefined;
  return current === token;
}

// ---------------------------------------------------------------------------
// Paths and socket address
// ---------------------------------------------------------------------------

export function sessionsDir(userDir: string): string { return path.join(userDir, "sessions"); }

/** `XA`/`Z` (chunk-m7864yc0.js): a canonical absolute socket path. */
export function canonicalSocket(sock: string): string | undefined {
  if (!isLocalSocketPath(sock)) return undefined;
  return path.resolve(sock);
}

export function isLocalSocketPath(sock: string): boolean {
  if (typeof sock !== "string" || sock.length === 0 || sock.includes("\0")) return false;
  if (sock.startsWith("\\\\") || /^[A-Za-z]:\\/.test(sock)) return false;
  return path.isAbsolute(sock);
}

/** `V` (chunk-m7864yc0.js): `<pid>.<sha256(canonical socket)>.key`. */
export function socketKeyName(pid: number, sock: string): string {
  const canonical = canonicalSocket(sock);
  if (canonical === undefined) throw new Error("refusing to derive a messaging key name for a non-canonical socket path");
  return `${pid}.${crypto.createHash("sha256").update(canonical).digest("hex")}.key`;
}

export function peerAddress(sock: string): string { return `uds:${path.resolve(sock)}`; }
export function addressPath(address: string): string | undefined {
  if (!address.startsWith("uds:")) return undefined;
  return canonicalSocket(address.slice(4));
}

function defaultSocketPath(userDir: string, label: string): string {
  const base = process.env.XDG_RUNTIME_DIR && path.isAbsolute(process.env.XDG_RUNTIME_DIR)
    ? process.env.XDG_RUNTIME_DIR : os.tmpdir();
  // One path per (pid, user directory, label): two inboxes in one process
  // still own distinct sockets, keys and records.
  const identity = crypto.createHash("sha256").update(`${path.resolve(userDir)}\0${label}`).digest("hex").slice(0, 8);
  const preferred = path.join(base, "litcode-socks", `${process.pid}-${identity}.sock`);
  if (Buffer.byteLength(preferred) <= SOCKET_PATH_MAX) return preferred;
  const uid = typeof process.getuid === "function" ? process.getuid() : 0;
  return path.join("/tmp", `litcode-socks-${uid}`, `${process.pid}-${identity}.sock`);
}

/** `Re` (chunk-bt8cr7rw.js): a private directory owned by us or root. */
async function ensureSocketDirectory(directory: string): Promise<void> {
  if (!path.isAbsolute(directory)) throw new Error("socket directory must be absolute");
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  const refuse = (reason: string): never => { throw new Error(`Refusing the sockets directory ${directory}: ${reason}. Point XDG_RUNTIME_DIR at a private (0700) directory you own, or pass an explicit socket path.`); };
  const inspect = async (target: string): Promise<fs.Stats | undefined> => {
    try { return await fsp.lstat(target); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  };
  let current = directory;
  for (let depth = 0; depth < 16; depth++) {
    const stat = await inspect(current);
    if (stat !== undefined) {
      if (stat.isSymbolicLink()) refuse("a component is a symlink");
      if (!stat.isDirectory()) refuse("a component exists but is not a directory");
      if (uid !== undefined && stat.uid !== uid && stat.uid !== 0) refuse("a component is owned by another user");
      if (current === directory) {
        if ((stat.mode & 0o002) !== 0 && (stat.mode & 0o1000) === 0) refuse("it is world-writable without the sticky bit");
        if ((stat.mode & 0o020) !== 0 && (stat.mode & 0o1000) === 0) refuse("it is group-writable without the sticky bit");
        if ((stat.mode & 0o777) !== SOCKET_DIR_MODE) await fsp.chmod(directory, SOCKET_DIR_MODE);
      }
      break;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  await fsp.mkdir(directory, { recursive: true, mode: SOCKET_DIR_MODE });
  const stat = await fsp.lstat(directory);
  if (!stat.isDirectory()) refuse("it is not a directory");
  if (uid !== undefined && stat.uid !== uid) refuse("it is owned by another user");
  if ((stat.mode & 0o777) !== SOCKET_DIR_MODE) await fsp.chmod(directory, SOCKET_DIR_MODE);
}

// ---------------------------------------------------------------------------
// Discovery records
// ---------------------------------------------------------------------------

type RawRecord = Record<string, unknown>;
const KINDS = new Set(["interactive", "bg", "daemon", "daemon-worker"]);
const STATUSES = new Set(["busy", "shell", "idle", "waiting"]);

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 4_000_000_000_000_000 ? value : undefined;
}

function featuresField(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string" && PEER_FEATURE.test(item)).slice(0, 16);
}

/** `GTs` (chunk-akfkn8xh.js [1155,1624)) plus the record fields `G` keeps. */
function projectRecord(raw: RawRecord, pid: number, file: string): PeerRecord & { file: string } {
  const kind = typeof raw.kind === "string" && KINDS.has(raw.kind) ? raw.kind as PeerRecord["kind"] : undefined;
  const status = typeof raw.status === "string" && STATUSES.has(raw.status) ? raw.status as PeerRecord["status"] : undefined;
  return {
    sock: typeof raw.messagingSocketPath === "string" ? raw.messagingSocketPath : "",
    cwd: typeof raw.cwd === "string" ? raw.cwd : "?",
    startedAt: numberField(raw.startedAt) ?? 0,
    ...(typeof raw.name === "string" ? { name: raw.name } : {}),
    ...(kind === undefined ? {} : { kind }),
    ...(typeof raw.sessionId === "string" ? { sessionId: raw.sessionId } : {}),
    ...(typeof raw.jobId === "string" ? { jobId: raw.jobId } : {}),
    ...(typeof raw.parkedJobId === "string" ? { parkedJobId: raw.parkedJobId } : {}),
    spare: raw.spare === true,
    ...(status === undefined ? {} : { status }),
    ...(typeof raw.waitingFor === "string" ? { waitingFor: raw.waitingFor } : {}),
    ...(typeof raw.entrypoint === "string" ? { entrypoint: raw.entrypoint } : {}),
    ...(typeof raw.procStart === "string" ? { procStart: raw.procStart } : {}),
    ...(typeof raw.procStartFt === "string" ? { procStartFt: raw.procStartFt } : {}),
    ...(typeof raw.pidDomain === "string" ? { pidDomain: raw.pidDomain } : {}),
    ...(featuresField(raw.peerFeatures) === undefined ? {} : { peerFeatures: featuresField(raw.peerFeatures) }),
    ...(numberField(raw.updatedAt) === undefined ? {} : { updatedAt: numberField(raw.updatedAt) }),
    pid,
    file,
  };
}

async function readRecordFile(dir: string, name: string, options: { rejectTornLiveRecord?: boolean; reread?: boolean } = {}): Promise<(PeerRecord & { file: string }) | null> {
  const stem = name.replace(/\.json$/, "").replace(/-[0-9a-f]{12}$/, "");
  const pid = Number.parseInt(stem, 10);
  if (!Number.isInteger(pid) || String(pid) !== stem) return null;
  const file = path.join(dir, name);
  let parsed: unknown;
  try {
    const stat = await fsp.stat(file);
    if (stat.size > MAX_RECORD) return null;
    parsed = JSON.parse(await fsp.readFile(file, "utf8"));
  } catch {
    if (options.rejectTornLiveRecord && !processGone(pid)) {
      if (!options.reread) {
        await new Promise(resolve => setTimeout(resolve, TORN_REREAD_MS));
        return readRecordFile(dir, name, { ...options, reread: true });
      }
      // `G`: a live owner whose record is unreadable twice is a torn record,
      // unless the process was born after the file's last write.
      const [mtime, started] = await Promise.all([
        fsp.stat(file).then(stat => stat.mtimeMs, () => undefined),
        processStart(pid).then(value => value === undefined ? null : Date.parse(`${value} UTC`), () => null),
      ]);
      if (mtime !== undefined && started !== null && Number.isFinite(started) && started > mtime + 2000) return null;
      if (started === null && !processGone(pid)) throw Object.assign(new Error("session record is unreadable while its owner is live"), { code: "EBADRECORD" });
    }
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  return projectRecord(parsed as RawRecord, pid, file);
}

/** `F` (chunk-6zdc3jq1.js): numeric JSON records only. */
export async function listRecords(userDir: string, options: { rejectUnreadable?: boolean; rejectTornLiveRecord?: boolean } = {}): Promise<(PeerRecord & { file: string })[]> {
  const dir = sessionsDir(userDir);
  let names: string[];
  try { names = await fsp.readdir(dir); } catch (error) {
    if (options.rejectUnreadable && (error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw Object.assign(new Error("session records directory unreadable"), { code: (error as NodeJS.ErrnoException).code });
    }
    return [];
  }
  const records = await Promise.all(names.filter(name => /^\d+(?:-[0-9a-f]{12})?\.json$/.test(name))
    .map(name => readRecordFile(dir, name, { rejectTornLiveRecord: options.rejectTornLiveRecord })));
  return records.filter((record): record is PeerRecord & { file: string } => record !== null);
}

export async function publishRecord(userDir: string, record: Omit<PeerRecord, "pid" | "spare"> & { pid?: number; spare?: boolean }): Promise<string> {
  const dir = sessionsDir(userDir);
  await fsp.mkdir(dir, { recursive: true, mode: SOCKET_DIR_MODE });
  const pid = record.pid ?? process.pid;
  // Records are per pid and socket: two inboxes in one process must not
  // overwrite each other (`F` enumerates `<pid>.json`, one owner per pid).
  const target = record.sock === ""
    ? path.join(dir, `${pid}.json`)
    : path.join(dir, `${pid}-${crypto.createHash("sha256").update(path.resolve(record.sock)).digest("hex").slice(0, 12)}.json`);
  const body = {
    cwd: record.cwd, startedAt: record.startedAt, kind: record.kind, sessionId: record.sessionId,
    status: record.status, entrypoint: record.entrypoint, name: record.name, spare: record.spare === true,
    jobId: record.jobId, parkedJobId: record.parkedJobId, waitingFor: record.waitingFor,
    messagingSocketPath: record.sock, updatedAt: Date.now(), pidDomain: record.pidDomain ?? pidDomain(),
    ...birthFields(recordStart(record)), ...(record.peerFeatures === undefined ? {} : { peerFeatures: record.peerFeatures }),
  };
  atomicWriteFile(target, `${JSON.stringify(body)}\n`, { mode: RECORD_MODE, label: "session record" });
  return target;
}

/** Remove only the records this inbox published. */
export async function removeRecordFiles(files: readonly string[]): Promise<void> {
  await Promise.all(files.map(file => fsp.unlink(file).catch(() => {})));
}

export async function removeRecord(userDir: string, pid = process.pid): Promise<void> {
  try { await fsp.unlink(path.join(sessionsDir(userDir), `${pid}.json`)); } catch { /* already gone */ }
}
/** `Z` (chunk-6zdc3jq1.js [21883,22142)): present / gone / recycled. */
export async function pidState(record: PeerRecord, domain: string): Promise<"present" | "gone" | "recycled"> {
  if (record.pidDomain !== undefined && record.pidDomain !== domain) return "present";
  if (processGone(record.pid)) return "gone";
  const token = recordStart(record);
  if (token === undefined) return "present";
  const current = await processStart(record.pid);
  if (current === undefined || current === token) return "present";
  const fresh = await processStart(record.pid, { skipCache: true });
  return fresh === undefined || fresh !== token ? "recycled" : "present";
}

/** `q` (chunk-6zdc3jq1.js): a connect within 250 ms; EBUSY means live. */
export function probeSocket(sock: string): Promise<boolean> {
  return new Promise(resolve => {
    if (!isLocalSocketPath(sock)) { resolve(false); return; }
    const socket = net.connect({ path: sock });
    let settled = false;
    const finish = (value: boolean): void => { if (settled) return; settled = true; socket.destroy(); resolve(value); };
    socket.on("connect", () => finish(true));
    socket.on("error", error => finish((error as NodeJS.ErrnoException).code === "EBUSY"));
    socket.setTimeout(PROBE_TIMEOUT_MS, () => finish(false));
  });
}

/** `ee` (chunk-6zdc3jq1.js [23041,23100)): records that never accept peers. */
export function isParked(record: PeerRecord): boolean { return record.spare || record.parkedJobId !== undefined; }

/** `Sao` (chunk-6zdc3jq1.js [22142,22608)): live, non-parked peers of this user. */
export async function discoverPeers(userDir: string, options: { selfSocket?: string; selfPid?: number; sweep?: boolean; domain?: string } = {}): Promise<PeerRecord[]> {
  const domain = options.domain ?? pidDomain();
  const own = options.selfSocket === undefined ? undefined : canonicalSocket(options.selfSocket);
  const records = (await listRecords(userDir, { rejectUnreadable: true }))
    .filter(record => record.sock !== "" && !isParked(record)
      && (own !== undefined ? canonicalSocket(record.sock) !== own : record.pid !== (options.selfPid ?? process.pid)));
  const [states, live] = await Promise.all([
    Promise.all(records.map(record => pidState(record, domain))),
    Promise.all(records.map(record => probeSocket(record.sock))),
  ]);
  const peers: PeerRecord[] = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index]!;
    if (states[index] === "gone") {
      if (options.sweep && processGone(record.pid)) await fsp.unlink((record as PeerRecord & { file: string }).file).catch(() => {});
      continue;
    }
    if (states[index] === "recycled") continue;
    if (live[index]) peers.push(record);
    else if (options.sweep && (record.pidDomain === undefined || record.pidDomain === domain) && processGone(record.pid)) {
      await fsp.unlink((record as PeerRecord & { file: string }).file).catch(() => {});
    }
  }
  return peers;
}

export function peerView(record: PeerRecord): PeerView {
  return { address: peerAddress(record.sock), pid: record.pid, ...(record.sessionId === undefined ? {} : { session_id: record.sessionId }),
    workspace: record.cwd, ...(record.name === undefined ? {} : { name: record.name }),
    ...(record.kind === undefined ? {} : { kind: record.kind }), ...(record.status === undefined ? {} : { status: record.status }),
    ...(recordStart(record) === undefined ? {} : { proc_start: recordStart(record) }) };
}

// ---------------------------------------------------------------------------
// Auth keys
// ---------------------------------------------------------------------------

export type AuthTokens = { peerToken: string; childToken: string };
export function makeTokens(): AuthTokens {
  return { peerToken: crypto.randomBytes(TOKEN_BYTES).toString("hex"), childToken: crypto.randomBytes(TOKEN_BYTES).toString("hex") };
}
export function authLine(token: string): string { return `${JSON.stringify({ type: AUTH_TYPE, token })}\n`; }
export function isAuthFrame(frame: unknown): frame is { type: "auth"; token: string } {
  return typeof frame === "object" && frame !== null && (frame as { type?: unknown }).type === AUTH_TYPE;
}
export function verifyAuthFrame(frame: { token: string }, tokens: AuthTokens): "peer" | "child" | undefined {
  const equal = (a: string, b: string): boolean => {
    const left = Buffer.from(a), right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  };
  if (equal(frame.token, tokens.peerToken)) return "peer";
  if (equal(frame.token, tokens.childToken)) return "child";
  return undefined;
}

/** `STs` (chunk-m7864yc0.js [5232,5505)): publish under a 0700 directory. */
export async function publishKey(userDir: string, sock: string, token: string): Promise<string> {
  const dir = sessionsDir(userDir);
  await fsp.mkdir(dir, { recursive: true, mode: SOCKET_DIR_MODE });
  await sweepKeyTemps(dir);
  const file = path.join(dir, socketKeyName(process.pid, sock));
  await fsp.unlink(file).catch(() => {});
  atomicWriteFile(file, `${JSON.stringify({ peerToken: token, ...birthFields(await processStart(process.pid)), pidDomain: pidDomain() })}\n`,
    { mode: KEY_MODE, label: "session auth key" });
  await fsp.chmod(file, KEY_MODE);
  return file;
}

/** `we` (chunk-m7864yc0.js [~7933,8227)): remove dead same-domain temp keys. */
async function sweepKeyTemps(dir: string): Promise<void> {
  let names: string[];
  try { names = await fsp.readdir(dir); } catch { return; }
  const domain = pidDomain();
  await Promise.all(names.map(async name => {
    const match = KEY_TEMP.exec(name);
    if (!match) return;
    const pid = Number.parseInt(match[1]!, 10);
    if (processGone(pid)) await fsp.unlink(path.join(dir, name)).catch(() => {});
    else if (domain) { /* live temp owners keep their file */ }
  }));
}

export type KeyLookup = { kind: "token"; token: string } | { kind: "no-key" } | { kind: "dead-owner" } | { kind: "unusable" };

/** `wTs` (chunk-m7864yc0.js [6592,7933)): find the key published for a socket. */
export async function readKey(userDir: string, sock: string, options: { requireLiveOwner?: boolean } = {}): Promise<KeyLookup> {
  const canonical = canonicalSocket(sock);
  if (canonical === undefined) return { kind: "no-key" };
  const hash = crypto.createHash("sha256").update(canonical).digest("hex");
  const suffix = `.${hash}.key`;
  let names: string[];
  try { names = await fsp.readdir(sessionsDir(userDir)); } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT" ? { kind: "no-key" } : { kind: "unusable" };
  }
  const candidates = names.filter(name => name.endsWith(suffix)).flatMap(name => {
    const match = KEY_FILE.exec(name);
    return match ? [{ file: name, pid: Number.parseInt(match[1]!, 10) }] : [];
  });
  if (candidates.length === 0) return { kind: "no-key" };
  const read = async (name: string): Promise<{ peerToken: string; procStart?: string; procStartFt?: string } | undefined> => {
    try {
      const file = path.join(sessionsDir(userDir), name);
      const stat = await fsp.stat(file);
      if (stat.size > KEY_READ_LIMIT) return undefined;
      const parsed = JSON.parse(await fsp.readFile(file, "utf8")) as { peerToken?: unknown; procStart?: unknown; procStartFt?: unknown };
      return typeof parsed.peerToken === "string" && /^[0-9a-f]{32}$/.test(parsed.peerToken)
        ? { peerToken: parsed.peerToken, ...(typeof parsed.procStart === "string" ? { procStart: parsed.procStart } : {}),
            ...(typeof parsed.procStartFt === "string" ? { procStartFt: parsed.procStartFt } : {}) }
        : undefined;
    } catch { return undefined; }
  };
  if (candidates.length === 1) {
    const candidate = candidates[0]!;
    if (options.requireLiveOwner && processGone(candidate.pid)) return { kind: "dead-owner" };
    const key = await read(candidate.file);
    if (key === undefined) return { kind: "unusable" };
    if (options.requireLiveOwner && recordStart(key) !== undefined) {
      const current = await processStart(candidate.pid, { skipCache: true });
      if (current !== undefined && current !== recordStart(key)) return { kind: "dead-owner" };
    }
    return { kind: "token", token: key.peerToken };
  }
  // Multiple live owners for one socket: prefer a live owner whose birth
  // token still matches (`wTs` rank 2 over rank 1 over rank 0).
  let best: { rank: number; token: string } | undefined;
  for (const candidate of candidates) {
    const key = await read(candidate.file);
    if (key === undefined) continue;
    let rank = 0;
    if (processGone(candidate.pid)) {
      const token = recordStart(key);
      const current = token === undefined ? undefined : await processStart(candidate.pid, { skipCache: true });
      rank = token === undefined || current === undefined ? 1 : current === token ? 2 : 0;
    }
    if (best === undefined || rank > best.rank) best = { rank, token: key.peerToken };
  }
  if (best === undefined) return { kind: "unusable" };
  if (options.requireLiveOwner && best.rank === 0) return { kind: "dead-owner" };
  return { kind: "token", token: best.token };
}

export async function removeKey(userDir: string, file: string): Promise<void> {
  try { await fsp.unlink(path.join(sessionsDir(userDir), path.basename(file))); } catch { /* already gone */ }
}

// ---------------------------------------------------------------------------
// Admission policy
// ---------------------------------------------------------------------------

/**
 * `E` (chunk-0ydceggj.js [4491,4991)): explicit policy first, then a
 * self-sent message, then the recipient's current mode. An asserted sender
 * mode must match the recipient's; with no assertion a bypass recipient holds
 * and everyone else accepts.
 */
export function inboundVerdict(input: { explicit?: InboundPolicy; selfSent?: boolean;
  recipient?: { mode: string; bypassAvailable?: boolean } | null; fromMode?: PeerMode }): { policy: InboundPolicy; holdCause?: HeldCause; refuseCause?: "opt-out" } {
  if (input.explicit !== undefined) {
    return input.explicit === "hold" ? { policy: "hold", holdCause: "explicit" } : { policy: input.explicit };
  }
  if (input.selfSent === true) return { policy: "accept" };
  const recipient = input.recipient;
  if (!recipient || !["default", "plan", "acceptEdits", "bypass", "ask", "auto", "dontAsk"].includes(recipient.mode)) {
    return { policy: "hold", holdCause: "mode-unknown" };
  }
  const bypass = recipient.mode === "bypass" || (recipient.mode === "bypassPermissions" && recipient.bypassAvailable === true);
  const recipientMode: PeerMode = bypass ? "bypass" : "prompting";
  if (input.fromMode !== undefined) {
    return input.fromMode === recipientMode ? { policy: "accept" } : { policy: "hold", holdCause: "mode-mismatch" };
  }
  return recipientMode === "bypass" ? { policy: "hold", holdCause: "no-mode-asserted" } : { policy: "accept" };
}

export type HeldResolution = "delivered" | "dropped" | "gone" | "dropped-by-guard";

/** `R`/`A`/`wht` (chunk-0ydceggj.js): bounded FIFO with receipts. */
export class HeldQueue {
  readonly limit: number;
  private readonly entries: HeldMessage[] = [];
  private readonly announced = new Map<HeldMessage, HeldCause>();
  constructor(private readonly callbacks: {
    verdict: (message: HeldMessage) => { policy: InboundPolicy; holdCause?: HeldCause; refuseCause?: "opt-out" };
    deliver: (message: HeldMessage) => boolean;
    receipt?: (message: HeldMessage, status: PeerReceiptStatus, detail?: { reason?: string; droppedMsgIds?: string[] }) => void;
    onHeld?: (message: HeldMessage, count: number, cause: HeldCause) => void;
    onDropped?: (message: HeldMessage, reason: "refused" | "expired" | "dropped") => void;
    onReleased?: (messages: HeldMessage[], cause: string) => void;
  }, options: { limit?: number } = {}) {
    this.limit = options.limit ?? HELD_LIMIT;
  }

  list(): HeldMessage[] { return [...this.entries]; }
  size(): number { return this.entries.length; }
  cause(message: HeldMessage): HeldCause | undefined { return this.announced.get(message); }

  hold(message: HeldMessage): void {
    if (this.entries.length >= this.limit) {
      const evicted = this.entries.shift();
      if (evicted) {
        this.announced.delete(evicted);
        this.callbacks.receipt?.(evicted, "expired");
        this.callbacks.onDropped?.(evicted, "expired");
      }
    }
    this.entries.push(message);
    this.announced.set(message, message.cause);
    this.callbacks.onHeld?.(message, this.entries.length, message.cause);
    this.callbacks.receipt?.(message, "held");
  }

  /** `A`: re-evaluate every held message against the current gate. */
  release(cause: string): number {
    const kept: HeldMessage[] = [];
    const admitted: HeldMessage[] = [];
    const reannounced: [HeldMessage, HeldCause][] = [];
    let refused = 0;
    for (const message of this.entries) {
      const verdict = this.callbacks.verdict(message);
      if (verdict.policy === "accept") admitted.push(message);
      else if (verdict.policy === "refuse") {
        refused++;
        this.callbacks.receipt?.(message, "refused");
        this.callbacks.onDropped?.(message, "refused");
        this.announced.delete(message);
      } else {
        kept.push(message);
        const next = verdict.holdCause ?? "explicit";
        if (this.announced.get(message) !== next) reannounced.push([message, next]);
      }
    }
    this.entries.splice(0, this.entries.length, ...kept);
    for (const [message, next] of reannounced) {
      this.announced.set(message, next);
      this.callbacks.onHeld?.(message, this.entries.length, next);
    }
    const delivered = admitted.filter(message => {
      if (this.callbacks.deliver(message)) return true;
      this.announced.delete(message);
      this.callbacks.onDropped?.(message, "dropped");
      return false;
    });
    if (delivered.length > 0) this.callbacks.onReleased?.(delivered, cause);
    for (const message of delivered) {
      this.announced.delete(message);
      this.callbacks.receipt?.(message, "delivered");
    }
    if (refused > 0) this.callbacks.onReleased?.([], `${cause}:${refused} refused`);
    return admitted.length;
  }

  /** `wht`: approve, deny or expire one held message. */
  resolve(message: HeldMessage, decision: "approve" | "deny" | "expire"): HeldResolution {
    const index = this.entries.indexOf(message);
    if (index === -1) return "gone";
    this.entries.splice(index, 1);
    this.announced.delete(message);
    if (decision !== "approve") {
      this.callbacks.receipt?.(message, decision === "deny" ? "denied" : "expired");
      this.callbacks.onDropped?.(message, decision === "deny" ? "refused" : "expired");
      return "dropped";
    }
    const verdict = this.callbacks.verdict(message);
    if (verdict.policy === "refuse") {
      this.callbacks.receipt?.(message, "refused");
      this.callbacks.onDropped?.(message, "refused");
      return "dropped";
    }
    if (!this.callbacks.deliver(message)) {
      this.callbacks.onDropped?.(message, "dropped");
      return "dropped-by-guard";
    }
    this.callbacks.onReleased?.([message], "approved");
    this.callbacks.receipt?.(message, "delivered");
    return "delivered";
  }

  /** `ZUt`: close expires every still-held message and waits briefly. */
  async expireAll(): Promise<void> {
    if (this.entries.length === 0) return;
    const messages = this.entries.splice(0, this.entries.length);
    this.announced.clear();
    const pending: Promise<void>[] = [];
    for (const message of messages) {
      this.callbacks.receipt?.(message, "expired");
      this.callbacks.onDropped?.(message, "expired");
    }
    await Promise.race([Promise.allSettled(pending), new Promise(resolve => setTimeout(resolve, HELD_SETTLE_MS).unref?.())]);
  }
}

// ---------------------------------------------------------------------------
// Sender
// ---------------------------------------------------------------------------

export class PeerSendRefusal extends Error {
  readonly refusal: "non-local" | "symlink" | "endpoint-unverifiable" | "wrong-endpoint" | "no-live-inbox" | "message-too-large";
  constructor(refusal: PeerSendRefusal["refusal"], message: string) {
    super(message);
    this.name = "PeerSendRefusal";
    this.refusal = refusal;
  }
}

export type PeerFrame = Record<string, unknown> & { type: "user" | "control" };

function boundedLine(frame: PeerFrame): string {
  const text = JSON.stringify(frame);
  if (text.length > MAX_LINE) throw new PeerSendRefusal("message-too-large", `Refusing to send: the serialized message is ${text.length.toLocaleString("en-US")} characters and the limit is ${MAX_LINE.toLocaleString("en-US")}.`);
  return `${text}\n`;
}

/**
 * `we` (chunk-6zdc3jq1.js [15535,17953)): resolve the target key, verify the
 * connected peer before writing, then send the optional auth line and one
 * newline-terminated frame. Credentials are written only after identity
 * verification succeeds.
 */
export async function sendPeerFrame(address: string, frame: PeerFrame, options: {
  userDir: string;
  requireAuth?: boolean;
  expectPeerPid?: number;
  expectPeerProcStart?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<void> {
  const sock = addressPath(address) ?? (isLocalSocketPath(address) ? path.resolve(address) : undefined);
  if (sock === undefined) throw new PeerSendRefusal("non-local", `Refusing to connect: not a usable local IPC path: ${address}`);
  const key = await readKey(options.userDir, sock, { requireLiveOwner: options.requireAuth === true });
  const token = key.kind === "token" ? key.token : undefined;
  if (options.requireAuth === true && token === undefined) {
    throw new PeerSendRefusal("no-live-inbox", `No running session has registered an inbox at ${sock} (${key.kind}); refusing to send to an unvouched socket.`);
  }
  if (token !== undefined && peerIdentity(0) === undefined && process.platform !== "darwin") {
    // On platforms without a peer lookup a token is a bearer credential sent
    // to an unverified endpoint; the source gates that on Windows auth, this
    // host keeps the stricter rule for any platform lacking the lookup.
    throw new PeerSendRefusal("endpoint-unverifiable", "Refusing to send an auth token: connected peer identity cannot be read on this platform.");
  }
  try {
    const stat = await fsp.lstat(sock);
    if (stat.isSymbolicLink()) throw new PeerSendRefusal("symlink", "Refusing to send: reply target is a symlink");
  } catch (error) {
    if (error instanceof PeerSendRefusal) throw error;
    throw new PeerSendRefusal("no-live-inbox", `Refusing to send: ${sock} cannot be inspected (${(error as NodeJS.ErrnoException).code ?? String(error)})`);
  }
  const payload = `${token === undefined ? "" : authLine(token)}${boundedLine(frame)}`;
  const timeoutMs = options.timeoutMs ?? SEND_TIMEOUT_MS;
  await new Promise<void>((resolve, reject) => {
    options.signal?.throwIfAborted();
    const socket = net.connect({ path: sock });
    let settled = false;
    const fail = (error: Error): void => { if (settled) return; settled = true; socket.destroy(); reject(error); };
    const timer = setTimeout(() => fail(new Error(`Timed out sending to ${sock}`)), timeoutMs);
    timer.unref?.();
    const abort = (): void => fail(Object.assign(new Error("Peer send cancelled"), { name: "AbortError" }));
    options.signal?.addEventListener("abort", abort, { once: true });
    socket.on("error", error => { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); fail(error); });
    socket.on("connect", () => {
      const fd = socketFd(socket);
      const info = fd === undefined ? undefined : peerIdentity(fd);
      if (options.expectPeerPid !== undefined) {
        if (info === undefined) { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); fail(new PeerSendRefusal("endpoint-unverifiable", "Refusing to send: connected endpoint identity could not be read")); return; }
        if (info.pid !== options.expectPeerPid) { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); fail(new PeerSendRefusal("wrong-endpoint", "Refusing to send: connected endpoint is not the expected process")); return; }
        const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
        if (uid !== undefined && info.uid !== uid) { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); fail(new PeerSendRefusal("wrong-endpoint", "Refusing to send: connected endpoint is not owned by this user")); return; }
        if (options.expectPeerProcStart !== undefined) {
          // Birth identity is a second lookup, so the write waits for it; the
          // socket stays connected meanwhile and nothing has been written.
          void processStart(info.pid, { skipCache: true }).then(current => {
            if (current !== options.expectPeerProcStart) {
              clearTimeout(timer); options.signal?.removeEventListener("abort", abort);
              fail(new PeerSendRefusal("wrong-endpoint", "Refusing to send: connected endpoint is a different process with the expected pid"));
              return;
            }
            writePayload();
          }, error => { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); fail(error as Error); });
          return;
        }
      }
      writePayload();
    });
    const writePayload = (): void => {
      if (settled) return;
      socket.write(payload, () => {
        if (process.platform === "darwin") setTimeout(() => { if (!socket.destroyed) socket.end(); }, MACOS_LINGER_MS);
        else socket.end();
      });
    };
    socket.on("close", () => { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); if (!settled) { settled = true; resolve(); } });
  });
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export type PeerInboxOptions = {
  userDir: string;
  record: { cwd: string; startedAt: number; kind?: PeerRecord["kind"]; sessionId?: string; name?: string; entrypoint?: string };
  socketPath?: string;
  requireAuth?: boolean;
  firstLineDeadlineMs?: number;
  policy?: () => InboundPolicy | undefined;
  mode?: () => { mode: string; bypassAvailable?: boolean } | null;
  /** `Rwt` (chunk-sfn1dbxq.js [472253,472852)): consume or rewrite before admission. */
  receive?: (frame: { from?: string; text: string; msgId?: string }) => { consume?: true; content?: string } | Promise<{ consume?: true; content?: string }>;
  onAccepted: (message: AcceptedMessage) => void;
  onHeld?: (message: HeldMessage) => void;
  onDropped?: (message: HeldMessage, reason: "refused" | "expired" | "dropped") => void;
  onReceipt?: (status: PeerReceiptStatus, origMsgId?: string, reason?: string) => void;
  onNotice?: (notice: { kind: "listening" | "error" | "held-released"; message: string; address?: string }) => void;
  logger?: (message: string, detail?: { level?: "warn" | "error" }) => void;
};

export type PeerInbox = {
  readonly address: string;
  readonly tokens: AuthTokens;
  held: HeldQueue;
  /** Current peer count and held list. */
  resolveHeld(msgId: string | undefined, decision: "approve" | "deny" | "expire"): Promise<HeldResolution>;
  releaseHeld(cause: string): number;
  setMode(getter: () => { mode: string; bypassAvailable?: boolean } | null): void;
  /** The session a frame may name; frames for another session are ignored. */
  setSessionId(sessionId: string | undefined): void;
  close(): Promise<void>;
};

type InboxState = {
  server?: net.Server;
  socketPath?: string;
  keyFile?: string;
  sessionId?: string;
  tokens?: AuthTokens;
  authRequired: boolean;
  clients: Set<net.Socket>;
  chain: Promise<void>;
  closing?: Promise<void>;
  closed: boolean;
  held?: HeldQueue;
  mode?: () => { mode: string; bypassAvailable?: boolean } | null;
  recordFile?: string;
};

/** `mn`/`nn`/`Je` (chunk-bt8cr7rw.js): bind, publish the key, then advertise. */
export async function startPeerInbox(options: PeerInboxOptions): Promise<PeerInbox> {
  const state: InboxState = { authRequired: options.requireAuth ?? false, clients: new Set(), chain: Promise.resolve(), closed: false, mode: options.mode };
  const logger = options.logger ?? (() => {});
  const socketPath = path.resolve(options.socketPath ?? defaultSocketPath(options.userDir, options.record.sessionId ?? options.record.name ?? ""));
  if (!isLocalSocketPath(socketPath)) throw new Error("Refusing socket path: not a usable local socket address");
  if (Buffer.byteLength(socketPath) > SOCKET_PATH_MAX) throw new Error(`Socket path is too long for a Unix socket (${Buffer.byteLength(socketPath)} bytes, max ${SOCKET_PATH_MAX}): ${socketPath}`);
  await ensureSocketDirectory(path.dirname(socketPath));
  try { await fsp.unlink(socketPath); } catch { /* absent is fine */ }
  const tokens = makeTokens();
  state.tokens = tokens;
  state.socketPath = socketPath;
  const server = net.createServer({ allowHalfOpen: true }, socket => {
    state.clients.add(socket);
    socket.on("close", () => state.clients.delete(socket));
    acceptConnection(socket, state, options, tokens, logger);
  });
  server.on("error", error => logger(`[peer-inbox] server error: ${error.message}`, { level: "error" }));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => { server.removeListener("error", reject); resolve(); });
  });
  state.server = server;
  server.unref();
  await fsp.chmod(socketPath, SOCKET_MODE);
  try {
    state.keyFile = await publishKey(options.userDir, socketPath, tokens.peerToken);
  } catch (error) {
    // `mn`: with auth required, an inbox no peer can authenticate to is closed.
    if (state.authRequired) {
      await stopInbox(state, options, { settleHeld: false });
      throw new Error(`Bound ${socketPath} but could not publish its auth key (${String(error)}); peers could not authenticate, so the inbox was closed.`);
    }
    logger(`[peer-inbox] auth key publication failed; unauthenticated peers remain accepted: ${String(error)}`, { level: "warn" });
  }
  try {
    state.recordFile = await publishRecord(options.userDir, { ...options.record, sock: socketPath, status: "idle",
      peerFeatures: ["peer_status_receipts", "peer_held_queue"] });
  } catch (error) {
    await stopInbox(state, options, { settleHeld: false });
    throw new Error(`Bound ${socketPath} but could not publish its session record (${String(error)}); the inbox was closed.`);
  }
  const held = new HeldQueue({
    verdict: message => inboundVerdict({ explicit: options.policy?.(), selfSent: message.origin.selfSent,
      recipient: state.mode?.() ?? null, fromMode: message.origin.fromMode }),
    deliver: message => { options.onAccepted({ text: message.text, from: message.origin.from, msgId: message.origin.msgId,
      verifiedPeerPid: message.origin.verifiedPeerPid, verifiedPeerStart: message.origin.verifiedPeerStart, selfSent: message.origin.selfSent }); return true; },
    receipt: (message, status, detail) => { void sendReceipt(state, options, message, status, detail, logger); },
    onHeld: message => options.onHeld?.(message),
    onDropped: (message, reason) => options.onDropped?.(message, reason),
    onReleased: (messages, cause) => options.onNotice?.({ kind: "held-released", message: `released ${messages.length} held peer message(s) (${cause})` }),
  }, { limit: HELD_LIMIT });
  state.held = held;
  options.onNotice?.({ kind: "listening", message: "listening", address: peerAddress(socketPath) });
  const inbox: PeerInbox = {
    address: peerAddress(socketPath), tokens, held,
    async resolveHeld(msgId, decision) {
      const message = held.list().find(item => item.origin.msgId === msgId);
      if (!message) return "gone";
      return held.resolve(message, decision);
    },
    releaseHeld(cause) { return held.release(cause); },
    setMode(getter) { state.mode = getter; },
    setSessionId(next) { state.sessionId = next; },
    close() { return stopInbox(state, options, { settleHeld: true }); },
  };
  return inbox;
}

/** `nn` (chunk-bt8cr7rw.js [12376,14664)): one line at a time, auth first. */
function acceptConnection(socket: net.Socket, state: InboxState, options: PeerInboxOptions, tokens: AuthTokens,
  logger: (message: string, detail?: { level?: "warn" | "error" }) => void): void {
  socket.setEncoding("utf8");
  const deadlineMs = options.firstLineDeadlineMs ?? FIRST_LINE_MS;
  const deadline = setTimeout(() => { logger(`[peer-inbox] closing a connection that sent no complete line within ${deadlineMs} ms`, { level: "warn" }); socket.destroy(); }, deadlineMs);
  deadline.unref?.();
  const clearDeadline = (): void => { clearTimeout(deadline); };
  socket.once("close", clearDeadline);
  socket.once("error", clearDeadline);
  let buffer = "";
  let peer: PeerInfo | undefined;
  let peerStart: string | undefined;
  let identityRead = false;
  let authed: "peer" | "child" | undefined;
  let sawFrame = false;
  const drop = (what: string): void => {
    logger(`[peer-inbox] dropped ${what} from a connection that did not authenticate; closing it`, { level: "warn" });
    socket.destroy();
  };
  const ensureIdentity = (): void => {
    if (identityRead) return;
    identityRead = true;
    const fd = socketFd(socket);
    peer = fd === undefined ? undefined : peerIdentity(fd);
  };
  const handle = (frame: unknown): void => {
    const first = !sawFrame;
    sawFrame = true;
    ensureIdentity();
    if (isAuthFrame(frame)) {
      if (first) {
        authed = verifyAuthFrame(frame, tokens);
        if (authed === undefined && state.authRequired) drop("a bad auth frame");
      }
      return;
    }
    if (state.authRequired && authed === undefined) { drop("an unauthenticated frame"); return; }
    if (typeof frame !== "object" || frame === null || Array.isArray(frame)) return;
    const typed = frame as { type?: unknown; session_id?: unknown };
    if (typed.type !== "user" && typed.type !== "control") return;
    if (typeof typed.session_id === "string" && state.sessionId !== undefined && typed.session_id !== state.sessionId) return;
    state.chain = state.chain.then(() => dispatch(frame as PeerFrame, { peer, peerStart, authed, first }))
      .catch(error => logger(`[peer-inbox] failed to process a frame: ${String(error)}`, { level: "warn" }));
  };
  socket.on("data", chunk => {
    buffer += chunk;
    if (buffer.length > MAX_LINE) { logger(`[peer-inbox] line exceeded ${MAX_LINE} characters; dropping connection`, { level: "warn" }); socket.destroy(); buffer = ""; return; }
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      clearDeadline();
      if (!line.trim()) { if (state.authRequired && authed === undefined) { drop("a blank line"); buffer = ""; return; } continue; }
      let frame: unknown;
      try { frame = JSON.parse(line); } catch {
        if (state.authRequired && authed === undefined) { drop("an unparseable line"); buffer = ""; return; }
        continue;
      }
      handle(frame);
      if (socket.destroyed) { buffer = ""; return; }
    }
  });
  socket.on("end", () => {
    if (buffer.trim() && !socket.destroyed) {
      try { handle(JSON.parse(buffer)); } catch { if (state.authRequired && authed === undefined) drop("an unparseable final fragment"); }
    }
    socket.end();
  });
  socket.on("error", error => logger(`[peer-inbox] connection error: ${error.message}`, { level: "warn" }));

  async function dispatch(frame: PeerFrame, context: { peer?: PeerInfo; peerStart?: string; authed?: "peer" | "child"; first: boolean }): Promise<void> {
    if (frame.type === "control") {
      const control = frame as { action?: unknown; status?: unknown; orig_msg_id?: unknown; reason?: unknown };
      if (control.action === "peer_message_status" && typeof control.status === "string") {
        options.onReceipt?.(control.status as PeerReceiptStatus,
          typeof control.orig_msg_id === "string" ? control.orig_msg_id : undefined,
          typeof control.reason === "string" ? control.reason : undefined);
      }
      return;
    }
    const message = (frame as { message?: { content?: unknown } }).message;
    const content = message?.content;
    if (typeof content !== "string" || content.length === 0) { logger("[peer-inbox] ignoring a user frame with missing or non-string content", { level: "warn" }); return; }
    const from = typeof frame.from === "string" ? frame.from : undefined;
    const msgId = typeof frame.msg_id === "string" ? frame.msg_id : undefined;
    const fromMode = frame.from_mode === "bypass" || frame.from_mode === "prompting" ? frame.from_mode : undefined;
    const selfSent = from !== undefined && from === peerAddress(state.socketPath!);
    const verifiedPeerStart = context.peer === undefined ? undefined : await processStart(context.peer.pid);
    const rewritten = await options.receive?.({ from, text: content, msgId });
    if (rewritten?.consume) return;
    const text = typeof rewritten?.content === "string" ? rewritten.content : content;
    const verdict = inboundVerdict({ explicit: options.policy?.(), selfSent,
      recipient: state.mode?.() ?? null, fromMode });
    if (verdict.policy === "accept") {
      options.onAccepted({ text, from, msgId, fromMode, verifiedPeerPid: context.peer?.pid, verifiedPeerStart, selfSent });
      return;
    }
    const message2: HeldMessage = { msgId, from, text, cause: verdict.holdCause ?? "explicit", receivedAt: Date.now(),
      origin: { from, verifiedPeerPid: context.peer?.pid, verifiedPeerStart, selfSent, msgId, fromMode } };
    if (verdict.policy === "refuse") {
      void sendReceipt(state, options, message2, "refused", undefined, logger);
      options.onDropped?.(message2, "refused");
      return;
    }
    if (state.closed) {
      void sendReceipt(state, options, message2, "expired", undefined, logger);
      options.onDropped?.(message2, "expired");
      return;
    }
    state.held!.hold(message2);
  }
}

async function sendReceipt(state: InboxState, options: PeerInboxOptions, message: HeldMessage, status: PeerReceiptStatus,
  detail: { reason?: string; droppedMsgIds?: string[] } | undefined,
  logger: (message: string, detail?: { level?: "warn" | "error" }) => void): Promise<void> {
  const address = message.origin.from;
  if (address === undefined || !address.startsWith("uds:") || state.socketPath === undefined) return;
  if (address === peerAddress(state.socketPath)) return;
  // The receipt names the sender's original message so the sender can match
  // it; `orig_msg_id` is the id that sender minted.
  const frame: PeerFrame = { type: "control", action: "peer_message_status", status, from: peerAddress(state.socketPath),
    reason: detail?.reason ?? RECEIPT_TEXT[status], ...(message.msgId === undefined ? {} : { orig_msg_id: message.msgId }),
    ...(detail?.droppedMsgIds === undefined ? {} : { dropped_msg_ids: detail.droppedMsgIds }) };
  try {
    await sendPeerFrame(address, frame, { userDir: options.userDir,
      expectPeerPid: message.origin.verifiedPeerPid, expectPeerProcStart: message.origin.verifiedPeerStart });
  } catch (error) {
    logger(`[peer-inbox] receipt send failed: ${(error as Error).message}`, { level: "warn" });
  }
}

/** `j`/`Y` (chunk-bt8cr7rw.js [15004,15599)): owned teardown only. */
async function stopInbox(state: InboxState, options: PeerInboxOptions, flags: { settleHeld: boolean }): Promise<void> {
  if (state.closing) return state.closing;
  state.closed = true;
  state.closing = (async () => {
    for (const client of state.clients) client.destroy();
    state.clients.clear();
    if (state.server) await new Promise<void>(resolve => state.server!.close(() => resolve()));
    if (flags.settleHeld) await state.held?.expireAll();
    await Promise.race([state.chain, new Promise(resolve => setTimeout(resolve, HELD_SETTLE_MS).unref?.())]);
    if (state.socketPath !== undefined) await fsp.unlink(state.socketPath).catch(() => {});
    if (state.keyFile !== undefined) await removeKey(options.userDir, state.keyFile);
    if (state.recordFile !== undefined) await removeRecordFiles([state.recordFile]);
  })();
  return state.closing;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export type PeerTransportEvent =
  | { kind: "message"; message: AcceptedMessage }
  | { kind: "held"; message: HeldMessage; count: number }
  | { kind: "dropped"; message: HeldMessage; reason: "refused" | "expired" | "dropped" }
  | { kind: "receipt"; status: PeerReceiptStatus; origMsgId?: string; reason?: string }
  | { kind: "listening"; address: string }
  | { kind: "error"; message: string };

export type LocalPeerTransportOptions = {
  userDir: string;
  workspace: string;
  kind?: PeerRecord["kind"];
  name?: string;
  entrypoint?: string;
  requireAuth?: boolean;
  socketPath?: string;
  policy?: () => InboundPolicy | undefined;
  mode?: () => { mode: string; bypassAvailable?: boolean } | null;
  receive?: PeerInboxOptions["receive"];
  onEvent: (event: PeerTransportEvent) => void;
  logger?: PeerInboxOptions["logger"];
};

export type LocalPeerTransport = {
  readonly address: string;
  list(): Promise<PeerView[]>;
  send(address: string, text: string, options?: { signal?: AbortSignal; expectPeerPid?: number; expectPeerProcStart?: string }): Promise<{ msgId: string }>;
  held(): HeldMessage[];
  resolveHeld(msgId: string | undefined, decision: "approve" | "deny" | "expire"): Promise<HeldResolution>;
  releaseHeld(cause: string): number;
  status(msgId: string): SendStatus | undefined;
  waitStatus(msgId: string, waitMs: number, signal?: AbortSignal): Promise<SendStatus | undefined>;
  setSession(sessionId: string | undefined): Promise<void>;
  setMode(getter: () => { mode: string; bypassAvailable?: boolean } | null): void;
  close(): Promise<void>;
};

const STATUS_TTL_MS = 10 * 60_000;
const STATUS_LIMIT = 256;

export async function createLocalPeerTransport(options: LocalPeerTransportOptions): Promise<LocalPeerTransport> {
  const statuses = new Map<string, SendStatus>();
  const waiters = new Map<string, Set<(status: SendStatus) => void>>();
  let sessionId: string | undefined;
  const emit = (event: PeerTransportEvent): void => { try { options.onEvent(event); } catch { /* observers own their errors */ } };
  const remember = (msgId: string, status: SendStatus): void => {
    statuses.delete(msgId);
    statuses.set(msgId, status);
    while (statuses.size > STATUS_LIMIT) { const oldest = statuses.keys().next().value; if (oldest === undefined) break; statuses.delete(oldest); }
    // Waiters stay registered across an intermediate `held` receipt and remove
    // themselves once they settle, so a later terminal status still reaches them.
    for (const waiter of waiters.get(msgId) ?? []) { try { waiter(status); } catch { /* observer */ } }
  };
  const inbox = await startPeerInbox({
    userDir: options.userDir,
    record: { cwd: options.workspace, startedAt: Date.now(), kind: options.kind ?? "interactive", name: options.name ?? `peer-${crypto.randomUUID().slice(0, 8)}`, entrypoint: options.entrypoint },
    ...(options.socketPath === undefined ? {} : { socketPath: options.socketPath }),
    ...(options.requireAuth === undefined ? {} : { requireAuth: options.requireAuth }),
    ...(options.policy === undefined ? {} : { policy: options.policy }),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.receive === undefined ? {} : { receive: options.receive }),
    onAccepted: message => emit({ kind: "message", message }),
    onHeld: message => emit({ kind: "held", message, count: inbox.held.size() }),
    onDropped: (message, reason) => emit({ kind: "dropped", message, reason }),
    onReceipt: (status, origMsgId, reason) => {
      if (origMsgId !== undefined) remember(origMsgId, { status, ...(reason === undefined ? {} : { reason }), at: Date.now() });
      emit({ kind: "receipt", status, origMsgId, reason });
    },
    onNotice: notice => {
      if (notice.kind === "listening" && notice.address !== undefined) emit({ kind: "listening", address: notice.address });
      else if (notice.kind === "error") emit({ kind: "error", message: notice.message });
      else emit({ kind: "held", message: { msgId: undefined, text: notice.message, cause: "explicit", receivedAt: Date.now(), origin: { selfSent: false } }, count: inbox.held.size() });
    },
    ...(options.logger === undefined ? {} : { logger: options.logger }),
  });
  const transport: LocalPeerTransport = {
    address: inbox.address,
    async list() {
      const records = await discoverPeers(options.userDir, { selfSocket: inbox.address.slice(4), sweep: true });
      return records.map(peerView);
    },
    async send(address, text, sendOptions = {}) {
      if (typeof text !== "string" || text.length === 0) throw new Error("Peer message text must be a non-empty string");
      if (text.length > MAX_MESSAGE) throw new PeerSendRefusal("message-too-large", `Peer message exceeds the ${MAX_MESSAGE} character line cap.`);
      const target = addressPath(address);
      if (target === undefined) throw new PeerSendRefusal("non-local", "Peer address must be a local uds: path");
      const record = (await listRecords(options.userDir)).find(item => item.sock !== "" && canonicalSocket(item.sock) === target);
      const expectPeerPid = sendOptions.expectPeerPid ?? record?.pid;
      const expectPeerProcStart = sendOptions.expectPeerProcStart ?? (record === undefined ? undefined : recordStart(record));
      const msgId = crypto.randomUUID();
      const ownMode: PeerMode = options.mode?.()?.mode === "bypass" ? "bypass" : "prompting";
      // `K8t` (chunk-6zdc3jq1.js) sends no `session_id`; the field names the
      // recipient's own session in `Ie` (chunk-bt8cr7rw.js [4978,5232)) and a
      // foreign id is dropped as a mismatch.
      const frame: PeerFrame = { type: "user", message: { role: "user", content: text }, from: inbox.address,
        msg_id: msgId, from_mode: ownMode, priority: "next" };
      await sendPeerFrame(address, frame, { userDir: options.userDir, expectPeerPid, expectPeerProcStart,
        ...(sendOptions.signal === undefined ? {} : { signal: sendOptions.signal }) });
      return { msgId };
    },
    held() { return inbox.held.list(); },
    resolveHeld(msgId, decision) { return inbox.resolveHeld(msgId, decision); },
    releaseHeld(cause) { return inbox.releaseHeld(cause); },
    status(msgId) { return statuses.get(msgId); },
    async waitStatus(msgId, waitMs, signal) {
      const existing = statuses.get(msgId);
      // `held` is the one intermediate receipt: the recipient later reports
      // `delivered`, `denied`, `expired`, `refused` or `dropped` against the
      // same `orig_msg_id` (chunk-bt8cr7rw.js). A caller that asked to wait
      // wants that verdict, so a recorded `held` leaves the wait open and the
      // intermediate status is what a timeout resolves with.
      if (waitMs <= 0 || (existing !== undefined && existing.status !== "held")) return existing;
      return new Promise(resolve => {
        const listeners = waiters.get(msgId) ?? new Set();
        waiters.set(msgId, listeners);
        let settled = false;
        let latest = existing;
        const finish = (status: SendStatus | undefined): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          listeners.delete(onStatus);
          if (listeners.size === 0) waiters.delete(msgId);
          resolve(status);
        };
        const onStatus = (status: SendStatus): void => { latest = status; if (status.status !== "held") finish(status); };
        const timer = setTimeout(() => finish(latest), waitMs);
        timer.unref?.();
        const abort = (): void => finish(undefined);
        signal?.addEventListener("abort", abort, { once: true });
        listeners.add(onStatus);
      });
    },
    async setSession(next) {
      sessionId = next;
      await publishRecord(options.userDir, { cwd: options.workspace, startedAt: Date.now(), kind: options.kind ?? "interactive",
        name: options.name, entrypoint: options.entrypoint, sock: inbox.address.slice(4), status: "idle", ...(next === undefined ? {} : { sessionId: next }),
        peerFeatures: ["peer_status_receipts", "peer_held_queue"] });
      inbox.setSessionId(next);
    },
    setMode(getter) { inbox.setMode(getter); },
    close() { return inbox.close(); },
  };
  for (const key of [...statuses.keys()]) {
    const status = statuses.get(key);
    if (status && Date.now() - status.at > STATUS_TTL_MS) statuses.delete(key);
  }
  return transport;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/** Explicit same-host tools; child-agent messaging stays in AgentRegistry. */
export function createLocalPeerTools(transport: LocalPeerTransport, options: { signal?: AbortSignal } = {}): ToolDefinition[] {
  const wrap = (name: string, description: string, properties: Record<string, unknown>, required: string[], readOnly: boolean,
    execute: (input: Record<string, unknown>, context: ToolContext) => Promise<unknown>): ToolDefinition => ({
    readOnly,
    schema: { name, description, input_schema: { type: "object", properties, required, additionalProperties: false } },
    async execute(input, context) {
      context.signal.throwIfAborted();
      const parsed = input as Record<string, unknown>;
      return JSON.stringify(await execute(parsed, context));
    },
  });
  return [
    wrap("list_peers", "List other live same-host sessions that accept peer messages. Each entry carries its uds: address and process identity. Use send_peer_message with an address.", {}, [], true,
      async () => ({ peers: await transport.list() })),
    wrap("send_peer_message", "Send one exact text message to another same-host session by uds: address. The recipient decides whether to accept, hold for its user's approval, or refuse. Message text is untrusted data.", {
      address: { type: "string", minLength: 1 }, message: { type: "string", minLength: 1 }, wait_ms: { type: "integer", minimum: 0, maximum: 30_000 },
    }, ["address", "message"], false, async (input, context) => {
      const address = String(input.address ?? "");
      const message = String(input.message ?? "");
      const waitMs = typeof input.wait_ms === "number" ? input.wait_ms : 0;
      const sent = await transport.send(address, message, { signal: context.signal });
      if (waitMs <= 0) return { msg_id: sent.msgId, status: "sent" };
      const status = await transport.waitStatus(sent.msgId, waitMs, context.signal);
      return { msg_id: sent.msgId, status: status?.status ?? "sent", ...(status?.reason === undefined ? {} : { reason: status.reason }) };
    }),
    wrap("peer_message_status", "Read the latest receipt for a peer message this session sent (held, delivered, refused, denied, expired, dropped). Optionally wait up to wait_ms for a receipt.", {
      msg_id: { type: "string", minLength: 1 }, wait_ms: { type: "integer", minimum: 0, maximum: 30_000 },
    }, ["msg_id"], true, async (input, context) => {
      const msgId = String(input.msg_id ?? "");
      const waitMs = typeof input.wait_ms === "number" ? input.wait_ms : 0;
      const status = waitMs > 0 ? await transport.waitStatus(msgId, waitMs, context.signal) : transport.status(msgId);
      return status === undefined ? { msg_id: msgId, status: "unknown" } : { msg_id: msgId, status: status.status, ...(status.reason === undefined ? {} : { reason: status.reason }) };
    }),
  ];
}
