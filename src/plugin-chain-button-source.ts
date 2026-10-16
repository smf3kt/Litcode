// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { L } from './plugin-chain-source.js';
import { cN } from './plugin-chain-style-props-source.js';
import { QT } from './plugin-chain-ui-blit-source.js';
import { QAe } from './plugin-chain-raster-sites-source.js';
import { TAt, wVe } from './plugin-chain-site-leaves-source.js';
import { acs, dcs } from './plugin-chain-keys-source.js';

// chunk-n3ykh62m.js `Hto` — the Button site check: the props shape and the two keys, then the five option shapes in the order the source names them, then the autoFocus problem, then the hotkey, then the action — refused when the engine does not know it and again when the engine holds it alone — then the label, the press and the children [234038,235650) 1612 units sha256 05736f30502f30fe5997336510a03e5894039c8340710b066f10f583559b8634
function Hto(e){let{props:n,press:r}=e;if(!(L(n)&&typeof n.key==="string"&&n.key!==""&&typeof n.label==="string"&&QAe(n,["key","label","hotkey","action","plain","dimColor","variant","role","autoFocus"])))return'Button props must be { key, label }, both strings, hotkey a digit or a letter, action a keybinding action, dimColor a boolean, variant "primary" or "secondary", role "dismiss" and autoFocus true';let{key:h,label:y,hotkey:b,action:w,plain:R,dimColor:T,variant:P,role:M,autoFocus:z}=n;if(R!==void 0&&R!==!0)return`Button "${h}" plain is true or absent`;if(T!==void 0&&typeof T!=="boolean")return`Button "${h}" dimColor is a boolean or absent`;if(P!==void 0&&P!=="primary"&&P!=="secondary")return`Button "${h}" variant is "primary", "secondary" or absent`;if(M!==void 0&&M!=="dismiss")return`Button "${h}" role is "dismiss" or absent`;let V=TAt(z);if(V!==void 0)return`Button "${h}" ${V}`;if(b!==void 0&&(typeof b!=="string"||!/^[0-9a-z]$/.test(b)))return`Button "${h}" hotkey must be one digit 0-9 or one lowercase letter a-z`;if(w!==void 0&&(typeof w!=="string"||!dcs(w))){let de=typeof w==="string"?JSON.stringify(w):cN(w);return`Button "${h}" action ${de} is not one of the engine's keybinding actions (app:cycleDiffBase, app:diffFileListDown)`}if(typeof w==="string"&&acs(w))return`Button "${h}" action "${w}" is the engine's alone: its key cannot be rebound (ctrl+c, ctrl+d)`;if(QT(y))return`Button "${h}" label holds a control character`;let le=wVe(r);if(le!==void 0)return`Button "${h}" ${le}`;let{children:re}=e;return re===void 0||Array.isArray(re)?void 0:`Button "${h}" children is ${cN(re)}`}


export { Hto };
