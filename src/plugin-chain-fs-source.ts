// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
//   chunk-886tf6ja.js sha256 593e2ed1380725f871cb3ad6b60ab6fb270bd985462dd6ee3bf5128e003fd30b
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The `$` filesystem floor (W45-46): the read, write, list, exists and stat entries of the
// plugin-method table, and the one body they all run, `HE`. Every block below is the module's own
// text. `l` (an error's text) and `He` (the refused-call error) are already ported in
// ./plugin-chain-source.ts, `t` (the log sink) and `se` (the process cwd) in ./plugin-chain-host.ts,
// and the two dependencies this package does not carry — `$ne`, the location policy, and `O`, the
// platform — are the bounded host hooks in ./plugin-chain-fs-boundaries.ts. The remaining reads are
// node builtins, bound to the names the source uses for them.
import { constants as dzt } from 'fs';
import { lstat as ZDo, mkdir as eLo, open as tLo, readdir as nLo, readlink as oLo, realpath as rLo, stat as fGe, writeFile as sLo } from 'fs/promises';
import { dirname as iLo, dirname as qDo, isAbsolute as KDo, resolve as uzt, resolve as VDo, sep as izt } from 'path';
import { He, l } from './plugin-chain-source.js';
import { se, t } from './plugin-chain-host.js';
import { $ne, O } from './plugin-chain-fs-boundaries.js';

// chunk-sfn1dbxq.js declares IE, the descriptor an fs entry raises a refused path with: the field path, at the caller's cwd or the process's [1839344,1839395) 51 units sha256 fa8ffffd881b50628f9f99f9be620bc4afb0623d1b80a8a3101b97782e33b930
function IE(e){return{field:"path",at:e.cwd??se()}}

// chunk-sfn1dbxq.js declares uGe, the kind of a directory entry: file, dir or other [1846886,1846947) 61 units sha256 08fceed62922b983599e57333d84caf0f91b8214527e080085b7f11b19ac54f7
var uGe=(e)=>e.isFile()?"file":e.isDirectory()?"dir":"other";

// chunk-sfn1dbxq.js declares azt, the candidate paths a link's target is compared against: the target itself, resolved below the link's own directory, and the plain resolution [1847244,1847408) 164 units sha256 76fea1eb8e7c08b1a491dca7ffd6af5b0b778291fa9525777fbb7e3322eabeba
function azt(e,n){let r=n.replace(/^\\\\\?\\(?=[A-Za-z]:[\\/])/,"");if(KDo(r))return[r];let s=qDo(e),h=s.endsWith(izt)?s:`${s}${izt}`;return[r,`${h}${r}`,VDo(s,r)]}

// chunk-sfn1dbxq.js declares lzt, the read chunk the file floor allocates [1847408,1847421) 13 units sha256 216116ef7bf71a169ee2b7a93a9c10d6e8a3d3c8460daeac5da7cf95b154d53f
var lzt=65536

// chunk-sfn1dbxq.js declares C3, the byte limit a write refuses over [1847422,1847436) 14 units sha256 1162621774e8aac5c937a3b03cf583180aa8930b847391ebba9ca954c0605fa1
var C3=4194304

// chunk-sfn1dbxq.js declares cGe, the byte limit a read refuses over, which the source sets to C3 [1847437,1847447) 10 units sha256 b62d5e87502db5f192ece9a4183988a006f76c88ee2debc174db1ee0f8d59c16
var cGe=C3

// chunk-sfn1dbxq.js declares HE, the body behind every fs entry: the location check, the read loop with its byte limit, the write, the existence probe, the stat with link resolution, and the sorted list [1847448,1849273) 1825 units sha256 fee8dfe62c724313fdb3c60ae064cb69f46fde3236419b20b34ad7352139dea7
async function HE(e,n,r){let s=uzt(r??se(),e.path);function h(b){return t(`$.fs.${e.event} (${n}): ${s} refused: ${b}`),new He(`${n}: $.fs.${e.event}: ${e.path} refused: `+b)}if($ne(e.path)||$ne(s))throw h("a network location is not reached from here");try{switch(e.event){case"read":{let b=O()==="windows",w=await tLo(s,b?"r":dzt.O_RDONLY|dzt.O_NONBLOCK);try{let M=[],z=0;for(;;){let he=Buffer.allocUnsafe(lzt),_e;try{_e=(await w.read(he,0,he.length,null)).bytesRead}catch(ke){let Se=E(ke);if(Se==="EAGAIN"||Se==="EWOULDBLOCK")break;throw ke}if(_e===0)break;if(z+=_e,z>cGe)throw h(`the file is over the ${cGe}-byte limit`);M.push(he.subarray(0,_e))}let V=Buffer.concat(M);return e.as==="bytes"?{base64:V.toString("base64")}:V.toString("utf8")}finally{await w.close()}}case"write":{let b=Buffer.byteLength(e.text,"utf8");if(b>C3)throw h(`${b} bytes is over the ${C3}-byte limit`);await eLo(iLo(s),{recursive:!0}),await sLo(s,e.text,"utf8"),t(`$.fs.write (${n}): ${s} (${b} bytes)`);return}case"exists":return await fGe(s).then(()=>!0,()=>!1);case"stat":{let b=await ZDo(s),w=b.isSymbolicLink(),M=w&&!azt(s,await oLo(s)).some($ne),z=!w?b:M?await fGe(s).catch((he)=>{let _e=E(he);if(_e==="ENOENT"||_e==="ENOTDIR"||_e==="ELOOP")return;throw he}):void 0,V=z??b,X=e.resolve&&z!==void 0;return{kind:uGe(V),size:V.size,mtimeMs:V.mtimeMs,isLink:w,...X&&{realPath:await rLo(s)}}}case"list":{let b=await nLo(s,{withFileTypes:!0}),w=[];for(let M of b){let V=M.isFile()?await fGe(uzt(s,M.name)).catch(()=>{return}):void 0;w.push({name:M.name,kind:uGe(M),size:V?.size??0,mtimeMs:V?.mtimeMs??0,isLink:M.isSymbolicLink()})}return w.sort((M,z)=>M.name.localeCompare(z.name)),w}}}catch(b){if(b instanceof He)throw b;throw t(`$.fs.${e.event} (${n}): ${s} failed: `+l(b)),new He(`${n}: $.fs.${e.event}(${e.path}) failed: `+(E(b)??"no errno"))}}

// chunk-sfn1dbxq.js declares gzt, the fs.list entry: the path check, the raise descriptor and the list run [1849977,1850062) 85 units sha256 eea009bc750f1ed5f124b235114446b5206c672a51bd146a6995362f6bc457f8
var gzt={check:XAt,raise:IE,run:(e,n)=>HE({event:"list",path:e.path},n.plugin,n.cwd)}

// chunk-sfn1dbxq.js declares hzt, the fs.read entry: the path-and-as check and the read run [1850063,1850156) 93 units sha256 04915be82ca776646b807ba45e319840218e48153dd22d66a761e10dbd1d7556
var hzt={check:ANs,raise:IE,run:(e,n)=>HE({event:"read",path:e.path,as:e.as},n.plugin,n.cwd)}

// chunk-sfn1dbxq.js declares yzt, the fs.stat entry: the path-and-resolve check and the stat run [1850157,1850260) 103 units sha256 3c716bd0771dd7c84422cc5d49773b62f95ff56ed2fa5091f8e60b12126d1a2c
var yzt={check:CNs,raise:IE,run:(e,n)=>HE({event:"stat",path:e.path,resolve:e.resolve},n.plugin,n.cwd)}

// chunk-sfn1dbxq.js declares _zt, the fs.write entry: the path and text checks and the write run [1850261,1850448) 187 units sha256 c4e3cc11d19a73877400492c7b160d7cdd7fefbddf03bea55796bf8b17f6c9bd
var _zt={check:(e)=>XAt(e)??(typeof e?.text==="string"?void 0:"takes the text to write"),raise:IE,run:(e,n)=>HE({event:"write",path:e.path,text:e.text},n.plugin,n.cwd).then(()=>{return})}

// chunk-tvdq3hrk.js declares XAt, the path check every fs entry but stat shares: a non-empty string [12056,12143) 87 units sha256 7ba7dd1f85bc76829eb077fb90e40f297849dee86465a5318e3e1616cc6ab4d6
function XAt(e){let r=e?.path;return typeof r!=="string"||r===""?"takes a path":void 0}

// chunk-tvdq3hrk.js declares ANs, the fs.read check: the path, then `as` being text or bytes [12143,12249) 106 units sha256 c49a9ec241593438bdf6cd4a5ebdead205802365c6bc5dafabad3a1ebea2bfbd
function ANs(e){let r=e?.as==="text"||e?.as==="bytes";return XAt(e)??(r?void 0:'as is "text" or "bytes"')}

// chunk-tvdq3hrk.js declares CNs, the fs.stat check: the path, then `resolve` being a boolean [12249,12354) 105 units sha256 333498768ee627909e77fee456cb32859bae60abfdae765af56c687cba3fb714
function CNs(e){let r=typeof e?.resolve==="boolean";return XAt(e)??(r?void 0:"resolve is true or false")}

// chunk-886tf6ja.js declares E, the errno code of a thrown error, when it carries one [4814,4913) 99 units sha256 a84ab0a2488aed5689416393c679dde4e7f4b29aa980e121bd56b25ab3e7b5e4
function E(n){if(n&&typeof n==="object"&&"code"in n&&typeof n.code==="string")return n.code;return}


export { E, IE, uGe, azt, lzt, C3, cGe, HE, gzt, hzt, yzt, _zt, XAt, ANs, CNs };
