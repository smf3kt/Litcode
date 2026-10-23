import fs from 'node:fs';
import path from 'node:path';
import { Session, type SessionEvent } from './session.js';
import type { ResumePreview, ResumePreviewMessage } from './resume-picker.js';

export type SessionSummary = { id: string; model: string; updated: string; active: boolean; title?: string;
  parent?: { id: string; workspace: string; boundary: number; reason: string } };

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
  const fork = Session.open(source.config.workspace, { config: structuredClone(source.config), startedAt: source.startedAt });
  try {
    if (eventBoundary === undefined) fork.carryForkPermissions(source);
    // Copy conversation epochs, not tool side-effect journals or locks.
    const boundaries = new Map<number, number>([[0, 0]]);
    for (const [index, event] of history.entries()) {
      // v/RRn [16667,17235)/[4502962,4503404), UTF-16; fold metadata travels with retained messages.
      if (event.kind === 'message' || event.kind === 'compact' || event.kind === 'turn_end' || event.kind === 'scheduled_task_fire' || event.kind === 'loop_boundary') {
        fork.append(event);
        if (event.kind === 'turn_end') boundaries.set(index, fork.events.length - 1);
      }
      if (event.kind === 'checkpoint' && boundaries.has(event.boundary)) fork.append({ ...event, boundary: boundaries.get(event.boundary)! });
      if (event.kind === 'title' || event.kind === 'session_color' || event.kind === "instruction_watch" || event.kind === 'file_history' || event.kind === 'permission_mode_command') fork.append(event);
    }
    fork.append({ kind: 'branch', source: source.id, workspace: source.config.workspace,
      boundary: eventBoundary ?? source.events.length - 1, reason: eventBoundary === undefined ? 'fork' : 'rewind' });
    return fork;
  } catch (error) { fork.close(); throw error; }
}
