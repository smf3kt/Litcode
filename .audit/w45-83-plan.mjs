// W45-83 plan: the hover group — the store accessor `Fe`, the count adjuster `mt`, the member
// handle `_t`, the group key `Bt`/`Dbr`, the override split `ft`, the subscription hook `ut`, the
// color table `Kt`, the override normalizer `De`, the scope context `_e`, the override resolver
// `jt`, and the two components `$t`/`Ut`; plus the store selector hook `Re`.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { qt, Ae, R, P, y, Tc, Rt, s, n } from './plugin-chain-react-hooks.js';",
    "import { it } from './plugin-chain-host.js';",
    "import { PU } from './plugin-chain-hover-host.js';",
    "import { Ckn } from './plugin-chain-decorations-source.js';",
  ],
  exports: ['Fe', 'mt', '_t', 'Bt', 'ft', 'ut', 'Kt', 'De', '_e', 'jt', '$t', 'Ut', 'Re', 'Dbr', 'u4n', 'c'],
  blocks: [
    { file: 'chunk-kjfwbh4w.js', range: [21290, 21318], note: '`Fe` — the hover-group store accessor' },
    { file: 'chunk-kjfwbh4w.js', range: [21318, 21425], note: '`mt` — adjust one key\'s hover count, dropping the key at zero' },
    { file: 'chunk-kjfwbh4w.js', range: [21425, 21619], note: '`_t` — one group member\'s enter/leave/regroup, counting at most one group at a time' },
    { file: 'chunk-kjfwbh4w.js', range: [21619, 21707], note: '`Bt` — the `{plugin, scope}` group key of a site' },
    { file: 'chunk-kjfwbh4w.js', range: [21707, 21751], note: '`ft` — the hover overrides with `scope` removed' },
    { file: 'chunk-kjfwbh4w.js', range: [21755, 22010], note: '`ut` — subscribe to one group key: `isHot` and the enter/leave handlers' },
    { file: 'chunk-kjfwbh4w.js', range: [22014, 22063], note: '`Kt` — the three color props the overrides normalize' },
    { file: 'chunk-kjfwbh4w.js', range: [22063, 22203], note: '`De` — copy the props, mapping named colors to hex' },
    { file: 'chunk-kjfwbh4w.js', range: [22207, 22221], note: '`_e` — the scope-hovered context' },
    { file: 'chunk-kjfwbh4w.js', range: [22221, 22436], note: '`jt` — the overrides and handlers for one site: group hot, or the enclosing scope' },
    { file: 'chunk-kjfwbh4w.js', range: [22436, 22764], note: '`$t` — HoverScope: own hover state, group subscription, provider and layout merge' },
    { file: 'chunk-kjfwbh4w.js', range: [22768, 22928], note: '`Ut` — HoverStyled: a Text or Box carrying the resolved overrides and handlers' },
    { file: 'chunk-5b7mmg84.js', range: [720, 758], note: '`u4n`/`c` — the no-op subscribe and the constant `undefined` source `Re` falls back to' },
    { file: 'chunk-5b7mmg84.js', range: [758, 1288], note: '`Re` — the store selector hook over `getSnapshot`/`subscribe`' },
    { file: 'chunk-p16hdq43.js', range: [2431, 2481], note: '`Dbr` — the `plugin\\0scope\\0scope` store key' },
  ],
};

fs.writeFileSync('research/ports/W45-hover-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
