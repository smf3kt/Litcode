// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-kwp08k6x.js sha256 30dd63de691cb91bb82fe15f6073761e0e53c4b76025cd28c8e5274686773aab
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The classic PreToolUse raise point and the bridge that puts it on the tool call: the dispatcher
// `$go`, the envelope the hook sees (`No`/`Da`), the record an answer is kept in (`RFe`/`CFe`), the
// three bodies the source's own `tool.call` core is built from (`xe`/`ye`/`ke`) and `Mo`, the gate
// that decides whether the tool call is wrapped at all. The shared rules come from the copies already
// in the product, and `zd` is the host's registered site table, which is what the source's own `zd`
// holds, so `$go`'s body is copied unchanged.
import { zd } from './plugin-chain-host.js';
import { aP, L, m$ } from './plugin-chain-source.js';
import { Gn, Ude, je, j$n } from './plugin-chain-classic-sites-source.js';
import { P0, aJ } from './plugin-chain-records.js';
import { Jl } from './plugin-chain-relay-source.js';
// Port: `Pet` is the source's text lookup (chunk-sfn1dbxq.js, still unported); the sentence's shape is
// the source's and only the word is the host's, so it is the product's own word for a denied decision.
var Pet = (key) => key === 'deny' ? 'denied' : key;

// chunk-kwp08k6x.js declares xe [17196,17365) 169 units sha256 601f710c845724d538142ba0a025a166bda192eef9e35735e24c69f264c0ad69
function xe(e,r,n){let s=r||`Hook PreToolUse:${e.tool} ${Pet("deny")} this tool`,i=`Error: ${s}`;return{ref:n.keep(Ude(e),{result:i,text:s}),result:i,text:s,isError:!0}}

// chunk-kwp08k6x.js declares ye [17365,17439) 74 units sha256 c127afa0afb079d03699bfbb3a0d0b3e0928e0e27f9762c49a7d96ebdd3895c4
var ye=(e,r)=>m$(["agentId","consent",j$n],rIt(e.tool,e.tool_use_id,r),e);

// chunk-kwp08k6x.js declares ke [17439,17723) 284 units sha256 78e064c730b026fd822fd65372e7c971457371df6fd81244689c402294fec313
var ke=(e,r)=>({name:"core",isCore:!0,budgetMs:0,async run(n,s){let i=rIt(n.tool,n.tool_use_id,Ude(n)),{deny:f,updatedInput:m}=await $go(i,P0("classic.PreToolUse",e),{signal:s.signal,origin:aJ(e),bottom:()=>Promise.resolve({})});return typeof f==="string"?xe(i,f,r):s(m?ye(n,m):n)}});

// chunk-kwp08k6x.js declares Mo [17723,17793) 70 units sha256 8f3421265d9c337990575cfb43ec6556f4e324f323467c296ea50945a428d5e6
var Mo=(e,r=RFe())=>Jl("classic.PreToolUse")?{"tool.call":ke(e,r)}:{};

// chunk-nyce03br.js declares Da [103321,103443) 122 units sha256 53ec5b2ee8ede2a34479e112b29de3987af61e12c1c0e1acea326b06ce5a6e64
function Da(e){let t={};for(let o of[...Gn,j$n])if(Object.hasOwn(e,o))t[o]=e[o];return Object.keys(t).length===0?void 0:t}

// chunk-nyce03br.js declares No [103443,103575) 132 units sha256 31126f5e07098cea487db380c3590bcc38dc976fdd3fabf8dd357749f6dad07c
function No(e,t,o){let r=Da(o),{consent:n,agentId:s,requestMeta:i,...p}=o;return{...p,tool:e,tool_use_id:t,...r!==void 0&&{[je]:r}}}

// chunk-nyce03br.js declares rIt [103918,103945) 27 units sha256 42e084b79c853b25188f3ffb0114025b955de5ea1ec3bc18c21d38eae6b99af2
var rIt=(e,t,o)=>No(e,t,o);

// chunk-nyce03br.js declares a8 [111504,111520) 16 units sha256 0583f2432ff8dfe374dbda6088d5f6888447156e1fc2d18069259c6b5e75481d
var a8="engine";

// chunk-nyce03br.js declares CFe [111520,111567) 47 units sha256 9e881a57a788edf335bc2cd7cf949df823ffd89f0b31d264908810632f6221db
var CFe=Object.freeze({plugin:a8,tier:"core"});

// chunk-nyce03br.js declares RFe [112820,112985) 165 units sha256 4f9261b5f6ffd2daed100620b6f6667922161b7ad49f51ddfab13d7f5471bfbf
function RFe(){let e=[];return{keep:(t,o)=>e.push({input:t,made:o}),of:(t)=>t===void 0?void 0:e[t-1],last:(t)=>t===void 0?e.at(-1):e.findLast(t),ran:()=>e.length>0}}

// chunk-nyce03br.js declares $go [121822,121896) 74 units sha256 8f0b1e52979b9e82725fd009e25d57ddbb8aa2687e77c86bbe076bc26678550e
var $go=(e,t,o={})=>aP({e,handlers:t,site:zd["classic.PreToolUse"],...o});

// chunk-sfn1dbxq.js declares p_t [504161,504309) 148 units sha256 836b5d470c42729c6d518c4a4c023ae359029ce8dbb2afba0e36aa4a078abdd8
var p_t=(e,n)=>e.permissionBehavior==="ask"&&n.some((r)=>r.heldForServedCall===!0&&r.hookPermissionDecisionReason===e.hookPermissionDecisionReason);

// chunk-sfn1dbxq.js declares mDe [504309,504681) 372 units sha256 69cd5137382200f85076fc3eadd51cdb6bd2cb9a80c206ff7a47e7eda86db893
function mDe({deny:e,ask:n,allow:r,updatedInput:s,additionalContext:h}){let y={};if(h&&h.length>0)y.additionalContexts=h;if(typeof e==="string")return y.permissionBehavior="deny",y.hookPermissionDecisionReason=e,y;if(typeof n==="string")y.permissionBehavior="ask",y.hookPermissionDecisionReason=n;else if(r===!0)y.permissionBehavior="allow";if(s)y.updatedInput=s;return y}


export { Da, No, rIt, a8, CFe, RFe, $go, xe, ye, ke, Mo, mDe, p_t };
