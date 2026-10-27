// @ts-nocheck
// Exact source declarations. See research/ports/W364-peer-idle.md.
// chunk-ax7r0qj7.js Lt [3561,3652), UTF-16; sha256 f2d166a2dc29276ed4cfdc6420711b6f00ff1b565d208f3693098bcfc55c7714
function Lt(t,n,e=0){let r=0,i=t.indexOf(n,e);while(i!==-1)r++,i=t.indexOf(n,i+1);return r}
// chunk-3qabb19b.js F [673,732), UTF-16; sha256 8dfba6c6fce4cbf7879b76db23ff835a055481d92e7df90b4d119514b1d6a950
function F(n,e){let r=0;for(let t of n)r+=+!!e(t);return r}
// chunk-c7jc8962.js vf [2538,2544), UTF-16; sha256 8eb1b7b2de958bc09a7388b368f624ac36d58371386faf51ac4ac8e5773c4e35
var vf=800;

// chunk-c7jc8962.js Ud [2593,2719), UTF-16; sha256 e15b1d1d34c5105d501de35323432e34bee8e1695741caa775b438f198b6de90
function Ud(e,n){if(e.length<=n)return e;let t=n-1,i=e.charCodeAt(t-1);if(i>=55296&&i<=56319)t--;return e.slice(0,t)+"\u2026"}

// chunk-c7jc8962.js b [2719,2756), UTF-16; sha256 01a9ab09ee497693a017d16f38f9284d6a842774cb3df9caa7a5d0441e805906
function b(e,n){return S(e,n)!==null}

// chunk-c7jc8962.js S [2756,3191), UTF-16; sha256 460d77dc753113ce3fa0e8859b0f08df8d7bab707066414b8202c6082a7b90ac
function S(e,n){let t=null,i=0,s=0,a=e.indexOf("```"),l=e.indexOf("~~~");while(s<n){if(a!==-1&&a<s)a=e.indexOf("```",s);if(l!==-1&&l<s)l=e.indexOf("~~~",s);let u=a===-1?l:l===-1?a:Math.min(a,l);if(u===-1||u>=n)break;let r=e[u],c=u-1,h=0;while(c>=0&&e[c]===" "&&h<3)c--,h++;let d=c<0||e[c]===`
`,f=3;s=u+3;while(e[s]===r)s++,f++;if(!d)continue;if(t===null)t=r,i=f;else if(t===r&&f>=i)t=null,i=0}return t===null?null:{marker:t,length:i}}

// chunk-c7jc8962.js G [4696,4760), UTF-16; sha256 b3b548a98bae32ba8749e3aab84ed7129c4560497917b3f1b19f84d4c81d003d
var G=/(?:^|\n)\s*failed\s*[:\u2014\u2013-]\s*(.{3,200}?)(?=\n|$)/gi;

// chunk-c7jc8962.js W [4761,4830), UTF-16; sha256 9045f2b75a30c002bfac49ac9c260b6b5ac1d3297e5bdb5b8a9b04c1bb46259d
var W=/(?:^|\n)\s*needs input\s*[:\u2014\u2013-]\s*(.{3,200}?)(?=\n|$)/gi;

// chunk-c7jc8962.js K [4831,4896), UTF-16; sha256 0a3104c617cd99e59a19135ad06a1b994caf19cf550124b4078a125a4ef2311a
var K=/(?:^|\n)\s*blocked\s*[:\u2014\u2013-]\s*(.{3,200}?)(?=\n|$)/gi;

// chunk-c7jc8962.js H [4897,4958), UTF-16; sha256 cb55d917fa1cf0144432a0a913f82f3ef9b417bc6fdcb10e92bdc2e4dcb52502
var H=/\bI'?m blocked\s*[:\u2014\u2013-]\s*(.{3,200}?)(?=\n|$)/gi;

// chunk-c7jc8962.js z [4959,5211), UTF-16; sha256 c8069bdd47ce2a0a28f32a3fc1c9f09466234692951a34a0d27260d3b02d81ac
function z(e,n,t){let i;for(let[s,a]of[["failed",G],["blocked",W],["blocked",K],["blocked",H]])for(let l of n.matchAll(a)){if(b(e,t+l.index))continue;if(!i||l.index>i.index)i={state:s,capture:l[1].trim(),index:l.index,end:l.index+l[0].length}}return i}

// chunk-c7jc8962.js Oxn [5681,9996), UTF-16; sha256 67cdc70358f6612b2872287a97960ec75681b9a4962feef6b23d1baa4e045ca1
function Oxn(e){let n=e.trim();if(!n)return null;let t=n.slice(-800),i;for(let o of t.matchAll(/(?:^|\n)\s*result:\s*(.+?)\s*(?:\n|$)/gi))if(!b(n,n.length-t.length+o.index))i=o;let s=t,a=n.length-t.length;if(i){let o=i.index+i[0].length;s=t.slice(o),a=n.length-t.length+o}let l=z(n,s,a);if(i&&!l){let o=Ud(i[1],vf);if([...s.matchAll(/(?:^|\n)\s*next:\s*\S/gi)].some((T)=>!b(n,a+T.index)))return{branch:"result-then-next",state:"working",tempo:"idle",detail:o,output:{result:o}};let k=_(n,n.length-t.length+i.index);if(k?.kind==="stale")return null;if(k)return{branch:"result-approval-ask",state:"blocked",tempo:"blocked",needs:k.needs,detail:o};return{branch:"result-marker",state:"done",tempo:"idle",detail:o,output:{result:o}}}if(l?.state==="failed")return{branch:"failed-marker",state:"failed",tempo:"idle",detail:Ud(l.capture,vf),output:{}};if(l?.state==="blocked"){let o=s.slice(l.end);if(F(o.split(/\n\s*\n/),(g)=>g.trim().length>0)>=3)return null;if(!/\bnothing (?:needed|required) from you\b|\bno(?: user)? action (?:needed|required)\b/i.test(s)){let g=Ud(l.capture,vf);return{branch:"blocked-marker",state:"blocked",tempo:"blocked",needs:g,detail:g}}if(i){let g=Ud(i[1],vf);return{branch:"blocked-disclaimed",state:"done",tempo:"idle",detail:g,output:{result:g}}}return null}if(/[?\uFF1F]\s*$/.test(t)&&t.replace(/[?\uFF1F\s]+$/,"").length>=4){let o=Math.max(t.lastIndexOf(`
`),t.lastIndexOf(". "),t.lastIndexOf("! "),t.lastIndexOf("? ",t.length-2));if(!b(n,n.length-t.length+o)){let g=Ud(t.slice(o+1).trim(),vf);if(E.test(g))return null;return{branch:"trailing-q",state:"blocked",tempo:"blocked",needs:g,detail:g}}}let u=Math.max(0,t.lastIndexOf(". "),t.lastIndexOf("! "),t.lastIndexOf("? "),t.lastIndexOf(`
`)),r=t.slice(u).replace(/^[.!?\s]+/,""),c=b(n,n.length-t.length+u),h=/\b(?:waiting (?:for|on)|pending)\s+(?:the\s+)?(?:CI|build|tests?|reviewer|deploy(?:ment)?|workflow|checks?|rollout|merge queue)\b/i.exec(r);if(h&&!c)return{branch:"wait-external",state:"working",tempo:"idle",detail:Ud(h[0],vf),output:{}};if(!c)for(let o of r.matchAll(ae)){let g=I(r,o,C(r,o));if(g==="not-an-ask")continue;if(g==="defer")return null;let k=Ud(r.slice(o.index).trim(),vf);return{branch:"awaiting-user",state:"blocked",tempo:"blocked",needs:k,detail:k}}let d=/\b(please (?:run|provide|confirm|clarify|choose|let me know)|let me know (?:which|what|how|when)|which (?:option|approach|one)|should I (?:proceed|continue|use))\b/i.exec(r);if(d&&!c){let o=Ud(r.slice(d.index).trim(),vf);return{branch:"ask-verb",state:"blocked",tempo:"blocked",needs:o,detail:o}}if(!c&&/\b(not logged in|please run \/login|authentication failed|invalid api key|oauth token (?:expired|revoked)|credit balance (?:is )?too low|usage limit reached|mcp (?:server )?(?:authentication|auth|authorization|unauthorized)|mcp (?:server )?(?:credential|token) (?:missing|expired|invalid)|401 unauthorized|403 forbidden|token (?:has )?expired|bad credentials|gh auth login|gcloud auth login|aws (?:sso )?login)\b/i.test(r))return{branch:"auth-prose",state:"blocked",tempo:"blocked",needs:Ud(r,vf),detail:"authentication required"};if(!c&&J.test(r)&&!X.test(r))return{branch:"working-verb",state:"working",tempo:"active",detail:Ud(r,vf),output:{}};if(!c&&Q.test(r))return{branch:"agents-status",state:"working",tempo:"idle",detail:Ud(r,vf)};if(!c&&Z.test(r))return{branch:"will-check-back",state:"working",tempo:"idle",detail:Ud(r,vf)};if(!c&&ee.test(r)){let o=Ud(r,vf);return{branch:"cant-proceed",state:"blocked",tempo:"blocked",detail:o,needs:o}}if(!c&&te.test(r))return{branch:"giving-up",state:"failed",tempo:"idle",detail:Ud(r,vf)};if(!c&&ne.test(r)){let o=Ud(r,vf);return{branch:"pushed-committed",state:"done",tempo:"idle",detail:o,output:{result:o}}}if(!c&&ie.test(r))return{branch:"ready-for",state:"done",tempo:"idle",detail:Ud(r,vf)};if(!c&&se.test(r)){let o=Ud(r,vf);return{branch:"verdict-marker",state:"done",tempo:"idle",detail:o,output:{result:o}}}if(!c&&re.test(r)){let o=Ud(r,vf);return{branch:"please-do-x",state:"blocked",tempo:"blocked",detail:o,needs:o}}if(!c&&oe.test(r)){let o=Ud(r,vf);return{branch:"stopping-here",state:"blocked",tempo:"blocked",detail:o,needs:o}}let f=_(n,n.length-t.length);if(f?.kind==="ask")return{branch:"leading-approval-ask",state:"blocked",tempo:"blocked",needs:f.needs,detail:f.needs};return null}

// chunk-c7jc8962.js _ [9996,10586), UTF-16; sha256 0f029094e164f50e128970c3272036172dc1c77ccc0d1be4d39c99223d83439f
function _(e,n){let t=new RegExp(le);t.lastIndex=n;let i=!1;for(let s of e.matchAll(t)){if(b(e,s.index))continue;let a=C(e,s),{before:l,after:u,end:r}=a;if(!(ce.test(l)||/^\s*(?:\*\*|\))?\s*$/.test(u)&&(de.test(l)||/^ready\b/i.test(s[0])&&!/\bas\s+$/i.test(l))))continue;let h=I(e,s,a);if(h==="not-an-ask")continue;if(h==="defer")return;if(V(e,s.index)){i=!0;continue}let d=e.slice(s.index,r).trim();if(d.endsWith("**")&&d.split("**").length%2===0)d=d.slice(0,-2);else if(d.endsWith(")")&&Lt(d,")")>Lt(d,"("))d=d.slice(0,-1);return{kind:"ask",needs:Ud(d,vf)}}return i?{kind:"stale"}:void 0}

// chunk-c7jc8962.js V [10586,10789), UTF-16; sha256 3a8e210d818641e204c0447c0bec83c19a9b18a486f85ead9b1bd518be78037f
function V(e,n){let t=/\n[ \t]*\n/.exec(e.slice(n));if(!t)return!1;let i=n+t.index+1;for(let s of e.slice(i).split(`
`)){let a=i;i+=s.length+1;let l=s.trim();if(l&&!he.test(l)&&!b(e,a))return!0}return!1}

// chunk-c7jc8962.js C [10789,11128), UTF-16; sha256 4d1076fd416a6629391b787fa246a244fbeb933c212a9110f67c8d76375c33b7
function C(e,n){let t=e.slice(Math.max(0,n.index-800),n.index),i=[...t.matchAll(ue)],s=i.at(-1),a=i.at(-2),l=s?t.slice(s.index+s[0].length):t,u=s?t.slice(a?a.index+a[0].length:0,s.index+1):"",r=n.index+n[0].length,c=pe.exec(e.slice(r));return{before:l,previous:u,after:e.slice(r,c?r+c.index:e.length),end:c?r+c.index+c[0].length:e.length}}

// chunk-c7jc8962.js I [11128,11340), UTF-16; sha256 abb57c3baa819d333008eeb5cf8251417e6763154e052859fc646d7bb0290403
function I(e,n,{before:t,previous:i}){let s=t.split(ge).at(-1)??t;if(fe.test(s)||ke.test(s+n[0])||be.test(t)||E.test(t)||/\?$/.test(i)&&E.test(i))return"not-an-ask";return Re.test(e.slice(n.index))?"defer":"ask"}

// chunk-c7jc8962.js E [11499,11555), UTF-16; sha256 bf87ad7925d39513098d0310ce7007cad48939222adb2d3405c20f39d80501fb
var E=/\b(?:want|like) me to\b|\b(?:shall|should) I also\b/i;

// chunk-c7jc8962.js J [11556,12216), UTF-16; sha256 285b38ba93ca102a169e5b1f5637d943a78860c7f1dc9ef52820de8247f135c7
var J=/^(?:(?:Now|Next|Then|Alright|OK|Okay|Right|Good|First|Also),?\s+)?(?:Let me (?!know\b)|(?:I(?:'?ll| will) |I'?m going to |Going to )(?!need\b|require\b|wait\b|leave\b|hold\b|skip\b|stop\b)|Proceeding |Moving (?:on|to)\b|Continuing |Starting |Trying |Checking |Looking |Searching |Reading |Investigating |Running |Re-?running |Building |Rebuilding |Installing |Fetching |Applying |Fixing |Patching |Updating |Adding |Removing |Deleting |Importing |Refactoring |Rewriting |Writing |Grepping |Scanning |Wrapping |Switching |Testing |Verifying |Regenerating |Pushing |Pulling |Reviewing |Examining |Loading |Compiling |Parsing |Analyzing |Tracing |Exploring )/i;

// chunk-c7jc8962.js X [12217,12654), UTF-16; sha256 46bd721ba2725715d2b0741e30143d0191f638b5f0825fb86d3e02c371b1c11a
var X=/\b(?:once |when |after |until |as soon as )(?:you|it|the|that|this|they)\b|\bagain in\b|\bcheck back\b|\bin ~?\d+\s*(?:s(?:ec(?:ond)?s?)?|m(?:in(?:ute)?s?)?|h(?:ours?|rs?)?)\b|\bthen\.?\s*$|\bwhichever you\b|\bhold(?:ing)? for your\b|\b(?:to|and) wait for\b|\bgive it (?:more |some )?time\b|\bif (?:you(?:'d| want| prefer| need|'re)?|that(?:'s| helps| works)?|useful|needed|helpful|desired)\b|\b(?:isn'?t|not|won'?t) going to work\b/i;

// chunk-c7jc8962.js Q [12655,13036), UTF-16; sha256 182bb2496a5d19b84ea9d496c6506fb4c0f9c5fb306344f9ff85e0249b0a99ab
var Q=/^(?:(?:\*\*)?[1-9]\d* (?:agent|cron|task|fork|job|worker|PR|check)s? (?:in flight|remaining|active|still (?:running|working)|pending|running|launched)\b|(?:Continuous )?(?:[Ll]oop|[Cc]rons?|[Bb]abysit) (?:active|healthy|continuing|running|will keep|continues)\b|Waiting for (?:the )?(?:agent|cron|task|fork|worker|job|remaining|them)s?\b|Agents? will report back\b|Waiting\.?$)/;

// chunk-c7jc8962.js Z [13037,13183), UTF-16; sha256 d6efea0929ddd2e7310d43aa65ee4745b6caaadfa1c01063d2444d14cc0115d9
var Z=/^(?:I will|I'll|Will) (?:check back|re-?check|poll|look again|retry|re-?run|try again) (?:(?:when|once|after|until) (?!your?\b)|in\b|again\b)/i;

// chunk-c7jc8962.js ee [13184,13288), UTF-16; sha256 20c4fc80f92e77e3f0cf07ee32caa6fda30b9b9442246bc5ebeda7214790fbdf
var ee=/^I (?:can(?:'?t|not)|am unable to) (?:proceed|continue|make (?:any )?progress|complete|fix this)\b/i;

// chunk-c7jc8962.js te [13289,13360), UTF-16; sha256 c53c4b59d23c92ee003f406132087e1fe1390fb1552c5593a6127193d5c42161
var te=/^(?:Giving up|I(?:'m| am) giving up|The task is not actionable)\b/i;

// chunk-c7jc8962.js ne [13361,13482), UTF-16; sha256 8c13741250e6e5a9dce48c881f7b30241d80b34594d04163599bfc64070e9265
var ne=/^(?:Pushed (?:to `|`[0-9a-f]{7,})|Committed as `?[0-9a-f]{7,}\b|Commit: `?[0-9a-f]{7,}\b|(?:Opened|Created) PR #?\d)/;

// chunk-c7jc8962.js ie [13483,13541), UTF-16; sha256 3ac9ab127f0e62a5cbad4ebcf77e035af03f3a02512f861b6f5467b9539435f8
var ie=/^Ready (?:for review|to (?:upload|merge|ship|land))\b/;

// chunk-c7jc8962.js se [13542,13572), UTF-16; sha256 b3a8ad007d7cf340018ff8c49ff3289d86687a937eb6949122a673892ffcecb7
var se=/^VERDICT: (?:PASS|FAIL)\b/;

// chunk-c7jc8962.js re [13573,13702), UTF-16; sha256 b96d3558a202b2a6c30c7abfcdd56d06f01f7cc1f5f5f92804c892cc7eecc8bf
var re=/^Please (?:start|run|provide|grant|export|add|install|configure|give me|paste|point me|set (?:the |up |`?[A-Z][A-Z0-9_]+\b))/;

// chunk-c7jc8962.js oe [13703,13835), UTF-16; sha256 f253835ee0eef3668e826ff0d86951ee69c3727232f07228de10533916e1646a
var oe=/^(?:Stopping here|I've stopped here|Parked (?:the|this) branch|Paused here)(?:\.|$| \u2014| -| until| pending| since| because)/i;

// chunk-c7jc8962.js P [13836,13989), UTF-16; sha256 83d980203e75dcaf4d4d5c76c3dfaf041ce8f632415fe8c7ed77e4f57e6510f6
var P=String.raw`(?<!["'\u201C\u2018\x60]|\b(?:not|no longer|nothing(?: is|['\u2019]s)?|without|instead of|rather than|was|were|had been)\s+|n['\u2019]t\s+)`;

// chunk-c7jc8962.js v [13990,14143), UTF-16; sha256 02626264ee5d8ac58cd4faea0964892c0b5f7a7f0cf8a494f0c50385706511ca
var v=String.raw`${P}\b(?:awaiting|waiting (?:for|on)|pending|ready for)\s+your\s+(?:approval|confirmation|go[- ]ahead|ok(?:ay)?\b|sign[- ]?off|green light)`;

// chunk-c7jc8962.js ae [14144,14312), UTF-16; sha256 e14a970e9be425fdbd230d0f0266b61cd11c19ff25b441d1e96a57e3b8c15098
var ae=new RegExp(String.raw`${v}|${P}\b(?:awaiting|waiting (?:for|on)|pending)\s+(?:your\s+(?:feedback|input|decision|response|direction|guidance)|you\b|the user\b)`,"gi");

// chunk-c7jc8962.js le [14313,14334), UTF-16; sha256 4f4b0885adb9c4145f0c5c083c29a07ac67516cfc40a846e83c602583c4d26ca
var le=new RegExp(v,"gi");

// chunk-c7jc8962.js O [14335,14416), UTF-16; sha256 214af70a818b7b5b522ac5e8b3c578e12a4c1d22553bdb554bc93d9a9dfe7ea6
var O=String.raw`(?:\*\*|\()?(?:(?:I['\u2019]?m|I am|still|now|currently|just)\s+)*$`;

// chunk-c7jc8962.js ce [14417,14471), UTF-16; sha256 d582afa5af86e602ef7812c20d21632e5f4dae5717d295c35db82cfb45d58b94
var ce=new RegExp(String.raw`^\s*(?:result:\s*)?${O}`,"i");

// chunk-c7jc8962.js de [14472,14540), UTF-16; sha256 3cca79982085a7335beb8d0c12b1a31633fe94ed15cab08a0654bd56d06953d0
var de=new RegExp(String.raw`(?:[:;,\u2014\u2013]|\s-|\s\()\s*${O}`,"i");

// chunk-c7jc8962.js ue [14541,14570), UTF-16; sha256 577c210850e0a05cef4232bccacd404fbcfd92b58d65a5706f5a58a2f217da0f
var ue=/[.!?](?:\*\*|\))?\s+|\n/g;

// chunk-c7jc8962.js pe [14571,14621), UTF-16; sha256 ee72cf19bec527e8a70e04e43fa00529b8d9410f16369aba6a4cc5ba7653e332
var pe=/[.!?](?:\*\*|\)|["'\u2019\u201D])*(?=\s|$)|\n/;

// chunk-c7jc8962.js ge [14622,14677), UTF-16; sha256 ef5103a2b39bafd8e1a232a6da434b29bfc8e612d7716891c8e386d826bc4984
var ge=/[,;:\u2014\u2013(]|\s-\s|\b(?:and|but|so|while)\b/i;

// chunk-c7jc8962.js he [14678,14746), UTF-16; sha256 1a43d98f4a8c7c8a34e2948686f2fd2f1047f6c1f5c55e7a32c691df45076da8
var he=/^(?:```|~~~|[-+>|@]|[*\u2022]\s|\d+[.)]\s|#{1,6}\s)|:(?:\*\*)?$/;

// chunk-c7jc8962.js fe [14747,14819), UTF-16; sha256 bd6ee1bc385c8e4716d2639a308f15d31a2ae12e57a1d0c40c93a12812e0f991
var fe=/\b(?:no|not|nothing|none|never|nobody|neither|nor)\b|n['\u2019]t\b/i;

// chunk-c7jc8962.js be [14820,14918), UTF-16; sha256 49376f4da8edefa4479b1d8d7ba3f346f978a5dd0dc1147798d02890336faab0
var be=/\bif you(?:['\u2019]d like| want| prefer| like)\b|\bI can also\b|\bhappy to\b|\boptionally\b/i;

// chunk-c7jc8962.js ke [14919,15043), UTF-16; sha256 0d72a0fe5f976e482172eb2a74dd43a45e16fba05bb7dbe742497c53222104d1
var ke=/\b(?:once|when|after|until|as soon as)\s+(?:it|the|that|this|they)\b|\b(?:will|['\u2019]ll)\s+be\s+(?:ready|pending)\b/i;

// chunk-c7jc8962.js Re [15044,15238), UTF-16; sha256 bfc191641f866756775d0bde44b226f2574143fc242d24673539cac197a41b93
var Re=/\bnext check\b|\bagain in\b|\bre-?poll|\bpoll(?:ing)? again\b|\bshepherding\b|\b(?:check(?:ing)? (?:back|again)|re-?check(?:ing)?|report(?:ing)?(?: back)?) (?:in|when|once|after)\b(?! you)/i;

export { Oxn as sourcePeerStatusDetail };
