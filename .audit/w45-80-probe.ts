// W45-80 probe: the Markdown leaf `Xt` — its render shapes, its click guard, the delayed press and
// the selection cancel — plus the clock hook `on` and the selection accessor `wC`. Values printed
// here belong in test/plugin-chain-markdown.test.ts.
import '../src/plugin-chain-registry.js';
import { installChainModule, chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { AK, Rto } from '../src/plugin-chain-press.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { eE, Gfe, oi, bindTerminalSelection, type MarkdownClock, type TerminalSelectionInstance } from '../src/plugin-chain-markdown-host.js';
import { Xt, mdn, vje, tun, on, wC } from '../src/plugin-chain-markdown-source.js';

type Held = Record<string, unknown>;
const pressed: Array<{ handle: number; argument: unknown }> = [];
const uninstall = installChainModule({
  name: 'markdown-fixture',
  hooks: () => false,
  record: () => ({ name: 'markdown-fixture', tier: 'core', run: () => undefined }) as never,
  press: (handle, argument) => {
    pressed.push({ handle, argument });
    return { ok: true };
  },
});

console.log('mdn', [...mdn].join(','));
console.log('vje/tun', vje, tun);

try { on(); } catch (error) { console.log('on no provider', (error as Error).message); }

let now = 1000;
const timers: Array<{ fn: () => void; ms: number }> = [];
const cancelled: number[] = [];
const clock: MarkdownClock = {
  now: () => now,
  setTimeout: (fn, ms) => {
    timers.push({ fn, ms });
    return () => cancelled.push(ms);
  },
};
const contexts = new Map<unknown, unknown>([[eE, clock], [Gfe, null]]);
console.log('on with provider', on === on, runComponent(() => on(), { contexts }).result === clock);

const plain = runComponent(() => wC(), { contexts }).result;
console.log('wC no instance', {
  copy: plain.copySelection(), copyNoClear: plain.copySelectionNoClear(), text: plain.getSelectedText(),
  state: plain.getState(), has: plain.hasSelection(), sub: typeof plain.subscribe(() => {}), move: plain.moveFocus(1),
});

let selectionChanges = 0;
let selectionHas = false;
const reader: TerminalSelectionInstance & { change?: () => void } = {
  copySelection: () => 'copied',
  copySelectionNoClear: () => 'copied-no-clear',
  getSelectedText: () => 'text',
  clearTextSelection: () => undefined,
  hasTextSelection: () => selectionHas,
  selection: { anchor: 1 },
  subscribeToSelectionChange: (change) => {
    selectionChanges += 1;
    reader.change = change;
    return () => { selectionChanges -= 1; };
  },
  moveSelectionFocus: () => undefined,
  setSelectionBgColor: () => undefined,
};
const unbindReader = bindTerminalSelection(process.stdout, reader);
const bound = runComponent(() => wC(), { contexts }).result;
console.log('wC bound', bound.copySelection(), bound.getSelectedText(), bound.getState(), bound.hasSelection());
console.log('oi holds', oi().size, oi().get(process.stdout) === reader);
unbindReader();
console.log('oi after unbind', oi().size);

// --- render shapes -------------------------------------------------------------------------
const identity = { component: 'Fixture', requestId: 'md', surface: 'terminal' };
const drawing: Held = {
  type: 'Box',
  props: {},
  children: [{
    type: 'Markdown',
    props: { key: 'm1', text: 'see [here](https://example.com/a)', pressableLinks: ['https://example.com/a'] },
    press: { plugin: 'markdown-fixture', handle: 1 },
  }],
};
const hosted = Rto(drawing, identity);
const hostedMarkdown = ((hosted as Held).children as Held[])[0];
const hostedPress = hostedMarkdown.press as { plugin: string; handle: number };
console.log('hosted press', JSON.stringify(hostedPress));

const runPlain = runComponent(() => Xt({ text: 'plain' }), { contexts });
const rendered = runPlain.result as Held;
console.log('plain element', rendered.type === 'function' ? 'component' : rendered.type, JSON.stringify(rendered.props));

const runKeyed = runComponent(() => Xt({ text: 'plain', dimColor: true, elementKey: 'k1' }), { contexts });
console.log('keyed element', JSON.stringify((runKeyed.result as Held).props));

const rebindReader = bindTerminalSelection(process.stdout, reader);
now = 1900;
const runPress = runComponent(() => Xt({
  text: 'see [here](https://example.com/a)',
  press: hostedPress,
  elementKey: 'm1',
  pressableLinks: ['https://example.com/a'],
}), { contexts });
const pressedElement = runPress.result as Held;
console.log('press element', JSON.stringify({ ...pressedElement.props, onClick: typeof (pressedElement.props as Held).onClick }));

// --- click paths ---------------------------------------------------------------------------
const click = (overrides: Record<string, unknown> = {}) => {
  const calls: string[] = [];
  const event = {
    hyperlinkUrl: 'https://example.com/a',
    mods: {},
    isWindowActivation: false,
    allowDefault: () => calls.push('allowDefault'),
    dropAsStray: () => calls.push('dropAsStray'),
    stopImmediatePropagation: () => calls.push('stopImmediatePropagation'),
    ...overrides,
  };
  return { event, calls };
};
const clickHandler = (element: Held) => (element.props as Held).onClick as (event: unknown) => void;

// reset for each path
pressed.length = 0;
timers.length = 0;
cancelled.length = 0;
now = 2000;

let c = click({ hyperlinkUrl: undefined });
clickHandler(pressedElement)(c.event);
console.log('click no link', c.calls.join(','), 'timers', timers.length);

c = click({ mods: { ctrl: true } });
clickHandler(pressedElement)(c.event);
console.log('click ctrl', c.calls.join(','), 'timers', timers.length);

c = click({ hyperlinkUrl: 'https://other.example/x' });
clickHandler(pressedElement)(c.event);
console.log('click bad link', c.calls.join(','), 'timers', timers.length);

c = click({ isWindowActivation: true });
clickHandler(pressedElement)(c.event);
console.log('click window', c.calls.join(','), 'timers', timers.length);

now = 2100;
c = click();
clickHandler(pressedElement)(c.event);
console.log('click within window', c.calls.join(','), 'timers', timers.length);

now = 2400;
c = click();
clickHandler(pressedElement)(c.event);
console.log('click good', c.calls.join(','), 'timers', timers.length, 'ms', timers.map((t) => t.ms));
console.log('press before timer', pressed.length);
timers[0].fn();
console.log('press after timer', JSON.stringify(pressed.at(-1)));

// selection cancel
pressed.length = 0;
timers.length = 0;
cancelled.length = 0;
selectionChanges = 0;
selectionHas = false;
now = 3000;
c = click();
clickHandler(pressedElement)(c.event);
selectionHas = true;
(reader as unknown as { change?: () => void }).change?.();
console.log('after selection', 'subs', selectionChanges, 'cancelled', cancelled, 'timers', timers.length);
console.log('press after cancel', pressed.length);
rebindReader();

AK.forgetPresses('markdown-fixture');
uninstall();

console.log('Gfe default', JSON.stringify(Gfe.defaultValue), 'eE default', eE.defaultValue);
console.log('chain records', JSON.stringify(chainRecords().slice(-2)));
clearChainRecords();
