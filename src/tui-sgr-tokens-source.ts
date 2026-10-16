// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-q4ya5hp8.js sha256 af9981afeb41bc2063fc88fbd1386bf960f9f731336e5b9f43a1525571ca31f3
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { ansiIntroducers as x, csiBracket as S, oscBracket as y, oscEightPrefix as f, oscEightPrefixCodeUnits as A, closeAnsiCode as B } from './tui-style-diff.js';

// chunk-q4ya5hp8.js the fullwidth-form code point ranges (the wide width table's ambiguous half) [6940,7011) 71 units sha256 29c49b34ac087130abea62a888340b0274fb96e5d25d0d15eb0f8c30aa91ba72
function a(e){return e===12288||e>=65281&&e<=65376||e>=65504&&e<=65510}

// chunk-q4ya5hp8.js the wide code point range table (CJK, hangul, fullwidth forms, supplementary planes) [7011,9282) 2271 units sha256 fa2082f98b32ea4740223b17d14ea8bb521bbb717740ba43087c0e9a8bee4012
function C(e){return e>=4352&&e<=4447||e===8986||e===8987||e===9001||e===9002||e>=9193&&e<=9196||e===9200||e===9203||e===9725||e===9726||e===9748||e===9749||e>=9776&&e<=9783||e>=9800&&e<=9811||e===9855||e>=9866&&e<=9871||e===9875||e===9889||e===9898||e===9899||e===9917||e===9918||e===9924||e===9925||e===9934||e===9940||e===9962||e===9970||e===9971||e===9973||e===9978||e===9981||e===9989||e===9994||e===9995||e===10024||e===10060||e===10062||e>=10067&&e<=10069||e===10071||e>=10133&&e<=10135||e===10160||e===10175||e===11035||e===11036||e===11088||e===11093||e>=11904&&e<=11929||e>=11931&&e<=12019||e>=12032&&e<=12245||e>=12272&&e<=12287||e>=12289&&e<=12350||e>=12353&&e<=12438||e>=12441&&e<=12543||e>=12549&&e<=12591||e>=12593&&e<=12686||e>=12688&&e<=12773||e>=12783&&e<=12830||e>=12832&&e<=12871||e>=12880&&e<=42124||e>=42128&&e<=42182||e>=43360&&e<=43388||e>=44032&&e<=55203||e>=63744&&e<=64255||e>=65040&&e<=65049||e>=65072&&e<=65106||e>=65108&&e<=65126||e>=65128&&e<=65131||e>=94176&&e<=94180||e>=94192&&e<=94198||e>=94208&&e<=101589||e>=101631&&e<=101662||e>=101760&&e<=101874||e>=110576&&e<=110579||e>=110581&&e<=110587||e===110589||e===110590||e>=110592&&e<=110882||e===110898||e>=110928&&e<=110930||e===110933||e>=110948&&e<=110951||e>=110960&&e<=111355||e>=119552&&e<=119638||e>=119648&&e<=119670||e===126980||e===127183||e===127374||e>=127377&&e<=127386||e>=127488&&e<=127490||e>=127504&&e<=127547||e>=127552&&e<=127560||e===127568||e===127569||e>=127584&&e<=127589||e>=127744&&e<=127776||e>=127789&&e<=127797||e>=127799&&e<=127868||e>=127870&&e<=127891||e>=127904&&e<=127946||e>=127951&&e<=127955||e>=127968&&e<=127984||e===127988||e>=127992&&e<=128062||e===128064||e>=128066&&e<=128252||e>=128255&&e<=128317||e>=128331&&e<=128334||e>=128336&&e<=128359||e===128378||e===128405||e===128406||e===128420||e>=128507&&e<=128591||e>=128640&&e<=128709||e===128716||e>=128720&&e<=128722||e>=128725&&e<=128728||e>=128732&&e<=128735||e===128747||e===128748||e>=128756&&e<=128764||e>=128992&&e<=129003||e===129008||e>=129292&&e<=129338||e>=129340&&e<=129349||e>=129351&&e<=129535||e>=129648&&e<=129660||e>=129664&&e<=129674||e>=129678&&e<=129734||e===129736||e>=129741&&e<=129756||e>=129759&&e<=129770||e>=129775&&e<=129784||e>=131072&&e<=196605||e>=196608&&e<=262141}

// chunk-q4ya5hp8.js the full-width code point test the tokenizer reports per character [9475,9540) 65 units sha256 b83cd7db6a1dba4d933131deada153ba9f73bb972324816b681706e2e3e501d9
function h(e){if(!Number.isInteger(e))return!1;return a(e)||C(e)}

// chunk-q4ya5hp8.js the hyperlink (OSC 8) sequence reader: the prefix match and the BEL-terminated slice [9540,9701) 161 units sha256 07168810be1331e52a4377ae05cda8b128b1736fdbae5440535b32e525d4df33
function _(e,t){e=e.slice(t);for(let n=1;n<A.length;n++)if(e.charCodeAt(n)!==A[n])return;let o=e.indexOf("\x07",f.length);if(o===-1)return;return e.slice(0,o+1)}

// chunk-q4ya5hp8.js the CSI scan's character codes: 0-9, ';' and 'm' [9701,9726) 25 units sha256 d27d4373c8ba8fe03b1524e3d167aab4a0fe461d7d6631663711e5d2b48a7f92
var P=48,j=57,G=59,R=109;

// chunk-q4ya5hp8.js the CSI sequence end scan: digits and semicolons up to the final byte [9726,9864) 138 units sha256 7eb8a97725b40fe5beb43db8723f8fe9c5918756e4102335d1d589b83b9ecddf
function K(e){for(let t=2;t<e.length;t++){let o=e.charCodeAt(t);if(o===R)return t;if(o===G)continue;if(o>=P&&o<=j)continue;break}return-1}

// chunk-q4ya5hp8.js the CSI sequence slice from the end scan [9864,9943) 79 units sha256 ad74b7b1fafe6d3cc9276ae973f477ffa08403ad4dd35d23c006d2548b0e5a5d
function U(e,t){e=e.slice(t);let o=K(e);if(o===-1)return;return e.slice(0,o+1)}

// chunk-q4ya5hp8.js the SGR splitter: one sequence per colour, keeping extended 38/48;5;n and 38/48;2;r;g;b parameter groups together [9943,10289) 346 units sha256 00485d7a41c80fbdbc29cd93da2b49299ac86d802d16a264ea41647b1de2df41
function q(e){if(!e.includes(";"))return[e];let t=e.slice(2,-1).split(";"),o=[];for(let n=0;n<t.length;n++){let r=t[n];if(r==="38"||r==="48"){if(n+2<t.length&&t[n+1]==="5"){o.push(t.slice(n,n+3).join(";")),n+=2;continue}else if(n+4<t.length&&t[n+1]==="2"){o.push(t.slice(n,n+5).join(";")),n+=4;continue}}o.push(r)}return o.map((n)=>`\x1B[${n}m`)}

// chunk-q4ya5hp8.js the ANSI tokenizer: escape sequences as ansi tokens carrying their close code, every other code point as a char token carrying its full-width flag, up to a visible-width budget [10289,10753) 464 units sha256 5f376ae53b53e81d9ab3e5b026fa470efe099069229e100cf511876ccb1499c6
function _ns(e,t=Number.POSITIVE_INFINITY){let o=[],n=0,r=0;while(n<e.length){let i=e.codePointAt(n);if(x.has(i)){let s,p=e.codePointAt(n+1);if(p===y){if(s=_(e,n),s)o.push({type:"ansi",code:s,endCode:B(s)})}else if(p===S){if(s=U(e,n),s){let w=q(s);for(let g of w)o.push({type:"ansi",code:g,endCode:B(g)})}}if(s){n+=s.length;continue}}let u=h(i),l=String.fromCodePoint(i);if(o.push({type:"char",value:l,fullWidth:u}),n+=l.length,r+=u?2:l.length,r>=t)break}return o}


export { _ns };
