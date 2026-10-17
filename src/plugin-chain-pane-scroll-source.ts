// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { R, le, en, P, hh, N } from "./plugin-chain-react-hooks.js";
import { fd } from "./plugin-chain-above-prompt-select-keys-source.js";
import { wFe, kFe, xFe, W1, PFe } from "./plugin-chain-above-prompt-parts-source.js";
import { vFe } from "./plugin-chain-above-prompt-source.js";
import { _z, ahe, PY } from "./plugin-chain-scroll-focus.js";
import { Ohe } from "./plugin-chain-press-dispatch-source.js";
import { N5t } from "./plugin-chain-classic-raise-source.js";
import { P0 } from "./plugin-chain-records.js";
import { fse } from "./plugin-chain-above-prompt-focus-source.js";
import { t } from "./plugin-chain-host.js";

// chunk-24k7d6mw.js RFe the pane scroll host [444994,446991) 1997 units sha256 5e399249f3f7fe2a6f8c2029c9311683eb12c7f0c6cbb73c2933fe919d403f73
function RFe(h){let{component:T,requestId:M,owner:L,content:ee}=h,{bodyRows:he,contentRows:we,maxOffset:Te}=h,[Me,Le,He]=fd(0),[$e,je,Je]=fd(!1),[at,_t]=hh((go)=>go+1,0),xt=R({bodyRows:he,contentRows:we,maxOffset:Te}),Ct=R(!1),Pt=R(void 0),Mt=R(!1),Ft=R(0),Et=R(void 0),Kt=R(!0),Xt=le(()=>Je()?xt.current.maxOffset:Math.min(He(),xt.current.maxOffset),[He,Je]),no=le((go)=>{let Mo=W1(go);if(Mo!==Xt())Mt.current=Ct.current,Ft.current=0,Et.current=void 0;je(!1),Le(Mo)},[Le,je,Xt]),io=le((go,Mo)=>{if(Mo.kind==="plugin")return no(go),!0;if(Mt.current)return!1;let ko=W1(go),Fo=Pt.current;if(!(Je()&&Fo!==void 0&&Fo.by>0&&ko===Fo.offset)&&ko!==Xt())je(!1),Le(ko);return!0},[Le,je,no,Xt,Je]),po=le((go)=>{let Mo=Xt(),ko=go();if(Xt()!==Mo)_t();return ko},[Xt]),co=le((go,Mo)=>{let ko=xt.current,Fo=Math.min(ko.maxOffset,W1(Xt()+go));Ct.current=!0,Pt.current={by:go,offset:Fo},Mt.current=!1,Ohe(`ui.scroll ${T} ${M}`,xwt({input:{component:T,requestId:M,offset:Fo,by:go,bodyRows:ko.bodyRows,contentRows:ko.contentRows,origin:{kind:"person"},...Mo!==void 0&&{pointer:Mo}}})).finally(()=>{Ct.current=!1,Pt.current=void 0;let Yo=Ft.current,Vo=Et.current;if(Ft.current=0,Et.current=void 0,Kt.current&&Yo!==0)co(Yo,Vo)})},[T,M,Xt]),_o=le((go)=>no(go(He())),[no,He]);function xo(go,Mo){if(go===0)return;if(Ct.current){Ft.current+=go,Et.current=Mo;return}co(go,Mo)}return en(()=>{xt.current={bodyRows:he,contentRows:we,maxOffset:Te}},[he,we,Te]),en(()=>{if($e&&He()!==Te)Le(Te)},[$e,Te,He,Le]),P(()=>{let go=_z(T,M);return ahe().set(go,{component:T,requestId:M,owner:L,bodyRows:he,contentRows:we,maxOffset:Te,offset:()=>Je()?Te:Math.min(He(),Te),keyRows:(Mo,ko)=>{let Fo=ee.current;return Fo?kFe(Fo,ko,Mo):void 0},commit:(Mo,ko)=>po(()=>io(Math.min(Te,Mo),ko)),followEnd:()=>po(()=>je(!0))}),()=>{ahe().delete(go)}},[T,M,L,he,we,Te,ee,io,po,He,Je,je]),P(()=>()=>{Kt.current=!1},[]),xFe({offset:$e?Te:Math.min(Me,Te),bodyRows:he,contentRows:we,maxOffset:Te,scrollBy:xo},{placed:$e?Te:Me,place:_o,raised:at})}N();

// chunk-sfn1dbxq.js xwt the ui.scroll dispatch [476926,477331) 405 units sha256 2962f441652bec31cb733ec329f642020c015f95eff9f16a9b0b95d8dd099954
async function xwt(e){let{input:n,hookOrigin:r,signal:s}=e,h=N5t({event:"ui.scroll",e:n,origin:r},s);if(h!==void 0)return await h,xwt(e);let y=P0("ui.scroll",r),w=y.length===0?PY(n):await fse({event:"ui.scroll",input:n,handlers:y,hookOrigin:r,signal:s},PY);return t(`ui.scroll ${n.component} ${n.requestId} (${n.origin.kind}) by ${n.by} to ${n.offset}: `+(w.deny===void 0?"moved":`denied (${w.deny})`)),w}


export { xwt, RFe };
