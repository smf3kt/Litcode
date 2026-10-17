// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-ejnyhzsc.js sha256 24697cf467fb57202c5ec305d52e767e0f6693a85e3b36ba1f0bb4dbc279e8d4
//   chunk-pxjy4t8j.js sha256 523505a6cb4614eda623cc9249eeab5a0e5f398f789ac555e5c997dc1d24eef7
//   chunk-t8vb436n.js sha256 9c9120f6c661ca18e4be547045c3415ab62054a1f3fdfd09127fd9c3ba3a5324
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { w, P, en, R, Ae, qt } from "./plugin-chain-react-hooks.js";
import { appStateContext as sx } from "./plugin-chain-app-state.js";
import { Lc } from "./plugin-chain-press-button.js";
import { invalidatePrevFrame as F, recordKeybindingFallback as vot } from "./plugin-chain-above-prompt-host.js";

// chunk-ejnyhzsc.js two host context tokens [668,697) 29 units sha256 3909e70430822bc12c426a833b26c9c2add70306f3c1858d8eb839602e2af759
var QY=qt(null),Mmt=qt(null);

// chunk-pxjy4t8j.js active overlay registration [1298,1856) 558 units sha256 d892e28d52fbc1c833a1a543db4e34d46f8c3b3cc90559f8e55ebc0a114922c0
function sa(e,t){let S=w(8),r=t===void 0?!0:t,n=Ae(sx)?.setState,O,b;if(S[0]!==r||S[1]!==e||S[2]!==n)O=()=>{if(!r||!n){return}return n((c)=>{if(c.activeOverlays.has(e)){return c}let y=new Set(c.activeOverlays);return y.add(e),{...c,activeOverlays:y}}),()=>{n((v)=>{if(!v.activeOverlays.has(e)){return v}let A=new Set(v.activeOverlays);return A.delete(e),{...v,activeOverlays:A}})}},b=[e,r,n],S[0]=r,S[1]=e,S[2]=n,S[3]=O,S[4]=b;else O=S[3],b=S[4];P(O,b);let h,m;if(S[5]!==r)h=()=>{if(!r){return}return F},m=[r],S[5]=r,S[6]=h,S[7]=m;else h=S[6],m=S[7];en(h,m)}

// chunk-t8vb436n.js keybinding display text [764,975) 211 units sha256 09b6b4fb2dec67d44a6d78aa7007003ac77cedd4613683a1bcdf7acc0e47f053
function us(n,e,t){let r=Lc(),i=r?.getDisplayText(n,e),o=i===void 0,s=r?"action_not_found":"no_context",u=R(!1);if(P(()=>{if(o&&!u.current)u.current=!0,vot(n,e,t,s)},[o,n,e,t,s]),o)return t;return i===null?"":i}


export { QY, sa, us };
