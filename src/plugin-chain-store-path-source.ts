// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The store's file layer (W45-48): where a plugin's store file lives and how it is named, made and
// touched. Every block is the module's own text, located by the needle the module spells it with.
// `l` (an error's text) is already ported in ./plugin-chain-source.ts and `t` (the log sink) in
// ./plugin-chain-host.ts; the data directory `bl()`, which the path is built under, is the bounded
// host hook in ./plugin-chain-store-dir.ts.
import { createHash as ut } from 'crypto';
import { mkdir as ht, utimes as wt } from 'fs/promises';
import { dirname as kt, join as gt } from 'path';
import { l } from './plugin-chain-source.js';
import { t } from './plugin-chain-host.js';
import { bl } from './plugin-chain-store-dir.js';

// chunk-tvdq3hrk.js declares lt, the name a storage id may be used verbatim as [15805,15829) 24 units sha256 cae0f791cff6146a56513a796cd8f57a06fbb9dd540e972623cd1d631c5c6016
var lt=/^[a-z0-9._-]+$/;

// chunk-tvdq3hrk.js declares nt, the Windows device names a storage id may not be [15383,15436) 53 units sha256 6c97910adf9b4af33472727bdf7690d366ab4bfeb359598c043b2fcd96695b06
var nt=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

// chunk-tvdq3hrk.js declares me, the length a storage id is cut to in a hashed name [15436,15446) 10 units sha256 4ff802bb1df3665534768a35bddc8e8a25302fe7997332e3b9b82accbe005529
var me=64;

// chunk-tvdq3hrk.js declares st, the hex digits of the hash a hashed name keeps [15446,15456) 10 units sha256 dbc6c822259839196d74137048de02554a897ed027ce7ac77dbfc143cb4fe544
var st=12;

// chunk-tvdq3hrk.js declares ue, the file name for a storage id: safe ids verbatim, anything else sanitized and hashed [15976,16204) 228 units sha256 1fc204674589b39f75da24e8afd68f890574def722c7493b2435f22ca64df9c9
function ue(e){if(lt.test(e)&&!nt.test(e)&&e.length<=me&&e!=="."&&e!=="..")return`${e}.json`;let n=e.replace(/[^a-zA-Z0-9_-]/g,"_"),i=ut("sha256").update(e).digest("hex").slice(0,st);return`${n.slice(0,me)||"plugin"}-${i}.json`}

// chunk-tvdq3hrk.js declares S, the store file's path: the data directory, the store subdirectory and the name [16204,16238) 34 units sha256 1636aeef19f674acfc8ed4c65bf11fa7342f2eb80ce3a28d4f17d54214731019
var S=(e)=>gt(bl(),"store",ue(e));

// chunk-tvdq3hrk.js declares xe, which makes the store file's directory and answers its path [16238,16319) 81 units sha256 84b8bedab8dcc43027bae22f73a6f8f18ffa3a5a32cbac024b0d5aef1b1b1d84
async function xe(e){let r=S(e);return await ht(kt(r),{recursive:!0,mode:448}),r}

// chunk-tvdq3hrk.js declares St, the touch that keeps a store file from being collected, warning rather than throwing [16357,16491) 134 units sha256 d97096e89400cf97f559cdf228f12e20ced73ba82212e52dce31f1ff19790488
async function St(e,r){let n=new Date;try{await wt(r,n,n)}catch(i){t(`$.store (${e}): could not touch ${r}: ${l(i)}`,{level:"warn"})}}


export { lt, nt, me, st, ue, S, xe, St };
