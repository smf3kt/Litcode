import { L, xg } from '../src/plugin-chain-label-text-source.js';
import { Zs, rPe } from '../src/plugin-chain-normalize-source.js';
const ln=(c)=>c>=8204&&c<=8207||c===1564||c>=65024&&c<=65039||c>=6155&&c<=6159||c===10240;
const cn=(ch,c)=>L(ch,c)&&!ln(c);
const Ce=(v,p)=>{let o="";for(const ch of v)o+=p(ch,ch.codePointAt(0)??0)?"�":ch;return o};
const pc=(v)=>Zs(Ce(v,cn));
for(const s of ["a\u0007b","a​b","x… [+3 graphemes]","<div>A</div>","é","👩‍💻"]){const n=pc(s);console.log(JSON.stringify(s),"->",JSON.stringify(n),"stable",!(rPe.test(n)||xg(n)!==n));}
