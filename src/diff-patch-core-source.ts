// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-34bv7wfw.js sha256 3c54cf84149d490f331f6c45a0d54ac7f471c7962b5a359f2a6880189b94f27d
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.

// chunk-34bv7wfw.js L: Myers line-diff engine with component accumulation, comparator, timeout and callback scheduling [615,3451) 2836 units sha256 1359f72ef9722462547cb603f50e026f949e208b74ff526b92367c128eb06f35
class L{diff(n,e,t={}){let i;if(typeof t==="function")i=t,t={};else if("callback"in t)i=t.callback;let l=this.castInput(n,t),r=this.castInput(e,t),s=this.removeEmpty(this.tokenize(l,t)),o=this.removeEmpty(this.tokenize(r,t));return this.diffWithOptionsObj(s,o,t,i)}diffWithOptionsObj(n,e,t,i){var l;let r=(d)=>{if(d=this.postProcess(d,t),i){setTimeout(function(){i(d)},0);return}else return d},s=e.length,o=n.length,f=1,u=s+o;if(t.maxEditLength!=null)u=Math.min(u,t.maxEditLength);let h=(l=t.timeout)!==null&&l!==void 0?l:1/0,c=Date.now()+h,a=[{oldPos:-1,lastComponent:void 0}],g=this.extractCommon(a[0],e,n,0,t);if(a[0].oldPos+1>=o&&g+1>=s)return r(this.buildValues(a[0].lastComponent,e,n));let w=-1/0,P=1/0,C=()=>{for(let d=Math.max(w,-f);d<=Math.min(P,f);d+=2){let p,m=a[d-1],x=a[d+1];if(m)a[d-1]=void 0;let v=!1;if(x){let D=x.oldPos-d;v=x&&0<=D&&D<s}let S=m&&m.oldPos+1<o;if(!v&&!S){a[d]=void 0;continue}if(!S||v&&m.oldPos<x.oldPos)p=this.addToPath(x,!0,!1,0,t);else p=this.addToPath(m,!1,!0,1,t);if(g=this.extractCommon(p,e,n,d,t),p.oldPos+1>=o&&g+1>=s)return r(this.buildValues(p.lastComponent,e,n))||!0;else{if(a[d]=p,p.oldPos+1>=o)P=Math.min(P,d-1);if(g+1>=s)w=Math.max(w,d+1)}}f++};if(i)(function d(){setTimeout(function(){if(f>u||Date.now()>c)return i(void 0);if(!C())d()},0)})();else while(f<=u&&Date.now()<=c){let d=C();if(d)return d}}addToPath(n,e,t,i,l){let r=n.lastComponent;if(r&&!l.oneChangePerToken&&r.added===e&&r.removed===t)return{oldPos:n.oldPos+i,lastComponent:{count:r.count+1,added:e,removed:t,previousComponent:r.previousComponent}};else return{oldPos:n.oldPos+i,lastComponent:{count:1,added:e,removed:t,previousComponent:r}}}extractCommon(n,e,t,i,l){let r=e.length,s=t.length,o=n.oldPos,f=o-i,u=0;while(f+1<r&&o+1<s&&this.equals(t[o+1],e[f+1],l))if(f++,o++,u++,l.oneChangePerToken)n.lastComponent={count:1,previousComponent:n.lastComponent,added:!1,removed:!1};if(u&&!l.oneChangePerToken)n.lastComponent={count:u,previousComponent:n.lastComponent,added:!1,removed:!1};return n.oldPos=o,f}equals(n,e,t){if(t.comparator)return t.comparator(n,e);else return n===e||!!t.ignoreCase&&n.toLowerCase()===e.toLowerCase()}removeEmpty(n){let e=[];for(let t=0;t<n.length;t++)if(n[t])e.push(n[t]);return e}castInput(n,e){return n}tokenize(n,e){return Array.from(n)}join(n){return n.join("")}postProcess(n,e){return n}get useLongestToken(){return!1}buildValues(n,e,t){let i=[],l;while(n)i.push(n),l=n.previousComponent,delete n.previousComponent,n=l;i.reverse();let r=i.length,s=0,o=0,f=0;for(;s<r;s++){let u=i[s];if(!u.removed){if(!u.added&&this.useLongestToken){let h=e.slice(o,o+u.count);h=h.map(function(c,a){let g=t[f+a];return g.length>c.length?g:c}),u.value=this.join(h)}else u.value=this.join(e.slice(o,o+u.count));if(o+=u.count,!u.added)f+=u.count}else u.value=this.join(t.slice(f,f+u.count)),f+=u.count}return i}}

// chunk-34bv7wfw.js V: newline tokenizer with stripTrailingCr [3856,4082) 226 units sha256 8e3e65465ee3715fa14ce95fec95e12dccdeee2ea6e6e1b95232bbcf47f38aea
function V(n,e){if(e.stripTrailingCr)n=n.replace(/\r\n/g,`
`);let t=[],i=n.split(/(\n|\r\n)/);if(!i[i.length-1])i.pop();for(let l=0;l<i.length;l++){let r=i[l];if(l%2&&!e.newlineIsToken)t[t.length-1]+=r;else t.push(r)}return t}

// chunk-34bv7wfw.js N: diff class binding the tokenizer and the whitespace/EOF normalizers [3451,3803) 352 units sha256 097ded34b871fe0ac9b4cfc61e5ee569fbe2404f8cac9ef0a4bbca6e25fa5d3d
class N extends L{constructor(){super(...arguments);this.tokenize=V}equals(n,e,t){if(t.ignoreWhitespace){if(!t.newlineIsToken||!n.includes(`
`))n=n.trim();if(!t.newlineIsToken||!e.includes(`
`))e=e.trim()}else if(t.ignoreNewlineAtEof&&!t.newlineIsToken){if(n.endsWith(`
`))n=n.slice(0,-1);if(e.endsWith(`
`))e=e.slice(0,-1)}return super.equals(n,e,t)}}

// chunk-34bv7wfw.js R: the shared diff instance (`var R=new N;`) [3803,3815) 12 units sha256 f7c604635d648c06af3fbe2f0a9a95b4d482f391fe52635ca9f6996e55c6cfdb
var R=new N;

// chunk-34bv7wfw.js _qe: the diff entry point [3815,3856) 41 units sha256 3187c52d31004ec300f56135e734d638cf74b519cb4e425f0f7c60fd73218df5
function _qe(n,e,t){return R.diff(n,e,t)}

// chunk-34bv7wfw.js Y: a value split into newline-terminated lines [5395,5517) 122 units sha256 4cdb91800b58379735bf1c2eab162b9ec2f6ae36fda91070bb7314dbf65b11bb
function Y(n){let e=n.endsWith(`
`),t=n.split(`
`).map((i)=>i+`
`);if(e)t.pop();else t.push(t.pop().slice(0,-1));return t}

// chunk-34bv7wfw.js t6: hunk builder with explicit no-newline markers [4082,5395) 1313 units sha256 a4b9dc30acc2d3a925bef3d6089f760fb4dd58c2df97e8bac5485d01ee0315ad
function t6(n,e,t,i,l,r,s){let o;if(!s)o={};else if(typeof s==="function")o={callback:s};else o=s;if(typeof o.context>"u")o.context=4;let f=o.context;if(o.newlineIsToken)throw Error("newlineIsToken may not be used with patch-generation functions, only with diffing functions");if(!o.callback)return u(_qe(t,i,o));else{let{callback:h}=o;_qe(t,i,Object.assign(Object.assign({},o),{callback:(c)=>{let a=u(c);h(a)}}))}function u(h){if(!h)return;h.push({value:"",lines:[]});function c(p){return p.map(function(m){return" "+m})}let a=[],g=0,w=0,P=[],C=1,d=1;for(let p=0;p<h.length;p++){let m=h[p],x=m.lines||Y(m.value);if(m.lines=x,m.added||m.removed){if(!g){let v=h[p-1];if(g=C,w=d,v)P=f>0?c(v.lines.slice(-f)):[],g-=P.length,w-=P.length}for(let v of x)P.push((m.added?"+":"-")+v);if(m.added)d+=x.length;else C+=x.length}else{if(g)if(x.length<=f*2&&p<h.length-2)for(let v of c(x))P.push(v);else{let v=Math.min(x.length,f);for(let D of c(x.slice(0,v)))P.push(D);let S={oldStart:g,oldLines:C-g+v,newStart:w,newLines:d-w+v,lines:P};a.push(S),g=0,w=0,P=[]}C+=x.length,d+=x.length}}for(let p of a)for(let m=0;m<p.lines.length;m++)if(p.lines[m].endsWith(`
`))p.lines[m]=p.lines[m].slice(0,-1);else p.lines.splice(m+1,0,"\\ No newline at end of file"),m++;return{oldFileName:n,newFileName:e,oldHeader:l,newHeader:r,hunks:a}}}


export { L, V, N, R, _qe, Y, t6 };
