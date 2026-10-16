import { randomUUID } from 'node:crypto';
import { initializeProgressSpinner } from './tui-progress-spinner.js';
import { initializeProgressTasks } from './tui-progress-tasks.js';
import { createProgressClock, rn } from './tui-progress-source.js';
import { progressVerbs, type SpinnerVerbs } from './tui-progress-settings.js';
import { initializeProgressText } from './tui-progress-time.js';
import { jsx } from './tui-jsx.js';
import { s } from './tui-base-components.js';
import { cellWidth } from './terminal.js';
import { ra } from './tui-graphemes.js';
import type { TaskRecord } from './tasks.js';

export type ProgressMode = 'requesting' | 'thinking' | 'responding' | 'tool-use';
export interface TurnDuration { uuid: string; durationMs: number; timestamp: string }
export type AgentProgressEvent = { kind: 'start'; uuid: string; startedAt: number }
  | { kind: 'phase'; mode: ProgressMode }
  | { kind: 'finish'; reason: string; duration: TurnDuration };

interface SourceClock {
  subscribeKeepAlive(callback: () => void): () => void;
  now(): number;
  setTickInterval(milliseconds: number): void;
}

/** Source hooks bind to this terminal's clock, refs and cancellation lifetime. */
export class ThinkingProgress {
  private clock: SourceClock = createProgressClock(16);
  private unsubscribe: (() => void) | undefined;
  private readonly delays = new Set<ReturnType<typeof setTimeout>>();
  private closed = false;
  private active = false;
  private focused = true;
  private visible = true;
  private reduced = false;
  private phase: ProgressMode = 'requesting';
  private uuid = '';
  private started = {current:0};
  private paused = {current:0};
  private pauseStart = {current:null as number | null};
  private response = {current:0};
  private lastPhaseSample = -1;
  private verb = 'Working';
  private verbsSetting: SpinnerVerbs | undefined;
  private taskRows: readonly TaskRecord[] = [];
  private readonly Spinner;
  private readonly Tasks;

  constructor(private readonly changed: () => void) {
    const timeout = (callback: () => void, milliseconds: number) => {
      const timer = setTimeout(() => {
        this.delays.delete(timer);
        if (this.closed) return;
        callback(); this.changed();
      }, milliseconds);
      this.delays.add(timer);
      return () => {clearTimeout(timer); this.delays.delete(timer);};
    };
    const text = initializeProgressText(cellWidth, ra);
    const timers = {setTimeout:timeout};
    const source = initializeProgressSpinner({
      ae:cellWidth, Bs:text.Bs, on:() => timers,
      ia:(interval: number | null) => [undefined, interval === null ? 0 : Math.floor(this.clock.now() / interval) * interval],
    });
    this.Spinner = (props: Record<string, unknown>) => jsx(source.Spinner,
      {...props, thinkingStatus:source.thinkingStatus(props.mode)}, undefined);
    this.Tasks = initializeProgressTasks({ae:cellWidth, ct:text.ct, on:() => timers});
  }

  get running(): boolean {return this.active;}
  get key(): string {return this.uuid;}
  get hasTasks(): boolean {return this.taskRows.length > 0;}

  start(uuid: string = randomUUID(), startedAt = Date.now()): void {
    if (this.closed) return;
    this.stop(); this.clock = createProgressClock(this.focused ? 16 : 32); this.uuid = uuid;
    this.started = {current:startedAt}; this.paused = {current:0}; this.pauseStart = {current:null};
    this.response = {current:0}; this.phase = 'requesting'; this.active = true; this.lastPhaseSample = -1;
    const verbs = progressVerbs(this.verbsSetting);
    this.verb = verbs[Math.floor(Math.random() * verbs.length)] ?? 'Working';
    this.syncClock();
  }

  mode(mode: ProgressMode): boolean {
    if (!this.active || this.phase === mode) return false;
    this.phase = mode; this.syncClock(); return true;
  }
  text(value: string): void {if (this.active) {this.response.current += value.length; this.phase = 'responding';}}
  tasks(rows: readonly TaskRecord[]): void {this.taskRows = rows;}
  setVerbs(setting?: SpinnerVerbs): void {this.verbsSetting = setting ? structuredClone(setting) : undefined;}
  setReducedMotion(value: boolean): void {this.reduced = value; this.syncClock();}
  setFocused(value: boolean): void {this.focused = value; this.clock.setTickInterval(value ? 16 : 32);}
  setVisible(value: boolean): void {if (this.visible !== value) {this.visible = value; this.syncClock();}}
  pause(value: boolean): void {
    if (!this.active) return;
    if (value && this.pauseStart.current === null) this.pauseStart.current = Date.now();
    else if (!value && this.pauseStart.current !== null) {
      this.paused.current += Date.now() - this.pauseStart.current; this.pauseStart.current = null;
    }
  }
  stop(): void {this.active = false; this.unsubscribe?.(); this.unsubscribe = undefined;}

  private syncClock(): void {
    this.unsubscribe?.(); this.unsubscribe = undefined;
    if (!this.active || !this.visible || this.reduced || this.closed) return;
    this.unsubscribe = this.clock.subscribeKeepAlive(() => {
      const sample = Math.floor(this.clock.now() / (this.phase === 'requesting' ? 50 : 100));
      if (sample === this.lastPhaseSample) return;
      this.lastPhaseSample = sample; this.changed();
    });
  }

  element(columns: number) {
    const task = this.taskRows.find(row => row.status !== 'pending' && row.status !== 'completed');
    const activeLabel = [task?.activeForm, task?.subject].map(value => value?.replace(/\s+/g, ' ').trim()).find(Boolean);
    const label = activeLabel ?? this.verb;
    return jsx(s, {flexDirection:'column', width:'100%', children:[
      this.active && jsx(this.Spinner, {
        mode:this.phase, reducedMotion:this.reduced, hasActiveTools:this.phase === 'tool-use',
        responseLengthRef:this.response, message:label + '…', messageColor:'claude', shimmerColor:'claudeShimmer',
        loadingStartTimeRef:this.started, totalPausedMsRef:this.paused, pauseStartTimeRef:this.pauseStart,
        verbose:false, columns, effortSuffix:'', agentId:this.uuid,
      }, this.uuid),
      this.hasTasks && jsx(this.Tasks, {tasks:this.taskRows, isStandalone:true}, 'tasks'),
    ]}, undefined);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true; this.stop();
    for (const timer of this.delays) clearTimeout(timer);
    this.delays.clear(); this.taskRows = [];
  }
}

export { rn };
