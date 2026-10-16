// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The raise entry of the streaming half: `aGe` waits on the same gate as the value events' `Hze`,
// collects the streaming handlers with `has` (the records copy, which is chunk-2kdsvp3x.js), and
// runs the stage `iwr` from the chunk-nyce03br.js copy.
import { N5t } from './plugin-chain-classic-raise-source.js';
import { iwr, tRe } from './plugin-chain-stream-source.js';
import { has, aJ } from './plugin-chain-records.js';
import { He, Ooe } from './plugin-chain-source.js';
import { Nl } from './plugin-chain-host.js';

// chunk-sfn1dbxq.js the withheld-result texts, the await-then-stream retry, and aGe [1843388,1844317) 929 units sha256 dddd566ee055e4164faba438902497178db3a4babbf30d21977034684d088427
async function*ezt(e,n){return await e,yield*n()}var tzt={nothing:"",started:" started, and a plugin withheld its result",ran:" ran, and a plugin withheld its result"};function aGe({event:e,args:n,caller:r,bottom:s}){let h=has(e,r.origin),y=r.signal??new AbortController().signal;if(h.length===0&&s)return s.stream(n,r);let b=N5t({event:e,e:n,origin:r.origin},r.signal);if(b!==void 0)return ezt(b,()=>aGe({event:e,args:n,caller:r,bottom:s}));let w="nothing",M=()=>void(w="started");function z(he){return w="ran",he}let V=s&&((he,_e)=>{let ke=s.check?.(he,r);if(ke!==void 0)throw new He(`${e}: ${ke} (host check)`);let Se=s.stream(he,{...r,signal:_e});return async function*(){return{value:z(yield*tRe(Se,M))}}()}),X=iwr({e:n,handlers:h,site:Ooe(e),signal:y,origin:aJ(r.origin),bottom:V});return async function*(){let he=yield*tRe(X);if(he.deny!==void 0)throw new He(`${r.plugin}: $.${e}${tzt[w]}: ${he.deny}`);return he.value}()}


export { tzt, ezt, aGe };
