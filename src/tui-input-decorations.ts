// The composer's painted decorations: the runs a plugin's `prompt.edit` answer leaves over the draft,
// held to the text they were painted for.
//
// Every rule below is a body carried from the composer's state class in chunk-24k7d6mw.js, zero-based
// UTF-16 ranges, identifiers unchanged except the three noted:
//   the publish clause            [482300,482690)  390 units  sha256 f63f14a1ae39c83c48b3231634444e725f31f84bef480ef7f7b7da7ad80ae14d
//   `paint`                       [486016,486148)  132 units  sha256 39d94045b98acdd4180a6d2be53640184deac619c162cb1298c5532b302b05c9
//   `carryPaint`                  [486148,486354)  206 units  sha256 3fabf76e2b52e6ae8236c2891575577c3b72f86a64b35112e13a24e006c9cccb
//   the relay host's two bindings [831323,831404)   81 units  sha256 32889c6ed1b57772588b4d0cb71e3e32a037bb5ff75f03aa4910ec6e79cb3f8c
//   the initial `decorations: ihe`[481873,481918)   45 units  sha256 e2113a38d2fd1b0eec12e418598c2c854aabbc7544a7ca1624c6d70995ba1643
//
// Three names differ, because the composer here is the TUI's editor rather than the source's React
// store: `this.#i.value` is the text the caller says the draft holds, `this.#p({})` is `this.repaint()`,
// and the class's private fields are plain ones. The publish clause also carries only its two
// decoration sentences; the cursor clamp, `cameBack` and the emit around them belong to the source's
// own state store, which this product does not share.
//
// The runs themselves are the copied source: ./plugin-chain-decorations-source.ts holds `Rke`, which
// normalizes and merges them, and the row mapping the input uses: `S9r` shifts a run's draft offsets onto
// the rendered value's offsets, and `b9r` splits that value into segments carrying their run.
import { a7o, b9r, ihe, Rke, S9r } from './plugin-chain-decorations-source.js';
import { yBe } from './plugin-chain-relay-source.js';

/** One painted run, in the shape the `prompt.edit` answer carries (`Cr` in ./plugin-chain-source.ts). */
export interface DecorationRun {
  start: number;
  end: number;
  color?: string;
  backgroundColor?: string;
  dimColor?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  /** Set by `Rke` while it merges runs of one style; a module's own runs do not carry it. */
  priority?: number;
}

/** The style properties a run paints with: the composer's own decoration keys, minus the offsets. */
export type DecorationStyle = Omit<DecorationRun, 'start' | 'end' | 'priority'>;

/** One piece of a rendered prompt line: its text and the run style over it, if any. */
export interface PromptSegment {
  text: string;
  style: DecorationStyle;
}

/** The draft state one relayed edit carries (the relay's `ChainRelayEdit`, minus the key). */
export interface PaintedEdit {
  before: { text: string; cursor: number };
  after: { text: string; cursor: number };
}

const styleOf = (run: DecorationRun): DecorationStyle => ({
  ...run.color !== undefined && { color: run.color },
  ...run.backgroundColor !== undefined && { backgroundColor: run.backgroundColor },
  ...run.dimColor !== undefined && { dimColor: run.dimColor },
  ...run.bold !== undefined && { bold: run.bold },
  ...run.italic !== undefined && { italic: run.italic },
  ...run.underline !== undefined && { underline: run.underline },
  ...run.strikethrough !== undefined && { strikethrough: run.strikethrough },
});

/**
 * The runs a painted draft holds, while they still belong to its text.
 *
 * The source keeps them in `#y`, the paint it is showing, and moves them to `#h`, the paint it is
 * carrying, when a draft edit lands. `paint` bets the runs on the draft at that moment; `carry`
 * rebases them across the edit that follows; the publish clause drops them once the draft no longer
 * matches. A run list that this product cannot place is therefore never drawn, rather than drawn
 * over text it was not computed for.
 */
export class PaintedDecorations {
  /** The source's `#y`: the paint being shown, with the draft text it was painted over. */
  private painted: { value: string; runs: readonly DecorationRun[] } | null = null;
  /** The source's `#h`: the paint the last draft change left behind, for the edit that follows it. */
  private carried: { value: string; runs: readonly DecorationRun[] } | null = null;
  /** The source's `#i.value`: the draft text the last publish clause ran for. */
  private published: string;

  constructor(
    private readonly read: () => string,
    private readonly repaint: () => void,
  ) {
    this.published = read();
  }

  /** Source `paint=(h)=>…`: a chain answer's runs, already normalized against the text it answered. */
  paint(h: readonly DecorationRun[]): void {
    this.carried = null;
    if (h.length === 0 && this.painted === null) return;
    this.painted = h.length === 0 ? null : { value: this.read(), runs: h };
    this.repaint();
  }

  /** Source `carryPaint=(h,T)=>…`, called as the relay calls it: `carry(edit.before, edit.after)`. */
  carry(h: { text: string }, T: { text: string }): void {
    const M = this.carried;
    this.carried = null;
    if (M === null || M.value !== h.text || this.read() !== T.text) return;
    const L = Rke(a7o(M.runs, yBe(h, T)), T.text) as readonly DecorationRun[];
    this.painted = L.length === 0 ? null : { value: T.text, runs: L };
    this.repaint();
  }

  /** The two decoration sentences of the source's publish clause `#p(h)`, for a draft value change. */
  publish(value: string): void {
    const T = { value: this.published };
    if (value !== T.value) {
      this.carried = this.painted?.value === T.value ? this.painted : null;
      this.painted = null;
    }
    this.published = value;
  }

  /** The rest of that clause, read instead of stored: what the draft is to paint right now. */
  runs(value: string): readonly DecorationRun[] {
    return this.painted?.value === value ? this.painted.runs : ihe as readonly DecorationRun[];
  }
}

/** The composer's painted decorations, for a caller that can read its draft and ask for a repaint. */
export function paintedDecorations(read: () => string, repaint: () => void): PaintedDecorations {
  return new PaintedDecorations(read, repaint);
}
/**
 * `Rke(runs, text)`, the normalization every paint goes through before it is stored.
 *
 * Source `chunk-24k7d6mw.js` binds it at the host: `fS=(fp,qN)=>M.paint(Rke(fp,qN))` [831394,831404).
 */
export function normalizedRuns(runs: readonly DecorationRun[], text: string): readonly DecorationRun[] {
  return Rke(runs, text) as readonly DecorationRun[];
}

/**
 * The runs the input component paints: a run covering the caret is dropped.
 *
 * Source `UFt` (chunk-s7977spq.js [4899,…)) builds the list it hands the renderer as
 * `showCursor && highlights ? highlights.filter(span => span.dimColor || cursorOffset < span.start ||
 * cursorOffset >= span.end) : highlights`. The cell under the caret is therefore left to the base text,
 * so the inverted caret stays visible; a dim run (the placeholder grey) is kept.
 */
export function caretVisibleRuns(runs: readonly DecorationRun[], cursorOffset: number): readonly DecorationRun[] {
  return runs.filter(run => run.dimColor === true || cursorOffset < run.start || cursorOffset >= run.end);
}

/**
 * The rows the input renders, as the source's highlight path builds them.
 *
 * Source `UFt` maps the draft-offset highlights onto the rendered value with `S9r(highlights, f,
 * renderedRowStartOffsets)` (chunk-sfn1dbxq.js [463623,464165)), and the text component `Q`
 * (chunk-s7977spq.js [3176,…)) then runs `b9r(renderedValue, mapped)` (same block) to split the rendered
 * text into segments carrying their highlight, splits each segment on the newline, and renders one row per
 * line. The segments arrive here as prompt segments, which is the product's name for that pair of text and
 * run style; the source's per-character shimmer is not part of this port.
 */
export function highlightRows(runs: readonly DecorationRun[], renderedValue: string,
  rowStartOffsets: readonly number[], cursorOffset?: number): readonly (readonly PromptSegment[])[] {
  const visible = cursorOffset === undefined ? runs : caretVisibleRuns(runs, cursorOffset);
  const mapped = visible.length === 0 ? visible : S9r(visible, renderedValue, rowStartOffsets) as readonly DecorationRun[];
  const segments = b9r(renderedValue, mapped) as readonly { text: string; highlight?: DecorationRun }[];
  const rows: PromptSegment[][] = [[]];
  for (const segment of segments) {
    const parts = segment.text.split('\n');
    for (let index = 0; index < parts.length; index += 1) {
      if (index > 0) rows.push([]);
      const text = parts[index] ?? '';
      if (text.length > 0) rows[rows.length - 1]!.push({ text, style: segment.highlight ? styleOf(segment.highlight) : {} });
    }
  }
  return rows;
}
