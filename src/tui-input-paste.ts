import { initializePasteSource, U4t, sce, jE, Fdr, Jd, Mct } from './tui-input-paste-source.js';
import { tokenizeAnsi } from './tui-ansi-tokenizer.js';

export interface PastedText { id: number; type: 'text'; content: string; unavailable?: boolean }
export type PastedContents = Record<string, PastedText>;
export interface InputSnapshot { text: string; cursor: number; pastedContents: PastedContents }

export function referencedPastes(text: string, contents: PastedContents): PastedContents {
  const ids = new Set(Jd(text).map((entry: {id:number}) => String(entry.id)));
  return Object.fromEntries(Object.entries(contents).filter(([id]) => ids.has(id)));
}

export function expandPastedText(text: string, contents: PastedContents = {}): string {
  return sce(text, contents, undefined, undefined);
}

export interface GonePaste { id: number; label: string }
export interface StrippedDraft { stripped: string; expanded: string; removed: GonePaste[] }

/**
 * Source `kPn`/`jE`: a submit-time pass over the draft. A placeholder whose paste record is gone
 * (`unavailable`) is cut from the display text and from the expansion, so the prompt never sends
 * the literal `[Pasted text #1]`, and each removal is reported for the composer's notice.
 */
export function stripGonePastes(text: string, contents: PastedContents = {}): StrippedDraft {
  return jE(text, contents, undefined, undefined) as StrippedDraft;
}

/** Source `Fdr`: the notice for a submit that dropped gone placeholders. */
export function pasteGoneNotice(removed: readonly GonePaste[]): string {
  return Fdr(removed) as string;
}

/** Source `ys.setTimeout` (chunk-24k7d6mw.js 821244): the expand hint's one timer, cancellable. */
export type PasteScheduler = (flush: () => void, milliseconds: number) => () => void;
const defaultSchedule: PasteScheduler = (flush, milliseconds) => {
  const timer = setTimeout(flush, milliseconds);
  timer.unref?.();
  return () => clearTimeout(timer);
};

/** Source xM closes over one editor owner; raw Unicode and Node insertion stay host-owned. */
export class InputPaste {
  readonly allocator = new Mct();
  private draft: InputSnapshot = {text:'',cursor:0,pastedContents:{}};
  private rows = 24;
  private readonly source;
  /** Source `Ei` (chunk-24k7d6mw.js 821244): the cancel handle of the armed hint timer. */
  private readonly hintTimer: {current: (() => void) | null} = {current: null};

  /**
   * `onExpandPasteHintChange` is the recovered `Bo`/`onExpandPasteHintChange` pair: the producer at
   * chunk-24k7d6mw.js [839453,839552) raises it after a collapse of at most `fVe` characters, and
   * `xl` [821273,821331) clears it when the same paste is pasted again to expand.
   */
  constructor(private readonly onExpandPasteHintChange?: (visible: boolean) => void,
    private readonly schedule: PasteScheduler = defaultSchedule) {
    const owner = this;
    const M = {get value() {return owner.draft.text;}, get pastedContents() {return owner.draft.pastedContents;}};
    this.source = initializePasteSource({
      M, allocator:this.allocator, dr:{valueOf:() => this.rows}, ji:{current:null}, wa:{current:false},
      Bo:(visible: boolean) => {this.onExpandPasteHintChange?.(visible);},
      Ei:this.hintTimer,
      ys:{setTimeout:(flush: () => void, milliseconds: number) => this.schedule(flush, milliseconds)},
      pn:(text: string) => tokenizeAnsi(text).filter((token: {type:string}) => token.type === 'text')
        .map((token: {value:string}) => token.value).join('').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g,''),
      In:(update: (contents: PastedContents) => PastedContents) => {this.draft.pastedContents = update(this.draft.pastedContents);},
      Pw:(text: string) => {
        this.draft.text = this.draft.text.slice(0,this.draft.cursor) + text + this.draft.text.slice(this.draft.cursor);
        this.draft.cursor += text.length;
      },
      Pq:(id: number) => {
        const expanded = U4t(this.draft.text,this.draft.pastedContents);
        if (expanded?.id !== id) return false;
        this.draft.text = expanded.expanded; this.draft.cursor = expanded.cursorOffset;
        this.draft.pastedContents = {...this.draft.pastedContents}; delete this.draft.pastedContents[id];
        // Source `xl` runs inside `Pq` (chunk-24k7d6mw.js 838706): the expansion takes the hint down.
        this.hintTimer.current?.(); this.hintTimer.current = null;
        this.onExpandPasteHintChange?.(false);
        return true;
      },
    });
  }

  paste(snapshot: InputSnapshot, text: string, rows: number): InputSnapshot {
    this.draft = {...snapshot,pastedContents:structuredClone(snapshot.pastedContents)}; this.rows = rows;
    this.pasting = true;
    try {this.source.paste(text); return this.draft;}
    finally {this.pasting = false; this.draft = {text:'',cursor:0,pastedContents:{}};}
  }

  /** True while `paste` runs: the caller repaints itself once the draft lands, so the hint setter
   *  only needs its own frame when the 8000 ms timer fires. */
  pasting = false;

  /** Source unmount cleanup (`od`, chunk-24k7d6mw.js 821400): the timer does not outlive the owner. */
  dispose(): void {
    this.hintTimer.current?.(); this.hintTimer.current = null;
  }
}
