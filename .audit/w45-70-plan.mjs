// W45-70 plan: the `$` call dispatcher and the rules it enforces — the withholding rules a hooks module
// is held to, the two scan rules over what that module declares, the host check, and the raise/stamp/run
// chain the call ends in — with the name lists and small predicates they read.
import fs from 'node:fs';

const plan = {
  imports: [
    '// The dispatcher reads the host seam (the log, the two-segment name predicate), the runner copy (the',
    '// overridden-answer chain, the raise application, the object test, the error class and the',
    '// override-dispatcher getter), the classic copy (the value-event catalog), the loader copy (the',
    '// withholding labels), the clock copy (is this a clock call), the ui copy (the plugin label and the',
    '// dropped-call record) and the host-call copy (the funnel and the two tables it reads). What is below',
    '// is the fresh half: the dispatcher, its five refusal rules, its two scan rules and the small name',
    '// lists and predicates they read.',
    "import { t } from './plugin-chain-host.js';",
    "import { Z$n } from './plugin-chain-host.js';",
    "import { Aws, He, L, swr } from './plugin-chain-source.js';",
    "import { Q$n } from './plugin-chain-classic-source.js';",
    "import { D5t } from './plugin-chain-loader-source.js';",
    "import { xme } from './plugin-chain-clock-env-source.js';",
    "import { CK, uMe } from './plugin-chain-ui-source.js';",
    "import { Cme, Hze, TDe } from './plugin-chain-host-call-source.js';",
  ],
  exports: ['R3', 'HGt', 'UGt', 'jGt', 'kme', 'Sme', 'nzt', 'H2e', 'kJt', 'Xqo', 'Qqo', 'G2e',
    'tho', 'Xt', 'tEs', 'Kt', 'nUn', 'Yo', 'ylt', 'rho', 'oRe', 'Hp', 'iIt'],
  blocks: [
    { file: 'chunk-sfn1dbxq.js', range: [1837694, 1837732], note: '`R3` — the first segment of a dotted name, which is what the refusal log keys on' },
    { file: 'chunk-sfn1dbxq.js', range: [1837732, 1838166], note: '`HGt` — the sentence a withheld call is refused with, logged once per plugin and first segment' },
    { file: 'chunk-sfn1dbxq.js', range: [1838166, 1838257], note: '`UGt` — whether another hooks module that crashed while withholding also holds this first segment' },
    { file: 'chunk-sfn1dbxq.js', range: [1838257, 1838526], note: '`jGt` — the plugin a call is withheld by: the staged holder first, then the staged-before one, then the live set, then a crashed module' },
    { file: 'chunk-sfn1dbxq.js', range: [1838526, 1838826], note: '`kme` — whether the caller’s hooks module declares this call at all (the host rule over the scan)' },
    { file: 'chunk-sfn1dbxq.js', range: [1838826, 1839344], note: '`Sme` — the four gates a `$` call passes before anything runs: the scan, the withholding, the unadmitted module behind the call, and the clock exemption' },
    { file: 'chunk-sfn1dbxq.js', range: [1844394, 1844768], note: '`nzt` — the scan rule for `env.get`/`env.set`: the variable name the call passes must be one the module’s scan lists' },
    { file: 'chunk-sfn1dbxq.js', range: [2345040, 2345175], note: '`H2e` — the notice a refused-but-droppable call leaves: the text beside the record the `$` table reads' },
    { file: 'chunk-sfn1dbxq.js', range: [2355306, 2355414], note: '`kJt` — the spelling a call is refused under: an `interface.call` is named by its name and method' },
    { file: 'chunk-sfn1dbxq.js', range: [2355414, 2355576], note: '`Xqo` — the argument copy a state-carrying call is handed, so a hook cannot reach the object the plugin still holds' },
    { file: 'chunk-sfn1dbxq.js', range: [2355576, 2356082], note: '`Qqo` — the scan rule for `state.get`/`state.set`: the `{plugin, key}` a call passes must be one the module’s scan lists' },
    { file: 'chunk-sfn1dbxq.js', range: [2356082, 2356850], note: '`G2e` — the dispatcher itself: copy the arguments for a state call, run the four gates, the host check and its droppable notice, then raise, stamp and run — through the funnel for an event the catalog holds, through `interface.call`’s own road, or straight into the call table' },
    { file: 'chunk-m4qpskd4.js', range: [47535, 47564], note: '`tho` — whether the call goes through the funnel at all: the catalog’s own value events do' },
    { file: 'chunk-m4qpskd4.js', range: [51989, 52018], note: '`Xt` — the two names the environment scan covers; the runner copy declares its own `Xt` that is a different value, so this statement is copied rather than the name imported' },
    { file: 'chunk-m4qpskd4.js', range: [52018, 52046], note: '`tEs` — whether this call is one the environment scan reads' },
    { file: 'chunk-m4qpskd4.js', range: [52046, 52107], note: '`Kt` and `nUn` — the two names the state scan covers, and the test over them' },
    { file: 'chunk-m4qpskd4.js', range: [52107, 52160], note: '`Yo` — a name written as itself when it is plain and as JSON otherwise; the relay copy’s same-named helper is a different statement, so this one is copied' },
    { file: 'chunk-m4qpskd4.js', range: [52160, 52204], note: '`ylt` — one `{plugin, key}` reference written the way the scan rule names it' },
    { file: 'chunk-m4qpskd4.js', range: [52373, 52425], note: '`rho` — the sentence a call is refused with when the plugin that owned it was removed' },
    { file: 'chunk-nyce03br.js', range: [159794, 159880], note: '`oRe` — the four clock calls, which are the exemption the unadmitted gate carries' },
    { file: 'chunk-nyce03br.js', range: [160097, 160194], note: '`Hp` and `iIt` — the calls whose refusal is a dropped call rather than a thrown one, and the test over them' },
  ],
};
const path = 'research/ports/W45-call-dispatch-blocks.plan.json';
fs.writeFileSync(path, JSON.stringify(plan, null, 1) + '\n');
console.log(path, plan.blocks.length, 'blocks', plan.blocks.reduce((sum, b) => sum + b.range[1] - b.range[0], 0), 'units', plan.exports.length, 'exports');
