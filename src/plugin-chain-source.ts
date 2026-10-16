// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
//   chunk-kd3dbbtb.js sha256 876ff996096e91580e480add134de1189e9423074098c3907d856595e774fbd4
//   chunk-886tf6ja.js sha256 593e2ed1380725f871cb3ad6b60ab6fb270bd985462dd6ee3bf5128e003fd30b
//   chunk-6q0v3ahc.js sha256 9f2fe4d5c1888abaf3ea717fdb9958f6aa762a5379409a41915ce6c8daf5bddc
//   chunk-ed7zyzrn.js sha256 4754249b16c2900a23735b1a90afb10583cde0e9c816f3d46b2c13c33fbfc2c7
//   chunk-ax7r0qj7.js sha256 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e
//   chunk-3qabb19b.js sha256 ceb8c8490f39408310286cc14cacb1998192c8c34a80724882f988431f1bf5f2
//   chunk-ae84tp6z.js sha256 901937cc8e68c765b7dddc4875578a6b1759f5e9a2535bee85829bea8ace200f
//   chunk-c9vsmdqj.js sha256 59124c8f7d581be40e14655f028069ec67ba561a3395db94c65ede3aee264fb5
//   chunk-m4qpskd4.js sha256 730cbd0e42d685bf16a3b53c020b479670597d6bef6db2ab594049eea3e782ae
//   chunk-yjc18bey.js sha256 e53a75c48188dd5f345841ef87e452840622f9d61bc86e97b2edea656866a687
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { isProxy as xo } from 'util/types';
import { au,kn,Nl,glt,MFs,Wde,it,rQt,zd,yyt,$be,mlt,kyt } from './plugin-chain-host.js';
import { TDe } from './plugin-chain-host-call-source.js';
import { resolve as tc } from 'node:path';

// chunk-nyce03br.js regex class fragments [5183,5322) 139 units sha256 dbe457500ba22284083654cd48ff2f9335a5efcc1ffd6ad0b9023c646832aef4
var b3={escape:String.raw`\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f`,placeholder:String.raw`\u{10eeee}`,loneSurrogate:String.raw`\ud800-\udfff`};

// chunk-nyce03br.js log text-size ceiling [25619,25632) 13 units sha256 1edaf2810640a5c75a1cc35c949a07384014926ef7e3608161f9e27a6c5ea650
var uo=32000;

// chunk-kd3dbbtb.js hooks error [661,807) 146 units sha256 96779a7f7c6cd42b9abbeb8e2cab00ef88193402204dbe1cf76005910f444318
class He extends Error{name="HooksError";telemetryMessage="function hooks error (message not reported: it may contain plugin details)";thrownName}

// chunk-kd3dbbtb.js error cause text [807,905) 98 units sha256 7b703136febba03c4ca263d53c3ac32fe1c8b818e88ebadb53c64848ff00d419
function fho(r){if(!(r instanceof Error))return;let o=r.cause;return typeof o==="string"?o:void 0}

// chunk-kd3dbbtb.js settled-call abort error [905,927) 22 units sha256 6a19808f807ea589bc873efb29d0e02e1948e463475559d196ce205d6e8814cd
class Gde extends He{}

// chunk-kd3dbbtb.js error chooser [927,970) 43 units sha256 25b17504987e4425d201101ad847e51077a334a2ac3f076b3b189dabfd5316a8
var mho=(r,o)=>o===!0?new Gde(r):new He(r);

// chunk-kd3dbbtb.js abort reason text [970,1073) 103 units sha256 020e3f6958fcc5988e40c7d48eef24bcccef373451856fdd6366ab56b843b4f3
function wlt(r,o="aborted"){let{reason:e}=r;return e instanceof Error?e.message:e===void 0?o:String(e)}

// chunk-kd3dbbtb.js plain-data message [1073,1123) 50 units sha256 ef47f9639dc2c7cd158cb17fe5657578b71ab561748032c3181b2594c5c9bbdb
var GFs=(r)=>`the answer is not plain data: ${r}`;

// chunk-kd3dbbtb.js next() argument guard [1123,1268) 145 units sha256 0ed45f249a95a1a7bb8b2a0f03350b94c04a680ddbd1ca5fec8ed10d493fac44
function cUn(r,o){if(!L(r))throw new He(`${o}: next() takes the event's argument: next(e) passes it on, next({ ...e, x }) rewrites it`);return r}

// chunk-kd3dbbtb.js abort-signal duck check [1268,1411) 143 units sha256 b77637948ab0ae0ef8791ba3bbb3852bb6d0ec31741fec2cc0e37a17452e7edb
var cEs=(r)=>typeof r==="object"&&r!==null&&("aborted"in r)&&typeof r.addEventListener==="function"&&typeof r.removeEventListener==="function";

// chunk-kd3dbbtb.js plain-data message (argument) [1411,1466) 55 units sha256 f6ce8d5c0f24d6ed382322a732193e26a448d0dc9654f5fe60aa2568d8272760
var dUn=(r)=>`next() argument is not plain data: ${r}`;

// chunk-kd3dbbtb.js plain-data message (arguments) [1466,1524) 58 units sha256 4c832403408bee5cabe4b3270b5197aebefe88d8f3bda2e1adcbf634b2796a4c
var xwr=(r,o)=>`${r}: arguments are not plain data: ${o}`;

// chunk-kd3dbbtb.js settled-call abort test [1524,1561) 37 units sha256 07084c891285d4a7912539af71aed0aeac4b494d71bdd73aa0a8552592562cfd
var dEs=(r)=>r.reason instanceof Gde;

// chunk-kd3dbbtb.js settled abort -> hooks error [1616,1666) 50 units sha256 24c2c68567478d835cfe970fdb3c5ead346912dbf22cfc28883222186720490c
var zFs=(r)=>r instanceof Gde?new He(r.message):r;

// chunk-886tf6ja.js abort error class [2908,2979) 71 units sha256 c6063004ac4ba58972524fbc48da370ec336b5fde4c10076f4a44c022ae17524
class Ye extends Error{constructor(n){super(n);this.name="AbortError"}}

// chunk-886tf6ja.js abort classification [3000,3163) 163 units sha256 4929aa4bf41477d215f8daebaadbf2b3fb764604a09006e9ba5f70ed062e181a
function Ke(n){try{return n instanceof Ye||n instanceof au||n instanceof Error&&(n.name==="AbortError"||("__CANCEL__"in n)&&Boolean(n.__CANCEL__))}catch{return!1}}

// chunk-886tf6ja.js error text [4754,4814) 60 units sha256 2f921ed78ffeed39032d7e9c4783e05c294cba2ce61cc5ac20466ece27a81075
function l(n){return n instanceof Error?n.message:String(n)}

// chunk-886tf6ja.js error kind name [5545,5647) 102 units sha256 28179a99ca4e8f79f37f09c1ef3718e34306a3ff2c2376e62163c095da85ff14
function lh(n){let e=n?.name;return typeof e==="string"&&/^[A-Z][a-zA-Z]{0,63}$/.test(e)?kn(e):void 0}

// chunk-6q0v3ahc.js plain object check [615,685) 70 units sha256 6b15874e28dd4114e956d748abc4d2d737a50907ee95cb2982bdcae8d5a4ab56
function L(n){return typeof n==="object"&&n!==null&&!Array.isArray(n)}

// chunk-ed7zyzrn.js plain-data object check [2456,2577) 121 units sha256 cd79ddf77ec91a06a36793304d8b13e8c8218b869034a1a720b15e0e21070d24
function $A(o){if(!L(o))return!1;let t=Object.getPrototypeOf(o);return t===null||!xo(t)&&Object.getPrototypeOf(t)===null}

// chunk-ax7r0qj7.js truncate without splitting a pair [1128,1272) 144 units sha256 8342442e1da2530ab21d0582e8743df3285b005a06d2ba016d50bd10383cf592
function ne(t,n){if(n<=0)return"";if(t.length<=n)return t;let e=t.slice(0,n),r=e.charCodeAt(n-1);return WMt(r>=55296&&r<=56319?e.slice(0,-1):e)}

// chunk-ax7r0qj7.js utf16le round trip [1544,1645) 101 units sha256 d44450990e1124be6605b8f3519ad03c0f677f0e5c1a7fe63b667b075b337a78
function WMt(t){if(typeof Buffer<"u")return Buffer.from(t,"utf16le").toString("utf16le");return x(t)}

// chunk-3qabb19b.js dedupe [883,919) 36 units sha256 e08913e4ba564b11551e01e87af4d4ba5f0fde1d9cce2dc2407afcc87d3df2bb
function D(n){return[...new Set(n)]}

// chunk-ae84tp6z.js memo passthrough (identity in this build) [5355,5381) 26 units sha256 19b806bd3a5d4fe86648ae7621ec8e85d8be7064bd1d0fa8af9c627de5f30f90
function Ge(t,e){return t}

// chunk-c9vsmdqj.js single-slot holder [615,668) 53 units sha256 2ad3005c8632df99918a325c2432212c9a8d159137a3e9b8ad521d4224c17aae
function bs(){let t;return{set:(e)=>{t=e},get:()=>t}}

// chunk-m4qpskd4.js tier continuations [48358,48457) 99 units sha256 9836be35fb7b7b26a1905d6741534051ef316cef6979472a07d8b8c1a45f4a2f
var aIt=(e)=>({prepend:["append","builtin","core"],user:[],append:["core"],builtin:[],core:[]})[e];

// chunk-m4qpskd4.js tier named by next.to [48457,48497) 40 units sha256 834f2927c5e88560a83839927c218ef80d0174f644897e20824f40c88c25d929
var kwr=(e)=>aIt("prepend").includes(e);

// chunk-m4qpskd4.js next.to record [48526,48644) 118 units sha256 02005cdbc9a66ecd8592409e5c09fc0f95e3e8f4145e3ea7f151dd64b130290e
function DFs(e,o){return Object.freeze([...e,Object.freeze({...o,to:e.reduce((r,t)=>glt(t.to)>glt(r)?t.to:r,o.to)})])}

// chunk-m4qpskd4.js default floors [48672,48698) 26 units sha256 bf48bfc1853649bd0201dbfb88ed07055d28a9340b9859b4fceae132a84b5ab3
var hlt=Object.freeze([]);

// chunk-nyce03br.js chain answer-shape table [14076,15227) 1151 units sha256 7ec85969bf3d4ef58c50ce89dcd96a5f15b6cd1546ffd54634365a48e1e2ac2b
var ar={"tool.call":"{ deny }","tool.check":"{ decision }","tool.describe":void 0,"agent.offer":"{ isOffered: false }","agent.spawn":"{ deny }","prompt.submit":"{ drop }","prompt.mention":"{ deny }","prompt.fill":void 0,"prompt.suggest":void 0,"prompt.edit":void 0,"prompt.autocomplete":void 0,"prompt.section":void 0,"prompt.context":void 0,"prompt.attachment":void 0,"prompt.compose":void 0,"command.run":"an answer without next","command.describe":void 0,"config.set":"{ deny }","config.describe":void 0,"telemetry.log":"{ deny }","telemetry.mark":"{ deny }","skill.prompt":void 0,"attribution.text":void 0,"plugin.register":"{ refuse }","session.start":void 0,"session.receive":"{ consumed }","session.append":"{ deny }","session.send":"{ isDelivered: false }","session.compact":"{ skip }","session.attach":void 0,"session.detach":void 0,"session.measure":void 0,"session.end":void 0,"turn.start":void 0,"turn.step":void 0,"turn.complete":void 0,"ui.render":void 0,"ui.resolve":void 0,"ui.press":void 0,"ui.input":void 0,"ui.select":void 0,"ui.message":void 0,"ui.fault":void 0,"ui.scroll":"{ deny }","ui.focus":"{ deny }","engine.create":void 0};

// chunk-nyce03br.js chain table [15227,15238) 11 units sha256 6b23d957525910e288ae948e7a87f4277a9df2715c636327d720ed02cd347690
var QPt=ar;

// chunk-nyce03br.js result check wrapper [15370,15444) 74 units sha256 d0fc4c96b0ee85c2121481fbf91246fc86c5260eb8ef7a9bc3869f1eb090eed7
var C=(e)=>(t,o,r)=>L(t)?e(t,o,r):"something that is not a result object";

// chunk-nyce03br.js deny/value check [15723,15903) 180 units sha256 6dacf72443dc6483c914024a2e4a55e9f3ad561ecf59d65f4502d3322ed9a987
function Me(e,t,o){if(e.deny===void 0)return o(e)?void 0:`neither ${t} nor { deny }`;return typeof e.deny==="string"?o(e)?`a deny beside ${t}`:void 0:"a deny that is not a string"}

// chunk-nyce03br.js restore missing fields [15903,16055) 152 units sha256 b044d3318f33755c8a5434797c48b8891b4acf28914168fbef67b87347e11198
function m$(e,t,o){let r=e.filter((s)=>!Object.hasOwn(t,s)&&Object.hasOwn(o,s));if(r.length===0)return t;let n={...t};for(let s of r)n[s]=o[s];return n}

// chunk-nyce03br.js origin key text [2031,2097) 66 units sha256 a52ea5f3f30720dc90471b1e173f9258de365253b33dab23695072234907df28
function er(e){try{return JSON.stringify(e,Us)}catch{return Ws()}}

// chunk-nyce03br.js measured text length [25321,25395) 74 units sha256 3b966ecf2c699de7f569f199308d397b72a2fd90539537b68ea59342a27d7d2b
function fe(e,...t){return typeof e==="string"&&!t.includes(e)?e.length:0}

// chunk-nyce03br.js whole offset check [38157,38216) 59 units sha256 b269e637c894e10f55a53c46d0a0382aabe7cade529bd8ad2cab1c0632fc6c01
var h$=(e)=>typeof e==="number"&&Number.isInteger(e)&&e>=0;

// chunk-nyce03br.js prompt.edit argument check [38216,38733) 517 units sha256 fc387409e72431034aa6716edfe9969d18a9bbbbef37c3fc6aa0bb3e4da005bb
function Yr(e,t){let{text:o,cursor:r,start:n,end:s,inputText:i}=e,p=er(e.origin)===er(t.origin),a=er(e.key)===er(t.key),f=typeof o==="string"&&typeof i==="string",m=typeof o==="string"?o.length:0,c=h$(r)&&h$(n)&&h$(s)&&r<=m&&n<=s&&s<=m;if(!p)return"a changed origin (the engine set it; next(e) passes it on)";if(!a)return"a changed key (what the person pressed; next(e) passes it on)";if(!f)return"no { text, inputText } (strings)";return c?void 0:"a { cursor, start, end } outside the text (whole offsets, ordered)"}

// chunk-nyce03br.js prompt.edit result check [38733,38865) 132 units sha256 4dfb3606fef9218785ed50f705303e7ff98e5de83044008ccc6875dba7543149
function Jr(e){return typeof e.text==="string"&&h$(e.cursor)?U3e(e.decorations):"no { text, cursor } (a string and a whole offset)"}

// chunk-nyce03br.js prompt.edit budget [40808,40818) 10 units sha256 6594c5219a76c4ea2ddf5b9bc02ef012aff47a50800f25b63dd29f4907cc5aad
var Ji=50;

// chunk-nyce03br.js prompt.edit site [40818,41072) 254 units sha256 aff45126a0d2bea6f2a233ce0dbea429eeb87c9506fbd0473b5f60e53f05eb8f
var qi={event:"prompt.edit",budgetMs:Ji,restoreArgument:(e,t)=>m$(["origin","key"],e,t),checkArgument:Yr,measureArgument:(e,t)=>Math.max(fe(e.text,t.text),fe(e.inputText,t.inputText)),check:C(Jr),measure:(e,t,o)=>fe(e.text,t.text,...o.map((r)=>r.text))};

// chunk-nyce03br.js allowed decoration values [2815,3407) 592 units sha256 1f9306940d8f4c087a2b5881cc060e31f9e3406b439b09831a7af1f4dd598b70
var xgo={flexDirection:new Set(["row","column","row-reverse","column-reverse"]),flexWrap:new Set(["nowrap","wrap","wrap-reverse"]),alignItems:new Set(["flex-start","center","flex-end","stretch"]),alignSelf:new Set(["flex-start","center","flex-end","auto"]),justifyContent:new Set(["flex-start","center","flex-end","space-between","space-around","space-evenly"]),overflow:new Set(["visible","hidden"]),display:new Set(["flex","none"]),position:new Set(["relative","absolute"]),wrap:new Set(["wrap","end","middle","truncate-end","truncate","truncate-middle","truncate-start"]),borderStyle:rQt};

// chunk-nyce03br.js decoration offset ceiling [4004,4016) 12 units sha256 c769da9c127ece8d8acf8916654dcc3f55408cf0e30a66401c629c586dad913b
var slt=1e4;

// chunk-nyce03br.js decoration size keys [4016,4075) 59 units sha256 f77d080c12223d2df6e8f5e889a5c971ad39b458ba2f907323e33e552f4b91b4
var oQt=new Set(["width","height","minWidth","minHeight"]);

// chunk-nyce03br.js decoration value check [4140,4987) 847 units sha256 c9451f390d607e159e066206a0081fe9166ae1b667ff5ab281d87346767e3c95
function sQt(e,t){let o=xgo[e];if(o!==void 0)return typeof t==="string"&&o.has(t)?void 0:`must be one of ${[...o].join(", ")}`;if(oQt.has(e)){if(typeof t==="number")return Number.isFinite(t)&&t>=0&&t<=slt?void 0:`must be a finite number between 0 and ${slt}`;return typeof t==="string"&&/^\d{1,3}%$/.test(t)?void 0:"must be a number or a percentage"}if(Rgo.has(e))return typeof t==="number"&&Number.isFinite(t)&&Math.abs(t)<=slt?void 0:`must be a finite number within ${slt}`;if(olt.has(e))return typeof t==="number"&&Number.isInteger(t)&&Math.abs(t)<=slt?void 0:`must be an integer within ${slt} (character cells)`;if(Cgo.has(e))return typeof t==="string"&&/^[#a-zA-Z0-9_().,% -]{1,40}$/.test(t)?void 0:"must be a color (a theme key, a name, or hex)";if(Ubr.has(e))return typeof t==="boolean"?void 0:"must be a boolean";return"has no value rule"}

// chunk-nyce03br.js run offset keys [27035,27058) 23 units sha256 2f741486ca964a4a084bac3ba28edff8df3850aa20098ccab5085b293a551373
var yo=["start","end"];

// chunk-nyce03br.js run style keys [27058,27149) 91 units sha256 b400f5f7ade95ff8e93d8aec10e8a75116060fc1b5a18ce1b859a05d3f1fd49e
var nQt=["color","backgroundColor","dimColor","bold","italic","underline","strikethrough"];

// chunk-nyce03br.js run keys [27149,27171) 22 units sha256 e6acb456960b54b3e62e6538550f91e37f11c1ccc31fe71e0c3993dce510a55d
var Cr=[...yo,...nQt];

// chunk-nyce03br.js scalar text [27171,27261) 90 units sha256 f6f49dad8d09bedf89aabb023dc61cd84b381ba2e61d2a5d37f2a4e16e449eb9
function fi(e){return typeof e==="string"||typeof e==="number"||typeof e==="boolean"?e:""}

// chunk-nyce03br.js decoration run check [27261,27661) 400 units sha256 02b12b4202fff800585525c667c4b06a8c6238c38f00031d1aaa9b84b474e90e
function ui(e){if(!L(e))return" must be an object with start and end";let o=Object.keys(e).find((n)=>!Cr.includes(n));if(o!==void 0)return`.${o} is not a decoration key (${Cr.join(", ")})`;let r=yo.find((n)=>!Number.isInteger(e[n]));if(r!==void 0)return`.${r} must be an integer (a UTF-16 offset)`;for(let n of nQt){let s=e[n],p=s===void 0?void 0:sQt(n,fi(s));if(p!==void 0)return`.${n} ${p}`}return}

// chunk-nyce03br.js sorted-key stringify replacer [1781,1944) 163 units sha256 3ebbaa2f6ef29ae810378482c729549e34f1ca3fbb9dfac3fdbc21482d7b1f3e
function Us(e,t){if(L(t)){let o=Object.create(null);for(let r of Object.keys(t).toSorted())Object.defineProperty(o,r,{value:t[r],enumerable:!0});return o}return t}

// chunk-nyce03br.js unserializable prefix [1944,1973) 29 units sha256 bbad3f66739a3fbee21ed7ff580d477b4e821a4b413551fa421e5204c61883da
var Bs="\x00unserializable:";

// chunk-nyce03br.js unserializable counter [1973,2019) 46 units sha256 174666be394562a2c64bc719c62f0e0f290562ddf9c546266cb84cdde1729536
function Ks(){let e=0;return()=>`${Bs}${++e}`}

// chunk-nyce03br.js unserializable fallback [2019,2031) 12 units sha256 8e5e2523522c35594723ca2ca14988fbca2cce87c8ed4136602c9521c06bfe7b
var Ws=Ks();

// chunk-nyce03br.js list length ceiling [6340,6358) 18 units sha256 d431d6dce13da18ff3c639d4be4ff4cf1a8a69ac6c614d1716da1912e22d46e5
var Vs=4294967295;

// chunk-nyce03br.js plugin list length guard [6358,6591) 233 units sha256 40ad04b21693ce422b7dcd93dcf5be7cc2f82f29a53bd7da03abd35e7af6a674
function B(e){let t=e.length,r=typeof t!=="bigint"&&typeof t!=="symbol"?Math.max(Math.trunc(Number(t))||0,0):void 0;if(r===void 0||r>Vs)throw new He(`a plugin's list claims a length no list has (got ${r??`a ${typeof t}`})`);return r}

// chunk-nyce03br.js decoration runs check [27661,27882) 221 units sha256 c4a0adcea96e4537c4dd5b7fe510c1a4a8682d0b0efa6e7459ba23b7f88d3686
function U3e(e){if(e===void 0)return;if(!Array.isArray(e))return"decorations must be an array of { start, end } runs";let o=e,r=B(o);for(let n=0;n<r;n+=1){let s=ui(o[n]);if(s!==void 0)return`decorations[${n}]${s}`}return}

// chunk-nyce03br.js edge keys [2766,2815) 49 units sha256 88c3633b9085741880764e6c932d63e4dc0369805da6d3dbf2f02d0b4d4d4b8b
var olt=new Set(["top","left","right","bottom"]);

// chunk-nyce03br.js layout number keys [2523,2766) 243 units sha256 12be15916a43b5c90b11a3e9217e450fecb852315a1620a38434945ab8e0ede7
var Rgo=new Set(["flexGrow","flexShrink","gap","columnGap","rowGap","margin","marginX","marginY","marginTop","marginBottom","marginLeft","marginRight","padding","paddingX","paddingY","paddingTop","paddingBottom","paddingLeft","paddingRight"]);

// chunk-nyce03br.js text style keys [2097,2198) 101 units sha256 6d7c18b0bdbb874beab776c3caede62dfa1a5e654a0fe1d17f9a25b058db0673
var Ubr=new Set(["dimColor","bold","italic","underline","strikethrough","inverse","borderDimColor"]);

// chunk-nyce03br.js color keys [2229,2288) 59 units sha256 f05697c87d1ddfed3dabb1ca511ba365ed82e22d3c41779971414bd73d37755b
var Cgo=new Set(["color","backgroundColor","borderColor"]);

// chunk-nyce03br.js restore-argument builder [16055,16084) 29 units sha256 65552a897ea609897a7e512b9b87d4bef0a934d4fdb647e2ae7131c75f1e94ff
var we=(e)=>(t,o)=>m$(e,t,o);

// chunk-nyce03br.js chain region [111504,128400) 16896 units sha256 8434c3e4b94fbbdd72781af1fcc887190634720bfcc948e589038b4dd266ed1c
var a8="engine";var CFe=Object.freeze({plugin:a8,tier:"core"});function G$n(e){let{error:t}=e;if(t===void 0)return;return{error:t,called:e.called===!0}}var AFs="client";var Dws=Object.freeze([]);function z_(e){for(let t of Object.values(e))if(typeof t==="function")Object.setPrototypeOf(t,null);return Object.setPrototypeOf(e,null),Object.freeze(e)}function sO(e){return Object.setPrototypeOf(e,null),e}var ss=(e)=>sO((t,o)=>Wde(t,e));var is=Object.freeze({ms:0,remainingMs:Number.POSITIVE_INFINITY});function vSe(e){let{call:t,signal:o,event:r,origin:n}=e,s=sO(t);if(s.to=sO(e.to),s.signal=o,s.is=e.is,s.event=r,s.origin=n,e.caught!==void 0)Object.assign(s,e.caught);return Object.defineProperty(s,"trace",{get:sO(e.trace),enumerable:!0}),Object.defineProperty(s,"budget",{get:sO(e.budget??(()=>is)),enumerable:!0}),Object.freeze(s)}var rwr=(e)=>vSe(e);var Lgo=(e,t,o)=>t.to(e,...o);var clt=(e,t,o)=>t.to(e,...o);var uQt=(e)=>({signal:e.signal,is:e.is,event:e.event,origin:e.origin,trace:()=>e.trace,budget:()=>e.budget,caught:G$n(e)});var Lws=(e,t)=>({error:Object.freeze({kind:"re-entry",budget:e,...t!==void 0&&{cause:t}}),called:!1});var y$=new RegExp(`[${String.raw`\t\n\r`}${b3.escape}${b3.loneSurrogate}${b3.placeholder}]`,"gu");function eRe(e,t){try{return t.aborted&&(Ke(e)||l(e)===wlt(t))}catch{return!1}}function RFe(){let e=[];return{keep:(t,o)=>e.push({input:t,made:o}),of:(t)=>t===void 0?void 0:e[t-1],last:(t)=>t===void 0?e.at(-1):e.findLast(t),ran:()=>e.length>0}}var ae=(e)=>e.isCore===!0||e.isManaged===!0;var Gt=()=>({entry:void 0,beneath:void 0});function lt(e,t){e.entry=Object.freeze(t)}function jo(e){let t=[];for(let o=e;o!==void 0;o=o.beneath)if(o.entry!==void 0)t.push(o.entry);return t.length===0?Dws:Object.freeze(t)}var mg=({bottom:e,index:t,event:o})=>async(r,n,{run:s,floors:i})=>{let p=performance.now(),a="rejected",f;try{return f=await e(r,n,i),a="returned",f}finally{lt(s,{index:t,plugin:a8,tier:"core",event:o,outcome:a,ms:performance.now()-p,received:r,returned:f})}};function ps({handler:e,tier:t,index:o,site:r,e:n,descent:s}){let{run:i,floors:p}=s;if(p.length===0||ae(e))return;let m=(e.isHop===!0?e.tiers??[]:[t]).map((x)=>MFs(p,x)),g=m.length>0&&m.every((x)=>x!==void 0)?m[0]:void 0;if(g===void 0)return;let y=`bypassed by ${g}`;Nl().log(`${e.name}: ${r.event} ${y} (tier ${t}); beneath runs`),lt(i,{index:o,plugin:e.name,tier:t,event:r.event,outcome:"skipped",reason:y,ms:0,received:n,returned:void 0});let u=Gt();return i.beneath=u,{run:u,floors:p}}import{isProxy as lg}from"util/types";function fs(e){if(!lg(e))Object.freeze(e);return e}function We(e){let t=e.isCore===!0,o=t?"core":"prepend";return t||e.isManaged===!0?o:e.tier??"user"}var Fo=1e4;var yt=Ge(new Map,(e)=>{for(let t of e.values())clearTimeout(t.timer);e.clear()});var l8=1000;function Ya(e,t){let o=yt.get(e);if(yt.delete(e),o!==void 0&&o.count>0)Nl().log(`${t} ${o.count} more times in the last ${Fo/l8}s (the last in ${o.lastMs.toFixed(1)}ms)`)}function Ja(e){let{plugin:t,tier:o,event:r,ms:n}=e,s=`${r} ${t}`,i=yt.get(s),p=`${t} (${o}) answered ${r} without next()`;if(i!==void 0){i.count+=1,i.lastMs=n;return}Nl().log(`${p} in ${n.toFixed(1)}ms; nothing beneath it ran for this dispatch`);let a=setTimeout(Ya,Fo,s,p);a.unref(),yt.set(s,{count:0,lastMs:n,timer:a})}var TFe=5000;import{AsyncLocalStorage as Sg}from"async_hooks";var Ve=new Sg;async function Ngo(e){let t=Ve.getStore();if(t===void 0)return e();t.pause();try{return await e()}finally{t.resume()}}var z3e=1000;var qa=(e)=>e;function Qa(e,t){if(--e.pendingDownstream>0)return;if(e.beneathMs+=performance.now()-e.beneathSince,!e.settled)t.resume()}function Lo(e,t=new Map){if(typeof e!=="object"||e===null)return e;let o=t.get(e);if(o!==void 0)return o;if(Array.isArray(e)){let n=[];t.set(e,n);for(let s of e)n.push(Lo(s,t));return n}if(!$A(e))return e;let r={};t.set(e,r);for(let n of Object.keys(e))Object.defineProperty(r,n,{value:Lo(e[n],t),enumerable:!0,writable:!0,configurable:!0});return r}var $o=(e)=>(t,o,r)=>Nl().hookFailed({plugin:t.name,environmentId:t.environmentId,event:o,reason:`${t.name}: ${r}`,effect:e,hasOverrun:!1,skip:{kind:"unapplied",why:r}});var Za=$o("the rest of its rewrite went on");function V3e(e,t,o){if(o!==void 0&&o>uo)Nl().log(`${e}: wrote a text of ${o} characters (${t}; over ${uo}, accepted: a plugin's text is its own to size)`)}function gt({handler:e,site:t,e:o},r){let n=cUn(r,e.name),s=!ae(e)&&(t.checkArgument!==void 0||t.restoreArgument!==void 0),p=s&&!Object.is(n,o)?Lo(n):n,a=s&&e.isHop!==!0,f=s?t.restoreArgument?.(p,o)??p:p,m=s?t.checkArgument?.(f,o):void 0;if(m!==void 0)throw new He(`${e.name}: next() passed an argument with ${m}`);let c=a?t.unappliedArgument?.(p,o):void 0;if(c!==void 0)Za(e,t.event,c);if(a)V3e(e.name,t.event,t.measureArgument?.(f,o));return qa(f)}function us(e,t,o){if(t.length===0)throw new He(`${o.plugin}: next.to() names no tier`);let r=aIt(o.tier);return t.toReversed().reduce((n,s)=>{if(!kwr(s))throw new He(`${o.plugin}: next.to names "${String(s)}", which is not a tier a dispatch continues at (append, builtin, core)`);if(r.length===0)throw new He(`${o.plugin}: next.to is available to managed plugins (prependPlugins / appendPlugins) only, not to a ${o.tier} hook`);if(!r.includes(s))throw new He(`${o.plugin}: next.to("${s}") skips nothing from ${o.tier}; a ${o.tier} hook may continue at `+aIt(o.tier).join(", "));return DFs(n,{from:o.tier,to:s,plugin:o.plugin})},e)}function Do(e){return e>=l8&&e%l8===0?`${e/l8}s`:`${e}ms`}var ep="failed closed: its .catch answered";function ze(e){let t=e instanceof He&&e.thrownName!==void 0?{name:e.thrownName}:e;return`errorKind=${e instanceof Error?lh(t)??"Error":"unknown"} errorChars=${String(l(e)).length}`}function tp(e,t,o){return`hook failed closed: ${e}: ${ze(t)} (${o}; its .catch answered)`}function op(e,t,o){return`hook failed: ${e}: ${ze(t)} (${o})`}var xt=(e,t)=>t.startsWith(`${e.name}: `)?t:`${e.name}: ${t}`;var Uo="left out; the call was interrupted, so the dispatch rejects";function cs(e){return Nl().log(`hooks module ${e}: next() after it settled; refused`,"warn"),new He(`${e}: next() after it settled`)}var Kg="left mid-stream; what it yielded stands, the rest came from beneath it";var ds="...";var ls=120;function zt(e){let t=(e.split(/\r?\n/u)[0]??"").replace(y$," ").trim();return t.length<=ls?t:ne(t,ls-ds.length)+ds}function Bo(e){try{if(!(e instanceof Error))return zt(String(e));let o=e instanceof He?e.thrownName:e.name,r=o===void 0?"":`${o}: `;return zt(`${r}${e.message}`)}catch{return"a value with no text"}}function rp(e,t){let{expiredMs:o,lingeredMs:r,shape:n,caught:s}=t,i=s===void 0?"":`; ${s}`;if(o!==void 0)return{kind:"budget",why:`ran past its ${Do(o)} budget${i}`};if(r!==void 0)return{kind:"lingered",why:`did not stop within ${Do(r)} of the turn being interrupted`};return n!==void 0?{kind:"shape",why:`returned the wrong shape (${zt(n)})`}:{kind:"threw",why:`threw ${Bo(e)}${i}`}}function np({error:e,handler:t,site:o,effect:r,cause:n}){let s=xt(t,l(e));if(Nl().log(op(t.name,e,`${o.event}; ${r}`),"error"),!ae(t)){let i=t.isHop===!0,p=r===Uo;Nl().hookFailed({plugin:t.name,environmentId:t.environmentId,event:o.event,reason:s,effect:r,hasOverrun:!1,skip:i?void 0:{...rp(e,n),...p&&{isCallRejected:p}}})}return s}var sp=$o("its answer stands");var ip="skipped; what is below it ran in its place";var ap="skipped; its last next() run's result stands";function ys(e,t,o){let r=!1,n=()=>{r=!0};e.then(n,n);let s=pp.get()?.lingerMs??TFe;setTimeout(()=>{if(r||ae(t))return;let p=xt(t,`still running ${s}ms after its budget ran out; ignores its signal`);Nl().log(`hook overran: ${p} (${o.event})`,"error"),Nl().hookFailed({plugin:t.name,event:o.event,reason:p,effect:"counted toward a runaway",hasOverrun:!0})},s).unref?.()}function CE(e,t){if(e===void 0)return()=>{};if(e.aborted)return t.abort(e.reason),()=>{};let o=()=>t.abort(e.reason);return e.addEventListener("abort",o,{once:!0}),()=>e.removeEventListener("abort",o)}function ex({handler:e,below:t,site:o,e:r,budget:n,downstreamSignal:s,state:i,run:p,floors:a,tier:f}){async function m(y,u,x=a){let h=o.raiseArgument?.(y)??y;if(i.pendingDownstream++===0)n.pause(),i.beneathSince=performance.now();let d=new AbortController,w=CE(s,d),T=CE(u,d),A=Gt();if(!s.aborted)p.beneath=A;let E=t(h,d.signal,{run:A,floors:x}).then((R)=>{let N=o.carry===void 0?R:o.carry(R,h,r);return i.belowRejected=void 0,i.fromBelow=[...i.fromBelow,N],N},(R)=>{throw i.belowRejected={error:R},R});i.inFlight=E;try{return await E}finally{w(),T(),Qa(i,n)}}function c(y){let u=gt({handler:e,site:o,e:r},y);if(i.settled)throw cs(e.name);return u}let g=(y)=>us(a,y,{plugin:e.name,tier:f});return{runBelow:m,call:async(y,u,x)=>m(c(y),u,x),to:async(y,u)=>m(c(y),void 0,g(u)),replay:async(y,u,x)=>i.inFlight??m(gt({handler:e,site:o,e:r},y),u,x),replayTo:async(y,u)=>i.inFlight??m(gt({handler:e,site:o,e:r},y),void 0,g(u))}}var Fgo=(e)=>Promise.reject(new He(`no implementation for ${e.event}`));var fp=(e,t)=>CE(e,{abort:(o)=>t.abort(zFs(o))});var mp=(e,t)=>({name:t.map((o)=>o.name).join("+"),tier:t[0]?.tier,tiers:D(t.map(We)),...t.at(-1)?.answersForEngine&&{answersForEngine:!0},budgetMs:0,isHop:!0,run:(o,r,{call:n,floors:s,cutAt:i})=>e.run({members:t,e:o,call:n,signal:r.signal,origin:r.origin,floors:s,cutAt:i})});var up=(e)=>e.reduce((t,o)=>{let r=t.at(-1);return o.hop!==void 0&&r?.hop?.key===o.hop.key?[...t.slice(0,-1),{hop:r.hop,members:[...r.members,o]}]:[...t,{hop:o.hop,members:[o]}]},[]);var fx=(e)=>up(e).map((t)=>{let o=t.hop;return o===void 0?t.members[0]:mp(o,t.members)});var owr=Ge(bs(),(e)=>e.set(void 0));var swr=()=>owr.get();var sIt=()=>swr()!==void 0;async function aP({e,handlers:t,site:o,signal:r=new AbortController().signal,isHopFold:n,cutAt:s,budgetMs:i=o.budgetMs??pp.get()?.ms??kSe,bottom:p,origin:a=CFe,floors:f=hlt,trace:m}){let c=fx(t),g=mg({bottom:p??(()=>Fgo(o)),index:c.length,event:o.event}),y=Gt(),u=sIt(),x=new AbortController,h=n===!0?void 0:fp(r,x);return c.reduceRight((d,w,T)=>{let A=T===c.length-1;return dx({handler:w,index:T,below:d,site:o,budgetMs:i,cutAt:s,origin:a,nothingBelow:p===void 0&&A,answersForEngine:u&&A&&w.answersForEngine===!0})},g)(e,n===!0?r:x.signal,{run:y,floors:f}).then((d)=>(m?.(jo(y)),d)).catch((d)=>{if(!eRe(d,r))Nl().log(`hooks chain failed: ${ze(d)}`,"error");throw d}).finally(h)}var $go=(e,t,o={})=>aP({e,handlers:t,site:zd["classic.PreToolUse"],...o});function lp(e,t){let o=e,r=Date.now(),n,s=!1,i=!1,p=()=>{},a=xs(new Promise((g,y)=>{p=y}));function f(){s=!0,p(new He(t))}function m(){r=Date.now(),i=!0,n=setTimeout(f,o)}let c=()=>i?Math.max(0,o-(Date.now()-r)):o;return m(),{expired:a,isExpired:()=>s,remainingMs:()=>s?0:c(),pause(){clearTimeout(n),o=c(),i=!1},resume:m,clear:()=>clearTimeout(n),rearm(){if(s)return;if(o=e,clearTimeout(n),i)m()}}}function xs(e){return e.catch(()=>{}),e}function Xt(e,t,o){let r=()=>o===void 0?Number.POSITIVE_INFINITY:Math.max(0,o-Date.now()),n=Math.min(e<=0?Number.POSITIVE_INFINITY:e,r());if(e<=0)return{expired:void 0,isExpired:()=>!1,reading:()=>o===void 0?is:Object.freeze({ms:n,remainingMs:r()}),hasGraceExpired:()=>!1,pause(){},resume(){},clear(){},rearm(){}};let s=0,i=!1,p,a=lp(e,`exceeded ${e}ms budget`),f=Promise.withResolvers();function m(){if(p=lp(TFe,`did not settle within ${TFe}ms of its signal aborting`),s>0)p.pause();p.expired.catch(f.reject)}let c=CE(t,{abort:m});return{expired:xs(Promise.race([a.expired,f.promise])),isExpired:()=>a.isExpired(),reading:()=>Object.freeze({ms:n,remainingMs:Math.min(a.remainingMs(),r())}),hasGraceExpired:()=>p?.isExpired()??!1,pause(){if(s++===0)a.pause(),p?.pause()},resume(){if(--s===0&&!i)a.resume(),p?.resume()},clear(){i=!0,a.clear(),p?.clear(),c()},rearm(){if(!i)a.rearm()}}}var kSe=1e4;var pp=Ge(bs(),(e)=>e.set(void 0));var Ko=({call:e,to:t,signal:o,event:r,origin:n,run:s,budget:i,caught:p})=>vSe({call:e,to:(a,...f)=>t(a,f),signal:o,is:ss(r),event:r,origin:n,trace:()=>jo(s.beneath),budget:()=>i.reading(),caught:p});var gp=()=>({pendingDownstream:0,settled:!1,inFlight:void 0,fromBelow:[],belowRejected:void 0,beneathMs:0,beneathSince:0});function Bde(e,t){return[t,e.reason].find((o)=>o instanceof Error&&Ke(o))??new Ye(wlt(e))}function xp({handler:e,site:t,e:o,fromBelow:r},n){let s=n;try{let i=t.keptResult?.(n,o,r);if(i!==void 0)s=i.kept,sp(e,t.event,i.why)}catch(i){try{Nl().log(`${e.name}: what the engine keeps of its ${t.event} answer could not be settled or said (${l(i)}); the answer stands`,"error")}catch{return s}}return s}function Ax(e,t){return t!==void 0?`its .catch returned ${t}`:e}function hp({kind:e,error:t,rejection:o}){let r=e==="throw",n=o===void 0?void 0:l(o.error);return r?l(t):n}async function Px({handler:e,e:t,signal:o,state:r,handle:n,site:s,origin:i,run:p,cutAt:a,kind:f,error:m}){let c=e.catch;if(c===void 0)return{answer:void 0,problem:void 0};let g=r.inFlight!==void 0;await r.inFlight?.then(void 0,()=>{return});let y=hp({kind:f,error:m,rejection:r.belowRejected}),u=new AbortController,x=CE(o,u),h=!1,d=`${e.name}: next() after its .catch settled`,w=(R)=>h?Promise.reject(new He(d)):Ngo(R),T=Xt(z3e,o,a),A=Ko({call:(R,N,U)=>w(()=>n.replay(R,N,U)),to:(R,N)=>w(()=>n.replayTo(R,N)),signal:u.signal,event:s.event,origin:i,run:p,budget:T,caught:{error:Object.freeze({kind:f,...y===void 0?{}:{message:y},budget:z3e}),called:g}}),E;try{return E=Ve.run(T,()=>c(t,A)),{answer:T.expired===void 0?await E:await Promise.race([E,T.expired]),problem:void 0}}catch(R){if(eRe(R,o))throw Bde(o,R);let N=Do(z3e),U=T.isExpired(),V=U?`its .catch ran past its ${N} grace`:`its .catch threw ${Bo(R)}`;if(u.abort(new He(`${e.name}: ${V}`)),U&&E!==void 0)ys(E,e,s);return{answer:void 0,problem:V}}finally{h=!0,T.clear(),x()}}var dx=({handler:e,index:t,below:o,site:r,budgetMs:n,cutAt:s,origin:i,nothingBelow:p,answersForEngine:a})=>async(f,m,c)=>{let{run:g,floors:y}=c,u=We(e),x=ps({handler:e,tier:u,index:t,site:r,e:f,descent:c});if(x!==void 0)return o(f,m,x);let h=performance.now(),d=gp(),w=new AbortController,T=CE(m,w),A=new AbortController,E=CE(m,A),R=e.budgetMs??n,N=Xt(R,m,s),U=fs(f),V=ex({handler:e,below:o,site:r,e:f,budget:N,downstreamSignal:w.signal,state:d,run:g,floors:y,tier:u}),{call:X,to:P,runBelow:J}=V,$e=Ko({call:X,to:P,signal:A.signal,event:r.event,origin:i,run:g,budget:N});function De(F){return Nl().log(`${e.name}: its next() rejected below it (${r.event}); the rejection passes up`),F}function Ue(F){let z=r.settle,pe=ae(e)||z===void 0;try{let q=pe?F:z(F),ue=ae(e)?q:r.restoreResult?.(q,d.fromBelow,f)??q,ee=ae(e)||a?ue:r.stripResult?.(ue,d.fromBelow)??ue,Je=ae(e)?void 0:r.check?.(ee,f,d.fromBelow),Te=Je===void 0&&!ae(e)&&e.isHop!==!0;if(Te)V3e(e.name,r.event,r.measure?.(ee,f,d.fromBelow));if(Te&&r.isLateRefusal?.(ee,d.fromBelow)===!0)Nl().log(`${e.name}: ${r.event} hook refused after its next() was answered: what ran beneath it is not undone`,"warn");return{settled:Te?xp({handler:e,site:r,e:f,fromBelow:d.fromBelow},ee):ee,problem:Je}}catch(q){let Se=`a result the site cannot read (${l(q)})`;return{settled:F,problem:Se}}}let be,he,te="rejected",ke=!1,K,me;try{K=Ve.run(N,()=>e.run(U,$e,{call:X,floors:y,cutAt:s}));let z=N.expired===void 0?await K:await Promise.race([K,N.expired]);if(z===void 0)throw me="no result",new He("returned no result");let{settled:pe,problem:q}=Ue(z);if(q!==void 0)throw me=q,new He(`returned ${q}`);be=pe,he=pe,te=z===d.fromBelow.at(-1)?"passed":"returned",ke=d.inFlight===void 0&&!ae(e)&&e.isHop!==!0}catch(F){if(eRe(F,m))throw Bde(m,F);let z=N.isExpired(),pe=z?void 0:d.belowRejected;if(pe!==void 0&&e.catch===void 0)throw De(pe.error);let q=xt(e,l(F));if(d.settled=!0,z&&K!==void 0)A.abort(new He(q)),ys(K,e,r);let ue=d.inFlight!==void 0,Se=m.aborted?{answer:void 0,problem:void 0}:await Px({handler:e,e:U,signal:m,state:d,handle:V,site:r,origin:i,run:g,cutAt:s,kind:z?"timeout":"throw",error:F}),ee=Se.answer===void 0?void 0:Ue(Se.answer);if(ee!==void 0&&ee.problem===void 0)Nl().log(tp(e.name,F,r.event),"warn"),Nl().hookFailed({plugin:e.name,environmentId:e.environmentId,event:r.event,reason:q,effect:ep,hasOverrun:!1}),be=ee.settled,he=ee.settled,te="caught";else if(pe===void 0){let Te=ue&&m.aborted&&!dEs(m);if(np({error:F,handler:e,site:r,effect:Te?Uo:ue?ap:ip,cause:{expiredMs:z?R:void 0,lingeredMs:N.hasGraceExpired()?TFe:void 0,shape:me,caught:Ax(Se.problem,ee?.problem)}}),Te)throw Bde(m);if(d.inFlight===void 0&&p)throw F;be=await(d.inFlight??J(f)),he=ue?be:void 0,te=z?"expired":ue?"kept":"skipped"}else throw De(pe.error)}finally{d.settled=!0,N.clear(),E(),T();let F=performance.now(),z=F-h-d.beneathMs-(d.pendingDownstream>0?F-d.beneathSince:0);if(lt(g,{index:t,plugin:e.isCore===!0?a8:e.name,tier:u,event:r.event,outcome:te,ms:z,received:f,returned:he}),ke)Ja({plugin:e.name,tier:u,event:r.event,ms:z});if(d.pendingDownstream>0)w.abort(new Gde(`${e.name} settled the call`))}return be};import*as de from"vm";var wp=Symbol("compile with no import() hook"),n

// chunk-nyce03br.js answers-for-engine tag of a module record [238083,238111) 28 units sha256 cf20545f924aae224fdf1a1a8eecfe544fce52b13f0efa5bfe52c8ea9ea572ce
var Xgo=(e)=>nr(e)!==void 0;

// chunk-nyce03br.js site/raise descriptor of a record [111415,111504) 89 units sha256 58914804363a6e3d2eb2d4668ec017356998a98afe81d9b051d54efc5a932963
function Ooe(e,t){let r=mlt(e)?zd[e]:se(e);return t?{...r,raiseArgument:(n)=>Aws(t,n)}:r}

// chunk-nyce03br.js origin chain of a record (nyce03br scope) [25533,25619) 86 units sha256 db9ef8bf1ca9ec94b8c283c4d1688cfa530e8cda6437cca143cfb1f2f20ed5af
var se=(e)=>({event:e,check:C((t)=>Me(t,"{ value }",(o)=>Object.hasOwn(o,"value")))});

// chunk-nyce03br.js site raise argument [25694,25838) 144 units sha256 1085aade3f6894497358259bb289e21f6112bcfd6ab7ae802342ee73d8556c00
function Aws(e,t){if(!L(t))return t;let o=t[e.field];if(typeof o!=="string"||o==="")return t;let r=tc(e.at,o);return r===o?t:{...t,[e.field]:r}}

// chunk-nyce03br.js module path lookup [237828,237858) 30 units sha256 f7b4ade234ce2740fe739ccdc04461639f63cdd0acdc751bb74e6ca567780158
var nr=(e)=>Swr.get()?.get(e);

// chunk-nyce03br.js path table holder [237792,237828) 36 units sha256 b2de0e60e2730e5cb157406de76872fcd550dafdd03ed254d71b5603399efb46
var Swr=Ge(bs(),(e)=>e.set(void 0));

// chunk-nyce03br.js worker log ceiling [16728,16740) 12 units sha256 8be91ff5900b171bddd4aa8b86e2dc31bc191e41e72368f982f56f24b2448003
var tT=4096;

// chunk-nyce03br.js abort reason reader [158106,158196) 90 units sha256 712cbdc5e7b8990978beb99eae8f081f72faf0271d64cf78b5fb5adb42480b14
function pwr(e){let{reason:t}=e;return t instanceof Error?t:new He(wlt(e,"wait aborted"))}

// chunk-yjc18bey.js promise versus signal race [2047,2313) 266 units sha256 88fc55becad311e7a66dd798c087cdc4f495f34cbeb7e3848ec746fea400c5ba
async function Ka(t,r,e){let o=()=>{t.catch(()=>{})};if(r.aborted)throw o(),e();let n=()=>{};try{return await Promise.race([t,new Promise((m,i)=>{n=()=>i(e()),r.addEventListener("abort",n,{once:!0})})])}catch(m){throw o(),m}finally{r.removeEventListener("abort",n)}}

// chunk-ax7r0qj7.js declares x, the fromCharCode chunker WMt falls back to when Buffer is absent (a gap the scope-aware scan found: the browser branch was unreachable in this product, so the name had never resolved) [1645,1850) 205 units sha256 d7ccce29523920f445390e8ce49693e3b19c49ef17df9435da791459ea9cbf34
function x(t){let e=[];for(let r=0;r<t.length;r+=8192){let i=Math.min(r+8192,t.length),o=new Uint16Array(i-r);for(let u=r;u<i;u++)o[u-r]=t.charCodeAt(u);e.push(String.fromCharCode(...o))}return e.join("")}


export { He, Gde, Ye, Ke, l, ze, eRe, wlt, hlt, kSe, Dws, QPt, aP, jo, fx, CE, Xt, qi, Xgo, Ooe, Aws, se, nr, Ge, Swr, tT, L, CFe, sIt, $A, ne, bs, us, np, ip, Do, pwr, Ka, D, nQt, B, C, Me, er, fe, m$, we, We, TFe, cs, Ve, Bo, rwr, ss, Ja, ys, lt, ae, gt, ps, fp, fs, ap, xt, Uo, Kg, tp, dEs, Fgo, Gt, a8, x, ep, z3e, h$, b3, y$, swr };
