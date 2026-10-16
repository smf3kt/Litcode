import { initializeHistorySearchSource } from './tui-history-search-source.js';
import { Mct } from './tui-input-paste-source.js';
import { expandPastedText, type InputSnapshot, type PastedContents } from './tui-input-paste.js';
import { layoutInput, inputCursor } from './tui-input-navigation.js';
import { cellWidth } from './terminal.js';
import { layoutEngine } from './tui-layout.js';
import { Gt, Lr, TE } from './tui-render-engine.js';
import { en } from './tui-react-runtime.js';
import { jsx } from './tui-jsx.js';
import { n } from './tui-base-components.js';
import type { InputHistoryEntry } from './tui-input-history.js';

type SearchAction = 'historySearch:next' | 'historySearch:accept' | 'historySearch:cancel' | 'historySearch:execute';
interface SearchAPI {
  isSearching: boolean; historyQuery: string; historyMatch?: InputHistoryEntry; historyFailedMatch: boolean;
  setHistoryQuery(value: string): void;
  handleKeyDown(event: {key:string;preventDefault():void}): void;
  openSearch(): void;
}
interface SourceSnapshot { value: string; cursorOffset: number; mode: 'prompt'|'bash'; pastedContents: PastedContents }
export interface SearchSnapshot extends InputSnapshot { query: string; searching: boolean; failed: boolean }

/** Complete source Dre runs on the recovered React engine; this host owns its terminal lifetime. */
export class HistorySearch {
  private readonly config = layoutEngine.Config.create();
  private readonly root = Lr('ink-root', this.config) as unknown as {
    yogaNode: ReturnType<typeof layoutEngine.Node.create>; onComputeLayout?: () => void;
  };
  private readonly container;
  private readonly allocator: Mct;
  private readonly releaseCarrier: () => void;
  private readonly actions = new Map<string, () => void>();
  private readonly source;
  private api!: SearchAPI;
  private draft: SourceSnapshot = {value:'',cursorOffset:0,mode:'prompt',pastedContents:{}};
  private closed = false;
  private publishing = false;
  private pendingPublish = false;
  private failure: unknown;
  private pendingSubmit: InputHistoryEntry | undefined;
  private readonly bridge = {
    getSnapshot: () => structuredClone(this.draft),
    setValue: (value: string) => {this.draft.value = value;},
    setCursorOffset: (value: number) => {this.draft.cursorOffset = value < 0 ? this.draft.value.length : Math.min(value,this.draft.value.length);},
    setMode: (value: 'prompt'|'bash') => {this.draft.mode = value;},
    setPastedContents: (value: PastedContents) => {this.draft.pastedContents = structuredClone(value);},
  };

  constructor(private readonly options: {
    read(): AsyncGenerator<InputHistoryEntry>;
    changed(snapshot: SearchSnapshot): void;
    submit(entry: InputHistoryEntry): void;
    report(error: unknown): void;
    carriers(): readonly string[];
    sessionId(): string;
    allocator?: Mct;
  }) {
    this.allocator=options.allocator ?? new Mct();
    this.releaseCarrier=this.allocator.registerCarrier(options.carriers);
    this.source = initializeHistorySearchSource({
      read:options.read,
      rawMatch:(entry:InputHistoryEntry,query:string) => expandPastedText(entry.display,entry.pastedContents).toLowerCase().includes(query),
      register:(action:string,callback:()=>void,scope:{isActive?:boolean}) => {
        if(scope.isActive !== false)this.actions.set(action,callback);else this.actions.delete(action);
      },
      registerMany:(actions:Record<string,()=>void>,scope:{isActive:boolean}) => {
        for(const[action,callback]of Object.entries(actions))if(scope.isActive)this.actions.set(action,callback);else this.actions.delete(action);
      },
      report:options.report,allocator:this.allocator,sessionId:options.sessionId,
      ae:(value:string)=>layoutInput({text:value,cursor:value.length},1000000,1).cursorColumn,
      wr:({value,columns,dimColor}:{value:string;columns:number;dimColor:boolean}) => jsx(n,{dimColor,
        children:layoutInput({text:value,cursor:value.length},columns,1).lines[0] || ' '},undefined),
    });
    const submit=(entry:InputHistoryEntry)=>{this.pendingSubmit=structuredClone(entry);};
    const Controller=()=>{
      const api=this.source.Dre(this.bridge,submit) as SearchAPI;
      en(()=>{this.api=api;this.schedulePublish();},undefined);
      return null;
    };
    const fail=(error:unknown)=>{this.failure??=error;options.report(error);};
    this.root.onComputeLayout=()=>this.root.yogaNode.calculateLayout(1,undefined,1);
    this.container=Gt.createContainer(this.root,1,null,false,null,'history-search',fail,fail,fail,fail);
    Gt.updateContainerSync(jsx(Controller,{},undefined),this.container,null,null);
    this.flush();
  }

  get snapshot(): SearchSnapshot {
    const prefix=this.draft.mode==='bash'&&!this.draft.value.startsWith('!')?'!':'';
    return {text:prefix+this.draft.value,cursor:prefix.length+Math.max(0,this.draft.cursorOffset),
      pastedContents:structuredClone(this.draft.pastedContents),query:this.api?.historyQuery??'',
      searching:this.api?.isSearching??false,failed:this.api?.historyFailedMatch??false};
  }
  element() {return jsx(this.source.SVe,{value:this.api.historyQuery,onChange:this.api.setHistoryQuery,
    historyFailedMatch:this.api.historyFailedMatch},undefined);}
  /** Physical query caret lives on the owned editor, not at the end of the query. */
  caretColumn(columns: number): number {
    const label=this.api.historyFailedMatch?'no matching prompt:':'search prompts:';
    return Math.min(Math.max(0,columns-1),cellWidth(label+' ')+inputCursor(this.api.historyQuery,columns,this.queryCursor).getPosition().column);
  }
  queryCursor = 0;
  open(snapshot: InputSnapshot): void {
    if(this.closed||this.api.isSearching)return;
    this.draft={value:snapshot.text,cursorOffset:snapshot.cursor,mode:'prompt',pastedContents:structuredClone(snapshot.pastedContents)};
    this.allocator.startEpoch(this.options.sessionId());
    this.run(()=>this.api.openSearch());
  }
  query(value:string): void {if(!this.closed&&this.api.isSearching)this.run(()=>this.api.setHistoryQuery(value));}
  action(action:SearchAction): boolean {
    const callback=this.actions.get(action);if(this.closed||!callback)return false;
    this.run(callback);return true;
  }
  backspace(): boolean {
    if(this.closed||!this.api.isSearching||this.api.historyQuery!=='')return false;
    let consumed=false;this.run(()=>this.api.handleKeyDown({key:'backspace',preventDefault:()=>{consumed=true;}}));return consumed;
  }
  cancel(): void {this.action('historySearch:cancel');}
  private run(callback:()=>void): void {
    Gt.flushSyncFromReconciler(callback);this.flush();
  }
  private flush(): void {
    Gt.flushSyncWork();Gt.flushPassiveEffects();Gt.flushSyncWork();
    if(this.pendingPublish){this.pendingPublish=false;this.publish();}
    if(this.failure){const error=this.failure;this.failure=undefined;throw error;}
  }
  private schedulePublish(): void {
    if(this.pendingPublish||this.closed)return;
    this.pendingPublish=true;
    queueMicrotask(()=>{
      if(!this.pendingPublish||this.closed)return;
      this.pendingPublish=false;this.publish();
    });
  }
  private publish(): void {
    if(this.closed||!this.api||this.publishing)return;
    this.publishing=true;
    try {
      this.options.changed(this.snapshot);
      const entry=this.pendingSubmit;this.pendingSubmit=undefined;
      if(entry){const prefix=this.draft.mode==='bash'&&!entry.display.startsWith('!')?'!':'';
        this.options.submit({...entry,display:prefix+entry.display});}
    }finally{this.publishing=false;}
  }
  close(): void {
    if(this.closed)return;
    try{this.cancel();}
    catch(error){this.options.report(error);}
    this.closed=true;this.actions.clear();this.pendingSubmit=undefined;
    try{Gt.updateContainerSync(null,this.container,null,null);this.flush();}
    catch(error){this.options.report(error);}
    finally{this.releaseCarrier();TE(this.root);this.config.free();}
  }
}
