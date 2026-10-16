// @ts-nocheck
// Source copies and raw-input adaptations: research/ports/W44-vim-copies.json.
import {ra} from "./tui-graphemes.js";
function ewe(e){if(!e)return"";return ra().segment(e)[Symbol.iterator]().next().value?.segment??""}
function GB(e){if(!e)return"";let t="";for(let{segment:r}of ra().segment(e))t=r;return t}
function AZ(e){if(!e)return 0;let t=0;for(let r of ra().segment(e))t++;return t}
function Lt(t,n,e=0){let r=0,i=t.indexOf(n,e);while(i!==-1)r++,i=t.indexOf(n,i+1);return r}
function mAt(e){return e.startsWith("[Image")}
var sr=/^[\p{L}\p{N}\p{M}_]+$/u;
var Se=/\s/;
var bje=(e)=>sr.test(e);
var zXe=(e)=>Se.test(e);
var VXe=(e)=>e.length>0&&!zXe(e)&&!bje(e);
var nPe=8;
export function initializeVimSource({Si,ae,R,y,le,xP}) {
const ki=()=>lo(),g=()=>{},J1o=()=>false;
function Wt(l,h){if(h?.offset===l.offset&&h.text===l.text)return h.column;let O=l.startOfLogicalLine().offset,x=Js(l.text,O,l.offset);return l.text[l.offset]==="\t"?x+Qn("\t",x)-1:x}
function Js(l,h,O){let x=0;for(let{segment:I}of ra().segment(l.slice(h,O)))x+=Qn(I,x);return x}
function jt(l,h,O,x){let I=0;for(let{segment:T,index:_}of ra().segment(l.slice(h,O)))if(I+=Qn(T,I),I>x)return h+_;return O}
function Qn(l,h){return l==="\t"?nPe-h%nPe:ae(l)}
var cn={d:"delete",c:"change",y:"yank"};
function Zn(l){return l in cn}
var rt="\b";
var fn=new Set(["h","l"," ",rt,"j","k","w","b","e","W","B","E","0","^","$"]);
var Bt=new Set(["h","l"," ",rt]);
var dn=new Set(["f","F","t","T"]);
var pn={i:"inner",a:"around"};
function er(l){return l in pn}
var tr=new Set(["w","W",'"',"'","`","(",")","b","[","]","{","}","B","<",">"]);
var io=1e4;
function ao(){return{mode:"INSERT",insertedText:""}}
function lo(){return{lastFind:null,register:"",registerIsLinewise:!1}}
function gt(l,h,O){let x=h;for(let I=0;I<O;I++){let T=Qs(l,x);if(T.equals(x))break;x=T}return x}
function Qs(l,h){switch(l){case"h":return h.offset===h.startOfLogicalLine().offset?h:h.left();case"l":return h.offset===h.endOfLogicalLine().offset?h:h.right();case" ":return h.right();case rt:return h.left();case"j":return h.downLogicalLine();case"k":return h.upLogicalLine();case"gj":return h.down();case"gk":return h.up();case"w":return h.nextVimWord();case"b":return h.prevVimWord();case"e":return h.endOfVimWord();case"W":return h.nextWORD();case"B":return h.prevWORD();case"E":return h.endOfWORD();case"0":return h.startOfLogicalLine();case"^":return h.firstNonBlankInLogicalLine();case"$":return h.lastCharInLogicalLine();case"G":return h.startOfLastLine();default:return h}}
function nr(l){return"eE$".includes(l)}
function co(l){return"jkG".includes(l)||l==="gg"}
var Zs={"(":["(",")"],")":["(",")"],b:["(",")"],"[":["[","]"],"]":["[","]"],"{":["{","}"],"}":["{","}"],B:["{","}"],"<":["<",">"],">":["<",">"],'"':['"','"'],"'":["'","'"],"`":["`","`"]};
function mn(l,h,O,x){if(O==="w")return fo(l,h,x,bje);if(O==="W")return fo(l,h,x,(T)=>!zXe(T));let I=Zs[O];if(I){let[T,_]=I;return T===_?ei(l,h,T,x):ti(l,h,T,_,x)}return null}
function fo(l,h,O,x){let I=[];for(let{segment:B,index:z}of ra().segment(l))I.push({segment:B,index:z});if(I.length===0)return null;let T=I.length-1;for(let B=0;B<I.length;B++){let z=I[B],ye=B+1<I.length?I[B+1].index:l.length;if(h>=z.index&&h<ye){T=B;break}}let _=(B)=>I[B]?.segment??"",A=(B)=>B<I.length?I[B].index:l.length,U=(B)=>zXe(_(B)),F=(B)=>x(_(B)),K=(B)=>VXe(_(B)),j=T,G=T;if(F(T)){while(j>0&&F(j-1))j--;while(G<I.length&&F(G))G++}else if(U(T)){while(j>0&&U(j-1))j--;while(G<I.length&&U(G))G++;return{start:A(j),end:A(G)}}else if(K(T)){while(j>0&&K(j-1))j--;while(G<I.length&&K(G))G++}if(!O){if(G<I.length&&U(G))while(G<I.length&&U(G))G++;else if(j>0&&U(j-1))while(j>0&&U(j-1))j--}return{start:A(j),end:A(G)}}
function ei(l,h,O,x){let I=l.lastIndexOf(`
`,h-1)+1,T=l.indexOf(`
`,h),_=T===-1?l.length:T,A=l.slice(I,_),U=h-I,F=[];for(let K=0;K<A.length;K++)if(A[K]===O)F.push(K);for(let K=0;K<F.length-1;K+=2){let j=F[K],G=F[K+1];if(j<=U&&U<=G)return x?{start:I+j+1,end:I+G}:{start:I+j,end:I+G+1}}return null}
function ti(l,h,O,x,I){let T=0,_=-1;for(let U=h;U>=0;U--)if(l[U]===x&&U!==h)T++;else if(l[U]===O){if(T===0){_=U;break}T--}if(_===-1)return null;T=0;let A=-1;for(let U=_+1;U<l.length;U++)if(l[U]===O)T++;else if(l[U]===x){if(T===0){A=U;break}T--}if(A===-1)return null;return I?{start:_+1,end:A}:{start:_,end:A+1}}
function St(l,h,O,x){let I=gt(h,x.cursor,O);if(co(h)){let A=qe(x.text,x.cursor.offset),U=qe(x.text,I.offset);if(U!==A){let F=kt(x.text,I.offset),K=x.text.indexOf(`
`,F),j=K===-1?x.text.length:K,G=jt(x.text,F,j,Wt(x.cursor,x.wantedColumn)),B=G===j&&j>F&&GY(x.cursor,j)===j?x.cursor.measuredText.prevOffset(j):G,z=h==="k"?Tn(x.cursor,B,F):Math.min(x.cursor.offset,I.offset);In(l,A,U,x,z),st(x,{type:"operator",op:l,motion:h,count:O})}return}if(I.equals(x.cursor)&&!nr(h)){let A=(h==="w"||h==="W")&&O>0;if(h==="0"||h==="^"||A||Bt.has(h)){if(l==="yank")x.setRegister("",!1);else if(l==="change")x.enterInsert(x.cursor.offset);st(x,{type:"operator",op:l,motion:h,count:O})}return}let T=ni(x.cursor,I,h,l,O);if(T.from===T.to&&!(T.linewise&&h===" ")){if(l==="change"||l==="yank")x.setRegister("",!1);if(l==="change")x.enterInsert(T.from),st(x,{type:"operator",op:l,motion:h,count:O});return}let _=x.cursor.offset;if(On(l,T.from,T.to,x,T.linewise),l==="yank"&&T.linewise)x.setOffset(_);st(x,{type:"operator",op:l,motion:h,count:O})}
function gn(l,h,O,x,I){let T=I.cursor.findCharacter(O,h,x);if(T===null)return;let _=new Si(I.cursor.measuredText,T),A=ri(I.cursor,_,h);On(l,A.from,A.to,I),I.setLastFind(h,O),st(I,{type:"operatorFind",op:l,find:h,char:O,count:x})}
function hn(l,h,O,x,I){let T=mn(I.text,I.cursor.offset,O,h==="inner");if(!T)return;On(l,T.start,T.end,I);let{start:_}=T,A=h==="inner"&&x===1&&_>0&&"([{<".includes(I.text[_-1]??" ")&&I.text[_]===`
`;if(l==="yank"&&A)I.setOffset(_+1);st(I,{type:"operatorTextObj",op:l,objType:O,scope:h,count:x})}
function wt(l,h,O){if(h<1)return;let x=qe(O.text,O.cursor.offset);if(h>1&&!O.cursor.text.includes(`
`,O.cursor.offset))return;let{offset:I}=O.cursor,T=O.text[I]===`
`?O.cursor.placeholderEndingAt(I):null,_=T!==null&&mAt(O.text.slice(T.start,T.end));In(l,x,x+h-1,O,_?O.cursor.startOfLogicalLine().offset:I),st(O,{type:"operator",op:l,motion:l[0],count:h})}
function bn(l,h){let O=h.cursor.offset;if(O>=h.text.length)return;let x=mo(h,l);if(x===O)return;let I=h.text.slice(O,x),T=h.text.slice(0,O)+h.text.slice(x);h.setRegister(I,!1),h.setText(T),h.setOffset(hee(T,O)),h.recordChange({type:"x",count:l})}
function yn(l,h){let O=h.cursor.offset,x=mo(h,l);if(x>O)h.setRegister(h.text.slice(O,x),!1),h.setText(h.text.slice(0,O)+h.text.slice(x));h.enterInsert(O),h.recordChange({type:"substitute",count:l})}
function vn(l,h,O){let x=O.cursor.offset,I=O.text,T=x;for(let _=0;_<h;_++){if(T>=I.length||I[T]===`
`)return;T+=ewe(I.slice(T)).length||1}O.setText(I.slice(0,x)+l.repeat(h)+I.slice(T)),O.setOffset(x+l.length*(h-1)),O.recordChange({type:"replace",char:l,count:h})}
function xn(l,h){let O=h.cursor.measuredText.columns,x=h.text,I=h.cursor.offset,T=0;while(I<x.length&&x[I]!==`
`&&T<l){let A=ewe(x.slice(I)),U=A.length,F=(A===A.toUpperCase()?A.toLowerCase():A.toUpperCase());x=x.slice(0,I)+F+x.slice(I+U),I+=F.length,T++}if(T===0)return;let _=Si.fromText(x,O);h.setText(x),h.setOffset(GY(_,I)),h.recordChange({type:"toggleCase",count:l})}
function or(l,h){let O=h.text.split(`
`),x=qe(h.cursor.text,h.cursor.offset);if(x>=O.length-1){if(l>=3)h.setOffset(kt(h.cursor.text,h.cursor.offset)),h.recordChange({type:"join",count:2});return}let I=Math.min(Math.max(l,2)-1,O.length-x-1);po(O,x,I,h)}
function po(l,h,O,x){let I=l[h],T=I.length,_=I;for(let F=1;F<=O;F++){T=I.length;let K=l[h+F].replace(/^[ \t\r]+/,"");if(K.length>0&&I.length>0&&!K.startsWith(")")&&!/[ \t]$/.test(_))I+=" ";I+=K,_=K}let A=[...l.slice(0,h),I,...l.slice(h+O+1)],U=A.join(`
`);x.setText(U),x.setOffset(hee(U,ht(A,h)+T)),x.recordChange({type:"join",count:O+1})}
function Ht(l,h,O){let x=O.getRegister();if(!x)return;O.recordChange({type:"paste",after:l,count:h});let I=O.getRegisterIsLinewise(),T=I&&x.endsWith(`
`)?x.slice(0,-1):x;if(I){let _=O.text,A=_.split(`
`),U=qe(O.cursor.text,O.cursor.offset),F=l?U+1:U,K=T.split(`
`),j=[];for(let me=0;me<h;me++)j.push(...K);let G=[...A.slice(0,F),...j,...A.slice(F)],B=G.join(`
`),z=ht(G,F),ye=Si.fromText(K[0]??"",O.cursor.measuredText.columns),Te=Vn(ye);O.setText(B,{previous:{value:_,cursorOffset:z}}),O.setOffset(z+(ye.placeholderStartingAt(Te)?0:Te))}else{let _=T.repeat(h),A=O.cursor.offset,U=O.text[A]===`
`&&(A===0||O.text[A-1]===`
`),F=l&&A<O.text.length&&!U?O.cursor.measuredText.nextOffset(A):A,K=O.text.slice(0,F)+_+O.text.slice(F),j=_.includes(`
`)?hee(K,F):F+_.length-(GB(_).length||1);O.setText(K,{previous:{value:O.text,cursorOffset:F}}),O.setOffset(j)}}
function Cn(l,h,O){let I=O.text.split(`
`),T=qe(O.cursor.text,O.cursor.offset);if(h>1&&T===I.length-1)return;let _=Math.min(h,I.length-T);sr(I,T,T+_-1,l);let A=I.join(`
`),U=zt(I[T]??"");O.setText(A),O.setOffset(ht(I,T)+U),O.recordChange({type:"indent",dir:l,count:h})}
function $t(l,h){let O=h.text,x=O.split(`
`),I=qe(h.cursor.text,h.cursor.offset),T=l==="below"?I+1:I,_=[...x.slice(0,T),"",...x.slice(T)],A=_.join(`
`),U=ht(_,T);h.setText(A,{previous:{value:O,cursorOffset:U}}),h.enterInsert(U),h.recordChange({type:"openLine",direction:l})}
function st(l,h){if(h.op!=="yank")l.recordChange(h)}
function mo(l,h){let O=l.cursor;for(let x=0;x<h&&!O.isAtEnd();x++){if(l.text[O.offset]===`
`)break;O=O.right()}return O.offset}
function ht(l,h){return l.slice(0,h).join(`
`).length+(h>0?1:0)}
function ni(l,h,O,x,I){let T=Math.min(l.offset,h.offset),_=Math.max(l.offset,h.offset),A=!1,U=x==="change"&&(O==="w"||O==="W"),F=l.text[l.offset],K=(F===" "||F==="\t"||F===`
`)&&l.snapOutOfPlaceholder(l.offset,"start")===l.offset;if(U&&K){let j=l;for(let G=0;G<I-1;G++){let B=O==="w"?j.nextVimWord():j.nextWORD();if(B.offset===j.offset)break;j=B}if(_=Math.min(_,j.endOfLogicalLine().offset),_>T&&l.text[_-1]===`
`){_-=1;let G=l.startOfLogicalLine().offset;if(/^[ \t]*$/.test(l.text.slice(G,T)))T=G,A=!0}}else if(U){let j=l;for(let Te=0;Te<I-1;Te++)j=O==="w"?j.nextVimWord():j.nextWORD();let G=O==="w"?j.endOfVimWord():j.endOfWORD(),B=l.measuredText.nextOffset(j.offset),z=O==="w"?j.nextVimWord():j.nextWORD();if((B>=l.text.length||zXe(l.text[B]??"")||z.offset===B)&&!zXe(l.text[l.offset]??"")&&!zXe(l.text[j.offset]??""))G=j;_=l.measuredText.nextOffset(G.offset)}else if(nr(O)&&l.offset<=h.offset&&l.text[_]!==`
`)_=l.measuredText.nextOffset(_);if(O===" "&&_>T&&l.text[_-1]===`
`){let j=kt(l.text,T);A=/^[ \t]*$/.test(l.text.slice(j,T)),T=A?j:T,_=A&&x!=="change"?_:_-1}return T=l.snapOutOfPlaceholder(T,"start"),_=l.snapOutOfPlaceholder(_,"end"),{from:T,to:_,linewise:A}}
function ri(l,h,O){let x=Math.max(l.offset,h.offset),I=l.snapOutOfPlaceholder(Math.min(l.offset,h.offset),"start"),T=l.snapOutOfPlaceholder(l.measuredText.nextOffset(x),"end");return{from:I,to:T}}
function On(l,h,O,x,I=!1){let T=x.text.slice(h,O);if(I&&!T.endsWith(`
`))T=T+`
`;if(x.setRegister(T,I),l==="yank")x.setOffset(GY(x.cursor,h));else if(l==="delete"){let _=x.text.slice(0,h)+x.text.slice(O);x.setText(_),x.setOffset(hee(_,h))}else if(l==="change"){let _=x.text.slice(0,h)+x.text.slice(O);x.setText(_),x.enterInsert(h)}}
function hee(l,h){if(l[h]===`
`&&h>0&&l[h-1]!==`
`)return h-(GB(l.slice(0,h)).length||1);if(h>=l.length&&!l.endsWith(`
`))return Math.max(0,l.length-(GB(l).length||1));return h}
function Tn(l,h,O){let x=rr(l,h),I=h;while(x&&x.start>O)I=l.measuredText.prevOffset(x.start),x=rr(l,I);if(!x)return I;let T=x.end;while(x=rr(l,T))T=x.end;return T}
function rr(l,h){let O=l.snapOutOfPlaceholder(h,"start");return l.placeholderStartingAt(O)}
function GY(l,h,O=l.text){let x=hee(O,h);return l.snapOutOfPlaceholder(x,"start")===x?x:h}
function kt(l,h){if(h===0)return 0;let O=l.lastIndexOf(`
`,h-1);return O===-1?0:O+1}
function Rn(l,h){if(h){let O=Lt(l,`
`);return l.endsWith(`
`)?O:O+1}return AZ(l)}
function Gt(l,h,O){let x=l.text;if(O){let _=kt(x,l.cursor.offset),A=_;for(let U=0;U<h;U++){let F=x.indexOf(`
`,A);if(F===-1){A=x.length;break}A=F+1}return{from:_,to:A}}let I=l.cursor.offset,T=I;for(let _=0;_<h&&T<x.length;_++)T=l.cursor.measuredText.nextOffset(T);return{from:I,to:T}}
function Sn(l,h,O){let x=Math.min(l,h.cursor.offset),I=Math.max(l,h.cursor.offset);if(!O)return{from:x,to:h.cursor.measuredText.nextOffset(I)};let T=h.text,_=kt(T,x),A=T.indexOf(`
`,I),U=A===-1?T.length:A+1;return{from:_,to:U}}
function sr(l,h,O,x){for(let T=h;T<=O;T++){let _=l[T]??"";if(_==="")continue;if(x===">")l[T]="  "+_;else if(_.startsWith("  "))l[T]=_.slice(2);else if(_.startsWith("\t"))l[T]=_.slice(1);else{let A=0;while(A<_.length&&A<2&&/\s/.test(_[A]))A++;l[T]=_.slice(A)}}}
function go(l,h,O){let x=Math.min(l,h.cursor.offset),I=Math.max(l,h.cursor.offset),T=h.text,_=Lt(T.slice(0,x),`
`),A=Lt(T.slice(x,I),`
`)+1,U=T.split(`
`);if(_>=U.length-1){h.setOffset(O?kt(h.cursor.text,x):hee(h.cursor.text,x)),h.recordChange({type:"join",count:2});return}let F=Math.max(1,Math.min(A-1,U.length-_-1));po(U,_,F,h)}
function ho(l,h){let O=h.text.split(`
`);if(qe(h.cursor.text,h.cursor.offset)<O.length-1)or(l,h)}
function bo(l,h,O,x){let I=Math.min(O,x.cursor.offset),T=Math.max(O,x.cursor.offset),_=x.text,A=Lt(_.slice(0,I),`
`),U=A+Lt(_.slice(I,T),`
`),F=_.split(`
`);for(let G=0;G<h;G++)sr(F,A,U,l);let K=F.join(`
`),j=zt(F[A]??"");x.setText(K),x.setOffset(ht(F,A)+j),x.recordChange({type:"visualIndent",dir:l,count:h,lines:U-A+1})}
function yo(l,h,O,x){let I=x.text,T=I.split(`
`),_=Lt(I.slice(0,x.cursor.offset),`
`),A=Math.min(_+O-1,T.length-1);for(let K=0;K<h;K++)sr(T,_,A,l);let U=T.join(`
`),F=zt(T[_]??"");x.setText(U),x.setOffset(ht(T,_)+F)}
function xo(l,h,O,x,I,T=!1){if(I&&l==="change"){let _=x.text.slice(h,O),A=_;if(!A.endsWith(`
`))A+=`
`;x.setRegister(A,!0);let U=x.text.slice(0,h),F=x.text.slice(O),K=F!==""||_.endsWith(`
`)&&!T;x.setText(U+(K?`
`:"")+F),x.enterInsert(h);return}if(I&&l==="delete"){let _=x.text.slice(h,O);if(!_.endsWith(`
`))_+=`
`;x.setRegister(_,!0);let A=h;if(O===x.text.length&&h>0&&x.text[h-1]===`
`)A-=1;let U=O<x.text.length,F=x.text.slice(0,A)+x.text.slice(O);x.setText(F);let K=U?h:kt(F,F.length),j=F.indexOf(`
`,K),G=j===-1?F.length:j,B=Si.fromText(F.slice(K,G),x.cursor.measuredText.columns+1),z=Lo(B,U),ye=!U&&B.placeholderStartingAt(z)!==null;x.setOffset(ye?hee(F,F.length):K+z);return}On(l,h,O,x,I)}
function Co(l,h,O,x){let{from:I,to:T}=Sn(h,O,x),_=Rn(O.text.slice(I,T),x),A=x&&O.text.endsWith(`
`)&&Math.max(h,O.cursor.offset)>=O.text.length;xo(l,I,T,O,x,A),st(O,{type:"visualOp",op:l,span:_,linewise:x})}
function Oo(l,h,O,x){let{from:I,to:T}=Gt(x,h,O);if(I===T&&!(O&&x.text.length>0))return;xo(l,I,T,x,O)}
function Ro(l,h,O){let{from:x,to:I}=Gt(O,l,h);if(x===I&&!h)return;let T=O.text.slice(x,I),_=T;if(h&&!_.endsWith(`
`))_+=`
`;O.setRegister(_,h);let A=O.text.slice(I),U=h&&(A!==""||T.endsWith(`
`))?`
`+A:A;O.setText(O.text.slice(0,x)+U),O.enterInsert(x)}
function So(l,h,O,x){let I=x.text.slice(h,O),T="";for(let{segment:U}of ra().segment(I))T+=U===`
`?`
`:l;let _=x.text.slice(0,h)+T+x.text.slice(O),A=x.cursor;x.setText(_),x.setOffset(GY(A,h,_))}
function wo(l,h,O,x){let{from:I,to:T}=Sn(h,O,x),_=Rn(O.text.slice(I,T),x);So(l,I,T,O),O.recordChange({type:"visualReplace",char:l,span:_,linewise:x})}
function ko(l,h,O,x){let{from:I,to:T}=Gt(x,h,O);if(I===T)return;So(l,I,T,x)}
function Io(l,h,O,x){let I=x.text.slice(h,O),T="";for(let{segment:U}of ra().segment(I))if(l==="upper")T+=U.toUpperCase();else if(l==="lower")T+=U.toLowerCase();else T+=U===U.toUpperCase()?U.toLowerCase():U.toUpperCase();let _=x.text.slice(0,h)+T+x.text.slice(O),A=x.cursor;x.setText(_),x.setOffset(GY(A,h,_))}
function Vo(l,h,O,x){let{from:I,to:T}=Sn(h,O,x),_=Rn(O.text.slice(I,T),x);Io(l,I,T,O),O.recordChange({type:"visualCase",caseOp:l,span:_,linewise:x})}
function _o(l,h,O,x){let{from:I,to:T}=Gt(x,h,O);if(I===T)return;Io(l,I,T,x)}
function Mo(l,h,O){let x=h.getRegister();if(!x)return;let{from:I,to:T}=Sn(l,h,O),_=Rn(h.text.slice(I,T),O),A=Ao(x,I,T,h,O);h.recordChange({type:"visualPaste",content:A,span:_,linewise:O})}
function Eo(l,h,O,x){let{from:I,to:T}=Gt(x,h,O);if(I===T&&!O)return;Ao(l,I,T,x,O)}
function Ao(l,h,O,x,I){let T=x.text.slice(h,O).endsWith(`
`),_=l.endsWith(`
`)?l.slice(0,-1):l;if(T&&!_.endsWith(`
`))_+=`
`;let A=x.text.slice(h,O);if(I&&!A.endsWith(`
`))A+=`
`;x.setRegister(A,I);let U=x.text.slice(0,h)+_+x.text.slice(O);if(x.setText(U),I){let F=Si.fromText(U,x.cursor.measuredText.columns,h),K=Vn(F);x.setOffset(F.placeholderStartingAt(K)?h:K)}else if(_.endsWith(`
`))x.setOffset(h);else{let F=GB(_);x.setOffset(Math.max(h,h+_.length-(F.length||1)))}return _}
function wn(l,h,O){let x=h===0?O.cursor.startOfLastLine():O.cursor.goToLine(h);In(l,qe(O.text,O.cursor.offset),qe(O.text,x.offset),O,Math.min(O.cursor.offset,Vn(x))),st(O,{type:"operator",op:l,motion:"G",count:h})}
function kn(l,h,O){let x=h===1?O.cursor.startOfFirstLine():O.cursor.goToLine(h);In(l,qe(O.text,O.cursor.offset),qe(O.text,x.offset),O,Math.min(O.cursor.offset,Vn(x))),st(O,{type:"operator",op:l,motion:"gg",count:h})}
function In(l,h,O,x,I){let T=x.text.split(`
`),_=Math.min(h,O),A=Math.min(Math.max(h,O)+1,T.length),U=T.slice(0,_),F=T.slice(A),K=ht(T,_),j=T.slice(_,A).map((G)=>G+`
`).join("");if(x.setRegister(j,!0),l==="yank"){let G=hee(x.text,I);x.setOffset(I===x.text.length?No(x.cursor,G):x.cursor.snapOutOfPlaceholder(G,"start"))}else if(l==="delete"){let G=[...U,...F];x.setText(G.join(`
`));let B=Math.max(0,Math.min(_,G.length-1)),z=Si.fromText(G[B]??"",x.cursor.measuredText.columns+1);x.setOffset(ht(G,B)+Lo(z,F.length>0))}else if(l==="change")x.setText([...U,"",...F].join(`
`)),x.enterInsert(K)}
function qe(l,h){return Lt(l.slice(0,h),`
`)}
function zt(l){let h=0;for(let{segment:O,index:x}of ra().segment(l))if(h=x,O!==" "&&O!=="\t")break;return h}
function Lo(l,h){let O=zt(l.text);if(l.placeholderStartingAt(O)===null)return O;if(O>0||h)return 0;let x=hee(l.text,l.text.length);return No(l,x)}
function No(l,h){let O=l.snapOutOfPlaceholder(h,"start");if(O===h)return h;let x=l.snapOutOfPlaceholder(h,"end");return mAt(l.text.slice(O,x))?x:O}
function Vn(l){let h=l.startOfLogicalLine().offset,O=l.endOfLogicalLine().offset;return h+zt(l.text.slice(h,O))}
var Po=1000;
function oi(l){let h=new Map;for(let[O,x]of Object.entries(l)){if(typeof x!=="string"||x.toLowerCase()!=="<esc>")continue;let I=O.normalize("NFC");if(!/^[^\p{C}\p{Z}]{2}$/u.test(I)||AZ(I)!==2)continue;h.set(I,"<Esc>")}return h}
function JLt(){return oi(xP("vimInsertModeRemaps")[0]??{})}
function ir(l,h,O){switch(l.type){case"idle":return ii(h,O);case"count":return ai(l,h,O);case"operator":return ui(l,h,O);case"operatorCount":return li(l,h,O);case"operatorFind":return ci(l,h,O);case"operatorTextObj":return fi(l,h,O);case"find":return di(l,h,O);case"g":return pi(l,h,O);case"operatorG":return mi(l,h,O);case"replace":return gi(l,h,O);case"indent":return hi(l,h,O)}}
var si=Object.assign(Object.create(null),{g:(l)=>({next:{type:"g",count:l}}),r:(l)=>({next:{type:"replace",count:l}}),">":(l)=>({next:{type:"indent",dir:">",count:l}}),"<":(l)=>({next:{type:"indent",dir:"<",count:l}}),"~":(l,h)=>({execute:()=>xn(l,h)}),x:(l,h)=>({execute:()=>bn(l,h),wanted:null}),s:(l,h)=>({execute:()=>yn(l,h)}),S:(l,h)=>({execute:()=>wt("change",l,h)}),J:(l,h)=>({execute:()=>or(l,h)}),p:(l,h)=>({execute:()=>Ht(!0,l,h),wanted:h.getRegister()===""?void 0:null}),P:(l,h)=>({execute:()=>Ht(!1,l,h),wanted:h.getRegister()===""?void 0:null}),D:(l,h)=>({execute:()=>St("delete","$",1,h),wanted:null}),C:(l,h)=>({execute:()=>St("change","$",1,h)}),Y:(l,h)=>({execute:()=>wt("yank",l,h)}),";":(l,h)=>({execute:()=>En(!1,l,h)}),",":(l,h)=>({execute:()=>En(!0,l,h)}),u:(l,h)=>({execute:()=>h.onUndo?.(),wanted:null}),i:(l,h)=>({execute:()=>_n("i",h)}),I:(l,h)=>({execute:()=>_n("I",h)}),a:(l,h)=>({execute:()=>_n("a",h)}),A:(l,h)=>({execute:()=>_n("A",h)}),o:(l,h)=>({execute:()=>$t("below",h)}),O:(l,h)=>({execute:()=>$t("above",h)})});
function Uo(l,h,O,x){if(Zn(l))return{next:{type:"operator",op:cn[l],count:h,countTyped:O}};if(l==="G")return{execute:()=>{x.setOffset(O?x.cursor.goToLine(h).offset:x.text.lastIndexOf(`
`)+1)}};if(l==="j"||l==="k"){let{offset:I,column:T}=Wo(l==="j",h,x),{text:_}=x.cursor;if(I===null)return{next:{type:"idle"},wanted:{column:T,offset:x.cursor.offset,text:_}};let A=GY(x.cursor,I);return{execute:()=>x.setOffset(A),wanted:{column:T,offset:A,text:_}}}if(l==="$"){let I=x.cursor.lastCharInLogicalLine().offset;return{execute:()=>x.setOffset(I),wanted:{column:1/0,offset:I,text:x.cursor.text}}}if(fn.has(l)){let I=l===" "||l===rt?Ri(l,x.cursor,h):gt(l,x.cursor,h),T=GY(I,I.offset);if(T===x.cursor.offset&&Bt.has(l))return{next:{type:"idle"}};return{execute:()=>x.setOffset(T),wanted:null}}if(dn.has(l))return{next:{type:"find",find:l,count:h}};if(l===".")return{execute:()=>x.onDotRepeat?.(O?h:void 0)};return si[l]?.(h,x)??null}
function Do(l,h,O,x,I){if(er(x))return{next:{type:"operatorTextObj",op:l,count:h,scope:pn[x]}};if(dn.has(x))return{next:{type:"operatorFind",op:l,count:h,find:x}};if(fn.has(x))return{execute:()=>St(l,x,h,I),wanted:x==="j"||x==="k"?void 0:null};if(x==="G"){let T=O?h:0;return{execute:()=>wn(l,T,I)}}if(x==="g")return{next:{type:"operatorG",op:l,count:h}};return null}
function ii(l,h){if(/[1-9]/.test(l))return{next:{type:"count",count:parseInt(l,10)}};if(l==="0")return{execute:()=>h.setOffset(h.cursor.startOfLogicalLine().offset)};let O=Uo(l,1,!1,h);if(O)return O;return{}}
function ai(l,h,O){if(/[0-9]/.test(h))return{next:{type:"count",count:ar(l.count,h)}};let x=Uo(h,l.count,!0,O);if(x)return x;return{next:{type:"idle"}}}
function ui(l,h,O){if(h===l.op[0])return{execute:()=>wt(l.op,l.count,O)};if(/[1-9]/.test(h))return{next:{type:"operatorCount",op:l.op,count:l.count,motionCount:parseInt(h,10)}};let x=l.countTyped??!1,I=Do(l.op,l.count,x,h,O);if(I)return I;return{next:{type:"idle"}}}
function li(l,h,O){if(/[0-9]/.test(h))return{next:{...l,motionCount:ar(l.motionCount,h)}};let x=l.count*l.motionCount;if(h===l.op[0])return{execute:()=>wt(l.op,x,O)};let I=Do(l.op,x,!0,h,O);if(I)return I;return{next:{type:"idle"}}}
function ci(l,h,O){return{execute:()=>{if(h!=="")O.setLastFind(l.find,h);gn(l.op,l.find,h,l.count,O)}}}
function fi(l,h,O){if(tr.has(h))return{execute:()=>hn(l.op,l.scope,h,l.count,O)};return{next:{type:"idle"}}}
function di(l,h,O){return{execute:()=>{if(h!=="")O.setLastFind(l.find,h);let x=O.cursor.findCharacter(h,l.find,l.count);if(x!==null)O.setOffset(x)}}}
function pi(l,h,O){if(h==="j"||h==="k"){let{offset:x,column:I}=jo(`g${h}`,l.count,O),T=GY(O.cursor,x);return{execute:()=>O.setOffset(T),wanted:I===null?null:{column:I,offset:T,text:O.cursor.text}}}if(h==="g"){if(l.count>1)return{execute:()=>{let x=O.text.split(`
`),I=Math.min(l.count-1,x.length-1),T=0;for(let _=0;_<I;_++)T+=(x[_]?.length??0)+1;O.setOffset(T)}};return{execute:()=>O.setOffset(O.cursor.startOfFirstLine().offset)}}return{next:{type:"idle"}}}
function mi(l,h,O){if(h==="j"||h==="k")return{execute:()=>St(l.op,`g${h}`,l.count,O)};if(h==="g")return{execute:()=>kn(l.op,l.count,O)};return{next:{type:"idle"}}}
function gi(l,h,O){if(h==="")return{next:{type:"idle"}};return{execute:()=>vn(h,l.count,O)}}
function hi(l,h,O){if(h===l.dir)return{execute:()=>Cn(l.dir,l.count,O)};return{next:{type:"idle"}}}
function En(l,h,O){let x=O.getLastFind();if(!x)return;let I=x.type;if(l)I={f:"F",F:"f",t:"T",T:"t"}[I];let T=O.cursor.findCharacter(x.char,I,h);if(T!==null)O.setOffset(T)}
function Ko(l,h,O){switch(l.type){case"idle":return yi(h,O);case"count":return vi(l,h,O);case"find":return xi(l,h,O);case"g":return Ci(l,h,O);case"replace":if(h==="")return{next:{type:"idle"}};return{exit:"replace",char:h};case"textObject":return Oi(l,h,O)}}
var bi=Object.assign(Object.create(null),{x:()=>({exit:"operator",op:"delete"}),s:()=>({exit:"operator",op:"change"}),X:()=>({exit:"operator",op:"delete",forceLinewise:!0}),D:()=>({exit:"operator",op:"delete",forceLinewise:!0}),C:()=>({exit:"operator",op:"change",forceLinewise:!0}),S:()=>({exit:"operator",op:"change",forceLinewise:!0}),R:()=>({exit:"operator",op:"change",forceLinewise:!0}),Y:()=>({exit:"operator",op:"yank",forceLinewise:!0}),r:()=>({next:{type:"replace"}}),"~":()=>({exit:"case",op:"toggle"}),u:()=>({exit:"case",op:"lower"}),U:()=>({exit:"case",op:"upper"}),p:()=>({exit:"paste"}),P:()=>({exit:"paste"}),">":(l)=>({exit:"indent",dir:">",count:l}),"<":(l)=>({exit:"indent",dir:"<",count:l}),v:()=>({exit:"toggleKind",key:"v"}),V:()=>({exit:"toggleKind",key:"V"}),o:()=>({exit:"swap"}),J:()=>({exit:"join"}),$:(l,h)=>{let O=h.cursor.endOfLogicalLine().offset;return{next:{type:"idle"},move:()=>h.setOffset(O),wanted:{column:1/0,offset:O,text:h.cursor.text}}},g:(l)=>({next:{type:"g",count:l}}),";":(l,h)=>({next:{type:"idle"},move:()=>En(!1,l,h)}),",":(l,h)=>({next:{type:"idle"},move:()=>En(!0,l,h)})});
function Fo(l,h,O,x){if(Zn(l))return{exit:"operator",op:cn[l]};if(l==="G")return{next:{type:"idle"},move:()=>{x.setOffset(O?x.cursor.goToLine(h).offset:x.text.lastIndexOf(`
`)+1)}};let I=bi[l];if(I)return I(h,x);if(er(l))return{next:{type:"textObject",scope:pn[l],count:h}};if(l==="j"||l==="k"){let T=Wo(l==="j",h,x),_=T.offset??x.cursor.offset;return{next:{type:"idle"},move:()=>x.setOffset(_),wanted:{column:T.column,offset:_,text:x.cursor.text}}}if(fn.has(l)){let{offset:T}=gt(l,x.cursor,h);if(T===x.cursor.offset&&Bt.has(l))return{next:{type:"idle"}};return{next:{type:"idle"},move:()=>x.setOffset(T)}}if(dn.has(l))return{next:{type:"find",find:l,count:h}};return null}
function yi(l,h){if(/[1-9]/.test(l))return{next:{type:"count",count:parseInt(l,10)}};if(l==="0")return{next:{type:"idle"},move:()=>h.setOffset(h.cursor.startOfLogicalLine().offset)};return Fo(l,1,!1,h)??{next:{type:"idle"}}}
function vi(l,h,O){if(/[0-9]/.test(h))return{next:{type:"count",count:ar(l.count,h)}};return Fo(h,l.count,!0,O)??{next:{type:"idle"}}}
function xi(l,h,O){return{next:{type:"idle"},move:()=>{if(h!=="")O.setLastFind(l.find,h);let x=O.cursor.findCharacter(h,l.find,l.count);if(x!==null)O.setOffset(x)}}}
function Ci(l,h,O){if(h==="j"||h==="k"){let{offset:x,column:I}=jo(`g${h}`,l.count,O);return{next:{type:"idle"},move:()=>O.setOffset(x),wanted:I===null?null:{column:I,offset:x,text:O.cursor.text}}}if(h==="g")return{next:{type:"idle"},move:()=>{let x=l.count>1?O.cursor.goToLine(l.count):O.cursor.startOfFirstLine();O.setOffset(x.offset)}};return{next:{type:"idle"}}}
function Oi(l,h,O){if(tr.has(h)){let x=mn(O.text,O.cursor.offset,h,l.scope==="inner");if(x)return{exit:"selectRange",start:x.start,end:x.end}}return{next:{type:"idle"}}}
function ar(l,h){return Math.min(l*10+parseInt(h,10),io)}
function ur(l,h){switch(l){case"i":return h.offset;case"I":return h.firstNonBlankInLogicalLine().offset;case"a":return h.isAtEnd()||h.text[h.offset]===`
`?h.offset:h.right().offset;case"A":return h.endOfLogicalLine().offset}}
function _n(l,h){h.enterInsert(ur(l,h.cursor)),h.recordChange({type:"insertCommand",key:l})}
function Ri(l,h,O){let x=h;for(let I=0;I<O;I++){let T=gt(l,x,1),{text:_,offset:A}=T;if(_[A]===`
`&&A>0&&_[A-1]!==`
`)T=l===rt?new Si(T.measuredText,GY(T,A)):gt(l,T,1);if(T.equals(x))break;x=T}return x}
function Wo(l,h,O){let{cursor:x}=O,I=x.text,T=x.startOfLogicalLine().offset,_=Wt(x,O.wantedColumn),A=T;for(let j=0;j<h;j++)if(l){let G=I.indexOf(`
`,A);if(G===-1)break;A=G+1}else if(A===0)break;else A=A===1?0:I.lastIndexOf(`
`,A-2)+1;if(A===T)return{offset:null,column:_};let U=I.indexOf(`
`,A),F=U===-1?I.length:U,K=jt(I,A,F,_);return{offset:Tn(x,K,A),column:_}}
function jo(l,h,O){let{cursor:x}=O,I=gt(l,x,h),T=x.measuredText.getWrappedLines(),_=T[x.getPosition().line],A=T[I.getPosition().line],U=_?.startOffset===0||_?.isPrecededByNewline,F=A?.startOffset===0||A?.isPrecededByNewline;if(I.equals(x)||!U||!F||!A)return{offset:I.offset,column:null};let K=Wt(x,O.wantedColumn),j=A.startOffset+A.text.length,G=jt(x.text,A.startOffset,j,K),B=Tn(x,G,A.startOffset),z=!A.endsWithNewline&&j<x.text.length;return{offset:B===j&&z?x.measuredText.prevOffset(j):B,column:K}}
var pr=new Set(["backspace","delete","tab","home","end","pageup","pagedown","insert","clear","enter","center","undefined","mouse","f1","f2","f3","f4","f5","f6","f7","f8","f9","f10","f11","f12"]);
function lr(l,h){return(h||l.name==="")&&!pr.has(l.name)}
function cr(l){if(!l)return!1;switch(l.type){case"insertCommand":case"openLine":case"substitute":return!0;case"operator":case"operatorFind":case"operatorTextObj":case"visualOp":return l.op==="change";default:return!1}}
function wi(l){switch(l.type){case"x":case"substitute":case"paste":case"operatorTextObj":return!0;case"operator":return!["h","l"," ",rt,"gj","gk"].includes(l.motion);default:return!1}}
function fr(l,h){return{...l,setText:(O,x)=>{h(),l.setText(O,x)},setOffset:(O)=>{h(),l.setOffset(O)},enterInsert:(O)=>{h(),l.enterInsert(O)},setRegister:(O,x)=>{h(),l.setRegister(O,x)}}}
function Bo(l,h){let O=GY(l,l.offset);if(O!==l.offset)h.setOffset(O);return O}
function dr(l,h,O){if(l.wanted!==void 0)return l.wanted??void 0;return h?void 0:O}
function mr(l){let{value:h,onChange:O,columns:x,disableEscapeDoublePress:I,onModeChange:T,onUndo:_,onOpenHistorySearch:A,onToggleHelp:U,onHistoryUp:F,onHistoryDown:K,inputFilter:j,getInputMode:G}=l,B=R(ao()),[z,ye]=y("INSERT"),[Te,me]=y(null),Q=R(null),te=R(ki()),be=R(null),ie=R(null),ue=R(null);function Ve(M,W){let L=B.current;if(L.mode==="INSERT"&&!W.ctrl&&!W.meta&&lr(W,[...W.key].length===1))B.current={mode:"INSERT",insertedText:L.insertedText+M}}let re=le((M,W="")=>{let L=B.current;if(L.mode!=="INSERT")return;let D=W!==""&&L.insertedText.endsWith(W)?L.insertedText.slice(0,-W.length):L.insertedText;B.current={mode:"INSERT",insertedText:D+M}},[]);function ee(M,W,L,D){for(let Y of M.keys())if(Y.startsWith(W)){Q.current={char:W,at:Date.now(),offsetAfter:L,recorded:D};return}}let Me=le(()=>{Q.current=null},[]),Ce=le(()=>{let M=B.current;if(M.mode!=="INSERT")B.current={...M,wanted:void 0}},[]),oe=le((M,W)=>{if(W!==void 0)M.setOffset(W);Q.current=null,ie.current=null,ue.current=null,B.current={mode:"INSERT",insertedText:""},ye("INSERT"),me(null),T?.("INSERT")},[T]),J=le((M,W)=>{let L=B.current;if(L.mode==="INSERT"){let D=be.current,Y=D===ie.current;if(D?.type==="visualOp"&&D.op==="change"&&Y)be.current={type:"visualChange",span:D.span,linewise:D.linewise,text:L.insertedText??""};else if(cr(D)&&D.type!=="visualOp"&&Y&&(L.insertedText||(W?.buffer?W.buffer.text:h)===ue.current))be.current={...D,insertedText:L.insertedText};else if(L.insertedText||W?.claimEmptyInsert&&!cr(D))be.current={type:"insert",text:L.insertedText};let fe=W?.buffer?W.buffer.offset:M.offset,Ee=W?.buffer?W.buffer.text:h;if(fe>0&&Ee[fe-1]!==`
`){let _e=fe>Ee.length?1:GB(Ee.slice(0,fe)).length;M.setOffset(fe-_e)}else if(W?.buffer)M.setOffset(fe)}B.current={mode:"NORMAL",command:{type:"idle"}},ye("NORMAL"),me(null),T?.("NORMAL")},[T,h]),ne=le((M,W,L)=>{B.current={mode:"VISUAL",kind:W,anchor:M,command:{type:"idle"},wanted:L};let D=W==="line"?"VISUAL LINE":"VISUAL";ye(D),me(M),T?.(D)},[T]);function Le(M,W,L=!1){let D;return{cursor:M,text:M.text,setText:(Y,fe)=>{D=Y,O(Y,fe)},setOffset:(Y)=>W.setOffset(Y),enterInsert:(Y)=>{oe(W,Y),ue.current=D??M.text},getRegister:()=>te.current.register,getRegisterIsLinewise:()=>te.current.registerIsLinewise,setRegister:(Y,fe)=>{te.current.register=Y,te.current.registerIsLinewise=fe},getLastFind:()=>te.current.lastFind,setLastFind:(Y,fe)=>{te.current.lastFind={type:Y,char:fe}},recordChange:L?()=>{}:(Y)=>{if(be.current=Y,cr(Y)&&B.current.mode==="INSERT")ie.current=Y}}}function Fe(M,W,L){let D=M.text;return{...M,setText:(Y,fe)=>{let Ee={value:D,cursorOffset:M.cursor.offset};D=Y,M.setText(Y,fe??{previous:Ee})},enterInsert:(Y)=>{let fe=D.slice(0,Y)+W+D.slice(Y),Ee={value:D,cursorOffset:Y},_e=ge(fe,L,Ee)?W.slice(1):W;M.setText(fe,{previous:Ee});let he=D.slice(0,Y),de=(he+_e),ve=de.startsWith(he)?GB(de.slice(he.length)):"",Ie=ve&&!/^[\p{Mn}\p{Me}]/u.test(ve)?ve:GB(de),Ae=de.endsWith(`
`)?de.length:de.length-Ie.length,Be=Y>0&&he[Y-1]!==`
`?Y-GB(he).length:Y;M.setOffset(_e?Ae:Be)}}}function ge(M,W,L){return G!==void 0&&J1o({nextValue:M,value:L?.value??h,cursorOffset:L?.cursorOffset??W.offset,mode:G()})}function We(M,W,L,D){if(M.type==="insertCommand"){if(M.insertedText===void 0)return;let Y=ur(M.key,W);W=new Si(W.measuredText,Y),M={type:"insert",text:M.insertedText}}if("insertedText"in M&&M.insertedText!==void 0)L=Fe(L,M.insertedText,D);switch(M.type){case"insert":if(M.text){let Y=W.insert(M.text),fe=ge(Y.text,D);L.setText(Y.text);let Ee=fe?Y.text.slice(1):Y.text,_e=Y.offset-(fe?1:0);L.setOffset(Ee[_e-1]===`
`?_e:_e-GB(Ee.slice(0,_e)).length)}break;case"x":bn(M.count,L);break;case"substitute":yn(M.count,L);break;case"replace":vn(M.char,M.count,L);break;case"toggleCase":xn(M.count,L);break;case"indent":Cn(M.dir,M.count,L);break;case"join":ho(M.count,L);break;case"openLine":$t(M.direction,L);break;case"operator":if(M.motion===M.op[0])wt(M.op,M.count,L);else if(M.motion==="gg")kn(M.op,M.count,L);else if(M.motion==="G")wn(M.op,M.count,L);else St(M.op,M.motion,M.count,L);break;case"operatorFind":gn(M.op,M.find,M.char,M.count,L);break;case"operatorTextObj":hn(M.op,M.scope,M.objType,M.count,L);break;case"visualOp":Oo(M.op,M.span,M.linewise,L);break;case"visualReplace":ko(M.char,M.span,M.linewise,L);break;case"visualCase":_o(M.caseOp,M.span,M.linewise,L);break;case"visualPaste":Eo(M.content,M.span,M.linewise,L);break;case"visualIndent":yo(M.dir,M.count,M.lines,L);break;case"visualChange":Ro(M.span,M.linewise,Fe(L,M.text,D));break;case"paste":Ht(M.after,M.count,L);break}}function Se(M){let W=be.current;if(W&&M!==void 0&&"count"in W&&wi(W))return{...W,count:M};return W}function je(M,W){let L=Se(W);if(!L)return;let D=Si.fromText(h,x,M.offset);We(L,D,Le(D,M,!0),M)}function pt(M,W){let L=h,D=W.offset,Y=(_e,he)=>{let de=he?.previous;if(!ge(_e,W,de))L=_e;else if(_e.length!==(de?.value??h).length+1)L=_e.slice(1);O(_e,he)},fe=(_e)=>{let he=Se(_e);if(!he)return;let de=Si.fromText(L,x,D);We(he,de,{...Le(de,W,!0),text:L,setText:Y,setOffset:(ve)=>{D=ve,W.setOffset(ve)},enterInsert:(ve)=>{D=ve,oe(W,ve)}},W)},Ee=[...M];for(let _e=0;_e<Ee.length;_e++){if(B.current.mode==="INSERT"){let pe=Ee.slice(_e).join(""),Ge=JLt();if(Ge.size>0&&Ge.has(pe.normalize("NFC"))){g("vim_insert_remap"),J(W,{buffer:{text:L,offset:D},claimEmptyInsert:!0});return}let He=Si.fromText(L,x,D).insert(pe),mt=ge(He.text,W),ze=He.offset-(mt?1:0);O(He.text),W.setOffset(ze),B.current={mode:"INSERT",insertedText:B.current.insertedText+pe};let Jr=mt?pe.slice(1):pe,_t=GB(He.text.slice(0,He.offset));if(_t&&Jr.endsWith(_t))ee(Ge,_t,ze,!0);return}let he=B.current;if(he.mode!=="NORMAL")return;let de=Ee[_e];if((de==="v"||de==="V")&&(he.command.type==="idle"||he.command.type==="count")){ne(D,de==="V"?"line":"char",he.wanted);return}let ve=Si.fromText(L,x,D),Ie=!1,Ae={...Le(ve,W,!1),text:L,setText:Y,setOffset:(pe)=>{D=pe,W.setOffset(pe)},enterInsert:(pe)=>{D=pe,oe(W,pe)},onDotRepeat:(pe)=>{Ie||=be.current!==null,fe(pe)},wantedColumn:he.wanted},Be=fr(Ae,()=>{Ie=!0}),xe=ir(he.command,de,Be);if(xe.execute)xe.execute();if(B.current.mode==="NORMAL"&&(xe.next||xe.execute||xe.wanted!==void 0))B.current={mode:"NORMAL",command:xe.next??{type:"idle"},wanted:dr(xe,Ie,he.wanted)}}}function ot(M,W){let L=B.current,D=Si.fromText(h,x,W.offset),Y=()=>j?.(M.key,M);if(!(M.name==="left"&&!M.ctrl&&!M.meta&&!M.fn&&!M.superKey&&!M.shift))W.disarmLeftArrowConfirm?.();let fe=Q.current;if(Q.current=null,M.ctrl||M.meta){if(L.mode==="VISUAL"){Y(),J(W),M.preventDefault();return}W.handleKeyDown(M);return}if(M.name==="escape"){if(Y(),L.mode==="NORMAL")B.current={mode:"NORMAL",command:{type:"idle"},wanted:L.wanted};else if(L.mode==="VISUAL"&&L.command.type!=="idle")B.current={...L,command:{type:"idle"}};else{if(L.mode==="VISUAL")Bo(D,W);J(W)}if(!I)M.preventDefault();return}if(M.name==="return"&&L.mode!=="VISUAL"){W.handleKeyDown(M);return}if(L.mode==="INSERT"){if(M.name==="backspace"||M.name==="delete"){if(L.insertedText.length>0)B.current={mode:"INSERT",insertedText:L.insertedText.slice(0,-(GB(L.insertedText).length||1))}}let Ie=JLt();if(Ie.size>0){let Ae=M.key.normalize("NFC"),Be=[...Ae].length,xe=Be===1,pe=lr(M,xe);if(pe&&Be<=2&&fe&&Ie.has(fe.char+ewe(Ae))&&Date.now()-fe.at<=Po&&W.offset===fe.offsetAfter&&D.text.startsWith(fe.char,D.offset-fe.char.length)){if(Y(),fe.recorded&&L.insertedText.endsWith(fe.char))B.current={mode:"INSERT",insertedText:L.insertedText.slice(0,-fe.char.length)};let mt=D.offset-fe.char.length,ze=D.text.slice(0,mt)+D.text.slice(D.offset);O(ze),g("vim_insert_remap"),J(W,{buffer:{text:ze,offset:mt},claimEmptyInsert:!0}),M.preventDefault();return}if(pe&&!xe&&Ie.has(Ae)){Y(),g("vim_insert_remap"),J(W,{claimEmptyInsert:!0}),M.preventDefault();return}let He=pe?GB(Ae):"";if(He)ee(Ie,He,W.offset+Ae.length,lr(M,[...M.key].length===1))}W.handleKeyDown(M);return}if(L.mode==="VISUAL"){let Ie=!1,Ae=fr({...Le(D,W,!1),onUndo:_,onDotRepeat:()=>je(W),wantedColumn:L.wanted},()=>{Ie=!0}),Be=L.command.type==="idle"||L.command.type==="count",xe=M.key;if(M.name==="left")xe=Be?"h":"";else if(M.name==="right")xe=Be?"l":"";else if(M.name==="up")xe=Be?"k":"";else if(M.name==="down")xe=Be?"j":"";else if(M.name==="return")xe=Be?"j":`
`;else if(M.name==="backspace")xe=Be?rt:"";else if(M.name==="delete")xe=Be&&L.command.type!=="count"?"x":"";else if(M.key===""||pr.has(M.name)){M.preventDefault();return}else if([...M.key].length>1){M.preventDefault();return}Y();let pe=Ko(L.command,xe,Ae),Ge=L.kind==="line";if("next"in pe)pe.move?.(),B.current={mode:"VISUAL",kind:L.kind,anchor:L.anchor,command:pe.next,wanted:dr(pe,Ie,L.wanted)};else switch(pe.exit){case"operator":if(Co(pe.op,L.anchor,Ae,Ge||pe.forceLinewise===!0),B.current.mode==="VISUAL")J(W);break;case"replace":wo(pe.char,L.anchor,Ae,Ge),J(W);break;case"case":Vo(pe.op,L.anchor,Ae,Ge),J(W);break;case"paste":if(Ae.getRegister())Mo(L.anchor,Ae,Ge),J(W);else B.current={...L,command:{type:"idle"}};break;case"join":go(L.anchor,Ae,Ge),J(W);break;case"indent":bo(pe.dir,pe.count,L.anchor,Ae),J(W);break;case"swap":{let He=D.offset;W.setOffset(L.anchor),B.current={mode:"VISUAL",kind:L.kind,anchor:He,command:{type:"idle"}},me(He);break}case"selectRange":{let He=pe.end>pe.start?D.measuredText.prevOffset(pe.end):pe.start;W.setOffset(He),B.current={mode:"VISUAL",kind:L.kind,anchor:pe.start,command:{type:"idle"}},me(pe.start);break}default:{let He=pe.key==="V"?"line":"char";if(He===L.kind){let mt=Bo(D,W);J(W);let{wanted:ze}=L;if(ze?.offset===D.offset&&ze.text===D.text)B.current={mode:"NORMAL",command:{type:"idle"},wanted:{...ze,offset:mt}}}else ne(L.anchor,He,L.wanted);break}}M.preventDefault();return}if(L.mode!=="NORMAL")return;if(L.command.type==="idle"&&!M.shift&&(M.name==="up"||M.name==="down"||M.name==="left"&&D.text==="")){W.handleKeyDown(M);return}if(L.command.type==="idle"&&M.key==="?"&&U){U(),M.preventDefault();return}if(Y(),L.command.type==="idle"&&M.key==="/"&&A){A(),M.preventDefault();return}if(L.command.type==="idle"){if(M.key==="k"){let Ie=D.text.indexOf(`
`);if(Ie===-1||D.offset<=Ie){F?.(),M.preventDefault();return}}if(M.key==="j"){let Ie=D.text.lastIndexOf(`
`);if(Ie===-1||D.offset>Ie){K?.(),M.preventDefault();return}}}let Ee=!1,_e=fr({...Le(D,W,!1),onUndo:_,onDotRepeat:(Ie)=>{Ee||=be.current!==null,je(W,Ie)},wantedColumn:L.wanted},()=>{Ee=!0}),he=L.command.type==="idle"||L.command.type==="count"||L.command.type==="operator"||L.command.type==="operatorCount",de=M.key;if(M.name==="left")de="h";else if(M.name==="right")de="l";else if(M.name==="up")de="k";else if(M.name==="down")de="j";else if(he&&M.name==="backspace")de=rt;else if(he&&L.command.type!=="count"&&M.name==="delete")de="x";else if(M.key===""||pr.has(M.name))return;else if([...M.key].length>1){pt(M.key,W),M.preventDefault();return}if((de==="v"||de==="V")&&(L.command.type==="idle"||L.command.type==="count")){ne(D.offset,de==="V"?"line":"char",L.wanted);return}let ve=ir(L.command,de,_e);if(ve.execute)ve.execute();if(B.current.mode==="NORMAL"&&(ve.next||ve.execute||ve.wanted!==void 0))B.current={mode:"NORMAL",command:ve.next??{type:"idle"},wanted:dr(ve,Ee,L.wanted)};M.preventDefault()}let H=le((M,W)=>{if(Q.current=null,ie.current=null,M==="INSERT")B.current={mode:"INSERT",insertedText:""},me(null);else if(M==="NORMAL")B.current={mode:"NORMAL",command:{type:"idle"}},me(null);else{let L=M==="VISUAL LINE"?"line":"char",D=W.offset;B.current={mode:"VISUAL",kind:L,anchor:D,command:{type:"idle"}},me(D)}ye(M),T?.(M)},[T]);return{handleKeyDown:ot,mode:z,setMode:H,visualAnchor:Te,recordInsertedText:Ve,recordInsert:re,cancelPendingRemap:Me,forgetColumn:Ce}}
return mr;
}
