// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-z7whhrje.js sha256 3dca9fb572e08c43b779dd32b44d21858a177e021557bacb2a126e4ed268a3ac
//   chunk-yvnhkg35.js sha256 ce3689687897e987959f19ab07f98d79e5c925a8b15620dce02d29ba4943348d
//   chunk-mvsmkx6d.js sha256 78b6816967ea34054d2cf68f13e3baa99249fa08da96cfe43e1d080b422b9c7a
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { a } from "./tui-markdown-host.js";
import { Nx } from "./tui-text-style.js";
import { q } from "./plugin-chain-local-store-source.js";
import { DT, Su, B } from "./plugin-chain-terminal-environment-host.js";

// chunk-z7whhrje.js terminal environment probe: class E, the per-host singleton S, uq, fLr, oe, v4n, ie and the invalidator s$t [1978,3336) 1358 units sha256 01e7404f7dba411971308820508fd250e249a48925a5c0b46926319f5faf5eba
class E{value=void 0;get(){let r=U1t(),n=Su(),o=n?.wheelFlood??fLr(),u=n?Fse.includes(n.terminal??""):Nx.isJetBrainsIdeTerminal(),i=n?.wtSession??!!a.WT_SESSION,p=jg(),s=this.value;if(s&&s.xtversion===(r??"(no reply)")&&s.wheelFlood===o&&s.jediTerm===u&&s.wtSession===i&&s.xtermJs===p)return s;let d="darwin";return this.value={useDecayCurve:!o&&(p||d==="win32"||i),useAdaptiveDrain:p,base:u?2:ie(p,o,i),xtermJs:p,wheelFlood:o,jediTerm:u,termProgram:a.TERM_PROGRAM??"unset",termProgramVersion:a.TERM_PROGRAM_VERSION??"unset",xtversion:r??"(no reply)",wtSession:i,scrollSpeedEnv:a.CLAUDE_CODE_SCROLL_SPEED??"unset",platform:d},this.value}invalidate(){this.value=void 0}}var S=new q(()=>new E);function uq(){return S.of(B().host).get()}function fLr(){if(process.env.CURSOR_TRACE_ID!==void 0)return!0;if(a.VSCODE_GIT_ASKPASS_MAIN?.includes("cursor"))return!0;if(a.TERM_PROGRAM==="vscode"){let r=oe(a.TERM_PROGRAM_VERSION);if(r!==null)return r>=1092000&&r<1105000}return U1t()?.startsWith("xterm.js")??!1}function oe(r){if(!r)return null;let n=/^(\d+)\.(\d+)\.(\d+)/.exec(r);if(!n)return null;return+n[1]*1e6+ +n[2]*1000+ +n[3]}function v4n(r,n,o){return!n&&(r||!1||o)?3:1}function ie(r,n,o){let u=v4n(r,n,o),i=a.CLAUDE_CODE_SCROLL_SPEED;if(!i)return u;let p=parseFloat(i);return Number.isNaN(p)||p<=0?u:Math.min(p,20)}function s$t(){S.of(B().host).invalidate()}

// chunk-yvnhkg35.js Fse the JetBrains terminal names [6703,6878) 175 units sha256 e438d074de73affe798a6fb75ccc976e429aa421ce075c4d7cb3b63ef18f5fcd
var Fse=["pycharm","intellij","webstorm","phpstorm","rubymine","clion","goland","rider","datagrip","appcode","dataspell","aqua","gateway","fleet","jetbrains","androidstudio"];

// chunk-mvsmkx6d.js U1t the terminal version name and jg the xterm.js test [6611,6789) 178 units sha256 74385dacdf95c2bb1940c001d7cd6eac2e7825f8ee74cc19f7a5519e26e653d9
function U1t(){return DT().xtversionName}function jg(){if(Su()?.isVscodeTerm)return!0;if(a.TERM_PROGRAM==="vscode")return!0;return DT().xtversionName?.startsWith("xterm.js")??!1}


export { uq, s$t };
