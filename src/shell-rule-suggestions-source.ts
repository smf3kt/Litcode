// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
const ki = { name: "Bash" };
// chunk-3cynezh1.js vWn [183008,183132), UTF-16; sha256 240fbe739b04605d22678aafdff16b804b38ca14dcef8ff7fab0b45b69c25700
function vWn(e,n){return[{type:"addRules",rules:[{toolName:e,ruleContent:n}],behavior:"allow",destination:"localSettings"}]}
// chunk-3cynezh1.js kWn [183132,183263), UTF-16; sha256 11f6c7cd6ce6e199f28da87369e6b24c6fbf72806304714dd385682be35a0412
function kWn(e,n){return[{type:"addRules",rules:[{toolName:e,ruleContent:`${n} *`}],behavior:"allow",destination:"localSettings"}]}
// chunk-ax7r0qj7.js Qe [3224,3289), UTF-16; sha256 7184cd31a9af8f0fac35de5b85a290da988105f5df932de856f663e2dc2427cd
function Qe(t,n){let e=t.indexOf(n);return e===-1?t:t.slice(0,e)}
// chunk-ax7r0qj7.js Ar [3529,3561), UTF-16; sha256 b4022a3d073a7db41c37c63237ed26eb7fb5f7a1caff06b8c1be5c4a57d00cf4
function Ar(t){return Qe(t,`
`)}
// chunk-sfn1dbxq.js VF [3082742,3082766), UTF-16; sha256 f39c6e4ce6e77223b4827470145c39ba21b11b1674b74961488855e51b8b0d50
function VF(e,n){return}
// chunk-sfn1dbxq.js $we [3197093,3197113), UTF-16; sha256 83ab1e73f545a2122de5c9e6b0847ce1329811d1e6ff6257ae8a5b340ae2ec95
var $we=/^[A-Za-z_]\w*=/;
// chunk-sfn1dbxq.js oor [3197180,3197619), UTF-16; sha256 167029865af2df9c486703ca68588890b798b7ba32c7f9a4d2b8667958573c01
function oor(e){let n=e.trim().split(/\s+/).filter(Boolean);if(n.length===0)return null;let r=0;while(r<n.length&&$we.test(n[r])){let M=Qe(n[r],"="),z=!1;if(!CG.has(M))return null;r++}let s=n.slice(r);if(s.length<2)return null;if(Bwe.has(s[0].split("/").pop()))return null;let h=s[1],y=/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;if(!y.test(h))return null;let b=VF(s[0],h)??2,w=2;while(w<b&&y.test(s[w]??""))w++;return w<b?null:s.slice(0,w).join(" ")}
// chunk-sfn1dbxq.js Bwe [3197623,3197934), UTF-16; sha256 cf63c7d03d0c4bdd6a1199336b9ca465b10e53101904dad1c0ee1e510ca38c52
var Bwe=new Set(["sh","bash","zsh","fish","csh","tcsh","ksh","dash","cmd","powershell","pwsh","env","xargs","command","builtin","noglob","nice","stdbuf","nohup","timeout","time","watch","ionice","chrt","setsid","taskset","strace","ltrace","script","flock","unshare","nsenter","sudo","doas","pkexec","su","runuser"]);
// chunk-sfn1dbxq.js TVt [3198388,3198572), UTF-16; sha256 1352c721ceb0f54cdc3ef5331ca1fa8ae652ac741a422ada90648b3a584f9369
function TVt(e){let n=iTr(e);if(n)return kWn(ki.name,n);if(e.includes(`
`)){let s=Ar(e).trim();if(s)return kWn(ki.name,s)}let r=oor(e);if(r)return kWn(ki.name,r);return vWn(ki.name,e)}
// chunk-sfn1dbxq.js iTr [3198572,3199022), UTF-16; sha256 6912140f4cfacdfbb5e08202b173839f2fe122d6ad7c6668a53586285e93c473
function iTr(e){if(!e.includes("<<"))return null;let n=e.indexOf("<<");if(n<=0)return null;let r=e.substring(0,n).trim();if(!r)return null;let s=oor(r);if(s)return s;let h=r.split(/\s+/).filter(Boolean),y=0;while(y<h.length&&$we.test(h[y])){let b=Qe(h[y],"="),w=!1;if(!CG.has(b))return null;y++}if(y>=h.length)return null;if(Bwe.has(h[y].split("/").pop()))return null;if(VF(h[y],h[y+1]??"")!==void 0)return null;return h.slice(y,y+2).join(" ")||null}
// chunk-sfn1dbxq.js CG [3199121,3199644), UTF-16; sha256 e844dc9aa2eac4bdbffaecaa2566515707c35c4a472cd011e9a322751730f0ce
var CG=new Set(["GOEXPERIMENT","GOOS","GOARCH","CGO_ENABLED","GO111MODULE","RUST_BACKTRACE","RUST_LOG","NODE_ENV","PYTHONUNBUFFERED","PYTHONDONTWRITEBYTECODE","PYTEST_DISABLE_PLUGIN_AUTOLOAD","PYTEST_DEBUG","ANTHROPIC_API_KEY","LANG","LANGUAGE","LC_ALL","LC_CTYPE","LC_TIME","CHARSET","TERM","COLORTERM","NO_COLOR","FORCE_COLOR","TZ","LS_COLORS","LSCOLORS","GREP_COLOR","GREP_COLORS","GCC_COLORS","TIME_STYLE","BLOCK_SIZE","BLOCKSIZE","COLUMNS","LINES","CLICOLOR","CLICOLOR_FORCE","CI","DEBIAN_FRONTEND","GIT_TERMINAL_PROMPT"]);
export { TVt, kWn };
