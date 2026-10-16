// The Button (W45-66). The copied body lives in ./plugin-chain-button-source.ts; this module is the
// seam around it. The Button is the last of the nine site leaves, and the one whose checks are the most
// varied: a props shape with a picker, five option shapes named one at a time, an autoFocus problem, a
// hotkey that must be one digit or one lowercase letter, an action checked twice — known to the engine
// and not held by it alone — a label with the control-character rule every drawn string has, the press
// predicate three leaves share, and children.
//
// Source, chunk-n3ykh62m.js:
//
//   function Hto(e){let{props:n,press:r}=e;if(!(L(n)&&typeof n.key==="string"&&n.key!==""&&typeof n.label==="string"&&QAe(n,["key","label","hotkey","action","plain","dimColor","variant","role","autoFocus"])))return'Button props must be { key, label }, both strings, hotkey a digit or a letter, action a keybinding action, dimColor a boolean, variant "primary" or "secondary", role "dismiss" and autoFocus true';let{key:h,label:y,hotkey:b,action:w,plain:R,dimColor:T,variant:P,role:M,autoFocus:z}=n;if(R!==void 0&&R!==!0)return`Button "${h}" plain is true or absent`;if(T!==void 0&&typeof T!=="boolean")return`Button "${h}" dimColor is a boolean or absent`;if(P!==void 0&&P!=="primary"&&P!=="secondary")return`Button "${h}" variant is "primary", "secondary" or absent`;if(M!==void 0&&M!=="dismiss")return`Button "${h}" role is "dismiss" or absent`;let V=TAt(z);if(V!==void 0)return`Button "${h}" ${V}`;if(b!==void 0&&(typeof b!=="string"||!/^[0-9a-z]$/.test(b)))return`Button "${h}" hotkey must be one digit 0-9 or one lowercase letter a-z`;if(w!==void 0&&(typeof w!=="string"||!dcs(w))){let de=typeof w==="string"?JSON.stringify(w):cN(w);return`Button "${h}" action ${de} is not one of the engine's keybinding actions (app:cycleDiffBase, app:diffFileListDown)`}if(typeof w==="string"&&acs(w))return`Button "${h}" action "${w}" is the engine's alone: its key cannot be rebound (ctrl+c, ctrl+d)`;if(QT(y))return`Button "${h}" label holds a control character`;let le=wVe(r);if(le!==void 0)return`Button "${h}" ${le}`;let{children:re}=e;return re===void 0||Array.isArray(re)?void 0:`Button "${h}" children is ${cN(re)}`}
//
// [234038,235650) 1,612 units. Read in the order the source runs it, because that order is the answer a
// caller sees: the props shape first (both keys non-empty strings, the other five fields at their own
// shapes, through the raster leaf's props picker), then `plain`, `dimColor`, `variant` and `role` in the
// order they are destructured, then the autoFocus problem the site-leaf copy owns, then the hotkey, then
// the action. The action is checked twice and the two refusals differ: an action the engine does not
// know is quoted back with the serializer (`JSON.stringify` for a string, the value-describer otherwise)
// and named as "not one of the engine's keybinding actions"; an action the engine does know but holds
// alone — `app:interrupt`, `app:exit` — is refused with its own name and the reason it cannot be
// rebound. Then the label, then the press, then children, and children are the one field that is merely
// shaped rather than refused outright: an array is admitted.
//
// Its dependencies are all carried: the non-blank-string predicate `L` from the chain runner, the props
// picker `QAe` from the raster leaf-problem copy, the autoFocus problem `TAt` and the press predicate
// `wVe` from the site-leaf copy, the value describer `cN` from the style-prop copy, the control-character
// test `QT` from the blit copy, and `dcs`/`acs` from the keybinding copy W45-66 also adds. Nothing here
// reaches a host.
import type { ButtonLeafInput, LeafProblem } from './plugin-chain-registry-state.js';
import { Hto } from './plugin-chain-button-source.js';

/** Source `Hto`: the sentence a Button site is refused with, or nothing when it is admitted. */
export function buttonLeafProblem(input: ButtonLeafInput): string | undefined {
  return Hto(input as Parameters<typeof Hto>[0]) as string | undefined;
}

/** The copied body under its source name, for a record or a test that wants to compare the ported call
 *  with the source's own. */
export const SOURCE_BODIES = { Hto };

export { Hto };

export type { ButtonLeafInput, LeafProblem };
