import fs from 'node:fs';
import path from 'node:path';
import { Session, type SessionEvent } from './session.js';

export function listSessions(workspace: string): { id: string; model: string; updated: string; active: boolean; title?: string;
  parent?: { id: string; workspace: string; boundary: number; reason: string } }[] {
  const dir = path.join(fs.realpathSync(workspace), '.agent');
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
  const fork = Session.open(source.config.workspace, { config: structuredClone(source.config) });
  try {
    // Copy conversation epochs, not tool side-effect journals or locks.
    const boundaries = new Map<number, number>([[0, 0]]);
    for (const [index, event] of history.entries()) {
      if (event.kind === 'message' || event.kind === 'compact' || event.kind === 'turn_end') {
        fork.append(event);
        if (event.kind === 'turn_end') boundaries.set(index, fork.events.length - 1);
      }
      if (event.kind === 'checkpoint' && boundaries.has(event.boundary)) fork.append({ ...event, boundary: boundaries.get(event.boundary)! });
      if (event.kind === 'title' || event.kind === "instruction_watch") fork.append(event);
    }
    fork.append({ kind: 'branch', source: source.id, workspace: source.config.workspace,
      boundary: eventBoundary ?? source.events.length - 1, reason: eventBoundary === undefined ? 'fork' : 'rewind' });
    return fork;
  } catch (error) { fork.close(); throw error; }
}
