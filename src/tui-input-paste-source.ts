// @ts-nocheck
// Exact source bodies: research/ports/W44-paste-copies.json.
function D(n){return[...new Set(n)]}
var QTo=/[([{"'`]/;
var ZTo=/[)\]}"'`.,;:!?]/;
var RDe="\u2726 Team setup guide";
var Xp=String.raw`Pasted text|Image|\.\.\.Truncated text|${"\u2726 Team setup guide"}`;
var AE=new RegExp(String.raw`\[(${Xp}) #(\d+)(?: \+\d+ lines)?(\.)*\]`,"g");
function sa(e){let n=new Uint16Array(e.length);for(let r=0;r<e.length;r++)n[r]=e.charCodeAt(r);return n}
function em(e){let n=new Int32Array(e.length);for(let r=1,s=0;r<e.length;r++){while(s>0&&e[r]!==e[s])s=n[s-1];if(e[r]===e[s])s++;n[r]=s}return n}
var eW=8;
var tW=1024;
function bPn(e){let n,r=new Map;return(s)=>{let h=r.get(s);if(h!==void 0)return h;let y=s.slice(0,eW),b=s.length>e.length?-1:e.indexOf(y);if(b===-1){let V=()=>-1;return r.set(s,V),V}let w=sa(s),R=em(w),T=w.length-R.at(-1),P=[],M=[],z=n??=sa(e);for(let V=b,X=0;V<z.length;V++){if(X===0){let ee=e.indexOf(y,V);if(ee===-1)break;V=ee+y.length-1,X=y.length-1}let Z=z[V];while(X>0&&Z!==w[X])X=R[X-1];if(Z===w[X])X++;if(X===w.length){let ee=V+1-w.length,le=M.length-1;if(le>=0&&ee-M[le]===T)M[le]=ee;else P.push(ee),M.push(ee);X=R[X-1]}}let N=(V)=>{let X=0,Z=M.length;while(X<Z){let le=X+Z>>1;if(M[le]<V)X=le+1;else Z=le}let ee=P[X];if(ee===void 0)return-1;return V>ee?ee+Math.ceil((V-ee)/T)*T:ee};if(P.length<=tW)r.set(s,N);return N}}
var rW=/[\p{L}\p{N}_@#./\\]/u;
function tm(e,n,r,s,h,y,b){if(!y){let R=n-1;while(R>=s&&QTo.test(e[R]))R=R<=b.openersTo&&R>=b.openersFrom?b.openersFrom-1:R-1;if(n-1>=s&&R<n-1)b.openersFrom=Math.max(R+1,s),b.openersTo=n-1;if(R>=s&&rW.test(e[R]))return!1}let w=r;while(w<h&&ZTo.test(e[w]))w=w>=b.closersFrom&&w<b.closersTo?b.closersTo:w+1;if(w=Math.min(w,h),w>r)b.closersFrom=r,b.closersTo=w;return w>=h||/\s/.test(e[w])}
function ME(){return{openersFrom:0,openersTo:-1,closersFrom:0,closersTo:0}}
function Ldr(e,n,r=bPn(e)){let s=nm(e,n,r,!0,"anyCopy");return uu([...s.spans,...nm(e,n,r,!1,"anyCopy").spans,...s.skipped?nm(e,n,r,!0,"standingCopy").spans:[]])}
function nm(e,n,r,s,h){let y=[],b=[],w=!1,R=D(n).filter((T)=>T!=="").sort((T,P)=>P.length-T.length);for(let T of R){let P=r(T),M=[],z=[],N=ME(),V=0,X=0,Z=y[0]?.from??e.length,ee=0,le=0;for(;;){let re=P(ee);if(re===-1)break;let te=re+T.length;if(te>Z||re<X){while(V<y.length&&re>=y[V].from)X=y[V].to,V++;if(Z=y[V]?.from??e.length,te<=X){ee=X-T.length+1;continue}let de=re>=X&&te<=Z,Se=!1;if(!de&&tm(e,re,te,X,Z,re===le,N)){let ge=re<X?P(X):-1,he=ge!==-1&&ge<Math.min(te,Z);if(he&&h==="standingCopy"){let ye=X;while(ye<ge&&/\s/.test(e[ye]))ye++;he=ye===ge&&tm(e,ge,ge+T.length,X,Z,ge===X,ME())}if(he)w=!0;else z.push({from:re,to:te}),Se=!0}if(re>=X&&te>Z)X=y[V].to,V++,Z=y[V]?.from??e.length,ee=te;else ee=Math.max(re,X);le=s&&Se?Math.max(te,X):X;continue}if(tm(e,re,te,X,Z,re===le,N))M.push({from:re,to:te}),le=te;ee=te}if(s){if(M.length>0||z.length>0)y=uu([...y,...M,...z]);continue}if(M.length>0)y=[...y,...M].sort((re,te)=>re.from-te.from);if(z.length>0)b=uu([...b,...z])}return{spans:b.length===0?y:uu([...y,...b]),skipped:w}}
function uu(e){let n=[];for(let r of e.sort((s,h)=>s.from-h.from)){let s=n.at(-1);if(s!==void 0&&r.from<s.to)s.to=Math.max(s.to,r.to);else n.push({...r})}return n}
function HF(e){return(e.match(/\r\n|\r|\n/g)||[]).length}
function tJ(e,n,r="Pasted text"){if(n===0)return`[${r} #${e}]`;return`[${r} #${e} +${n} lines]`}
function Jd(e){if(!e)return[];return[...e.matchAll(AE)].map((r)=>({id:parseInt(r[2]||"0"),match:r[0],index:r.index})).filter((r)=>r.id>0)}
function F4t(e){return Number.isInteger(e)&&e>0&&e<4294967296}
function sce(e,n,r,s){return UE(BE(e,Jd(e),n,!1,r),s,r,VAe(n))}
var pW=/^[\p{M}\u1161-\u1175\u11A8-\u11C2\u{16D67}\u{16D68}]+/u;
function hAt(e){let n=e.normalize("NFC"),r=n.replace(pW,"").trimStart();return D([e,n,r]).filter((s)=>s!=="")}
function VAe(e,n=!1){let r=new Set;for(let s of Object.values(e))if(s.type==="text"&&s.inline&&s.content!==""&&(n||!s.slashNameOnly))for(let h of hAt(s.content))r.add(h);return[...r].sort((s,h)=>h.length-s.length)}
function $E(e){return e.startsWith("[Pasted text")||e.startsWith(`[${RDe}`)}
function BE(e,n,r,s,h){let y=[],b=e.length;for(let w=n.length-1;w>=0;w--){let R=n[w];y.unshift({text:e.slice(R.index+R.match.length,b),typed:!0}),b=R.index;let T=r[R.id];if(T?.unavailable===!0){if(!s||R.match.startsWith("[Image"))y.unshift({text:R.match,typed:!0});continue}if(T?.type!=="text"){y.unshift({text:R.match,typed:!0});continue}if(!$E(R.match)||!h){y.unshift({text:T.content,typed:!0});continue}y.unshift({text:h(T.content),typed:!1})}return y.unshift({text:e.slice(0,b),typed:!0}),y}
function UE(e,n,r,s=[]){if(!n&&!r)return e.map((T)=>T.text).join("");let h=n??((T)=>T),y=[],b="",w=()=>{if(b==="")return;if(r&&s.length>0)y.push(...gW(b,s,r).map((T)=>T.typed?{text:h(T.text),typed:!0}:T));else y.push({text:h(b),typed:!0});b=""};for(let T of e){if(T.typed){b+=T.text;continue}w(),y.push(T)}w();let R="";for(let T=0;T<y.length;T++){let P=y[T];R+=P.text;let M=y[T+1]?.text??"";if(!P.typed&&M!==""&&!M.startsWith(`
`))R+=`
`}return R}
function gW(e,n,r){let s=[],h=0;for(let y of Ldr(e,n)){if(y.from>h)s.push({text:e.slice(h,y.from),typed:!0});s.push({text:r(e.slice(y.from,y.to)),typed:!1}),h=y.to}if(h<e.length||s.length===0)s.push({text:e.slice(h),typed:!0});return s}
var fVe=1e5;
function U4t(e,n){let r=null;for(let h of Jd(e)){let y=n[h.id];if(y?.type!=="text"||y.unavailable)continue;if(!r||h.id>r.id)r=h}if(!r)return null;let s=n[r.id].content;if(s.length>fVe)return null;return{expanded:e.slice(0,r.index)+s+e.slice(r.index+r.match.length),id:r.id,cursorOffset:r.index+s.length}}
var Pct=2147483648;
class Mct{next=1;minted=new Set;flooredSessionId=null;carrierProviders=new Set;registerCarrier(e){return this.carrierProviders.add(e),()=>{this.carrierProviders.delete(e)}}advancePast(e){if(F4t(e)&&e<Pct&&e>=this.next)this.next=e+1}advancePastText(e){for(let n of Jd(e))this.advancePast(n.id)}startEpoch(e){this.minted=new Set,this.flooredSessionId=e}mint(){for(let n of this.carrierProviders)for(let r of n())this.advancePastText(r);if(!F4t(this.next))this.next=Pct;let e=this.next++;return this.minted.add(e),e}wasMintedThisEpoch(e){return this.minted.has(e)}}
function Ict(e,n,r){if(n)e.advancePastText(n);if(r)for(let s of Object.keys(r))e.advancePast(Number(s));return e.mint()}
function U5r(e){return null?.isSetupGuidePaste(e)??!1}
function B5r(e){return null?.isSetupGuideLink(e)??!1}
var $q=800;
export function initializePasteSource({M,pn,In,Pw,Pq,dr,ji,wa,allocator=new Mct}) {
const hA=(text,contents)=>Ict(allocator,text,contents);
const x_=()=>"prompt",Qn=()=>{},sI=text=>text,g=()=>{},WT=()=>false,upe=()=>false,__e=text=>({text}),mpe=()=>false,sY=contents=>contents;
const Bo=()=>{},Ei={current:null},ys={setTimeout:()=>null};
function xM(B7){let nC=wa.current==="link"?" ":"";wa.current=!1;let{value:dL,pastedContents:Aq}=M;let Xu=pn(B7).replace(/\r\n|\r/g,`
`).replaceAll("\t","    ");if(dL.length===0){let U7=x_(Xu);if(U7!=="prompt")Qn(U7),Xu=sI(Xu)}let Px=Xu.trim();let Rw=B5r(Px);if(Rw)Xu=Px;let TS=ji.current;if(TS!==null&&Aq[TS]?.type==="text"&&Aq[TS].content===Xu&&Pq(TS)){return}let cy=HF(Xu);let j7=Math.max(0,Math.min(dr-10,2));if(Xu.length>$q||cy>j7||Rw){if(!Rw)g("input_paste_large");let cL=hA(dL,Aq);ji.current=cL;let Oxe={id:cL,type:"text",content:Xu};if(In((TM)=>({...TM,[cL]:Oxe})),Pw(nC+tJ(cL,cy,Rw||U5r(Xu)?RDe:void 0)),Rw)wa.current="link";if(Xu.length<=fVe)Bo(!0),Ei.current?.(),Ei.current=ys.setTimeout(()=>{Bo(!1),Ei.current=null},8000)}else{let $7=WT()&&(upe(Xu)||HF(__e(Xu).text)>j7);if($7||mpe(Xu))In((Nxe)=>sY(Nxe,Xu,$7));Pw(nC+Xu,{isTyped:!0})}}
return {paste:xM};
}
export {HF,tJ,Jd,U4t,sce,Mct,Ict,BE,UE,VAe,F4t,RDe};
