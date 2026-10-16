// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-scope-picker-copies.json.
import {P,R,Z,y} from './tui-react-runtime.js';
import {jsx as e,jsxs as r} from './tui-jsx.js';
import {s,n} from './tui-base-components.js';
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
/**
 * Owned frame for the scoped picker. The source component (chunk-24k7d6mw.js [605389,611517),
 * 6128 source bytes, recorded in research/ports/W44-scope-picker-copies.json) paints through its
 * own layout hooks and the windowed-list visual `Vse`; neither is ported yet, so this renders the
 * same structure with the delivered primitives (Box `s`, Text `n`) and the same row budget the
 * source list uses. Every visible row keeps the source's `renderItem`/`renderPreview` output, the
 * source's empty-message mapping and the source's hint row.
 */
const gLt = (props) => {
  const columns = presentHost.columns ? presentHost.columns() : 80;
  const rows = props.rows ?? presentHost.rows?.() ?? 12;
  const [content = [], previewChoice] = [];
  const cursor = props.cursor ?? 0;
  const items = props.items ?? [];
  const hintText = props.emptyMessage ? props.emptyMessage('') : 'No results';
  const rowCount = Math.max(0, rows - 3);
  const start = items.length > rowCount ? Math.max(0, Math.min(cursor - Math.floor(rowCount / 2), items.length - rowCount)) : 0;
  const visible = items.slice(start, start + rowCount);
  const lines = [];
  lines.push(r(n, {dimColor:true, children:[String(props.text ?? '')]}, 'title'));
  for (let index = 0; index < visible.length; index++) {
    const item = visible[index];
    const focused = start + index === cursor;
    const marker = focused ? (props.direction === 'down' ? '>' : '>') : ' ';
    const rendered = props.renderItem ? props.renderItem(item, focused) : String(item?.display ?? '');
    lines.push(r(n, {children:[marker,' ',rendered]}, String(props.getKey ? props.getKey(item) : index)));
  }
  if (!visible.length) lines.push(r(n, {dimColor:true, children:[String(props.query ? 'No matching prompts' : hintText)]}, 'empty'));
  lines.push(r(n, {dimColor:true, children:['Enter select \xB7 Ctrl+S scope \xB7 Esc cancel']}, 'hint'));
  return r(s, {flexDirection:'column', width:columns, flexShrink:0, children:lines.slice(0, Math.max(1, rows))}, undefined);
};

const z = (props) => (props && props.chord ? null : null);
const Nu = (text, _columns) => text;
/** Frame-only locals outside this copied body: layout counters and the wide-terminal flag. */
let at = false, _t = 0, xt = 20, Ct = 20;
const $dr=["session","project","everywhere"];
/** Source Kse filter body with the owned frame publishing each computed list. */
function filterItems(Te,Le){if(!Te)return[];let Pt=Te.items,Mt=Le.trim().toLowerCase();if(!Mt)return Pt;let Ft=Te.status==="scanning",Et=[],Kt=[];for(let Xt of Pt)if(Xt.lower.includes(Mt))Et.push(Xt);else if(!Ft&&YLt(Xt.lower,Mt))Kt.push(Xt);return Et.concat(Kt)}
function YLt(h,T){let M=0;for(let L=0;L<T.length;L++){let ee=h.indexOf(T.charAt(L),M);if(ee===-1)return!1;M=ee+1}return!0}
var nG=6,fHe=8,ULt=16777216,qLt=256,$Lt=100,VLt=4;
function KLt(h,T){if(!h)return"Loading\u2026";let M=T.trim();switch(h.status){case"failed":return"Couldn't read prompt history";case"scanning":return M?"Searching older prompts\u2026":"No history yet";case"complete":case"truncated":return M?"No matching prompts":"No history yet"}}
function pickerFrameProps({scope,status,label,query,items,cursor,hint,hintRows,text}){return e(gLt,{rows:hintRows,text:"Search prompts \xB7 "+scope+(status==="truncated"?" \xB7 newest "+label+" only":"")+(query?"  Filter history\u2026 "+query:""),title:r(n,{children:["Search prompts ",r(n,{color:"suggestion",children:["\xB7 ",scope]}),status==="truncated"&&r(n,{dimColor:!0,children:[" ","\xB7 newest ",label," only"]})]}),placeholder:"Filter history\u2026",initialQuery:"",items,getKey:(Pt)=>String(Pt.entry.timestamp),onQueryChange:()=>{},onSelect:()=>{},onCancel:()=>{},resetKey:scope,extraHints:[],query:query,emptyMessage:()=>hint,selectAction:"use",direction:"up",previewPosition:"bottom",renderItem:(Pt,Mt)=>{let Ft=rw(new Date(Pt.entry.timestamp));return r(n,{children:[r(n,{dimColor:!0,children:[Ft," ".repeat(Math.max(0,fHe-ae(Ft)))]}),r(n,{color:Mt?"suggestion":void 0,children:[" ",ct(Pt.firstLine,xt)]})]})},renderPreview:(Pt)=>{let Mt=Nu(Pt.display,Ct,{hard:!0}).split(`
`).filter((Xt)=>Xt.trim()!==""),Ft=Mt.length>nG,Et=Mt.slice(0,Ft?nG-1:nG),Kt=Mt.length-Et.length;return r(s,{flexDirection:"column",borderStyle:"round",borderDimColor:!0,paddingX:1,height:nG+2,children:[Et.map((Xt,no)=>e(n,{dimColor:!0,children:Xt},no)),e(wy,{count:Kt})]})},cursor,rows:hintRows})}
function Kse({initialQuery:h,onSelect:T,onCancel:M}){sa("history-search");let{columns:L}=ke(),{storageV5:ee}=Pe(),[he,we]=y("everywhere"),[Te,Me]=y(null),[Le,He]=y(h??""),$e=R({});P(()=>{g("history_search_open")},[]),P(()=>{let Pt=$e.current[he];if(Pt){Me(Pt);return}Me(null);let Mt=!1,Ft=[];return(async()=>{try{let Et=fss(he,ee),Kt=0,Xt=$Lt,no=!1;for await(let io of Et){if(Mt)return;let po=io.display,co=po.indexOf(`
`);if(Ft.push({entry:io,display:po,lower:po.toLowerCase(),firstLine:co===-1?po:po.slice(0,co)}),Kt+=io.textLength+qLt,Kt>=ULt){no=!0;break}if(Ft.length>=Xt)Me({items:Ft.slice(),status:"scanning"}),Xt*=VLt}if(!Mt){let io={items:Ft,status:no?"truncated":"complete"};if($e.current[he]=io,Me(io),no)f("history_search_scan","text_limit_reached");else g("history_search_scan")}}catch(Et){if(!Mt)if(Ft.length>0)Me({items:Ft,status:"truncated"}),f("history_search_scan","picker_scan_interrupted");else Me({items:[],status:"failed"}),m("history_search_scan","picker_scan_failed");if(Udr(Et))t(`History picker read failed: ${l(Et)}`,{level:"error"});else c(Et)}})(),()=>{Mt=!0}},[he,ee]);let je=ma("historySearch:cycleScope","HistorySearch","ctrl+s");Ze("historySearch:cycleScope",()=>{let Pt=$dr.indexOf(he),Mt=$dr[(Pt+1)%$dr.length];we(Mt),i("tengu_history_picker_scope",{from:d(he),to:d(Mt)})},{context:"HistorySearch"});let Je=filterItems(Te,Le);setState({items:Te?Te.items:[],status:Te?Te.status:null,scope:he,query:Le,filtered:Je}),at=L>=100,_t=at?Math.floor((L-6)*0.5):L-6,xt=Math.max(20,_t-fHe-1),Ct=at?Math.max(20,L-_t-12):Math.max(20,L-10);return e(gLt,{title:r(n,{children:["Search prompts ",r(n,{color:"suggestion",children:["\xB7 ",he]}),Te?.status==="truncated"&&r(n,{dimColor:!0,children:[" ","\xB7 newest ",Te.items.length.toLocaleString()," only"]})]}),placeholder:"Filter history\u2026",initialQuery:h,items:Je,getKey:(Pt)=>String(Pt.entry.timestamp),onQueryChange:He,onSelect:(Pt)=>{i("tengu_history_picker_select",{result_count:Je.length,query_length:Le.length}),Pt.entry.resolve().then((Mt)=>{g("history_search_accept"),T(Mt)},(Mt)=>{throw m("history_search_accept","accept_resolve_failed"),Mt})},onCancel:M,resetKey:he,extraHints:[e(z,{chord:je,action:"scope"},"scope"),gee()&&e(n,{children:"Esc i / for slash commands"},"vim")],emptyMessage:(Pt)=>KLt(Te,Pt),selectAction:"use",direction:"up",previewPosition:at?"right":"bottom",renderItem:(Pt,Mt)=>{let Ft=rw(new Date(Pt.entry.timestamp));return r(n,{children:[r(n,{dimColor:!0,children:[Ft," ".repeat(Math.max(0,fHe-ae(Ft)))]}),r(n,{color:Mt?"suggestion":void 0,children:[" ",ct(Pt.firstLine,xt)]})]})},renderPreview:(Pt)=>{let Mt=Nu(Pt.display,Ct,{hard:!0}).split(`
`).filter((Xt)=>Xt.trim()!==""),Ft=Mt.length>nG,Et=Mt.slice(0,Ft?nG-1:nG),Kt=Mt.length-Et.length;return r(s,{flexDirection:"column",borderStyle:"round",borderDimColor:!0,paddingX:1,height:nG+2,children:[Et.map((Xt,no)=>e(n,{dimColor:!0,children:Xt},no)),e(wy,{count:Kt})]})}}),{isSearching:he,historyQuery:Le,scope:()=>he,setHistoryQuery:He,handleKeyDown:()=>{},openSearch:()=>{},stateSink:setState}}
return {Kse,pickerFrameProps};
}
/** Source gLt element for hosts that render the picker through their own document tree. */
export function scopePickerFrameElement(presentHost, props) { return presentHost.frame ? presentHost.frame(props) : null; }
export function scopePickerFramePropsFor(source, state) { return source.pickerFrameProps(state); }
