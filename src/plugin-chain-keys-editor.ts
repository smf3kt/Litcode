// The keybinding editor (W45-67) — the rest of the keybinding module. The copied bodies live in
// ./plugin-chain-keys-editor-source.ts; this module is the seam around them. W45-66 ported the tables a
// Button is measured against; what is left is the other half of the same module: the check a
// keybindings file is read through, and the two schemas that file and one runtime block are described
// by. With it the module's own concerns are all in the product.
//
// Source, chunk-6ccen3s8.js. The key parser:
//
//   function mJ(e){let r=e.split("+"),n={key:"",ctrl:!1,alt:!1,shift:!1,meta:!1,super:!1};for(let s of r){let c=s.toLowerCase();switch(c){case"ctrl":case"control":n.ctrl=!0;break;case"alt":case"opt":case"option":n.alt=!0;break;case"shift":n.shift=!0;break;case"meta":n.meta=!0;break;case"cmd":case"command":case"super":case"win":n.super=!0;break;case"esc":n.key="escape";break;case"return":n.key="enter";break;case"del":n.key="delete";break;case"space":n.key=" ";break;case"\u2191":n.key="up";break;case"\u2193":n.key="down";break;case"\u2190":n.key="left";break;case"\u2192":n.key="right";break;default:n.key=c;break}}return n}
//
// [8839,9463) 624 units. `mJ` is not the same normaliser W45-66 ported and it is not meant to be: `Ye`
// folds a key down to one canonical string for comparison, while `mJ` takes a key apart into the record
// a binding is stored as — `key` plus the five modifier flags — resolving the four short aliases and the
// four arrow glyphs as it goes. Both are in the module, and the editor reads the one that answers a
// shape rather than a name.
//
//   function h9(e){if(e===" ")return[mJ("space")];return e.trim().split(/\s+/).map(mJ)}
//
// [9463,9546) 83 units. `h9` — a chord taken apart into the keys it is made of. A chord is one key or
// several written with a space between them, and the space key is written as a word, so that one spelling
// is answered before the split: without it `" "` would trim to nothing and the chord would be empty.
//
// The names the configuration still accepts, and the contexts it may file them under:
//
//   var Z=["messageSelector:up","messageSelector:down","messageSelector:top","messageSelector:bottom","messageSelector:select","diff:viewDetails"],Re={"messageSelector:up":"select:previous","messageSelector:down":"select:next","messageSelector:top":"select:first","messageSelector:bottom":"select:last","messageSelector:select":"select:accept","diff:viewDetails":"select:accept"};
//
// [10621,10997) 376 units. `Z` is a list of six action names that no longer exist and `Re` the name each
// is read as — the two that matter are the message-selector keys, which became the select actions, and
// `diff:viewDetails`, which became `select:accept`. A keybindings file written before the rename still
// loads, and this pair is why.
//
//   function Q(e){return Z.some((r)=>r===e)}
//
// [10997,11037) 40 units. `Q` — is this one of those legacy names. It reads the list above rather than the
// map, so the check and the reader stay in step with each other.
//
//   var v9t=["Global","Chat","Autocomplete","Confirmation","Help","ProactivityMenu","Transcript","HistorySearch","Task","ThemePicker","Settings","Tabs","Attachments","Footer","AbovePrompt","AbovePromptInput","AbovePromptSelect","Pane","PaneField","MessageSelector","DiffDialog","DiffPanel","FeedbackSurvey","ModelPicker","EffortSlider","Select","Plugin","Scroll","Agents"],We=new Set(v9t);
//
// [11145,11530) 385 units. `v9t` is the 29 contexts a binding may be filed under, in the order the
// configuration presents them, and `We` the same list as a set. The list is not the one the defaults use:
// it holds `MessageSelector` and `DiffPanel`, which the defaults no longer bind, and it is the list the
// schemas and the check below are built from — which is why the two are separate tables in the source.
//
//   function lcs(e){return We.has(e)}
//
// [11530,11563) 33 units. `lcs` — is this string a context. It reads the set, so it is the check and the
// schema that stay in step with each other.
//
//   function F(e){return pe.has(e)||e.startsWith("command:")}
//
// [16567,16624) 57 units. `F` — the other thing an action field may hold. It is a superset of the
// Button's check one package over: a name the engine knows, or a `command:` binding, which runs the
// slash command as if it had been typed.
//
// The schema a keybindings file is described by, and the registry it is built through:
//
//   class i{resetters=[];built=[];lazy(e){let t,r=()=>{t=void 0};return this.resetters.push(r),()=>{if(t===void 0)t=e(),this.built.push(r);return t}}builtCount(){return this.built.length}releaseBuiltSince(e){for(let t of this.built.splice(e))t()}reset(){for(let e of this.resetters)e();this.built.length=0}}var RTr=new i;function p(e){return RTr.lazy(e)}
//
// [615,965) 350 units across three statements. `i` is a lazy registry — a builder filed per slot, a
// resetter per slot, and an accessor that builds once and remembers — `RTr` its one instance and `p` the
// way a builder is filed. Every schema below is written through `p`, so a schema is built when it is
// first asked for rather than when the module loads, which is what lets the file be large without being
// paid for on every start.
//
//   var ze=p(()=>u({context:U(v9t).describe("UI context where these bindings apply. Global bindings work everywhere."),bindings:ue(o().describe('Keystroke pattern (e.g., "ctrl+k", "shift+tab")'),Ue([U([...ZDe,...Z]),o().regex(/^command:[a-zA-Z0-9:\-_]+$/).describe('Command binding (e.g., "command:help", "command:compact"). Executes the slash command as if typed.'),Bm().describe("Set to null to unbind a default shortcut")]).describe("Action to trigger, command to invoke, or null to unbind")).describe("Map of keystroke patterns to actions")}).describe("A block of keybindings for a specific context")),Bn=p(()=>u({$schema:o().optional().describe("JSON Schema URL for editor validation"),$docs:o().optional().describe("Documentation URL"),bindings:A(ze()).describe("Array of keybinding blocks by context")}).describe("Claude Code keybindings configuration. Customize keyboard shortcuts by context."));
//
// [16624,17524) 900 units. `ze` is one block of keybindings: a context from the 29, and bindings as a
// record of key to action — where an action is a name the engine knows, one of the six legacy names, a
// `command:` pattern, or null to unbind a default. `Bn` is the document: an optional `$schema` and
// `$docs` for editor validation, and an array of those blocks.
//
//   function fe(){let e=O(),r=[...QDe,...Noo];if(e==="macos")r.push(...Foo);return r}
//
// [18783,18864) 81 units. `fe` — the reserved keys where this build runs. The table W45-66 ported is the
// base and the platform adds its own, so the answer is a list rather than a constant, and the platform is
// read on every call rather than captured. The additions are keyed on the source's own word for the
// platform, which is why the two lists differ from the base table the way the suite measures: the two
// non-macOS keys are always there and the seven `cmd` keys appear only under the source's macOS word.
//
//   var He=p(()=>u({context:o(),bindings:ue(o(),o().nullable())}));
//
// [19738,19801) 63 units. `He` — the schema for one block as the runtime reads it. It is *weaker* than
// the file's, and that is measured rather than assumed: its context is any string and its action any
// string or null, so a legacy name, a `command:` binding and a context that does not exist are all
// admitted. The values were checked once, when the file was read; this schema is what the shapes are
// held to afterwards.
//
//   function Ve(e){return He().safeParse(e).success}
//
//   function T(e){return Array.isArray(e)&&e.every(Ve)}
//
// [19801,19900) 99 units across two statements. `Ve` is one block held to that schema and `T` the whole
// document: an array whose every block passes. `T` asks the schema through `He()` on each call, so the
// runtime check and a caller that asks for the schema get the same built value out of the registry.
//
// The tables and the platform probe are imported rather than copied a second time: `ZDe`, `pe`, `QDe`,
// `Noo` and `Foo` from the keybinding copy W45-66 added, and `O` from the fs boundary W45-46 bound. The
// seven schema names come from ./plugin-chain-schema-aliases.ts, which binds the product's own zod to
// the names the source's bundled copy is reached by.
import type { KeyBindingBlock, KeyBindingInput, KeyBindingRecord } from './plugin-chain-registry-state.js';
import {
  Bn, F, fe, h9, He, i, lcs, mJ, p, Q, Re, RTr, T, v9t, Ve, We, Z, ze,
} from './plugin-chain-keys-editor-source.js';

/** The 29 contexts a binding may be filed under (`v9t`), the same list as a set (`We`), the six legacy
 *  action names the configuration still accepts (`Z`) and the name each is read as (`Re`). */
export const KEY_CONTEXTS = v9t;
export const KEY_CONTEXT_SET = We;
export const LEGACY_ACTION_NAMES = Z;
export const LEGACY_ACTION_READ_AS = Re;

/** Source `mJ`: a key taken apart into the record a binding is stored as — the key itself, the four
 *  arrow glyphs and the four short aliases resolved, and the five modifier flags. */
export function parseKeyBinding(key: string): KeyBindingRecord {
  return mJ(key);
}

/** Source `h9`: a chord taken apart into the keys it is made of. One key or several written with a space
 *  between them; the space key is written as a word and is answered before the split. */
export function splitChord(chord: string): KeyBindingRecord[] {
  return h9(chord);
}

/** Source `Q`: is this one of the six legacy action names the configuration still accepts. */
export function isLegacyAction(name: unknown): boolean {
  return Q(name);
}

/** Source `lcs`: is this string one of the 29 contexts a binding may be filed under. */
export function isKnownContext(name: unknown): boolean {
  return lcs(name);
}

/** Source `F`: is this an action the engine knows, or a `command:` binding — the two things an action
 *  field may hold once the file has been read. */
export function isActionOrCommand(name: unknown): boolean {
  return F(name);
}

/** Source `fe`: the keys that cannot be rebound where this build runs, the table plus the platform's own
 *  additions. Read once per call rather than captured, because that is what the source does. */
export function reservedKeysForPlatform(): KeyBindingRecord[] {
  return fe();
}

/** Source `ze`: the schema for one block of a keybindings file. Built through the lazy registry, so the
 *  first call is the one that builds it. */
export function keyBindingBlockSchema(): KeyBindingBlock {
  return ze();
}

/** Source `Bn`: the schema for a whole keybindings document. */
export function keyBindingsFileSchema(): KeyBindingInput {
  return Bn();
}

/** Source `He`: the schema for one block as the runtime reads it — weaker than the file's, holding the
 *  shapes only, because the values were checked once already when the file was read. */
export function runtimeKeyBindingBlockSchema(): KeyBindingBlock {
  return He();
}

/** Source `Ve`: does one block pass the runtime schema. */
export function blockPassesRuntimeSchema(block: unknown): boolean {
  return Ve(block);
}

/** Source `T`: is this an array of blocks that each pass it — the whole document's runtime check. */
export function documentPassesRuntimeSchema(value: unknown): boolean {
  return T(value);
}

/** The lazy registry the schemas are built through: `p` files a builder, `RTr` is the instance, and
 *  `i` is its class. A caller that wants to see how many schemas have been built reads `RTr.builtCount()`. */
export const SCHEMA_REGISTRY = RTr;
export const LAZY = p;
export const LAZY_REGISTRY_CLASS = i;

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  call with the source's own. */
export const SOURCE_BODIES = { Bn, F, fe, h9, He, i, lcs, mJ, p, Q, Re, RTr, T, v9t, Ve, We, Z, ze };

export { Bn, F, fe, h9, He, i, lcs, mJ, p, Q, Re, RTr, T, v9t, Ve, We, Z, ze };

export type { KeyBindingBlock, KeyBindingInput, KeyBindingRecord };
