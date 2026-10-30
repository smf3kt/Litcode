// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import { AsyncLocalStorage as l } from 'node:async_hooks';
export function createShellCwdScope(VR, W8e, Ee) {
// chunk-ae84tp6z.js On [7395,7436), UTF-16; sha256 fce11281169388623aca1324f3dc87f2e80b286ecb465abcb5398ad79bfbb34d
function On(t){return t.normalize("NFC")}
// chunk-qr9z1wer.js t [2029,2036), UTF-16; sha256 6337841fabf8a6dea993c7f4755c4524935e00929b20d1a3816a036b6a50197a
var t=new l;
// chunk-qr9z1wer.js Wm [2037,2082), UTF-16; sha256 34bf7bb0279243361840a15c43d258e060c08c7a3f7b48d0232ec43fce5a3fb5
function Wm(e,o){return t.run({cwd:On(e)},o)}
// chunk-qr9z1wer.js bPe [2082,2121), UTF-16; sha256 00427092270c0674104bf775722c1a4018d95dcefc795706e9c1193e1177d47b
function bPe(e,o){return Wm(e??se(),o)}
// chunk-qr9z1wer.js MZ [2121,2164), UTF-16; sha256 ac6efceb640a5c90b1326031dc452fb54ebbde7500877e8ce635ec98049fdfb6
function MZ(){return t.getStore()!==void 0}
// chunk-qr9z1wer.js kon [2164,2228), UTF-16; sha256 3dc28c730426363244bce5bac52475b17d5530a4f387970ac515b4bbc6baae67
function kon(e){let o=t.getStore();if(o)o.cwd=On(e);else W8e(e)}
// chunk-qr9z1wer.js Aon [2228,2274), UTF-16; sha256 5b4266176e6ac85ccf4f1f3affc566018073f76421b1f5fb7fcba022b40b6cb9
function Aon(){return t.getStore()?.cwd??VR()}
// chunk-qr9z1wer.js se [2355,2405), UTF-16; sha256 f342a46b7698adf67a68754e434b41d76b68b1942aafbed4cb32db7333a4ecf2
function se(){try{return Aon()}catch{return Ee()}}
return { Wm, bPe, MZ, kon, Aon, se };
}
