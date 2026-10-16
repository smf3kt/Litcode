// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-fdwn5gdv.js sha256 bdd8f0094eb4fcd0daa8d9fa47261b47d4a0384894c1701f74ba72b338a9be11
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The bar's stored state (W45-28): the key its ledger is kept under in the plugin-state store,
// the zod schema of that ledger, and the read that parses it back. `a8` is the plugin the key
// belongs to, `Ope` the `{plugin,key}` pair, `Pye` the state-key builder, `TWt` the schema and
// `SEt` the read (whatever the store holds, or the empty frozen ledger when it is absent or does
// not parse). `s_` is the host registry field the store is reached through.
import { A, H, o, u, v } from './plugin-chain-notify-schema.js';
import { RYr } from './plugin-chain-notify-source.js';
import { it } from './plugin-chain-host.js';

// chunk-fdwn5gdv.js declares the lazy-memo registry its class, RTr, and p — the accessor TWt holds: calling it builds the schema once and tracks it for release [615,965) 350 units sha256 6f8c6eb2cb660c588201ac2ac9e03936068479e40f533bb5e8e9de5ae8e80697
class i{resetters=[];built=[];lazy(e){let t,r=()=>{t=void 0};return this.resetters.push(r),()=>{if(t===void 0)t=e(),this.built.push(r);return t}}builtCount(){return this.built.length}releaseBuiltSince(e){for(let t of this.built.splice(e))t()}reset(){for(let e of this.resetters)e();this.built.length=0}}var RTr=new i;function p(e){return RTr.lazy(e)}

// chunk-nyce03br.js declares a8, the plugin the bar's state belongs to ("engine") [111504,111520) 16 units sha256 0583f2432ff8dfe374dbda6088d5f6888447156e1fc2d18069259c6b5e75481d
var a8="engine";

// chunk-sfn1dbxq.js declares Ope, the {plugin,key} pair the bar's ledger is stored under [1691490,1691527) 37 units sha256 9d71cf4d04139b9721832c96d786fdfa33970d98e6313e48bd17190ade11f039
var Ope={plugin:a8,key:"bar-toasts"};

// chunk-n3ykh62m.js declares Pye, the `${plugin}\x00${key}` state key builder [275562,275644) 82 units sha256 f8beb5eb1109e40c00b6d01a23a405e35d7471451d2b118b91630e5b0e6e4b34
var Pye=({plugin:e,key:n,id:r})=>r===void 0?`${e}\x00${n}`:`${e}\x00${n}\x00${r}`;

// chunk-sfn1dbxq.js declares TWt, the zod schema of the stored ledger: its toasts (key, plugin, text, isManaged, leftMs, wasShown, lentMs, untoldMs) and its at/slot [1691527,1691764) 237 units sha256 dd590dd7afce716958e1e1ce0b7dc80fc36a6183656f563eb2e89ca3836bf3cb
var TWt=p(()=>u({toasts:A(u({key:o(),plugin:o(),text:o(),isManaged:H(),leftMs:v(),wasShown:H(),lentMs:v(),untoldMs:v()}).readonly()).readonly(),at:v(),slot:u({key:o(),endsAt:v(),shown:o().optional()}).readonly().optional()}).readonly());

// chunk-n3ykh62m.js declares s_, the host registry's plugin-state store [273997,274025) 28 units sha256 cdedf15b4f7eb535a9eb4fe5539863bb9038f3f5849f3fe7973724683f71eefa
var s_=()=>it().pluginState;

// chunk-sfn1dbxq.js declares SEt, which parses what the store holds for the bar's key and falls back to the empty ledger [1692468,1692581) 113 units sha256 09350d26dfab11e85f7ededc32ae0851b2194afae9222fe87c7105177ac5124e
function SEt(e=s_().values.getState()){let n=TWt().safeParse(e.get(Pye(Ope))?.value);return n.success?n.data:RYr}


export { a8, Ope, Pye, TWt, SEt, s_, p };
