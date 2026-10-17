import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  focusableAt,
  isFieldOwnKey,
  isFieldText,
  isTypedText,
  optionText,
  selectFromTerminal,
  selectKeyHandlers,
  useControlledState,
  useInputFields,
  useKeysAheadOfRender,
  useSelectFields,
  type KeybindingServiceLike,
  type KeysAheadInput,
  type SelectFieldsInput,
} from '../src/plugin-chain-above-prompt-select-keys.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { u as keybindingContext } from '../src/plugin-chain-press-button-host.js';
import type { FocusableSeat } from '../src/plugin-chain-above-prompt-seats.js';

test('isTypedText takes one printable run and rejects modifiers, empty and spaces', () => {
  assert.equal(isTypedText('a', {}), true);
  assert.equal(isTypedText('ab', {}), true);
  assert.equal(isTypedText('a', { ctrl: true }), false);
  assert.equal(isTypedText('a', { meta: true }), false);
  assert.equal(isTypedText('a', { escape: true }), false);
  assert.equal(isTypedText('', {}), false);
  assert.equal(isTypedText(' ', {}), false);
  assert.equal(isTypedText('\u0001', {}), false);
});

test('isFieldOwnKey claims movement, delete and named chords', () => {
  assert.equal(isFieldOwnKey('', { leftArrow: true }), true);
  assert.equal(isFieldOwnKey('', { pageDown: true }), true);
  assert.equal(isFieldOwnKey('', { delete: true }), true);
  assert.equal(isFieldOwnKey('a', { ctrl: true }), true);
  assert.equal(isFieldOwnKey('z', { ctrl: true }), undefined);
  assert.equal(isFieldOwnKey('b', { meta: true }), true);
  assert.equal(isFieldOwnKey('a', { meta: true }), false);
  assert.equal(isFieldOwnKey('x', {}), undefined);
  assert.equal(isFieldOwnKey('a', { ctrl: true, shift: true }), true);
});

test('isFieldText takes plain text but not controls or modified keys', () => {
  assert.equal(isFieldText('a', {}), true);
  assert.equal(isFieldText(' ', {}), true);
  assert.equal(isFieldText('', {}), false);
  assert.equal(isFieldText('a', { ctrl: true }), false);
  assert.equal(isFieldText('a', { tab: true }), false);
  assert.equal(isFieldText('\u0007', {}), false);
  assert.equal(isFieldText('\ud800', {}), false);
});

test('optionText prefers a label and falls back to the value', () => {
  assert.equal(optionText({ label: 'Shown', value: 'v' }), 'Shown');
  assert.equal(optionText({ value: 'v' }), 'v');
});

test('the select key handlers move the highlight and press', () => {
  const calls: string[] = [];
  const handlers = selectKeyHandlers({
    move: (delta) => { calls.push(`move:${delta}`); },
    press: () => { calls.push('press'); },
  });
  handlers['abovePrompt:highlightNext']();
  handlers['abovePrompt:highlightPrevious']();
  handlers['abovePrompt:press']();
  assert.deepEqual(calls, ['move:1', 'move:-1', 'press']);
});

test('focusableAt returns null for a null index or a miss and the seat for a hit', () => {
  const seats = [{ tag: 'Select', plugin: 'p', element: 'e' }];
  assert.equal(focusableAt(seats, null), null);
  assert.equal(focusableAt(seats, 0), seats[0]);
  assert.equal(focusableAt(seats, 1), null);
});

test('the controlled state seeds once, updates by value and by updater, and reads back', () => {
  let state: [number, (next: number | ((previous: number) => number)) => void, () => number]
    | undefined;
  runComponent(() => {
    state = useControlledState(() => 42);
  });
  assert.notEqual(state, undefined);
  assert.equal(state![0], 42);
  assert.equal(state![2](), 42);
  state![1](43);
  assert.equal(state![2](), 43);
  state![1]((previous) => previous + 1);
  assert.equal(state![2](), 44);
});

test('the input fields read, edit and submit through the field store', async () => {
  let fields: ReturnType<typeof useInputFields> | undefined;
  runComponent(() => {
    fields = useInputFields([], 'Comp', 'req');
  });
  assert.notEqual(fields, undefined);
  assert.equal(fields!.fields.textOf('p', 'h'), undefined);
  assert.equal(fields!.textNow({ plugin: 'p', element: 'e' }), '');
  assert.equal(fields!.textNow({ plugin: 'p', element: 'e', value: 'fallback' }), 'fallback');

  fields!.fields.edit({ plugin: 'p', handle: 'h', element: 'e' }, 'hi');
  assert.equal(fields!.textNow({ plugin: 'p', element: 'e' }), 'hi');

  fields!.submit({ plugin: 'p', handle: 'h', element: 'e' });
  fields!.submit({ plugin: 'p', handle: 'h', element: 'e' });
  await Promise.resolve();
});

test('the select fields stay closed without a focused select', () => {
  const focusUpdates: Array<() => number | null> = [];
  let select: ReturnType<typeof useSelectFields> | undefined;
  const input: SelectFieldsInput = {
    focusables: [],
    focusIndex: null,
    focusIndexNow: () => null,
    setFocusIndex: (update) => { focusUpdates.push(update); },
    working: false,
    component: 'Comp',
    requestId: 'req',
  };
  runComponent(() => {
    select = useSelectFields(input);
  });
  assert.notEqual(select, undefined);
  assert.equal(select!.fields.open, null);
  assert.equal(select!.fields.pickedOf('p', 'e'), undefined);
  assert.equal(select!.intercept('a', {}), false);
  assert.equal(select!.intercept('c', { ctrl: true }), false);
  assert.deepEqual(focusUpdates, []);
  select!.handlers['abovePrompt:highlightNext']();
  select!.handlers['abovePrompt:press']();
});

test('the select fields close an open select on Ctrl+C', () => {
  const seat: FocusableSeat = {
    tag: 'Select',
    plugin: 'p',
    element: 'e',
    handle: 'h',
    value: 'x',
    options: [{ value: 'x' }, { value: 'y' }],
  };
  const focusUpdates: Array<() => number | null> = [];
  let select: ReturnType<typeof useSelectFields> | undefined;
  runComponent(() => {
    select = useSelectFields({
      focusables: [seat],
      focusIndex: 0,
      focusIndexNow: () => 0,
      setFocusIndex: (update) => { focusUpdates.push(update); },
      working: false,
      component: 'Comp',
      requestId: 'req',
    });
  });
  assert.notEqual(select, undefined);
  assert.equal(select!.fields.open?.plugin, 'p');
  assert.equal(select!.fields.open?.handle, 'h');
  assert.equal(select!.intercept('c', { ctrl: true }), true);
});

test('keys ahead of the render run a matching binding and skip wheels and stale keys', () => {
  let registered: ((key: string, mods: Record<string, unknown>, context: string) => boolean | void)
    | undefined;
  const service: KeybindingServiceLike = {
    resolve: (key, mods, contexts) => {
      if (key === 'x' && mods.ctrl !== true && contexts.includes('prompt')) {
        return { type: 'match', action: 'go' };
      }
      return { type: 'no-match' };
    },
    registerPreDispatch: (entry) => {
      registered = entry.handler;
      return () => { registered = undefined; };
    },
  };
  const calls: string[] = [];
  const input: KeysAheadInput = {
    contextNow: () => 'prompt',
    isAhead: () => true,
    handlers: { prompt: { go: () => { calls.push('go'); } } },
    focusedNow: () => null,
    selectKeys: () => false,
    inputs: {
      fields: { textOf: () => undefined, edit: () => {} },
      textNow: () => '',
      submit: () => {},
    },
    contextRendered: () => null,
    focusedRendered: () => null,
  };
  runComponent(() => { useKeysAheadOfRender(input); }, {
    contexts: new Map([[keybindingContext, service]]),
  });
  assert.notEqual(registered, undefined);
  assert.equal(registered!('x', {}, 'prompt'), true);
  assert.deepEqual(calls, ['go']);
  assert.equal(registered!('x', { wheelUp: true }, 'prompt'), false);
  assert.equal(registered!('x', { ctrl: true }, 'prompt'), false);
});

test('selectFromTerminal settles for a plugin that holds no select element', async () => {
  const settled = selectFromTerminal({ plugin: 'missing', handle: 'h', element: 'e' });
  assert.equal(typeof settled.then, 'function');
  assert.equal(await settled, undefined);
});
