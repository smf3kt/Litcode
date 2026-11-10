import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { types as utilTypes } from 'node:util';
import fs from 'node:fs';
import { observePermissionPath } from './path-permission-observation.js';
import { AsyncReadPermissionCheck, prototypePermissionDecision, type PermissionPolicy, type SessionPermissionUpdates } from './permissions.js';
import { isBuiltinReadFile, type ToolDefinition } from './tools.js';
import { Be, j8e } from './path-approval-stash-source.js';
import type { PathPermissionObservation } from './path-permission-observation.js';
import { verifiedPrototypeRead } from './permissions.js';
import { createPathIdentity } from './path-approval-identity-source.js';
import { createPathApprovalBinding } from './path-approval-binding-source.js';
import { createPathOpenCapability, createPathOpenPrimitives } from './path-open-primitives-source.js';
import { lwe } from './path-approval-decoder-source.js';
import { readControlledHandleLines, readControlledHandleLinesResult } from './controlled-handle-lines.js';

type Lane = 'read' | 'write';
type Identity = { dev: bigint; ino: bigint };
type Snapshot =
  | { kind: 'saved'; paths: string[]; identity: Identity | null | undefined }
  | { kind: 'expired' };
type FinishReason = 'success' | 'denied' | 'cancelled' | 'error';

type TrustedReadSnapshot = { requested: string; paths: string[]; identity: Identity; workspace: string };

// Read checkPermissions, chunk-sfn1dbxq.js [3542972,3543340), UTF-16,
// module sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da.
// Host adaptation: bracket the synchronous decision with filesystem identity checks.
export class TrustedReadContract {
  #state: 'fresh' | 'pending' | 'ready' | 'consumed' = 'fresh';
  #snapshot: TrustedReadSnapshot | undefined;
  #signal: AbortSignal | undefined;
  #policy: (() => PermissionPolicy | undefined) | undefined;

  private allowed(snapshot: TrustedReadSnapshot): boolean {
    if (!this.#policy || !isBuiltinReadFile(this.tool)) return false;
    const result = prototypePermissionDecision(this.#policy(), this.tool, { path: snapshot.requested }, undefined, snapshot.workspace);
    const observation = result.kind === 'observed' ? result.observations[0] : undefined;
    return result.kind === 'observed' && result.decision.decision === 'allow' && result.observations.length === 1 &&
      observation !== undefined && !observation.unresolved && observation.requested === snapshot.requested &&
      JSON.stringify(observation.spellings) === JSON.stringify(snapshot.paths);
  }

  constructor(private readonly call: PathApprovalCall, private readonly tool: ToolDefinition) {}

  async observe(policy: PermissionPolicy | undefined | (() => PermissionPolicy | undefined), input: { path: string }, workspace: string,
    signal?: AbortSignal): Promise<boolean> {
    if (this.#state !== 'fresh') return false;
    this.#state = 'pending';
    this.#signal = signal;
    this.#policy = typeof policy === 'function' ? policy : () => policy;
    try {
      if (signal?.aborted || !this.call.isActive || !isBuiltinReadFile(this.tool)) return false;
      if (typeof input !== 'object' || input === null || utilTypes.isProxy(input) || Array.isArray(input)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(input, 'path');
      if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string' || descriptor.value.length === 0) return false;
      const requested = path.resolve(workspace, descriptor.value).normalize('NFC');
      const before = observePermissionPath(workspace, requested);
      if (before.unresolved) return false;
      const first = await fs.promises.stat(before.landing, { bigint: true });
      if (signal?.aborted || !this.call.isActive || !isBuiltinReadFile(this.tool) || !first.isFile()) return false;
      const result = prototypePermissionDecision(this.#policy(), this.tool, { path: requested }, undefined, workspace);
      if (result.kind !== 'observed' || result.decision.decision !== 'allow' || result.observations.length !== 1) return false;
      const observed = result.observations[0];
      if (!observed || observed.unresolved || observed.requested !== requested ||
          JSON.stringify(observed.spellings) !== JSON.stringify(before.spellings) || observed.landing !== before.landing) return false;
      const second = await fs.promises.stat(before.landing, { bigint: true });
      const after = observePermissionPath(workspace, requested);
      if (signal?.aborted || !this.call.isActive || !isBuiltinReadFile(this.tool) || !second.isFile() || first.dev !== second.dev || first.ino !== second.ino ||
          after.unresolved || after.landing !== before.landing || JSON.stringify(after.spellings) !== JSON.stringify(before.spellings)) return false;
      this.#snapshot = { requested, paths: [...before.spellings], identity: { dev: first.dev, ino: first.ino }, workspace: path.resolve(workspace) };
      this.#state = 'ready';
      return true;
    } catch { return false; }
    finally { if (this.#state === 'pending') this.#state = 'consumed'; }
  }

  async open(call: PathApprovalCall, tool: ToolDefinition) {
    if (arguments.length !== 2) throw new Error('Trusted read opener is internal');
    const snapshot = this.take(call, tool);
    if (!snapshot) throw new Error('Trusted read expired');
    if (!this.allowed(snapshot)) throw new Error('Trusted read policy changed');
    const opened = await openReadSnapshot(snapshot, this.#signal);
    try {
      const stat = await opened.handle.stat({ bigint: true });
      if (!this.allowed(snapshot) || !call.isActive || this.#signal?.aborted || !isBuiltinReadFile(tool) || !stat.isFile() ||
          stat.dev !== snapshot.identity.dev || stat.ino !== snapshot.identity.ino) {
        throw new Error('Trusted read identity changed');
      }
      return opened;
    } catch (error) {
      await opened.close().catch(() => {});
      throw error;
    }
  }

  take(call: PathApprovalCall, tool: ToolDefinition): TrustedReadSnapshot | undefined {
    if (this.#state !== 'ready') return undefined;
    this.#state = 'consumed';
    const snapshot = this.#snapshot;
    this.#snapshot = undefined;
    if (call !== this.call || tool !== this.tool || !isBuiltinReadFile(tool) || !call.isActive || this.#signal?.aborted) return undefined;
    return snapshot;
  }
}

async function openReadSnapshot(snapshot: TrustedReadSnapshot, signal?: AbortSignal) {
    const platform = process.platform === 'darwin' ? 'macos' : process.platform === 'linux' ? 'linux' : undefined;
    if (!platform) throw new Error('Trusted read platform unavailable');
    const api = {
      cwd: () => snapshot.workspace, lstatSync: fs.lstatSync, readlinkSync: fs.readlinkSync,
      realpathSync: (file: string) => fs.realpathSync(file).normalize('NFC'),
      openDirNoFollowSync(file: string) {
        const fd = fs.openSync(file, fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        fs.closeSync(fd);
      },
      async mkdir(file: string) { await fs.promises.mkdir(file, { recursive: true }); },
    };
    const identity = createPathIdentity({ ie: () => api, qpt: () => null });
    const ai = 16777216, zut = 536870912;
    const state = { noFollowAny: 'untried' };
    const capability = createPathOpenCapability({ X: fs.promises.open, m: fs.constants, ai, zut, f: state,
      E: (error: unknown) => error instanceof Error && 'code' in error ? error.code : undefined });
    const opening = createPathOpenPrimitives({ Pe: fs.promises.open, T: fs.constants, ai, zut, wGn: capability.wGn });
    const binding = createPathApprovalBinding({ ie: () => api, ...identity, O: () => platform, ...opening, ai, zut, lwe, t: () => {} });
    // eMt, chunk-bf3z2ftn.js [12246,14898), UTF-16; module SHA-256 1c4ed6b761e5ced6000d4a7c4c43b970eb1d35c37015a35c3ac825b5739478b3.
    // Host uses the strict fallback for its incomplete policy mapping.
    return binding.eMt(snapshot.requested, snapshot.paths, signal, snapshot.identity, 'refused');
}
// Host lifecycle adaptation of Read checkPermissions/GIr/bhn, chunk-sfn1dbxq.js
// SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [3542972,3543340), [3546500,3549105), [3551998,3552396).
// The source stash is evidence; this owner rechecks live host policy before handing off a handle.
export class AsyncReadHandleConsumer {
  #checker = new AsyncReadPermissionCheck();
  #lane: object;
  #state: 'active' | 'opening' | 'ended' = 'active';
  #requested: string | undefined;
  #retire = () => this.finish();

  constructor(private readonly call: PathApprovalCall, private readonly tool: ToolDefinition,
    private readonly workspace: string, private readonly signal: AbortSignal,
    private readonly policy: () => PermissionPolicy | undefined,
    private readonly session: () => SessionPermissionUpdates | undefined) {
    this.#lane = this.#checker.begin(call.providerId);
    EventTarget.prototype.addEventListener.call(signal, 'abort', this.#retire, { once: true });
    if (signal.aborted || !call.isActive || !isBuiltinReadFile(tool)) this.finish();
  }

  finish(): void {
    if (this.#state === 'ended') return;
    this.#state = 'ended';
    this.#checker.finish(this.#lane);
    EventTarget.prototype.removeEventListener.call(this.signal, 'abort', this.#retire);
  }

  async check(input: { path: string }): Promise<boolean> {
    if (this.#state !== 'active' || this.signal.aborted || !this.call.isActive || !isBuiltinReadFile(this.tool)) {
      this.finish();
      return false;
    }
    try {
      const result = await this.#checker.check({ policy: this.policy(), session: this.session(), tool: this.tool,
        input, workspace: this.workspace, signal: this.signal, toolUseId: this.call.providerId }, this.#lane);
      if (this.#state !== 'active' || !this.call.isActive || this.signal.aborted || result.kind !== 'decision' ||
          (result.decision.decision !== 'allow' && result.decision.decision !== 'ask') || !result.observation || result.observation.unresolved ||
          (this.#requested !== undefined && this.#requested !== result.observation.requested)) {
        this.finish();
        return false;
      }
      this.#requested = result.observation.requested;
      return true;
    } catch {
      this.finish();
      return false;
    }
  }

  async readLines(offset: number, limit: number, maxBytes: number): Promise<string> {
    return (await this.readLinesWithMetadata(offset, limit, maxBytes)).content;
  }

  async readLinesWithMetadata(offset: number, limit: number, maxBytes: number): Promise<{
    content: string; truncated: boolean; mtimeMs: number; identity: { dev: string; ino: string };
  }> {
    const opened = await this.open();
    try {
      if (!this.call.isActive || this.signal.aborted) throw new Error('Read approval expired');
      const stat = await opened.handle.stat({ bigint: true });
      if (!stat.isFile()) throw new Error('Read approval changed');
      const result = await readControlledHandleLinesResult(opened.handle, offset, limit, maxBytes, this.signal);
      return { content: result.content, truncated: result.truncated, mtimeMs: Number(stat.mtimeMs),
        identity: { dev: String(stat.dev), ino: String(stat.ino) } };
    } finally {
      await opened.close();
    }
  }

  private async open() {
    if (this.#state !== 'active' || !this.#requested || this.signal.aborted || !this.call.isActive || !isBuiltinReadFile(this.tool)) {
      this.finish();
      throw new Error('Read approval expired');
    }
    this.#state = 'opening';
    try {
      const requested = this.#requested;
      const saved = this.#checker.take(this.#lane, requested);
      if (saved.kind !== 'saved' || !saved.identity) throw new Error('Read approval identity expired');
      const snapshot = { requested, paths: saved.paths, identity: saved.identity, workspace: path.resolve(this.workspace) };
      const allowed = () => {
        if (this.#state !== 'opening' || this.signal.aborted || !this.call.isActive || !isBuiltinReadFile(this.tool)) return false;
        const result = prototypePermissionDecision(this.policy(), this.tool, { path: requested }, this.session(), this.workspace);
        const observation = result.kind === 'observed' ? result.observations[0] : undefined;
        return result.kind === 'observed' && (result.decision.decision === 'allow' || result.decision.decision === 'ask') && result.observations.length === 1 &&
          observation !== undefined && !observation.unresolved && observation.requested === requested &&
          JSON.stringify(observation.spellings) === JSON.stringify(snapshot.paths) &&
          this.#state === 'opening' && !this.signal.aborted && this.call.isActive && isBuiltinReadFile(this.tool);
      };
      if (!allowed()) throw new Error('Read policy changed');
      const opened = await openReadSnapshot(snapshot, this.signal);
      try {
        const stat = await opened.handle.stat({ bigint: true });
        if (!stat.isFile() || stat.dev !== snapshot.identity.dev || stat.ino !== snapshot.identity.ino || !allowed()) {
          throw new Error('Read approval changed');
        }
        return opened;
      } catch (error) {
        await opened.close().catch(() => {});
        throw error;
      }
    } finally { this.finish(); }
  }
}

type Entry = { key: string; consumed: boolean; expired: boolean; identityRecorded: boolean; identityMissing: boolean };

// Host adaptation of Be, chunk-4bw62nzm.js [51037,52888), UTF-16.
// Each path has its own key so consuming a rewritten path preserves sibling paths;
// source Be instead consumes every path in the call's selected lane.
export class PathApprovalCallOwner {
  private readonly stash: InstanceType<typeof Be>;
  private readonly calls = new Set<PathApprovalCall>();
  private identityReservations = 0;

  constructor(private readonly entriesCap = 256, evictedKeysCap = 1048576) {
    if (!Number.isSafeInteger(entriesCap) || entriesCap < 1 ||
        !Number.isSafeInteger(evictedKeysCap) || evictedKeysCap < 0) {
      throw new RangeError('Invalid path approval stash capacity');
    }
    this.stash = new Be(entriesCap, evictedKeysCap);
  }

  begin(providerId: string): PathApprovalCall {
    const call = new PathApprovalCall(this.stash, providerId, this.entriesCap, () => this.calls.delete(call),
      () => {
        if (this.identityReservations >= this.entriesCap * 2) throw new Error('Path approval identity capacity exceeded');
        this.identityReservations++;
      },
      () => { this.identityReservations--; });
    this.calls.add(call);
    return call;
  }

  get activeCalls(): number { return this.calls.size; }
}

export class PathApprovalCall {
  private readonly callKey = randomUUID();
  private readonly entries: Record<Lane, Map<string, Entry>> = { read: new Map(), write: new Map() };
  private readonly sealed: Record<Lane, boolean> = { read: false, write: false };
  private ended: FinishReason | undefined;

  constructor(
    private readonly stash: InstanceType<typeof Be>,
    readonly providerId: string,
    private readonly entriesCap: number,
    private readonly release: () => void,
    private readonly reserveIdentity: () => void,
    private readonly releaseIdentity: () => void,
  ) {}

  record(lane: Lane, path: string, paths: readonly string[], identity?: Identity | null): void {
    this.assertActive();
    if (this.sealed[lane]) throw new Error('Path approval lane is sealed');
    let entry = this.entries[lane].get(path);
    if (entry?.consumed) throw new Error('Path approval was already consumed');
    if (!entry) {
      if (this.entries.read.size + this.entries.write.size >= this.entriesCap) {
        throw new Error('Path approval call capacity exceeded');
      }
      entry = { key: `${this.callKey}:${randomUUID()}`, consumed: false, expired: false, identityRecorded: false, identityMissing: identity === undefined };
      this.entries[lane].set(path, entry);
    } else {
      if (!this.stash.holds(entry.key, path, lane)) entry.expired = true;
      if (identity === undefined) entry.identityMissing = true;
    }
    if (entry.expired) return;
    if (identity !== undefined && !entry.identityRecorded) {
      this.reserveIdentity();
      entry.identityRecorded = true;
    }
    this.stash.stash(entry.key, path, [...paths], lane);
    if (identity !== undefined) this.stash.stashIdentity(entry.key, path, identity === null ? null : { ...identity });
  }

  // Experimental legacy snapshot: caller-supplied identities are never trusted credentials.
  recordObservedRead(input: unknown, workspace: string, observations: readonly PathPermissionObservation[],
    identity: Identity | null | undefined): 'recorded' | 'incomplete' {
    this.assertActive();
    if (this.sealed.read) throw new Error('Path approval lane is sealed');
    const incomplete = (): 'incomplete' => {
      this.sealed.read = true;
      for (const [savedPath, entry] of this.entries.read) {
        entry.expired = true;
        this.stash.takeIdentity(entry.key, savedPath);
        if (entry.identityRecorded && !entry.consumed) {
          this.releaseIdentity();
          entry.identityRecorded = false;
        }
        this.stash.consume(entry.key, savedPath, 'read');
      }
      return 'incomplete';
    };
    try {
      if (typeof input !== 'object' || input === null || utilTypes.isProxy(input) || Array.isArray(input)) return incomplete();
      const descriptor = Object.getOwnPropertyDescriptor(input, 'path');
      if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string' || descriptor.value.length === 0) return incomplete();
      const requested = path.resolve(workspace, descriptor.value).normalize('NFC');
      const observation = verifiedPrototypeRead(input, workspace, observations);
      if (!observation || observation.requested !== requested || observation.unresolved ||
          identity == null || utilTypes.isProxy(identity)) return incomplete();
      const dev = Object.getOwnPropertyDescriptor(identity, 'dev');
      const ino = Object.getOwnPropertyDescriptor(identity, 'ino');
      if (!dev || !('value' in dev) || typeof dev.value !== 'bigint' ||
          !ino || !('value' in ino) || typeof ino.value !== 'bigint') return incomplete();
      const stat = fs.statSync(observation.landing, { bigint: true });
      if (!stat.isFile() || stat.dev !== dev.value || stat.ino !== ino.value) return incomplete();
      this.record('read', requested, observation.spellings, { dev: dev.value, ino: ino.value });
      return 'recorded';
    } catch { return incomplete(); }
  }

  take(lane: Lane, path: string): Snapshot {
    this.assertActive();
    const entry = this.entries[lane].get(path);
    if (!entry) { this.sealed[lane] = true; return { kind: 'expired' }; }
    if (entry.consumed) return { kind: 'expired' };
    entry.consumed = true;
    const identity: Identity | null | undefined = this.stash.takeIdentity(entry.key, path);
    if (entry.identityRecorded) this.releaseIdentity();
    const paths: string[] | typeof j8e | undefined = this.stash.consume(entry.key, path, lane);
    if (lane === 'write') this.stash.consume(entry.key, path, 'read');
    if (entry.expired || paths === j8e || !Array.isArray(paths) ||
        (entry.identityRecorded && (identity == null || entry.identityMissing))) return { kind: 'expired' };
    return { kind: 'saved', paths: [...paths], identity: identity == null ? identity : { ...identity } };
  }

  // Legacy structural check only; record() accepts caller data, so this is not trusted evidence.
  takeVerifiedRead(path: string): { kind: 'saved'; paths: string[]; identity: Identity } | { kind: 'expired' } {
    const snapshot = this.take('read', path);
    if (snapshot.kind === 'expired' || snapshot.identity == null) return { kind: 'expired' };
    return { kind: 'saved', paths: snapshot.paths, identity: snapshot.identity };
  }

  finish(reason: FinishReason): void {
    if (this.ended !== undefined) return;
    this.ended = reason;
    try {
      for (const lane of ['read', 'write'] satisfies Lane[]) {
        for (const [path, entry] of this.entries[lane]) {
          this.stash.takeIdentity(entry.key, path);
          if (entry.identityRecorded && !entry.consumed) this.releaseIdentity();
          this.stash.consume(entry.key, path, lane);
          if (lane === 'write') this.stash.consume(entry.key, path, 'read');
        }
        this.entries[lane].clear();
      }
    } finally {
      this.release();
    }
  }

  get isActive(): boolean { return this.ended === undefined; }

  private assertActive(): void {
    if (this.ended !== undefined) throw new Error(`Path approval call ended: ${this.ended}`);
  }
}
