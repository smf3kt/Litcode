// @ts-nocheck
// Exact log sanitizers. See research/ports/W364-peer-idle.md.
import { createHash } from 'node:crypto';
const r = createHash;
const kn = text => text;
// chunk-ax7r0qj7.js Hs [1013,1128), UTF-16; sha256 22089dbfdb0fe682f6d75d63d14a989c6056b9f98d2678bdae01352120ca9a74
function Hs(t,n){if(t.length<=n)return t;let e=[];for(let r of t){if(e.length>=n)break;e.push(r)}return e.join("")}
// chunk-zf8k2z6n.js at [675,890), UTF-16; sha256 3c7a61171818d4b7501cb11b311233accff55ba92898b1112e203ca7953a0b4e
function at(e){if(typeof e!=="string"&&!ArrayBuffer.isView(e))throw Object.assign(TypeError("sha256Hex: the data is neither text nor bytes"),{code:"ERR_INVALID_ARG_TYPE"});return r("sha256").update(e).digest("hex")}
// chunk-rzybc39t.js ln [709,753), UTF-16; sha256 191a56f7d3b0def8865a1d4833f863eb1e76514a47db67232479ff7869fc9587
function ln(r){return kn(at(r).slice(0,12))}
// chunk-6zdc3jq1.js Te [9253,9273), UTF-16; sha256 f48ad2d6524b3f89ba7838e408aeb8caf3593f66dd9b33445731eabd53d694cc
var Te=/[0-9a-f]{32,}/gi;

// chunk-6zdc3jq1.js se [9274,9332), UTF-16; sha256 1401bf95e89abe4f4d17109f0a367456390336313d05d44656138b9b52db08b4
function se(e){return e.replace(Te,(n)=>`<hex:${ln(n)}>`)}

// chunk-6zdc3jq1.js kg [9332,9411), UTF-16; sha256 68651a09c7e91d56bb5e59c645da1592f6be7ab7ab4c0b068182f0507016055e
function kg(e,n=120){if(/token/i.test(e))return"(withheld)";return Hs(se(e),n)}

// chunk-6zdc3jq1.js u6 [9411,9520), UTF-16; sha256 d6b2c1ba9c4d219b13e9abe4577cd76e0da031d76fc073d5963687b964923ebf
function u6(e){if(/token/i.test(e))return"(redacted: fragment may carry an auth token)";return Hs(se(e),200)}

export { kg, u6 };
