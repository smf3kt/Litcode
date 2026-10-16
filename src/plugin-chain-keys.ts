// The keybinding action tables and the two checks the Button reads (W45-66). The copied bodies live in
// ./plugin-chain-keys-source.ts; this module is the host seam around them. The source keeps its
// keybindings in one module: the defaults it starts from, the names it knows, the keys it reserves, and
// the two membership checks a plugin surface is measured with — `dcs`, "is this one of the engine's
// actions", and `acs`, "is this one the engine holds alone". The Button is the last leaf of the site
// table and asks both.
//
// Source, chunk-6ccen3s8.js. The platform header and the binding sets it gates:
//
//   var L=O(),Ie=L==="windows"||L==="wsl",Me=Ie?"alt+v":"ctrl+v",Le=L!=="windows"||(nA()?Yho("1.4.3",">=1.2.23"):Yho(process.versions.node,">=22.17.0 <23.0.0 || >=24.2.0")),le=Le?"shift+tab":"meta+m",w1=[{context:"Global",bindings:{"ctrl+c":"app:interrupt","ctrl+d":"app:exit","ctrl+t":"app:toggleTodos","ctrl+o":"app:toggleTranscript","ctrl+shift+b":"app:toggleBrief","ctrl+r":"history:search","ctrl+up":"app:diffFileListUp","ctrl+down":"app:diffFileListDown","meta+up":"app:diffFileListUp","meta+down":"app:diffFileListDown",...{},...{"ctrl+]":"app:openArtifact"},...{},...{}}},{context:"DiffPanel",bindings:{"ctrl+x b":"app:cycleDiffBase"}},{context:"FeedbackSurvey",bindings:{"ctrl+x 1":"feedbackSurvey:bad","ctrl+x 2":"feedbackSurvey:fine","ctrl+x 3":"feedbackSurvey:good"}},{context:"Chat",bindings:{escape:"chat:cancel","ctrl+l":"cha
//   …
//   s","ctrl+n":"select:next","ctrl+p":"select:previous",pageup:"select:pageUp",pagedown:"select:pageDown",home:"select:first",end:"select:last",enter:"select:accept",escape:"select:cancel"}},{context:"Plugin",bindings:{space:"plugin:toggle",i:"plugin:install",f:"plugin:favorite",...{"ctrl+s":"plugin:cycleMarketplace"}}},{context:"Agents",bindings:{"ctrl+s":"agents:switchView","ctrl+t":"agents:togglePin","ctrl+f":"agents:find","ctrl+r":"agents:rename","ctrl+up":"agents:previousGroup","meta+up":"agents:previousGroup","ctrl+down":"agents:nextGroup","meta+down":"agents:nextGroup",...{}}}];
//
// [1764,8839) 7,075 units. The statement is two things at once: the platform header and the defaults
// table it gates. `L` is the platform the defaults were computed for (through `O`, the platform probe
// the fs boundary owns), `Ie` whether it is Windows or WSL, `Me` the paste binding that platform uses,
// and `Le`/`le` the toggle binding — on anything but Windows `Le` short-circuits to true, so the
// version comparison the header carries is never reached there. Then `w1`: the array of
// `{ context, bindings }` the engine starts from, `Global` holding the interrupt and exit keys, each of
// the rest a context and the keys it claims, every binding a normalised key naming an action.
//
// The action names `dcs` checks against, and the sentence each binding context carries:
//
//   var ccs={Global:"Active everywhere, regardless of focus",Chat:"When the chat input is focused",Autocomplete:"When autocomplete menu is visible",Confirmation:"When a confirmation/permission dialog is shown",Help:"When the help overlay is open",ProactivityMenu:"When the proactivity dialog is open",
//   …
//   roll:halfPageUp","scroll:halfPageDown","scroll:fullPageUp","scroll:fullPageDown","selection:copy","selection:clear","selection:extendLeft","selection:extendRight","selection:extendUp","selection:extendDown","selection:extendLineStart","selection:extendLineEnd","agents:switchView","agents:togglePin","agents:find","agents:nextGroup","agents:previousGroup","agents:rename","agents:setGroup"];
//
// [11563,16491) 4,928 units. `ZDe` is the list of every action name the engine knows —
// `scroll:halfPageUp`, `selection:copy`, `agents:setGroup` and the rest — and `ccs` the one-line
// description of each context a binding may be filed under.
//
// The membership set, and the check that reads it:
//
//   var QOn=["FeedbackSurvey"],pe=new Set(ZDe);function dcs(e){return pe.has(e)}
//
// [16491,16567) 76 units. `QOn` is the contexts a survey prompt may name; `pe` is `ZDe` as a set; and
// `dcs(e){return pe.has(e)}` is the answer to "is this name one of the engine's keybinding actions".
// That is the first half of what the Button refuses an action for, and it is a set lookup rather than a
// scan, so a name is known or it is not.
//
// The keys the engine reserves, and the three bodies that read them:
//
//   var QDe=[{key:"ctrl+c",reason:"Cannot be rebound - used for interrupt/exit (hardcoded)",severity:"error"},{key:"ctrl+d",reason:"Cannot be rebound - used for exit (hardcoded)",severity:"error"},{key:"ctrl+m",reason:"Cannot be rebound - identical to Enter in terminals (both send CR)",severity:"error"},{key:"ctrl+[",reason:"Cannot be rebound - identical to Escape in terminals",severity:"error"},{key:"ctrl+i",reason:"Cannot be rebound - identical to Tab in terminals",severity:"error"},{key:"ctrl+h",reason:"Cannot be rebound - identical to Backspace in terminals",severity:"error"},{key:"capsloc
//   …
//    (SIGTSTP)",severity:"warning"},{key:"ctrl+\\",reason:"Terminal quit signal (SIGQUIT)",severity:"error"}],Foo=[{key:"cmd+c",reason:"macOS system copy",severity:"error"},{key:"cmd+v",reason:"macOS system paste",severity:"error"},{key:"cmd+x",reason:"macOS system cut",severity:"error"},{key:"cmd+q",reason:"macOS quit application",severity:"error"},{key:"cmd+w",reason:"macOS close window/tab",severity:"error"},{key:"cmd+tab",reason:"macOS app switcher",severity:"error"},{key:"cmd+space",reason:"macOS Spotlight",severity:"error"}];
//
// [17524,18783) 1,259 units. `QDe` lists the keys that cannot be rebound, each with the reason and a
// severity — `ctrl+c` for interrupt and exit, `ctrl+m` because a terminal sends the same byte as Enter,
// and so on. `Noo` and `Foo` are declared in the same statement.
//
//   function pqe(e){if(e===" ")return"space";return e.trim().split(/\s+/).map(Ye).join(" ")}
//
// [18864,18952) 88 units. `pqe` is the normaliser everything reserved is read through: the space key is
// named as a word, the rest is trimmed, split on whitespace and each part run through `Ye`.
//
//   var Ge={esc:"escape",return:"enter",del:"delete","\u2191":"up","\u2193":"down","\u2190":"left","\u2192":"right",caps:"capslock","caps-lock":"capslock",caps_lock:"capslock"};function Ye(e){let r=e.split("+"),n=[],s="";for(let c of r){let y=c.trim().toLowerCase();if(["ctrl","control","alt","opt","option","meta","cmd","command","super","win","shift"].includes(y))if(y==="control")n.push("ctrl");else if(y==="option"||y==="opt"||y==="meta")n.push("alt");else if(y==="command"||y==="cmd"||y==="super"||y==="win")n.push("cmd");else n.push(y);else s=Ge[y]??y}return n.sort(),[...n,s].join("+")}
//
// [18952,19541) 589 units. `Ge` resolves a lone key written one of several ways — the three spellings of
// capslock, the four arrow glyphs, `esc`, `return`, `del` — and `Ye` is the modifier normaliser: each
// part lowercased, the spellings of alt and meta folded together, the modifiers sorted, and the key
// resolved through `Ge`, so that `"Ctrl+Shift+B"` and `"shift+ctrl+b"` are one key.
//
//   var ee;function acs(e){if(!ee){let r=new Set(QDe.map((s)=>pqe(s.key))),n=new Set;for(let s of w1)for(let[c,y]of Object.entries(s.bindings))if(y!==null&&r.has(pqe(c)))n.add(y);ee=n}return ee.has(e)}
//
// [19541,19738) 197 units. `ee` is the memo slot; `acs` is the second half of the Button's action check:
// the reserved keys are normalised into a set, every default binding whose key is one of them
// contributes its action name, and the set is kept — so `acs("app:interrupt")` is true because `Global`
// binds `ctrl+c` to it, and the Button refuses that name with the reason the table exists for.
//
//   function nA(){return!0}
//
// [1245,1268) 23 units. `nA` is the probe the platform header reads before it compares a version at
// all; the source answers true.
//
//   function Yho(e,n){return Bun.semver.satisfies(e,n)}
//
// [342203,342254) 51 units. `Yho` is the version comparison the header runs on a Windows host, and it
// reaches the runtime's own semver — `Bun.semver.satisfies`. The recovered application runs on Bun, so
// the copied body keeps the reach verbatim; under Node the name is a host global this port does not
// provide, and the only path that reaches it is the one this host never takes (measured: on darwin the
// header's `Le` short-circuits before the comparison). `Yho` is re-exported so a host can see the reach
// it would have to satisfy, and the keys suite installs the global as a fixture to prove the copied
// body calls through to it.
import {
  acs, ccs, dcs, Foo, Ge, Ie, L, Le, le, Me, nA, Noo, pe, pqe, QDe, QOn, w1, Ye, Yho, ZDe,
} from './plugin-chain-keys-source.js';

/** The platform the defaults were computed for (`L`), the key this platform pastes with (`Me`) and the
 *  key it toggles with (`le`). All three are read once, when the copied header runs. */
export const KEY_PLATFORM = L;
export const KEY_PASTE_KEY = Me;
export const KEY_TOGGLE_KEY = le;

/** The tables themselves, under the names the source gives them: every action name the engine knows
 *  (`ZDe`), the set `dcs` reads (`pe`), the defaults per context (`w1`), the contexts a survey may name
 *  (`QOn`), the description of each context (`ccs`), the reserved keys with their reasons (`QDe`), and
 *  the key alias table `Ye` resolves a lone key through (`Ge`). */
export const ACTION_NAMES = ZDe;
export const KNOWN_ACTIONS = pe;
export const DEFAULT_BINDINGS = w1;
export const SURVEY_CONTEXTS = QOn;
export const CONTEXT_DESCRIPTIONS = ccs;
export const RESERVED_KEYS = QDe;
export const KEY_ALIASES = Ge;

/** Source `dcs`: is this name one of the engine's keybinding actions. The Button refuses an action the
 *  engine does not know with the name quoted back at it. */
export function knownAction(name: unknown): boolean {
  return dcs(name);
}

/** Source `acs`: is this name one the engine holds alone — bound to one of the reserved keys, so a
 *  plugin cannot be given it. The Button refuses those with the reason the table carries. */
export function engineOnlyAction(name: unknown): boolean {
  return acs(name);
}

/** Source `pqe`: the key normaliser `acs` reads the reserved keys and the defaults through, with the
 *  space key named as a word. */
export function normalizeKey(key: string): string {
  return pqe(key);
}

/** Source `Ye`: the modifier normaliser behind `pqe` — spellings folded, modifiers sorted, the lone key
 *  resolved through the alias table. */
export function normalizeKeyParts(key: string): string {
  return Ye(key);
}

/** Source `Ie` and `Le` read as the header leaves them: whether the platform is Windows or WSL, and
 *  whether the toggle key is the one the version comparison would have changed. Both are decided once,
 *  when the copied header runs. */
export const KEY_PLATFORM_IS_WINDOWS = Ie;
export const KEY_PLATFORM_USES_TOGGLE = Le;

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  call with the source's own, plus the two helpers the header reads (`nA`, `Yho`) and the two names
 *  declared beside the reserved-key table (`Noo`, `Foo`). */
export const SOURCE_BODIES = { acs, ccs, dcs, Foo, Ge, Ie, L, Le, le, Me, nA, Noo, pe, pqe, QDe, QOn, w1, Ye, Yho, ZDe };

export { acs, ccs, dcs, Foo, Ge, Ie, L, Le, le, Me, nA, Noo, pe, pqe, QDe, QOn, w1, Ye, Yho, ZDe };
