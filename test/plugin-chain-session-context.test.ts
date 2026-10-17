import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HostProjectProvider,
  SessionProvider,
  hostContext,
  noopUnsubscribe,
  projectContext,
  sessionContext,
  useHost,
  useProject,
  useSession,
  useSessionContext,
  useStore,
  type SessionLike,
} from '../src/plugin-chain-session-context.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';

function session(overrides: Partial<SessionLike> = {}): SessionLike {
  return {
    project: { root: 'root-1', cwd: '/work' },
    host: { name: 'host' },
    root: 'root-1',
    subscribe: () => () => {},
    ...overrides,
  };
}

test('SessionProvider nests session, host and project providers with the session snapshot', () => {
  const live = session();
  const run = runComponent(() => SessionProvider({ session: live, children: 'body' }));
  const root = run.result as {
    type: unknown;
    props: { value: unknown; children: unknown };
    children: unknown[];
  };
  assert.equal(root.type, sessionContext);
  assert.equal(root.props.value, live);
  const host = root.children[0] as { type: unknown; props: { value: unknown }; children: unknown[] };
  assert.equal(host.type, hostContext);
  assert.equal(host.props.value, live.host);
  const project = host.children[0] as {
    type: unknown;
    props: { value: { subscribe: unknown; get(): unknown } };
    children: unknown[];
  };
  assert.equal(project.type, projectContext);
  assert.equal(typeof project.props.value.subscribe, 'function');
  assert.deepEqual(project.props.value.get(), live.project);
  assert.deepEqual(project.children, ['body']);
});

test('HostProjectProvider supplies host and project without a session context', () => {
  const project = { root: 'root-2' };
  const run = runComponent(() =>
    HostProjectProvider({ host: { name: 'h' }, project, children: 'body' }));
  const root = run.result as {
    type: unknown;
    props: { value: unknown };
    children: unknown[];
  };
  assert.equal(root.type, hostContext);
  assert.deepEqual(root.props.value, { name: 'h' });
  const inner = root.children[0] as {
    type: unknown;
    props: { value: { subscribe: unknown; get(): unknown } };
    children: unknown[];
  };
  assert.equal(inner.type, projectContext);
  assert.equal(inner.props.value.subscribe, noopUnsubscribe);
  assert.deepEqual(inner.props.value.get(), project);
});

test('useSession reads the session and applies a selector', () => {
  const live = session();
  let read: unknown;
  let selected: unknown;
  runComponent(() => {
    read = useSession();
    selected = useSession((value: any) => value.project.root);
  }, { contexts: new Map([[sessionContext, live]]) });
  assert.equal(read, live);
  assert.equal(selected, 'root-1');
});

test('useSession refuses to run outside a provider and the project snapshot rejects a null project', () => {
  assert.throws(() => runComponent(() => useSession()), /useSession cannot be called outside/);
  const run = runComponent(() => SessionProvider({ session: session({ project: null }), children: 'body' }));
  const root = run.result as { children: Array<{ children: Array<{ props: { value: { get(): unknown } } }> }> };
  const project = root.children[0].children[0];
  let thrown: unknown;
  try {
    project.props.value.get();
  } catch (error) {
    thrown = error;
  }
  assert.equal((thrown as { name?: string }).name, 'NoProjectDirectoryError');
  assert.match((thrown as Error).message, /no working directory/);
});

test('useHost requires a provider and useSessionContext answers undefined outside one', () => {
  let host: unknown;
  runComponent(() => {
    host = useHost();
  }, { contexts: new Map([[hostContext, { name: 'h' }]]) });
  assert.deepEqual(host, { name: 'h' });
  assert.throws(() => runComponent(() => useHost()), /useHost cannot be called outside/);

  let raw: unknown = 'unset';
  runComponent(() => {
    raw = useSessionContext();
  });
  assert.equal(raw, undefined);
});

test('useProject selects from the project snapshot store', () => {
  const snapshot = {
    subscribe: noopUnsubscribe,
    get: () => ({ root: 'root-3', cwd: '/elsewhere' }),
  };
  let root: unknown;
  runComponent(() => {
    root = useProject((project: any) => project.root);
  }, { contexts: new Map([[projectContext, snapshot]]) });
  assert.equal(root, 'root-3');
});

test('useStore subscribes once and reads through an optional selector', () => {
  const listeners = new Set<() => void>();
  let state = { count: 1 };
  let subscribed = 0;
  let value: unknown;
  const run = runComponent(() => {
    value = useStore(
      state,
      (onChange) => {
        subscribed += 1;
        listeners.add(onChange);
        return () => listeners.delete(onChange);
      },
      () => state,
      (next: any) => next.count + 1,
    );
    return undefined;
  });
  assert.equal(subscribed, 1);
  assert.equal(value, 2);
  state = { count: 9 };
  for (const listener of listeners) listener();
  run.unmount();
  assert.equal(listeners.size, 0);
});
