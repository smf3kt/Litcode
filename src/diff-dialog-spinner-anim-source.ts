// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-1r9zp6s1.js sha256 444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e
//   chunk-06azbynj.js sha256 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd
//   chunk-k1caxvem.js sha256 0486ac30af93e1201282a5264304b0c84a83f55ba2f901a884fbff45fbe6f3a5
//   chunk-z9nv3z8k.js sha256 80a7eda1db7332eb0f201204442b37faab0dbd9fe0157f77f24a380f2208fed6
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Ae, R, Rt, le, en, qt } from './plugin-chain-react-hooks.js';
import { Zm } from './plugin-chain-input-field-source.js';
import { eE } from './plugin-chain-markdown-host.js';
import { a } from './diff-dialog-spinner-host.js';

// chunk-1r9zp6s1.js $e: whether a node's measured box is visible inside the terminal rows, subtracting ancestor scroll [22075,22541) 466 units sha256 f077bc9d4934d6971bf5f9a1f0d5ed8d53fadcdfc0348327c34fa5fd7f8aed7f
function $e(o,r){if(!o?.yogaNode||!r)return null;let l=o.yogaNode.getComputedHeight(),u=r.rows,c=o.yogaNode.getComputedTop(),{parentNode:p,yogaNode:m}=o;while(p){if(p.yogaNode)c+=p.yogaNode.getComputedTop(),m=p.yogaNode;if((p.style.overflowY??p.style.overflow)==="scroll"&&p.scrollTopRendered===void 0)return null;if(p.scrollTop)c-=vie(p);p=p.parentNode}let C=m.getComputedHeight(),v=c+l,h=C>u?1:0,S=Math.max(0,C-u)+h,x=S+u;if(l===0)return c>=S&&c<x;return v>S&&c<x}

// chunk-1r9zp6s1.js N4: the visibility hook — a ref callback, the visible flag, the initial measurement and the remeasure closure [22541,22970) 429 units sha256 34b1871a850fb91f8e8bebca8a4bdb8399a3bef455fe1c9010d27288c4b65bb5
function N4(){let o=Ae(Zm),r=R(null),l=R({isVisible:!0}),u=le((h)=>{if(r.current=h,h===null&&!l.current.isVisible)l.current={isVisible:!0}},[]);function c(){let h=$e(r.current,o);if(h===null)return l.current.isVisible;if(h!==l.current.isVisible)l.current={isVisible:h};return h}let p=R(c);p.current=c;let m=le(()=>p.current(),[]),C=R(o);C.current=o;let v=le(()=>$e(r.current,C.current),[]);return en(()=>{c()}),[u,l.current,m,v]}

// chunk-1r9zp6s1.js Io and LIe (the 480 ms repaint floor under the full-repaint flag) and ia, the animation clock: quantized frame time from the mounted clock, paused while hidden or without a clock [22970,23354) 384 units sha256 2c173c3833cba0f2aa32233c99178d46ae682e457081de728489f9cf570fae99
var Io=480;function LIe(o){return a.CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT?Math.max(o,Io):o}function ia(o=16){let r=Ae(eE),[l,{isVisible:u},c]=N4(),p=kie(),m=R(p),C=u;if(m.current!==p)m.current=p,C=c();let v=!!r&&C&&o!==null,h=o===null?null:Math.ceil(LIe(o)/eg)*eg,S=R(0),x=Rt(v?r.subscribeKeepAlive:Cje,()=>v?S.current=Math.max(S.current,Math.floor(r.now()/h)*h):S.current);return[l,x]}

// chunk-1r9zp6s1.js nt: read the accessibility context [19734,19763) 29 units sha256 f753910dab87f48e6e52949e203929e34a743233acf1fd38447f4add4a4ca61b
function nt(){return Ae(y4n)}

// chunk-06azbynj.js vie: clamp a node's scroll offset to its content height [174030,174177) 147 units sha256 01e87dfd3772a8cd0c11f154f66d704ef6073b38324b5c6c63629589ff5ab01e
function vie(n){let u=n.scrollTop??0;if(n.scrollHeight===void 0)return u;return Math.min(u,Math.max(0,n.scrollHeight-(n.scrollViewportHeight??0)))}

// chunk-k1caxvem.js the terminal focus context with its default value [876,975) 99 units sha256 a229da26646d6f8c341585636c3bd332a31f93f0b04e6d7e853b3f159eb8c3a1
var u=qt({isTerminalFocused:!0,terminalFocusState:"unknown"});u.displayName="TerminalFocusContext";

// chunk-k1caxvem.js d, Qc and kie: the context alias and its two readers [1257,1375) 118 units sha256 01f7648a1db5505007a683e5728f7d55119203c340ee61373fae543e0aeff1fe
var d=u;function Qc(){let{isTerminalFocused:c}=Ae(d);return c}function kie(){let{terminalFocusState:c}=Ae(d);return c}

// chunk-k1caxvem.js nI, Cje and T4n: the timeout helper and the no-op subscribe/read functions [1405,1497) 92 units sha256 3e98659749cfda985b18da83d1564f251055caef00b938934bc36a2864f87f33
var nI=(c,r)=>{let t=setTimeout(c,r);return()=>clearTimeout(t)},Cje=()=>()=>{},T4n=()=>null;

// chunk-z9nv3z8k.js eg and the timing constants; eg is the frame quantum [615,656) 41 units sha256 b15fa736085c3f2f3507fe48c935d2b2d977597573f985f524b57d4b6f96ad4d
var eg=16,z1o=50,V1o=4,q1o=16384,CFr=250;

// chunk-06azbynj.js Dy and y4n: the internal accessibility context [184065,184136) 71 units sha256 72a411cb59f0d3df6c7afed4bda151ffc8af3ccc5d4d197dfe47abdd04a57b9b
var Dy=qt(!1);Dy.displayName="InternalAccessibilityContext";var y4n=Dy;


export { $e, N4, Io, LIe, ia, vie, kie, nI, Cje, eg, u, d, Qc, y4n, Dy, nt };
