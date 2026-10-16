import { cellWidth } from './terminal.js';
import { wrapMessageText } from './tui-wrap.js';
import { tokenizeAnsi } from './tui-ansi-tokenizer.js';
import { NodeCellSegmenter } from './tui-cell-segmenter.js';

export const a = process.env;
export const PH = '\x1b';
export const BS = `${PH}[H`, Zv = `${PH}[2J`, lMt = `${PH}[3J`, Pse = `${PH}[2K`;
export const RZ = `${PH}[r`, qnt = `${PH}]8;;\x07`;
export const mRr = () => `${PH}[K`;
export const KUe = (column: number) => `${PH}[${column}G`;
export const zCo = (count = 1) => count === 0 ? '' : `${PH}[${count}B`;
export const XIs = (count = 1) => `${PH}[${count}S`;
export const JIs = (count = 1) => `${PH}[${count}T`;
export const Rpe = (top: number, bottom: number) => `${PH}[${top};${bottom}r`;
export const TZ = (dx: number, dy: number) => (dx < 0 ? `${PH}[${-dx}D` : dx > 0 ? `${PH}[${dx}C` : '')
  + (dy < 0 ? `${PH}[${-dy}A` : dy > 0 ? `${PH}[${dy}B` : '');
export function cMt(rows: number): string {
  if (rows <= 0) return '';
  let result = '';
  for (let row = 0; row < rows; row++) result += Pse + (row + 1 < rows ? `${PH}[1A` : '');
  return result + `${PH}[G`;
}
export const Vnt = (uri: string | undefined) => uri ? `${PH}]8;;${uri.replace(/[\x00-\x1f\x7f]/g, '')}\x07` : qnt;
export const CGn = tokenizeAnsi;
export const ae = (text: string) => cellWidth(tokenizeAnsi(text).filter(token => token.type === 'text').map(token => token.value).join(''));
export function Nu(text: string, columns: number, options?: { trim?: boolean; hard?: boolean; wordWrap?: boolean }): string {
  return wrapMessageText(text, columns, options);
}
export const vi = (text: string, count: number) => text.repeat(Number.isFinite(count) && count > 0 ? count : 0);
export function t(message: string, _options?: unknown): void {
  if (process.env.LITCODE_DEBUG_RENDER) process.stderr.write(`${message}\n`);
}
export function c(error: unknown): void { t(String(error)); }
export function G(error: unknown): Error { return error instanceof Error ? error : new Error(String(error)); }
export const ot = <T>(error: T, _message: string): T => error;
export class x extends Error { constructor(message: string, _telemetryMessage?: string) { super(message); } }
export class q<T> {
  private readonly values = new WeakMap<object, T>();
  constructor(private readonly create: () => T) {}
  of(owner: object): T {
    let value = this.values.get(owner);
    if (value === undefined) { value = this.create(); this.values.set(owner, value); }
    return value;
  }
}
const host = {};
export const B = () => ({ host });
const claims = new Set<string>();
export const ea = () => ({ claim(key: string) { if (claims.has(key)) return false; claims.add(key); return true; } });
export class r7e {
  private stopped = false;
  didStopImmediatePropagation(): boolean { return this.stopped; }
  stopImmediatePropagation(): void { this.stopped = true; }
}
export const YH = (value: number | undefined, name: string) => {
  if (value !== undefined && !Number.isInteger(value)) t(`${name} should be an integer, got ${value}`);
};
export const uq = () => ({ useAdaptiveDrain: false });
export const zDe = Object.freeze([[1564, 1564], [8234, 8238], [8294, 8297]] as const);
export const zpr = zDe.map(([low, high]) => `\\u{${low.toString(16)}}${high > low ? `-\\u{${high.toString(16)}}` : ''}`).join('');
export const pot = new RegExp(`[${zpr}]`, 'gu');
export const fCt = 16384;
export const _On = (substitute: ConstructorParameters<typeof NodeCellSegmenter>[0], screen: ConstructorParameters<typeof NodeCellSegmenter>[1]) =>
  new NodeCellSegmenter(substitute, screen);

/** Cell-oriented replacement for the source's explicit Bun ANSI slicing call. */
function sliceAnsi(text: string, start: number, end: number): string {
  let cell = 0;
  let result = '';
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const token of tokenizeAnsi(text)) {
    if (token.type === 'sequence') { result += token.value; continue; }
    for (const { segment } of segmenter.segment(token.value)) {
      const width = cellWidth(segment);
      if (cell >= start && cell + width <= end) result += segment;
      cell += width;
    }
  }
  return result;
}
export const Bun = { sliceAnsi, stringWidth: ae };
