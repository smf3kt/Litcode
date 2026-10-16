// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// `zd` is the host's site table, which `Mm` reads when it pairs a site with a core; the product
// registers the twelve sites (./plugin-chain-sites-registration.ts) before this file evaluates.
import { zd } from './plugin-chain-host.js';
import { Mm } from './plugin-chain-entry.js';

// chunk-sfn1dbxq.js Joe: the agent.offer core, `{ isOffered: true }` [447999,448102) 103 units sha256 2681f8b015da5e8bd6b12869eff1185a7f64ef2815d937c07a5c7d7f9d07a33e
var Joe={site:zd["agent.offer"],core:{name:"core",isCore:!0,budgetMs:0,run:async()=>({isOffered:!0})}};

// chunk-sfn1dbxq.js Cht: the five chains whose core answers the text unchanged [459180,459384) 204 units sha256 9c4817278a951924f54215397cd714c55ebf9a8d81521084e8d275bfc3d592da
var Cht={"prompt.section":(e)=>({text:e.text}),"prompt.attachment":(e)=>({text:e.text}),"skill.prompt":(e)=>({text:e.text}),"attribution.text":(e)=>({text:e.text}),"session.receive":(e)=>({text:e.text})};

// chunk-sfn1dbxq.js HT: the chain builder for a name in Cht [459472,459497) 25 units sha256 c2be1be748e78253ab8f5d6b9387a905285964075210b6a663ba5bba93ef2e6d
var HT=(e)=>Mm(e,Cht[e]);

// chunk-sfn1dbxq.js _re: the attribution.text chain [459497,459528) 31 units sha256 746cd67fbe672917088afd552382619dcbf38fad26bba24ec4f5c8ba18f6f56c
var _re=HT("attribution.text");

// chunk-sfn1dbxq.js COe: the command.describe core projection [459638,459729) 91 units sha256 ce5d330d0c732c2317c74ab2b83b4ad6125c1a3f7bdb6dd1a90a2d1f3f37f0af
var COe=(e)=>({description:e.description,argumentHint:e.argumentHint,isHidden:e.isHidden});

// chunk-sfn1dbxq.js kre: the command.describe chain [459729,459828) 99 units sha256 ab71f33228fa5db08a9354c632a676fd68afb95cb343c599d690e10311ef4cbf
var kre={site:zd["command.describe"],core:{name:"core",isCore:!0,budgetMs:0,run:async(e)=>COe(e)}};

// chunk-sfn1dbxq.js wre: the config.describe core projection [459828,459905) 77 units sha256 e9aacca864c38c86596be24dc1778b0471e84b538141f37e40ed18016d211859
var wre=(e)=>({label:e.label,description:e.description,isHidden:e.isHidden});

// chunk-sfn1dbxq.js YH: the config.describe chain [459905,460002) 97 units sha256 74b2108aa2d5e4a1409e576a70196f47a59e44d94d8a31ae9de1f35ebd313596
var YH={site:zd["config.describe"],core:{name:"core",isCore:!0,budgetMs:0,run:async(e)=>wre(e)}};

// chunk-sfn1dbxq.js vre: the prompt.attachment chain [460002,460034) 32 units sha256 5228248910cb770ffec249b5a3174b51bf06a1c613c7d4f32985d77918aadf10
var vre=HT("prompt.attachment");

// chunk-sfn1dbxq.js Rre: the prompt.autocomplete chain, `{ suggestions: [] }` [460034,460091) 57 units sha256 fa132fd972bd5dc485b7a0f9655e12e79c546fbdf19133083c46d31019ba3cb0
var Rre=Mm("prompt.autocomplete",()=>({suggestions:[]}));

// chunk-sfn1dbxq.js xre: the prompt.context core, the two lists handed back [460263,460409) 146 units sha256 e9ed7221e3848404610294ce59f517875d5cbd04a4a250e6fad617a234b4f051
var xre={site:zd["prompt.context"],core:{name:"core",isCore:!0,budgetMs:0,run:async(e)=>({blocks:e.blocks,instructionFiles:e.instructionFiles})}};

// chunk-sfn1dbxq.js Fre: the prompt.section chain [470161,470190) 29 units sha256 5c4ca530bfa0556cb9cd7b7aa1d974ef66e4c3c7ae44a40d7859595423097ac3
var Fre=HT("prompt.section");

// chunk-sfn1dbxq.js ose: the session.receive chain [474276,474306) 30 units sha256 203db5b41e024bc45ea37f018856270770d43302a5d65aee0dc09a31f80ee418
var ose=HT("session.receive");

// chunk-sfn1dbxq.js ise: the skill.prompt chain [474334,474361) 27 units sha256 cbf1c3889113921dd43010ebcab38b84b884f9f0513f6503b33f9ed0720445df
var ise=HT("skill.prompt");

// chunk-sfn1dbxq.js lse: the telemetry.mark chain, `{ value: undefined }` [475160,475210) 50 units sha256 033b4f6fe7f6da205d44f034e5888f82c1866d4766820c2ee7febe48fbfaa41f
var lse=Mm("telemetry.mark",()=>({value:void 0}));

// chunk-sfn1dbxq.js cse: the tool.describe core projection [475210,475394) 184 units sha256 e2d2bf29544414edb096596c511e807a159d7a6dcdd32d1421338280e59fec7d
var cse={site:zd["tool.describe"],core:{name:"core",isCore:!0,budgetMs:0,run:async(e)=>{let{description:n,isDeferred:r}=e;return r===!0?{description:n,isDeferred:r}:{description:n}}}};


export { Joe, kre, YH, cse, Rre, lse, xre, Fre, vre, ise, _re, ose, Cht, HT, COe, wre };
