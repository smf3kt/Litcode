// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The `$` table's `settings.read` (W45-53): what the entry's check and body reach — the source map,
// the body that projects one source or the merged settings through a JSON copy, and the two bodies
// behind it. Every block is the module's own text; the closure is 4 statements in the plugin-method
// table's module (chunk-sfn1dbxq.js). The settings store itself — the cache accessor `ft` and the
// per-source reader `fe` these bodies call — is a different subsystem: its own closure in
// chunk-x0dc37w9.js is 205 statements / 66,141 units over more than sixty cross-module imports, so
// it is the bounded hook in ./plugin-chain-settings-store.ts rather than a half-taken copy here.
//
// The entry itself is a fragment of the plugin-method table's literal (not a top-level statement),
// so it is ported verbatim in src/plugin-chain-settings.ts with its span quoted, the way the ui and
// store entries were.
import { _, Y } from './plugin-chain-store-carry-source.js';
import { fe, ft } from './plugin-chain-settings-store.js';

// chunk-sfn1dbxq.js declares ZH, the projection: undefined stays undefined, and anything else answers the value's JSON copy (parse of stringify), through the same two helpers the store's parse uses — an explicit range, because this module's top-level map cannot be walked reliably (a 60k-line chunk) [492416,492454) 38 units sha256 d9fb55320fa4d11316d11897a02b421db1ef712e016d8ac11b2b0bb0d944731d
var ZH=(e)=>e===void 0?void 0:Y(_(e));

// chunk-sfn1dbxq.js declares J9, the source map the check and the body both read: `user` → userSettings, project, local, flag and policy — an explicit range, because this module's top-level map cannot be walked reliably (a 60k-line chunk) [2328610,2328746) 136 units sha256 458bba2488183a7dc0e4a848fd43635fd2d5f16f6949277eb87fd1fd73b7dbd8
var J9=Object.freeze({user:"userSettings",project:"projectSettings",local:"localSettings",flag:"flagSettings",policy:"policySettings"});

// chunk-sfn1dbxq.js declares hGo, the entry's body: with no source the merged settings, with one the settings of that source, either way through ZH and answered as a promise with `{}` for a missing store — an explicit range, because this module's top-level map cannot be walked reliably (a 60k-line chunk) [2328746,2328835) 89 units sha256 20a75f916656c484630043dab110e221039a895ceea28a3e422a7fa555241890
function hGo(e){let n=e.source;return Promise.resolve(ZH(n===void 0?ft():fe(J9[n]))??{})}

// chunk-sfn1dbxq.js declares yGo, the entry's check: no argument, or a string naming one of J9's keys, is admitted; anything else is refused with the list of names and the type it got — an explicit range, because this module's top-level map cannot be walked reliably (a 60k-line chunk) [2328835,2329021) 186 units sha256 21f7007a82a5237afc43a7e34d8be5af5d6b8d0caa2ba5d69fc86c61556b55a6
function yGo(e){return e===void 0||typeof e==="string"&&Object.hasOwn(J9,e)?void 0:`takes { source } naming one of ${Object.keys(J9).join(", ")} (got ${typeof e==="string"?e:typeof e})`}


export { ZH, J9, hGo, yGo };
