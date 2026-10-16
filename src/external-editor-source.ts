// @ts-nocheck
// Source bodies and await-only adaptations: research/ports/W44-external-editor-copies.json.
export function initializeExternalEditor({a,MN,h,oi,ie,I,lPe,A8e,sce,HF,tJ,Ub}) {
const zRr=()=>({}),k=()=>"";
function v(n){return!!MN(n)}
var L=new Set(["start","cmd","cmd.exe"]);
function x(n){let e=n.trim().split(/\s+/);for(let r of e){if(/^\/[^/]+$/.test(r))continue;if(r.startsWith("-"))continue;let o=h(r);if(L.has(o.toLowerCase()))continue;return o}return h(e[0]??n)}
var T=["code","cursor","windsurf","codium","subl","atom","gedit","notepad++","notepad"];
var b=/\b(vi|vim|nvim|nano|emacs|pico|micro|helix|hx)\b/;
var D=new Set(["code","cursor","windsurf","codium"]);
function E(n){let e=x(n);return T.find((r)=>e.includes(r))}
function A(n,e,r){if(!r)return[e];if(D.has(n))return["-g",`${e}:${r}`];if(n==="subl")return[`${e}:${r}`];return[e]}
function R(n,e,r){let o=E(n);if(o)return A(o,e,r);return r&&b.test(h(Qe(n," ")))?[`+${r}`,e]:[e]}
class C{isResolved=!1;editor=void 0;resolve(){if(this.isResolved)return this.editor;if(a.VISUAL)this.editor=a.VISUAL;else if(a.EDITOR)this.editor=a.EDITOR;else{let n=["code","vi","nano"];this.editor=n.find((e)=>v(e))}return this.isResolved=!0,this.editor}reset(){this.isResolved=!1,this.editor=void 0}}
var N={code:"code -w",subl:"subl --wait"};
function U(n,e,r){let o=n;for(let[c,d]of Object.entries(r))if(d.type==="text"){let g=parseInt(c),u=d.content;if(d.unavailable||u==="")continue;if(d.inline)continue;let m=o.indexOf(u);if(m!==-1){let p=HF(u),l=tJ(g,p);o=o.slice(0,m)+l+o.slice(m+u.length)}}return o}
var S="# \u2500\u2500\u2500 Write your reply below this line \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500";
function W(n){let e=n.indexOf(S);if(e===-1)return n;return n.slice(e+S.length).replace(/^\r?\n\r?\n?/,"")}
function Qe(t,n){let e=t.indexOf(n);return e===-1?t:t.slice(0,e)}
function Lt(t,n,e=0){let r=0,i=t.indexOf(n,e);while(i!==-1)r++,i=t.indexOf(n,i+1);return r}
const resolver=new C;const hx=()=>resolver.resolve();
async function Zie(n,e){let r=ie(),o=oi().get(process.stdout);if(!o)throw Error("Ink instance not found - cannot pause rendering");let c=hx();if(!c)return{content:null};try{r.statSync(n)}catch{return{content:null}}let d=E(c)===void 0;if(d)o.enterAlternateScreen();else o.prepareTerminalForHandoff();try{let g=N[c]??c,u=g.split(" "),m=u[0]??g,p=u.slice(1),l=R(c,n,e),i;{let f=zRr();if(i=await I(m,[...p,...l],{stdio:"inherit",...f}),i.error&&f.cgroup!==void 0)i=await I(m,[...p,...l],{stdio:"inherit"})}if(i.error||i.signal||i.status!==null&&i.status!==0){let f=Ub(c);return{content:null,error:i.error?`Couldn't open ${f} \u2014 ${i.error.message}`:i.signal?`${f} closed unexpectedly (${i.signal})`:`${f} quit unexpectedly (exit code ${i.status})`}}return{content:r.readFileSync(n,{encoding:"utf-8"})}}catch{return{content:null}}finally{if(d)o.exitAlternateScreen();else o.restoreTerminalAfterHandoff()}}
async function $j(n,e,r,o){let c=ie(),d=lPe();try{let g=e?sce(n,e):n,u=r?k(r):"",m=u+g,p=n.slice(0,o),l=o===void 0?void 0:1+Lt(u,`
`)+Lt(e?sce(p,e):p,`
`);A8e(d,m,{encoding:"utf-8",flush:!0});let i=await Zie(d,l);if(i.content===null)return i;let s=i.content;if(r)s=W(s);let f=s.endsWith(`\r
`)?`\r
`:`
`;if(s.endsWith(f)&&!s.endsWith(f+f))s=s.slice(0,-f.length);if(e)s=U(s,n,e);return{content:s}}finally{try{c.unlinkSync(d)}catch{}}}
return {edit:$j,resolve:hx,editorName:x,args:R,refold:U};
}
