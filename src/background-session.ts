// Background session fork.
//
// Source: the REPL background handler `_1s` (chunk-24k7d6mw.js offset 38204)
// refuses a disabled persistence, requires a seed from `fBe` (offset 51242) and
// opens the confirmation path; the spawn core `gft` (offset 38766) forks the
// conversation into a child CLI that resumes the fork.
import { spawn, type ChildProcess } from 'node:child_process';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { forkSession } from './sessions.js';
import type { Session } from './session.js';

/** `_1s`'s gate text when the conversation has nothing to carry over. */
export const NOTHING_TO_BACKGROUND = 'Nothing to background yet — send a message first.';

/** `fBe`'s seed: the short intent shown for the task and the last assistant line. */
export type BackgroundSeed = { intent: string; detail?: string };
export type BackgroundSession = { sessionId: string; pid: number | undefined; log: string; ready?: Promise<void>;
  /** `gft`'s `relocatedTo`: the copy runs in this directory instead of the parent's checkout. */
  relocatedTo?: string };

/** qBe [64775,65099), chunk-78w3rfp3.js: open the copy in this terminal using the host's resume CLI. */
export function backgroundResumeCommand(copy: Pick<BackgroundSession, 'sessionId' | 'relocatedTo'>,
  workspace: string): string {
  const target = (copy.relocatedTo ?? workspace).replace(/'/g, "'\\''");
  return `litcode --workspace '${target}' --resume ${copy.sessionId} --interactive`;
}

/** `Ait` (chunk-hwpb27as.js 44060): the briefing cannot open a `system-reminder` block. */
export function escapeBriefing(text: string): string {
  return text.replace(/<(?=\s*(?:\/\s*)?system-reminder\b)/gi, '&lt;');
}

export type BackgroundStartOptions = {
  session: Session;
  prompt: string;
  /** U [20040,21857) passes only the typed prompt; the background adapter resumes the seed task. */
  mode?: 'fork' | 'background';
  /** `fBe`'s fallback name; `/fork` passes `(forked)`, `/background` keeps the default. */
  seedFallback?: string;
  /** `gft`'s `Fo`: the briefing the copy carries about the original checkout. `gft` writes it as
   *  the `fork_briefing` record at the fork point, which the reader turns into one `isMeta` user
   *  message (`chunk-sfn1dbxq.js` 4468231). */
  briefing?: string;
  /** `gft`'s `po`: the copy is relocated to this directory before the spawn. The host's journal
   *  identity is per workspace, so the caller supplies the relocation body. */
  relocatedTo?: string;
  /** `gft`'s `_t`: `{...h, name: at}` renames the copy before the spawn. `at` is the parent's name
   *  and the prompt joined by the fork glyph, or the glyph and the prompt alone. */
  name?: string;
  relocate?: (source: Session, target: string) => Session;
  /** CLI entry and runtime; defaults to this process's. */
  entry?: string;
  executable?: string;
  /** Node options for the child; defaults to this process's `execArgv`. */
  execArgv?: readonly string[];
  /** Test seam; defaults to `node:child_process.spawn`. */
  spawnProcess?: typeof spawn;
  signal?: AbortSignal;
};

const residentReadySchema = z.object({ type: z.literal('resident_ready'), sessionId: z.string().uuid() }).strict();

// ze, 78w3rfp3 [41585,44660), UTF-16: acknowledge the owned worker before reporting dispatch success.
function residentReady(child: ChildProcess, sessionId: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      child.off('message', message); child.off('error', failed); child.off('exit', exited);
      if (child.connected) child.disconnect();
    };
    const failed = (error: Error) => {
      if (settled) return;
      settled = true; cleanup();
      if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) { reject(error); return; }
      const force = setTimeout(() => { child.kill('SIGKILL'); }, 5000);
      child.once('exit', () => { clearTimeout(force); reject(error); });
      child.kill('SIGTERM');
    };
    const abort = () => failed(new Error('Fork startup interrupted'));
    const exited = () => failed(new Error('Fork worker exited before its inbox was ready'));
    const message = (value: unknown) => {
      const parsed = residentReadySchema.safeParse(value);
      if (!parsed.success || parsed.data.sessionId !== sessionId || settled) return;
      settled = true; cleanup(); resolve();
    };
    const timer = setTimeout(() => failed(new Error('Fork worker inbox startup timed out')), 10000);
    child.on('message', message); child.once('error', failed); child.once('exit', exited);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

/** `ne` (chunk-ax7r0qj7.js offset 1128): cut at UTF-16 units without splitting a pair. */
function truncate(text: string, max: number): string {
  if (max <= 0) return '';
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const last = head.charCodeAt(max - 1);
  return last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head;
}

/** `TF` (chunk-sfn1dbxq.js offset 4432714): assistant text blocks joined by newline. */
function assistantText(message: Anthropic.MessageParam): string | undefined {
  if (message.role !== 'assistant' || typeof message.content === 'string') return undefined;
  const text = message.content.map(block => block.type === 'text' ? block.text : '').filter(Boolean).join('\n').trim();
  return text || undefined;
}

/** `zg` over `rb` (chunk-sfn1dbxq.js offsets 4432935/4433793): user text blocks joined by newline. */
function userText(message: Anthropic.MessageParam): string | undefined {
  if (message.role !== 'user') return undefined;
  if (typeof message.content === 'string') return message.content;
  const text = message.content.map(block => block.type === 'text' ? block.text : '').filter(Boolean).join('\n').trim();
  return text || undefined;
}

/** `N_` (chunk-sfn1dbxq.js offset 4422125): a user message carrying tool results. */
function hasToolResult(message: Anthropic.MessageParam): boolean {
  return message.role === 'user' && typeof message.content !== 'string' &&
    message.content.some(block => block.type === 'tool_result');
}

/** `O$` (chunk-r2vtj1kh.js offset 164599) with the tag names of
 *  chunk-gsnbskq4.js offset 8723: command, bash and task-notification records. */
const COMMAND_TAGS = ['local-command-stdout', 'local-command-stderr', 'command-message', 'bash-input', 'task-notification', 'command-name'];
function commandText(text: string): boolean {
  return COMMAND_TAGS.some(tag => text.startsWith(`<${tag}>`));
}

/** Local meta messages have no `isMeta` journal flag; these prefixes are the
 *  two kinds this harness appends (agent.ts hook and stop feedback). */
function metaText(text: string): boolean {
  return text.startsWith('Hook context:') || text.startsWith('Stop hook feedback:');
}

/** `fBe`: walk backward for the latest real user text (unless an explicit
 *  prompt is given) and the latest assistant text. No real user text and no
 *  explicit prompt yields null. `fallback` is `fBe`'s third parameter, the name
 *  the copy gets when only command rows were seen: `(backgrounded)` for
 *  `/background`, `(forked)` for the open-fleet `/fork` (`Ue`). */
export function backgroundSeed(messages: readonly Anthropic.MessageParam[], prompt: string,
  fallback = '(backgrounded)'): BackgroundSeed | null {
  let intent = prompt;
  let seenUser = false;
  let detail: string | undefined;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!;
    if (detail === undefined) {
      const text = assistantText(message);
      if (text) detail = truncate(text.replace(/\s+/g, ' ').trim(), 120);
    }
    if (message.role === 'user' && !hasToolResult(message)) {
      const text = userText(message)?.trim();
      if (text && (commandText(text) || metaText(text))) {
        if (text.startsWith('<command-message>')) seenUser = true;
        continue;
      }
      seenUser = true;
      if (!intent && text) intent = text;
    }
    if (seenUser && intent && detail !== undefined) break;
  }
  if (!seenUser && !prompt) return null;
  return { intent: truncate(intent || fallback, 200), ...(detail === undefined ? {} : { detail }) };
}

/** gft [38766,45161), chunk-24k7d6mw.js: save the copy before launching its optional task. */
export function startBackgroundSession(options: BackgroundStartOptions): BackgroundSession {
  const seed = options.seedFallback === undefined
    ? backgroundSeed(options.session.messages, options.prompt.trim())
    : backgroundSeed(options.session.messages, options.prompt.trim(), options.seedFallback);
  if (seed === null) throw new Error(NOTHING_TO_BACKGROUND);
  const executable = options.executable ?? process.execPath;
  const entry = options.entry ?? process.argv[1];
  if (!entry) throw new Error("Couldn't fork — the CLI entry point is unknown.");
  const prompt = options.prompt.trim();
  const task = options.mode === 'fork' ? prompt : prompt || seed.intent;
  // Cn, 78w3rfp3 [49289,55904), UTF-16: an idle intent is separate from the initial task.
  const resident = options.mode === 'fork' && options.session.config.features?.residentForks === true;
  if (resident && options.session.config.features?.crossSessionMessaging !== true) {
    throw new Error('Resident forks require crossSessionMessaging in the pinned session settings');
  }
  options.signal?.throwIfAborted();
  // `gft`'s `po` relocation happens inside the same snapshot copy the fork already takes; this
  // host's journal is workspace-bound, so a relocated copy is opened in the origin tree with the
  // same body `/worktree` uses. A copy that cannot be relocated fails the fork, which is the
  // source's `snapshot_copy_failed` arm rather than a silent copy in the parent's checkout.
  let fork = options.relocatedTo !== undefined && options.relocate !== undefined
    ? options.relocate(options.session, options.relocatedTo)
    : forkSession(options.session);
  // `gft`'s `Uo`: the briefing is written after the fork point, so it must not leave the copy
  // awaiting an answer nobody will give. The source's reader turns it into one `isMeta` user
  // message (`chunk-sfn1dbxq.js` 4468231); here the same row is closed with its own turn boundary,
  // the way a caveat row is (`runBashCommand`).
  if (options.briefing !== undefined) {
    fork.append({ kind: 'message', isMeta: true,
      message: { role: 'user', content: [{ type: 'text', text: escapeBriefing(options.briefing) }] } });
    fork.append({ kind: 'turn_end', reason: 'fork_briefing' });
  }
  // `gft`'s `_t`: the copy is named before it starts, so a later `/sessions` or `/rename` reads the
  // fork's own name instead of the parent's. The recovered name is redacted and bounded to 200
  // characters by the title schema, which is the same bound `fBe`'s intent carries.
  if (options.name !== undefined && options.name !== '') fork.append({ kind: 'title', title: options.name.slice(0, 200) });
  const workspace = fork.config.workspace;
  const relocated = workspace !== options.session.config.workspace;
  try { fork.close(); } catch { /* The fork journal is already durable. */ }
  const directory = path.join(workspace, '.agent', 'background');
  fs.mkdirSync(directory, { recursive: true });
  const log = path.join(directory, `${fork.id}.log`);
  let fd: number | undefined;
  try {
    fd = fs.openSync(log, 'a');
    // gft [38766,45161), UTF-16 omits empty prompt argv; Ye, gvps5cb5 [12827,13238) resumes a REPL.
    if (task === '' && !resident) return { sessionId: fork.id, pid: undefined, log,
      ...(relocated ? { relocatedTo: workspace } : {}) };
    const child = (options.spawnProcess ?? spawn)(executable,
      [...(options.execArgv ?? process.execArgv), entry, '--resume', fork.id,
        ...(resident ? ['--resident-worker'] : []), ...(task === '' ? [] : ['--', task])], {
        cwd: workspace, detached: true, stdio: resident ? ['ignore', fd, fd, 'ipc'] : ['ignore', fd, fd],
      });
    const ready = resident ? residentReady(child, fork.id, options.signal) : undefined;
    child.unref();
    return { sessionId: fork.id, pid: child.pid, log, ...(ready === undefined ? {} : { ready }),
      ...(relocated ? { relocatedTo: workspace } : {}) };
  } catch (error) {
    try { fs.rmSync(fork.file, { force: true }); } catch { /* Best effort after a failed spawn. */ }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Couldn't fork — ${message}`);
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* Already closed on spawn failure. */ } }
  }
}
