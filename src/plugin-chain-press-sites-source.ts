// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { L } from './plugin-chain-source.js';

// chunk-nyce03br.js `w3` — the element names each surface offers [84644,84984) 340 units sha256 9b527c030d5c501d4bf64a9bd38ab572aa12a0220895f3dd034aa93996b532b4
var w3={terminal:["Box","Text","Button","Input","Select","Link","Code","Markdown","Client","Raster","Image"],desktop:["Box","Text","Button","Input","Select","Svg","Link","Code","Markdown","Client"],mobile:["Box","Text","Button","Svg","Link","Code","Markdown"],vscode:["Box","Text","Button","Input","Select","Svg","Link","Code","Markdown"]};

// chunk-nyce03br.js `vFe` — whether a name is a surface [85526,85580) 54 units sha256 962ed93856bd5e991aedcec5335b3a901ebf8a2e0bd7924669229cfb600ffa3b
var vFe=(e)=>typeof e==="string"&&Object.hasOwn(w3,e);

// chunk-nyce03br.js `C` — wrap an argument check so a non-object result is refused first [15370,15444) 74 units sha256 d0fc4c96b0ee85c2121481fbf91246fc86c5260eb8ef7a9bc3869f1eb090eed7
var C=(e)=>(t,o,r)=>L(t)?e(t,o,r):"something that is not a result object";

// chunk-nyce03br.js `ot` — the press argument check shared by input and select [86234,86790) 556 units sha256 10a5b7f249e331097063bfe21e25f82a85509e3748da0382b37102658d573094
function ot(e,t){if(e.plugin!==t.plugin)return"a plugin other than the one that drew the element";if(typeof e.element!=="string")return"no { element }";if(typeof e.component!=="string")return"no { component }";if(e.requestId!==t.requestId)return"a requestId other than the instance the element was drawn in";if(!vFe(e.surface))return"no { surface } naming a surface";let{link:i}=e;if(t.link===void 0)return i!==void 0?"a { link } on a press that had none":void 0;return L(i)&&typeof i.href==="string"?void 0:"no { link: { href } } on a press that had one"}

// chunk-nyce03br.js `mn` — the input argument check [86790,86978) 188 units sha256 551447f0ccb24c4ffa9e716ced311e94f1cfea2b7a8d45065a8982d491c5a9f9
function mn(e,t){let o=ot(e,t);if(o!==void 0)return o;if(e.kind!==t.kind)return`a kind other than the ${t.kind} it was given`;return typeof e.value==="string"?void 0:"no { value } string"}

// chunk-nyce03br.js `Cn` — the select argument check [93336,93452) 116 units sha256 4a54c6460dbabdef63854c1366bd0dc73665c7c13a7fb0b992e5ec16b0d06661
function Cn(e,t){let o=ot(e,t);if(o!==void 0)return o;return typeof e.value==="string"?void 0:"no { value } string"}

// chunk-nyce03br.js `Lt` — build an input/select site descriptor [44342,44484) 142 units sha256 34e59bccf78fe87e04123c6617a743aad4836d618ede16ef9311eae9c34d7f43
var Lt=(e,t)=>({event:e,checkArgument:t,check:C((o)=>typeof o.element==="string"&&typeof o.value==="string"?void 0:"no { element, value }")});

// chunk-nyce03br.js `ya` — the ui.press site [93534,93643) 109 units sha256 cf46aa17d8ecfc1025a9fcae8a3de52423b74d235134cf2fa517168df1aef873
var ya={event:"ui.press",checkArgument:ot,check:C((e)=>typeof e.element==="string"?void 0:"no { element }")};

// chunk-nyce03br.js `da` — the ui.input site [93452,93477) 25 units sha256 560c5da19052fcc651977030cc35af73892bf956c77851fdb2de81b818b14412
var da=Lt("ui.input",mn);

// chunk-nyce03br.js `ha` — the ui.select site [94058,94084) 26 units sha256 bb4e62501c0412554e60210493ce1274914b516e1da33ab1a2b7e4e7fd20e2fd
var ha=Lt("ui.select",Cn);


export { w3, vFe, C, ot, mn, Cn, Lt, ya, da, ha };
