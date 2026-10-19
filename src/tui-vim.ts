import { z } from 'zod';
import { initializeVimSource } from './tui-vim-source.js';
import { inputCursor } from './tui-input-navigation.js';
import { Si } from './tui-input-cursor.js';
import { cellWidth } from './terminal.js';

export const editorModeSchema = z.enum(['normal','vim']).optional().catch(undefined);
export type EditorMode = 'normal' | 'vim';
export const vimRemapsSchema = z.record(z.unknown()).optional().catch(undefined);
export type VimMode = 'INSERT' | 'NORMAL' | 'VISUAL' | 'VISUAL LINE';
export interface VimKey {
  key: string; name: string; ctrl?: boolean; meta?: boolean; shift?: boolean; fn?: boolean; superKey?: boolean;
  preventDefault(): void;
}
export interface VimBridge {
  text: string; cursor: number; columns: number;
  change(text: string, previous?: {value:string;cursorOffset:number}): void;
  offset(cursor: number): void;
  register(text: string): string;
  fallback(key: VimKey): void;
  undo(): void; history(direction: -1 | 1): void; search(): void;
}

/** A copied hook's refs/state belong to one editor, rerendered against its current raw draft. */
export class InputVim {
  private slots: unknown[] = [];
  private slot = 0;
  private remaps: Record<string,unknown> = {};
  private modeValue: VimMode = 'INSERT';
  private anchorValue: number | null = null;
  private readonly source;
  private readonly cursorClass;
  private bridge: VimBridge | undefined;
  private cancelRemap = () => {};
  private forgetColumn = () => {};
  private registerState: object | undefined;

  constructor() {
    // Delay the raw cursor class until the terminal/cursor module cycle has initialized.
    class RawVimCursor extends Si {
      static fromText(text:string,columns:number,offset=0,selection=0) {
        const cursor=inputCursor(text,columns,offset);return new RawVimCursor(cursor.measuredText,offset,selection);
      }
      modifyText(end:{offset:number},inserted='') {
        return RawVimCursor.fromText(this.text.slice(0,this.offset)+inserted+this.text.slice(end.offset),this.columns,this.offset+inserted.length);
      }
    }
    const wrap=(cursor: any): any => new Proxy(cursor,{get(target,property){
      if(property==='insert')return (inserted:string)=>wrap(RawVimCursor.fromText(
        target.text.slice(0,target.offset)+inserted+target.text.slice(target.offset),target.columns,target.offset+inserted.length));
      const value=Reflect.get(target,property,target);
      if(typeof value!=='function')return value;
      return (...args:unknown[])=>{const result=value.apply(target,args);return result instanceof Si?wrap(result):result;};
    }});
    this.cursorClass=new Proxy(RawVimCursor,{construct(Target,args){return wrap(Reflect.construct(Target,args));},
      get(Target,property){if(property==='fromText')return (...args:Parameters<typeof RawVimCursor.fromText>)=>wrap(RawVimCursor.fromText(...args));return Reflect.get(Target,property);}});
    this.source=initializeVimSource({Si:this.cursorClass,ae:cellWidth,
      R:<T>(current:T)=>{const index=this.slot++;
        if(!(index in this.slots)){
          const value=current&&typeof current==='object'&&'register'in current?this.registerState??=new Proxy(current as object,{set:(target,key,value)=>
            Reflect.set(target,key,key==='register'&&typeof value==='string'?this.bridge?.register(value)??value:value)}):current;
          this.slots[index]={current:value};
        }
        return this.slots[index];
      },
      y:<T>(initial:T)=>{const index=this.slot++;if(!(index in this.slots))this.slots[index]=initial;
        return [this.slots[index],(value:T)=>{this.slots[index]=value;}];},
      le:<T>(callback:T)=>callback,xP:()=>[this.remaps],
    });
  }

  get mode(): VimMode {return this.modeValue;}
  get anchor(): number | null {return this.anchorValue;}
  /** Source `ds` (`chunk-24k7d6mw.js` 819300): the mode setter resets the open edit gesture. */
  onModeChange: (mode: VimMode) => void = () => {};
  private setMode(value: VimMode): void {
    if (value === this.modeValue) return;
    this.modeValue = value;
    this.onModeChange(value);
  }
  setRemaps(value?: Record<string,unknown>): void {
    if(JSON.stringify(value??{})!==JSON.stringify(this.remaps))this.cancelRemap();
    this.remaps=structuredClone(value??{});
  }
  externalMutation(): void {this.cancelRemap();this.forgetColumn();}
  close(): void {this.reset();this.registerState=undefined;}
  reset(): void {this.slots=[];this.setMode('INSERT');this.anchorValue=null;this.cancelRemap=()=>{};this.forgetColumn=()=>{};}

  private hooks(bridge: VimBridge) {
    this.slot=0;
    const hooks=this.source({value:bridge.text,columns:bridge.columns,
      onChange:(text:string,options?:{previous?:{value:string;cursorOffset:number}})=>bridge.change(text,options?.previous),
      onModeChange:(mode:VimMode)=>{this.setMode(mode);},onUndo:()=>bridge.undo(),
      onOpenHistorySearch:()=>bridge.search(),onHistoryUp:()=>bridge.history(-1),onHistoryDown:()=>bridge.history(1),
    });
    this.cancelRemap=hooks.cancelPendingRemap;this.forgetColumn=hooks.forgetColumn;
    return hooks;
  }

  key(key: VimKey, bridge: VimBridge): void {
    if(!key.ctrl&&!key.meta&&key.name!=='escape'){
      const graphemes=Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(key.key));
      if(graphemes.length>1){
        for(const {segment}of graphemes)this.key({...key,key:segment,name:[...segment].length===1?segment:''},bridge);
        return;
      }
      if([...key.key].length>1)key={...key,name:''};
    }
    const hooks=this.hooks(bridge),owner={get offset(){return bridge.cursor;},setOffset:bridge.offset,
      handleKeyDown:(event:VimKey)=>{
        const before=bridge.text,offset=bridge.cursor;
        bridge.fallback(event);
        if(hooks.mode!=='INSERT'||bridge.text===before)return;
        const prefix=before.slice(0,offset),suffix=before.slice(offset),value=bridge.text;
        if(event.name==='return'&&prefix.endsWith('\\')&&value===prefix.slice(0,-1)+'\n'+suffix){
          hooks.recordInsert('\n','\\');
        }else if(value.startsWith(prefix)&&value.endsWith(suffix)&&value.length>before.length){
          const inserted=value.slice(prefix.length,value.length-suffix.length);
          if(inserted==='\n')hooks.recordInsert(inserted);else hooks.recordInsertedText(inserted,event);
        }
      }};
    this.bridge=bridge;
    try{hooks.handleKeyDown(key,owner);}finally{this.bridge=undefined;}
    const rendered=this.hooks(bridge);this.setMode(rendered.mode);this.anchorValue=rendered.visualAnchor;
  }
}
