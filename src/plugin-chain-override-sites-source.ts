// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The seven sites the source's table writes by hand over the generated value events, and the bodies
// their argument checks close over. `se` is the generated value-site builder from the classic copy.
import { C, Me, er, we } from './plugin-chain-source.js';
import { se } from './plugin-chain-classic-source.js';

// chunk-nyce03br.js et: the `<key> after its next() was answered` clause the deny check appends [15444,15588) 144 units sha256 fd1d99188c61fe060876a7c43e90ef9278459ac86d3390f7f5bdce2bfa8a9858
function et(e,t,o){return t[e]!==void 0&&o?.some((n)=>n[e]===void 0)===!0?`a ${e} after its next() was answered (${e} in place of next)`:void 0}

// chunk-nyce03br.js Rt: the origin the engine set, which ui.close requires [18608,18682) 74 units sha256 6be6406112da0e7bc4ad647cb71c1dd44e7e48f0a65075cf19a368ee407909a5
var Rt="an origin other than the engine set (next(e) passes e.origin on)";

// chunk-nyce03br.js Er: the `{ value }`-or-deny check the two setters use [25450,25533) 83 units sha256 b79ba3e03053859684bbbae0aea996737061a039250450d495b1e0baaec538b5
var Er=C((e,t,o)=>Me(e,"{ value }",(r)=>Object.hasOwn(r,"value"))??et("deny",e,o));

// chunk-nyce03br.js Nt: the env.get/env.set argument check (the variable name is pinned) [34442,34559) 117 units sha256 839214ed52be5e1f441f349c3bf0fd7b77474687ae3c80ce1b753b0373cad6e9
function Nt(e,t){return e.name!==t.name?"a changed name (the variable read or written; next(e) passes it on)":void 0}

// chunk-nyce03br.js Si: the env.get site [34559,34627) 68 units sha256 2165f74162bf934a931fcb04b2bdb62109f3ee1fbd7f0acc09b5b96b681e843b
var Si={event:"env.get",check:se("env.get").check,checkArgument:Nt};

// chunk-nyce03br.js Oi: the env.set site [34627,34678) 51 units sha256 0ac2ec4a5fd8406fe4754f1f273980f8a5c550bc2c824066414cfef13813883d
var Oi={event:"env.set",check:Er,checkArgument:Nt};

// chunk-nyce03br.js jbr: the id length limit ui.close's id check reads [36319,36330) 11 units sha256 a9c7bc460e7b9bc319fa44b6971261a1db030e2e755e3546d3a5a42d0734573d
var jbr=64;

// chunk-nyce03br.js ZPt: the pane-id shape check [36330,36470) 140 units sha256 d035d3dda008bed2b869a460f647ad47424cfa13469123816c4b674174e0e377
function ZPt(e){return typeof e==="string"&&e.length<=jbr&&/^[A-Za-z0-9_-]+$/.test(e)?void 0:`id is 1 to ${jbr} of letters, digits, _ or -`}

// chunk-nyce03br.js Hi: the ui.close site [36470,36842) 372 units sha256 1b750e39e5cde06c6c0823189472591a47a33ed5821481c6a4e44291208d026d
var Hi={event:"ui.close",check:se("ui.close").check,checkArgument:(e,t)=>{let o=ZPt(e.id);if(o!==void 0)return`an unusable id: ${o}`;if(e.id!==t.id)return"a changed id (the pane being closed; next(e) passes it on)";if(e.origin===void 0)return"no origin (next(e) passes e.origin on; a rewrite spreads it: next({ ...e, id }))";return er(e.origin)!==er(t.origin)?Rt:void 0}};

// chunk-nyce03br.js Ni: the ui.open site [36842,36994) 152 units sha256 5cd4d667b3ba0c16d09e091e881bb810297c11c33bb7fcffc1f2241c46d72280
var Ni={event:"ui.open",check:se("ui.open").check,checkArgument:(e,t)=>e.id!==t.id?"a changed id (the pane being opened; next(e) passes it on)":void 0};

// chunk-nyce03br.js oa: the ui.blit site [42466,42756) 290 units sha256 d4239fb4b681655cab05ea08157da49de428fc44f23b57f5b148c2d931a87ad5
var oa={event:"ui.blit",check:se("ui.blit").check,checkArgument:(e,t)=>e.requestId!==t.requestId||e.key!==t.key||(("source"in e)&&e.source!==void 0)!==(("source"in t)&&t.source!==void 0)?"a changed requestId, key or kind (the Raster or Image being blitted; next(e) passes them on)":void 0};

// chunk-nyce03br.js Bt: the plugin/key/id reference check the state sites share [99758,99920) 162 units sha256 48b16b4bca7e028c8a11e2bd9411452ea6eb321b3cbbc775f41d63d0fb7cfabe
function Bt(e,t){return e.plugin!==t.plugin||e.key!==t.key||e.id!==t.id?"a changed reference (plugin, key and id say which value; next(e) passes them on)":void 0}

// chunk-nyce03br.js Fn: the state.set check (ifVersion and previous are pinned) [99920,100138) 218 units sha256 f78c8f1ad116ab054379ab6c737aedbf2f704edcee12777bcc516c024abc0b12
function Fn(e,t){let o=e.ifVersion!==t.ifVersion,r=er(e.previous)!==er(t.previous);return Bt(e,t)??(o?"a changed ifVersion (the condition is the caller's)":void 0)??(r?"a changed previous (the host stamps it)":void 0)}

// chunk-nyce03br.js Pa: the state.get site [100138,100210) 72 units sha256 51ad8cdf258d4239628270a06c1ba4df03843654f3ab50b67535ee7da770861d
var Pa={event:"state.get",check:se("state.get").check,checkArgument:Bt};

// chunk-nyce03br.js Ha: the state.set site [100210,100308) 98 units sha256 b252a2a502ebb36609f05d9c886cb54d73b15e67cfe6adcf6fac5dd6836c02e3
var Ha={event:"state.set",check:Er,restoreArgument:we(["previous","ifVersion"]),checkArgument:Fn};


export { Si, Oi, Nt, Hi, Ni, oa, Pa, Ha, Er, et, ZPt, jbr, Bt, Fn, Rt };
