// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-scope-picker-copies.json.
import {P,R,Z,y} from './tui-react-runtime.js';
import {jsx as e,jsxs as r} from './tui-jsx.js';
import {s,n} from './tui-base-components.js';
import { gLt, TBe, MBe, DBe } from './tui-scope-picker-frame-tui-source.js';
import { z } from './tui-scope-picker-frame-tui-host.js';
/**
 * The recovered frame's props, shared by the source consumer (`Kse`) and the owned text picker.
 * `state` is the Kse frame state; `adapters` are the host seams (time format, cell width, truncation,
 * preview wrapper, overflow marker). The preview keeps the row budget: title, list, preview, search
 * and hint must fit `hintRows`, so its height follows the same visible-count rule the frame uses.
 */
var nG=6,fHe=8,ULt=16777216,qLt=256,$Lt=100,VLt=4;
export function buildScopePickerFrameProps(state, adapters) {
  const {scope,status,label,query,items,cursor,hint,hintRows,onFocus}=state;
  const {rw,ae,ct,Nu,wy}=adapters;
  const visible=Math.max(DBe,Math.min(TBe,hintRows-MBe));
  const previewHeight=Math.max(2,Math.min(nG+2,hintRows-3-visible));
  return e(gLt,{rows:hintRows,text:"Search prompts \xB7 "+scope+(status==="truncated"?" \xB7 newest "+label+" only":"")+(query?"  Filter history… "+query:""),title:r(n,{children:["Search prompts ",r(n,{color:"suggestion",children:["\xB7 ",scope]}),status==="truncated"&&r(n,{dimColor:!0,children:[" ","\xB7 newest ",label," only"]})]}),placeholder:"Filter history…",initialQuery:query,items,getKey:(Pt)=>String(Pt.entry.timestamp),onQueryChange:()=>{},onSelect:()=>{},onCancel:()=>{},onFocus,resetKey:scope,extraHints:[e(z,{chord:"ctrl+s",action:"scope"},"scope")],query:query,emptyMessage:()=>hint,selectAction:"select",direction:"up",previewPosition:"bottom",renderItem:(Pt,Mt)=>{let Ft=rw(new Date(Pt.entry.timestamp));return r(n,{children:[r(n,{dimColor:!0,children:[Ft," ".repeat(Math.max(0,fHe-ae(Ft)))]}),r(n,{color:Mt?"suggestion":void 0,children:[" ",ct(Pt.firstLine,20)]})]})},renderPreview:(Pt)=>{let Mt=Nu(Pt.display,20,{hard:!0}).split(`
`).filter((Xt)=>Xt.trim()!==""),Ft=Mt.length>nG,Et=Mt.slice(0,Ft?nG-1:nG),Kt=Mt.length-Et.length;return r(s,{flexDirection:"column",borderStyle:"round",borderDimColor:!0,paddingX:1,height:previewHeight,children:[Et.map((Xt,no)=>e(n,{dimColor:!0,children:Xt},no)),e(wy,{count:Kt})]})},cursor,rows:hintRows})}
export function initializeScopePickerSource({read,render,report,presentHost,emit,ae,ct,rw,wy,stampWidth,previewHeight,setState}) {
const Pe=()=>({storageV5:undefined}),fss=(scope)=>read(scope);
const Ze=presentHost.register,nn=presentHost.registerMany,ma=presentHost.hint;
const ke=()=>({columns:presentHost.columns()}),sa=()=>{},i=()=>{},d=String;
const gee=()=>false,Xt=()=>{},Mt=()=>false;
const g=()=>{},f=()=>{},m=()=>{};
function Udr(){return false}
function t(message){report(new Error(message))}
function c(error){report(error)}
const l=String;
/** Presentational symbols outside this copied body render through the owned frame. */
const Nu = (text, _columns) => text;
/** Frame-only locals outside this copied body: layout counters and the wide-terminal flag. */
let at = false, _t = 0, xt = 20, Ct = 20;
const $dr=["session","project","everywhere"];
/** Source Kse filter body with the owned frame publishing each computed list. */
function filterItems(Te,Le){if(!Te)return[];let Pt=Te.items,Mt=Le.trim().toLowerCase();if(!Mt)return Pt;let Ft=Te.status==="scanning",Et=[],Kt=[];for(let Xt of Pt)if(Xt.lower.includes(Mt))Et.push(Xt);else if(!Ft&&YLt(Xt.lower,Mt))Kt.push(Xt);return Et.concat(Kt)}
function YLt(h,T){let M=0;for(let L=0;L<T.length;L++){let ee=h.indexOf(T.charAt(L),M);if(ee===-1)return!1;M=ee+1}return!0}
function KLt(h,T){if(!h)return"Loading\u2026";let M=T.trim();switch(h.status){case"failed":return"Couldn't read prompt history";case"scanning":return M?"Searching older prompts\u2026":"No history yet";case"complete":case"truncated":return M?"No matching prompts":"No history yet"}}
function pickerFrameProps(state){return buildScopePickerFrameProps(state,{rw,ae,ct,Nu,wy})}
function Kse({initialQuery:h,onSelect:T,onCancel:M}){sa("history-search");let{columns:L}=ke(),{storageV5:ee}=Pe(),[he,we]=y("everywhere"),[Te,Me]=y(null),[Le,He]=y(h??""),$e=R({});P(()=>{g("history_search_open")},[]),P(()=>{let Pt=$e.current[he];if(Pt){Me(Pt);return}Me(null);let Mt=!1,Ft=[];return(async()=>{try{let Et=fss(he,ee),Kt=0,Xt=$Lt,no=!1;for await(let io of Et){if(Mt)return;let po=io.display,co=po.indexOf(`
`);if(Ft.push({entry:io,display:po,lower:po.toLowerCase(),firstLine:co===-1?po:po.slice(0,co)}),Kt+=io.textLength+qLt,Kt>=ULt){no=!0;break}if(Ft.length>=Xt)Me({items:Ft.slice(),status:"scanning"}),Xt*=VLt}if(!Mt){let io={items:Ft,status:no?"truncated":"complete"};if($e.current[he]=io,Me(io),no)f("history_search_scan","text_limit_reached");else g("history_search_scan")}}catch(Et){if(!Mt)if(Ft.length>0)Me({items:Ft,status:"truncated"}),f("history_search_scan","picker_scan_interrupted");else Me({items:[],status:"failed"}),m("history_search_scan","picker_scan_failed");if(Udr(Et))t(`History picker read failed: ${l(Et)}`,{level:"error"});else c(Et)}})(),()=>{Mt=!0}},[he,ee]);let je=ma("historySearch:cycleScope","HistorySearch","ctrl+s");Ze("historySearch:cycleScope",()=>{let Pt=$dr.indexOf(he),Mt=$dr[(Pt+1)%$dr.length];we(Mt),i("tengu_history_picker_scope",{from:d(he),to:d(Mt)})},{context:"HistorySearch"});let Je=filterItems(Te,Le);setState({items:Te?Te.items:[],status:Te?Te.status:null,scope:he,query:Le,filtered:Je}),at=L>=100,_t=at?Math.floor((L-6)*0.5):L-6,xt=Math.max(20,_t-fHe-1),Ct=at?Math.max(20,L-_t-12):Math.max(20,L-10);return e(gLt,{title:r(n,{children:["Search prompts ",r(n,{color:"suggestion",children:["\xB7 ",he]}),Te?.status==="truncated"&&r(n,{dimColor:!0,children:[" ","\xB7 newest ",Te.items.length.toLocaleString()," only"]})]}),placeholder:"Filter history\u2026",initialQuery:h,items:Je,getKey:(Pt)=>String(Pt.entry.timestamp),onQueryChange:He,onSelect:(Pt)=>{i("tengu_history_picker_select",{result_count:Je.length,query_length:Le.length}),Pt.entry.resolve().then((Mt)=>{g("history_search_accept"),T(Mt)},(Mt)=>{throw m("history_search_accept","accept_resolve_failed"),Mt})},onCancel:M,resetKey:he,extraHints:[e(z,{chord:je,action:"scope"},"scope"),gee()&&e(n,{children:"Esc i / for slash commands"},"vim")],emptyMessage:(Pt)=>KLt(Te,Pt),selectAction:"use",direction:"up",previewPosition:at?"right":"bottom",renderItem:(Pt,Mt)=>{let Ft=rw(new Date(Pt.entry.timestamp));return r(n,{children:[r(n,{dimColor:!0,children:[Ft," ".repeat(Math.max(0,fHe-ae(Ft)))]}),r(n,{color:Mt?"suggestion":void 0,children:[" ",ct(Pt.firstLine,xt)]})]})},renderPreview:(Pt)=>{let Mt=Nu(Pt.display,Ct,{hard:!0}).split(`
`).filter((Xt)=>Xt.trim()!==""),Ft=Mt.length>nG,Et=Mt.slice(0,Ft?nG-1:nG),Kt=Mt.length-Et.length;return r(s,{flexDirection:"column",borderStyle:"round",borderDimColor:!0,paddingX:1,height:nG+2,children:[Et.map((Xt,no)=>e(n,{dimColor:!0,children:Xt},no)),e(wy,{count:Kt})]})}}),{isSearching:he,historyQuery:Le,scope:()=>he,setHistoryQuery:He,handleKeyDown:()=>{},openSearch:()=>{},stateSink:setState}}
return {Kse,pickerFrameProps};
}
/** Source gLt element for hosts that render the picker through their own document tree. */
export function scopePickerFrameElement(presentHost, props) { return presentHost.frame ? presentHost.frame(props) : null; }
export function scopePickerFramePropsFor(source, state) { return source.pickerFrameProps(state); }
