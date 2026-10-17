// W45-87 plan: the render-version and render-key helpers the terminal glue reads — the `ui.render`
// event name, the hooks matchers, the per-drawing render key, the version reader and its store
// keys, the viewport/props key, the on-screen range, the hooks presence checks, and the two engine
// sentinels the glue draws. Every helper is small; together they are what `hdn`/`xr`/`pr` compute
// before they ask the host renderer for an answer.
import fs from 'node:fs';

const plan = {
  imports: [
    "// The render-key layer is copied verbatim from the extracted bundle; these imports are the",
    "// product seams it reads: the React seam's store hook, the shared source base (the store",
    "// factory, its key builder and the JSON id), the render-version stores the notify fold already",
    "// carries, the hooks-registry query, the loaded-module gate, the registry itself, the matcher",
    "// library, and the one hash helper the memo table uses.",
    "import { createHash as r } from 'node:crypto';",
    "import { qt } from './plugin-chain-react-hooks.js';",
    "import { Ge, bs, er } from './plugin-chain-source.js';",
    "import { OL, jf, Rc, Of } from './plugin-chain-notify-fold-source.js';",
    "import { jDe, kro } from './plugin-chain-records.js';",
    "import { Jl } from './plugin-chain-relay-source.js';",
    "import { it } from './plugin-chain-host.js';",
    "import { b } from './plugin-chain-matchers.js';",
  ],
  exports: [
    'vA', 'rur', 'WPn', 'SVe', 'GPn', 'sur', 'iur',
    'wc', 'kc', 'wH', 'kH', 'xc', 'Rb', 'oIn',
    'Tc', '$H', 'MF', 's_', 'hno', 'yno', 'mIn', 'kVe',
    '$ur', 'Frt', 'LAt', 'j3e', 'Ioe', 'Omt', 'l9', 'blt', 'eA', 'at', 'olt',
  ],
  blocks: [
    { file: 'chunk-n3ykh62m.js', range: [230241, 230260], note: '`vA` — the render event name, `ui.render`' },
    { file: 'chunk-n3ykh62m.js', range: [230295, 230559], note: '`rur`/`WPn`/`SVe` — match a loading module by event and component, the modules that hook the event, and their names' },
    { file: 'chunk-n3ykh62m.js', range: [231248, 231336], note: '`GPn` — the hooks that hook the render event and match one component' },
    { file: 'chunk-n3ykh62m.js', range: [238618, 238917], note: '`sur`/`iur` — whether props hold a position or offset, and whether a drawn value draws anything (a Box/Text/Link, recursively)' },
    { file: 'chunk-n3ykh62m.js', range: [271971, 272059], note: '`wc` — bump one store key' },
    { file: 'chunk-n3ykh62m.js', range: [272105, 272197], note: '`kc`/`wH`/`kH`/`xc` — the live-key suffix and the steady/live key choice' },
    { file: 'chunk-n3ykh62m.js', range: [272964, 272991], note: '`Rb` — whether a store key is a version key' },
    { file: 'chunk-n3ykh62m.js', range: [273333, 273358], note: '`oIn` — the viewport store key, `ui.render viewport`' },
    { file: 'chunk-n3ykh62m.js', range: [273378, 273603], note: '`Tc` — the render version: the event counter and every key’s version, or the whole visible map when the key list is absent' },
    { file: 'chunk-n3ykh62m.js', range: [273714, 273791], note: '`$H` — suffix a drawing key with its version' },
    { file: 'chunk-n3ykh62m.js', range: [273934, 273997], note: '`MF` — the render key: surface, component and request id' },
    { file: 'chunk-n3ykh62m.js', range: [273997, 274025], note: '`s_` — the registry’s plugin state' },
    { file: 'chunk-n3ykh62m.js', range: [284410, 284770], note: '`hno`/`yno`/`mIn`/`kVe` — the memoized JSON id, the props key (viewport columns, fullscreen, props) and the render key with its version' },
    { file: 'chunk-n3ykh62m.js', range: [284974, 285279], note: '`$ur` — the on-screen range a drawing reported, or null' },
    { file: 'chunk-n3ykh62m.js', range: [308406, 308573], note: '`Frt`/`LAt` — whether any loaded module hooks the render event, and whether one hooks it and matches this component' },
    { file: 'chunk-nyce03br.js', range: [2766, 2815], note: '`olt` — the offset prop names (top, left, right, bottom)' },
    { file: 'chunk-nyce03br.js', range: [6172, 6303], note: '`j3e` — the message types a site answers' },
    { file: 'chunk-nyce03br.js', range: [25632, 25662], note: '`Ioe` — the engine sentinel the glue draws when a render failed' },
    { file: 'chunk-t175a0ke.js', range: [961, 976], note: '`Omt` — the static-frame store' },
    { file: 'chunk-tvdq3hrk.js', range: [7979, 8014], note: '`l9` — the viewport store' },
    { file: 'chunk-ed7zyzrn.js', range: [8524, 8564], note: '`blt` — one matcher field check' },
    { file: 'chunk-zf8k2z6n.js', range: [651, 891], note: '`eA`/`at` — the sha256 shape and the sha256 id the props memo uses' },
  ],
};

fs.writeFileSync('research/ports/W45-render-keys-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks', plan.blocks.reduce((sum, b) => sum + b.range[1] - b.range[0], 0), 'units', plan.exports.length, 'exports');
