import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { AbovePrompt } from '../src/plugin-chain-above-prompt-component.js';
import { settledBudgetStore } from '../src/plugin-chain-above-prompt-local.js';
import { paneMeasureContext } from '../src/plugin-chain-above-prompt-host-glue.js';
import { appStateContext } from '../src/plugin-chain-app-state.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import { eE } from '../src/plugin-chain-markdown-host.js';
import { aq } from '../src/plugin-chain-press-button-source.js';
import { u as keybindingContext } from '../src/plugin-chain-press-button-host.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { sessionContext, type SessionLike } from '../src/plugin-chain-session-context.js';
import { TFe } from '../src/plugin-chain-above-prompt-parts-source.js';
import { Y4t } from '../src/plugin-chain-notify-fold-source.js';

interface Registration {
  action: string;
  context: string;
  handler: () => boolean;
}

interface FakeService {
  registrations: Registration[];
  unbinds: number;
  preDispatch: number;
}

function fakeService(): FakeService {
  const registrations: Registration[] = [];
  const service = {
    registrations,
    unbinds: 0,
    preDispatch: 0,
    registerHandler(options: { action: string; context: string; handler: () => boolean }) {
      registrations.push(options);
      return () => {
        service.unbinds += 1;
      };
    },
    registerPreDispatch() {
      service.preDispatch += 1;
      return () => {
        service.unbinds += 1;
      };
    },
    getDisplayText() {
      return '';
    },
  };
  return service;
}

interface Harness {
  contexts: Map<unknown, unknown>;
  service: FakeService;
}

function harness(options: {
  measure?: () => number | null;
  rows?: number;
  columns?: number;
  service?: boolean;
} = {}): Harness {
  const root = {};
  const session = {
    project: { root },
    host: {},
    root,
    subscribe: () => () => {},
  } as unknown as SessionLike;
  const service = fakeService();
  const entries: [unknown, unknown][] = [
    [paneMeasureContext, options.measure ?? (() => null)],
    [Zm, { rows: options.rows ?? 24, columns: options.columns ?? 80 }],
    [appStateContext, {
      getSnapshot: () => ({ viewingAgentTaskId: undefined, tasks: {} }),
      subscribe: () => () => {},
    }],
    [sessionContext, session],
    [aq, { getState: () => ({ open: [] }), subscribe: () => () => {} }],
    [eE, { now: () => Date.now(), setTimeout: () => () => {} }],
  ];
  if (options.service !== false) entries.push([keybindingContext, service]);
  const contexts = new Map<unknown, unknown>(entries);
  return { contexts, service };
}

function path(element: unknown, indexes: number[]): any {
  let node: any = element;
  for (const index of indexes) node = node.children[index];
  return node;
}

afterEach(() => {
  settledBudgetStore.set(undefined);
  Y4t.set(false);
});

test('the component renders the provider chain with no focus and a full window', () => {
  const holds: boolean[] = [];
  const { contexts } = harness();
  const run = runComponent(() => AbovePrompt({
    survey: false,
    working: false,
    setInputValue: () => {},
    onHoldsBandChange: (value) => holds.push(value),
  }), { contexts });

  assert.equal((run.result as any).props.value, null);
  assert.equal(typeof path(run.result, [0]).props.value, 'function');
  assert.equal(typeof path(run.result, [0, 0]).props.value, 'function');
  assert.equal(typeof path(run.result, [0, 0, 0]).props.value.edit, 'function');
  assert.equal(typeof path(run.result, [0, 0, 0]).props.value.textOf, 'function');
  assert.equal(path(run.result, [0, 0, 0, 0]).props.value.open, null);
  assert.equal(typeof path(run.result, [0, 0, 0, 0]).props.value.pickedOf, 'function');
  assert.equal(typeof path(run.result, [0, 0, 0, 0, 0]).props.value, 'function');

  const outer = path(run.result, [0, 0, 0, 0, 0, 0]);
  const inner = outer.children[0];
  assert.equal(outer.type, 'Box');
  assert.equal(inner.type, 'Box');
  assert.equal(outer.props.maxHeight, 24);
  assert.equal(inner.props.maxHeight, 24);
  assert.equal(inner.props.onWheel, undefined);

  const content = inner.children[0];
  assert.equal(content.type, TFe);
  assert.equal(content.props.columns, 75);
  assert.equal(content.props.keptColumns, 5);
  assert.equal(content.props.offset, 0);
  assert.equal(content.props.content.current, null);

  assert.deepEqual(holds, [false]);
  run.unmount();
  assert.deepEqual(holds, [false, false]);
});

test('the pane measurement bounds the window budget', () => {
  const { contexts } = harness({ measure: () => 10 });
  const run = runComponent(() => AbovePrompt({
    survey: false,
    working: false,
    setInputValue: () => {},
  }), { contexts });

  const outer = path(run.result, [0, 0, 0, 0, 0, 0]);
  const inner = outer.children[0];
  assert.equal(outer.props.maxHeight, 10);
  assert.equal(inner.props.maxHeight, 10);
  assert.equal(inner.children[0].props.offset, 0);
  run.unmount();
});

test('a measurement larger than the pane is clamped to the terminal rows', () => {
  const { contexts } = harness({ measure: () => 30, rows: 24 });
  const run = runComponent(() => AbovePrompt({
    survey: false,
    working: false,
    setInputValue: () => {},
  }), { contexts });

  const outer = path(run.result, [0, 0, 0, 0, 0, 0]);
  assert.equal(outer.props.maxHeight, 24);
  assert.equal(outer.children[0].props.maxHeight, 24);
  run.unmount();
});

test('the settled budget store stands in for an absent measurement', () => {
  settledBudgetStore.set(5);
  const { contexts } = harness({ measure: () => null });
  const run = runComponent(() => AbovePrompt({
    survey: false,
    working: false,
    setInputValue: () => {},
  }), { contexts });

  const outer = path(run.result, [0, 0, 0, 0, 0, 0]);
  assert.equal(outer.props.maxHeight, 5);
  assert.equal(outer.children[0].props.maxHeight, 5);
  run.unmount();
});

test('the Chat actions register and answer false without drawn content', () => {
  const { contexts, service } = harness();
  const run = runComponent(() => AbovePrompt({
    survey: false,
    working: false,
    setInputValue: () => {},
  }), { contexts });

  const actions = service.registrations.map((entry) => `${entry.context}:${entry.action}`);
  assert.deepEqual(actions, ['Chat:abovePrompt:toggle', 'Chat:abovePrompt:focus']);
  assert.equal(service.preDispatch, 1);

  const toggle = service.registrations.find((entry) => entry.action === 'abovePrompt:toggle')!;
  assert.equal(toggle.handler(), false);
  assert.equal(Y4t.get(), false);

  const focus = service.registrations.find((entry) => entry.action === 'abovePrompt:focus')!;
  assert.equal(focus.handler(), false);

  run.unmount();
  assert.equal(service.unbinds, 3);
});

test('the component renders with survey and working set and without a keybinding service', () => {
  const { contexts } = harness({ service: false });
  const run = runComponent(() => AbovePrompt({
    survey: true,
    working: true,
    setInputValue: () => {},
  }), { contexts });

  const outer = path(run.result, [0, 0, 0, 0, 0, 0]);
  assert.equal(outer.props.maxHeight, 24);
  run.unmount();
});
