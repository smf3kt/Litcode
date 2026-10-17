// W45-80: the Markdown leaf (`Xt`) — its render shapes, the click guard, the delayed press and the
// selection cancel — plus the clock hook (`on`) and the selection accessor (`wC`). Expected values
// were measured through the ported bodies (see .audit/w45-80-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../src/plugin-chain-registry.js';
import { installChainModule, clearChainRecords } from '../src/plugin-chain-host.js';
import { AK, Rto } from '../src/plugin-chain-press.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import {
  eE, Gfe, oi, bindTerminalSelection, systemMarkdownClock,
  type MarkdownClock, type TerminalSelectionInstance,
} from '../src/plugin-chain-markdown-host.js';
import { Xt, mdn, vje, tun, on, wC } from '../src/plugin-chain-markdown-source.js';
import { MARKDOWN_LINK_SCHEMES, DOUBLE_ACTIVATION_WINDOW_MS, PRESS_SETTLE_DELAY_MS } from '../src/plugin-chain-markdown.js';

type Held = Record<string, unknown>;

const pressed: Array<{ handle: number; argument: unknown }> = [];
function installFixture(name: string): () => void {
  return installChainModule({
    name,
    hooks: () => false,
    record: () => ({ name, tier: 'core', run: () => undefined }) as never,
    press: (handle, argument) => {
      pressed.push({ handle, argument });
      return { ok: true };
    },
  });
}

const identity = (requestId: string) => ({ component: 'Fixture', requestId, surface: 'terminal' });
const hostedMarkdown = (handle: number, name: string, links: string[]) => {
  const hosted = Rto({
    type: 'Box',
    props: {},
    children: [{
      type: 'Markdown',
      props: { key: 'm1', text: 'text', pressableLinks: links },
      press: { plugin: name, handle },
    }],
  }, identity('md'));
  return ((hosted as Held).children as Held[])[0];
};

function fakeClock(start = 1000) {
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const cancelled: number[] = [];
  let now = start;
  const clock: MarkdownClock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      timers.push({ fn, ms });
      return () => cancelled.push(ms);
    },
  };
  return { clock, timers, cancelled, setNow: (next: number) => { now = next; } };
}

function fakeSelection() {
  let has = false;
  let changes = 0;
  const reader: TerminalSelectionInstance & { change?: () => void } = {
    copySelection: () => 'copied',
    copySelectionNoClear: () => 'copied-no-clear',
    getSelectedText: () => 'text',
    clearTextSelection: () => undefined,
    hasTextSelection: () => has,
    selection: { anchor: 1 },
    subscribeToSelectionChange: (change) => {
      changes += 1;
      reader.change = change;
      return () => { changes -= 1; };
    },
    moveSelectionFocus: () => undefined,
    setSelectionBgColor: () => undefined,
  };
  return {
    reader,
    select: () => { has = true; reader.change?.(); },
    changes: () => changes,
  };
}

const click = (overrides: Record<string, unknown> = {}) => {
  const calls: string[] = [];
  return {
    calls,
    event: {
      hyperlinkUrl: 'https://example.com/a',
      mods: {},
      isWindowActivation: false,
      allowDefault: () => calls.push('allowDefault'),
      dropAsStray: () => calls.push('dropAsStray'),
      stopImmediatePropagation: () => calls.push('stopImmediatePropagation'),
      ...overrides,
    },
  };
};

// The copied component names every field it destructures; a render may omit one, as the source's
// callers do.
const leaf = Xt as unknown as (props: Record<string, unknown>) => unknown;
const renderLeaf = (props: Record<string, unknown>, contexts: Map<unknown, unknown>) =>
  runComponent(() => leaf(props), { contexts }).result as unknown as Held;
const onClickOf = (element: Held) => (element.props as Held).onClick as (event: unknown) => void;

describe('the Markdown leaf constants', () => {
  it('keeps the three link schemes and the two click timings', () => {
    assert.deepEqual([...mdn], ['https', 'http', 'file']);
    assert.equal(vje, 300);
    assert.equal(tun, 500);
    assert.equal(MARKDOWN_LINK_SCHEMES, mdn);
    assert.equal(DOUBLE_ACTIVATION_WINDOW_MS, 300);
    assert.equal(PRESS_SETTLE_DELAY_MS, 500);
  });
});

describe('the clock hook', () => {
  it('throws the source sentence when no provider is mounted', () => {
    assert.throws(() => runComponent(() => on()), {
      message: 'useClock must be used within a ClockProvider',
    });
  });

  it('answers the mounted clock', () => {
    const { clock } = fakeClock();
    const contexts = new Map<unknown, unknown>([[eE, clock]]);
    assert.equal(runComponent(() => on(), { contexts }).result, clock);
  });

  it('offers a system clock with a cancellable timer', async () => {
    let fired = false;
    const cancel = systemMarkdownClock.setTimeout(() => { fired = true; }, 0);
    cancel();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(fired, false);
    assert.equal(typeof systemMarkdownClock.now(), 'number');
  });
});

describe('the selection accessor', () => {
  it('answers the fixed no-selection object when no terminal instance is bound', () => {
    const fallback = runComponent(() => wC()).result;
    assert.equal(fallback.copySelection(), '');
    assert.equal(fallback.copySelectionNoClear(), '');
    assert.equal(fallback.getSelectedText(), '');
    assert.equal(fallback.getState(), null);
    assert.equal(fallback.hasSelection(), false);
    assert.equal(typeof fallback.subscribe(() => {}), 'function');
    assert.equal(fallback.moveFocus(1), undefined);
  });

  it('delegates to the instance bound under the output stream', () => {
    const selection = fakeSelection();
    const unbind = bindTerminalSelection(process.stdout, selection.reader);
    const bound = runComponent(() => wC()).result;
    assert.equal(bound.copySelection(), 'copied');
    assert.equal(bound.copySelectionNoClear(), 'copied-no-clear');
    assert.equal(bound.getSelectedText(), 'text');
    assert.deepEqual(bound.getState(), { anchor: 1 });
    assert.equal(oi().get(process.stdout), selection.reader);
    unbind();
    assert.equal(oi().get(process.stdout), undefined);
  });
});

describe('the Markdown render', () => {
  it('draws the text through the markdown renderer', () => {
    const contexts = new Map<unknown, unknown>([[eE, fakeClock().clock], [Gfe, null]]);
    const element = renderLeaf({ text: 'plain' }, contexts);
    assert.equal(typeof element.type, 'function');
    const props = element.props as Held;
    assert.equal(props.children, 'plain');
    assert.equal(props.stripPromptTags, false);
    assert.equal(props.linkSchemes, mdn);
  });

  it('wraps a keyed drawing in a column Box', () => {
    const contexts = new Map<unknown, unknown>([[eE, fakeClock().clock]]);
    const element = renderLeaf({ text: 'plain', dimColor: true, elementKey: 'k1' }, contexts);
    assert.equal(element.type, 'Box');
    assert.deepEqual(element.props, { flexDirection: 'column', elementKey: 'k1' });
  });

  it('adds the plugin and the click when the drawing holds a press', () => {
    const name = 'md-render';
    const uninstall = installFixture(name);
    const selection = fakeSelection();
    const unbind = bindTerminalSelection(process.stdout, selection.reader);
    const held = hostedMarkdown(1, name, ['https://example.com/a']);
    const element = renderLeaf({
      text: 'text', press: held.press, elementKey: 'm1', pressableLinks: ['https://example.com/a'],
    }, new Map<unknown, unknown>([[eE, fakeClock().clock]]));
    const props = element.props as Held;
    assert.equal(props.flexDirection, 'column');
    assert.equal(props.elementKey, 'm1');
    assert.equal(props.elementPlugin, name);
    assert.equal(typeof props.onClick, 'function');
    unbind();
    AK.forgetPresses(name);
    uninstall();
  });
});

describe('the click guard', () => {
  it('leaves a click with no link, with ctrl or alt, or with an undeclared link to the terminal', () => {
    const name = 'md-guard';
    const uninstall = installFixture(name);
    const { clock, timers } = fakeClock(1000);
    const contexts = new Map<unknown, unknown>([[eE, clock]]);
    const held = hostedMarkdown(2, name, ['https://example.com/a']);
    const element = renderLeaf({
      text: 'text', press: held.press, elementKey: 'm1', pressableLinks: ['https://example.com/a'],
    }, contexts);
    const handle = onClickOf(element);
    for (const event of [
      click({ hyperlinkUrl: undefined }),
      click({ mods: { ctrl: true } }),
      click({ mods: { alt: true } }),
      click({ hyperlinkUrl: 'https://other.example/x' }),
    ]) {
      handle(event.event);
      assert.deepEqual(event.calls, ['allowDefault']);
    }
    assert.deepEqual(timers, []);
    AK.forgetPresses(name);
    uninstall();
  });

  it('drops a window activation and a click inside the double-activation window', () => {
    const name = 'md-window';
    const uninstall = installFixture(name);
    const { clock, timers, setNow } = fakeClock(1000);
    const held = hostedMarkdown(3, name, ['https://example.com/a']);
    const element = renderLeaf({
      text: 'text', press: held.press, elementKey: 'm1', pressableLinks: ['https://example.com/a'],
    }, new Map<unknown, unknown>([[eE, clock]]));
    const handle = onClickOf(element);
    const activation = click({ isWindowActivation: true });
    handle(activation.event);
    assert.deepEqual(activation.calls, ['dropAsStray']);
    setNow(1100);
    const early = click();
    handle(early.event);
    assert.deepEqual(early.calls, ['dropAsStray']);
    assert.deepEqual(timers, []);
    AK.forgetPresses(name);
    uninstall();
  });

  it('stops the terminal and presses after the settle delay', () => {
    const name = 'md-press';
    const uninstall = installFixture(name);
    const selection = fakeSelection();
    const unbind = bindTerminalSelection(process.stdout, selection.reader);
    const { clock, timers, setNow } = fakeClock(1000);
    const held = hostedMarkdown(4, name, ['https://example.com/a', '/tmp/a b']);
    const element = renderLeaf({
      text: 'text', press: held.press, elementKey: 'm1', pressableLinks: ['https://example.com/a', '/tmp/a b'],
    }, new Map<unknown, unknown>([[eE, clock]]));
    pressed.length = 0;
    setNow(1400);
    const good = click();
    onClickOf(element)(good.event);
    assert.deepEqual(good.calls, ['stopImmediatePropagation']);
    assert.deepEqual(timers.map((timer) => timer.ms), [500]);
    assert.deepEqual(pressed, []);
    timers[0].fn();
    assert.deepEqual(pressed.at(-1), {
      handle: 4,
      argument: {
        plugin: name, element: 'm1', component: 'Fixture', requestId: 'md', surface: 'terminal',
        link: { href: 'https://example.com/a' },
      },
    });
    assert.equal(selection.changes(), 0);
    unbind();
    AK.forgetPresses(name);
    uninstall();
  });

  it('cancels the pending press when a selection appears', () => {
    const name = 'md-select';
    const uninstall = installFixture(name);
    const selection = fakeSelection();
    const unbind = bindTerminalSelection(process.stdout, selection.reader);
    const { clock, timers, cancelled, setNow } = fakeClock(1000);
    const held = hostedMarkdown(5, name, ['https://example.com/a']);
    const element = renderLeaf({
      text: 'text', press: held.press, elementKey: 'm1', pressableLinks: ['https://example.com/a'],
    }, new Map<unknown, unknown>([[eE, clock]]));
    pressed.length = 0;
    setNow(1400);
    onClickOf(element)(click().event);
    assert.equal(selection.changes(), 1);
    selection.select();
    assert.equal(selection.changes(), 0);
    assert.deepEqual(cancelled, [500]);
    assert.equal(timers.length, 1);
    assert.deepEqual(pressed, []);
    unbind();
    AK.forgetPresses(name);
    uninstall();
  });

  it('cancels the previous pending press when the leaf is clicked again', () => {
    const name = 'md-reclick';
    const uninstall = installFixture(name);
    const selection = fakeSelection();
    const unbind = bindTerminalSelection(process.stdout, selection.reader);
    const { clock, timers, cancelled, setNow } = fakeClock(1000);
    const held = hostedMarkdown(6, name, ['https://example.com/a']);
    const element = renderLeaf({
      text: 'text', press: held.press, elementKey: 'm1', pressableLinks: ['https://example.com/a'],
    }, new Map<unknown, unknown>([[eE, clock]]));
    pressed.length = 0;
    setNow(1400);
    onClickOf(element)(click().event);
    onClickOf(element)(click().event);
    assert.deepEqual(cancelled, [500]);
    assert.deepEqual(timers.map((timer) => timer.ms), [500, 500]);
    assert.deepEqual(pressed, []);
    timers[1].fn();
    assert.deepEqual(pressed.at(-1), {
      handle: 6,
      argument: {
        plugin: name, element: 'm1', component: 'Fixture', requestId: 'md', surface: 'terminal',
        link: { href: 'https://example.com/a' },
      },
    });
    unbind();
    AK.forgetPresses(name);
    uninstall();
    clearChainRecords();
  });
});
