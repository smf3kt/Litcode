import { cellWidth } from './terminal.js';
import { tokenizeAnsi } from './tui-ansi-tokenizer.js';
import { Vnt } from './tui-render-host.js';

/** Host boundaries for the recovered formatter; style and theme bodies are copied. */
const identity = (text: string): string => text;
export { ge } from './tui-color.js';
export { Wn } from './tui-theme-brush.js';
export { Nx } from './tui-text-style.js';
export const pn = (text: string) => tokenizeAnsi(text).filter(token => token.type === 'text')
  .map(token => token.value).join('');
export const ae = (text: string) => cellWidth(pn(text));
export const a = process.env;
export const uw = () => false;
export const vi = (text: string, count: number) => text.repeat(Number.isFinite(count) && count > 0 ? count : 0);
export function Lt(text: string, part: string, from = 0): number {
  let count = 0, index = text.indexOf(part, from);
  while (index !== -1) { count++; index = text.indexOf(part, index + 1); }
  return count;
}
export const uG = /[\x00-\x1f\x7f-\x9f]/;
export const tu = '⧉';
export const Dvo = '▎';
export const o0n = String.raw`\s⠀￹-￻\p{Cc}\p{M}\p{Default_Ignorable_Code_Point}`;
export function cT(code: number): boolean {
  return code <= 31 || code >= 127 && code <= 159 || code === 173 || code === 1564
    || code >= 8203 && code <= 8207 || code === 8232 || code === 8233 || code >= 8234 && code <= 8238
    || code >= 8288 && code <= 8297 || code >= 65024 && code <= 65039 || code === 65279
    || code >= 65529 && code <= 65531 || code === 94180 || code >= 917504 && code <= 917999;
}
export const j1r = (href: string, text: string) => text === href || href === `http://${text}` || href === `https://${text}`;
export function dw(href: string, text?: string, options?: { shownUrlStart?: string; supportsHyperlinks?: boolean }): string {
  const label = text === undefined ? undefined : pn(text), same = label === undefined || j1r(href, label);
  const start = options?.shownUrlStart ?? '';
  if (options?.supportsHyperlinks) return Vnt(href) + (text ?? start + href) + Vnt(undefined);
  return text !== undefined && !same ? `${text}${start} (${href})` : `${start}${href}`;
}
// The host has no artifact-link service or hyperlink-enabled terminal formatter.
export const Gkr = (_href: string) => false;
export const Mvo = identity;
export const mxn = identity;
export const Koo = identity;
export const Xoo = (href: string) => [href];
export const vfr = (_href: string, _variants: readonly string[]) => false;
const memoryTags = ['cc-memory', 'cc_memory', 'ccmemory', 'CC-MEMORY', 'CC_MEMORY', 'CCMEMORY'].join('|');
const memoryTagPattern = new RegExp(`</?(?:${memoryTags})(?=[\\s/>])[^>]{0,1024}>`, 'g');
// zh, 2bcyxj9q [83349,83388), UTF-16; full-response copying retains analysis content.
export function zh(e: string) { return e.replace(memoryTagPattern, ''); }
export const mK = (text: string) => zh(text.replace(/<(commit_analysis|context|function_analysis|pr_analysis)>.*?<\/\1>\n?/gs, '')).replace(/^\n+/, '');
export const WTr = () => null;
export const DP = (_host: unknown) => '';
export const f8e = (host: string) => host;
export const nr = 'github.com';
export const Ge = <T>(value: T, _reset: (value: T) => void): T => value;
export class q<T> {
  constructor(private readonly create: () => T) {}
  of(): T { return this.create(); }
}
export class Kc {
  private readonly values = new Map<string, unknown>();
  constructor(_options: { max: number; ttl: number }) {}
  get(key: string): unknown { return this.values.get(key); }
  set(key: string, value: unknown): void { this.values.set(key, value); }
}
