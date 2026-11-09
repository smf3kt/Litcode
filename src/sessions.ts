import fs from 'node:fs';
import path from 'node:path';
import { Session, type SessionEvent } from './session.js';
import type { ResumePreview, ResumePreviewMessage } from './resume-picker.js';
import { readPlanBytes, savePlanFile } from './plan-file.js';

export type SessionSummary = { id: string; model: string; updated: string; active: boolean; title?: string;
  parent?: { id: string; workspace: string; boundary: number; reason: string } };

// I_n, 40cepjpq [72739,75980), UTF-16: retain state without copying effects into a branch.
export function inheritedToolObservation(event: Extract<SessionEvent, { kind: 'tool_result' }>, source: Session)
    : Extract<SessionEvent, { kind: 'read_observation' | 'write_observation' }> {
  if (!event.result.is_error && event.host && 'landed' in event.host && event.host.landed) {
    const landed = event.host.landed;
    let cacheKey = landed.cacheKey;
    if (!cacheKey) for (const message of source.messages) if (Array.isArray(message.content)) for (const block of message.content) {
      if (block.type === 'tool_use' && block.id === event.result.tool_use_id &&
          typeof block.input === 'object' && block.input !== null && 'path' in block.input && typeof block.input.path === 'string')
        cacheKey = path.resolve(source.config.workspace, block.input.path);
    }
    if (cacheKey) return { kind: 'write_observation', result: { ...event.result, content: '' },
      operation: 'kind' in event.host && event.host.kind === 'notebook_edit' ? 'notebook_edit' :
        'oldString' in event.host ? 'edit_file' : 'write_file', landed: { ...landed, cacheKey } };
  }
  return { kind: 'read_observation', result: { ...event.result, content: '' },
    ...(event.timestamp === undefined ? {} : { timestamp: event.timestamp }),
    ...(event.host && 'kind' in event.host && event.host.kind === 'file_read' ? { host: event.host } : {}) };
}

type ReadWitness = NonNullable<Extract<SessionEvent, { kind: 'tool_result' }>['readGrantWitness']>;

// Host FD witness rewrite: KWo, sfn1dbxq [2298500,2308030), UTF-16 has no descriptor grant.
export function captureReadWitnessTransfers(source: Session, target: Session): (witness: ReadWitness) => ReadWitness {
  const original = source.workingDirectories(true), copied = target.workingDirectories(true);
  const transfers = new Map<string, { root: string; witness: ReadWitness }>();
  for (const event of source.events) {
    if ((event.kind !== 'tool_effect' && event.kind !== 'tool_result' && event.kind !== 'read_observation') || !event.readGrantWitness) continue;
    const witness = event.readGrantWitness;
    for (const root of original) {
      const from = original.readHandle?.(root), to = copied.readHandle?.(root);
      if (from && source.isReadGrantWitnessCurrent(root, witness) && to && !to.signal.aborted &&
          to.owner === target.id && to.dev === from.dev && to.ino === from.ino) {
        transfers.set(JSON.stringify(witness), { root, witness: { owner: to.owner, incarnation: to.incarnation, callId: witness.callId } });
        break;
      }
    }
  }
  return witness => {
    const transfer = transfers.get(JSON.stringify(witness));
    return transfer && target.isReadGrantWitnessCurrent(transfer.root, transfer.witness) ? transfer.witness : witness;
  };
}

export function inheritedReadWitnessObservation(event: SessionEvent, transfer: (witness: ReadWitness) => ReadWitness)
    : Extract<SessionEvent, { kind: 'read_observation' }> | undefined {
  if ((event.kind !== 'tool_effect' && event.kind !== 'tool_result' && event.kind !== 'read_observation') || !event.readGrantWitness) return;
  return { kind: 'read_observation', result: { ...event.result, content: '' },
    ...(event.timestamp === undefined ? {} : { timestamp: event.timestamp }),
    ...(event.host && 'kind' in event.host && event.host.kind === 'file_read' ? { host: event.host } : {}),
    readGrantWitness: transfer(event.readGrantWitness) };
}

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sessionJournal(workspace: string, id: string): string {
  if (!SESSION_ID.test(id)) throw new Error('Invalid session id');
  return path.join(fs.realpathSync(workspace), '.agent', `${id}.jsonl`);
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.flatMap(block => block !== null && typeof block === 'object' &&
    (block as { type?: unknown }).type === 'text' && typeof (block as { text?: unknown }).text === 'string'
    ? [(block as { text: string }).text] : []).join('\n');
}

/**
 * `mAe` (chunk-sfn1dbxq.js 4662194): a picker row whose summary carries no messages reads the
 * target transcript back. Only completed records are read, and only user/assistant text reaches
 * the preview page.
 */
export function readSessionPreview(workspace: string, id: string): ResumePreview {
  const file = sessionJournal(workspace, id);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100 * 1024 * 1024) throw new Error('Invalid or oversized session journal');
  const text = fs.readFileSync(file, 'utf8');
  const end = text.lastIndexOf('\n') + 1;
  const messages: ResumePreviewMessage[] = [];
  for (const line of text.slice(0, end).split('\n').slice(1)) {
    if (line === '') continue;
    let event: SessionEvent;
    try { event = JSON.parse(line) as SessionEvent; } catch { continue; }
    if (event.kind !== 'message') continue;
    const text = messageText(event.message.content);
    if (text !== '') messages.push({ role: event.message.role === 'assistant' ? 'assistant' : 'user', text });
  }
  return { messages, messageCount: messages.length };
}

/**
 * `Pz` (chunk-sfn1dbxq.js 4644259) for a row that is not the live session: append the custom
 * title to the target journal. The source also updates its session index; the local index is
 * derived from those title records.
 */
export function renameStoredSession(workspace: string, id: string, title: string): void {
  const clean = title.trim();
  if (clean === '' || clean.length > 200 || /[\x00-\x1f\x7f-\x9f]/.test(clean)) throw new Error('Invalid session title');
  const file = sessionJournal(workspace, id);
  // The target journal belongs to another process while its lock exists; the source's storage
  // writer appends under the same lock discipline.
  if (fs.existsSync(`${file}.lock`)) throw new Error('Session is active in another process');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100 * 1024 * 1024) throw new Error('Invalid or oversized session journal');
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
  try {
    fs.writeSync(fd, Buffer.from(JSON.stringify({ kind: 'title', title: clean }) + '\n'));
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
}
export function listSessions(workspace: string): SessionSummary[] {
  return listSessionDirectory(path.join(fs.realpathSync(workspace), '.agent'));
}
export function listSessionDirectory(dir: string): SessionSummary[] {
  if (!fs.existsSync(dir)) return [];
  if (fs.lstatSync(dir).isSymbolicLink() || !fs.statSync(dir).isDirectory()) throw new Error('Invalid session directory');
  return fs.readdirSync(dir).filter(name => /^[0-9a-f-]{36}\.jsonl$/.test(name)).flatMap(name => {
    const file = path.join(dir, name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100 * 1024 * 1024) return [];
    const text = fs.readFileSync(file, 'utf8');
    try {
      const meta = JSON.parse(text.slice(0, text.indexOf('\n'))) as SessionEvent;
      if (meta.kind !== 'metadata') return [];
      let title: string | undefined;
      let parent: { id: string; workspace: string; boundary: number; reason: string } | undefined;
      for (const line of text.slice(text.indexOf('\n') + 1, text.lastIndexOf('\n') + 1).split('\n')) {
        if (!line.includes('"title"') && !line.includes('"branch"')) continue;
        try {
          const record = JSON.parse(line);
          if (record.kind === 'title' && typeof record.title === 'string' && record.title.length <= 200 && !/[\x00-\x1f\x7f-\x9f]/.test(record.title)) title = record.title;
          if (record.kind === 'branch' && typeof record.source === 'string' && /^[0-9a-f-]{36}$/.test(record.source) &&
            typeof record.workspace === 'string' && Number.isSafeInteger(record.boundary) && record.boundary >= 0 &&
            ['fork', 'rewind', 'reload', 'configuration', 'relocation'].includes(record.reason)) {
            parent = { id: record.source, workspace: record.workspace, boundary: record.boundary, reason: record.reason };
          }
        } catch { /* A partial final record has no committed title. */ }
      }
      return [{ id: meta.id, model: meta.config.model, updated: stat.mtime.toISOString(), active: fs.existsSync(`${file}.lock`),
        ...(title === undefined ? {} : { title }), ...(parent === undefined ? {} : { parent }) }];
    } catch { return []; }
  }).sort((a, b) => b.updated.localeCompare(a.updated));
}

export function forkSession(source: Session, eventBoundary?: number): Session {
  if (source.awaitingResponse) throw new Error('Finish or continue the current turn before forking');
  if (eventBoundary !== undefined && (!Number.isSafeInteger(eventBoundary) || eventBoundary < 0 ||
    (eventBoundary !== 0 && source.events[eventBoundary]?.kind !== 'turn_end'))) throw new Error('Rewind requires a completed turn boundary');
  const history = eventBoundary === undefined ? source.events : source.events.slice(0, eventBoundary + 1);
  const fork = Session.open(source.config.workspace, { config: source.snapshotConfig(), startedAt: source.startedAt });
  try {
    if (eventBoundary === undefined) fork.carryForkPermissions(source);
    const transferWitness = captureReadWitnessTransfers(source, fork);
    // Copy conversation epochs, not tool side-effect journals or locks.
    const boundaries = new Map<number, number>([[0, 0]]);
    for (const [index, event] of history.entries()) {
      // v/RRn [16667,17235)/[4502962,4503404), UTF-16; fold metadata travels with retained messages.
      if (event.kind === 'message' || event.kind === 'compact' || event.kind === 'turn_end' || event.kind === 'scheduled_task_fire' || event.kind === 'loop_boundary') {
        const copied = event.kind === 'message' ? source.branchMessage(event) : event.kind === 'compact' ? fork.rebaseCompaction(event) : event;
        if (copied) fork.append(copied);
        if (event.kind === 'turn_end') boundaries.set(index, fork.events.length - 1);
      }
      if (event.kind === 'read_observation') fork.append({ ...event, ...(event.readGrantWitness ? { readGrantWitness: transferWitness(event.readGrantWitness) } : {}) });
      if (event.kind === 'write_observation' || event.kind === 'read_invalidate') fork.append(event);
      if (event.kind === 'tool_effect') {
        const observation = inheritedReadWitnessObservation(event, transferWitness);
        if (observation) fork.append(observation);
      }
      if (event.kind === 'tool_result') {
        const observation = inheritedToolObservation(event, source);
        fork.append(observation.kind === 'read_observation' && event.readGrantWitness
          ? { ...observation, readGrantWitness: transferWitness(event.readGrantWitness) } : observation);
      }
      if (event.kind === 'checkpoint' && boundaries.has(event.boundary)) fork.append({ ...event, boundary: boundaries.get(event.boundary)! });
      if (event.kind === 'model_plan_mode' && eventBoundary === undefined) fork.append({ ...event, planId: fork.id });
      else if (event.kind === 'title' || event.kind === 'session_color' || event.kind === "instruction_watch" || event.kind === 'file_history' || event.kind === 'permission_mode_command' || event.kind === 'model_plan_mode') fork.append(event);
    }
    // Cwt/gft, sfn1dbxq [4734814,4735645), 24k7d6mw [38766,45161), UTF-16;
    // host checkpoint rows may be journaled after the turn they witness.
    if (eventBoundary !== undefined) for (const [index, event] of source.events.entries()) {
      if (index > eventBoundary && event.kind === 'checkpoint' && boundaries.has(event.boundary))
        fork.append({ ...event, boundary: boundaries.get(event.boundary)! });
    }
    // fNe/Xco, chunk-27et44g8.js [14970,15033)/[20754,21314), UTF-16.
    if (eventBoundary === undefined) {
      const sourcePlan = source.planFilePath, forkPlan = fork.planFilePath;
      for (const suffix of ['.workshop.md', '.md']) {
        const from = sourcePlan.slice(0, -3) + suffix, to = forkPlan.slice(0, -3) + suffix;
        try {
          const text = readPlanBytes(source.config.workspace, from);
          if (text !== null) savePlanFile(fork.config.workspace, to, text);
        } catch { /* Each source copy failure leaves the fork usable. */ }
      }
    }
    if (eventBoundary !== undefined) fork.restoreModelPlanMode('prefix');
    fork.appendCheckpointBranch(source, { boundary: eventBoundary ?? source.events.length - 1,
      reason: eventBoundary === undefined ? 'fork' : 'rewind' });
    fork.inheritCheckpointWitnesses(source);
    return fork;
  } catch (error) { fork.close(); throw error; }
}
