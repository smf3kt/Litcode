import type { Session } from './session.js';
import { cellWidth } from './terminal.js';
import { runHookCommand } from './hooks.js';
import { initializeStatusLineSource } from './tui-statusline-source.js';
import { statusLineSchema } from './tui-statusline-schema.js';
import { j9, Q1e } from './tui-statusline-usage.js';
import { effectivePermissionPolicy } from './permissions.js';

export { statusLineSchema };
export type StatusLineSetting = { type: 'command'; command: string; padding?: number;
  refreshInterval?: number; hideVimModeIndicator?: boolean };

/** The source owner owns scheduling; this bridge owns the current journal and command children. */
export class StatusLine {
  private readonly pending = new Set<Promise<unknown>>();
  private readonly memory = new Map<string, { lastText: string | undefined }>();
  private owner: any;
  private unsubscribe: (() => void) | undefined;
  private unsubscribePermissions: (() => void) | undefined;
  private session: Session | undefined;
  private inputs: any;
  private active = false;
  private closed = false;
  private vimMode = 'INSERT';
  private onChange: (text: string | undefined) => void = () => {};

  constructor() {
    const source = initializeStatusLineSource({
      Oe: () => {
        const listeners = new Set<() => void>();
        return { subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
          emit: () => { for (const listener of listeners) listener(); } };
      },
      ri: (messages: unknown) => messages,
      gsr: (messages: {uuid:string}[]) => messages.at(-1)?.uuid ?? null,
      uhe: (messages: {usage:unknown}[]) => {
        const usage = messages.at(-1)?.usage;
        return usage ? Q1e(j9(usage), 1000000).total_input_tokens > 200000 : false;
      },
      QPo: () => this.payload(),
      So: () => ({ cwd: this.session?.config.workspace }),
      t: () => {}, c: () => {}, c1: () => {}, ae: cellWidth,
    });
    this.createOwner = (session, inputs) => new source.Owner({
      session, getMessages: () => this.messages(),
      setTimeout: (callback: () => void, milliseconds: number) => {
        const timer = setTimeout(callback, milliseconds); timer.unref(); return () => clearTimeout(timer);
      },
      memory: this.memory.get(session.id),
      execute: (payload: unknown, signal: AbortSignal) => this.execute(payload, signal),
      getWorkspaceGit: async () => ({ gitWorktree: null, repo: null }),
      isVimModeEnabled: () => this.session?.config.editorMode === 'vim',
      isTrustAccepted: () => true, onTrustBlocked: () => {}, logEvent: () => {}, credentials: undefined,
    }, inputs);
  }
  private readonly createOwner: (session: Session, inputs: unknown) => any;

  bind(session: Session, changed: (text: string | undefined) => void): void {
    if (this.closed) return;
    this.onChange = changed;
    if (session !== this.session) {
      this.unsubscribe?.(); this.unsubscribe = undefined;
      this.unsubscribePermissions?.(); this.session = session;
      this.unsubscribePermissions = session.subscribePermissions(() => this.refresh());
      if (!this.memory.has(session.id)) this.memory.set(session.id, { lastText: undefined });
      this.inputs = this.snapshot(); this.owner = this.createOwner(session, this.inputs);
    } else this.refresh();
    if (this.active) {
      if (session.config.statusLine) {
        if (!this.unsubscribe) this.mount();
        else this.publish();
      } else {
        this.unsubscribe?.(); this.unsubscribe = undefined; this.onChange(undefined);
      }
    }
  }

  setActive(active: boolean): void {
    if (this.closed || this.active === active) return;
    this.active = active;
    if (active) this.mount();
    else { this.unsubscribe?.(); this.unsubscribe = undefined; }
  }
  private mount(): void {
    if (!this.owner || !this.session?.config.statusLine) return;
    this.inputs = this.snapshot(); this.owner.setInputs(this.inputs);
    this.unsubscribe = this.owner.subscribe(() => this.publish()); this.publish();
  }
  private publish(): void { if (!this.closed) this.onChange(this.owner?.getSnapshot().text); }

  setVimMode(mode: string): void { if (this.vimMode !== mode) { this.vimMode = mode; this.refresh(); } }
  refresh(): void {
    if (!this.owner || this.closed) return;
    const next = this.snapshot();
    if (this.inputs.additionalWorkingDirectories !== next.additionalWorkingDirectories && this.unsubscribe) {
      this.unsubscribe(); this.unsubscribe = undefined;
      this.owner.setInputs(next); this.inputs = next;
      this.mount();
      return;
    }
    this.owner.setInputs(next); this.inputs = next;
  }
  private messages(): { uuid: string; usage: unknown }[] {
    if (!this.session) return [];
    const compact = this.session.events.findLastIndex(row => row.kind === 'compact');
    return this.session.events.slice(compact + 1).flatMap(row => row.kind === 'message' && row.response
      ? [{ uuid: row.response.id, usage: row.response.usage }] : []);
  }
  private snapshot() {
    const config = this.session!.config, latest = this.messages().at(-1);
    return { statusLine: config.statusLine, settings: {}, lastAssistantMessageId: latest?.uuid ?? null,
      tokenUsage: latest?.usage, permissionMode: effectivePermissionPolicy(config.permissions, this.session!.permissionUpdates)?.mode ?? 'default', vimMode: this.vimMode,
      mainLoopModel: config.model, fastMode: false, effortValue: config.effort, thinkingEnabled: config.thinking,
      prStatus: undefined, additionalWorkingDirectories: this.session!.permissionUpdates.additionalWorkingDirectories };
  }
  private payload() {
    const session = this.session!, config = session.config, usage = this.messages().at(-1)?.usage;
    const durationMs = session.events.reduce((sum, row) => sum + (row.kind === 'turn_end' ? row.duration?.durationMs ?? 0 : 0), 0);
    return { session_id: session.id, transcript_path: session.file, cwd: config.workspace,
      permission_mode: effectivePermissionPolicy(config.permissions, session.permissionUpdates)?.mode ?? 'default', model: { id: config.model, display_name: config.model },
      workspace: { current_dir: config.workspace, project_dir: config.workspace, added_dirs: [...session.permissionUpdates.additionalWorkingDirectories.keys()] }, version: '0.1.0',
      cost: { total_duration_ms: durationMs }, context_window: Q1e(usage ? j9(usage) : null, config.contextTokens),
      exceeds_200k_tokens: usage ? Q1e(j9(usage), config.contextTokens).total_input_tokens > 200000 : false,
      fast_mode: false, ...(config.effort ? { effort: { level: config.effort } } : {}),
      thinking: { enabled: config.thinking }, ...(config.editorMode === 'vim' ? { vim: { mode: this.vimMode } } : {}) };
  }
  private execute(payload: unknown, signal: AbortSignal): Promise<string | undefined> {
    const config = this.session!.config, setting = config.statusLine;
    if (!setting || signal.aborted) return Promise.resolve(undefined);
    const input = JSON.stringify(payload) + '\n';
    if (Buffer.byteLength(input) > 1024 * 1024) return Promise.resolve(undefined);
    const execution = runHookCommand(setting.command, config.workspace, 600000, input, signal).then(result => {
      if (result.aborted || result.timedOut || result.spawnError || result.code !== 0) return undefined;
      return result.stdout.trim().split('\n').flatMap(line => line.trim() || []).join('\n') || undefined;
    });
    this.pending.add(execution); void execution.finally(() => this.pending.delete(execution)); return execution;
  }
  close(): void {
    if (this.closed) return;
    this.closed = true; this.unsubscribe?.(); this.unsubscribe = undefined;
    this.unsubscribePermissions?.(); this.unsubscribePermissions = undefined; this.owner = undefined;
  }
  async flush(): Promise<void> { await Promise.allSettled([...this.pending]); }
}
