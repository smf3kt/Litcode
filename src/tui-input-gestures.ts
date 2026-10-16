import { initializeGestureSource } from './tui-input-gesture-source.js';
import type { PastedContents } from './tui-input-paste.js';

export interface GestureBridge {
  text:string;pastedContents:PastedContents;
  clear():void;delete():void;exit():void;
  history(text:string,contents:PastedContents):void;
  hint(value:string|undefined):void;
}

/** Copied iq refs, pending callbacks and timer effects belong to one input owner. */
export class InputGestures {
  private slots:unknown[]=[];
  private slot=0;
  private cleanups:(()=>void)[]=[];
  private hintValue:string|undefined;
  private readonly source;
  constructor(){
    this.source=initializeGestureSource({
      on:()=>({setTimeout:(callback:()=>void,milliseconds:number)=>{const timer=setTimeout(callback,milliseconds);timer.unref?.();return()=>clearTimeout(timer);}}),
      Xa:()=>Date.now,R:<T>(current:T)=>{const index=this.slot++;return this.slots[index]??= {current};},
      To:<T extends (...args:never[])=>unknown>(callback:T)=>{const ref=this.ref({current:callback});ref.current=callback;return (...args:Parameters<T>)=>ref.current(...args);},
      le:<T>(callback:T)=>callback,P:(effect:()=>()=>void)=>{const index=this.slot++;if(!(index in this.slots)){this.slots[index]=true;this.cleanups.push(effect());}},
    });
  }
  private ref<T>(value:{current:T}):{current:T}{const index=this.slot++;return (this.slots[index]??=value) as {current:T};}
  get hint():string|undefined{return this.hintValue;}
  reset():void{for(const cleanup of this.cleanups.splice(0))cleanup();this.slots=[];this.hintValue=undefined;}
  key(key:'interrupt'|'eof'|'escape',bridge:GestureBridge):void{
    this.slot=0;
    const hint=(value:string|undefined)=>{this.hintValue=value;bridge.hint(value);};
    const methods=this.source({e:bridge.text,r:()=>bridge.clear(),We:()=>{},M:()=>{},s:()=>bridge.exit(),
      o:(pending:boolean,name:string)=>hint(pending?`Press ${name} again to exit`:undefined),
      l:(pending:boolean)=>hint(pending?'Esc again to clear':undefined),h:()=>{},oe:()=>bridge.pastedContents,
      ice:(entry:string|{display:string;pastedContents:PastedContents})=>bridge.history(typeof entry==='string'?entry:entry.display,
        typeof entry==='string'?{}:entry.pastedContents),deleteCursor:()=>bridge.delete()});
    methods[key]();
  }
}
