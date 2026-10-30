// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import * as $k from 'node:path';
function createReadIdentity(vpe) {
// chunk-sfn1dbxq.js whn [3533321,3533476), UTF-16; sha256 534cc3ab69d6fa364347bac7a8be9313c403b1a59fd0282b5f46a61466984a12
async function whn(e,n){let r=await vpe(n),s=fXe(e);if(s===void 0)return{own:r,alt:void 0};let h=await vpe(vhn(n,s));return{own:r,alt:{path:s,identity:h}}}
// chunk-sfn1dbxq.js vhn [3533476,3533559), UTF-16; sha256 946b27c1b3591005346f9876a055a3b945d9d7daf508d6580136298508dcb9e1
function vhn(e,n){let r=$k.basename(n);return e.map((s)=>$k.join($k.dirname(s),r))}
// chunk-sfn1dbxq.js OIr [3533559,3533593), UTF-16; sha256 b022e88102f052fd78dc8dd5eddc1d7c50a13d953b0913f0d7b057304018d4eb
var OIr=String.fromCharCode(8239);
// chunk-sfn1dbxq.js fXe [3533593,3533781), UTF-16; sha256 581e34e415cad8c80aea6bbef4dbd491255eef76bbcadc209c774b364e569ad8
function fXe(e){let n=$k.basename(e),r=/^(.+)([ \u202F])(AM|PM)(\.png)$/,s=n.match(r);if(!s)return;let h=s[2],y=h===" "?OIr:" ";return e.replace(`${h}${s[3]}${s[4]}`,`${y}${s[3]}${s[4]}`)}
return { whn, vhn, fXe };
}
export { createReadIdentity };
