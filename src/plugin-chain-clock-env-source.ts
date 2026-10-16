// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The `$` clock and env floors (W45-45): the two families a plugin reaches its process through.
// Every body is the module's text. `Q` (the abortable clock sleep) is already ported with its
// clock in ./plugin-chain-stream-source.ts (W45-22), and `He`/`wlt`/`L` come from the copied
// chain source. These bodies write no log line, so they need no sink.
import { Q } from './plugin-chain-stream-source.js';
import { He, L, wlt } from './plugin-chain-source.js';

// chunk-nyce03br.js declares fwr, the finite-number check the clock's ms argument passes [158250,158302) 52 units sha256 16416aeb8a768f65c3172b9e1039cc7aafbdeabafa3deac117d86b87f2574b88
var fwr=(e)=>typeof e==="number"&&Number.isFinite(e)

// chunk-nyce03br.js declares pwr, the reason a wait aborted: an Error as it stands, anything else wrapped as `wait aborted` [158106,158196) 90 units sha256 712cbdc5e7b8990978beb99eae8f081f72faf0271d64cf78b5fb5adb42480b14
function pwr(e){let{reason:t}=e;return t instanceof Error?t:new He(wlt(e,"wait aborted"))}

// chunk-sfn1dbxq.js declares cDo, the clock.now floor: the process's own Date.now in a resolved promise [1840645,1840684) 39 units sha256 f4745951eeff823858dfedc76bbfae5c09439474ff3e391001d8602de3296073
var cDo=()=>Promise.resolve(Date.now())

// chunk-sfn1dbxq.js declares pDo, the sleep run: Q over the caller's signal with the abort reason attached [1840685,1840741) 56 units sha256 c89709e3c956ce0ec4635b40a4f1d54826dde48367e09629a2a30727694e9d14
var pDo=(e,n)=>Q(e.ms,n,{...n&&{abortError:()=>pwr(n)}})

// chunk-sfn1dbxq.js declares mDo, the sleep check: a finite ms or the text naming what it got [1840742,1840864) 122 units sha256 920dd9ed4b9dba4bb7ebdffd3b33845bbc7a80cbd75976593fa2c9a1c6c85e38
function mDo(e){let n=e?.ms;return fwr(n)?void 0:`takes { ms }, a non-negative number of milliseconds (got ${String(n)})`}

// chunk-sfn1dbxq.js declares vme, the one table entry clock.sleep, clock.after and clock.every all share [1840864,1840910) 46 units sha256 abc27d19b3a0c18d319cccfe96cfd3cab0bf4f3096eefb94f3c87a5134bbd378
var vme={check:mDo,run:(e,n)=>pDo(e,n.signal)}

// chunk-sfn1dbxq.js declares xme, the name of a plain object's `name` field, when it is a string [1844317,1844394) 77 units sha256 9144d2d9d5b02c2e8ed4f9cb69184ef7296e73abddfbbda74ae6c0c3a135b916
function xme(e){let n=L(e)?e.name:void 0;return typeof n==="string"?n:void 0}

// chunk-sfn1dbxq.js declares pFo, the env.get run: the process environment, with USER_TYPE answered as `external` [1867912,1868038) 126 units sha256 b1742ba1c51a946618f5b3e563aa80db81c2563c80cf1ffda7f04ad52570965b
function pFo(e){let r=e.name==="USER_TYPE"?"external":process.env[e.name];return Promise.resolve(r===void 0?void 0:String(r))}

// chunk-sfn1dbxq.js declares s2t, the env check both entries share: a variable name on a plain object, no `=` and no NUL, and a string value or none [1868038,1868447) 409 units sha256 65a6863ffc5bf9a0b4fcc21e2c82fa6cefeb433b84d2c85ff5eda45d1b85623b
function s2t(e){let n=xme(e);if(!(n!==void 0&&n!==""&&!n.includes("=")&&!n.includes("\x00")))return`takes a variable name on a plain object (got ${n===void 0?typeof e?.name:JSON.stringify(n)})`;let s=L(e)?e.value:void 0;if(s!==void 0&&typeof s!=="string")return`takes a string value, or undefined to unset (got ${typeof s})`;return s!==void 0&&s.includes("\x00")?"takes a value with no NUL byte in it":void 0}

// chunk-sfn1dbxq.js declares gFo, the env.set run: write the value, or unset the variable when none was given [1868447,1868588) 141 units sha256 8b9e875d604f3a255429cb10b6c15b3bd6290e77fed4ac7ea9668ba7ab277482
function gFo(e){if(e.value===void 0)return delete process.env[e.name],Promise.resolve();return process.env[e.name]=e.value,Promise.resolve()}


export { fwr, pwr, cDo, pDo, mDo, vme, xme, pFo, s2t, gFo };
