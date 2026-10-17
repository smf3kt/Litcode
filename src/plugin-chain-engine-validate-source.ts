// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { AFe, ESe, cN, oQt, olt, sQt } from './plugin-chain-style-props.js';
import { L, $A } from './plugin-chain-source.js';
import { ZAe } from './plugin-chain-site-leaves.js';
import { IL } from './plugin-chain-raster-sites.js';
import { Mrt, X4t } from './plugin-chain-walker.js';
import { IAt, ano, kFe, lQt, ono, tno } from './plugin-chain-leaf-walkers.js';
import { sno } from './plugin-chain-leaves.js';
import { QT } from './plugin-chain-ui-blit-source.js';
import { B_ } from './plugin-chain-image-model.js';
import { QPn, eIn, tIn } from './plugin-chain-engine-draw-source.js';

// chunk-n3ykh62m.js tree validation [262627,266967) 4340 units sha256 c0bb5ccd0f238ef82d62ddea605d179c93775602e26c944d9790e62fda4fdaf7
function Eur(e,n,r={}){let{surface:s,note:h,within:y,clientRows:b,measured:w}=r,R=n===B3e,T=R||y===B3e,P=s===void 0?void 0:w3[s],M=0,z=new Set,N=0,V=0,X=0,Z=0,ee=!1;function le(ke,xe){let{depth:Ae,inInline:Le,concealedBy:Je,hoverScope:Re,siblingBoxKeys:Pe}=xe,{inButton:je}=xe;if(++M>AFe)return`more than ${AFe} nodes`;if(Ae>ESe)return`deeper than ${ESe}`;if(ee||=R&&X>0,typeof ke==="string"){if(Ae===0)return"the root must be an element";if(QT(ke))return"a text child holds a control character (an escape sequence)";if(T&&je===void 0)Z+=(Le?0:1)+IAt(ke,lQt);return}if(!L(ke))return`node is ${cN(ke)}`;let _e=ke,{props:Me,children:Ve,ref:ct}=_e,Et=_e.type==="engine";if(je!==void 0&&(Et||dur(_e.type)&&_e.type!=="Text"))return`${Et?"engine node":String(_e.type)} inside ${je} (a Button holds strings and Text)`;if(_e.type==="engine"){if(X+=1,Le)return"engine node inside an inline element";if(Je!==void 0)return`engine node under a ${Je}`;return h$(ct)?void 0:"engine node without a ref"}if(!dur(_e.type))return typeof _e.type==="string"?`"${String(_e.type)}" is not an element (the elements are ${Object.keys(Drt).join(", ")}, from $.ui.resolve(e))`:`unknown element type ${cN(_e.type)}`;if(Le&&Drt[_e.type]==="block")return`${_e.type} inside an inline element`;if(P!==void 0&&!P.includes(_e.type))return`${_e.type} is not an element of the ${s} surface`;if(Wto(_e.type)){let Xt=_e.type==="Button"&&L(Me)?`Button "${IL(Me.key)}"`:_e.type,tr=tno[_e.type](_e)??ano(_e,z)??lur(_e,Xt,Re);if(tr!==void 0)return tr;let ar=(_e.type==="Button"&&Array.isArray(Ve)?Ve:[]).reduce((Ks,Vs)=>Ks??le(Vs,{depth:Ae+1,inInline:!0,concealedBy:Je,hoverScope:Re,siblingBoxKeys:new Set,inButton:Xt}),void 0);if(ar!==void 0)return ar;if(T&&_e.type==="Markdown")return"Markdown around the dialog (its rows are not bounded there)";let In=T&&_e.type==="Client"?Object.keys(L(Me)?Me:{}).find((Ks)=>oQt.has(Ks)):void 0;if(In!==void 0)return`${_e.type} prop "${In}" around the dialog`;let pn=_e,lr=pn.type==="Client"&&b!==void 0,Ws=T?ono(pn):0;if(Z+=lr?b(pn):Ws,N+=pn.type==="Raster"?pn.props.columns*pn.props.rows:0,N>yur)return`more than ${yur} Raster cells in one tree`;return V+=pn.type==="Image"?B_(pn.props.source):0,V>hur?`more than ${hur} bytes of Image source in one tree`:void 0}if(!Le&&Drt[_e.type]==="inline")Z+=1;let Sn=Je,en=0,pt=L(Me)?Me:{},kt=_e.type==="Box"?pt.key:void 0,rn=kt===void 0?void 0:X4t(kt,Pe);if(rn!==void 0)h?.(rn);let{hover:An}=_e,lo=L(An)&&An.scope!==void 0&&An.display!==void 0,Rn=kt!==void 0&&pt.display==="none"&&!lo,$o=kt===void 0?Re:Rn?"hidden":"live",Zn=lur(_e,_e.type,$o);if(Zn!==void 0)return Zn;let On=L(An)?An:{},Ir=[...olt].find((xt)=>On[xt]!==void 0),Bo=On.display===void 0?Ir:"display";if(T&&Bo!==void 0)return`${_e.type} hover prop "${Bo}" around the dialog`;if(_e.type==="Link"){let xt=sno(_e);if(xt!==void 0)return xt;let{href:Xt,label:tr}=Me,zr=ZAe(Xt)?Mrt(Xt):"",ar=tIn(Xt,s??"terminal")===void 0,jo=!(Array.isArray(Ve)&&Ve.length>0)&&tr===void 0,In=eIn(_e),lr=jo||!ar?In:`${In} ${zr}`;if(T)Z+=IAt(lr,lQt)}else if(Me!==void 0){if(!L(Me))return`${_e.type} props is ${cN(Me)}`;for(let[xt,Xt]of Object.entries(Me)){if(_e.type==="Box"&&xt==="key")continue;if(!Pgo[_e.type].has(xt))return`${_e.type} prop "${xt}" is not allowed`;if(typeof Xt!=="string"&&typeof Xt!=="number"&&typeof Xt!=="boolean")return`${_e.type} prop "${xt}" is ${cN(Xt)}`;if(QPn(xt,Xt))continue;let zr=sQt(xt,Xt);if(zr!==void 0)return`${_e.type} prop "${xt}" ${zr}`;let ar=xt==="position"||oQt.has(xt)||olt.has(xt);if(T&&ar)return`${_e.type} prop "${xt}" around the dialog`;if(Igo.has(xt))Sn??=`${_e.type} with prop "${xt}"`;if(typeof Xt==="number")Z+=Math.abs(Xt)*(Ogo[xt]??0),en+=xt==="gap"||xt==="rowGap"?Math.abs(Xt):0;else if(xt==="borderStyle")Z+=Ago}}if(Ve!==void 0){if(!Array.isArray(Ve))return`${_e.type} children is ${cN(Ve)}`;Z+=en*Ve.length;let xt=new Set;for(let Xt of Ve){let tr=le(Xt,{depth:Ae+1,inInline:Le||Drt[_e.type]==="inline",concealedBy:Sn,hoverScope:$o,siblingBoxKeys:xt,inButton:je});if(tr!==void 0)return tr}}return}let re=le(e,{depth:0,inInline:!1,concealedBy:void 0,hoverScope:"none",siblingBoxKeys:new Set,inButton:void 0}),de=T&&Z>kFe?`more than ${kFe} rows around the dialog`:void 0,he=!R?de:X!==1?`${X} engine nodes; ${n} is drawn by exactly one`:ee?"draws below the dialog":de,ye=re??he;if(ye===void 0)w?.(Z);return ye}

// chunk-n3ykh62m.js which field makes a value a node [239381,239459) 78 units sha256 46d8d9bb00bc14199d24988e25c9e7a4d326ff52dce942b11a8402a36e793fcd
function $to(e){let n=e;return $A(e)?Fto.find((s)=>L(n[s])&&!$A(n[s])):"node"}

// chunk-n3ykh62m.js hover scope name limit [239033,239044) 11 units sha256 bcc32c96bfadccefd5ab5c883aeea661b83d92beb37d4a17c997f64d35d8ce27
var aur=64;

// chunk-n3ykh62m.js hover scope validation [239044,239321) 277 units sha256 96dd1e1b290677a04c36da7e6cbb256ef56b838330c26c3f9666eb57a49146ae
function Nto(e,n,r){let s=`${r} hover scope "${IL(e)}"`;if(!(typeof e==="string"&&e!==""&&e.length<=aur))return`${s} is not a string of 1 to ${aur} characters`;let y=QT(e),b=EVe(n);return y?`${s} holds a control character`:b?void 0:`${s} is not held by a plugin of this chain`}

// chunk-n3ykh62m.js a plugin origin check [235650,235711) 61 units sha256 f61741c3bec5d19c871a6bfa9e189d9e85005d56dc9bcbeaee297db81c7d6bb4
var EVe=(e)=>L(e)&&typeof e.plugin==="string"&&e.plugin!=="";

// chunk-n3ykh62m.js the fields $to reads [239321,239381) 60 units sha256 6e9c3a365a1318355497ff003dbfdbfd9b49b87d4e1b76ee7d708d8fa26514c1
var Fto=["props","hover","press","group","client","raster"];

// chunk-n3ykh62m.js block/inline element table [238438,238618) 180 units sha256 6355b13b43dfa7a4c922a162eeaec714bbb9fa58265f79b612ce00dae7629a7a
var Drt={Box:"block",Button:"block",Input:"block",Select:"block",Svg:"block",Code:"block",Markdown:"block",Client:"block",Raster:"block",Image:"block",Text:"inline",Link:"inline"};

// chunk-n3ykh62m.js elements that take no children [246804,246937) 133 units sha256 73ea85a619379d6fcedac451fac5f9948b778c62fd8c566b4043d7bf77cbfe8f
var Wto=(e)=>e==="Button"||e==="Input"||e==="Select"||e==="Svg"||e==="Code"||e==="Markdown"||e==="Client"||e==="Raster"||e==="Image";

// chunk-n3ykh62m.js element-name check [246937,246992) 55 units sha256 7572bacbf1663e34a3f41c87a00440a995abd9221a4ed7c52ba6422b47bce54d
var dur=(e)=>typeof e==="string"&&Object.hasOwn(Drt,e);

// chunk-n3ykh62m.js hover text limit [260971,260987) 16 units sha256 1470382a07da80543a78a60603f8077c3cae6733a3dabce7a7c3f2631ffa6494
var hur=2097152;

// chunk-n3ykh62m.js text budget limit [260987,261002) 15 units sha256 8b3fd1584ea80a92da0698495cf2fd7f58d35a40a948c96f491aeff8f4743431
var yur=262144;

// chunk-n3ykh62m.js hover, group and client validation [239459,241244) 1785 units sha256 898a0b3b429f909056eee3517564478e6cbe006d0e4e67e443fd3f7d9a1a6337
function lur(e,n,r){let{hover:s}=e,h=e.type,y=$to(e);if(y!==void 0){let P=y==="node"?"":` ${y}`;return`${n}${P} is not a plain object (a class instance)`}if(s===void 0)return;if(!(h==="Box"||h==="Text"||h==="Button"))return`${n} takes no hover; Box, Text and Button do`;if(!L(s))return`${n} hover is ${cN(s)}, not an object of style props`;if(s.scope!==void 0){let P=h==="Button"?e.press:e.group,M=Nto(s.scope,P,n);if(M!==void 0)return M}else if(r==="none")return`${n} hover has no Box with a key around it; the nearest keyed Box is what the pointer hovers, or a scope names its group`;else if(r==="hidden")return`${n} hover is scoped to a keyed Box drawn display "none", which the pointer can never be over; keep the keyed Box visible and put display "none" with hover { display: "flex" } on a Box inside it`;let R=Tgo[h==="Box"?"Box":"Text"],T=L(e.props)?e.props:{};for(let[P,M]of Object.entries(s)){if(P==="scope")continue;let z=`${n} hover prop "${IL(P)}"`;if(!R.has(P))return`${z} is not allowed`;if(typeof M!=="string"&&typeof M!=="number"&&typeof M!=="boolean")return`${z} is ${cN(M)}`;let V=sQt(P,M);if(V!==void 0)return`${z} ${V}`;if(P==="display"&&M!=="flex")return`${n} hover display "${String(M)}" would hide it under the pointer; a hover only reveals (display "flex" on a Box drawn display "none")`;if(P==="display"&&T.display!=="none")return`${n} hover display "flex" reveals a Box drawn display "none"; this Box is already shown`;if(P==="borderStyle"&&T.borderStyle===void 0)return`${n} hover borderStyle would add a border and move what is around it; give the Box a borderStyle for the hover to restyle`;if(olt.has(P)&&T.position!=="absolute")return`${z} would shift a Box still in the flow over its siblings; a hover moves only a Box drawn position "absolute"`}return}

// chunk-nyce03br.js minimum gap [2198,2208) 10 units sha256 4bf9efa7b8001307c452b68e5985351096480cb1561566165822f1631e1facd6
var Ago=2;

// chunk-nyce03br.js allowed props per element [3407,4004) 597 units sha256 eeecd0348a2ad961285fcffa1b7036dc4c280a8e7497f414bbe2f94b5a503913
var Pgo={Box:new Set(["flexDirection","flexGrow","flexShrink","flexWrap","alignItems","alignSelf","justifyContent","gap","columnGap","rowGap","width","height","minWidth","minHeight","margin","marginX","marginY","marginTop","marginBottom","marginLeft","marginRight","padding","paddingX","paddingY","paddingTop","paddingBottom","paddingLeft","paddingRight","borderStyle","borderColor","borderDimColor","backgroundColor","overflow","display","position","top","left","right","bottom"]),Text:new Set(["color","backgroundColor","dimColor","bold","italic","underline","strikethrough","inverse","wrap"])};

// chunk-nyce03br.js display/overflow/position props [4075,4140) 65 units sha256 b83de0eeffd56747da916140b564b1e5cad884fa3809d1591ab45a50dda72c0f
var Igo=new Set(["display","overflow","position",...oQt,...olt]);

// chunk-nyce03br.js background/border props per element [2288,2523) 235 units sha256 6724150ffebb4879277fb30a909caa4cdb1ee7a0a8a1e29fd09054ecb4c2def7
var Tgo={Box:new Set(["borderStyle","borderColor","borderDimColor","backgroundColor","display","top","left","right","bottom"]),Text:new Set(["color","backgroundColor","dimColor","bold","italic","underline","strikethrough","inverse"])};

// chunk-nyce03br.js spacing defaults [4987,5093) 106 units sha256 a6e29302f053931256a710dc8092a1e8e4c7b085e410a28d5a589f841b6658e4
var Ogo={padding:2,paddingY:2,paddingTop:1,paddingBottom:1,margin:2,marginY:2,marginTop:1,marginBottom:1};

// chunk-nyce03br.js the client component sentinel [5990,6016) 26 units sha256 a20dfdbcb12a1140608bd2eb9a76dc6cd5098e877bb57bfaea5e27d4220992dc
var B3e="AskUserQuestion";

// chunk-nyce03br.js nonnegative integer check [38157,38216) 59 units sha256 b269e637c894e10f55a53c46d0a0382aabe7cade529bd8ad2cab1c0632fc6c01
var h$=(e)=>typeof e==="number"&&Number.isInteger(e)&&e>=0;

// chunk-nyce03br.js element names per surface [84644,84984) 340 units sha256 9b527c030d5c501d4bf64a9bd38ab572aa12a0220895f3dd034aa93996b532b4
var w3={terminal:["Box","Text","Button","Input","Select","Link","Code","Markdown","Client","Raster","Image"],desktop:["Box","Text","Button","Input","Select","Svg","Link","Code","Markdown","Client"],mobile:["Box","Text","Button","Svg","Link","Code","Markdown"],vscode:["Box","Text","Button","Input","Select","Svg","Link","Code","Markdown"]};


export { Eur, lur, $to, Fto, Drt, Wto, dur, hur, yur, aur, Nto, EVe, Ago, Pgo, Igo, Tgo, Ogo, B3e, h$, w3 };
