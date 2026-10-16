import { initializePasteSource, U4t, sce, Jd, Mct } from './tui-input-paste-source.js';
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

/** Source xM closes over one editor owner; raw Unicode and Node insertion stay host-owned. */
export class InputPaste {
  readonly allocator = new Mct();
  private draft: InputSnapshot = {text:'',cursor:0,pastedContents:{}};
  private rows = 24;
  private readonly source;

  constructor() {
    const owner = this;
    const M = {get value() {return owner.draft.text;}, get pastedContents() {return owner.draft.pastedContents;}};
    this.source = initializePasteSource({
      M, allocator:this.allocator, dr:{valueOf:() => this.rows}, ji:{current:null}, wa:{current:false},
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
        return true;
      },
    });
  }

  paste(snapshot: InputSnapshot, text: string, rows: number): InputSnapshot {
    this.draft = {...snapshot,pastedContents:structuredClone(snapshot.pastedContents)}; this.rows = rows;
    try {this.source.paste(text); return this.draft;}
    finally {this.draft = {text:'',cursor:0,pastedContents:{}};}
  }
}
