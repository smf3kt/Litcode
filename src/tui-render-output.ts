// @ts-nocheck
// Source copies and adapters: research/ports/W44-tui-renderer.md.
import { BS, lMt, Zv, Pse, zCo, cMt, KUe, TZ, Vnt } from "./tui-render-host.js"; const d$t="\x1b[?2026h",a7e="\x1b[?2026l",JH="\x1b[?25l",XH="\x1b[?25h";
function KNo(){return Zv+lMt+BS}
function o7e(r){return BS+(Pse+zCo(1)).repeat(r)+BS}
function C4n(r,n,o){let u=performance.now(),i=r.slowestWrite;if(i===void 0||u-n>=i.endedMs-i.startedMs)r.slowestWrite={startedMs:n,endedMs:u,bytes:o}}function sun(r,n){if(r.stdoutDead)return;let o=performance.now(),u=Buffer.byteLength(n);try{r.stdout.write(n)}catch(i){if(r.tolerateDeadStdout&&(v(i)==="EIO"||v(i)==="EPIPE")){r.stdoutDead=!0,C4n(r,o,u);return}throw i}C4n(r,o,u)}function yLr(r,n,o=!1,u,i=""){let p=u!==void 0&&u>1?u-1:void 0;if(n.length===0){if(i!=="")sun(r,i);return}let s=!o,d=i+(s?d$t:"");for(let c of n)switch(c.type){case"stdout":d+=c.content;break;case"clear":if(c.count>0)d+=cMt(c.count);break;case"clearTerminal":d+=c.altScreen?KNo():o7e(c.viewportRows);break;case"cursorHide":d+=JH;break;case"cursorShow":d+=XH;break;case"cursorMove":d+=TZ(c.x,p!==void 0?Math.max(-p,Math.min(p,c.y)):c.y);break;case"cursorTo":d+=KUe(c.col);break;case"carriageReturn":d+="\r";break;case"hyperlink":d+=Vnt(c.uri);break;case"styleStr":d+=c.str;break}if(s)d+=a7e;sun(r,d)}function v(r){return r&&typeof r==="object"&&"code"in r?String(r.code):void 0}
export { yLr, sun };
