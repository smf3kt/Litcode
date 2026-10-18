// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-z6yhgx3x.js sha256 0e6e72389069c31fe2414918925cfdec798d015cc0be679381982b2d426d8fff
//   chunk-4bw62nzm.js sha256 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { qt, Ae, R, y, Rt, w } from "./plugin-chain-react-hooks.js";
import { Xe as e } from "./plugin-chain-react-hooks.js";

// chunk-z6yhgx3x.js session context/provider/hooks [817,2504) 1687 units sha256 f10a6df023a13bc7b93562319358e1ae55fd2fd0d45dbe08b93047d676f6a692
var l=qt(null),d=qt(null),P=qt(null),j=()=>()=>{};function $3n(i){let r=w(11),{session:o,children:c}=i,s;if(r[0]!==o)s=()=>({subscribe:o.subscribe,get:()=>So(o)}),r[0]=o,r[1]=s;else s=r[1];let[u]=y(s),t;if(r[2]!==c||r[3]!==u)t=e(P.Provider,{value:u,children:c}),r[2]=c,r[3]=u,r[4]=t;else t=r[4];let n;if(r[5]!==o.host||r[6]!==t)n=e(d.Provider,{value:o.host,children:t}),r[5]=o.host,r[6]=t,r[7]=n;else n=r[7];let p;if(r[8]!==o||r[9]!==n)p=e(l.Provider,{value:o,children:n}),r[8]=o,r[9]=n,r[10]=p;else p=r[10];return p}function U3n(i){let s=w(8),{host:o,project:c,children:r}=i,u;if(s[0]!==c)u=()=>({subscribe:j,get:()=>c}),s[0]=c,s[1]=u;else u=s[1];let[t]=y(u),n;if(s[2]!==r||s[3]!==t)n=e(P.Provider,{value:t,children:r}),s[2]=r,s[3]=t,s[4]=n;else n=s[4];let p;if(s[5]!==o||s[6]!==n)p=e(d.Provider,{value:o,children:n}),s[5]=o,s[6]=n,s[7]=p;else p=s[7];return p}function is(){let i=Ae(d);if(!i){throw ReferenceError("useHost cannot be called outside of a <SessionProvider /> or <HostProjectProvider />")}return i}function sv(i){let o=Ae(P);if(!o){throw ReferenceError("useProject cannot be called outside of a <SessionProvider /> or <HostProjectProvider />")}return v(o,o.subscribe,o.get,i)}function hC(){return Ae(l)??void 0}function $r(i){let c=w(2),o=Ae(l);if(!o){throw ReferenceError("useSession cannot be called outside of a <SessionProvider />")}let r;if(c[0]!==o)r=()=>o,c[0]=o,c[1]=r;else r=c[1];return v(o,o.subscribe,r,i)}function v(i,o,c,r){let s=R(null);if(s.current===null||s.current.owner!==i){let t={owner:i,read:c,selector:r,get:()=>{let n=t.read();return t.selector?t.selector(n):n}};s.current=t}s.current.read=c,s.current.selector=r;let u=s.current.get;return Rt(o,u,u)}

// chunk-4bw62nzm.js no project error [52959,53053) 94 units sha256 42066d9d15b37d9a482c3b2ddaba3ff5407ead8c341277c2389b8a6f3e09f0c2
class GP extends Error{name=an;constructor(){super("This session has no working directory.")}}

// chunk-4bw62nzm.js session project read [53128,53194) 66 units sha256 9efecb56f96aae72753854d975ec42f9b06c63cf5e5d4f05d1e8c71e85eef616
function So(e){let{project:t}=e;if(t===null)throw new GP;return t}

// chunk-4bw62nzm.js error name [52926,52959) 33 units sha256 e3dea4501c64137fefce9d210e455ea643a453fdb8fef291e4855580f0caa97f
var an="NoProjectDirectoryError";


export { l, d, P, j, $3n, U3n, is, sv, hC, $r, v, So };
