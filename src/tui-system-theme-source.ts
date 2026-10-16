// @ts-nocheck
// Source bodies: research/ports/W44-system-theme-copies.json.
import {Yp} from './tui-osc-parser.js';
const PH="",CZ={OSC:93},nG="",Y9e=";";
var C=PH+String.fromCharCode(CZ.OSC),hxn=PH+"\\";
const fl=(...parts)=>"["+parts.join(";");
const A=()=>process.env.terminal??(process.env.TERM==="xterm-kitty"?"kitty":undefined);
const K3t=()=>process.env.TMUX?"tmux":process.env.STY?"screen":null;
function gh(...e){let r=A()==="kitty"?hxn:nG;return`${C}${e.join(Y9e)}${r}`}
function OI(e){let r=K3t();if(r==="tmux")return`\x1BPtmux;${e.replaceAll("\x1B","\x1B\x1B")}\x1B\\`;if(r==="screen")return`\x1BP${e.replaceAll("\x1B","\x1B\x1B")}\x1B\\`;return e}
function mFo(e){return{request:gh(e,"?"),match:(n)=>n.type==="osc"&&n.code===e}}
const ALr=(()=>{
var C=fl("c");
class ALr{stdout;queue=[];isInputAttached=!1;themeChangeSubscribers=new Set;constructor(e){this.stdout=e}setInputAttached(e){if(this.isInputAttached=e,!e)return;for(let n of this.queue)if(n.kind!=="barrier"&&!n.written)this.write(n)}owed(){let e=0;for(let n of this.queue)if(n.kind==="barrier"||n.kind==="sentinel"&&n.written)e++;return e}subscribeThemeChange(e){return this.themeChangeSubscribers.add(e),()=>{this.themeChangeSubscribers.delete(e)}}send(e){return new Promise((n)=>{this.enqueue({kind:"query",request:e.request,written:!1,match:e.match,resolve:(o)=>n(o)})})}flush(){return new Promise((e)=>{this.enqueue({kind:"sentinel",request:C,written:!1,resolve:e})})}cancel(e){let n=this.queue.findIndex((t)=>t.kind==="query"&&t.match===e.match);if(n===-1)return;let[o]=this.queue.splice(n,1);if(o?.kind==="query")o.resolve(void 0)}resync({probe:e}){for(let n of this.queue.splice(0))if(n.kind==="query")n.resolve(void 0);else if(n.kind==="sentinel")n.resolve(!1);if(e&&this.isInputAttached)this.queue.push({kind:"barrier"}),this.stdout.write(C)}onResponse(e){if(e.type==="themeNotify"){for(let t of this.themeChangeSubscribers)t(e.dark);return!0}if(this.queue[0]?.kind==="barrier"){if(e.type==="da1")this.queue.shift();return!0}let n=this.queue.findIndex((t)=>t.kind==="query"&&t.match(e));if(n!==-1){let[t]=this.queue.splice(n,1);if(t?.kind==="query")t.resolve(e);return!0}if(e.type!=="da1")return!1;let o=this.queue.findIndex((t)=>t.kind==="sentinel");if(o===-1)return!1;for(let t of this.queue.splice(0,o+1))if(t.kind==="query")t.resolve(void 0);else if(t.kind==="sentinel")t.resolve(!0);return!0}enqueue(e){if(this.queue.push(e),this.isInputAttached)this.write(e)}write(e){e.written=!0,this.stdout.write(e.request)}}
return ALr;
})();
function SKo(e){let t=i(e);if(!t)return;return 0.2126*t.r+0.7152*t.g+0.0722*t.b>0.5?"light":"dark"}
function i(e){let t=/^rgba?:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})/i.exec(e);if(t)return{r:m(t[1]),g:m(t[2]),b:m(t[3])};let n=/^#([0-9a-f]+)$/i.exec(e);if(n&&n[1].length%3===0){let r=n[1],o=r.length/3;return{r:m(r.slice(0,o)),g:m(r.slice(o,2*o)),b:m(r.slice(2*o))}}return}
function m(e){let t=16**e.length-1;return parseInt(e,16)/t}
export function initializeSystemThemeWatcher({a,Gle,Q,t,DT,tWt,oi,REe,oX,ifn}) {
  var v=2000;
function B(e,l,p){let i=!1,m=!1,y=p?.muxTimeoutMs??v,u=Boolean(a.TMUX||a.STY)&&!Gle();async function c(){if(m)return;m=!0;try{let r=mFo(Yp.SET_BG_COLOR),s=u?{...r,request:OI(r.request)}:r,o,f=u?"dcs":"direct";if(u){if(o=await Promise.race([e.send(s),Q(y,void 0,{unref:!0}).then(()=>{return})]),!o)if(i)e.cancel(s);else e.flush(),f="mux-bare",[o]=await Promise.all([e.send(r),e.flush()])}else[o]=await Promise.all([e.send(s),e.flush()]);if(i)return;if(!o){t(`systemTheme: OSC 11 query (via=${f}) got no response`,{level:"debug"}),DT().osc11Responsive=!1;return}DT().osc11Responsive=!0;let n=SKo(o.data);if(t(`systemTheme: OSC 11 response=${o.data} detected=${n} via=${f}`,{level:"debug"}),n===void 0)return;tWt(n),l(n)}finally{m=!1}}let d=a.CLAUDE_BG_BACKEND==="daemon";if(DT().osc11Responsive!==!1&&!d)c();let T=e.subscribeThemeChange((r)=>{if(oi().get(process.stdout)?.modes.isSet("surface")){let s=r?"dark":"light";t(`systemTheme: theme-change push reported=${s}; surface override active, skipping OSC 11 query`,{level:"debug"}),tWt(s),l(s);return}c()}),h=d?REe(()=>{if(oX()==="focused")ifn().then(()=>{if(!i)c()})}):void 0;return()=>{i=!0,T(),h?.()}}
  return B;
}
export {ALr,mFo,SKo};
