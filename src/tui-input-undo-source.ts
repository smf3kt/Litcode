// @ts-nocheck
// Exact source body; provenance: research/ports/W44-undo-copies.json.
export function initializeUndoSource({on,R,y,le}) {
function due({maxBufferSize:h,debounceMs:T}){let M=on(),L=R({entries:[],index:-1}),[ee,he]=y(L.current),we=R(0),Te=R(null),Me=le((je,Je,at={},_t={})=>{let xt=Date.now();if(Te.current)Te.current(),Te.current=null;if(!_t.immediate&&xt-we.current<T){Te.current=M.setTimeout(()=>Me(je,Je,at),T);return}we.current=xt;let Ct=L.current;if(Ct.entries[Ct.index]?.text===je)return;let Pt=[...Ct.entries.slice(0,Ct.index+1),{text:je,cursorOffset:Je,pastedContents:at,timestamp:xt}],Mt=Pt.length>h?Pt.slice(-h):Pt;L.current={entries:Mt,index:Mt.length-1},he(L.current)},[T,h,M]),Le=le(()=>{if(Te.current)Te.current(),Te.current=null;let je=L.current,Je=je.entries[je.index];if(!Je)return;return L.current={entries:je.entries,index:je.index-1},he(L.current),Je},[]),He=le(()=>{if(L.current={entries:[],index:-1},he(L.current),we.current=0,Te.current)Te.current(),Te.current=null},[]),$e=ee.index>=0&&ee.entries[ee.index]!==void 0;return{pushToBuffer:Me,undo:Le,canUndo:$e,clearBuffer:He}}
return due;
}
