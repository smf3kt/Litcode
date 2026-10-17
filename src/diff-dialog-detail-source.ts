// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
//   chunk-rwv4cv93.js sha256 023846209f55eae2677fb05ee2c565c76872a820cbc13dd47ddf64934afbf6e1
//   chunk-1r9zp6s1.js sha256 444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e
//   chunk-3cynezh1.js sha256 c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Xe as e, Xe as r, w, s, n, b } from './plugin-chain-react-surface.js';
import { Do, nt } from './tui-base-components.js';
import { ae, Ar } from './plugin-chain-text-clamp-source.js';
import { ke } from './plugin-chain-input-field-source.js';
import { sv } from './plugin-chain-session-context-source.js';
import { H4 } from './plugin-chain-code-diff-source.js';
import { fo } from './diff-dialog-chrome-source.js';
import { pn } from './tui-ansi-strip.js';
import { readFileBounded as r8e, isRemoteSession as Ht } from './diff-dialog-detail-host.js';
import { resolve as hpt } from 'node:path';
import { __e } from './diff-detail-sanitize-source.js';

// chunk-24k7d6mw.js Uwe: a file path sanitized and collapsed to one line for the detail header [1657226,1657289) 63 units sha256 97ee7960df45ee575f190902c79e1887dd68991efa0c7eae14dc3d31c2ea1a41
function Uwe(h){return __e(pn(h)).text.replace(/[\t\n]+/g," ")}

// chunk-24k7d6mw.js Sj: the parenthesized dim badge, hidden when its when prop is false [1657326,1657515) 189 units sha256 7991ff6a5f231e6cee08e223fda7d679e4d4ec642c46545f59324f9b6ddb3592
function Sj(h){let ee=w(2),{children:T,when:M}=h;if(!(M===void 0?!0:M)){return null}let he;if(ee[0]!==T)he=r(n,{dimColor:!0,children:[" (",T,")"]}),ee[0]=T,ee[1]=he;else he=ee[1];return he}

// chunk-24k7d6mw.js ypt: the 1 MB file read limit [1657515,1657527) 12 units sha256 aad2b4b85f40ead59d5c3b4142a314cb3be533e4cc8db6b441639980207646fb
var ypt=1e6;

// chunk-24k7d6mw.js pBe: the diff dialog detail view, one file's header, divider, hunks, and state notes [1657527,1661848) 4321 units sha256 4c8536f6f4104f51f20370a0db80257185f5e4702a2b6d192e2e9e44d61fa4fa
function pBe(h){let je=w(75),{filePath:T,hunks:M,isLargeFile:L,isBinary:ee,isTruncated:he,isUntracked:we,isRestricted:Te,width:Me}=h,{columns:Le}=ke(),He=sv(),$e=Me??Le-4,Je;if(je[0]!==T)Je=Uwe(T),je[0]=T,je[1]=Je;else Je=je[1];let at=Je,_t;if(je[2]!==T||je[3]!==ee||je[4]!==L||je[5]!==Te||je[6]!==we||je[7]!==He){Ct:{if(!T||ee||L||we||Te||Ht()){let xt;if(je[9]===b)xt={firstLine:null,fileContent:void 0},je[9]=xt;else xt=je[9];_t=xt;break Ct}let Pt;try{Pt=r8e(hpt(He.cwd,T),{maxBytes:ypt})}catch{let xt;if(je[10]===b)xt={firstLine:null,fileContent:void 0},je[10]=xt;else xt=je[10];_t=xt;break Ct}_t={firstLine:Ar(Pt),fileContent:Pt}}je[2]=T,je[3]=ee,je[4]=L,je[5]=Te,je[6]=we,je[7]=He,je[8]=_t}else _t=je[8];let{firstLine:Mt,fileContent:Ft}=_t;if(Te){let xt;if(je[11]!==at)xt=e(s,{children:e(n,{bold:!0,children:at})}),je[11]=at,je[12]=xt;else xt=je[12];let Et;if(je[13]!==$e)Et=e(Ol,{width:$e}),je[13]=$e,je[14]=Et;else Et=je[14];let Kt;if(je[15]===b)Kt=e(s,{flexDirection:"column",children:e(n,{dimColor:!0,italic:!0,children:"Content restricted by read-permission rules"})}),je[15]=Kt;else Kt=je[15];let Xt;if(je[16]!==xt||je[17]!==Et)Xt=r(s,{flexDirection:"column",width:"100%",children:[xt,Et,Kt]}),je[16]=xt,je[17]=Et,je[18]=Xt;else Xt=je[18];return Xt}if(we){let xt;if(je[19]!==at)xt=e(n,{bold:!0,children:at}),je[19]=at,je[20]=xt;else xt=je[20];let Et;if(je[21]===b)Et=e(Sj,{children:"untracked"}),je[21]=Et;else Et=je[21];let Kt;if(je[22]!==xt)Kt=r(s,{children:[xt,Et]}),je[22]=xt,je[23]=Kt;else Kt=je[23];let Xt;if(je[24]!==$e)Xt=e(Ol,{width:$e}),je[24]=$e,je[25]=Xt;else Xt=je[25];let no;if(je[26]===b)no=e(n,{dimColor:!0,italic:!0,children:"New file not yet staged."}),je[26]=no;else no=je[26];let io;if(je[27]!==at)io=!Ht()&&r(n,{dimColor:!0,italic:!0,children:["Run `git add :/",at,"` to see line counts."]}),je[27]=at,je[28]=io;else io=je[28];let po;if(je[29]!==io)po=r(s,{flexDirection:"column",children:[no,io]}),je[29]=io,je[30]=po;else po=je[30];let co;if(je[31]!==Kt||je[32]!==Xt||je[33]!==po)co=r(s,{flexDirection:"column",width:"100%",children:[Kt,Xt,po]}),je[31]=Kt,je[32]=Xt,je[33]=po,je[34]=co;else co=je[34];return co}if(ee){let xt;if(je[35]!==at)xt=e(s,{children:e(n,{bold:!0,children:at})}),je[35]=at,je[36]=xt;else xt=je[36];let Et;if(je[37]!==$e)Et=e(Ol,{width:$e}),je[37]=$e,je[38]=Et;else Et=je[38];let Kt;if(je[39]===b)Kt=e(s,{flexDirection:"column",children:e(n,{dimColor:!0,italic:!0,children:"Binary file - cannot display diff"})}),je[39]=Kt;else Kt=je[39];let Xt;if(je[40]!==xt||je[41]!==Et)Xt=r(s,{flexDirection:"column",width:"100%",children:[xt,Et,Kt]}),je[40]=xt,je[41]=Et,je[42]=Xt;else Xt=je[42];return Xt}if(L){let xt;if(je[43]!==at)xt=e(s,{children:e(n,{bold:!0,children:at})}),je[43]=at,je[44]=xt;else xt=je[44];let Et;if(je[45]!==$e)Et=e(Ol,{width:$e}),je[45]=$e,je[46]=Et;else Et=je[46];let Kt;if(je[47]===b)Kt=e(s,{flexDirection:"column",children:e(n,{dimColor:!0,italic:!0,children:Ht()?"Diff too large to display.":"Large file - diff exceeds 1 MB limit"})}),je[47]=Kt;else Kt=je[47];let Xt;if(je[48]!==xt||je[49]!==Et)Xt=r(s,{flexDirection:"column",width:"100%",children:[xt,Et,Kt]}),je[48]=xt,je[49]=Et,je[50]=Xt;else Xt=je[50];return Xt}let xt;if(je[51]!==at)xt=e(n,{bold:!0,children:at}),je[51]=at,je[52]=xt;else xt=je[52];const Et=he??!1;let Kt;if(je[53]!==Et)Kt=e(Sj,{when:Et,children:"truncated"}),je[53]=Et,je[54]=Kt;else Kt=je[54];let Xt;if(je[55]!==xt||je[56]!==Kt)Xt=r(s,{children:[xt,Kt]}),je[55]=xt,je[56]=Kt,je[57]=Xt;else Xt=je[57];let no;if(je[58]!==$e)no=e(Ol,{width:$e}),je[58]=$e,je[59]=no;else no=je[59];let io;if(je[60]!==$e||je[61]!==Ft||je[62]!==T||je[63]!==Mt||je[64]!==M)io=M.length===0?e(fo,{children:"No diff content"}):M.map((_o,xo)=>e(H4,{patch:_o,filePath:T,firstLine:Mt,fileContent:Ft,dim:!1,width:$e},xo)),je[60]=$e,je[61]=Ft,je[62]=T,je[63]=Mt,je[64]=M,je[65]=io;else io=je[65];let po;if(je[66]!==io)po=e(s,{flexDirection:"column",children:io}),je[66]=io,je[67]=po;else po=je[67];let co;if(je[68]!==he)co=he&&e(n,{dimColor:!0,italic:!0,children:"\u2026 diff truncated (exceeded 400 line limit)"}),je[68]=he,je[69]=co;else co=je[69];let go;if(je[70]!==co||je[71]!==Xt||je[72]!==no||je[73]!==po)go=r(s,{flexDirection:"column",width:"100%",children:[Xt,no,po,co]}),je[70]=co,je[71]=Xt,je[72]=no,je[73]=po,je[74]=go;else go=je[74];return go}

// chunk-rwv4cv93.js Ol: the divider row, optional centered title between repeated characters [902,2099) 1197 units sha256 3eef08fefa3738e5fb277a220246f748a5872985c3371685c7eef53039926b4d
function Ol(E){let d=w(27),{width:F,color:t,char:C,padding:M,title:i,titleAlign:x}=E,o=C===void 0?yV:C,G=M===void 0?0:M,H=x===void 0?"center":x,{columns:I}=ke(),f=Math.max(0,(F??I)-G),D;if(d[0]!==t||d[1]!==i)D=i?e(n,{color:t,dimColor:!t,children:e(Do,{children:i})}):null,d[0]=t,d[1]=i,d[2]=D;else D=d[2];let v=D;if(i){let J=ae(i)+2;let b=Math.max(0,f-J);let s=H==="start"?Math.min(4,b):Math.floor(b/2);let k=b-s;const c=!t;let l;if(d[3]!==o||d[4]!==s)l=o.repeat(s),d[3]=o,d[4]=s,d[5]=l;else l=d[5];let h;if(d[6]!==i)h=e(n,{dimColor:!0,children:e(Do,{children:i})}),d[6]=i,d[7]=h;else h=d[7];let p;if(d[8]!==o||d[9]!==k)p=o.repeat(k),d[8]=o,d[9]=k,d[10]=p;else p=d[10];let W;if(d[11]!==t||d[12]!==c||d[13]!==l||d[14]!==h||d[15]!==p)W=r(n,{color:t,dimColor:c,children:[l," ",h," ",p]}),d[11]=t,d[12]=c,d[13]=l,d[14]=h,d[15]=p,d[16]=W;else W=d[16];let R;if(d[17]!==v||d[18]!==W)R=e(XN,{fallback:v,children:W}),d[17]=v,d[18]=W,d[19]=R;else R=d[19];return R}const c=!t;let l;if(d[20]!==o||d[21]!==f)l=o.repeat(f),d[20]=o,d[21]=f,d[22]=l;else l=d[22];let h;if(d[23]!==t||d[24]!==c||d[25]!==l)h=e(XN,{children:e(n,{color:t,dimColor:c,children:l})}),d[23]=t,d[24]=c,d[25]=l,d[26]=h;else h=d[26];return h}

// chunk-1r9zp6s1.js XN: children, or the fallback when a screen reader is active [19763,19829) 66 units sha256 cf13685ead8ef25ece2f681b7df28bee4fba9feb755f43d1d8a0052ee016fa49
function XN(o){let{children:r,fallback:l}=o;return nt()?l??null:r}

// chunk-3cynezh1.js yV: the box drawing character the divider repeats [66071,66113) 42 units sha256 1eca74506ecca03a84c6c878bdca0507d98a2b2e4faa51a40f4416b751e48e15
var Dvo="\u258E",Lvo="\u2588",yV="\u2500";


export { Uwe, Sj, pBe, Ol, XN, yV };
