// W45-84 plan: the Button `Zt` with the action-key seat `Qt`/`Jt`, the action-key store `Yt` and
// its helpers, the focus blur `_3n`, the alignment map `yo`, the click subscriber `wFt` and the key
// normalization `go`/`ko`; plus the keybinding context `Lc`, the dialog store `aq`/`Ff`/`iv`/`kj`,
// the default app context `Pg` and the identity `Ge`.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { qt, Ae, R, Rt, P, Z, y, en, Tc, s, n } from './plugin-chain-react-hooks.js';",
    "import { D } from './plugin-chain-source.js';",
    "import { TIe } from './plugin-chain-press-dispatch-source.js';",
    "import { xe } from './plugin-chain-select-field-source.js';",
    "import { jt, Bt } from './plugin-chain-hover-source.js';",
    "import { u, ix, KH } from './plugin-chain-press-button-host.js';",
  ],
  exports: ['co', 'xo', 'Yt', 'Ds', '_s', 'ee', 'Qt', 'Jt', 'y3n', '_3n', 'Zt', 'yo', 'wFt', 'go', 'ko', 'Ge', 'Lc', 'aq', 'Ff', 'iv', 'kj', 'Pg', 'Zy'],
  blocks: [
    { file: 'chunk-kjfwbh4w.js', range: [25258, 25316], note: '`co` — the action-key rank/sequence comparator' },
    { file: 'chunk-kjfwbh4w.js', range: [25316, 25578], note: '`xo` — the action-key store: add/remove/winnerOf/held/clear' },
    { file: 'chunk-kjfwbh4w.js', range: [25578, 25609], note: '`Yt` — the store the seats register in' },
    { file: 'chunk-kjfwbh4w.js', range: [25609, 25674], note: '`Ds` — the binding contexts an action is bound in' },
    { file: 'chunk-kjfwbh4w.js', range: [25674, 25721], note: '`_s` — the component rank: Pane 2, AbovePrompt 1, else 0' },
    { file: 'chunk-kjfwbh4w.js', range: [25725, 25741], note: '`ee` — the render-instance context' },
    { file: 'chunk-kjfwbh4w.js', range: [25741, 26268], note: '`Qt` — the action-key seat: register one handler per bound context, dispatching the winning held press' },
    { file: 'chunk-kjfwbh4w.js', range: [26268, 26301], note: '`Jt` — the seat as a childless component' },
    { file: 'chunk-kjfwbh4w.js', range: [26305, 26322], note: '`y3n` — the hotkey seat context' },
    { file: 'chunk-kjfwbh4w.js', range: [26322, 26437], note: '`_3n` — blur the focused descendant of a pressed button' },
    { file: 'chunk-kjfwbh4w.js', range: [26437, 27368], note: '`Zt` — the Button: click box, action-key seat, focusable action box and the label/hotkey/held render prop' },
    { file: 'chunk-kjfwbh4w.js', range: [27380, 27488], note: '`yo` — the alignment name of a position' },
    { file: 'chunk-kjfwbh4w.js', range: [27496, 27679], note: '`wFt` — the click subscriber: fire unless the press landed inside the ref or was a window activation' },
    { file: 'chunk-kjfwbh4w.js', range: [27679, 27924], note: '`go` — the named-key table' },
    { file: 'chunk-kjfwbh4w.js', range: [27924, 28121], note: '`ko` — one key event as a `{key, ctrl, shift, meta}` binding, ignoring wheel events' },
    { file: 'chunk-ae84tp6z.js', range: [5355, 5381], note: '`Ge` — the identity wrapper around the action-key store' },
    { file: 'chunk-bwyexfny.js', range: [3552, 3579], note: '`Lc` — the keybinding service from its context' },
    { file: 'chunk-06azbynj.js', range: [224520, 224782], note: '`Pg` — the default app context: the no-op click/layout/frame subscriptions the click subscriber falls back to' },
    { file: 'chunk-06azbynj.js', range: [224818, 224828], note: '`Zy` — the alias the click subscriber reads the app context as' },
    { file: 'chunk-8zgs1qmk.js', range: [3768, 3784], note: '`aq` — the dialog-store context' },
    { file: 'chunk-8zgs1qmk.js', range: [3784, 3957], note: '`Ff` — the dialog store, throwing the source message outside a provider' },
    { file: 'chunk-8zgs1qmk.js', range: [911, 976], note: '`iv` — the last open non-user dialog' },
    { file: 'chunk-8zgs1qmk.js', range: [4043, 4125], note: '`kj` — whether a dialog is open (the action-key registration gate)' },
  ],
};

fs.writeFileSync('research/ports/W45-button-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
