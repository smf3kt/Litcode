// @ts-nocheck
// Source declarations. See research/ports/W365-unified-agent-messaging.md.
import path from 'node:path';
const et = path, u = path.resolve, O = () => process.platform === 'darwin' ? 'macos' : process.platform;
const Bn = (() => {
// chunk-ae84tp6z.js zt [22840,22860), UTF-16; sha256 8699acd2d4e62d0d650d84f0010c7ac989f4331e0b329c9c77abd47f8accd00e
var zt=/^[\\/]\?\?[\\/]/;
// chunk-ae84tp6z.js Xt [22861,22916), UTF-16; sha256 c66fb84c6fa92680c8f30c8ee39c603d3873fa9d70759c96ae066815745c60bc
function Xt(t){return et.win32?et.win32.normalize(t):t}
// chunk-ae84tp6z.js zN [22769,22836), UTF-16; sha256 d605d6e55755cd8073fdecac05d2793f41769c534f0d8d09b358d5b45e3eb8e9
function zN(t){return zt.test(t)||t.includes("??")&&zt.test(Xt(t))}
// chunk-ae84tp6z.js Bn [7436,7484), UTF-16; sha256 0cb9af02d0d6dd6042509d464440b555e562472c866d5a91df344df552b4b3e6
function Bn(t){return/^[\\/]{2}/.test(t)||zN(t)}
return Bn;
})();
const gj = (() => {
// chunk-ae84tp6z.js vn [17010,17177), UTF-16; sha256 073c3e1fdb62938dcf3cd950e3d42dc16502b6c5f0680ea89b3ea1f6d1e03f8e
var vn=["usr/local","usr/libexec/cups","usr/share/snmp","AppleInternal","Applications","Library","Users","Volumes","cores","home","media","mnt","opt","pkg","private","sw"];
// chunk-ae84tp6z.js N [17469,17520), UTF-16; sha256 77e8e855ffba278b862af2b32d96fda169532f705053761e3b2c31a70041c67e
function N(t){return t.toUpperCase().toLowerCase()}
// chunk-ae84tp6z.js gj [17178,17469), UTF-16; sha256 3140459ae66bcfcc09faa6aaabf6cc79bd2c1c9c859f5ed459edf2721a622226
function gj(t){let e=t.split("/");if(e.length<5||e[0]!==""||N(e[1]??"")!=="system"||N(e[2]??"")!=="volumes"||N(e[3]??"")!=="data")return t;let n=e.slice(4);for(let r of vn){let o=r.split("/");if(n.length<o.length)continue;if(o.every((i,s)=>N(n[s]??"")===N(i)))return"/"+n.join("/")}return t}
return gj;
})();
// chunk-ae84tp6z.js gy [7484,7538), UTF-16; sha256 c51162af798d9c4b68b815f9fa74c808e627110322dba41cab4a72dc0c32d83e
function gy(t){return/(^|[\\/])\.\.([\\/]|$)/.test(t)}
// chunk-64ag51qf.js b [8832,8841), UTF-16; sha256 5f3bec26932451958606150ea67d052a11d3f336c21480ecd3e72cc65eddeaf1
var b="LOCAL";
// chunk-64ag51qf.js Y [5915,5932), UTF-16; sha256 de93ff7ac20b33e39092f5dcebf6676bb5d139d56a928f1dcb84b0d186010e3e
var Y=/^\/\S*\.sock$/;
// chunk-64ag51qf.js q [5933,5965), UTF-16; sha256 bbcdd0d752e6ddf3a38b7adfdb01941e19978ad071d7902db2a2216cb5fe51f2
var q=/^[\\/]{2}[.?][\\/]pipe[\\/]/i;
// chunk-64ag51qf.js J [5966,5982), UTF-16; sha256 8856405f23aa5fa80bc98168f800ea64d7fa19eb63390c006acced1d14a64785
var J=/^\/\S*\.sock/;
// chunk-64ag51qf.js E [3175,3238), UTF-16; sha256 da142da91918cb71a5f3440970af61f203953306f5f3ddd62dc79e9b5b20a29f
function E(e){try{return decodeURIComponent(e)}catch{return e}}
// chunk-64ag51qf.js Jbo [5983,6016), UTF-16; sha256 12a0c29237b0290ddc28abdc306585392f8f59466c01c865dc9d073334e2a7a6
function Jbo(e){return J.test(e)}
// chunk-64ag51qf.js xh [6016,6309), UTF-16; sha256 4a5e2483dec6fd74b5438bd8f6c01d3f89a03828ad492c43675621ea2bcc499d
function xh(e){if(e.startsWith("uds:"))return{scheme:"uds",target:E(e.slice(4))};if(e.startsWith("bridge:"))return{scheme:"bridge",target:E(e.slice(7))};if(e.startsWith("did:"))return{scheme:"did",target:e};if(Y.test(e)||q.test(e))return{scheme:"uds",target:e};return{scheme:"other",target:e}}
// chunk-64ag51qf.js sAr [7244,7308), UTF-16; sha256 20c10c715f9b3dd33594fc11d11e596c82219f60fb857c21063d5d45c0e256e5
function sAr(e){return e.replace(/[A-Z]/g,(n)=>n.toLowerCase())}
// chunk-64ag51qf.js xbe [7727,7981), UTF-16; sha256 5dfbe30e7dc553c802324a01a65a1a6ff86e7f485a710e92b9d03f9b96c297a8
function xbe(e){let n=/^[\\/]{2}[.?][\\/]pipe[\\/](?:(LOCAL)[\\/])?([^\\/]+)$/i.exec(e);if(n===null||n[2]==="."||n[2]==="..")return;if(/[. ]$/.test(n[2]))return;if(e.startsWith("\\\\?\\")&&e.includes("/"))return;return n[1]===void 0?n[2]:`${b}\\${n[2]}`}
// chunk-64ag51qf.js mD [6607,6664), UTF-16; sha256 dfc55b5cdc01114964299bd075ef309f534fcae41e04fab7356604a3b241eac8
function mD(e){if(!Bn(e))return!0;return xbe(e)!==void 0}
// chunk-64ag51qf.js Rbe [6664,6705), UTF-16; sha256 1267dfa028c489d49831f44e1b31dbe4f46bd67b17eb7dd168a1d48f3fba2c29
function Rbe(e,n){return T(e,n)==="same"}
// chunk-64ag51qf.js ase [6705,6751), UTF-16; sha256 5bc12fbb79eb33adf5b94d902d0c7683071a150302b8cc2caaceafff2a3aa4d0
function ase(e,n){return T(e,n)!=="different"}
// chunk-64ag51qf.js T [6751,7173), UTF-16; sha256 77ef2bb82d49a9444833685db40ace781f53efc34d37efda83dbfdc4fb1fa42b
function T(e,n){let r=xbe(e),s=xbe(n);if(r!==void 0||s!==void 0){if(r===void 0||s===void 0)return"different";if(sAr(r)===sAr(s))return"same";return P(r)===P(s)||m(r)===m(s)?"maybe":"different"}if(e===n)return"same";if(gy(e)||gy(n))return p(a(u(e)))===p(a(u(n)))?"maybe":"different";let t=a(u(e)),i=a(u(n));if(t===i)return"same";let o=O(),d=o==="macos"||o==="windows";return p(t)===p(i)||d&&m(t)===m(i)?"maybe":"different"}
// chunk-64ag51qf.js p [7173,7244), UTF-16; sha256 fa458cd15acfee35a84105a9577698c10f1b18ee107cfe83c2c6790a3d98b27e
function p(e){let n=O();return n==="macos"||n==="windows"?a(P(Q(e))):e}
// chunk-64ag51qf.js P [7308,7419), UTF-16; sha256 8622c9b5025400edd32bde9159b7eb5e481fbe51d930de64cde35b9bf8550c05
function P(e){let n="";for(let r of e){let s=r.toUpperCase(),t=N(s)?s:r,i=t.toLowerCase();n+=N(i)?i:t}return n}
// chunk-64ag51qf.js N [7419,7500), UTF-16; sha256 b211e7083aa97f6f7ce9e8dfef4de03f30f3a08161c9c815add58d5bb68be7c3
function N(e){let n=e.codePointAt(0);return n!==void 0&&e.length===(n>65535?2:1)}
// chunk-64ag51qf.js m [7500,7551), UTF-16; sha256 fc0bb32475ffee5594082143fdef8eaac1aca8f2d8486df1ff43fdaa98216718
function m(e){return e.toUpperCase().toLowerCase()}
// chunk-64ag51qf.js Q [7551,7607), UTF-16; sha256 33a85db7965fd906d7f2effc4890e4db8669f7a620a08c50d9443ef365381bf4
function Q(e){return O()==="macos"?e.normalize("NFC"):e}
// chunk-64ag51qf.js a [7607,7727), UTF-16; sha256 61b3a0f83c6f5ec9b56101beb85cd89b040d7d02e4e370e277e79f2b12ffb9c3
function a(e){if(O()!=="macos")return e;let n=gj(e),r=/^\/private(\/(?:var|tmp|etc)(?:\/.*)?)$/.exec(n);return r?r[1]:n}
export { xh, Jbo, mD, Rbe, ase, gy, sAr, xbe };
