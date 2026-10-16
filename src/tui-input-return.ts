import { sourceReturn } from './tui-input-return-source.js';
import { inputCursor } from './tui-input-navigation.js';

export interface ReturnGesture {meta:boolean;shift:boolean}
/** The copied gesture receives a raw draft cursor instead of NFC-normalizing mutations. */
export function applyReturnGesture(text:string,cursor:number,columns:number,key:ReturnGesture) {
  interface RawCursor {text:string;offset:number;backspace():RawCursor;insert(inserted:string):RawCursor}
  const raw=(value:string,offset:number):RawCursor=>{
    const measured=inputCursor(value,columns,offset);
    return {text:value,offset:measured.offset,
      backspace(){const previous=measured.left().offset;return raw(value.slice(0,previous)+value.slice(measured.offset),previous);},
      insert(inserted){return raw(value.slice(0,measured.offset)+inserted+value.slice(measured.offset),measured.offset+inserted.length);}};
  };
  let submitted=false;
  const result=sourceReturn(raw(text,cursor),key,()=>{submitted=true;});
  return {text:result.text,cursor:result.offset,submitted};
}
