import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { atomicWriteFile } from './atomic-write.js';
import { CONFIG_LIMITS, readBoundedBytes } from './config.js';
import { queuePermissionSettingsWrite } from './permission-settings.js';
import { acquirePluginStoreLock } from './plugin-chain-lockfile.js';
import { initializeSpinnerTips, selectSpinnerTip, type SpinnerTip } from './spinner-tips-source.js';
import type { SpinnerTipsLayer } from './spinner-tips-settings.js';

const historySchema = z.object({
  numStartups: z.number().int().nonnegative().default(0),
  tipsHistory: z.record(z.number().int().nonnegative()).default({}),
  tipLifetimeShownCounts: z.record(z.number().int().nonnegative()).default({}),
});
type History = z.infer<typeof historySchema>;
export interface SpinnerTipText { text: string; label: string }
const startups = new Map<string, Promise<SpinnerTipsHistory>>();

export class SpinnerTipsHistory {
  private state: History = historySchema.parse({});
  private startup = 0;
  private readonly shownThisStartup = new Set<string>();
  constructor(private readonly file: string) {}
  private async update(change: (state: History)=>History): Promise<void> {
    await queuePermissionSettingsWrite(this.file, async () => {
      fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
      const release = await acquirePluginStoreLock(this.file, { realpath: false,
        retries: { retries: 8, minTimeout: 10, maxTimeout: 100 } });
      try {
        let mode = 0o600, state = historySchema.parse({});
        try {
          const stat = fs.lstatSync(this.file);
          if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Spinner Tips history must be a regular file');
          mode = stat.mode & 0o777;
          const read = readBoundedBytes(this.file, CONFIG_LIMITS.settingsBytes);
          if (read.overflow) throw new Error('Spinner Tips history exceeds the byte limit');
          state = historySchema.parse(JSON.parse(read.buffer.toString('utf8')));
        } catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        }
        const next = change(state);
        if (next !== state) {
          const text = JSON.stringify(next, null, 2) + '\n';
          if (Buffer.byteLength(text) > CONFIG_LIMITS.settingsBytes) throw new Error('Spinner Tips history exceeds the byte limit');
          atomicWriteFile(this.file, text, { mode, label: 'spinnerTipsHistory' });
        }
        this.state = next;
      } finally { await release(); }
    });
  }
  // Startup, 7vyj6mx6 [61512,61564); dQe/jj, khw18tw4 [1269,1583)/[1953,2040), UTF-16.
  async start(): Promise<void> {
    await this.update(H=>({...H,numStartups:(H.numStartups??0)+1}));
    this.startup = this.state.numStartups; this.shownThisStartup.clear();
  }
  sessionsSince(t: string): number { let o=this.state,n=o.tipsHistory[t];if(!n)return Infinity;return Math.max(0,this.startup-n); }
  async shown(t: string): Promise<void> {
    let i=this.startup;
    await this.update(e=>{
      let r=e.tipsHistory??{};
      if(this.shownThisStartup.has(t)||r[t]===i)return e;
      let s=e.tipLifetimeShownCounts??{};
      // The host serializes concurrent CLI processes; an older startup must retain the newer history.
      return {...e,tipsHistory:{...r,[t]:Math.max(r[t]??0,i)},tipLifetimeShownCounts:{...s,[t]:(s[t]??0)+1}};
    });
    this.shownThisStartup.add(t);
  }
}

export function beginSpinnerTipsStartup(userDir: string): Promise<SpinnerTipsHistory> {
  const file = path.join(path.resolve(userDir), 'spinner-tips.json');
  let startup = startups.get(file);
  if (!startup) {
    const history = new SpinnerTipsHistory(file);
    startup = history.start().then(()=>history).catch(error=>{
      startups.delete(file); throw error;
    });
    startups.set(file, startup);
  }
  return startup;
}

// v4 publication/pick, 24k7d6mw [1385085,1386015), UTF-16; one terminal owns the active/held states.
export class SpinnerTips {
  private generation = 0;
  private closed = false;
  private active = false;
  private picked = false;
  private held: (()=>void) | undefined;
  private key = '';
  private session = '';
  private enabled = true;
  private layers: readonly SpinnerTipsLayer[] = [];
  private work: Promise<void> = Promise.resolve();
  private persistence: Promise<void> = Promise.resolve();
  constructor(private readonly history: Promise<SpinnerTipsHistory> | (()=>Promise<SpinnerTipsHistory>),
    private readonly publish: (tip: SpinnerTipText | undefined)=>void,
    private readonly warn: (message: string)=>void) {}
  bind(session: string, enabled: boolean | undefined, layers: readonly SpinnerTipsLayer[] = []): void {
    const key = JSON.stringify([session,layers]);
    this.enabled = enabled !== false;
    if (key === this.key) return;
    const rebound = this.session !== '' && this.session !== session;
    this.session = session; this.key = key; this.layers = structuredClone(layers); this.generation++;
    this.held = undefined;
    if (rebound) { this.picked = false; this.publish(undefined); }
  }
  start(): void { if (!this.closed) { this.active = true; this.picked = false; } }
  finish(): void {
    if (this.closed) return;
    this.pick();
  }
  setActive(active: boolean): void {
    if (this.closed) return;
    this.active = active;
    if (!active) this.publishHeld();
  }
  private betweenTurns(publish: ()=>void): void {
    if (this.active) { this.held = publish; return; }
    publish();
  }
  private publishHeld(): void {
    const held = this.held;
    if (held === undefined || this.active) return;
    this.held = undefined; this.picked = true;
    try { held(); } catch (error) { this.warn(String(error)); }
  }
  private pick(): void {
    if (this.picked || this.held !== undefined) return;
    this.picked = true;
    const generation = this.generation, enabled = this.enabled;
    const source = initializeSpinnerTips(this.layers, this.warn);
    const previous = this.work;
    this.work = (async () => {
      await previous; await this.persistence;
      if (this.closed || generation !== this.generation) return;
      const history = await (typeof this.history === 'function' ? this.history() : this.history);
      let tip: SpinnerTip | undefined;
      if (enabled) {
        const { tips } = await source.xmn();
        tip = selectSpinnerTip(tips.filter(item=>history.sessionsSince(item.id)>=item.cooldownSessions),
          id=>history.sessionsSince(id));
      }
      const text = tip ? await tip.content() : '';
      if (this.closed || generation !== this.generation) return;
      this.betweenTurns(()=>{
        this.publish(text && tip ? { text, label: tip.label } : undefined);
        if (text && tip) this.persistence = this.persistence.then(()=>history.shown(tip.id)).catch(error=>this.warn(String(error)));
      });
    })().catch(error=>{
      if (this.closed || generation !== this.generation) return;
      this.publish(undefined); this.warn(`Spinner Tips: ${error instanceof Error?error.message:String(error)}`);
    });
  }
  close(): void { this.closed = true; this.generation++; this.held = undefined; }
  async flush(): Promise<void> {
    let work, persistence;
    do { work = this.work; await work; persistence = this.persistence; await persistence; }
    while (work !== this.work || persistence !== this.persistence);
  }
}
