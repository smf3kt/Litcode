// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The entry builder is the entry seam's, the store wrapper and the registry getter come from the
// runner copy and the host seam, and everything else this subsystem needs — the two registries, the
// key, the two ownership checks and the two bodies — is below. The first import is the sites' seam:
// `Mm` reads `zd[name]` while this file is evaluated, so the two descriptors have to be registered
// before that happens.
import './plugin-chain-scroll-focus-sites.js';
import { Ge } from './plugin-chain-source.js';
import { it } from './plugin-chain-host.js';
import { Mm } from './plugin-chain-entry.js';

// chunk-sfn1dbxq.js `XH` — does another plugin's element hold the keyboard at this site [475447,475544) 97 units sha256 5f39566959f017d9521d0574418648025dc61a9f0dc6f59eba0c1e330c39f724
function XH(e,n){if(n.kind!=="plugin")return!1;let r=e.holderNow();return r!==void 0&&r!==n.name}

// chunk-sfn1dbxq.js `uyt` — is the focus caller neither the site's owner nor the origin's plugin [475544,475653) 109 units sha256 9726871e816893673ad48a388c2d81db62e79bf6eb5d29ea8dcc228be1df003e
var uyt=(e,n)=>n.origin.kind==="plugin"&&e.owner!==void 0&&e.owner!==n.origin.name&&n.plugin!==n.origin.name;

// chunk-sfn1dbxq.js `Uet` — the focus-site registry: `it().focusSites`, cleared through its own disposer [475653,475702) 49 units sha256 ab686471d83fade9b2284f5cb0e2bc03c65dc5aa1063575aba09eddf912751b4
var Uet=Ge(()=>it().focusSites,(e)=>e().clear());

// chunk-sfn1dbxq.js `pyt` — is the scroll caller a plugin that is not the site's owner [476009,476078) 69 units sha256 02ff744581ab1602209a7ea808458619fd7b42601e1f6f7fe4a66cb39670e35c
var pyt=(e,n)=>n.kind==="plugin"&&e.owner!==void 0&&e.owner!==n.name;

// chunk-sfn1dbxq.js `ahe` — the scroll-site registry: `it().scrollSites`, cleared through its own disposer [476191,476241) 50 units sha256 f87314a44e71e8593fcef0724830a06ce2a4c648ab08854f1c49f4ec6f66f478
var ahe=Ge(()=>it().scrollSites,(e)=>e().clear());

// chunk-sfn1dbxq.js `_z` — the key a site is filed under: `component:requestId` [476241,476267) 26 units sha256 fc98bf0e125101c7006512b407b8795bcb6e0b9b3e4bc539709fe883b6e75adb
var _z=(e,n)=>`${e}:${n}`;

// chunk-sfn1dbxq.js `mse` — the scroll site a call names, out of the scroll registry [476681,476733) 52 units sha256 17d9e1c0c45c84ec1e0316cd7eb4333465438df78785270ee63f8dd66431cf94
var mse=(e)=>ahe().get(_z(e.component,e.requestId));

// chunk-sfn1dbxq.js `PY` — `$.ui.scroll`: no such site, not this plugin's site, then the site's own commit [476733,476926) 193 units sha256 a0f13e099aa306219e346864390b3688042a90855b968a14c3cc35e56bbcfab9
function PY(e){let n=mse(e);if(!n)return{deny:"no such site"};if(pyt(n,e.origin))return{deny:"not this plugin's site"};return n.commit(e.offset,e.origin)?{}:{deny:"the window moved meanwhile"}}

// chunk-sfn1dbxq.js `bse` — the `ui.scroll` entry: `Mm("ui.scroll", PY)` [479578,479605) 27 units sha256 c6971b758a50cf980ab928eafb88594eaa4e7a5710afc43944b56a747a12beb4
var bse=Mm("ui.scroll",PY);

// chunk-sfn1dbxq.js `iL` — the focus site a call names, out of the focus registry [479605,479656) 51 units sha256 64dc206ec65ed034f43e048ab1463203687be7750c9f613eb5e108f304d084ae
var iL=(e)=>Uet().get(_z(e.component,e.requestId));

// chunk-sfn1dbxq.js `IY` — `$.ui.focus`: no such site, not this plugin's site, the site does not hold the keyboard, another plugin's element holds it, then the site's own commit [479656,479962) 306 units sha256 f3aa07d1a62886bfc40a8f83b8b1bcff504350435d100ad5ddb4e24a4fe29632
function IY(e){let n=iL(e);if(!n)return{deny:"no such site"};if(uyt(n,e))return{deny:"not this plugin's site"};if(!n.isHeldNow())return{deny:"that site does not hold the keyboard"};if(XH(n,e.origin))return{deny:"another plugin's element holds the keyboard"};let r=n.commit(e);return r===void 0?{}:{deny:r}}

// chunk-sfn1dbxq.js `vse` — the `ui.focus` entry: `Mm("ui.focus", IY)` [479962,479988) 26 units sha256 a6de35f6abd0595813d95fc75d926a4b157eb6d598cab1dcbbf2d19867dceb55
var vse=Mm("ui.focus",IY);


export { XH, uyt, Uet, pyt, ahe, _z, mse, PY, bse, iL, IY, vse };
