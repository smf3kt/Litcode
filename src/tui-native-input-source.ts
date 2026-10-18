// @ts-nocheck
// Exact source bodies, copied verbatim. Provenance: ./tui-native-input-source-blocks.json.
// Modules:
//   chunk-06azbynj.js sha256 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { wEe, Wr } from './tui-render-engine.js';
import { r7e } from './tui-render-host.js';
var vo=256;

// chunk-06azbynj.js S0 and click event [135682,136139) 457 units sha256 6ea2427c444e1ca9cadfabe7fc17e2665f2362b5f134bc233d37b64266dd99c2
var S0={shift:!1,alt:!1,ctrl:!1},vje=300,tun=500;class _4n extends r7e{col;row;localCol=0;localRow=0;cellIsBlank;hyperlinkUrl;isWindowActivation;mods;defaultAllowed=!1;allowDefault(){this.defaultAllowed=!0}droppedAsStray=!1;dropAsStray(){this.droppedAsStray=!0}endsClickChain=!1;endClickChain(){this.endsClickChain=!0}constructor(n,u,f,m,y=!1,g=S0){super();this.col=n,this.row=u,this.cellIsBlank=f,this.hyperlinkUrl=m,this.isWindowActivation=y,this.mods=g}}

// chunk-06azbynj.js jd wheel event [248708,248960) 252 units sha256 975b204d90ee94a9e10cdb4619dff1e8f898ac519a9e89be2de4c743e6961516
class jd extends wEe{deltaY;deltaX;ctrl;shift;meta;col;row;constructor(n,u){super("wheel",{bubbles:!0,cancelable:!0});this.deltaY=n,this.deltaX=u.deltaX??0,this.ctrl=u.ctrl??!1,this.shift=u.shift??!1,this.meta=u.meta??!1,this.col=u.col,this.row=u.row}}

// chunk-06azbynj.js cq native pointer hit test [249383,250176) 793 units sha256 6a6b3c59f3b367cda7f6b9b5a6a0605591a6b0637c1de932b1231bbcd48cc29b
function cq(n,u,f,m=0){if(m>=vo)return Wr("hitTest",n.nodeName),null;let y=n.cachedLayout;if(!y)return null;let g=u>=y.x&&u<y.x+y.width&&f>=y.y&&f<y.y+y.height;if(!g&&!n.hasAbsoluteDescendant)return null;if(!g){let _=n.style.overflowX??n.style.overflow,A=n.style.overflowY??n.style.overflow,H=(_==="hidden"||_==="scroll")&&(u<y.x||u>=y.x+y.width),L=(A==="hidden"||A==="scroll")&&(f<y.y||f>=y.y+y.height);if(H||L)return null}let C=null,M=!1;for(let _=n.childNodes.length-1;_>=0;_--){let A=n.childNodes[_];if(A.nodeName==="#text")continue;let H=A.cachedLayout;if(!H)continue;let L=u>=H.x&&u<H.x+H.width&&f>=H.y&&f<H.y+H.height;if(!L&&!A.hasAbsoluteDescendant)continue;if(C!==null&&L)continue;let U=cq(A,u,f,m+1);if(!U)continue;let P=!L;if(C===null||P&&!M)C=U,M=P;if(M)break}return C??(g?n:null)}

// chunk-06azbynj.js ov click dispatch and focus [250654,251135) 481 units sha256 f8367407e8a7e382854747cae6fcc379bb092a0b8519464a1a4bbd51e593aeb9
function ov(n,u){let{col:f,row:m}=u,y=cq(n,f,m)??void 0;if(!y)return!1;if(n.focusManager&&!u.isWindowActivation){let C=y;while(C){if(typeof C.attributes.tabIndex==="number"){n.focusManager.handleClickFocus(C);break}C=C.parentNode}}let g=!1;while(y){let C=y._eventHandlers?.onClick;if(C){let M=y.cachedLayout;if(M)u.localCol=f-M.x,u.localRow=m-M.y;if(u.defaultAllowed=!1,C(u),u.didStopImmediatePropagation())return!u.defaultAllowed;if(!u.defaultAllowed)g=!0}y=y.parentNode}return g}

// chunk-06azbynj.js wheel handler ancestor predicate [359028,359122) 94 units sha256 7795ddc1941e70a671282eea58a538eae8ebfbc0745b86c2059a03a4fd55332d
function $C(n){let u=n;while(u){if(u._eventHandlers?.onWheel)return!0;u=u.parentNode}return!1}


export { _4n, jd, cq, ov, $C };
