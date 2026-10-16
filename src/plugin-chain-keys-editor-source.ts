// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-fdwn5gdv.js sha256 bdd8f0094eb4fcd0daa8d9fa47261b47d4a0384894c1701f74ba72b338a9be11
//   chunk-6ccen3s8.js sha256 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { O } from './plugin-chain-fs-boundaries.js';
import { Foo, Noo, pe, QDe, ZDe } from './plugin-chain-keys-source.js';
import { A, Bm, o, u, U, ue, Ue } from './plugin-chain-schema-aliases.js';

// chunk-fdwn5gdv.js `i` — the lazy registry the schemas are built through: a slot per builder, a resetter for each, and the accessor that builds a value once and remembers it [615,918) 303 units sha256 ac8fa5a2a589fa1dd648bd6ea9451f06fb378142827f2b065f3628d8134987d9
class i{resetters=[];built=[];lazy(e){let t,r=()=>{t=void 0};return this.resetters.push(r),()=>{if(t===void 0)t=e(),this.built.push(r);return t}}builtCount(){return this.built.length}releaseBuiltSince(e){for(let t of this.built.splice(e))t()}reset(){for(let e of this.resetters)e();this.built.length=0}}

// chunk-fdwn5gdv.js `RTr` — the one instance of that registry [918,932) 14 units sha256 0a28dbd728ca368cc6a870a3fde72412a2e37f5353d16d4e76f5511d4b2209fa
var RTr=new i;

// chunk-fdwn5gdv.js `p` — the accessor a builder is filed through, which is how every schema in this module is written [932,965) 33 units sha256 5de6b725ba1fafa447bb2e9f1fc3158cd965b402c6adaff44a824d751a5238d5
function p(e){return RTr.lazy(e)}

// chunk-6ccen3s8.js `mJ` — the key parser: split on `+`, fold each part to a modifier flag, resolve the four aliases and the four arrow glyphs, and answer the key with its modifier record [8839,9463) 624 units sha256 2877b92cbcf0d8f114f3a532fbd2d25ab15ee11ab44d0db85947929fa4a2dfd7
function mJ(e){let r=e.split("+"),n={key:"",ctrl:!1,alt:!1,shift:!1,meta:!1,super:!1};for(let s of r){let c=s.toLowerCase();switch(c){case"ctrl":case"control":n.ctrl=!0;break;case"alt":case"opt":case"option":n.alt=!0;break;case"shift":n.shift=!0;break;case"meta":n.meta=!0;break;case"cmd":case"command":case"super":case"win":n.super=!0;break;case"esc":n.key="escape";break;case"return":n.key="enter";break;case"del":n.key="delete";break;case"space":n.key=" ";break;case"\u2191":n.key="up";break;case"\u2193":n.key="down";break;case"\u2190":n.key="left";break;case"\u2192":n.key="right";break;default:n.key=c;break}}return n}

// chunk-6ccen3s8.js `h9` — a chord split into the keys it is made of: the space key on its own, and anything else trimmed and split on whitespace before each part is parsed [9463,9546) 83 units sha256 699db986d2ac9e5a5c0734872c5b573d9bb309e26170a1a3442702330edba4f7
function h9(e){if(e===" ")return[mJ("space")];return e.trim().split(/\s+/).map(mJ)}

// chunk-6ccen3s8.js `Z` and `Re` — the six legacy action names the configuration still accepts and the name each one is read as [10621,10997) 376 units sha256 baf701703983b96f8561baad3ead5b8c98fe1daa9f020f5bea3da7acb3751a43
var Z=["messageSelector:up","messageSelector:down","messageSelector:top","messageSelector:bottom","messageSelector:select","diff:viewDetails"],Re={"messageSelector:up":"select:previous","messageSelector:down":"select:next","messageSelector:top":"select:first","messageSelector:bottom":"select:last","messageSelector:select":"select:accept","diff:viewDetails":"select:accept"};

// chunk-6ccen3s8.js `Q` — is this one of those legacy names [10997,11037) 40 units sha256 992de1bb1f6089200d269b9af6c335e2a58876f024e8cc499f756b0af3389977
function Q(e){return Z.some((r)=>r===e)}

// chunk-6ccen3s8.js `v9t` — the 29 binding contexts a keybindings file may name in a stable order — and `We`, the same list as a set [11145,11530) 385 units sha256 bfce3ce8e72ac5777cb13fe3504b1b2f8479afe3e85419b5eff8fdfe9f0c8355
var v9t=["Global","Chat","Autocomplete","Confirmation","Help","ProactivityMenu","Transcript","HistorySearch","Task","ThemePicker","Settings","Tabs","Attachments","Footer","AbovePrompt","AbovePromptInput","AbovePromptSelect","Pane","PaneField","MessageSelector","DiffDialog","DiffPanel","FeedbackSurvey","ModelPicker","EffortSlider","Select","Plugin","Scroll","Agents"],We=new Set(v9t);

// chunk-6ccen3s8.js `lcs` — is this string one of those contexts [11530,11563) 33 units sha256 7695e2bfa5815fb2790f69d0fb098fd71e04fde3a65dcf5d212e501a8ff0783a
function lcs(e){return We.has(e)}

// chunk-6ccen3s8.js `F` — is this an action the engine knows, or a `command:` binding, which is the other thing an action field may hold [16567,16624) 57 units sha256 a20469eaf3d4e6e164ef1ea1d51f551edf8c2cc39d784a94a600608316f19fa5
function F(e){return pe.has(e)||e.startsWith("command:")}

// chunk-6ccen3s8.js `ze` and `Bn` — the schema a keybindings file is described by: a block of `context` and `bindings`, each binding an action name, a legacy name, a `command:` pattern or null to unbind, and the document that is an array of them under `$schema` and `$docs` [16624,17524) 900 units sha256 913bda53b40a768f205aef21429b95385a01e88eff995b97dedd5c4c116319be
var ze=p(()=>u({context:U(v9t).describe("UI context where these bindings apply. Global bindings work everywhere."),bindings:ue(o().describe('Keystroke pattern (e.g., "ctrl+k", "shift+tab")'),Ue([U([...ZDe,...Z]),o().regex(/^command:[a-zA-Z0-9:\-_]+$/).describe('Command binding (e.g., "command:help", "command:compact"). Executes the slash command as if typed.'),Bm().describe("Set to null to unbind a default shortcut")]).describe("Action to trigger, command to invoke, or null to unbind")).describe("Map of keystroke patterns to actions")}).describe("A block of keybindings for a specific context")),Bn=p(()=>u({$schema:o().optional().describe("JSON Schema URL for editor validation"),$docs:o().optional().describe("Documentation URL"),bindings:A(ze()).describe("Array of keybinding blocks by context")}).describe("Claude Code keybindings configuration. Customize keyboard shortcuts by context."));

// chunk-6ccen3s8.js `fe` — the reserved keys for the platform this build runs on: the table plus the platform's own additions [18783,18864) 81 units sha256 166a9d5d2e5b89e50f842a22ef2e1fae23aa0d206f005a17c0363abfb1e9f745
function fe(){let e=O(),r=[...QDe,...Noo];if(e==="macos")r.push(...Foo);return r}

// chunk-6ccen3s8.js `He` — the runtime schema for one binding block, weaker than the file's: its context is any string and its action any string or null, so the values that were checked when the file was read are not checked again [19738,19801) 63 units sha256 6040c93b193e521c0d12af70243d84d7e5a4be02a1d1cca67e55f0b7fcb751fb
var He=p(()=>u({context:o(),bindings:ue(o(),o().nullable())}));

// chunk-6ccen3s8.js `Ve` — does one block pass the runtime schema [19801,19849) 48 units sha256 f00695601d930835510f04b773b13bfcc35f1347a9624e2de2beb4b8397ffab5
function Ve(e){return He().safeParse(e).success}

// chunk-6ccen3s8.js `T` — is this an array of blocks that each pass it, which is the whole document's check [19849,19900) 51 units sha256 ab297e2015e2c7659efc1e5ceb32c236e6b40d0f31946eb027e04fab7f6484ce
function T(e){return Array.isArray(e)&&e.every(Ve)}


export { i, RTr, p, mJ, h9, Z, Re, Q, v9t, We, lcs, F, ze, Bn, fe, He, Ve, T };
