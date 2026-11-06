import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { isDeepStrictEqual } from 'node:util';
import { Session } from "./session.js";
import { captureReadWitnessTransfers, inheritedReadWitnessObservation, inheritedToolObservation } from "./sessions.js";
import { captureCheckpoint, clearCheckpointAssociation, previewCheckpoint, restoreCheckpoint, writeCheckpointAssociation } from "./checkpoints.js";
import { beginDirectoryCheckpoint } from './directory-checkpoint.js';
export { inspectDirectoryCheckpointWitness, readDirectoryCheckpointBackup } from './directory-checkpoint.js';
import type { ToolContext } from "./tools.js";

function context(session: Session, signal: AbortSignal): ToolContext {
  return { workspace: session.config.workspace, signal, allowShell: false, maxOutputBytes: session.config.maxOutputBytes };
}
function boundaryFor(session: Session, turn: number): number {
  if (session.awaitingResponse) throw new Error("Finish or continue the current turn first");
  if (!Number.isSafeInteger(turn) || turn < 0) throw new Error("Use a completed turn number, or 0 for initial history");
  if (turn === 0) return 0;
  const boundary = session.events.flatMap((event, index) => event.kind === "turn_end" ? [index] : [])[turn - 1];
  if (boundary === undefined) throw new Error("Completed turn number does not exist");
  return boundary;
}
function historyDigest(session: Session): string {
  const history = session.events.filter(event => ["metadata", "message", "compact", "turn_end", "checkpoint", "rewind", "permission_mode_command", "model_plan_mode"].includes(event.kind));
  return crypto.createHash("sha256").update(JSON.stringify(history)).digest("hex");
}

// Host workspace association for Cwt/E$n, sfn1dbxq [4734814,4735645)/[4743506,4743628), UTF-16;
// source message snapshots do not provide this checkpoint journal transaction.
export function checkpointConversation(session: Session, name: string, signal: AbortSignal) {
  if (session.config.features?.checkpoints === false) throw new Error("Checkpoints are disabled in this session");
  if (session.awaitingResponse) throw new Error("Finish or continue the current turn first");
  const boundary = Math.max(0, session.events.findLastIndex(event => event.kind === "turn_end"));
  // The intent makes capture and association one recoverable unit: a crash after the manifest is
  // published but before the journal append is completed by the next Session.open.
  const intent = writeCheckpointAssociation(session.config.workspace, session.id, name, boundary);
  let captured: ReturnType<typeof captureCheckpoint>;
  // A capture error may follow manifest publication; cold recovery resolves the retained intent.
  captured = captureCheckpoint(name, context(session, signal), { id: path.basename(intent).slice('.assoc-'.length, -'.json'.length), session: session.id, boundary });
  // A failed append keeps the intent; the manifest is durable and the next open restores the event.
  session.append({ kind: "checkpoint", name, digest: captured.checkpoint_digest, boundary });
  try { clearCheckpointAssociation(intent); } catch { /* a later open clears a completed intent */ }
  return { ...captured, turn: session.events.filter(event => event.kind === "turn_end").length };
}

export async function checkpointConversationWithDirectoryWitness(session: Session, name: string, signal: AbortSignal) {
  if (session.config.features?.checkpoints === false || session.awaitingResponse) return checkpointConversation(session, name, signal);
  const boundary = Math.max(0, session.events.findLastIndex(event => event.kind === 'turn_end'));
  const group = await beginDirectoryCheckpoint(session, name, boundary, signal);
  try {
    if (group.kind === 'ready') group.validate();
    const captured = checkpointConversation(session, name, signal);
    const witness = group.kind === 'ready' ? await group.finish() : { kind: 'unknown' as const };
    return { ...captured, external_witness: witness.kind,
      ...(witness.kind === 'available' ? { external_tracked_paths: witness.entries.length } : {}) };
  } finally { if (group.kind === 'ready') await group.cancel(); }
}

/** Snapshot only main-session boundaries; explicit associations take precedence. */
function automaticCheckpointName(session: Session): string | undefined {
  if (!session.config.automaticCheckpoints || session.config.childMode || session.config.features?.checkpoints === false || session.awaitingResponse) return;
  const boundary = Math.max(0, session.events.findLastIndex(event => event.kind === "turn_end"));
  if (session.events.some(event => event.kind === "checkpoint" && event.boundary === boundary)) return;
  const captured = session.events.filter(event => event.kind === "checkpoint" && event.name.startsWith("auto-"));
  if (captured.length >= 128) throw new Error("Automatic checkpoint session limit reached (128); use explicit checkpoints");
  // A manifest may survive a failed journal append; retries must use fresh names.
  return `auto-${session.id}-${crypto.randomBytes(10).toString("hex")}`;
}
export function automaticCheckpoint(session: Session, signal: AbortSignal): void {
  const name = automaticCheckpointName(session);
  if (name) checkpointConversation(session, name, signal);
}
export async function automaticCheckpointWithDirectoryWitness(session: Session, signal: AbortSignal): Promise<void> {
  const name = automaticCheckpointName(session);
  if (name) await checkpointConversationWithDirectoryWitness(session, name, signal);
}

export function previewRewind(session: Session, turn: number, signal: AbortSignal) {
  if (session.config.features?.checkpoints === false) throw new Error("Checkpoints are disabled in this session");
  const boundary = boundaryFor(session, turn);
  const saved = session.events.findLast(event => event.kind === "checkpoint" && event.boundary === boundary);
  if (!saved || saved.kind !== "checkpoint") throw new Error("No file checkpoint is associated with this turn; use /checkpoint NAME at a completed boundary");
  const preview = previewCheckpoint(saved.name, context(session, signal));
  if (preview.checkpoint_digest !== saved.digest) throw new Error("Checkpoint differs from the session association");
  const restorable = preview.changes.filter(change => (!change.before || change.before.kind === "file") && (!change.current || change.current.kind === "file"));
  const operations = restorable.map(change => ({ path: change.path, action: change.before ? "write" : "remove" }));
  const preserved = preview.changes.filter(change => !restorable.includes(change)).map(change => ({ path: change.path, kind: change.current?.kind ?? change.before?.kind }));
  const external = session.rewindExternalState;
  const state = historyDigest(session);
  const token = crypto.createHash("sha256").update(JSON.stringify({ session: session.id, boundary, state,
    checkpoint: saved.name, digest: saved.digest, current: preview.current_digest, operations, preserved, external })).digest("hex");
  return { turn, boundary, checkpoint: saved.name, checkpoint_digest: saved.digest,
    current_digest: preview.current_digest, history_digest: state, token, operations, preserved, external };
}
export type RewindPreview = ReturnType<typeof previewRewind>;

// Host committed-witness error for Cwt/gft, sfn1dbxq [4734814,4735645),
// 24k7d6mw [38766,45161), UTF-16; source has no workspace or receipt transaction.
export class RewindCommittedWitnessError extends Error {
  constructor(readonly sessionId: string, readonly workspace: string, cause: unknown) {
    super(`Checkpoint history committed; inherited witness outcome uncertain. ${String(cause)}`, { cause });
  }
}

function validateRewind(session: Session, preview: RewindPreview, token: string, signal: AbortSignal): RewindPreview {
  signal.throwIfAborted();
  if (!session.isOpen) throw new Error('Rewind session is closed');
  const fresh = previewRewind(session, preview.turn, signal);
  if (token !== preview.token || fresh.token !== preview.token) throw new Error("Rewind preview is stale; preview again before applying");
  return fresh;
}

type RewindBranch = { next: Session; identity: fs.Stats; transferReadWitness: ReturnType<typeof captureReadWitnessTransfers> };

function discardRewindBranch(session: Session, branch: RewindBranch, preview: RewindPreview): void {
  const { next, identity } = branch;
  next.close();
  const pending = `${session.config.workspace}/.agent/checkpoints/transaction.json`;
  const committed = next.events.some(event => event.kind === 'branch' && event.reason === 'rewind' && event.source === session.id && event.boundary === preview.boundary);
  if (!committed && !fs.existsSync(pending) && fs.existsSync(next.file)) {
    const present = fs.lstatSync(next.file);
    if (present.isFile() && !present.isSymbolicLink() && present.ino === identity.ino && present.dev === identity.dev) fs.unlinkSync(next.file);
  }
}

function prepareRewindBranch(session: Session, preview: RewindPreview): RewindBranch {
  const next = Session.open(session.config.workspace, { config: session.snapshotConfig(), startedAt: session.startedAt });
  let identity: fs.Stats;
  try { identity = fs.lstatSync(next.file); }
  catch (error) { next.close(); throw error; }
  const branch: RewindBranch = { next, identity, transferReadWitness: witness => witness };
  try {
    const source = session.workingDirectories(false);
    const original = new Map([...source].map(root => [root, source.readHandle?.(root)]));
    next.carryPermissions(session);
    const successor = next.workingDirectories(false);
    for (const root of next.permissionOwner.state().additionalWorkingDirectories.keys()) {
      const before = original.get(root), after = successor.readHandle?.(root);
      if ((!before && after) || (before && (!after || before.signal.aborted || after.signal.aborted || after.owner !== next.id ||
          before.dev !== after.dev || before.ino !== after.ino || before.fd === after.fd || before.incarnation === after.incarnation)))
        throw new Error('Rewind directory grant handoff failed');
    }
    branch.transferReadWitness = captureReadWitnessTransfers(session, next);
    return branch;
  } catch (error) {
    discardRewindBranch(session, branch, preview);
    throw error;
  }
}

function restoreRewindBranch(session: Session, preview: RewindPreview, signal: AbortSignal, branch: RewindBranch,
  keepForRecovery = false): Session {
  const { next, identity, transferReadWitness } = branch;
  try {
    const checkpointPaths = session.directoryCheckpointPathsAt(session.events.length);
    for (const event of session.events.slice(1, preview.boundary + 1)) {
      if (event.kind === "message" || event.kind === "compact" || event.kind === "turn_end" || event.kind === "title" || event.kind === "instruction_watch" || event.kind === 'file_history' || event.kind === 'permission_mode_command' || event.kind === 'model_plan_mode') next.append(event);
      if (event.kind === 'read_observation') next.append({ ...event,
        ...(event.readGrantWitness ? { readGrantWitness: transferReadWitness(event.readGrantWitness) } : {}) });
      if (event.kind === 'write_observation' || event.kind === 'read_invalidate') next.append(event);
      if (event.kind === 'tool_effect') {
        const observation = inheritedReadWitnessObservation(event, transferReadWitness);
        if (observation) next.append(observation);
      }
      if (event.kind === 'tool_result') {
        const observation = inheritedToolObservation(event, session);
        next.append(observation.kind === 'read_observation' && event.readGrantWitness
          ? { ...observation, readGrantWitness: transferReadWitness(event.readGrantWitness) } : observation);
      }
    }
    next.restoreModelPlanMode('prefix');
    // Re-index inherited associations because effect journals were omitted.
    for (const event of session.events) if (event.kind === "checkpoint" && event.boundary <= preview.boundary) {
      const turns = session.events.slice(0, event.boundary + 1).filter(item => item.kind === "turn_end").length;
      const boundary = turns ? next.events.flatMap((item, index) => item.kind === "turn_end" ? [index] : [])[turns - 1]! : 0;
      next.append({ ...event, boundary });
    }
    // Source evicts rewind paths; unknown aliases require a conservative host-wide eviction.
    if (preview.operations.length) next.append({ kind: 'read_invalidate', paths: [...new Set([
      ...Array.from(next.fileReadCache.entries(), ([key]) => key), ...preview.operations.map(operation => path.resolve(session.config.workspace, operation.path)),
    ])] });
    if (preview.operations.length) next.fileReadCache.clear();
    const prefix = fs.readFileSync(next.file);
    restoreCheckpoint({ name: preview.checkpoint, expected_current_digest: preview.current_digest,
      paths: preview.operations.map(operation => operation.path), remove_new: true, dry_run: false },
    context(session, signal), () => {
      signal.throwIfAborted();
      next.append({ kind: "rewind", source: session.id, boundary: preview.boundary,
        checkpoint: preview.checkpoint, digest: preview.checkpoint_digest });
      next.appendCheckpointBranch(session, { boundary: preview.boundary, reason: "rewind", expected: { external: preview.external, checkpointPaths } });
    }, { id: next.id, source: session.id, boundary: preview.boundary, checkpoint: preview.checkpoint, digest: preview.checkpoint_digest,
      inode: identity.ino, device: identity.dev, gate: next.checkpointGateIdentity(), external: preview.external, checkpointPaths, prefixBytes: prefix.length,
      prefixSha256: crypto.createHash("sha256").update(prefix).digest("hex") });
    try { next.inheritCheckpointWitnesses(session); }
    catch (error) { throw new RewindCommittedWitnessError(next.id, next.config.workspace, error); }
    return next;
  } catch (error) {
    if (!keepForRecovery) discardRewindBranch(session, branch, preview);
    throw error;
  }
}

export function applyRewind(session: Session, preview: RewindPreview, token: string, signal: AbortSignal): Session {
  const fresh = validateRewind(session, preview, token, signal);
  return restoreRewindBranch(session, fresh, signal, prepareRewindBranch(session, fresh));
}

// Host handoff for FVt/IFt, sfn1dbxq [3365082,3365484), 9v9tsk0a [1392,1975), UTF-16.
// Duplicate live grants before releasing the old runtime; perform effects only after it is quiescent.
export async function applyRewindAfterRelease(session: Session, preview: RewindPreview, token: string, signal: AbortSignal,
  release: (completed: () => void) => Promise<void>, recover?: (session: Session) => Promise<void>): Promise<Session> {
  const initial = validateRewind(session, preview, token, signal);
  const { contentRuleOwner, startupModeDecidedByProactivityLevel, ...state } = session.permissionOwner.state();
  const permissions = structuredClone(state);
  let changed = false;
  const unsubscribe = session.subscribePermissions(() => { changed = true; });
  let branch: RewindBranch | undefined;
  let recovery: ReturnType<Session['prepareRewindRecovery']> | undefined, released = false;
  try {
    branch = prepareRewindBranch(session, initial);
    if (recover) recovery = session.prepareRewindRecovery(branch.next);
    await release(() => { released = true; });
    released = true;
    const { contentRuleOwner: currentOwner, startupModeDecidedByProactivityLevel: currentStartup, ...current } = session.permissionOwner.state();
    if (changed || currentOwner !== contentRuleOwner || !isDeepStrictEqual(currentStartup, startupModeDecidedByProactivityLevel) ||
        !isDeepStrictEqual(current, permissions)) throw new Error('Rewind permission state changed; preview again before applying');
    const fresh = validateRewind(session, initial, token, signal);
    const ready = branch, keepForRecovery = !!recovery && !!recover;
    if (!keepForRecovery) branch = undefined;
    const next = restoreRewindBranch(session, fresh, signal, ready, keepForRecovery);
    branch = undefined;
    return next;
  } catch (error) {
    const committed = branch?.next.events.some(event => event.kind === 'branch' && event.reason === 'rewind' && event.source === session.id && event.boundary === initial.boundary);
    const pending = path.join(session.config.workspace, '.agent/checkpoints/transaction.json');
    if (branch && released && recovery && recover && session.isOpen && !session.isJournalFenced && !branch.next.isJournalFenced &&
        !committed && !fs.existsSync(pending)) {
      let restored: Session | undefined;
      try { restored = await recovery.restore(); await recover(restored); }
      catch (failure) {
        if (restored?.isOpen) await restored.close();
        discardRewindBranch(session, branch, initial); branch = undefined;
        throw new AggregateError([error, failure], 'Rewind failed and session recovery failed');
      }
    }
    if (branch) discardRewindBranch(session, branch, initial);
    throw error;
  } finally { recovery?.cancel(); unsubscribe(); }
}
