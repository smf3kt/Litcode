// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-3cynezh1.js sha256 c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3
//   chunk-gyf58rwf.js sha256 7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad
//   chunk-4bw62nzm.js sha256 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713
//   chunk-nqc6v990.js sha256 261b35d99a3bb5aed676678c983f7c903da023ab3ad0c4117a3474d6b51e0738
//   chunk-ae84tp6z.js sha256 901937cc8e68c765b7dddc4875578a6b1759f5e9a2535bee85829bea8ace200f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The settings source → file layer (W45-54): which file backs each settings source, the
// managed-settings path and drop-in directory with their cache, the cowork file name, the
// project/local names, the local-settings canonicalization gate with its ownership probes and its
// three warn texts, and the fs facade `ie()` those probes read through. Every block is the
// module's own text at a measured range; the closure is 36 statements across five chunks: the
// resolver cluster in chunk-3cynezh1.js, the facade and its realpath/read helpers in
// chunk-gyf58rwf.js, the no-project-directory error in chunk-4bw62nzm.js, the `.claude` directory
// in chunk-nqc6v990.js, and `lA`/`Hp`/`On` in chunk-ae84tp6z.js.
//
// Names the product already holds are imported rather than copied a second time: `t` (the log
// sink) and `a` (the environment the cowork flag reads) from ./plugin-chain-host.ts, `E` (an
// error's errno code) from ./plugin-chain-fs-source.ts, `O` (the platform string) from
// ./plugin-chain-fs-boundaries.ts, `po` (the memoizer `be` is built with) from
// ./plugin-chain-memoize-source.ts, and `W` (the ENOENT test) from
// ./plugin-chain-store-carry-source.ts (W45-51, whose plan this package extends with `W`).
//
// `ji()` — the local store the two ownership probes are reached through — is the bounded host hook
// in ./plugin-chain-local-store.ts: the source's `ji` is `Ixr.of(B().host)`, and `Ixr` is the whole
// local store class, so the hook owns the store handle while the probe cache it carries (`Ht`) is
// the source's own, copied in ./plugin-chain-local-store-probes-source.ts.
//
// The ranges are explicit rather than needles: chunk-3cynezh1.js and chunk-gyf58rwf.js are two of
// the 60k-line chunks whose top-level map cannot be walked reliably — the limitation W45-51 and
// W45-53 recorded.
import { dirname as Fn, join as Se, join as u, join as xy, resolve as fe } from 'path';
import { homedir as Bd, homedir as R } from 'os';
import * as S from 'fs';
import { realpathSync as ot } from 'fs';
import {
  appendFile as qs, chmod as ei, copyFile as ni, link as ri, lstat as kt, mkdir as si, open as Q,
  readFile as Nn, readlink as oi, readdir as ii, realpath as ai, rename as ui, rm as ci,
  rmdir as li, stat as $n, symlink as fi, unlink as gi,
} from 'fs/promises';
import { a, t } from './plugin-chain-host.js';
import { E } from './plugin-chain-fs-source.js';
import { O } from './plugin-chain-fs-boundaries.js';
import { po } from './plugin-chain-memoize-source.js';
import { W } from './plugin-chain-store-carry-source.js';
import { ji } from './plugin-chain-local-store.js';

// chunk-3cynezh1.js declares the managed-settings path cache `vd` and its `Ad` instance: the file path and the drop-in directory are each computed once and reset on demand [359965,360273) 308 units sha256 a62f5ffb35fd09889fe1d2d5917eceedb76acf9cef3494b42c824f28b5b0e29d
class vd{managedFilePath=void 0;dropInDir=void 0;getManagedFilePath(){return this.managedFilePath??=My(),this.managedFilePath}getDropInDir(){return this.dropInDir??=xy(eC(),"managed-settings.d"),this.dropInDir}clearDropInDir(){this.dropInDir=void 0}reset(){this.managedFilePath=void 0,this.dropInDir=void 0}}

// chunk-3cynezh1.js declares `Ad`, the one managed-settings cache the process reads [360273,360287) 14 units sha256 53210f059e5a0249ce6b4382a49f0f348f74947c68815d100204e8f39fddc718
var Ad=new vd;

// chunk-3cynezh1.js declares `eC`, the managed-settings directory: the cached path through `Ad` [360287,360332) 45 units sha256 52d8693557b33a6ae1ae33562f1f1d24c90fd3c59447c457910cb971aa3f860a
function eC(){return Ad.getManagedFilePath()}

// chunk-3cynezh1.js declares `My`, the platform default the managed-settings directory falls back to: the override first, then macos / windows / linux paths [360332,360539) 207 units sha256 eda8a56ee206f0957793945670e8082ae04e453697d1fcb20f2575b717eb6d7e
function My(){let e=Oko();if(e!==void 0)return e;switch(O()){case"macos":return"/Library/Application Support/ClaudeCode";case"windows":return"C:\\Program Files\\ClaudeCode";default:return"/etc/claude-code"}}

// chunk-3cynezh1.js declares `Oko`, the managed-settings directory override — it answers nothing in this build, which is why `My` always reaches its platform switch [360539,360561) 22 units sha256 45f534c11aed80f99ff666a5d5071836f4928173f6e44ff87811a045c28c761d
function Oko(){return}

// chunk-3cynezh1.js declares `m_`, the managed settings file: `managed-settings.json` inside the managed directory [387272,387326) 54 units sha256 d1e502d1da64804fc59e763be295073e52beb7fc4de670a19ab04d6b2a9a511f
function m_(){return Se(eC(),"managed-settings.json")}

// chunk-3cynezh1.js declares `Ynn`, the source → directory resolver: userSettings is the `.claude` directory, policy the managed one, project the configured project directory or the cwd, local the same with the canonical-root decision, flag the flag path's directory [398204,398553) 349 units sha256 2436d0b8fe088ef66369e93b5b0ae15169f02f5c0d60902cb2a9b1c9766e607a
function Ynn(e,n){switch(e){case"userSettings":return fe(be());case"policySettings":return fe(FWn(n));case"projectSettings":return fe(n.projectConfigDir??FWn(n));case"localSettings":{if(n.projectConfigDir!==void 0)return fe(n.projectConfigDir);return RN(FWn(n),n.canonicalGitRoot)}case"flagSettings":return n.flagPath?Fn(fe(n.flagPath)):fe(FWn(n))}}

// chunk-3cynezh1.js declares `FWn`, the cwd a project or local source needs, refused with the no-project-directory error when the context has none [398553,398611) 58 units sha256 1572bcf076ce0a5784b7fd2fff4b11245986df246bdb8f3d676a92cb59bef4bb
function FWn(e){if(e.cwd===null)throw new GP;return e.cwd}

// chunk-3cynezh1.js declares `RN`, the local-settings root decision: the canonical root when the cwd and the root disagree and the root is owned by the user, the cwd otherwise [398611,398733) 122 units sha256 666495ec73c3f70525382bdbc9add050d35a2cf72aa4af1e5c4ace7386766f6a
function RN(e,n){let s=pTr(e,n);if(s.decided!==void 0)return s.decided;if(!Z$s(s.root))return s.cwdResolved;return s.root}

// chunk-3cynezh1.js declares `pTr`, that decision's inputs: the root, the cwd, and whether they are the same or the root is the real home directory [398733,398952) 219 units sha256 f5cd4e2e6de35cb0ee22e5cb814be945a684d707383ed668bdb7d15b3e43edb3
function pTr(e,n){let s=n?.(e);if(!s)return{decided:fe(e)};let r=fe(s),i=fe(e);if(r===i)return{decided:r};let d;try{d=fTr()}catch{return{decided:i}}if(r===d)return{decided:i};return{decided:void 0,root:r,cwdResolved:i}}

// chunk-3cynezh1.js declares `Q$s`, the ownership probe: the root, its `.git` entry and its `.claude` entry, read once per root through the local store's probe cache [398952,399026) 74 units sha256 47420fb38e7e3be0b6be491edbcba693b43e3d74e923ba86323d6e89b8ecc545
function Q$s(e){return ji().localStoreProbes.canonicalRootOwnerUids(e,b_)}

// chunk-3cynezh1.js declares `b_`, the uid triple the probe answers with: the root's uid, the `.git` entry's uid, and the `.claude` entry's uid or null when it is absent [399026,399193) 167 units sha256 e08dfe260ee7869a0814e5c105151042d32e257ee1c936663797e31346a01009
function b_(e){let n=ie(),s=null;try{s=n.lstatSync(Se(e,".claude")).uid}catch(r){if(!W(r))throw r}return{rootUid:n.statSync(e).uid,gitEntryUid:E_(e),claudeEntryUid:s}}

// chunk-3cynezh1.js declares `E_`, the `.git` entry's uid [399193,399278) 85 units sha256 8148116e4730d9abef5408f653718e83c631355b640939f9dba904cac7cc73cb
function E_(e){let n=ie();try{return n.lstatSync(Se(e,".git")).uid}catch(s){throw s}}

// chunk-3cynezh1.js declares `Z$s`, the ownership gate: without uid semantics, or with any of the three uids unequal to the current one, the store stays at the session cwd and a warn line names the uid it found; the three texts are the source's [399278,400402) 1124 units sha256 3854d64dd05835cf6f52c50a7620f3a34f3059fbe8a160e61e0903991c8e0d6f
function Z$s(e){if(typeof process.getuid!=="function"&&typeof process.geteuid!=="function")return t(`localSettings: not canonicalizing the consent store to ${e} \u2014 this platform has no uid semantics to verify directory ownership with, so the store stays at the session cwd (canonicalization is POSIX-only)`,{level:"warn"}),!1;let n=typeof process.geteuid==="function"?process.geteuid():process.getuid?.();try{let{rootUid:s,gitEntryUid:r,claudeEntryUid:i}=Q$s(e);if(s===n&&r===n&&(i===null||i===n))return!0;return t(`localSettings: not canonicalizing the consent store to ${e} \u2014 it (uid ${s}), its .git entry (uid ${r}), or its .claude entry (uid ${i??"absent"}) is not owned by the current user (uid ${n}); the store stays at the session cwd (the pre-canonicalization behavior). If you own this repo, chown it (including .git and .claude) or run from a directory you own.`,{level:"warn"}),!1}catch(s){return t(`localSettings: not canonicalizing the consent store to ${e} \u2014 its ownership could not be verified (${s instanceof Error?s.message:String(s)}); the store stays at the session cwd`,{level:"warn"}),!1}}

// chunk-3cynezh1.js declares `fTr`, the normalized real home directory, read once per process through the same probe cache [400402,400472) 70 units sha256 bb87305d1c41f5e473b37dc58134056a686b638d019a22a05aaa2f758c955f09
function fTr(){return ji().localStoreProbes.normalizedRealHomeDir(w_)}

// chunk-3cynezh1.js declares `w_`, the realpath of the home directory, normalized to NFC, throwing when the realpath is unavailable [400472,400577) 105 units sha256 e8550cfd7d349e763d1da166c3cc288bbd2acc09bc9775a47b1c03e088abfad3
function w_(){let e=Hp(Bd());if(e===null)throw Error("home directory realpath unavailable");return On(e)}

// chunk-3cynezh1.js declares `UE`, the two settings file names: `settings.json` and the cowork one [400716,400779) 63 units sha256 7ab73c8b2581446960f0c0903b70e0b11a83a9741aa75fa844501491c257ca59
var UE={default:"settings.json",cowork:"cowork_settings.json"};

// chunk-3cynezh1.js declares `k_`, the user settings file name: the cowork name when the context says so or the environment flag is set, the default otherwise [400779,400882) 103 units sha256 4772a9088e56c34a125a47935b6148881e846c979f3aaf0528524d87cd967593
function k_(e){if(e.coworkPlugins||a.CLAUDE_CODE_USE_COWORK_PLUGINS)return UE.cowork;return UE.default}

// chunk-3cynezh1.js declares `GW`, the resolver every settings read goes through: user settings are the `.claude` directory joined with the file name, project and local are the resolved directory joined with their names and refuse a context with neither cwd nor project directory, policy is the managed file, flag is the context's flag path [400882,401146) 264 units sha256 833640cc61663dec769c08acd83d102eddfd192c4da20b0a801c9e70e6688791
function GW(e,n){switch(e){case"userSettings":return Se(Ynn(e,n),k_(n));case"projectSettings":case"localSettings":{if(n.cwd===null&&n.projectConfigDir===void 0)return;return Se(Ynn(e,n),TO(e))}case"policySettings":return m_();case"flagSettings":return n.flagPath}}

// chunk-3cynezh1.js declares `TO`, the two per-source file names: `settings.json` for project, `settings.local.json` for local [401146,401294) 148 units sha256 6732084f6a29ec0fc139a0ee37ba4c0923ceec8a22b1064fb2f993ccd26cd9ff
function TO(e){switch(e){case"projectSettings":return Se(".claude","settings.json");case"localSettings":return Se(".claude","settings.local.json")}}

// chunk-gyf58rwf.js declares `Xs`, the disposable the facade's telemetry spans are built on — a no-op in this build [59700,59730) 30 units sha256 972294fafda488d6b34fadabc4c009286f8a598cd6881dcf4582c5acbc3a088b
var Xs={[Symbol.dispose](){}};

// chunk-gyf58rwf.js declares `Qs`, that disposable's accessor [59730,59754) 24 units sha256 2ba5ddb21c0f0db285a013be400ed5567fd40951d50847c53c2540ec796fbdc2
function Qs(){return Xs}

// chunk-gyf58rwf.js declares `ih`, the template tag the facade wraps every call in [59754,59764) 10 units sha256 470948aa64a5d6fb52387cd3d1c13ef625860edf4f25f3da1f3aa8092f5d8b61
var ih=Qs;

// chunk-gyf58rwf.js declares `pi`, the arrow the facade's directory-open errors are written with [60401,60417) 16 units sha256 6bcceb7d5cb7ad06d252725a00716d8d7ef8a82d64622bcad9c7ef25a083624e
var pi="\u2192";

// chunk-gyf58rwf.js declares `hi`, the open flags a no-follow directory read uses [60417,60484) 67 units sha256 5c424e1a998a005647c31da6207c4cd00957bcb0a7d43f6ba80250f6d964431c
function hi(){return S.constants.O_NOFOLLOW|S.constants.O_NONBLOCK}

// chunk-gyf58rwf.js declares `kY`, the open flags a plain read uses [60484,60570) 86 units sha256 aaeb606584d8f7963880f178f6bd1cd15142906dcc6a66a131fc4b572cab9943
function kY(){return S.constants.O_RDONLY|S.constants.O_NONBLOCK|S.constants.O_NOCTTY}

// chunk-gyf58rwf.js declares `Vy`, the fs facade the whole bundle reads through: the sync and async stat/lstat/read/open family, the directory walk, and the error texts each one writes [77042,80312) 3270 units sha256 4418be1c93b0c56a3a0d698844d25c001254ccc496c97849b864d652c8247bb1
var Vy={cwd(){return process.cwd()},existsSync(e){using n=ih`fs.existsSync(${e})`;return S.existsSync(e)},async stat(e){return $n(e)},async lstat(e){return kt(e)},async openDirNoFollow(e){await(await Q(e,S.constants.O_DIRECTORY|S.constants.O_NOFOLLOW)).close()},openDirNoFollowSync(e){let n=S.openSync(e,S.constants.O_DIRECTORY|S.constants.O_NOFOLLOW);S.closeSync(n)},async lstatBigint(e){return kt(e,{bigint:!0})},async statBigint(e){return $n(e,{bigint:!0})},async readdir(e){return ii(e,{withFileTypes:!0})},async unlink(e){return gi(e)},async rmdir(e){return li(e)},async rm(e,n){return ci(e,n)},async mkdir(e,n){try{await si(e,{recursive:!0,...n})}catch(r){if(E(r)!=="EEXIST")throw r}},async readFile(e,n){return Nn(e,{encoding:n.encoding})},async rename(e,n){return ui(e,n)},async realpath(e){return On(await ai(e))},async readlink(e){return oi(e)},async copyFile(e,n){return ni(e,n)},async appendFile(e,n,r){if(r?.mode!==void 0)try{let s=await Q(e,"ax",r.mode);try{await s.appendFile(n)}finally{await s.close()}return}catch(s){if(E(s)!=="EEXIST")throw s}return qs(e,n)},async symlink(e,n,r){return fi(e,n,r)},async link(e,n){return ri(e,n)},async chmod(e,n){return ei(e,n)},statSync(e){using n=ih`fs.statSync(${e})`;return S.statSync(e)},lstatSync(e){using n=ih`fs.lstatSync(${e})`;return S.lstatSync(e)},readFileSync(e,n){using r=ih`fs.readFileSync(${e})`;return S.readFileSync(e,{encoding:n.encoding})},readSync(e,n){using r=ih`fs.readSync(${e}, ${n.length} bytes)`;let s=void 0;try{s=S.openSync(e,"r");let i=[],o=0;while(o<n.length){let u=Buffer.allocUnsafe(Math.min(65536,n.length-o)),l=S.readSync(s,u,0,u.length,o);if(l===0)break;i.push(u.subarray(0,l)),o+=l}return{buffer:Buffer.concat(i,o),bytesRead:o}}finally{if(s!==void 0)S.closeSync(s)}},appendFileSync(e,n,r){using s=ih`fs.appendFileSync(${e}, ${n.length} chars)`;if(r?.mode!==void 0)try{let i=S.openSync(e,"ax",r.mode);try{S.appendFileSync(i,n)}finally{S.closeSync(i)}return}catch(i){if(E(i)!=="EEXIST")throw i}S.appendFileSync(e,n)},unlinkSync(e){using n=ih`fs.unlinkSync(${e})`;S.unlinkSync(e)},renameSync(e,n){using r=ih`fs.renameSync(${e} ${pi} ${n})`;S.renameSync(e,n)},readlinkSync(e){using n=ih`fs.readlinkSync(${e})`;return S.readlinkSync(e)},realpathSync(e){using n=ih`fs.realpathSync(${e})`;return On(S.realpathSync(e))},mkdirSync(e,n){using r=ih`fs.mkdirSync(${e})`;let s={recursive:!0};if(n?.mode!==void 0)s.mode=n.mode;try{S.mkdirSync(e,s)}catch(i){if(E(i)!=="EEXIST")throw i}},readdirSync(e){using n=ih`fs.readdirSync(${e})`;return S.readdirSync(e,{withFileTypes:!0})},rmSync(e,n){using r=ih`fs.rmSync(${e})`;S.rmSync(e,n)},createWriteStream(e){return S.createWriteStream(e)},async readFileBytes(e,n){if(n===void 0)return Nn(e);let r=await Q(e,kY());try{if(!(await r.stat()).isFile())return Buffer.alloc(0);return await ID(r,n,"file")}finally{await r.close()}},async readFileFdGated(e,n){try{let r=hi();if(r===0){if(!(await kt(e)).isFile())return null}let s=await Q(e,S.constants.O_RDONLY|r);try{let i=await s.stat();if(!i.isFile()||i.size>n)return null;let o=Number(i.size),a=Buffer.allocUnsafe(o),u=0;while(u<o){let{bytesRead:l}=await s.read(a,u,o-u,u);if(l===0)break;u+=l}return{content:(u<o?a.subarray(0,u):a).toString("utf8"),stats:i}}finally{await s.close()}}catch{return null}}};

// chunk-gyf58rwf.js declares `ie`, the facade accessor [80312,80336) 24 units sha256 7760f98bc6a6dacc483cb8443cf93309744cdeab3bd6c551950c97dfd879e63f
function ie(){return Vy}

// chunk-gyf58rwf.js declares `ID`, the bounded read the facade's byte reads go through [80736,81001) 265 units sha256 e7146358ec5b918ea27922d588c8199b4c49f675e3d63afe2c9d7d32cf26ad04
async function ID(e,n,r){let s=r!==void 0?r==="file":(await e.stat()).isFile(),i=[],o=0;while(o<n){let a=Buffer.allocUnsafe(Math.min(65536,n-o)),{bytesRead:u}=await e.read(a,0,a.length,s?o:null);if(u===0)break;i.push(a.subarray(0,u)),o+=u}return Buffer.concat(i,o)}

// chunk-4bw62nzm.js declares `an`, the no-project-directory error's name [52926,52959) 33 units sha256 e3dea4501c64137fefce9d210e455ea643a453fdb8fef291e4855580f0caa97f
var an="NoProjectDirectoryError";

// chunk-4bw62nzm.js declares `GP`, the no-project-directory error the project and local resolutions throw [52959,53053) 94 units sha256 42066d9d15b37d9a482c3b2ddaba3ff5407ead8c341277c2389b8a6f3e09f0c2
class GP extends Error{name=an;constructor(){super("This session has no working directory.")}}

// chunk-nqc6v990.js declares `o`, the configuration directory override the `.claude` path is built from [2485,2535) 50 units sha256 56028277f60f6e94969f1d7daab62c615fc9e3e06265c7a3dd2b3b51b5a823d9
function o(){return process.env.CLAUDE_CONFIG_DIR}

// chunk-nqc6v990.js declares `be`, the `.claude` directory: the override or the home directory's, normalized to NFC, remembered after the first read [2704,2762) 58 units sha256 a278f105aa10d19970e98fb6c10b2044e1794a272a2b3a270f54d07fd2277b19
var be=po(()=>(o()??u(R(),".claude")).normalize("NFC"),o);

// chunk-ae84tp6z.js declares `lA`, the realpath cache the home-directory read goes through [14875,15025) 150 units sha256 2cc266b2e773a747761ea086d3848b906b135b6cabcca1a9639fc714acfeaee2
function lA(t){if(t.startsWith("\\\\?\\UNC\\"))return"\\\\"+t.slice(8);if(t.startsWith("\\\\?\\")&&t.length>=7&&t[5]===":")return t.slice(4);return t}

// chunk-ae84tp6z.js declares `Hp`, the realpath of a path, answering null instead of throwing [15548,15610) 62 units sha256 52256777c03afba6339fecd63de41141892ea32dfa904c0d6f6cfb2c25062500
function Hp(t){try{return lA(ot.native(t))}catch{return null}}

// chunk-ae84tp6z.js declares `On`, the NFC normalization every path comparison goes through [7395,7436) 41 units sha256 fce11281169388623aca1324f3dc87f2e80b286ecb465abcb5398ad79bfbb34d
function On(t){return t.normalize("NFC")}

// chunk-3cynezh1.js declares `vse`, the local settings path: the session cwd's local file, or nothing when the cwd is absent, when the cwd *is* the canonical git root, or when the project config directory is set (W45-55) [401294,401454) 160 units sha256 1c2dbfe11a2f1ee85de349c36339af6bbbd785f42465b77751c6edbfbc584c57
function vse(e){if(e.cwd===null||RN(e.cwd,e.canonicalGitRoot)===fe(e.cwd))return;if(e.projectConfigDir!==void 0)return;return Se(fe(e.cwd),TO("localSettings"))}


export { vd, Ad, eC, My, Oko, m_, Ynn, FWn, RN, pTr, Q$s, b_, E_, Z$s, fTr, w_, UE, k_, GW, TO, Xs, Qs, ih, pi, hi, kY, Vy, ie, ID, an, GP, o, be, lA, Hp, On, vse };
