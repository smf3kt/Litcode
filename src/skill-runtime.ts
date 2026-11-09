import { toolNameDenied, checkBashCommandClamp, bashCommandClampDenial } from './agent-tool-restrictions.js';
import { fTr } from './shell-command-clamp-source.js';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copySkillOutput, pinSkillResult, skillOutputPreview, skillResultsDirectory } from './skill-output-source.js';
import { fileURLToPath } from 'node:url';
import { runShellSupervisor } from './shell-supervisor-status.js';
import { withShellAnalysisHome } from './shell-analysis-home.js';
import { vJe } from './shell-rule-recheck-source.js';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent } from './agent.js';
import type { AgentRegistry } from './agent-registry.js';
import { expandSkill, type SkillInfo } from './config.js';
import { HOOK_EVENTS, flattenHookDefinitions, hooksSchema, type HookCommandHome, type HooksConfig } from './hooks.js';
import { permissionDecision, permissionOwner, bindPermissionOwner, childPermissionState, type PermissionDecision } from './permissions.js';
import { contentRuleMatches, ruleToolMatches } from './permission-content.js';
import type { ModelProvider } from './provider.js';
import { Session, type SessionConfig } from './session.js';
import { SkillEffectRecoveryError, type SkillEffectJournal, type SkillEffectRetryGrant } from './skill-effects.js';
import { capChildOutput, childConfig, childSpawnDepth, maxSubagentSpawnDepth, createChildHookLifecycle, forkMessages, selectChildTools, resolveChildLaunch, type ChildHookOptions } from './subagents.js';
import { bindScopedChildTool, type ToolDefinition } from './tools.js';
import { consumeHumanSkillAuthorization, type HumanSkillAuthorization } from './notification-authorization.js';
import { observeApprovalOperation } from './approval-operation-observer.js';

export interface SkillExecutionOptions {
  config: SessionConfig;
  parentSessionId?: string;
  /** Resolve the invocation's live Session; absent means no witnessed owner. */
  session?: () => Session | undefined;
  parentPlanId?: string;
  provider: ModelProvider;
  tools: ToolDefinition[];
  signal: AbortSignal;
  source: 'user' | 'model';
  humanAuthorization?: HumanSkillAuthorization;
  onText?: (text: string) => void;
  registry?: AgentRegistry;
  backgroundRegistry?: () => AgentRegistry;
  hasLiveForkedSkill?: (name: string) => boolean;
  conversation?: readonly Anthropic.MessageParam[];
  requestPermission?: (tool: ToolDefinition, input: unknown, decision: PermissionDecision, signal: AbortSignal) => Promise<PermissionDecision>;
  timeoutMs?: number;
  hookOptions?: ChildHookOptions['hookOptions'];
  onHookCompletion?: ChildHookOptions['onHookCompletion'];
  terminalSequence?: ChildHookOptions['terminalSequence'];
  instructionFiles?: ChildHookOptions['instructionFiles'];
  stopState?: ChildHookOptions['stopState'];
  /** Durable journal for the body's inline shell spans (see ./skill-effects.ts). */
  effectJournal?: SkillEffectJournal;
  commandOwner?: SkillCommandOwner;
  inlineShellAllowed?: boolean;
}

// Vit/xxe/Wbt/Lvn and Axe, chunk-sfn1dbxq [80884,81189)/[82919,87427), UTF-16.
// The host scopes the source's live set to a session and drains journal finalization too.
export class SkillCommandOwner {
  private readonly controller = new AbortController();
  private readonly active = new Set<Promise<unknown>>();
  private closing?: Promise<void>;

  run<T>(signal: AbortSignal, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.controller.signal.throwIfAborted();
    const combined = AbortSignal.any([signal, this.controller.signal]);
    const promise = Promise.resolve().then(() => { combined.throwIfAborted(); return operation(combined); });
    this.active.add(promise);
    void promise.then(() => this.active.delete(promise), () => this.active.delete(promise));
    return promise;
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.controller.abort();
    this.closing = Promise.allSettled([...this.active]).then(() => {});
    return this.closing;
  }

  async drain(): Promise<void> {
    await Promise.allSettled([...this.active]);
  }
}

function skillConversation(skill: SkillInfo, options: SkillExecutionOptions): Anthropic.MessageParam[] | undefined {
  if (skill.context !== 'fork' || options.conversation === undefined) return undefined;
  if (Buffer.byteLength(JSON.stringify(options.conversation)) > 8 * 1024 * 1024) throw new Error('Skill fork conversation byte limit exceeded');
  return forkMessages(options.conversation, true);
}

function checkConversationBudget(messages: Anthropic.MessageParam[] | undefined, body: string, config: SessionConfig): void {
  if (messages === undefined) return;
  // Count serialized bytes as tokens to reserve conservatively without a provider call.
  const bytes = Buffer.byteLength(JSON.stringify({ system: config.system, tools: config.tools,
    messages: [...messages, { role: 'user', content: body }] }));
  if (bytes + 512 > config.contextTokens - config.maxTokens) throw new Error('Skill fork conversation context budget exceeded');
}

function wildcard(pattern: string, value: string): boolean {
  let p = 0; let v = 0; let star = -1; let retry = 0;
  while (v < value.length) {
    if (pattern[p] === '*') { star = p++; retry = v; }
    else if (pattern[p] === value[v]) { p++; v++; }
    else if (star >= 0) { p = star + 1; v = ++retry; }
    else return false;
  }
  while (pattern[p] === '*') p++;
  return p === pattern.length;
}

function grant(skill: SkillInfo, tool: ToolDefinition, input?: unknown, workspace?: string): boolean {
  if (toolNameDenied(tool.schema.name, skill.disallowedTools ?? [])) return false;
  if (skill.allowedTools === undefined) return true;
  const name = tool.schema.name;
  return skill.allowedTools.some(rule => {
    const match = /^([^()]+)\((.*)\)$/.exec(rule);
    if (!match) return wildcard(rule, name) || (rule === 'Bash' && name === 'run_command');
    if (!wildcard(match[1]!, name) && !ruleToolMatches(match[1]!, name)) return false;
    if (input === undefined) return true;
    // Nn/Ui/ZYt, chunk-2bcyxj9q.js [221752,223408)/[225036,225815)/[226996,227149), UTF-16.
    // File grants still pass the parent's permission decision and the file tool's confinement.
    if (workspace !== undefined && typeof input === 'object' && input !== null &&
      typeof Object.getOwnPropertyDescriptor(input, 'path')?.value === 'string') {
      return contentRuleMatches({ mode: 'default', allow: [rule], deny: [], ruleWorkspace: workspace },
        'allow', name, input, undefined, workspace);
    }
    const command = typeof input === 'object' && input !== null ? Object.getOwnPropertyDescriptor(input, 'command')?.value : undefined;
    return typeof command === 'string' && wildcard(match[2]!, command);
  });
}

async function approve(...args: Parameters<typeof approveBody>): Promise<void> {
  return observeApprovalOperation(args[2].session?.(), { kind: 'skill' }, () => approveBody(...args));
}

async function approveBody(tool: ToolDefinition, input: unknown, options: SkillExecutionOptions, explicit = false,
  alternateHome?: string, workspace = options.config.workspace, planOwnership?: import('./plan-file.js').PlanOwnership, approved = false): Promise<void> {
  options.signal.throwIfAborted();
  if (tool.schema.name === 'run_command' && (!options.config.allowShell || options.inlineShellAllowed === false)) throw new Error('Skill shell access is disabled');
  const clamp = options.config.bashCommandClamp;
  if (tool.schema.name === 'run_command' && clamp?.length) {
    const command = typeof input === 'object' && input !== null ? Object.getOwnPropertyDescriptor(input, 'command')?.value : undefined;
    if (typeof command !== 'string') throw new Error('Skill shell command cannot be verified');
    const home = alternateHome ?? process.env.HOME;
    const failure = home === undefined ? checkBashCommandClamp(command, clamp) ?? await withShellAnalysisHome('', () => fTr({ command }, clamp))
      : await withShellAnalysisHome(home, () => fTr({ command }, clamp));
    options.signal.throwIfAborted();
    if (failure !== null) {
      if ((failure.kind !== 'unverifiable' && failure.kind !== 'unmatched') || typeof failure.span !== 'string' || !Array.isArray(failure.group))
        throw new Error('Invalid shell restriction result');
      throw new Error(bashCommandClampDenial(tool.schema.name, command, { kind: failure.kind, span: failure.span, group: failure.group }));
    }
  }
  const state = permissionOwner(options.config.permissions)?.state();
  let decision = permissionDecision(options.config.permissions, tool, input, state && planOwnership ? { ...state, planOwnership } : state, workspace);
  if (alternateHome !== undefined) {
    const alternate = withShellAnalysisHome(alternateHome, () => permissionDecision(options.config.permissions, tool, input, undefined, workspace));
    if (alternate.decision === 'deny' || decision.decision === 'allow' && alternate.decision === 'ask') decision = alternate;
  }
  if (explicit && !options.config.permissions) decision = { decision: 'ask', reason: 'Skill command requires explicit invocation approval' };
  if (approved && decision.decision === 'ask') decision = { decision: 'allow' };
  if (decision.decision === 'ask' && options.requestPermission) {
    const snapshot = JSON.stringify(input);
    decision = await options.requestPermission(tool, input, decision, options.signal);
    options.signal.throwIfAborted();
    if (JSON.stringify(input) !== snapshot) throw new Error('Permission input changed during approval');
    // _Wo/Cge, chunk-sfn1dbxq [2237279,2240346), UTF-16: a live deny overrides approval.
    const currentState = permissionOwner(options.config.permissions)?.state();
    const current = permissionDecision(options.config.permissions, tool, input,
      currentState && planOwnership ? { ...currentState, planOwnership } : currentState, workspace);
    if (current.decision === 'deny') throw new Error(current.reason ?? 'Skill permission denied');
    if (alternateHome !== undefined) {
      const alternate = withShellAnalysisHome(alternateHome, () => permissionDecision(options.config.permissions, tool, input, undefined, workspace));
      if (alternate.decision === 'deny') throw new Error(alternate.reason ?? 'Skill permission denied');
    }
  }
  options.signal.throwIfAborted();
  if (decision.decision !== 'allow') throw new Error(decision.reason ?? `Skill permission ${decision.decision}: ${tool.schema.name}`);
}

// kn, qw2csqy5 [11500,19000); aNn, p46ep603 [1284,1978), UTF-16.
export function skillToolApproval(currentSkill: () => SkillInfo, options: SkillExecutionOptions) {
  return async (tool: ToolDefinition, input: unknown, signal: AbortSignal, workspace: string, planOwnership?: import('./plan-file.js').PlanOwnership, approved = false): Promise<void> => {
    if (!grant(currentSkill(), tool, input, workspace)) throw new Error('Skill tool input is outside allowed-tools');
    await approve(tool, input, { ...options, signal }, false, undefined, workspace, planOwnership, approved);
    if (!grant(currentSkill(), tool, input, workspace)) throw new Error('Skill tool input is outside allowed-tools');
  };
}

const commandTool: ToolDefinition = {
  schema: { name: 'run_command', description: 'Skill invocation command', input_schema: { type: 'object', properties: { command: { type: 'string' } } } },
  readOnly: false,
  async execute() { throw new Error('Invocation command descriptor is permission-only'); },
};

class SkillCommandFailed extends Error {}
class SkillShellFailed extends SkillCommandFailed {}

// Shell mapToolResultToToolResultBlockParam, chunk-sfn1dbxq.js [4335357,4336747), UTF-16.
function skillShellText(output: Buffer[]): string {
  return Buffer.concat(output).toString('utf8').replace(/^(\s*\n)+/, '').trimEnd();
}

/** Commands use an owned process group and a bounded output window. */
async function shellOutput(command: string, shell: string, options: SkillExecutionOptions, home: string | undefined): Promise<Buffer> {
  options.signal.throwIfAborted();
  const timeout = options.timeoutMs ?? 30_000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120_000) throw new Error('Skill timeout must be between 1 and 120000ms');
  // ale/uIr, chunk-sfn1dbxq.js [3514300,3517100), [3521162,3521290), UTF-16:
  // share the output target before exec so the configured shell receives its original command.
  const shellArgs = ['-c', 'exec "$@" 2>&1', 'skill-shell', shell, '-c', command];
  if (process.platform === 'darwin') {
    // Host rewrite: Axe/ale chunk-sfn1dbxq.js [82919,87427), [3506526,3518705),
    // Mw chunk-25vrbr0v.js [943,3031), UTF-16; digests and rationale in W385.
    const controller = new AbortController();
    let failure: Error | undefined;
    const stop = (error: Error) => { if (!failure) { failure = error; controller.abort(); } };
    const abort = () => stop(new Error('Skill command aborted'));
    const timer = setTimeout(() => stop(new Error(`Skill command timed out after ${timeout}ms`)), timeout);
    const chunks: Buffer[] = []; let bytes = 0;
    options.signal.addEventListener('abort', abort, { once: true });
    if (options.signal.aborted) abort();
    try {
      const result = await runShellSupervisor({
        supervisor: fileURLToPath(new URL('../native/shell-supervisor/supervisor', import.meta.url)),
        command: '--kill-immediately', args: ['/bin/sh', ...shellArgs], cwd: options.config.workspace,
        env: { ...process.env, HOME: home }, signal: controller.signal,
        maxOutputBytes: options.config.maxOutputBytes, stopOnOutputLimit: true, stopGraceMs: 200, drainMs: 200,
        onOutput: (_stream, chunk) => {
          if (failure) return;
          if (bytes + chunk.length > options.config.maxOutputBytes) { stop(new Error('Skill command output byte limit exceeded')); return; }
          chunks.push(chunk); bytes += chunk.length;
        },
      });
      if (failure) throw failure;
      const output = Buffer.concat(chunks).toString('utf8');
      if (result.outputLimitExceeded) throw new Error('Skill command output byte limit exceeded');
      if (result.truncated) throw new Error('Skill command output could not be fully drained');
      switch (result.outcome.kind) {
        case 'exited':
          if (vJe(command, result.outcome.code, output, '').isError) throw new SkillShellFailed(output);
          return Buffer.concat(chunks);
        case 'not-started': throw new SkillCommandFailed(`Skill command failed to start: ${result.outcome.stage} (errno ${result.outcome.errno})`);
        case 'signalled': throw new Error(`Skill command exited with signal: ${output}`);
        case 'cancelled': throw new Error('Skill command aborted');
        case 'unknown':
          if (result.outcome.reason.startsWith('supervisor spawn failed:')) throw new SkillCommandFailed(result.outcome.reason);
          throw new Error(`Skill command outcome unknown: ${result.outcome.reason}`);
      }
    } finally {
      clearTimeout(timer);
      options.signal.removeEventListener('abort', abort);
    }
  }
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/sh', shellArgs, { cwd: options.config.workspace, env: { ...process.env, HOME: home }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let finished = false; let failure: Error | undefined; let timer: ReturnType<typeof setTimeout>; let grace: ReturnType<typeof setTimeout> | undefined;
    const chunks: Buffer[] = []; let bytes = 0;
    const kill = () => {
      try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); }
      catch { try { child.kill('SIGKILL'); } catch { /* Already reaped. */ } }
    };
    const settle = (code?: number | null) => {
      if (finished) return;
      finished = true; clearTimeout(timer); if (grace) clearTimeout(grace);
      options.signal.removeEventListener('abort', abort);
      child.stdout?.destroy(); child.stderr?.destroy();
      if (failure) reject(failure);
      else if (code === null || code === undefined) reject(new Error(`Skill command exited with signal: ${Buffer.concat(chunks).toString('utf8')}`));
      else if (vJe(command, code, Buffer.concat(chunks).toString('utf8'), '').isError) reject(new SkillShellFailed(Buffer.concat(chunks).toString('utf8')));
      else resolve(Buffer.concat(chunks));
    };
    const stop = (error: Error) => {
      if (failure) return;
      failure = error; kill();
      grace ??= setTimeout(() => settle(), 200);
    };
    const abort = () => stop(new Error('Skill command aborted'));
    const append = (chunk: Buffer) => {
      if (failure) return;
      if (bytes + chunk.length > options.config.maxOutputBytes) { stop(new Error('Skill command output byte limit exceeded')); return; }
      chunks.push(chunk); bytes += chunk.length;
    };
    timer = setTimeout(() => stop(new Error(`Skill command timed out after ${timeout}ms`)), timeout);
    options.signal.addEventListener('abort', abort, { once: true });
    if (options.signal.aborted) abort();
    child.stdout?.on('data', append); child.stderr?.on('data', append);
    child.once('error', error => { failure = child.pid === undefined ? new SkillCommandFailed(error.message) : error; settle(); });
    child.once('exit', code => { kill(); grace ??= setTimeout(() => settle(code), 200); });
    child.once('close', code => settle(code));
  });
}

/** The recovered normalization for an extracted command: trim, CRLF to LF. */
const normalizeCommand = (text: string) => text.trim().replaceAll('\r\n', '\n');

/** One authored shell directive: the raw span to replace and the command to run. */
type SkillCommand = { raw: string; command: string; at: number };

/**
 * Recovered: an authored body carries shell in two forms, both extracted from
 * the authored text before any substitution and both replaced by the command's
 * output: a fenced ```! block, and an inline `!`cmd`` span.
 * Gtr, chunk-sfn1dbxq [434578,435100), UTF-16: retain overlapping matches,
 * with fenced matches before inline matches.
 */
function skillCommands(body: string): SkillCommand[] {
  const found: SkillCommand[] = [];
  // Gtr/s5r, chunk-sfn1dbxq [434795,435100), UTF-16: omit empty normalized commands.
  for (const match of body.matchAll(/```!\s*\n?([\s\S]*?)\n?```/g)) {
    const command = normalizeCommand(match[1]!);
    if (command) found.push({ raw: match[0], command, at: match.index! });
  }
  // cOe, chunk-sfn1dbxq [434578,434700), UTF-16: mask ordinary code spans without moving offsets.
  const masked = body.replace(/`[^`\n]+`/g, (span, at: number) => {
    const before = body[at - 1];
    return before === '!' || before === '`' ? span : '`' + ' '.repeat(span.length - 2) + '`';
  });
  // hVn, chunk-sfn1dbxq [434833,434860), UTF-16: require start or whitespace.
  for (const match of masked.matchAll(/(?<=^|\s)!`([^`]+)`/gm)) {
    const at = match.index!;
    const command = normalizeCommand(match[1]!);
    if (command) found.push({ raw: match[0], command, at });
  }
  return found;
}

// getPromptForCommand, sfn1dbxq [963598,964251), UTF-16; authored directives remain the host's scan boundary.
async function expandedBody(skill: SkillInfo, args: string, options: SkillExecutionOptions, invocation?: ReturnType<SkillEffectJournal['invocation']>): Promise<string> {
  const body = skill.body;
  const sourceArguments = options.config.features?.skillSourceArguments === true;
  const expansion = { sourceArguments, appendUnusedArguments: false, quotedArguments: options.config.features?.skillQuotedArguments === true,
    extendedArguments: options.config.features?.skillExtendedArguments === true, argumentNames: skill.argumentNames };
  const expand = (text: string) => expandSkill(text, args, expansion);
  const expanded = expand(body);
  const withArguments = expandSkill(body, args, { ...expansion,
    appendUnusedArguments: sourceArguments || options.config.features?.skillArgumentFallback === true });
  // Identify authored directives before substitution; argument/output text never
  // introduces a second command-expansion pass.
  const commands = skillCommands(body);
  if (!commands.length || (skill.shell === undefined && skill.command === undefined && options.config.features?.skillInlineCommands !== true)) return withArguments;
  // Host journal rewrite: iye, chunk-sfn1dbxq [3368429,3370821), UTF-16,
  // has no recovery journal. Surface unknown effects before any retry approval or effect.
  const journal = options.effectJournal;
  const pending = invocation?.pending ?? [];
  let retry: { index: number; grant: SkillEffectRetryGrant } | undefined;
  if (journal && pending.length) {
    if (options.source === 'user' && pending.length === 1) {
      const session = options.session?.();
      options.signal.throwIfAborted();
      for (const record of pending) {
        const entry = commands[record.index];
        const grant = entry && session?.consumeSkillEffectRetry(record.id, skill.name, record.index, expand(entry.command));
        if (grant) retry = { index: record.index, grant };
      }
    }
    if (!retry) throw new SkillEffectRecoveryError(journal, pending);
  }
  const shell = skill.shell ?? '/bin/sh';
  const expandedCommands = commands.map(entry => expand(entry.command));
    // iye/xxr, chunk-sfn1dbxq [3368429,3371446), UTF-16: each command
    // approves and executes concurrently; replacement follows completion order.
    let out = expanded;
    await Promise.all(commands.map((entry, index) => options.commandOwner!.run(options.signal, async signal => {
      if (retry && index !== retry.index) return;
      const command = expandedCommands[index]!;
      const ownOptions = { ...options, signal };
      if (!grant(skill, commandTool, { command })) throw new Error('Skill command is outside allowed-tools');
      const home = process.env.HOME;
      await approve(commandTool, { command }, ownOptions, true, home === undefined && shell !== '/bin/sh' ? homedir() : undefined);
      options.session?.();
      signal.throwIfAborted();
      const effect = journal?.start(skill.name, index, command, invocation?.generation, retry?.grant);
      let bytes: Buffer;
      try { bytes = await shellOutput(command, shell, ownOptions, home); }
      catch (error) {
        // Host journal rewrite: Axe, chunk-sfn1dbxq [82919,87427), UTF-16,
        // distinguishes missing exit status; uncertain effects stay unresolved.
        if (effect) {
          if (error instanceof SkillCommandFailed) journal!.finish(effect, 'failed');
          else journal!.abandon(effect);
        }
        // Ypn/Axr, chunk-sfn1dbxq.js [3371502,3372152), UTF-16: Shell failures carry combined output as stderr.
        if (error instanceof SkillShellFailed) throw new SkillCommandFailed(`Shell command failed for pattern "${entry.raw}": ${error.message.trim() ? `[stderr]\n${error.message.trim()}` : ''}`);
        throw error;
      }
      if (effect) journal!.finish(effect, 'finished');
      const session = options.session?.();
      const directory = skillResultsDirectory(session);
      const mapped = skillShellText([bytes]);
      let output = mapped;
      if (directory && mapped.length > 30000) {
        // Shell copy/mapper sfn1dbxq [4335357,4336747)/[4342500,4346000),
        // dCe 566cpr3w [2354,6616), UTF-16. The bounded collector is host-owned.
        let temp: string | undefined;
        const destination = join(directory, `${randomUUID()}.txt`);
        let published = false;
        let pin: Awaited<ReturnType<typeof pinSkillResult>> | undefined;
        try {
          temp = await mkdtemp(join(tmpdir(), 'skill-output-'));
          await writeFile(join(temp, 'output'), bytes, { flag: 'wx' });
          pin = await pinSkillResult(destination);
          options.session?.();
          signal.throwIfAborted();
          await pin.recheckBeforeWrite();
          const size = await copySkillOutput(join(temp, 'output'), pin.ioPath, 64 * 1024 * 1024);
          await pin.recheckBeforeWrite();
          options.session?.();
          signal.throwIfAborted();
          const { preview, hasMore } = skillOutputPreview(mapped, 2000);
          const notice = size >= 64 * 1024 * 1024
            ? `Output exceeded the 64 MiB persist limit; only the first 64 MiB were saved to: ${destination}`
            : `Output too large (${size} bytes). Full output saved to: ${destination}`;
          output = `${notice}\n\nPreview (first 2000 characters):\n${preview}${hasMore ? '\n...\n' : '\n'}`;
          published = true;
        } catch {
          options.session?.();
          signal.throwIfAborted();
          output = mapped;
        } finally {
          if (!published && pin) {
            try { await pin.recheckBeforeWrite(); await rm(pin.ioPath, { force: true }); } catch {}
          }
          if (pin) await pin.close();
          if (temp) await rm(temp, { recursive: true, force: true });
        }
      } else output = mapped;
      out = out.replace(expand(entry.raw), () => output);
      if (Buffer.byteLength(out) > options.config.maxOutputBytes) throw new Error('Expanded skill output byte limit exceeded');
    })));
    // Append only to instructions; fallback text must never extend a shell command.
    out += withArguments.slice(expanded.length);
    if (Buffer.byteLength(out) > options.config.maxOutputBytes) throw new Error('Expanded skill output byte limit exceeded');
    return out;
}

function overlayHooks(parent: HooksConfig | undefined, extra: HooksConfig | undefined): HooksConfig | undefined {
  if (!extra) return parent ? structuredClone(parent) : undefined;
  const hooks = structuredClone(parent ?? {});
  for (const event of Object.keys(extra) as (keyof HooksConfig)[]) hooks[event] = [...(hooks[event] ?? []), ...(extra[event] ?? [])];
  return hooksSchema.parse(hooks);
}

// qe, htgmc2p1 [3899,4257); UF, sfn1dbxq [2969279,2973000), UTF-16.
// Hook commands keep the HOME observed at their own approval, including across awaits.
export async function prepareSkillHooks(skill: SkillInfo, options: SkillExecutionOptions, approvalValid?: () => boolean): Promise<{
  hooks: HooksConfig | undefined; hookHomes: ReadonlyMap<string, HookCommandHome>;
}> {
  const hooks = overlayHooks(options.config.hooks, skill.hooks);
  const hookHomes = new Map<string, HookCommandHome>();
  if (skill.hooks && hooks) {
    hooksSchema.parse(skill.hooks);
    for (const event of HOOK_EVENTS) {
      const parentEntries = options.config.hooks?.[event]?.length ?? 0;
      for (const { definition, entryIndex, identity } of flattenHookDefinitions(hooks, event)) {
        if (entryIndex < parentEntries || !('command' in definition)) continue;
        const home = { value: process.env.HOME };
        await approve(commandTool, { command: definition.command }, options, true);
        if (approvalValid && !approvalValid()) throw new Error('Session approval unavailable');
        hookHomes.set(identity.key, home);
      }
    }
  }
  return { hooks, hookHomes };
}

export function skillRequiresExecution(skill: SkillInfo, config?: SessionConfig): boolean {
  return skill.context === 'fork' || skill.model !== undefined || skill.effort !== undefined || skill.background === true ||
    skill.agent !== undefined || skill.hooks !== undefined || skill.allowedTools !== undefined || skill.disallowedTools !== undefined || skill.command !== undefined || skill.shell !== undefined ||
    (config?.features?.skillInlineCommands === true && skillCommands(skill.body).length > 0);
}

// Source prompt dispatch, chunk-htgmc2p1 [32924,36500), UTF-16; host fork envelope adaptation in W385.
export function skillReturnsForkResult(skill: SkillInfo): boolean {
  return skill.context === 'fork' || skill.model !== undefined || skill.effort !== undefined || skill.background === true || skill.hooks !== undefined || skill.disallowedTools !== undefined;
}

/** getPromptForCommand, sfn1dbxq [963598,964251), UTF-16; budget and execution share pinned expansion. */
export async function executeSkill(skill: SkillInfo, args: string, options: SkillExecutionOptions): Promise<string> {
  if (options.source === 'user') consumeHumanSkillAuthorization(options.humanAuthorization, options.session?.(), skill.name, args, options.signal);
  options.signal.throwIfAborted();
  options.session?.();
  const invocation = options.effectJournal?.invocation(skill.name);
  skill = structuredClone(skill);
  const owner = permissionOwner(options.config.permissions);
  options = { ...options, config: structuredClone(options.config), tools: [...options.tools] };
  if (owner) bindPermissionOwner(options.config.permissions, owner);
  if (options.source === 'model' && skill.disableModelInvocation) throw new Error('Skill is disabled for model invocation');
  if (options.source === 'user' && !skill.userInvocable) throw new Error('Skill is hidden from user invocation');
  if (skill.agent !== undefined && skill.context !== 'fork') throw new Error('Skill agent routing requires context: fork');
  const route = skill.agent === undefined ? undefined : resolveChildLaunch(options.config,
    { subagent_type: skill.agent, ...(skill.model ? { model: skill.model } : {}), ...(skill.effort ? { effort: skill.effort } : {}) },
    { enableAdvanced: options.config.features?.agentTypes !== false, agentTypes: options.config.agentTypes });
  if (route?.isolation && !options.registry) throw new Error('Isolated skill agent requires a session-owned agent registry');
  const conversation = skillConversation(skill, options);
  checkConversationBudget(conversation, expandSkill(skill.body, args, { sourceArguments: options.config.features?.skillSourceArguments === true,
    quotedArguments: options.config.features?.skillQuotedArguments === true,
    extendedArguments: options.config.features?.skillExtendedArguments === true,
    argumentNames: skill.argumentNames,
    appendUnusedArguments: options.config.features?.skillSourceArguments === true || options.config.features?.skillArgumentFallback === true }), options.config);
  const fork = skillReturnsForkResult(skill);
  // zyn [1892,4679), Re [13917,14750), half-open UTF-16: reaching the
  // asynchronous spawn cap falls through to the foreground fork.
  const withinBackgroundLimit = skill.background === true && childSpawnDepth(options.config) <= maxSubagentSpawnDepth();
  const hasLiveFork = () => options.hasLiveForkedSkill?.(skill.name) || options.registry?.hasLiveForkedSkill(skill.name);
  const mayStartBackground = withinBackgroundLimit && !hasLiveFork();
  if (mayStartBackground && !options.registry) options.registry = options.backgroundRegistry?.();
  if (mayStartBackground && !options.registry) throw new Error('Background skill requires a session-owned agent registry');
  const approvalValid = options.registry?.captureApprovalGeneration();
  const { hooks, hookHomes } = await prepareSkillHooks(skill, options, approvalValid);
  options.session?.();
  if (approvalValid && !approvalValid()) throw new Error('Session approval unavailable');
  const commandOwner = options.commandOwner ?? new SkillCommandOwner();
  let body: string;
  try { body = await expandedBody(skill, args, { ...options, commandOwner }, invocation); }
  finally { if (!options.commandOwner) void commandOwner.drain().then(() => commandOwner.close()); }
  const parentSession = options.session?.();
  if (approvalValid && !approvalValid()) throw new Error('Session approval unavailable');
  if (!fork) return body;
  let currentSkill = skill;
  const childOwner = owner && {
    prepareAutoMode: () => owner.prepareAutoMode?.(),
    state: () => childPermissionState(owner.state(), currentSkill.allowedTools),
    workingDirectories: (readOnly: boolean) => owner.workingDirectories(readOnly),
    adoptUpdates: owner.adoptUpdates,
  };
  if (childOwner) bindPermissionOwner(options.config.permissions, childOwner);
  const config = structuredClone(options.config);
  const model = skill.model ?? route?.model;
  const effort = skill.effort ?? route?.effort;
  if (model !== undefined && model !== 'inherit') config.model = model;
  if (effort !== undefined) config.effort = effort;
  if (hooks !== undefined) config.hooks = hooks;
  const parentNames = new Set(config.tools.map(tool => tool.name));
  const mode = route?.mode ?? 'general';
  const originals = selectChildTools(options.tools, mode, route?.type?.tools).filter(tool => parentNames.has(tool.schema.name) && grant(skill, tool));
  const beforeTool = skillToolApproval(() => currentSkill, options);
  // _Wo [2237279,2239655), Kt [121053,123737), UTF-16: dispatch the approved
  // input through the selected tool, retaining the skill's directory and shell policy.
  const selected = originals.map(tool => bindScopedChildTool(tool, async (input, context) => {
    await beforeTool(tool, input, context.signal, context.workspace, context.planMode?.ownership);
    return { ...context, workingDirectories: context.workingDirectories ?? owner?.workingDirectories, allowShell: context.allowShell && config.allowShell };
  }, 'after-approval'));
  config.tools = selected.map(tool => ({ ...tool.schema, eager_input_streaming: true }));
  const child = childConfig(config, selected, { mode, max_turns: Math.min(config.maxTurns, route?.max_turns ?? config.maxTurns), ...(route?.type ? { type: route.type } : {}) });
  // oh/En, chunk-bf3z2ftn [43591,43758), UTF-16: source reads the live session root.
  // This host's fork needs the immediate owner, not an inferred child root identity.
  const parentSessionId = parentSession?.id ?? options.parentSessionId;
  if (parentSessionId !== undefined) child.parentSessionId = parentSessionId;
  if (options.parentPlanId !== undefined) child.parentPlanId = options.parentPlanId;
  checkConversationBudget(conversation, body, child);
  // zyn rechecks the live tasks after asynchronous preparation, immediately before registration.
  const background = mayStartBackground && !hasLiveFork();
  if (background || route?.isolation) {
    // Registry builds its own child prefix; carry only the authored type body once.
    const registryConfig = structuredClone(config);
    if (route?.type?.body) registryConfig.system += '\n\nAgent instructions:\n' + route.type.body;
    const descriptor = await options.registry!.launch({ prompt: body, mode, max_turns: Math.min(child.maxTurns, 30), background,
      ...(model && model !== 'inherit' ? { model } : {}), ...(route?.isolation ? { isolation: route.isolation } : {}) }, options.signal,
      { config: registryConfig, tools: originals, beforeTool, permissionOwner: childOwner, hookHomes,
        skillScope: { skillName: skill.name, attributionName: skill.name, skillPath: skill.path, hookIdentity: JSON.stringify(skill.hooks ?? null), ...(effort !== undefined ? { effort } : {}) },
        skillContinuation: { path: skill.path, hooks: JSON.stringify(skill.hooks ?? null), approvalValid, update: next => { currentSkill = next; } },
        ...(conversation !== undefined ? { conversation } : {}) });
    if (!background) return capChildOutput(JSON.stringify({ session_id: descriptor.session_id, reason: descriptor.reason, text: descriptor.summary, model_calls: descriptor.model_calls }), config.maxOutputBytes);
    return capChildOutput(JSON.stringify(descriptor), config.maxOutputBytes);
  }
  // The executor wrapper owns the original policy, including post-hook inputs.
  // Agent's outer check delegates to it so one input asks only once.
  child.permissions = { mode: 'bypass', allow: [], deny: [] };
  const session = Session.open(config.workspace, { config: child });
  if (childOwner) session.inheritPermissionAdoption(childOwner);
  let agent: Agent | undefined;
  let asyncHooks: ReturnType<typeof createChildHookLifecycle> | undefined;
  try {
    for (const message of conversation ?? []) session.append({ kind: 'message', message });
    if (conversation !== undefined) session.append({ kind: 'turn_end', reason: 'fork_seed' });
    asyncHooks = createChildHookLifecycle(session, { hookOptions: options.hookOptions, terminalSequence: options.terminalSequence,
      onHookCompletion: options.onHookCompletion }, hookHomes);
    agent = new Agent(session, options.provider, selected, { text: options.onText, hookOptions: asyncHooks.hookOptions,
      ...(options.instructionFiles ? { instructionFiles: paths => options.instructionFiles!(session.config.workspace, paths) } : {}),
      ...(options.terminalSequence ? { terminalSequence: sequence => options.terminalSequence!(session.id, sequence) } : {}),
      ...(options.stopState ? { stopState: options.stopState } : {}) });
    await agent.startSession(conversation !== undefined ? 'fork' : 'startup', options.signal);
    const result = await agent.run(body, options.signal, undefined, undefined, [], undefined, { kind: 'child', source: 'skill' });
    return capChildOutput(JSON.stringify({ session_id: session.id, reason: result.reason, text: result.text, model_calls: result.modelCalls }), config.maxOutputBytes);
  } finally {
    try { await agent?.endSession(options.signal.aborted ? 'interrupt' : 'other'); }
    finally {
      try { await asyncHooks?.close(); }
      finally { session.close(); }
    }
  }
}
