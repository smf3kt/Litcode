import fs from "node:fs";
import crypto from "node:crypto";
import { Session } from "./session.js";
import { captureCheckpoint, clearCheckpointAssociation, previewCheckpoint, restoreCheckpoint, writeCheckpointAssociation } from "./checkpoints.js";
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
  const history = session.events.filter(event => ["metadata", "message", "compact", "turn_end", "checkpoint", "rewind"].includes(event.kind));
  return crypto.createHash("sha256").update(JSON.stringify(history)).digest("hex");
}

export function checkpointConversation(session: Session, name: string, signal: AbortSignal) {
  if (session.config.features?.checkpoints === false) throw new Error("Checkpoints are disabled in this session");
  if (session.awaitingResponse) throw new Error("Finish or continue the current turn first");
  const boundary = Math.max(0, session.events.findLastIndex(event => event.kind === "turn_end"));
  // The intent makes capture and association one recoverable unit: a crash after the manifest is
  // published but before the journal append is completed by the next Session.open.
  const intent = writeCheckpointAssociation(session.config.workspace, session.id, name, boundary);
  let captured: ReturnType<typeof captureCheckpoint>;
  try { captured = captureCheckpoint(name, context(session, signal)); }
  catch (error) {
    try { clearCheckpointAssociation(intent); } catch { /* preserve the capture error */ }
    throw error;
  }
  // A failed append keeps the intent; the manifest is durable and the next open restores the event.
  session.append({ kind: "checkpoint", name, digest: captured.checkpoint_digest, boundary });
  try { clearCheckpointAssociation(intent); } catch { /* a later open clears a completed intent */ }
  return { ...captured, turn: session.events.filter(event => event.kind === "turn_end").length };
}

/** Snapshot only main-session boundaries; explicit associations take precedence. */
export function automaticCheckpoint(session: Session, signal: AbortSignal): void {
  if (!session.config.automaticCheckpoints || session.config.childMode || session.config.features?.checkpoints === false || session.awaitingResponse) return;
  const boundary = Math.max(0, session.events.findLastIndex(event => event.kind === "turn_end"));
  if (session.events.some(event => event.kind === "checkpoint" && event.boundary === boundary)) return;
  const captured = session.events.filter(event => event.kind === "checkpoint" && event.name.startsWith("auto-"));
  if (captured.length >= 128) throw new Error("Automatic checkpoint session limit reached (128); use explicit checkpoints");
  // A manifest may survive a failed journal append; retries must use fresh names.
  checkpointConversation(session, `auto-${session.id}-${crypto.randomBytes(10).toString("hex")}`, signal);
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
  const state = historyDigest(session);
  const token = crypto.createHash("sha256").update(JSON.stringify({ session: session.id, boundary, state,
    checkpoint: saved.name, digest: saved.digest, current: preview.current_digest, operations, preserved })).digest("hex");
  return { turn, boundary, checkpoint: saved.name, checkpoint_digest: saved.digest,
    current_digest: preview.current_digest, history_digest: state, token, operations, preserved };
}
export type RewindPreview = ReturnType<typeof previewRewind>;

export function applyRewind(session: Session, preview: RewindPreview, token: string, signal: AbortSignal): Session {
  signal.throwIfAborted();
  const fresh = previewRewind(session, preview.turn, signal);
  if (token !== preview.token || fresh.token !== preview.token) throw new Error("Rewind preview is stale; preview again before applying");
  preview = fresh;
  const next = Session.open(session.config.workspace, { config: structuredClone(session.config) });
  const identity = fs.lstatSync(next.file);

  try {
    for (const event of session.events.slice(1, preview.boundary + 1)) {
      if (event.kind === "message" || event.kind === "compact" || event.kind === "turn_end" || event.kind === "title" || event.kind === "instruction_watch") next.append(event);
    }
    // Re-index inherited associations because effect journals were omitted.
    for (const event of session.events) if (event.kind === "checkpoint" && event.boundary <= preview.boundary) {
      const turns = session.events.slice(0, event.boundary + 1).filter(item => item.kind === "turn_end").length;
      const boundary = turns ? next.events.flatMap((item, index) => item.kind === "turn_end" ? [index] : [])[turns - 1]! : 0;
      next.append({ ...event, boundary });
    }
    const prefix = fs.readFileSync(next.file);
    restoreCheckpoint({ name: preview.checkpoint, expected_current_digest: preview.current_digest,
      paths: preview.operations.map(operation => operation.path), remove_new: true, dry_run: false },
    context(session, signal), () => {
      signal.throwIfAborted();
      next.append({ kind: "rewind", source: session.id, boundary: preview.boundary,
        checkpoint: preview.checkpoint, digest: preview.checkpoint_digest });
      next.append({ kind: "branch", source: session.id, workspace: session.config.workspace, boundary: preview.boundary, reason: "rewind" });
    }, { id: next.id, source: session.id, boundary: preview.boundary, checkpoint: preview.checkpoint, digest: preview.checkpoint_digest,
      inode: identity.ino, device: identity.dev, prefixBytes: prefix.length, prefixSha256: crypto.createHash("sha256").update(prefix).digest("hex") });
    return next;
  } catch (error) {
    next.close();
    const pending = `${session.config.workspace}/.agent/checkpoints/transaction.json`;
    const committed = next.events.some(event => event.kind === "branch" && event.reason === "rewind" && event.source === session.id && event.boundary === preview.boundary);
    // Recovery retains branch history until its durable commit proof is resolved.
    if (!committed && !fs.existsSync(pending) && fs.existsSync(next.file)) {
      const present = fs.lstatSync(next.file);
      if (present.isFile() && !present.isSymbolicLink() && present.ino === identity.ino && present.dev === identity.dev) fs.unlinkSync(next.file);
    }
    throw error;
  }
}
