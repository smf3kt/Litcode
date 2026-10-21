/**
 * `/export` — `ho` (chunk-3f62mcb0.js 25000-ish, `call`) and its dialog `S` at 22600.
 * The filename builder is `wcn` (chunk-p3r9fahb.js 662); the path resolver is `et`
 * (chunk-wh2vcbh8.js 3533). Offsets are zero-based UTF-16 code units.
 *
 * The source renders the transcript through `VBe` (chunk-3gz7s57c.js 189735), which mounts the
 * vendor transcript surface and joins its text rows. This host has no off-screen transcript
 * renderer, so `exportTranscriptText` lays the same conversation out as plain text: user lines
 * keep the transcript's `> ` prefix, assistant text follows, messages are blank-line separated.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';

export const EXPORT_DIALOG_TITLE = 'Export conversation';
export const EXPORT_DIALOG_SUBTITLE = 'Select export method';
export const EXPORT_CLIPBOARD_LABEL = 'Copy to clipboard';
export const EXPORT_CLIPBOARD_DESCRIPTION = 'Copy the conversation to your system clipboard';
export const EXPORT_FILE_LABEL = 'Save to file';
export const EXPORT_FILE_DESCRIPTION = 'Save the conversation to a file in the current directory';
export const EXPORT_FILENAME_PROMPT = 'Enter filename:';
export const EXPORT_CANCELLED = 'Export cancelled';
export const exportCopiedMessage = (): string => 'Conversation copied to clipboard';
export const exportSavedMessage = (file: string): string => `Conversation exported to: ${file}`;
export const exportFailedMessage = (error: unknown): string =>
  `Failed to export conversation: ${error instanceof Error ? error.message : 'Unknown error'}`;

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.flatMap(block => block !== null && typeof block === 'object' &&
    (block as { type?: unknown }).type === 'text' && typeof (block as { text?: unknown }).text === 'string'
    ? [(block as { text: string }).text] : []).join('\n');
}

/** `VBe`'s joined transcript rows, reduced to the conversation text this host owns. */
export function exportTranscriptText(messages: readonly Anthropic.MessageParam[]): string {
  const parts: string[] = [];
  for (const message of messages) {
    const text = textOf(message.content).trim();
    if (text === '') continue;
    parts.push(message.role === 'user' ? text.split('\n').map(line => `> ${line}`).join('\n') : text);
  }
  return parts.length === 0 ? '' : `${parts.join('\n\n')}\n`;
}

/** `wcn` 662: the first user message, trimmed, capped at 50 with `…`, then slugged. */
function firstUserText(messages: readonly Anthropic.MessageParam[]): string {
  const message = messages.find(candidate => candidate.role === 'user');
  if (message === undefined) return '';
  let text: string;
  const content = message.content;
  if (typeof content === 'string') text = content.trim();
  else {
    const block = content.findLast(candidate => candidate.type === 'text');
    text = block !== undefined && 'text' in block ? block.text.trim() : '';
  }
  // `Ar` trims the trailing newlines only.
  text = text.replace(/\n+$/u, '');
  if (text.length > 50) text = text.substring(0, 49) + '…';
  return text;
}

/** `/^[a-z0-9\s-]/` removal, space runs to `-`, collapse and trim (chunk-p3r9fahb.js `c`). */
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function timestamp(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/** `wcn` 662: `<timestamp>-<slug>.txt`, or `conversation-<timestamp>.txt` without user text. */
export function exportDefaultFilename(messages: readonly Anthropic.MessageParam[], now = new Date()): string {
  const stamp = timestamp(now);
  const slug = slugify(firstUserText(messages));
  return slug === '' ? `conversation-${stamp}.txt` : `${stamp}-${slug}.txt`;
}

/**
 * `ce` + `et` 3533: append `.txt` when the raw name has no extension, then resolve `~`, `~/…`,
 * absolute and relative names. The source's base is its launch directory; this host uses the
 * session workspace, which is the working directory the CLI presents.
 */
export function exportTargetPath(filename: string, baseDir: string): string {
  const raw = filename.trim();
  if (raw.includes('\0')) throw new Error('Path must not contain NUL');
  const named = path.extname(raw) === '' ? `${raw}.txt` : raw;
  if (named === '') throw new Error('Path must be a string, received empty');
  if (named.startsWith('~/')) return path.join(os.homedir(), named.slice(2));
  return path.isAbsolute(named) ? path.resolve(named) : path.resolve(baseDir, named);
}

/** `h` in chunk-3f62mcb0.js 22000-ish: mkdir -p, then a flushed UTF-8 write. */
export function writeConversationExport(filename: string, content: string, baseDir: string): string {
  const target = exportTargetPath(filename, baseDir);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, { encoding: 'utf8', flush: true });
  return target;
}
