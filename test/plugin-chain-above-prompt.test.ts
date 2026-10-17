import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COLLAPSE_HANDLE_COLUMNS,
  ROW_SETTLE_DEBOUNCE_MS,
  autofocusIndex,
  cueFullyDrawn,
  hotkeyBindings,
  nodeTopWithin,
  paneKeyBindings,
  paneWindow,
  pluginsOverlap,
  promptContextName,
  scrollKeyHandlers,
  type LaidOutNode,
  type ScrollConfig,
} from '../src/plugin-chain-above-prompt.js';

function node(top: number, height = 1, parentNode?: LaidOutNode): LaidOutNode {
  return { parentNode, yogaNode: { getComputedTop: () => top, getComputedHeight: () => height } };
}

test('the pane window keeps one row for the cue when the tree overflows', () => {
  assert.deepEqual(paneWindow({ budget: 10, settledBudget: 10, treeRows: 15 }), {
    windowRows: 9,
    hasCue: true,
    maxOffset: 6,
    bodyRows: 9,
  });
});

test('the pane window uses the whole budget and settled body when the tree fits', () => {
  assert.deepEqual(paneWindow({ budget: 10, settledBudget: 4, treeRows: 3 }), {
    windowRows: 10,
    hasCue: false,
    maxOffset: 0,
    bodyRows: 3,
  });
});

test('the pane window clamps a negative budget to zero', () => {
  assert.deepEqual(paneWindow({ budget: -5, settledBudget: 0, treeRows: 3 }), {
    windowRows: 0,
    hasCue: true,
    maxOffset: 3,
    bodyRows: 0,
  });
});

test('the autofocus index is null only for an empty list', () => {
  assert.equal(autofocusIndex([]), null);
  assert.equal(autofocusIndex([{}, {}]), 0);
  assert.equal(autofocusIndex([{}, { isAutoFocus: true }, {}]), 1);
});

test('an Input or Select child names the pane key context', () => {
  assert.equal(promptContextName({ tag: 'Input' }, 'AbovePrompt'), 'AbovePromptInput');
  assert.equal(promptContextName({ tag: 'Select' }, 'AbovePrompt'), 'AbovePromptSelect');
  assert.equal(promptContextName({ tag: 'Text' }, 'AbovePrompt'), 'AbovePrompt');
  assert.equal(promptContextName(null, 'AbovePrompt'), 'AbovePrompt');
});

test('the hotkey map takes each Button press and does not walk into Buttons or the engine', () => {
  const press = () => 'send';
  const nested = () => 'nested';
  const omitted = () => 'omitted';
  const engine = () => 'engine';
  const tree = {
    type: 'Box',
    children: [
      { type: 'Button', props: { hotkey: 'ctrl+s' }, press, children: [{ type: 'Button', props: { hotkey: 'ctrl+n' }, press: nested }] },
      { type: 'Button', props: {}, press: omitted },
      { type: 'Box', children: ['text', { type: 'engine', children: [{ type: 'Button', props: { hotkey: 'x' }, press: engine }] }] },
    ],
  };
  const bindings = hotkeyBindings(tree);
  assert.equal(bindings.size, 1);
  assert.equal(bindings.get('ctrl+s'), press);
  assert.equal(hotkeyBindings(undefined).size, 0);
});

test('the node top sums computed tops up to the content root', () => {
  const root = node(10);
  const middle = node(3, 1, root);
  const leaf = node(2, 1, middle);
  assert.equal(nodeTopWithin(leaf, root), 5);
  assert.equal(nodeTopWithin(root, root), 0);
  assert.equal(nodeTopWithin(leaf, node(0)), -1);
});

test('the cue is fully drawn only when every laid-out node fits the window', () => {
  const root = node(0, 20);
  const first = node(0, 2, root);
  const second = node(2, 2, root);
  const input = { hasCue: true, content: root, offset: 0, windowRows: 5 };
  assert.equal(cueFullyDrawn({ ...input, hasCue: false }, undefined), true);
  assert.equal(cueFullyDrawn({ ...input, content: null }, new Set([first])), false);
  assert.equal(cueFullyDrawn(input, new Set()), false);
  assert.equal(cueFullyDrawn(input, new Set([first, second])), true);
  assert.equal(cueFullyDrawn({ ...input, windowRows: 3 }, new Set([first, second])), false);
  assert.equal(cueFullyDrawn(input, new Set([node(0, 0, root)])), false);
});

test('the plugin overlap check is true only when no content plugin is present', () => {
  assert.equal(pluginsOverlap([], [{ plugin: 'a' }]), false);
  assert.equal(pluginsOverlap([{ plugin: 'a' }], []), false);
  assert.equal(pluginsOverlap([{ plugin: 'a' }], [{ plugin: 'a' }]), false);
  assert.equal(pluginsOverlap([{ plugin: 'a' }], [{ plugin: 'b' }]), true);
});

test('the scroll handlers page by body rows and jump by content rows', () => {
  const calls: number[] = [];
  const handlers = scrollKeyHandlers({ bodyRows: 8, contentRows: 20, scrollBy: (rows) => calls.push(rows) });
  handlers['pane:scrollUp']();
  handlers['pane:scrollDown']();
  handlers['pane:pageUp']();
  handlers['pane:pageDown']();
  handlers['pane:top']();
  handlers['pane:bottom']();
  assert.deepEqual(calls, [-1, 1, -8, 8, -20, 20]);
});

test('the pane key merge aliases pane scrolling to AbovePrompt next/previous outside inputs', () => {
  const previous = () => 'previous';
  const next = () => 'next';
  const kept = () => 'kept';
  const config: ScrollConfig = { bodyRows: 8, contentRows: 20, scrollBy: () => 'scrolled' };
  const bindings = { 'abovePrompt:previous': previous, 'abovePrompt:next': next, enter: kept };

  const pane = paneKeyBindings(bindings, config, false);
  assert.equal(pane['pane:scrollUp'], previous);
  assert.equal(pane['pane:scrollDown'], next);
  assert.equal(pane.enter, kept);
  assert.equal((pane['pane:top'] as () => unknown)(), 'scrolled');

  const input = paneKeyBindings(bindings, config, true);
  assert.notEqual(input['pane:scrollUp'], previous);
  assert.equal((input['pane:scrollUp'] as () => unknown)(), 'scrolled');
  assert.equal((input['pane:scrollDown'] as () => unknown)(), 'scrolled');
});

test('the pane constants come from the source table', () => {
  assert.equal(COLLAPSE_HANDLE_COLUMNS, 5);
  assert.equal(ROW_SETTLE_DEBOUNCE_MS, 150);
});
