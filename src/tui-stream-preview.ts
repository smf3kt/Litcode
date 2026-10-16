// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-preview-copies.json.
var s=globalThis.process?.getBuiltinModule?.("async_hooks");
var Ein=s?(e)=>s.AsyncResource.bind(e):(e)=>e;
function gs(t,e){let r=t,S=new Set,a=e&&Ein(e),s=()=>r;return{getSnapshot:s,getState:s,setState:(n)=>{let o=r,i=n(o);if(Object.is(i,o))return;r=i,a?.({newState:i,oldState:o});for(let u of S)u()},subscribe:(n)=>{let o=Ein(n);return S.add(o),()=>S.delete(o)}}}
var Uc=1e4;
function Vc(e){if(e.length<=Uc)return e;let r=e.slice(-Uc),n=r.charCodeAt(0);return n>=56320&&n<=57343?r.slice(1):r}
function PFn(e,r,n){return n?e+r:hfo(e,r)}
function hfo(e,r){let n=Vc(e),s=r.trimStart().replace(/^\u2026\s*/,""),h=s.startsWith(n)?s.slice(n.length):r;if(h.trim().length===0)return e;let b=/^([-*+>#]|\d{1,3}[.)]\s|```)/.test(h),y=/\n\s*$/.test(e),w="";if(b&&!y)w=`
`;else if((/[.!?\u2026\u3002\uFF01\uFF1F]["')\]]?$/.test(e)||/[\w,;:]$/.test(e))&&/^\w/.test(h))w=" ";return`${e}${w}${h}`}
var CHr=1;
var rc=2;
var sc=4;
function Vx(l){let{raw:u,transformed:m,rewrite:f,salvage:h,exact:T}=l,M=f!==null&&u?.startsWith(f.original)?f.text+u.slice(f.original.length):u||null,C=m??M,E=(h!==null?PFn(h,C??"",T):C)||null;return{displayed:E,hideTrailingLine:m===null&&!!u,displayedHasNewline:E!==null&&E.includes(`
`)}}
function tLo(){let l=gs({raw:null,transformed:null,rewrite:null,salvage:null,exact:!1}),u=null,m=null;function f(){let T=l.getState();if(m===null||u!==T)u=T,m=Vx(T);return m}function h(T,M){l.setState((C)=>C[T]===M?C:{...C,[T]:M})}return{setRaw:(T)=>h("raw",T),setTransformed:(T)=>h("transformed",T),setRewrite:(T)=>h("rewrite",T),setSalvage:(T,M)=>l.setState((C)=>{let _=M??C.exact;if(C.salvage===T&&C.exact===_)return C;return{...C,salvage:T,exact:_}}),getState:l.getState,getDerived:f,getFlags(){let T=l.getState(),{displayed:M,hideTrailingLine:C,displayedHasNewline:_}=f();return(T.raw!==null?CHr:0)|(M!==null?rc:0)|(M!==null&&C&&!_?sc:0)},subscribe:l.subscribe}}
class dlt{pending=null;cancelScheduledFlush=null;scheduleTimeout;onFlush;flushIntervalMs;boundFlush;constructor({scheduleTimeout:h,onFlush:T,flushIntervalMs:M}){this.scheduleTimeout=h,this.onFlush=T,this.flushIntervalMs=M,this.boundFlush=this.flush.bind(this)}apply(h){let T=h(this.pending);if(T===null){this.clear();return}if(this.pending=T,this.cancelScheduledFlush===null)this.cancelScheduledFlush=this.scheduleTimeout(this.boundFlush,this.flushIntervalMs)}clear(){this.pending=null,this.dispose(),this.onFlush(null)}peek(){return this.pending}flushNow(){if(this.cancelScheduledFlush!==null)this.dispose(),this.flush()}dispose(){if(this.cancelScheduledFlush!==null)this.cancelScheduledFlush(),this.cancelScheduledFlush=null}flush(){this.cancelScheduledFlush=null,this.onFlush(this.pending)}}
function clt({scheduleTimeout:h,onFlush:T,flushIntervalMs:M=100}){return new dlt({scheduleTimeout:h,onFlush:T,flushIntervalMs:M})}
export { clt,tLo,Vx };
