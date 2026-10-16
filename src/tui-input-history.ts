import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { atomicWriteFile } from './atomic-write.js';
import type { Session } from './session.js';
import type { PastedContents } from './tui-input-paste.js';
import { initializeHistorySource } from './tui-input-history-source.js';

export interface InputHistoryTimestampedEntry {
  display: string; timestamp: number; textLength: number;
  /** Source lazy resolver; paste payloads load when a row is chosen. */
  resolve(): Promise<InputHistoryEntry>;
}
export interface InputHistoryEntry { display: string; pastedContents: PastedContents }
interface HistoryOwner { key: string; source: any; sessionId: string; exitFlush?: () => Promise<void> }
const MAX_HISTORY_BYTES = 64 * 1024 * 1024;
const MAX_PASTE_BYTES = 256 * 1024;

/** Source WE owns history order, parser, paste cache and flush; Node owns private file descriptors. */
export class InputHistory {
  private active: HistoryOwner | undefined;
  private readonly owners = new Set<HistoryOwner>();
  private closed = false;
  private generation = 0;
  private readonly pendingBindings = new Set<Promise<InputHistoryEntry[]>>();
  private readonly readers = new Set<AsyncGenerator<InputHistoryEntry>>();
  private readonly pendingReaders = new Set<Promise<unknown>>();
  constructor(private readonly onError: (error: unknown) => void = () => {}) {}

  private createOwner(key: string, directory: string, project: string, sessionId: string): HistoryOwner {
    const owner: HistoryOwner = { key, source: undefined, sessionId };
    owner.source = initializeHistorySource({
      be: () => directory, cr: () => project, K: () => sessionId,
      skip: () => process.env.LITCODE_SKIP_PROMPT_HISTORY,
      onError: this.onError,
      St: (callback: () => Promise<void>) => { owner.exitFlush = callback; return () => { if (owner.exitFlush === callback) owner.exitFlush = undefined; }; },
      Q: (milliseconds: number) => delay(milliseconds),
      open: async (file: string) => {
        this.checkFile(file, MAX_HISTORY_BYTES);
        const handle = await fs.promises.open(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        try {
          const stat = await handle.stat();
          if (!stat.isFile() || stat.size > MAX_HISTORY_BYTES) throw new Error('Invalid input history file');
          return handle;
        } catch (error) { await handle.close(); throw error; }
      },
      un: () => ({
        mkdir: async (directory: string) => { this.ensureDirectory(directory); },
        append: async (file: string, text: string, mode: number) => {
          this.ensureDirectory(path.dirname(file)); this.checkFile(file, MAX_HISTORY_BYTES, true);
          const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW, mode);
          try {
            const stat = fs.fstatSync(fd);
            if (!stat.isFile() || stat.size + Buffer.byteLength(text) > MAX_HISTORY_BYTES) throw new Error('Input history file exceeds its limit');
            fs.writeFileSync(fd, text, 'utf8'); fs.fsyncSync(fd);
          } finally { fs.closeSync(fd); }
        },
        write: async (file: string, text: string, mode: number) => {
          this.ensureDirectory(path.dirname(file)); this.checkFile(file, MAX_PASTE_BYTES, true);
          if (Buffer.byteLength(text) > MAX_PASTE_BYTES) throw new Error('History paste exceeds the input limit');
          atomicWriteFile(file, text, { mode, label: 'input history paste' });
        },
        read: async (file: string) => {
          this.checkFile(file, MAX_PASTE_BYTES);
          const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
          try {
            const stat = fs.fstatSync(fd);
            if (!stat.isFile() || stat.size > MAX_PASTE_BYTES) throw new Error('Invalid history paste file');
            return fs.readFileSync(fd, 'utf8');
          } finally { fs.closeSync(fd); }
        },
      }),
      Wa: (file: string) => this.lock(file),
    });
    return owner;
  }

  private ensureDirectory(directory: string): void {
    const chain: string[] = [];
    let current = directory;
    while (!fs.existsSync(current)) { chain.push(current); const parent = path.dirname(current); if (parent === current) break; current = parent; }
    const existing = fs.lstatSync(current);
    if (!existing.isDirectory() || existing.isSymbolicLink()) throw new Error('Input history directory must be a real directory');
    for (const next of chain.reverse()) fs.mkdirSync(next, { mode: 0o700 });
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Input history directory must be a real directory');
  }
  private checkFile(file: string, limit: number, missing = false): void {
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw new Error('Input history target must be a bounded regular file');
    } catch (error) { if (missing && (error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  }
  private removeDeadLock(file: string): boolean {
    let fd: number;
    try { fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true; return false; }
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.size > 4096) return false;
      const owner = JSON.parse(fs.readFileSync(fd, 'utf8')) as { pid?: number; token?: string };
      if (!Number.isSafeInteger(owner.pid) || owner.pid! <= 0 || typeof owner.token !== 'string' || !owner.token) return false;
      try { process.kill(owner.pid!, 0); return false; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return false; }
      const current = fs.lstatSync(file);
      if (current.dev !== stat.dev || current.ino !== stat.ino || current.ctimeMs !== stat.ctimeMs || current.size !== stat.size) return false;
      fs.unlinkSync(file); return true;
    } catch { return false; }
    finally { fs.closeSync(fd); }
  }
  private async lock(file: string): Promise<() => Promise<void>> {
    const lock = file + '.lock', token = randomUUID();
    for (let attempt = 0; attempt < 4; attempt++) {
      let fd: number;
      try { fd = fs.openSync(lock, 'wx', 0o600); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || attempt === 3) throw error;
        if (!this.removeDeadLock(lock)) await delay(50 * 2 ** attempt);
        continue;
      }
      const identity = fs.fstatSync(fd);
      try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token })); fs.fsyncSync(fd); }
      catch (error) {
        const current = fs.lstatSync(lock);
        if (current.dev === identity.dev && current.ino === identity.ino) fs.unlinkSync(lock);
        throw error;
      } finally { fs.closeSync(fd); }
      return async () => {
        const stat = fs.lstatSync(lock);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.dev !== identity.dev || stat.ino !== identity.ino) throw new Error('Input history lock changed');
        const owner = JSON.parse(fs.readFileSync(lock, 'utf8'));
        if (owner.token !== token || owner.pid !== process.pid) throw new Error('Input history lock owner changed');
        fs.unlinkSync(lock);
      };
    }
    throw new Error('Input history lock acquisition failed');
  }

  bind(session: Session): Promise<InputHistoryEntry[]> {
    if (this.closed) return Promise.resolve([]);
    const generation = ++this.generation;
    const work = (async () => {
      const directory = path.resolve(session.config.configSources?.userDir ?? (await import('./config.js')).defaultUserDir());
      const key = JSON.stringify([directory, session.config.workspace, session.id]);
      if (this.closed || generation !== this.generation) return [];
      if (this.active?.key !== key) {
        await this.closeReaders();
        await this.flush();
        if (this.closed || generation !== this.generation) return [];
        // Failed old writes retain their original directory and source retry state.
        const previous = this.active;
        this.active = [...this.owners].find(owner => owner.key === key) ?? this.createOwner(key, directory, session.config.workspace, session.id);
        this.owners.add(this.active);
        if (previous) this.retire(previous);
      }
      return this.read(this.active!);
    })();
    this.pendingBindings.add(work);
    void work.then(() => this.pendingBindings.delete(work), () => this.pendingBindings.delete(work));
    return work;
  }
  private async read(owner: HistoryOwner): Promise<InputHistoryEntry[]> {
    const entries: InputHistoryEntry[] = [];
    try {
      for await (const entry of owner.source.readForProject(undefined, { withClearedDrafts: true })) {
        entries.push({ display: entry.display, pastedContents: Object.fromEntries(Object.entries(entry.pastedContents)
          .filter(([,paste]) => (paste as {type:string;content:string}).type === 'text' && (paste as {content:string}).content !== '')) as PastedContents });
      }
    } catch (error) { this.onError(error); }
    return entries.reverse();
  }
  get bound(): boolean { return this.active !== undefined && !this.closed; }

  /** Each source iterator captures its binding and closes before rebind or finish. */
  readEntries(): AsyncGenerator<InputHistoryEntry> {
    const source = this.active?.source;
    const owner = this;
    async function* read(): AsyncGenerator<InputHistoryEntry> {
      if (!source || owner.closed) return;
      try {
        for await (const entry of source.readEntries()) {
          if (owner.closed || owner.active?.source !== source) return;
          yield { display: entry.display, pastedContents: Object.fromEntries(Object.entries(entry.pastedContents)
            .filter(([,paste]) => (paste as {type:string}).type === 'text')) as PastedContents };
        }
      } finally { owner.readers.delete(reader); }
    }
    const reader = read();
    this.readers.add(reader);
    return reader;
  }
  /**
   * Source scoped iterator with lazy paste resolvers. Source `fss(scope)` forwards the scope to
   * `readTimestamped` unchanged; the reader filters on `project`/`session` only and leaves every
   * other scope (the picker's `everywhere`) unfiltered, so the row cap stays in the picker's scan
   * (`$Lt`/`ULt` in source Kse) and never in this pass-through.
   */
  readTimestamped(scope: 'session' | 'project' | 'everywhere'): AsyncGenerator<InputHistoryTimestampedEntry> {
    const source = this.active?.source;
    const owner = this;
    async function* read(): AsyncGenerator<InputHistoryTimestampedEntry> {
      if (!source || owner.closed) return;
      try {
        for await (const row of source.readTimestamped(scope)) {
          if (owner.closed || owner.active?.source !== source) return;
          yield { display: row.display, timestamp: row.timestamp, textLength: row.textLength, resolve: row.resolve };
        }
      } finally { owner.readers.delete(reader as unknown as AsyncGenerator<InputHistoryEntry>); }
    }
    const reader = read();
    this.readers.add(reader as unknown as AsyncGenerator<InputHistoryEntry>);
    return reader;
  }
  private async closeReaders(): Promise<void> {
    const pending = [...this.readers].map(reader => reader.return(undefined));
    for (const work of pending) {
      this.pendingReaders.add(work);
      void work.then(() => this.pendingReaders.delete(work), () => this.pendingReaders.delete(work));
    }
    await Promise.allSettled([...this.pendingReaders]);
    this.readers.clear();
  }
  add(entry: InputHistoryEntry): void {
    if (this.closed || !this.active || entry.display.trim() === '') return;
    this.active.source.add(structuredClone(entry), undefined, { submitMode: 'prompt', armUndo: false });
  }
  private retire(owner: HistoryOwner): void {
    if (owner !== this.active && owner.source.pendingEntries.length === 0 && owner.source.pendingPasteWrites.size === 0) {
      owner.source.clearPending(); this.owners.delete(owner);
    }
  }
  async flush(): Promise<void> {
    for (const owner of [...this.owners]) { await owner.exitFlush?.(); this.retire(owner); }
  }
  close(): void { this.closed = true; this.generation++; void this.closeReaders(); }
  async finish(): Promise<void> {
    this.close(); await Promise.allSettled([...this.pendingBindings]); await this.closeReaders(); await this.flush();
    for (const owner of this.owners) owner.source.clearPending();
    this.owners.clear(); this.active = undefined;
  }
}
