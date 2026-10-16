// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
//   chunk-c9vsmdqj.js sha256 59124c8f7d581be40e14655f028069ec67ba561a3395db94c65ede3aee264fb5
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The `$` store's entry and dispatcher (W45-52): what `store.get`/`set`/`delete`/`keys` reach — the
// entry the product's other store layers hand off to, the dispatcher that reads, writes and locks,
// the backend indirection the product's host points at, the lock options, and the two checks the
// table entries carry. Every block is the module's own text, located by the needle the module spells
// it with; the closure is 18 statements across four chunks: the checks and the store cluster in the
// store's own module (chunk-tvdq3hrk.js), the store's size limit in chunk-nyce03br.js, the backend
// slot in chunk-c9vsmdqj.js, and the storage-id reader in the plugin-method table's module
// (chunk-sfn1dbxq.js). Names that are already in the product are imported rather than copied a
// second time: `He` and `l` from ./plugin-chain-source.ts, `t` from ./plugin-chain-host.ts, `S`/`xe`/
// `St` from ./plugin-chain-store-path-source.ts (W45-48), `vn` from ./plugin-chain-atomic-source.ts
// (W45-50), `Wa`/`Um` from ./plugin-chain-lockfile-source.ts (W45-49), and `vt`/`_`/`L`/`Y` from
// ./plugin-chain-store-carry-source.ts (W45-51, extended by this package with `_`). No node builtin
// is needed: every block in this closure works through the store layers already copied.
//
// The four table entries themselves are fragments of the plugin-method table's literal (they are not
// top-level statements, so the generator cannot emit them as blocks); they are ported verbatim in
// src/plugin-chain-store.ts with their spans quoted, the way the ui entries were in W45-24.
import { He, l } from './plugin-chain-source.js';
import { t } from './plugin-chain-host.js';
import { S, xe, St } from './plugin-chain-store-path-source.js';
import { vn } from './plugin-chain-atomic-source.js';
import { Wa, Um } from './plugin-chain-lockfile-source.js';
import { _, L, Y, vt } from './plugin-chain-store-carry-source.js';

// chunk-tvdq3hrk.js declares _ro, the value check the store.set entry carries: the value must serialize as JSON, be a string, and be within the store's character limit [10939,11214) 275 units sha256 a5bf25249fa35a066498422722dd75c112f074c37e98096bbf22db284b2d6e75
function _ro(e){let r;try{r=_(e)}catch(a){return`value is not JSON data: ${l(a)}`}let n=r;if(typeof n!=="string")return`value is not JSON data: ${e===void 0?"undefined":`a ${typeof e}`}`;return n.length>jde?`the value is ${n.length} characters, over the ${jde} limit`:void 0}

// chunk-tvdq3hrk.js declares ppr, the key check the get and delete entries carry: the call must name a string key [11214,11283) 69 units sha256 f0a5602ffc5301ef4a4bc40898c1ceee2a90256ea58e59d73b2335420b480371
function ppr(e){return typeof e?.key==="string"?void 0:"takes a key"}

// chunk-tvdq3hrk.js declares xNs, the set entry's check: the key check first, then the value check [13344,13379) 35 units sha256 32e0b27715bbc531c8ebdc0c80f14b12ff934cea8c76871dafe4fa26a25539d5
var xNs=(e)=>ppr(e)??_ro(e?.value);

// chunk-tvdq3hrk.js declares pt, the options every store lock is taken with: no realpath, ten retries from 5ms to 100ms, and a compromised lock logged at warn [15456,15601) 145 units sha256 2437af90c2b34dfc7e7c7893e2ca09f4250e7e158f27efd32824174d9651fb7f
var pt={realpath:!1,retries:{retries:10,minTimeout:5,maxTimeout:100},onCompromised:(e)=>{t(`$.store lock compromised: ${l(e)}`,{level:"warn"})}};

// chunk-tvdq3hrk.js declares de, the settled-promise helper the store's serial queue hands on [15601,15635) 34 units sha256 a15006a86c5c9bcb263e25d4d43b0c9d87f3599cd0dbd249b749d8d65fe571bf
var de=(e)=>e.catch(()=>{return});

// chunk-tvdq3hrk.js declares NDe, the one-at-a-time queue: each task waits for the previous one and a rejection does not stop the chain [15635,15722) 87 units sha256 e1b01f0afa0322256d742c8d12e69690beef65c0884a72aaa6447f42f817355f
function NDe(){let e=Promise.resolve();return(r)=>{let n=e.then(r,r);return e=de(n),n}}

// chunk-tvdq3hrk.js declares le, the memoizer: one queue per key [15722,15805) 83 units sha256 1f558982bbb7d649a1b667efe727f78ca481708aee33c3280953b21a50f44559
function le(){let e=new Map;return(r)=>{let n=e.get(r)??NDe();return e.set(r,n),n}}

// chunk-tvdq3hrk.js declares ct, the memoized queue the store's write and delete go through, keyed by the plugin's storage id [15829,15841) 12 units sha256 fc3d1410eac9179afd69c201b8c50b5c063505e4bd45edae1bf94bbceceec74d
var ct=le();

// chunk-tvdq3hrk.js declares Se, the store entry itself: read (through W45-51's read and carry, parsed and shape-checked), write (through W45-50's writer, at 0600, with W45-48's directory), and lock (through W45-49's lockfile beside the store file, with `pt`) [17609,18093) 484 units sha256 2de3ac81fc67444e007630c372f9ab3fc35fb3dd4cdfafcd4fe04c12d24af697
var Se={async read(e){let r=S(e),n;try{n=await vt(e,r)}catch(s){throw new He(`${e}: store file ${r} is unreadable (${l(s)})`)}if(n===void 0)return{};let i;try{i=Y(n)}catch(s){throw new He(`${e}: store file ${r} is malformed (${l(s)})`)}if(!L(i))throw new He(`${e}: store file ${r} is malformed (the JSON is not an object)`);return await St(e,r),i},write:async(e,r)=>vn(await xe(e),`${_(r,null,2)}
`,384),async lock(e){let r=await xe(e);return Wa(r,{lockfilePath:`${r}.lock`,...pt})}};

// chunk-tvdq3hrk.js declares Pe, the backend-slot factory: a setter and a getter over one slot [18093,18165) 72 units sha256 2e5b83e14fa58b9b6fee2a41f4c364a564a59782d878a2c5dad7fee4d5cb8dc4
function Pe(){let e=bs();return{setBackend:e.set,backendOverride:e.get}}

// chunk-tvdq3hrk.js declares Dt, the product's one backend slot [18165,18177) 12 units sha256 90edb754066774a2ab4e2135eb1eba064d95912d7a0d68fa52c60f20f84fd0db
var Dt=Pe();

// chunk-tvdq3hrk.js declares Ae, the backend in force: whatever the slot holds, else the store entry [18177,18213) 36 units sha256 779ed6c3fe8d9f8dafd6f46cd3002160370f83cfcb5c7d3f31cbc5931c553be2
var Ae=()=>Dt.backendOverride()??Se;

// chunk-tvdq3hrk.js declares Z, the key-length limit the dispatcher refuses at (256 characters), for every event but `keys` [18213,18223) 10 units sha256 1ee2ae31a2d1ba08ff1f38fe0be1ce5b2c81cce2d3cdbbe9cbb0b49035a0e100
var Z=256;

// chunk-tvdq3hrk.js declares Ce, the dispatcher: the key limit, the write lock for set and delete (released through the wrapper whatever happens), read, the four events, the store's own character limit on a set, the `$.store.set (plugin): key` log, and the error wrapping in the hooks error class [18223,19056) 833 units sha256 ff0bdbcdbed68ee1a5bf33787ab93f5e5e0c66f7937067b82b467b9654e4d33e
async function Ce(e,r){try{if(e.event!=="keys"&&e.key.length>Z)throw new He(`${r}: $.store.${e.event}: the key is ${e.key.length} characters, over the ${Z} limit`);let n=Ae(),s=e.event==="set"||e.event==="delete"?await n.lock?.(r):void 0;try{let a=await n.read(r);switch(e.event){case"get":return Object.hasOwn(a,e.key)?a[e.key]:void 0;case"keys":return Object.keys(a);case"set":{let m={...a,[e.key]:e.value},c=_(m).length;if(c>jde)throw new He(`${r}: $.store.set: the store would be ${c} characters, over the ${jde} limit`);await n.write(r,m),t(`$.store.set (${r}): ${e.key}`);return}case"delete":{if(!Object.hasOwn(a,e.key))return;let m={...a};delete m[e.key],await n.write(r,m);return}}}finally{await Um(s,`$.store.${e.event} (${r})`)}}catch(n){if(n instanceof He)throw n;throw new He(`${r}: $.store.${e.event} failed: ${l(n)}`)}}

// chunk-tvdq3hrk.js declares JAt, the event site: the dispatcher behind the per-plugin queue [19056,19090) 34 units sha256 b303855c4cc8fb7110d622681d2322aff14aa446300ddb324a3c8f5939126b36
var JAt=(e,r)=>ct(r)(()=>Ce(e,r));

// chunk-nyce03br.js declares jde, the store's size limit: a stored value and the whole store are both held to 4,194,304 characters [212618,212634) 16 units sha256 25ada96e210b32b1330c30138a752329aba7eaac0d1021498419984f11672779
var jde=4194304;

// chunk-c9vsmdqj.js declares bs, the slot the backend indirection is built on [615,668) 53 units sha256 2ad3005c8632df99918a325c2432212c9a8d159137a3e9b8ad521d4224c17aae
function bs(){let t;return{set:(e)=>{t=e},get:()=>t}}

// chunk-sfn1dbxq.js declares fW, the storage id a table entry runs against: the plugin's own id when the dispatcher knows one, the plugin's name otherwise — a 53-unit one-liner inside the plugin-method table's module, taken as an explicit range because the module's top-level map cannot be walked reliably (a 60k-line chunk) [2342617,2342670) 53 units sha256 034586ab37c4b70de87821faad5f18ea2e059edd941aa933713c935aae9d644f
var fW=(e,n)=>e.knownArgs.get(n)?.pluginStorageId??n;


export { _ro, ppr, xNs, pt, Se, Pe, Dt, Ae, Z, Ce, JAt, jde, fW, bs, ct };
