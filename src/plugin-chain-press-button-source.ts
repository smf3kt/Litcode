// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
//   chunk-ae84tp6z.js sha256 901937cc8e68c765b7dddc4875578a6b1759f5e9a2535bee85829bea8ace200f
//   chunk-bwyexfny.js sha256 35fae44d02574c1e366e2c50484d2ce75e87a0b017d91b0e5a8a6ca4bc8ff647
//   chunk-06azbynj.js sha256 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd
//   chunk-8zgs1qmk.js sha256 023321c4663c081a393179a5f1ff9d533af036d7c78c366d2b31ab0657647dcb
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { qt, Ae, R, Rt, P, Z, y, en, Tc, s, n } from './plugin-chain-react-hooks.js';
import { D } from './plugin-chain-source.js';
import { TIe } from './plugin-chain-press-dispatch-source.js';
import { xe } from './plugin-chain-select-field-source.js';
import { jt, Bt } from './plugin-chain-hover-source.js';
import { u, ix, KH } from './plugin-chain-press-button-host.js';

// chunk-kjfwbh4w.js `co` — the action-key rank/sequence comparator [25258,25316) 58 units sha256 361726a04380e17c58cb7bc8809cae7e26600dcbed3175868ecfcb588d285552
var co=(o,i)=>o.rank>i.rank||o.rank===i.rank&&o.seq>i.seq;

// chunk-kjfwbh4w.js `xo` — the action-key store: add/remove/winnerOf/held/clear [25316,25578) 262 units sha256 88c8462077c56f0991615c92b3f784e296e58455c6faf4dbf79012f194132731
function xo(){let o=[],i=0;function p(a){let m=o.indexOf(a);if(m>=0)o.splice(m,1)}return{add:(a)=>{p(a),a.seq=++i,o.push(a)},remove:p,winnerOf:(a)=>o.filter((m)=>m.action===a).reduce((m,f)=>m===void 0||co(f,m)?f:m,void 0),held:()=>[...o],clear:()=>{o.length=0}}}

// chunk-kjfwbh4w.js `Yt` — the store the seats register in [25578,25609) 31 units sha256 9a02018e83c25c64576445cc9fb08a2632baa048ffdb8ecb68cb68e6d203d7f9
var Yt=Ge(xo(),(o)=>o.clear());

// chunk-kjfwbh4w.js `Ds` — the binding contexts an action is bound in [25609,25674) 65 units sha256 c454314978c340482c211c483e7d505328909f12a87b3360400ed3a55bebad8f
var Ds=(o,i)=>D(i.filter((p)=>p.action===o).map((p)=>p.context));

// chunk-kjfwbh4w.js `_s` — the component rank: Pane 2, AbovePrompt 1, else 0 [25674,25721) 47 units sha256 77c671c64a9a6f8b2df08dda8d8ad2af105d76e6a054d818d49a23f9d8c50fc3
var _s=(o)=>o==="Pane"?2:o==="AbovePrompt"?1:0;

// chunk-kjfwbh4w.js `ee` — the render-instance context [25725,25741) 16 units sha256 7badedaa3d787f83cfb981e6288ee361aea2d6aa619cb07a725ddbd067feced3
var ee=qt(null);

// chunk-kjfwbh4w.js `Qt` — the action-key seat: register one handler per bound context, dispatching the winning held press [25741,26268) 527 units sha256 8f2fb818a54d672a62318750e5576baef5333943b33ddc2807464725b98d2f79
function Qt(o){let{plugin:i,handle:p,action:a}=o,m=Ae(ee),f=Lc(),u=kj(),d=_s(m?.component),[x]=y(()=>({action:a,rank:d,seq:0,plugin:i,handle:p})),g=f?.bindings,h=Z(()=>Ds(a,g??[]),[a,g]);en(()=>{x.plugin=i,x.handle=p,x.rank=d}),P(()=>(x.action=a,Yt.add(x),()=>Yt.remove(x)),[a,x]),P(()=>{if(!f||u)return;let T=h.map((S)=>f.registerHandler({action:a,context:S,handler:()=>{let k=Yt.winnerOf(a);if(k===void 0)return!1;TIe({plugin:k.plugin,handle:k.handle})},singleKey:!0,fallback:!0}));return()=>{for(let S of T)S()}},[f,a,h,u])}

// chunk-kjfwbh4w.js `Jt` — the seat as a childless component [26268,26301) 33 units sha256 50266d0e1b409c47d91d687ad0487fa2a46f1ec733f8937b0ecf7d19d586988f
function Jt(o){return Qt(o),null}

// chunk-kjfwbh4w.js `y3n` — the hotkey seat context [26305,26322) 17 units sha256 0adbacd7406d2da10ea3dfef481bc07dfb60ccdb7e5a795ccb66f020fe09e010
var y3n=qt(null);

// chunk-kjfwbh4w.js `_3n` — blur the focused descendant of a pressed button [26322,26437) 115 units sha256 c89f837d51c1bb306122b3ad2b7d4761962d0f0e311ab50611f0e932d650b079
function _3n(o){if(!o)return;let i=ix(o),p=i.activeElement??void 0;while(p&&p!==o)p=p.parentNode;if(p===o)i.blur()}

// chunk-kjfwbh4w.js `Zt` — the Button: click box, action-key seat, focusable action box and the label/hotkey/held render prop [26437,27368) 931 units sha256 a167d4c5377de326ea1f777d95fda855b8f407a894495e5754289c35c137c8df
function Zt({plugin:o,handle:i,element:p,label:a,hotkey:m,action:f,plain:u,dimColor:d,variant:x,hover:g,held:h}){let{hasKeyboardFocus:T,ref:S}=xe({plugin:o,handle:i}),k=R(null),C=Ae(y3n);en(()=>{let L=k.current;return m!==void 0&&C!==null&&L!==null?C(m,L):void 0},[C,m]);let{overrides:v,handlers:G}=jt(Bt(o,g),g,"Box");return Tc(s,{ref:k,flexShrink:0,alignSelf:"flex-start",elementKey:p,elementPlugin:o,onClick:(L)=>{_3n(k.current),L.stopImmediatePropagation()},...G},f!==void 0&&Tc(Jt,{plugin:o,handle:i,action:f}),Tc(KH,{ref:S,tabIndex:-1,flexShrink:0,alignSelf:"flex-start",onAction:()=>TIe({plugin:o,handle:i}),children:(L)=>{let H=L.focused||L.hovered||T,A=d===!0&&!H,K=u===!0,W=m===void 0,F=h.length>0,_=F?h:[a];return K?Tc(n,{inverse:H,dimColor:A,...v},W?"":Tc(n,{color:"suggestion"},m),W?"":": ",..._):Tc(n,{inverse:H,bold:!0,dimColor:A,color:x==="primary"?"suggestion":void 0,...v},...F?["[ ",...h," ]"]:[`[ ${a} ]`])}}))}

// chunk-kjfwbh4w.js `yo` — the alignment name of a position [27380,27488) 108 units sha256 b5fa25dd318600be981b9d1a7753cb60f6c04e780e0e3f3262de9f78fc7892fb
function yo(o){switch(o){case 0:return"left";case 1:return"middle";case 2:return"right";case void 0:return}}

// chunk-kjfwbh4w.js `wFt` — the click subscriber: fire unless the press landed inside the ref or was a window activation [27496,27679) 183 units sha256 60c66cbfcb0f76ac3b9ca9df74c1d19b813e10f9095e692eff0bbf5fb8c4a352
function wFt(o){let i=R(null),{subscribeClicks:p}=Ae(Zy);return P(()=>p((a,m)=>{let f=a??void 0;while(f&&f!==i.current)f=f.parentNode;if(!f&&m?.isWindowActivation!==!0)o()}),[o,p]),i}

// chunk-kjfwbh4w.js `go` — the named-key table [27679,27924) 245 units sha256 a21d00e683d7a6ba71af5cef88ee028e48c118110809227b497c253fdbcf0001
var go=[["upArrow","up"],["downArrow","down"],["leftArrow","left"],["rightArrow","right"],["pageUp","pageup"],["pageDown","pagedown"],["home","home"],["end","end"],["return","return"],["tab","tab"],["backspace","backspace"],["delete","delete"]];

// chunk-kjfwbh4w.js `ko` — one key event as a `{key, ctrl, shift, meta}` binding, ignoring wheel events [27924,28121) 197 units sha256 48c0ccdac1c1ae9d5eacce9fb426d9a35a0324f2bd2a0a2ae0cfecaae0505a09
function ko(o,i){if(i.wheelUp||i.wheelDown)return;let p=go.find(([m])=>i[m])?.[1]??(o===" "?"space":o);return p===""?void 0:{key:p,...i.ctrl&&{ctrl:!0},...i.shift&&{shift:!0},...i.meta&&{meta:!0}}}

// chunk-ae84tp6z.js `Ge` — the identity wrapper around the action-key store [5355,5381) 26 units sha256 19b806bd3a5d4fe86648ae7621ec8e85d8be7064bd1d0fa8af9c627de5f30f90
function Ge(t,e){return t}

// chunk-bwyexfny.js `Lc` — the keybinding service from its context [3552,3579) 27 units sha256 5c8237bd48369fc065f3dad7dc2e98fb31a4649b11d2e190361f4d34f5261256
function Lc(){return Ae(u)}

// chunk-06azbynj.js `Pg` — the default app context: the no-op click/layout/frame subscriptions the click subscriber falls back to [224520,224782) 262 units sha256 78635f7becabb38e2998861d40ad93953716b1ddb9c486e3fd3276248278aeac
var Pg=qt({exit(){},focusManager:null,rootNode:null,dispatchPasteEvent(){},subscribeLayout:()=>()=>{},subscribeFrames:()=>()=>{},subscribeClicks:()=>()=>{},isHoverTracked:()=>!1,subscribeHoverTracked:()=>()=>{},retainFinePointer:()=>()=>{},terminalImages:null});

// chunk-06azbynj.js `Zy` — the alias the click subscriber reads the app context as [224818,224828) 10 units sha256 fc632a8527b56e1c428e8b7b3c51e599ebef5d77830fad7e14275ccb40ddbcb2
var Zy=Pg;

// chunk-8zgs1qmk.js `aq` — the dialog-store context [3768,3784) 16 units sha256 b8317be7a1e5c5cc77b187ae859bc3e196a0aa51c2a0f75f14ac5bfe8d7456c2
var aq=qt(null);

// chunk-8zgs1qmk.js `Ff` — the dialog store, throwing the source message outside a provider [3784,3957) 173 units sha256 85bb54cee80fd2b7de2e5d042b3a78e43a165d48f564c2da56a2134f170b9790
function Ff(){let o=Ae(aq);if(!o)throw ReferenceError("useDialogStore cannot be called outside of a DialogStoreContext provider (mounted by <AppStateProvider />)");return o}

// chunk-8zgs1qmk.js `iv` — the last open non-user dialog [911,976) 65 units sha256 8d2f9629934544f76d669e8727c7720beae8061548b42714243a14b8610a1ad1
function iv(o){return o.open.findLast((e)=>!e.userInvoked)??null}

// chunk-8zgs1qmk.js `kj` — whether a dialog is open (the action-key registration gate) [4043,4125) 82 units sha256 cf920fc425a46d32f5398bbbe47d0727f704fc72ffefd4b617f0259347b66148
function kj(){let o=Ff(),e=()=>iv(o.getState())!==null;return Rt(o.subscribe,e,e)}


export { co, xo, Yt, Ds, _s, ee, Qt, Jt, y3n, _3n, Zt, yo, wFt, go, ko, Ge, Lc, aq, Ff, iv, kj, Pg, Zy };
