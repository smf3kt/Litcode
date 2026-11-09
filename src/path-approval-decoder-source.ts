// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import { isUtf8 as d } from 'node:buffer';
// chunk-0hm793yn.js SPe [781,1212), UTF-16; sha256 b98e4d243be124908fcb0d9e666b84bbdca5be23f70b796e085e222d69692b65
function SPe(n,e,r){if(n.isDirectory())throw Object.assign(Error("EISDIR: illegal operation on a directory, read"),{code:"EISDIR",errno:-21,syscall:"read",path:e});if(!n.isFile())throw Object.assign(Error("Not a regular file (device, FIFO, or socket)"),{code:"ERR_NOT_REGULAR_FILE",path:e});if(r!==void 0&&n.size>r)throw Object.assign(Error("File exceeds maxBytes limit"),{code:"ERR_FILE_TOO_LARGE",path:e,size:n.size,maxBytes:r})}
// chunk-0hm793yn.js NRr [1361,1520), UTF-16; sha256 56e7ec4dd5d8c2bd3bea59211f2826fd18ea4a26f89132b7188e382576ba29b5
function NRr(n,e,r){if(r===void 0)return;if(n>r)throw Object.assign(Error("File exceeds maxBytes limit"),{code:"ERR_FILE_TOO_LARGE",path:e,size:n,maxBytes:r})}
// chunk-0hm793yn.js jGn [1710,1902), UTF-16; sha256 44ba66dce090249c8373a83760af1e9c564dc353428a13f253c5b60c853a4359
function jGn(n){if(n.byteLength===0)return"utf8";if(n.byteLength>=2){if(n[0]===255&&n[1]===254)return"utf16le"}if(n.byteLength>=3&&n[0]===239&&n[1]===187&&n[2]===191)return"utf8";return"utf8"}
// chunk-0hm793yn.js lTo [1902,1945), UTF-16; sha256 8f9f5c1b67d98d406517bc6885d2dd7d28d0e4fe6918cd4529d7f608420f61f8
function lTo(n,e){return e==="utf8"&&!d(n)}
// chunk-0hm793yn.js WGn [2181,2308), UTF-16; sha256 834608d9d2dc301a27fb95eb4f03a7d00da8f3be7e7b4b430614c25dc59b776e
function WGn(n){let e=0,r=0;for(let i=0;i<n.length;i++)if(n[i]===`
`)if(i>0&&n[i-1]==="\r")e++;else r++;return e>r?"CRLF":"LF"}
// chunk-gyf58rwf.js ID [80736,81001), UTF-16; sha256 e7146358ec5b918ea27922d588c8199b4c49f675e3d63afe2c9d7d32cf26ad04
async function ID(e,n,r){let s=r!==void 0?r==="file":(await e.stat()).isFile(),i=[],o=0;while(o<n){let a=Buffer.allocUnsafe(Math.min(65536,n-o)),{bytesRead:u}=await e.read(a,0,a.length,s?o:null);if(u===0)break;i.push(a.subarray(0,u)),o+=u}return Buffer.concat(i,o)}
// chunk-0hm793yn.js lwe [2923,3214), UTF-16; sha256 4b0f5b96154ee229cb33ab9808ef27ebca8bda249ccee6c636840ce39811a9b5
async function lwe(n,e,r){SPe(await n.stat(),e,r);let i=r===void 0?await n.readFile():await ID(n,r+1,"file");NRr(i.length,e,r);return decodeFileBytes(i)}
// Byte-decoding portion of lwe [2923,3214), shared with an authenticated backup.
function decodeFileBytes(i: Buffer){let s=jGn(i.subarray(0,4096)),o=i.toString(s),c=WGn(o.slice(0,4096));return{content:o.replaceAll('\r\n','\n'),encoding:s,lineEndings:c,...lTo(i,s)&&{lossyDecode:!0}}}
export { lwe, decodeFileBytes };
