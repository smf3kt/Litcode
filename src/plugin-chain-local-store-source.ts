// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-4bw62nzm.js sha256 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713
//   chunk-k1419ccf.js sha256 c16ef15d854983cef4a918f0e03680314c24bb195dfb9771dad68fc7d8b6ef1a
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The local settings store (W45-56): the store itself, one instance per host, and the state it
// keeps — the merged settings and the per-source map a settings read mutates, the parsed-file and
// managed-read caches, the repository tier the store freezes while something holds it, the policy
// walk cache, and the pin flag the walk consults. `Ixr.of(host)` is the entry every settings path
// goes through, and `localStoreProbes` — the field the W45-54 ownership gate reads — is a field of
// this store, so that package's handle stops being a seam and becomes the real thing.
//
// The closure is 98 statements and 13,825 units in chunk-4bw62nzm.js, but 88 of those statements
// (7,556 units) are the lodash internals this product already carries, so they are imported rather
// than copied a second time: 12 blocks and 6,302 units are new, ten statements from that module and
// the pin flag with its state from chunk-k1419ccf.js.
//
// `Ht` — the probe cache W45-54 copied on its own — is a dependency of the store, so it is imported
// from ./plugin-chain-local-store-probes-source.js instead of copied twice (same module, same range,
// the rule this chain has followed since W45-51). `Oe` comes from ./plugin-chain-registry-stores-source.js,
// and `dirname`/`basename` are the module's own path imports.
import { dirname as Dt, basename as Vr } from 'path';
import { M } from './plugin-chain-lodash-internals-source.js';
import { Ht } from './plugin-chain-local-store-probes-source.js';
import { Oe } from './plugin-chain-registry-stores-source.js';

// chunk-4bw62nzm.js declares `Nr`: a pass-through to the equality helper the settings diff compares two wrapped source entries with [9915,9946) 31 units sha256 9126b02857ad3421de7ce6c9db39f377cab00c0ea58489f0e0ce1c44262ffe2e
function Nr(e,t){return M(e,t)}

// chunk-4bw62nzm.js declares `Vn`: the alias that equality is reached by [9946,9956) 10 units sha256 23eb6d215ad46301520de9036b5f855eeb0b8b2d2c09eb854f473c63bd0039ef
var Vn=Nr;

// chunk-4bw62nzm.js declares `q`: the per-host instance cache. `of(host)` answers the host's instance, building it through the factory on first ask and remembering it in a `WeakMap` — this is the class `Ixr` is built from [10003,10147) 144 units sha256 6ed6bf109547e3a7e97f913dcd4c3fdfad6122c24dd49230df5dc803386e9165
class q{#e;#t=new WeakMap;constructor(e){this.#e=e}of(e){let t=this.#t.get(e);if(t!==void 0)return t;let o=this.#e();return this.#t.set(e,o),o}}

// chunk-4bw62nzm.js declares `oe`: the walk cache — the folders a policy walk has visited, whether each is a link, the managed MCP document, `noteWalked(key, thunk)` memoizing by key, and `all()` [10256,10514) 258 units sha256 43c54431963a229d08ff7c860d16166adbc27d1153fc523e94109add5bd12354
class oe{walked=new Map;folderIsLink=new Map;managedMcp=null;clearWalk(){this.walked.clear(),this.folderIsLink.clear()}noteWalked(e,t){if(!this.walked.has(e))this.walked.set(e,t())}all(){return[...this.walked.values(),this.managedMcp].filter((e)=>e!==null)}}

// chunk-4bw62nzm.js declares `re`: the repository tier with its holders, baseline and lingering tier — the object a store keeps so a tier stays frozen while something still holds it [10514,11767) 1253 units sha256 8066c8c8c1a08fee73db86a69e379acc195349c478409bdc9ba0e692ef392a25
class re{holders=0;tiers;baseline;lingering;tier(e){if(this.holders===0&&this.lingering!==void 0){let t=this.lingering();if(t===void 0)this.lingering=void 0;this.tiers=t}return this.tiers?.get(e)}engage(e,t){let o;if(this.holders===0){let i=e(),s=t?.()??i;if(this.lingering!==void 0)o={tiers:this.tiers,lingering:this.lingering},this.lingering=void 0;this.tiers=i,this.baseline=s}this.holders++;let r=!1;return{release:()=>{if(r)return{last:!1};if(r=!0,this.holders--,this.holders>0)return{last:!1};return this.tiers=void 0,this.lingering=void 0,this.baseline=void 0,{last:!0}},abandon:()=>{if(r)return;if(r=!0,this.holders--,this.holders===0)this.tiers=o?.tiers,this.lingering=o?.lingering,this.baseline=void 0}}}whileLive(e){let t=this.tiers,o=this.lingering;this.tiers=void 0,this.lingering=void 0;try{return e()}finally{this.tiers=t,this.lingering=o}}baselineTier(e){return this.baseline?.get(e)}differingTiers(e){return this.baseline===void 0?[]:Gr(this.baseline,e)}rebaseline(e,t){if(this.baseline===void 0)return;let o=new Map(this.baseline);for(let r of t){let i=e.get(r);if(i===void 0)o.delete(r);else o.set(r,i)}this.baseline=o}linger(e,t){if(this.holders===0)this.tiers=e,this.lingering=t,this.baseline=void 0}isHeld(){return this.holders>0}}

// chunk-4bw62nzm.js declares `XMt`: the empty-settings normalize — a null or empty object answers null [11767,11833) 66 units sha256 b9612138b779606b41ac66fad517270fef7ae4268f8d8c27f4cf002fd6ec699c
function XMt(e){return e!==null&&Object.keys(e).length===0?null:e}

// chunk-4bw62nzm.js declares `Et`: the source snapshot `{...entry, settings: XMt(settings), unfiltered: XMt(unfiltered), …legacy` — what the settings diff compares [11833,11960) 127 units sha256 7f88781d701e3d76c0cf2e94925e32ad82930cf2804dc5d3ad525153a576c466
function Et(e){return{...e,settings:XMt(e.settings),unfiltered:XMt(e.unfiltered),...e.legacy!==void 0&&{legacy:XMt(e.legacy)}}}

// chunk-4bw62nzm.js declares `Gr`: the changed-source diff — the keys of both maps, filtered to the entries whose wrapped snapshots are not equal [11960,12107) 147 units sha256 2088e5b0ffdcec2517676b338ecdc27934450222b73bacf6918fc102023b7350
function Gr(e,t){return[...e.keys(),...[...t.keys()].filter((o)=>!e.has(o))].filter((o)=>{let r=e.get(o),i=t.get(o);return!Vn(r&&Et(r),i&&Et(i))})}

// chunk-4bw62nzm.js declares `F8e`: the local settings store itself — `mergedSettings`, `perSource`, the parsed-file and managed-read caches, `repoTierFreeze`, `isLoadingFromDisk`, `pluginBase`, the epoch, the walk and listing caches, and the methods that load, seed, invalidate and diff them [12107,16313) 4206 units sha256 812a5e14d11676916d2730fa0eafe05e96e36204f5563c80d90ff64e69811b72
class F8e{mergedSettings=null;perSource=new Map;parsedFiles=new Map;managedDocumentLinks=new oe;folderListings=new Map;managedFileReads=new Map;primedFiles=new Set;policyWalks=0;walkedFolders=new Map;policy={};lastPolicyEnvComposition=null;isLoadingFromDisk=!1;autoModeUntrustedSourceWarned=!1;changed=Oe();internalWrites=new Map;enabledSources;inlineFlagParse;repoTierFreeze=new re;pluginBase;epoch=0;systemSpaceServingLogged=!1;systemAttestationContradicted=!1;backendReadResetTail=Promise.resolve();backgroundWorkTail=Promise.resolve();invalidated=Oe();pluginBaseLoaded=!1;primer;localStoreProbes=new Ht;retained=new Map;retainedListings=new Map;setPluginBase(e){this.pluginBase=e,this.pluginBaseLoaded=!0}clearPluginBase(){this.pluginBase=void 0}invalidateAll(e){if(this.epoch++,this.mergedSettings=null,this.perSource.clear(),this.parsedFiles.clear(),this.managedDocumentLinks.clearWalk(),this.primedFiles.clear(),this.policyWalks=0,this.walkedFolders.clear(),this.folderListings.clear(),this.policy={},e?.userLayer==="retain"&&j()&&this.primer!==void 0){for(let[t,o]of this.retained)this.parsedFiles.set(t,o.parsed),this.primedFiles.add(t);for(let[t,o]of this.retainedListings)this.folderListings.set(t,o.names)}else this.retained.clear(),this.retainedListings.clear();this.invalidated.emit()}invalidatePolicyLayer(){this.mergedSettings=null,this.perSource.delete("policySettings"),this.policy={}}onInvalidate(e){return this.invalidated.subscribe(e)}seedParsedFile(e,t,o,r){if(r!==this.epoch)return!1;let i=this.parsedFiles.get(e),s=i===void 0||!Vn(i,o);if(this.parsedFiles.set(e,o),s||this.primedFiles.has(e))this.primedFiles.add(e);let a=this.retained.get(e);if(a!==void 0)a.parsed=o;if(s)this.dropDerivedCaches(t);return!0}walkReadDiffers(e,t){let o=this.parsedFiles.get(e);return o!==void 0&&!this.primedFiles.has(e)&&!Vn(o,t)}unseedParsedFile(e,t,o){if(o!==this.epoch)return;if(this.retained.delete(e),!this.primedFiles.has(e)||t==="policySettings"&&this.policyWalks>0)return;this.primedFiles.delete(e),this.parsedFiles.delete(e),this.dropDerivedCaches(t)}dropDerivedCaches(e){if(this.perSource.delete(e),this.mergedSettings=null,e==="policySettings")this.policy={}}primedFolderListing(e){return j()?this.folderListings.get(e):void 0}folderListingForPolicyWalk(e){if(!j())return;this.policyWalks++;let t=this.folderListings.get(e);if(!this.walkedFolders.has(e)||t!==void 0)this.walkedFolders.set(e,t??null);return t}noteWalkListing(e,t){if(!j())return;this.walkedFolders.set(e,t)}get policyWalkCount(){return this.policyWalks}policyInstallVerdict(e,t,o){let r=this.parsedFiles.get(e);if(r===void 0||Vn(r,t))return"install";if(!this.primedFiles.has(e))return"raced";if(this.policyWalks===0)return"install";return this.policyWalks>o?"raced":"deferred"}folderInstallVerdict(e,t,o){if(!this.walkedFolders.has(e))return this.hasParsedDropInOutside(e,t)?"raced":"install";let r=this.walkedFolders.get(e);if(r!==null&&r!==void 0&&Vn(r,t))return"install";return this.policyWalks>o?"raced":"deferred"}seedFolderListing(e,t,o){if(o!==this.epoch)return!1;let r=this.folderListings.get(e);this.folderListings.set(e,t);let i=this.retainedListings.get(e);if(i!==void 0)i.names=t;if(r!==void 0&&!Vn(r,t))this.dropDerivedCaches("policySettings");return!0}walkReadManagedFileIn(e,t){for(let[o,r]of this.parsedFiles)if(!o.includes("\x00")&&!this.primedFiles.has(o)&&(r.settings!==null||r.errors.length>0)&&(o===e||Dt(o)===t))return!0;return!1}walkRead(e){return this.parsedFiles.has(e)&&!this.primedFiles.has(e)}hasParsedDropInOutside(e,t){for(let o of this.parsedFiles.keys())if(!o.includes("\x00")&&!this.primedFiles.has(o)&&Dt(o)===e&&!t.includes(Vr(o)))return!0;return!1}clearFolderListing(e,t){if(t!==this.epoch)return;if(this.retainedListings.delete(e),!this.folderListings.has(e)||this.walkedFolders.has(e))return;this.folderListings.delete(e),this.dropDerivedCaches("policySettings")}retainLayer(e,t){let o={parsed:t};return this.retained.set(e,o),()=>{if(this.retained.get(e)===o)this.retained.delete(e)}}dropRetainedLayer(e){this.retained.delete(e)}retainFolderListing(e,t){let o={names:t};return this.retainedListings.set(e,o),()=>{if(this.retainedListings.get(e)===o)this.retainedListings.delete(e)}}}

// chunk-4bw62nzm.js declares `Ixr`: the store, one per host — `new q(() => new F8e)` [16862,16889) 27 units sha256 bc64688bf3a8d6c13314a5bb76a196f22fafba782cb66f96c4af9fd8ee3e3f76
var Ixr=new q(()=>new F8e);

// chunk-k1419ccf.js declares the pin state `t` that `j()` reads [1148,1154) 6 units sha256 6e9d709460a3b6fc14785a086d9d2a2824f35ee92889ae39b46e6c61a13b7ef4
var t;

// chunk-k1419ccf.js declares `j`: whether the policy setting is pinned — the flag the store consults before it walks [1154,1181) 27 units sha256 c6dd0e5d07308a75d000df79ceeab6ff9542cbecdb247c3a68db1da4f88d74e3
function j(){return t===!0}

// chunk-k1419ccf.js declares `nHs`: the pin setter — `true`/`false` pins the flag and answers "pinned" the first time, "unchanged" when the value is already the one asked for, and "conflict" (leaving the flag alone) when it disagrees [1181,1280) 99 units sha256 acc69bc9b985a5920ece54f86980d30d431b77aef905097aff220f7f50a1ec1b
function nHs(n){let e=n===!0;if(t===void 0)return t=e,"pinned";return t===e?"unchanged":"conflict"}


export { Ixr, F8e, q, oe, re, XMt, Et, Gr, Nr, Vn, j, nHs };
