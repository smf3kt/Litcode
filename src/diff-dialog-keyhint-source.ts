// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-6ccen3s8.js sha256 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d
//   chunk-z3f0m1q8.js sha256 f035b4067fe457f5a4584fe03292045e6d53134136827d2236d1e1540cc87d1f
//   chunk-nh8hd3rr.js sha256 5194b7a0a1b3c5beeae642f9b337330dabb12d436085c4aa52a1cf5ff81d1794
//   chunk-fz2251t0.js sha256 5b8789988815996ef934fa9d83ec0813f8ebec48dd7ec67d24d8c110fd8f5eff
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Xe as e, Xe as r, w, n, P, R, Children as xy, fragment as X, fragment as Zc, earlyReturn as bn, isValidElement as em } from './plugin-chain-react-surface.js';
import { Lc } from './plugin-chain-press-button.js';
import { recordKeybindingFallback as vot } from './plugin-chain-above-prompt-host.js';
import { z } from './diff-dialog-chrome-source.js';

// chunk-6ccen3s8.js je/de/E1: one key record to its display text, and a chord's records joined with spaces [9546,10191) 645 units sha256 120a0e9d87d21db4ceb2cb7c96cce9d294a1f09d49cda5173a2665d8488cd1d2
function je(e){let r=[];if(e.ctrl)r.push("ctrl");if(e.alt)r.push("alt");if(e.shift)r.push("shift");if(e.meta)r.push("meta");if(e.super)r.push("cmd");let n=de(e.key);return r.push(n),r.join("+")}function de(e){switch(e){case"escape":return"Esc";case" ":return"space";case"tab":return"tab";case"enter":return"Enter";case"backspace":return"Backspace";case"delete":return"Delete";case"up":return"\u2191";case"down":return"\u2193";case"left":return"\u2190";case"right":return"\u2192";case"pageup":return"PageUp";case"pagedown":return"PageDown";case"home":return"Home";case"end":return"End";default:return e}}function E1(e){return e.map(je).join(" ")}

// chunk-6ccen3s8.js A9t: the chord bound to an action in a context, null when shadowed by a later duplicate, undefined when unbound [35212,35388) 176 units sha256 809807cca51858ae8214af71dee205f68417fb466dea4209478a703bf2a28f56
function A9t(e,r,n){let s=!1,c;for(let y=0;y<n.length;y++){let b=n[y];if(!b||b.context!==r||b.action!==e)continue;if(s=!0,!Ke(n,y))c=b.chord}if(c)return c;return s?null:void 0}

// chunk-6ccen3s8.js Ke: whether a later binding repeats the same context and chord [35924,36074) 150 units sha256 c8dc215997d2a2687af81d14e12044356e8705ff66e4fe15df4c410028978d2d
function Ke(e,r){let n=e[r];if(!n)return!1;for(let s=r+1;s<e.length;s++){let c=e[s];if(c&&c.context===n.context&&V(c.chord,n.chord))return!0}return!1}

// chunk-6ccen3s8.js V: chord equality over the key-record array [36598,36731) 133 units sha256 67bed0cfc090b3ab810430735c182e5f6920c9dcf90905ae89bd6656c644dd03
function V(e,r){if(e.length!==r.length)return!1;for(let n=0;n<e.length;n++){let s=e[n],c=r[n];if(!s||!c||!eLe(s,c))return!1}return!0}

// chunk-6ccen3s8.js eLe: one key record equality (alt and meta alias each other) [37204,37333) 129 units sha256 944d82bf0833dc8aeaffcbfbed1e14f0026cfb8ff87e25d3cad9818d2a4391b2
function eLe(e,r){return e.key===r.key&&e.ctrl===r.ctrl&&e.shift===r.shift&&(e.alt||e.meta)===(r.alt||r.meta)&&e.super===r.super}

// chunk-z3f0m1q8.js ma: the display text for an action's chord, the fallback text, and the one-shot fallback event [771,1001) 230 units sha256 65e8a5b92dfde3f66f350438616d2807a313ee23b7a01894fcbf21abe8ecfd4b
function ma(e,i,t){let o=Lc(),n=o?A9t(e,i,o.bindings):void 0,r=n===void 0,f=o?"action_not_found":"no_context",d=R(!1);if(P(()=>{if(r&&!d.current)d.current=!0,vot(e,i,t,f)},[r,e,i,t,f]),n===void 0)return t;return n===null?"":E1(n)}

// chunk-nh8hd3rr.js pt: the key hint component, chord from ma through the z chord hint [800,1044) 244 units sha256 7e8002191e844d33872730a10c8c41d6369c23e4dea83108627a035b18f5844d
function pt(y){let x=w(5),{action:f,context:g,fallback:m,description:o,parens:n,bold:t}=y,i=ma(f,g,m),a;if(x[0]!==t||x[1]!==i||x[2]!==o||x[3]!==n)a=e(z,{chord:i,action:o,parens:n,bold:t}),x[0]=t,x[1]=i,x[2]=o,x[3]=n,x[4]=a;else a=x[4];return a}

// chunk-fz2251t0.js y/C/Se: the hint strip, children joined with a dim middle dot [867,1269) 402 units sha256 fc99a790bc1a8c7a5789e818aaa379ed0092f211606af327d8745275b8d3f582
function y(s){return s!==""}function C(o,a){return r(Zc,{children:[a>0&&e(n,{dimColor:!0,children:" \xB7 "}),o]},em(o)?o.key??a:a)}function Se(g){let m=w(5),{children:l}=g,i,c;if(m[0]!==l){c=bn;q:{let R=xy.toArray(l).filter(y);if(R.length===0){c=null;break q}i=R.map(C)}m[0]=l,m[1]=i,m[2]=c}else i=m[1],c=m[2];if(c!==bn)return c;let f;if(m[3]!==i)f=e(X,{children:i}),m[3]=i,m[4]=f;else f=m[4];return f}


export { je, de, E1, A9t, Ke, V, eLe, ma, pt, Se };
