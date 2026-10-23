import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FXe } from './tui-markdown.js';
import { Cm } from './tui-markdown-lexer.js';
import { ae, vi, mK, zh, Lt } from './tui-markdown-host.js';
import { ne } from './plugin-chain-source.js';
import { Nx } from './tui-text-style.js';

// c283tj3z [16481,16517), UTF-16. Full source closure and host boundaries in W296.
export const COPY_RESPONSE_LIMIT = 20;
export const COPY_FILE_NAME = 'response.md';
const BLOCK_LABEL_WIDTH = 120;
type CopySource = { role?: string; content?: unknown };
export type CopyBlock = { kind: 'code' | 'quote'; text: string; lang?: string };
type TableCell = { tokens: { raw: string }[] };
type Table = { header: TableCell[]; rows: TableCell[][]; align: (string | null)[] };

/** Ye [17750,17979), UTF-16; journal messages project to the source content array. */
export function copyResponses(messages: readonly CopySource[]): string[] {
  const found: string[] = [];
  for (let index = messages.length - 1; index >= 0 && found.length < COPY_RESPONSE_LIMIT; index--) {
    const message = messages[index];
    if (message?.role !== 'assistant' || !Array.isArray(message.content)) continue;
    const text = message.content.flatMap((block: unknown) => block !== null && typeof block === 'object'
      && 'type' in block && block.type === 'text' && 'text' in block && typeof block.text === 'string'
      ? [block.text] : []).filter(Boolean).join('\n\n');
    if (text) found.push(text);
  }
  return found;
}

// Je/ke/Ve/Ge, c283tj3z [16517,17750), UTF-16. Existing lexer and Node width boundary reused.
export function copyBlocks(l: string): CopyBlock[] {
  let { tokens: a } = FXe(Cm, mK(l)), t: CopyBlock[] = [], o: CopyBlock | undefined;
  for (let u of a) {
    if (u.type === 'space') continue;
    if (u.type !== 'blockquote') {
      if (o = undefined, u.type === 'code') { let c = u; t.push({ kind: 'code', text: c.text, lang: c.lang }); }
      continue;
    }
    let d = u.text.replace(/^\s*\n/, '').trimEnd();
    if (d === '') continue;
    if (o) o.text = `${o.text}\n\n${d}`;
    else o = { kind: 'quote', text: d }, t.push(o);
  }
  return t;
}
function ke(l: TableCell) { return l.tokens.map(a => a.raw).join(''); }
function Ve(l: Table) {
  let a = [l.header.map(ke), ...l.rows.map(m => m.map(ke))]
      .map(m => m.map(f => f.replace(/\|/g, '\\|').replace(/[\r\n]/g, ' '))),
    t = a[0]!.map((m, f) => Math.max(3, ...a.map(g => ae(g[f] ?? '')))),
    o = (m: string[]) => `| ${m.map((f, g) => f + ' '.repeat(Math.max(0, t[g]! - ae(f)))).join(' | ')} |`,
    u = (m: number, f: string | null) => {
      switch (f) {
        case 'center': return `:${vi('-', m - 2)}:`;
        case 'right': return `${vi('-', m - 1)}:`;
        case 'left': return `:${vi('-', m - 1)}`;
        default: return '-'.repeat(m);
      }
    },
    d = `| ${t.map((m, f) => u(m, l.align[f] ?? null)).join(' | ')} |`, [c, ...p] = a;
  return [o(c!), d, ...p.map(o)].join('\n');
}
function Ge(l: string) {
  let { tokens: a } = FXe(Cm, l), t = l, o = 0, u = 0;
  for (let d of a) {
    let c = l.indexOf(d.raw, o);
    if (c === -1) continue;
    if (o = c + d.raw.length, d.type !== 'table') continue;
    let p = d.raw.match(/\n*$/)?.[0] ?? '', m = Ve(d) + p;
    t = t.slice(0, c + u) + m + t.slice(c + d.raw.length + u), u += m.length - d.raw.length;
  }
  return t;
}
export function copyResponseText(text: string): string { return Ge(zh(text)); }

/** ye, c283tj3z [17979,18085), UTF-16. */
export function copyFileExtension(language: string | undefined): string {
  if (language) {
    const token = language.replace(/[^a-zA-Z0-9]/g, '');
    if (token && token !== 'plaintext') return `.${token}`;
  }
  return '.txt';
}

/** ve, c283tj3z [22085,22222), UTF-16; applies to both quotes and code. */
export function copyBlockLabel(block: CopyBlock): string {
  let a = block.text.split('\n').find(o => o.trim() !== '');
  if (a === undefined) return '(code block)';
  let t = ne(a, BLOCK_LABEL_WIDTH);
  return t === a ? a : `${t}…`;
}

export interface CopyPickerRow { value: string; label: string; meta: string[]; description?: string }
/** Be h/wt [16290,16477)/[18528,22085), UTF-16; raw content remains in the command owner. */
export function copyPickerRows(text: string, blocks: readonly CopyBlock[]): CopyPickerRow[] {
  return [{ value: 'full', label: 'Full response', meta: [`${text.length} chars`, `${Lt(text, '\n') + 1} lines`] },
    ...blocks.map((block, index) => ({ value: String(index), label: copyBlockLabel(block),
      meta: [[block.kind === 'quote' ? 'quote' : block.lang, Lt(block.text, '\n') + 1 > 1
        ? `${Lt(block.text, '\n') + 1} lines` : ''].filter(Boolean).join(', ')] })),
    { value: 'always', label: 'Always copy full response', meta: [],
      description: 'Skip this picker in the future (revert via /config)' }];
}
export function copyTarget(text: string, blocks: readonly CopyBlock[], selected: string): { text: string; filename: string } {
  if (selected === 'full' || selected === 'always') return { text, filename: COPY_FILE_NAME };
  const block = blocks[Number(selected)];
  if (!block) throw new Error('Copy selection is unavailable');
  return { text: block.text, filename: block.kind === 'quote' ? 'copy.md' : `copy${copyFileExtension(block.lang)}` };
}

export type CopyArgument = { kind: 'latest' } | { kind: 'index'; index: number }
  | { kind: 'usage'; got: string } | { kind: 'too-many'; count: number };
/** cn [22233,22896), UTF-16. */
export function parseCopyArgument(argument: string, available: number): CopyArgument {
  const value = argument.trim();
  if (value === '') return { kind: 'latest' };
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return { kind: 'usage', got: value };
  if (number > available) return { kind: 'too-many', count: available };
  return { kind: 'index', index: number - 1 };
}
export function copyEmptyMessage(): string { return 'No assistant message to copy'; }
export function copyTooManyMessage(count: number): string {
  return `Only ${count} assistant ${count === 1 ? 'message' : 'messages'} available to copy`;
}
export function copyUsageMessage(got: string): string {
  return `Usage: /copy [N] where N is 1 (latest), 2, 3, … Got: ${got}`;
}

/** A [18207,18528) and _xn, kexg5hxg [10057,10253), UTF-16. */
export function copyReport(text: string, filePath: string | undefined): string {
  const warning = Nx.hasOsc52ClipboardUtf8Bug() && /[^\x00-\x7f]/.test(text)
    ? 'VS Code 1.123/1.124 will mojibake this paste — update to ≥1.125' : null;
  const report = `Copied to clipboard (${text.length} characters, ${Lt(text, '\n') + 1} lines)`;
  return report + (warning ? `\n⚠ ${warning}${filePath === undefined ? '' : '; the file below is unaffected'}` : '')
    + (filePath === undefined ? '' : `\nAlso written to ${filePath}`);
}

/** ue [18085,18207), UTF-16; Node private per-process directory substitutes the session scratch host. */
export function copyScratchDirectory(pid = process.pid): string {
  return path.join(os.tmpdir(), 'litcode-copy', String(pid));
}
export function writeCopyFile(text: string, directory = copyScratchDirectory(), filename = COPY_FILE_NAME): string {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, filename);
  fs.writeFileSync(file, text, { encoding: 'utf8', mode: 0o600 });
  return file;
}
