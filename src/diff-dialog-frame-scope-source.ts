// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-apky5tj5.js sha256 8906093e5cfd33a801f05ec4d4410ac56b6ba5195131d9759e7103e23e8d6e6a
//   chunk-06azbynj.js sha256 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { qt, R, le, Ae, P, en, Z, y, Xe as e, useId as cZr } from './plugin-chain-react-hooks.js';
import { Lc } from './plugin-chain-press-button-source.js';
import { ld } from './tui-primitives.js';
import { stableKey as _ } from './diff-dialog-frame-host.js';

// chunk-apky5tj5.js bdn, the rendered-scope chain context, and ov, the focus scope that registers its binding entries, claims focus with an auto-focus fallback, and reports its chain downward [935,2776) 1841 units sha256 fc763f7263e84daf96867a6afb81c24a159f42659f70c4e8e1aa55aa3ae6a0cf
var bdn=qt(null);function ov({scope:n,bindings:l,active:r=!0,preemptive:s=!1,swallowAll:d=!1,claimFocus:a=!1,ref:m,flexGrow:B=0,flexDirection:M,flexShrink:O,children:S}){let b=R(null),g=Lc(),p=R([]);p.current=r?l:[];let A=le((o)=>F(o,p.current),[]),j=I(n,r,s,d,p.current),h=r&&s&&Boolean(n),v=h&&d;en(()=>{if(!g)return;let o=b.current;if(!o)return;let{decls:i,scopesChanged:c,preemptiveScopes:K,swallowAll:f}=g.keyHandlerRegistry,E={scope:n,active:r,preemptive:s,swallowAll:d,entriesRef:p};if(i.set(o,E),h&&n){if(w(K,n),v)w(f,n)}return c.emit(),()=>{if(i.delete(o),h&&n){if(D(K,n),v)D(f,n)}c.emit()}},[g,n,h,v,j]);let u=Ae(bdn),x=cZr(),[C]=y(()=>new Map),H=Z(()=>({chain:[...u?.chain??[],{scope:n,entriesRef:p}],below:[...u?.below??[],C]}),[u,n,C]);for(let o of u?.below??[])o.set(x,{chain:H.chain,claimFocus:a});P(()=>{let o=u?.below??[];for(let i of o)i.set(x,{chain:H.chain,claimFocus:a});return()=>{for(let i of o)i.delete(x)}},[u,x,H,a]),en(()=>{if(!a)return;let o=b.current;if(!o)return;let i=ix(o),c=!1,K=()=>{if(c)return;let f=b.current;if(!f)return;let E=i.activeElement;if(E&&IU(E,f))return;c=!0;try{i.focus(f)}finally{c=!1}};return i.pushAutoFocusFallback(o),K(),i.subscribe(K)},[a]);let k=R(!1);en(()=>{return},[n,a,g]);let L=le((o)=>{if(b.current=o,typeof m==="function")m(o);else if(m)m.current=o},[m]);return e(ld,{ref:L,keybindingScope:n,onAction:A,tabIndex:a?-1:void 0,flexGrow:B,flexDirection:M,flexShrink:O,children:e(bdn,{value:H,children:S})})}function F(n,l){for(let r of l){if(r.action!==n.action)continue;if(r.chordOnly&&!n.isChordCompletion)continue;if(r.run()===!1)continue;n.consume();return}}function w(n,l){n.set(l,(n.get(l)??0)+1)}function D(n,l){let r=(n.get(l)??0)-1;if(r<=0)n.delete(l);else n.set(l,r)}function I(n,l,r,s,d){return _([n??"",l,r,s,d.map((a)=>[a.action??"",a.hint??"",Boolean(a.chordOnly)])])}


// chunk-06azbynj.js IU: whether a node is inside another [135432,135508) 76 units sha256 557e05a28a7b74d92936b5371f07dba414dade542d136b5e15d10eb7f4667ac6
function IU(n,u){let f=n;while(f){if(f===u)return!0;f=f.parentNode}return!1}

// chunk-06azbynj.js eun/ix: walk to the node that carries the focus manager [135508,135682) 174 units sha256 726b6c6b4fc744da3bcca0e00cb1cb89d7285793b275c2cc3da14e4770e57ec4
function eun(n){let u=n;while(u){if(u.focusManager)return u;u=u.parentNode}throw Error("Node is not in a tree with a FocusManager")}function ix(n){return eun(n).focusManager}


export { bdn, ov, IU, eun, ix };
