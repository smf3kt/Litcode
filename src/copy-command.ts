/**
 * The `/copy` command. Recovered from `chunk-c283tj3z.js`, sha256
 * `79b675ce7d1fe271ccc2fb0ba60f71b9899f5a7ac9e98a5fafe7582c1a7c82af` (23 030 bytes), at these
 * ranges:
 *
 * | Symbol | Offset | Contents |
 * | --- | --- | --- |
 * | `re`/`ge`/`Ue` | 16481/16498/16511 | `response.md`, `copy.md`, 20 |
 * | `bt`/`wt` | 16171/16290 | the block labels |
 * | `Ye` | 17750 | the recent assistant texts, newest first |
 * | `ye` | 17979 | the file extension from a language token |
 * | `ue` | 18085 | the temp-file write |
 * | `A` | 18207 | the copy action and its report |
 * | `Be` | 18528 | the block selector |
 * | `kt`/`cn` | 22222/22233 | the block label width and the command handler |
 *
 * Offsets are zero-based UTF-16 code units.
 *
 * Two recovered pieces are out. `Ge` normalizes markdown tables before copying and needs the
 * vendor markdown tokenizer (`FXe` over `Cm`), so the copied text keeps the table source the model
 * wrote. `_xn`'s control-character advisory is imported from a module this host has not located, so
 * its branch is absent; the base report is byte-identical to the recovered no-advisory case.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Source `Ue` in `chunk-c283tj3z.js` 16511: how many responses `/copy N` can reach. */
export const COPY_RESPONSE_LIMIT = 20;

/** Source `re` in `chunk-c283tj3z.js` 16481. */
export const COPY_FILE_NAME = 'response.md';

/** Source `kt` in `chunk-c283tj3z.js` 22222: the width a block label is cut to. */
const BLOCK_LABEL_WIDTH = 120;

/** One assistant turn's copyable text, as `Ye` collects it. */
type CopySource = { role?: string; content?: unknown };

/**
 * Source `Ye(l)` in `chunk-c283tj3z.js` 17750: walk the transcript newest-first, keep each
 * assistant turn whose text blocks join to something non-empty, and stop at `Ue`.
 */
export function copyResponses(messages: readonly CopySource[]): string[] {
  const found: string[] = [];
  for (let index = messages.length - 1; index >= 0 && found.length < COPY_RESPONSE_LIMIT; index--) {
    const message = messages[index];
    if (message?.role !== 'assistant' || !Array.isArray(message.content)) continue;
    const text = message.content.map(block => {
      const typed = block as { type?: string; text?: string };
      return typed.type === 'text' ? typed.text ?? '' : '';
    }).filter(Boolean).join('\n\n');
    if (text) found.push(text);
  }
  return found;
}

/** Source `ye(l)` in `chunk-c283tj3z.js` 17979. */
export function copyFileExtension(language: string | undefined): string {
  if (language) {
    const token = language.replace(/[^a-zA-Z0-9]/g, '');
    if (token && token !== 'plaintext') return `.${token}`;
  }
  return '.txt';
}

/** A copyable block, as `Je` classifies one. */
export type CopyBlock = { kind: 'code' | 'quote'; text: string; lang?: string };

/**
 * Source `bt`/`wt` in `chunk-c283tj3z.js` 16171/16290: a code block is labelled by its first non-empty
 * line cut to 120 units, a quote by its own text.
 */
export function copyBlockLabel(block: CopyBlock): string {
  if (block.kind !== 'code') return block.text.length > BLOCK_LABEL_WIDTH
    ? `${block.text.slice(0, BLOCK_LABEL_WIDTH)}…` : block.text;
  const first = block.text.split('\n').find(line => line.trim() !== '');
  if (first === undefined) return '(code block)';
  return first.length > BLOCK_LABEL_WIDTH ? `${first.slice(0, BLOCK_LABEL_WIDTH)}…` : first;
}

export type CopyArgument =
  | { kind: 'latest' }
  | { kind: 'index'; index: number }
  | { kind: 'usage'; got: string }
  | { kind: 'too-many'; count: number };

/**
 * Source `cn`'s argument arm in `chunk-c283tj3z.js` 22233. `available` is what `Ye` returned, so
 * the bound is checked before the index is used.
 */
export function parseCopyArgument(argument: string, available: number): CopyArgument {
  const value = argument.trim();
  if (value === '') return { kind: 'latest' };
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return { kind: 'usage', got: value };
  if (number > available) return { kind: 'too-many', count: available };
  return { kind: 'index', index: number - 1 };
}

/** Source the `No assistant message to copy` and `Only N assistant messages` returns in `cn`. */
export function copyEmptyMessage(): string { return 'No assistant message to copy'; }
export function copyTooManyMessage(count: number): string {
  return `Only ${count} assistant ${count === 1 ? 'message' : 'messages'} available to copy`;
}
export function copyUsageMessage(got: string): string {
  return `Usage: /copy [N] where N is 1 (latest), 2, 3, … Got: ${got}`;
}

/** Source `A`'s report template in `chunk-c283tj3z.js` 18207. */
export function copyReport(text: string, filePath: string | undefined): string {
  const lines = text.split('\n').length;
  const report = `Copied to clipboard (${text.length} characters, ${lines} lines)`;
  return filePath === undefined ? report : `${report}\nAlso written to ${filePath}`;
}

/**
 * Source `ue(l, a)` in `chunk-c283tj3z.js` 18085: the copy also lands in a file under the session's
 * scratch directory, so a terminal that declines OSC 52 still leaves the text somewhere. The
 * recovered `tc()` is per session; this host has no session temp directory, so the process id
 * stands in for it and keeps two running sessions from overwriting each other's `response.md`.
 */
export function copyScratchDirectory(pid = process.pid): string {
  return path.join(os.tmpdir(), 'litcode-copy', String(pid));
}

export function writeCopyFile(text: string, directory = copyScratchDirectory()): string {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, COPY_FILE_NAME);
  fs.writeFileSync(file, text, { encoding: 'utf8', mode: 0o600 });
  return file;
}
