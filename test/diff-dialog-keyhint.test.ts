import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HintStrip, KeyHint, keyDisplay, SOURCE_BODIES } from '../src/diff-dialog-keyhint.js';
import { SOURCE_BODIES as CHROME } from '../src/diff-dialog-chrome.js';
import {
  Children, earlyReturn, fragment, isValidElement, runComponent, Xe,
} from '../src/plugin-chain-react-hooks.js';
import { u as keybindingContext } from '../src/plugin-chain-press-button-host.js';
import { h9 } from '../src/plugin-chain-keys-editor.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';

interface SurfaceNode {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
  key?: string | null;
}

function service(bindings: { action: string; context: string; chord: ReturnType<typeof h9> }[]) {
  return { bindings };
}

function fallbackEvents() {
  return chainRecords().filter((record) => record.message === 'feature tengu_keybinding_fallback_used');
}

test('a bound action displays its chord, an unbound one its fallback', () => {
  const mounted = service([
    { action: 'diff:dismiss', context: 'DiffDialog', chord: h9('escape') },
    { action: 'diff:nextFile', context: 'DiffDialog', chord: h9('ctrl+up') },
  ]);
  runComponent(() => {
    assert.equal(keyDisplay('diff:dismiss', 'DiffDialog', 'Esc'), 'Esc');
    assert.equal(keyDisplay('diff:nextFile', 'DiffDialog', 'x'), 'ctrl+↑');
    assert.equal(keyDisplay('diff:dismiss', 'Select', 'Esc'), 'Esc');
  }, { contexts: new Map([[keybindingContext, mounted]]) });
});

test('a later binding of the same context and chord shadows the earlier action', () => {
  const mounted = service([
    { action: 'diff:dismiss', context: 'DiffDialog', chord: h9('escape') },
    { action: 'dialog:close', context: 'DiffDialog', chord: h9('escape') },
  ]);
  runComponent(() => {
    assert.equal(keyDisplay('diff:dismiss', 'DiffDialog', 'Esc'), '');
    assert.equal(keyDisplay('dialog:close', 'DiffDialog', 'Esc'), 'Esc');
  }, { contexts: new Map([[keybindingContext, mounted]]) });
});

test('an unbound action falls back and reports the keybinding event once', () => {
  clearChainRecords();
  const mounted = service([]);
  runComponent(() => {
    assert.equal(keyDisplay('missing:action', 'DiffDialog', 'fb'), 'fb');
  }, { contexts: new Map([[keybindingContext, mounted]]) });
  const events = fallbackEvents();
  assert.equal(events.length, 1);
  const event = events[0] as unknown as Record<string, unknown>;
  assert.equal(event.reason, 'action_not_found');
  assert.equal(event.action, 'missing:action');
  assert.equal(event.context, 'DiffDialog');
  assert.equal(event.fallback, 'fb');
});

test('without a service the fallback is used and the no-context reason reported', () => {
  clearChainRecords();
  runComponent(() => {
    assert.equal(keyDisplay('diff:dismiss', 'DiffDialog', 'Esc'), 'Esc');
  });
  const events = fallbackEvents();
  assert.equal(events.length, 1);
  assert.equal((events[0] as unknown as Record<string, unknown>).reason, 'no_context');
});

test('the key hint renders the resolved chord through the chord hint component', () => {
  const mounted = service([
    { action: 'diff:dismiss', context: 'DiffDialog', chord: h9('escape') },
  ]);
  const run = runComponent(
    () => KeyHint({
      action: 'diff:dismiss', context: 'DiffDialog', fallback: 'Esc', description: 'close',
    }),
    { contexts: new Map([[keybindingContext, mounted]]) },
  );
  const element = run.result as unknown as SurfaceNode;
  assert.equal(element.type, CHROME.z);
  assert.deepEqual(element.props, { chord: 'Esc', action: 'close', parens: undefined, bold: undefined });
  run.unmount();
});

test('the hint strip filters empty children and joins the rest with a dim middle dot', () => {
  const first = Xe('Text', { children: 'one' });
  const second = Xe('Text', { children: 'two' });
  const run = runComponent(() => HintStrip({ children: [first, '', second, null] }));
  const root = run.result as unknown as SurfaceNode;
  assert.equal(root.type, fragment);
  assert.equal(root.children.length, 2);
  const [wrapA, wrapB] = root.children as SurfaceNode[];
  assert.equal(wrapA.type, fragment);
  assert.deepEqual(wrapA.children, [first]);
  assert.equal(wrapB.type, fragment);
  assert.equal((wrapB.children[0] as SurfaceNode).type, 'Text');
  assert.deepEqual((wrapB.children[0] as SurfaceNode).props, { dimColor: true, children: ' · ' });
  assert.equal(wrapB.children[1], second);
  run.unmount();
});

test('the hint strip renders nothing when every child is empty', () => {
  const run = runComponent(() => HintStrip({ children: ['', null, false] }));
  assert.equal(run.result, null);
  run.unmount();
});

test('the fragment, sentinel and child helpers are the React values the strip reads', () => {
  assert.equal(fragment, Symbol.for('react.fragment'));
  assert.equal(earlyReturn, Symbol.for('react.early_return_sentinel'));
  assert.deepEqual(Children.toArray(['a', null, false, ['b', 1]]), ['a', 'b', '1']);
  assert.equal(Children.count(['a', '', ['b']]), 3);
  assert.equal(isValidElement(Xe('Text', { children: 'x' })), true);
  assert.equal(isValidElement('x'), false);
  assert.equal(SOURCE_BODIES.Se.length > 0, true);
});
