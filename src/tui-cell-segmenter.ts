import { cellWidth } from './terminal.js';
import { tokenizeAnsi } from './tui-ansi-tokenizer.js';
import { closeAnsiCode, normalizeAnsiStyles } from './tui-style-diff.js';

interface StyleCode { type: 'ansi'; code: string; endCode: string }
interface ScreenEncoding {
  widthMask: number; narrow: number; wide: number; spacerTail: number; spacerHead: number;
  emptyCharIndex: number; spacerCharIndex: number; emptyWord: number; tabWidth: number;
}
interface Segment { char: number; width: number; tab: boolean; run: number }

/**
 * Node host for the observed bs/nf ABI; the source native C++ remains unavailable.
 * Packed cells/runs, intern tables, capacity retry and screen writes follow that
 * ABI. Intl grapheme/width behavior and bidi ordering remain host differences.
 * Provenance and exact source consumers: research/ports/W44-tui-renderer.md.
 */
export class NodeCellSegmenter {
  readonly graphemes = [''];
  readonly sgrKeys = [''];
  readonly sgrCloseKeys = [''];
  readonly uris = [''];
  private readonly charIds = new Map([['', 0]]);
  private readonly styleIds = new Map([['', 0]]);
  private readonly uriIds = new Map([['', 0]]);
  private readonly segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

  constructor(private readonly substitute: readonly (readonly [number, number])[],
    private readonly screen: ScreenEncoding) {}

  segment(text: string, cells: Int32Array, runs: Int32Array, _reorder: boolean): number {
    if (cells.buffer === runs.buffer) throw new TypeError('Cell and run arrays must not overlap');
    const segments: Segment[] = [];
    const pairs: [number, number][] = [];
    let styles: StyleCode[] = [];
    let uri = 0;
    let run = -1;
    const setRun = () => {
      const key = styles.map(style => style.code).join('\x00');
      const style = this.intern(key, this.sgrKeys, this.styleIds);
      this.sgrCloseKeys[style] = styles.map(item => item.endCode).join('\x00');
      const last = pairs.at(-1);
      if (!last || last[0] !== style || last[1] !== uri) { pairs.push([style, uri]); run++; }
    };
    for (const token of tokenizeAnsi(text)) {
      const value: string = token.value;
      if (token.type === 'sequence') {
        if (/^\x1b\[[\d;:]*m$/.test(value)) styles = normalizeAnsiStyles([...styles, ...this.sgr(value)]);
        else {
          const link = /^\x1b\]8;[^;]*;([\s\S]*?)(?:\x07|\x1b\\)$/.exec(value);
          if (link) uri = this.intern(link[1]!, this.uris, this.uriIds);
        }
        continue;
      }
      for (const { segment } of this.segmenter.segment(value)) {
        if (segment === '\n' || segment === '\r') continue;
        const code = segment.codePointAt(0)!;
        const replaced = this.substitute.some(([low, high]) => code >= low && code <= high) ? '�' : segment;
        const tab = replaced === '\t';
        const width = tab ? 0 : cellWidth(replaced);
        if (!tab && width === 0) continue;
        setRun();
        segments.push({ char: this.intern(replaced, this.graphemes, this.charIds), width, tab, run });
      }
    }
    if (segments.length * 2 > cells.length || pairs.length * 2 > runs.length) return -segments.length * 2;
    for (const [index, segment] of segments.entries()) {
      cells[index * 2] = segment.char;
      cells[index * 2 + 1] = segment.run << 10 | (segment.tab ? 256 : segment.width);
    }
    for (const [index, pair] of pairs.entries()) { runs[index * 2] = pair[0]; runs[index * 2 + 1] = pair[1]; }
    return segments.length;
  }

  paint(screen: Int32Array, columns: number, x: number, y: number, cells: Int32Array, count: number,
    _unused: unknown, chars: Int32Array, words: Int32Array): number {
    let column = x;
    let first = columns;
    let last = 0;
    const track = (damage: number) => {
      first = Math.min(first, Math.floor(damage / 1048576) % 65536);
      last = Math.max(last, Math.floor(damage / 68719476736));
    };
    for (let index = 0; index < count; index++) {
      const flags = cells[index * 2 + 1]!;
      const word = words[flags >>> 10]!;
      const tab = (flags & 256) !== 0;
      const width = tab ? this.screen.tabWidth - ((column % this.screen.tabWidth) + this.screen.tabWidth) % this.screen.tabWidth : flags & 255;
      if (tab) {
        for (let offset = 0; offset < width; offset++) track(this.setCell(screen, columns, column + offset, y,
          this.screen.emptyCharIndex, word | this.screen.narrow));
      } else track(this.setCell(screen, columns, column, y, chars[cells[index * 2]!]!,
        word | (width === 2 ? this.screen.wide : this.screen.narrow)));
      column += width;
    }
    return column + (first < last ? first * 1048576 + last * 68719476736 : 0);
  }

  setCell(cells: Int32Array, columns: number, x: number, y: number, char: number, word: number): number {
    const rows = columns > 0 ? cells.length / (columns * 2) : 0;
    if (x < 0 || x >= columns || y < 0 || y >= rows) return x;
    let first = columns;
    let last = 0;
    const write = (column: number, value: number, flags: number) => {
      if (column < 0 || column >= columns) return;
      const at = (y * columns + column) * 2;
      if (cells[at] === value && cells[at + 1] === flags) return;
      cells[at] = value; cells[at + 1] = flags;
      first = Math.min(first, column); last = Math.max(last, column + 1);
    };
    const clearWide = (column: number) => {
      if (column < 0 || column >= columns) return;
      const flags = cells[(y * columns + column) * 2 + 1]! & this.screen.widthMask;
      if (flags === this.screen.wide) write(column + 1, this.screen.emptyCharIndex, this.screen.emptyWord);
      if (flags === this.screen.spacerTail) write(column - 1, this.screen.emptyCharIndex, this.screen.emptyWord);
    };
    const width = word & this.screen.widthMask;
    clearWide(x);
    if (width === this.screen.wide) {
      clearWide(x + 1);
      if (x + 1 < columns) {
        write(x, char, word);
        write(x + 1, this.screen.spacerCharIndex, word & ~this.screen.widthMask | this.screen.spacerTail);
      } else write(x, this.screen.emptyCharIndex, word & ~this.screen.widthMask | this.screen.spacerHead);
    } else write(x, char, word);
    return x + (width === this.screen.wide ? 2 : 1)
      + (first < last ? first * 1048576 + last * 68719476736 : 0);
  }

  private intern(value: string, table: string[], index: Map<string, number>): number {
    let id = index.get(value);
    if (id === undefined) { id = table.length; table.push(value); index.set(value, id); }
    return id;
  }

  private sgr(sequence: string): StyleCode[] {
    const parameters = sequence.slice(2, -1).split(';');
    const result: StyleCode[] = [];
    for (let index = 0; index < parameters.length; index++) {
      const parameter = parameters[index] || '0';
      let code = `\x1b[${parameter}m`;
      if (parameter === '38' || parameter === '48' || parameter === '58') {
        const mode = parameters[index + 1];
        const count = mode === '2' ? 4 : mode === '5' ? 2 : 0;
        if (count) { code = `\x1b[${parameters.slice(index, index + count + 1).join(';')}m`; index += count; }
      }
      result.push({ type: 'ansi', code, endCode: closeAnsiCode(code) });
    }
    return result;
  }
}
