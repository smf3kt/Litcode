// @ts-nocheck
// Source copies and adapters: research/ports/W44-tui-renderer.md.
import { ae } from "./tui-render-host.js"; import { twe } from "./tui-ansi-tokenizer.js";
var nPe=8,yr=/(\t|\n)/,br=/[\x1b\x9b]/g,wr=/[\x90\x98\x9d-\x9f]/g,Er=/[\x1b\x90\x98\x9b\x9d-\x9f]/,Sr=/^\x1b[P\]X^_k]/,Rr=/^\x1b[P_].*\x07$|\x9c/s;
function mCo(e,n=nPe){let r=0,i="";return e.map((o,s)=>{if(!gGn(o)&&!o.includes("\t")){let d=o.lastIndexOf(`
`)+1;if(d>0)r=0,i="";return i+=d>0?o.slice(d):o,o}let u="";for(let d of ht(o,s===e.length-1)){let p=yt(d);if(p===void 0){u+=d.value,i+=d.value;continue}for(let h of p.split(yr))if(h==="\t"){r+=ae(i);let R=n-r%n;u+=" ".repeat(R),r+=R,i=""}else if(h===`
`)u+=h,r=0,i="";else u+=h,i+=h}return u})}function gGn(e){return Er.test(e)}function gCo(e){return e.some((n,r)=>gGn(n)&&ht(n,r===e.length-1).some((i)=>(yt(i)??i.value)!==i.value))}function ht(e,n){if(!gGn(e))return[{type:"text",value:e}];let r=twe(),i=r.feed(e),o=r.buffer();if(o!=="")i.push({type:n&&!Sr.test(o)?"sequence":"text",value:o});return i}function yt(e){if(e.type==="text"||e.value.includes(`
`)||Rr.test(e.value))return mt(e.value.replace(br,"\x18"));if(e.value.startsWith("\x1Bk"))return mt(e.value.replace(/\x9b/g,"\x18"));return}function mt(e){return e.replace(wr,"\uFFFD")}
export { nPe, gGn, gCo, mCo };
