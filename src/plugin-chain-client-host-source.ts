// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
//   chunk-am9mebpw.js sha256 5f299ffd418fdb1dc31123d44ad13270aa6fcbb68e0686709982292c7a1e3f14
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Ae, R, P, y, en, le, Rt, Tc, s, n } from './plugin-chain-react-hooks.js';
import { Ce, eg } from './plugin-chain-react-surface-source.js';
import { kc, Ys } from './plugin-chain-code-host.js';
import { eE } from './plugin-chain-markdown-host.js';
import { Re } from './plugin-chain-hover-source.js';
import { wFt, yo, ko, Lc, ee } from './plugin-chain-press-button-source.js';
import { Kje, $pn, W1o, c9, Ri, G1o, Qrt, i5t, kAt, m4n, iZr, ot, VV, c, t } from './plugin-chain-client-host.js';

// chunk-kjfwbh4w.js `Vo`+`XD` — the boundary message and the error boundary: reset on a new key, report a throw once, draw the fallback [3241,4161) 920 units sha256 9aaf964a73699ff825405b990e1874a69a6683d9aa14e06aaa22621ed9390e8f
var Vo="a boundary caught a throw (message not reported)";class XD extends iZr{constructor(o){super(o);this.state={hasError:!1,resetKey:o.resetKey}}static getDerivedStateFromError(){return{hasError:!0}}static getDerivedStateFromProps(o,i){return Object.is(o.resetKey,i.resetKey)?null:{hasError:!1,resetKey:o.resetKey}}componentDidCatch(o,i){let p=this.reported(o);if(p!==null)c(p);try{this.props.onError?.(o,i)}catch(a){t(`SentryErrorBoundary: onError threw: ${a instanceof Error?a.message:"a value that is no error"}`,{level:"error"})}}reported(o){if(this.props.telemetryMessage===void 0)return o;let i=this.messageAsked(this.props.telemetryMessage);if(i===null)return null;let p=ot(o,i);return VV(p)===void 0?ot(Error("a value that takes no telemetry message was thrown"),i):p}messageAsked(o){try{return o()}catch{return Vo}}render(){if(this.state.hasError)return this.props.fallback??null;return this.props.children}}

// chunk-kjfwbh4w.js `wo` — the hosted client: its ref, click subscription, focus effects and key dispatch [28121,28534) 413 units sha256 2589f2b75c71ce336a98140937a92465d1aae8028fbf55be31d32d5fa82165e8
function wo(o){let i=le(()=>W1o(o.id),[o]),p=wFt(i),a=Re(Kje,(f)=>f.focusedId)===o.id,m=Re(Ri(),(f)=>f.focusedId);return P(()=>{if(m!==null&&a)$pn(null)},[m,a]),P(()=>i,[i]),Ey((f,u,d)=>{let x=Kje.getState().focusedId===o.id,g=u.escape||u.ctrl&&(f==="c"||f==="d");if(!x)return!1;if(!o.acceptsKeys())return i(),!1;if(g)return $pn(null),u.escape;let h=ko(f===""?d:f,u);if(h===void 0)return!1;return o.key(h),!0}),p}

// chunk-kjfwbh4w.js `To` — the terminal mount: props, layout, redraw, resize, pointer and key events, the drawn tree [28534,29637) 1103 units sha256 afe9477db8169889d505128aa65dddd1ddd6a4aab050c05cc40fb1a073c47442
function To({host:o,instance:i,snapshot:p}){let{rebuild:a,props:m,width:f,height:u,flexGrow:d,plugin:x,elementKey:g}=o,h=wo(i);P(()=>{i.setProps(m)},[i,m]),P(()=>{i.drawnAgain()},[i,o.drawn]);let T=kc(()=>h.current===null?0:Ys(h.current).width),S=kc(()=>h.current===null?0:Ys(h.current).height);en(()=>{i.laidOut()}),P(()=>{i.resize(T,S)},[i,T,S]);let k=R({x:0,y:0}),C=p.status==="drawn",v=C&&i.acceptsPointer(),G=v||C&&i.acceptsKeys();m4n(v);function L(H){if(H.type==="down"&&i.acceptsKeys())c9(null),$pn(i.id);k.current={x:H.localCol,y:H.localRow},i.pointer({type:H.type,x:H.localCol,y:H.localRow,...H.fine&&{fine:{x:H.fine.col,y:H.fine.row}},...H.button!==void 0&&{button:yo(H.button)},...H.shift&&{shift:!0},...H.alt&&{alt:!0},...H.ctrl&&{ctrl:!0}})}return Tc(s,{ref:h,flexDirection:"column",flexShrink:0,width:f,height:u,flexGrow:d,overflow:"hidden",elementKey:g,elementPlugin:x,...G&&{onPointer:L,onMouseEnter:()=>{i.pointer({type:"enter",...k.current})},onMouseLeave:()=>{i.pointer({type:"leave",...k.current})}}},C&&a(p.tree),p.status==="failed"&&Tc(n,{dimColor:!0,wrap:"truncate-end"},p.text))}

// chunk-kjfwbh4w.js `Ro` — the clock adapter: interval fallback or the clock keep-alive subscription [29641,29858) 217 units sha256 4cd1c97ece1282275c49ec726324c2eaefbad70001e29ddf72d0398b4e70422e
function Ro(o){if(o===null)return{every:(i,p)=>{let a=setInterval(p,Math.max(i,eg));return()=>clearInterval(a)}};return{every:(i,p)=>{let a=o.now();return o.subscribeKeepAlive(()=>{let m=o.now();if(m-a>=i)a=m,p()})}}}

// chunk-kjfwbh4w.js `bo` — the loading snapshot [29858,29899) 41 units sha256 26fb39a668adb38dc2c5d3b99e7a28847da30ea3b93adbdf5a7a7cafe31d46fe
var bo=Object.freeze({status:"loading"});

// chunk-kjfwbh4w.js `Co` — the inert client instance (the source no-client default) [29899,30201) 302 units sha256 fde8615035310a6fe08d13f2c49d7d2edccdbd4e495463125742591d67ba3a8b
var Co=Object.freeze({id:"",plugin:"",module:"",subscribe:()=>()=>{return},getSnapshot:()=>bo,setProps:()=>{return},laidOut:()=>{return},resize:()=>{return},pointer:()=>{return},key:()=>{return},acceptsPointer:()=>!1,acceptsKeys:()=>!1,threw:()=>{return},drawnAgain:()=>{return},release:()=>{return}});

// chunk-kjfwbh4w.js `So` — acquire the plugin client for the element and release it on unmount [30219,30538) 319 units sha256 ad15e00595005ecaf534813eab19b36b5abb89b4a6d679e7f51c5d3ae19250b6
function So(o){let{plugin:i,elementKey:p,props:a}=o,m=Ae(ee),f=Ae(eE),[u,d]=y(Co),[x]=y(()=>a);return en(()=>{let g=G1o.acquire({plugin:i,component:m?.component??"AbovePrompt",requestId:m?.requestId??Ce,surface:"terminal",key:p,module:o.module,props:x,clock:Ro(f)});return d(g),()=>g.release()},[i,o.module,p,m,f,x]),u}

// chunk-kjfwbh4w.js `Io` — the Client host: acquire, subscribe to the snapshot and mount `To` under the boundary [30538,30927) 389 units sha256 9dd9997c5d85558cc3d83de1db90d8c7e0c26d4d9e980c5b3bda1b4f8234b73f
function Io(o){let i=So(o),p=Rt(i.subscribe,i.getSnapshot),a=Ae(ee)?.component??"AbovePrompt",{width:m,height:f,flexGrow:u}=o;return Tc(XD,{resetKey:p,telemetryMessage:()=>i5t(a,kAt([Qrt(o.plugin)].filter((d)=>d!==void 0)),"Client"),onError:i.threw,fallback:Tc(s,{flexShrink:0,width:m,height:f,flexGrow:u,overflow:"hidden"},Tc(n,null," ")),children:Tc(To,{host:o,instance:i,snapshot:p})})}

// chunk-am9mebpw.js `Ey` — register a pre-dispatch key handler while mounted and active [1357,1549) 192 units sha256 d26733e90f51ccb89dfe4fa7b3f29697817a9826a04aa81718718fa7ce3f0c2b
function Ey(e,{isActive:o=!0}={}){let r=Lc(),[t]=y(()=>({handler:e}));en(()=>{t.handler=e}),P(()=>{if(!o||!r)return;return r.registerPreDispatch({handler:(s,n,i)=>t.handler(s,n,i)})},[o,r,t])}


export { XD, wo, To, Ro, bo, Co, So, Io, Ey };
