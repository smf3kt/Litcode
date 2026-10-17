// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
//   chunk-t58kj6z7.js sha256 bdf6e3dc738a7e907f629626301f1db57163ff23280792dd42efa125f4633283
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Tc, s, n } from './plugin-chain-react-hooks.js';
import { b3 } from './plugin-chain-source.js';
import { hf } from './plugin-chain-host-call-source.js';
import { xAt } from './plugin-chain-site-leaves-source.js';
import { IL } from './plugin-chain-raster-sites-source.js';
import { Nrt } from './plugin-chain-leaves-source.js';
import { Bt, De, Ut, $t } from './plugin-chain-hover-source.js';
import { Zt } from './plugin-chain-press-button-source.js';
import { Vt } from './plugin-chain-input-field-source.js';
import { sr } from './plugin-chain-select-field-source.js';
import { lt } from './plugin-chain-code-source.js';
import { Xt } from './plugin-chain-markdown-source.js';
import { Io } from './plugin-chain-client-host-source.js';
import { No } from './plugin-chain-image-component-source.js';
import { jo } from './plugin-chain-react-surface-source.js';
import { Wt } from './plugin-chain-walker-host.js';

// chunk-kjfwbh4w.js `je` — the site-tree walker: every node type to its component, hover groups, link text and the inline/block split [38173,40655) 2482 units sha256 edc470c7eb8abb49131571a27c93cb5c759229b05242c280556599fb17803686
function je(o,i,p=new Set){if(typeof o==="string")return Tc(n,null,o);if(o.type==="engine")return i(o.ref);if(o.type==="Button")return Tc(Zt,{plugin:o.press.plugin,handle:o.press.handle,element:o.props.key,label:o.props.label,hotkey:o.props.hotkey,action:o.props.action,plain:o.props.plain,dimColor:o.props.dimColor,variant:o.props.variant,role:o.props.role,hover:o.hover,held:(o.children??[]).map((h)=>typeof h==="string"?h:je(h,i))});if(o.type==="Input")return Tc(Vt,{plugin:o.press.plugin,handle:o.press.handle,element:o.props.key,label:o.props.label,placeholder:o.props.placeholder,value:o.props.value,submitLabel:o.props.submitLabel});if(o.type==="Select")return Tc(sr,{plugin:o.press.plugin,handle:o.press.handle,element:o.props.key,label:o.props.label,options:o.props.options,value:o.props.value});if(o.type==="Code")return Tc(lt,o.props);if(o.type==="Markdown")return Tc(Xt,{text:o.props.text,dimColor:o.props.dimColor,press:"press"in o?o.press:void 0,elementKey:o.props.key,pressableLinks:o.props.pressableLinks});if(o.type==="Client")return Tc(Io,{key:`client:${o.client.plugin}:${o.props.key}`,rebuild:(h)=>je(h,()=>null),plugin:o.client.plugin,module:o.props.module,elementKey:o.props.key,props:o.props.props,drawn:o.props,width:o.props.width,height:o.props.height,flexGrow:o.props.flexGrow});if(o.type==="Svg")return Tc(n,{dimColor:!0},o.props.alt);if(o.type==="Image")return Tc(No,{...o.props.key!==void 0&&{key:`image:${o.image.plugin}:${o.props.key}`},plugin:o.image.plugin,elementKey:o.props.key,source:o.props.source,columns:o.props.columns,rows:o.props.rows,alt:o.props.alt});if(o.type==="Raster")return Tc(jo,{key:`raster:${o.raster.plugin}:${o.props.key}`,plugin:o.raster.plugin,elementKey:o.props.key,columns:o.props.columns,rows:o.props.rows,cells:o.props.cells});let a=o.type==="Text"||o.type==="Link",m=new Set,f=(o.children??[]).map((h)=>a&&typeof h==="string"?h:je(h,i,m));if(o.type==="Link"){let{href:h,label:T}=o.props,S=Mrt(h),k=f.length>0?f:[T??S],v=f.length===0&&T===void 0?void 0:Tc(n,null,...k," ",Tc(n,{dimColor:!0},S));return Tc(Wt,{url:Nrt(h),fallback:v},...k)}let u=Bt(o.group?.plugin,o.hover);if(o.type==="Box"&&o.props?.key!==void 0){let{key:h,...T}=o.props,S=X4t(h,p)===void 0;return Tc($t,{key:S?String(h):void 0,isLive:S,elementKey:String(h),layout:T,hover:o.hover,group:u,children:f})}let d=o.type==="Box"?s:n,{hover:x}=o;return x===void 0?Tc(d,De(o.props),...f):Tc(Ut,{isInline:o.type==="Text",props:o.props,hover:x,group:u,children:f})}

// chunk-n3ykh62m.js `Mrt` — the display href encoder: unsafe characters percent-encoded, controls and bidi marks replaced [238267,238357) 90 units sha256 72ef53bc60c2168925b14722981df688fdbde0b0f8c00f580e313e0b5b832fd8
var Mrt=(e)=>e.replace(y$,(n)=>encodeURIComponent(hf(n))).replace(pot,encodeURIComponent);

// chunk-nyce03br.js `y$` — the control-character class the display encoder strips [112643,112741) 98 units sha256 308ff211f2b2e7120795e0207cb35acc001953a38b95f27b15b470fb4f9063fc
var y$=new RegExp(`[${String.raw`\t\n\r`}${b3.escape}${b3.loneSurrogate}${b3.placeholder}]`,"gu");

// chunk-t58kj6z7.js `zDe`/`zpr`/`pot` — the bidi-mark table and the regex the display encoder replaces [615,799) 184 units sha256 5389019d3898ce5c738ae6192518e5aee469ce218c020383483ef2eb58735078
var zDe=Object.freeze([[1564,1564],[8234,8238],[8294,8297]]),zpr=zDe.map(([e,n])=>`\\u{${e.toString(16)}}`+(n>e?`-\\u{${n.toString(16)}}`:"")).join(""),pot=new RegExp(`[${zpr}]`,"gu");

// chunk-n3ykh62m.js `X4t` — the Box-key scope check: a usable key names one hover scope per parent, reported once [233611,233808) 197 units sha256 d6a9308e728e872369acff726a40dd4e012cc0500dd9938fd752b958615301c5
function X4t(e,n){let r=xAt(e);if(r!==void 0||typeof e!=="string")return r;let s=n.has(e);return n.add(e),s?`Box "${IL(e)}" is drawn twice under one parent; only the first is a hover scope`:void 0}


export { je, Mrt, y$, zDe, zpr, pot, X4t };
