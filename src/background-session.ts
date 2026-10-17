// Background session fork.
//
// Source: the REPL background handler `_1s` (chunk-24k7d6mw.js offset 38204)
// refuses a disabled persistence, requires a seed from `fBe` (offset 51242) and
// opens the confirmation path; the spawn core `gft` (offset 38766) forks the
// conversation into a child CLI that resumes the fork. This product has no
// background-job registry for sessions and always persists, so the local
// adaptation materializes the fork with `forkSession` and starts the child
// headless (`--resume <fork> <prompt>`), which keeps the same observable
// contract: a new session with a `fork` branch record runs one task, writes its
// journal, and can be resumed later while the parent keeps running.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { forkSession } from './sessions.js';
import type { Session } from './session.js';

/** `_1s`'s gate text when the conversation has nothing to carry over. */
export const NOTHING_TO_BACKGROUND = 'Nothing to background yet — send a message first.';

/** `fBe`'s seed: the short intent shown for the task and the last assistant line. */
export type BackgroundSeed = { intent: string; detail?: string };
export type BackgroundSession = { sessionId: string; pid: number | undefined; log: string };

export type BackgroundStartOptions = {
  session: Session;
  prompt: string;
  /** CLI entry and runtime; defaults to this process's. */
  entry?: string;
  executable?: string;
  /** Node options for the child; defaults to this process's `execArgv`. */
  execArgv?: readonly string[];
  /** Test seam; defaults to `node:child_process.spawn`. */
  spawnProcess?: typeof spawn;
};

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
 *  explicit prompt yields null. */
export function backgroundSeed(messages: readonly Anthropic.MessageParam[], prompt: string): BackgroundSeed | null {
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
  return { intent: truncate(intent || '(backgrounded)', 200), ...(detail === undefined ? {} : { detail }) };
}

/** Fork the conversation and start one detached headless child on the fork.
 *  The fork is written before the spawn, so the child has a complete journal even
 *  if the parent exits immediately. A spawn failure removes the unused fork. */
export function startBackgroundSession(options: BackgroundStartOptions): BackgroundSession {
  const seed = backgroundSeed(options.session.messages, options.prompt.trim());
  if (seed === null) throw new Error(NOTHING_TO_BACKGROUND);
  const executable = options.executable ?? process.execPath;
  const entry = options.entry ?? process.argv[1];
  if (!entry) throw new Error("Couldn't fork — the CLI entry point is unknown.");
  const task = options.prompt.trim() || seed.intent;
  const fork = forkSession(options.session);
  const workspace = fork.config.workspace;
  try { fork.close(); } catch { /* The fork journal is already durable. */ }
  const directory = path.join(workspace, '.agent', 'background');
  fs.mkdirSync(directory, { recursive: true });
  const log = path.join(directory, `${fork.id}.log`);
  let fd: number | undefined;
  try {
    fd = fs.openSync(log, 'a');
    const child = (options.spawnProcess ?? spawn)(executable,
      [...(options.execArgv ?? process.execArgv), entry, '--resume', fork.id, task], {
        cwd: workspace, detached: true, stdio: ['ignore', fd, fd],
      });
    child.unref();
    return { sessionId: fork.id, pid: child.pid, log };
  } catch (error) {
    try { fs.rmSync(fork.file, { force: true }); } catch { /* Best effort after a failed spawn. */ }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Couldn't fork — ${message}`);
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* Already closed on spawn failure. */ } }
  }
}
