import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { bindSettingsStore } from '../src/plugin-chain-settings-store.js';
import {
  bindTerminalEnvironmentHost,
  invalidateTerminalEnvironment,
} from '../src/plugin-chain-terminal-environment.js';
import { newJediTermWheelState } from '../src/plugin-chain-wheel-acceleration.js';
import {
  Gfe,
  bindWheelSettingsHost,
  jbBugConfirmed,
  readSetting,
  useWheelState,
  wheelDispatch,
  wheelHandler,
  wheelStateFor,
  type WheelEventLike,
  type WheelSettingsHost,
  type WheelStepResult,
} from '../src/plugin-chain-wheel-glue.js';

function bindHost(overrides: Partial<WheelSettingsHost> = {}): void {
  bindWheelSettingsHost({
    sourceOrder: () => ['userSettings', 'projectSettings', 'localSettings', 'flagSettings', 'policySettings'],
    projectSharesUserSettings: () => false,
    legacyConfig: () => ({}),
    legacyDefaults: () => ({}),
    parseLegacySetting: (_key, value) => value,
    ...overrides,
  });
}

function bindStore(bySource: Record<string, unknown>): void {
  bindSettingsStore({
    all: () => ({}),
    one: (source) => (source !== undefined && source in bySource ? bySource[source] : null),
  });
}

afterEach(() => {
  bindWheelSettingsHost(undefined);
  bindSettingsStore(undefined);
  bindTerminalEnvironmentHost(undefined);
  invalidateTerminalEnvironment();
  clearChainRecords();
});

test('readSetting walks the source order from the end', () => {
  bindHost();
  bindStore({
    userSettings: { key: 'user' },
    localSettings: { key: 'local' },
  });
  assert.deepEqual(readSetting('key', 'fallback'), { value: 'local', source: 'localSettings' });
});

test('readSetting skips project settings that resolve to the user file', () => {
  bindStore({
    userSettings: { key: 'user' },
    projectSettings: { key: 'project' },
  });

  bindHost({ projectSharesUserSettings: () => true });
  assert.deepEqual(readSetting('key', 'fallback'), { value: 'user', source: 'userSettings' });

  bindHost({ projectSharesUserSettings: () => false });
  assert.deepEqual(readSetting('key', 'fallback'), { value: 'project', source: 'projectSettings' });
});

test('readSetting answers the fallback when no source carries the key', () => {
  bindHost();
  bindStore({ userSettings: {} });
  assert.deepEqual(readSetting('missing', true), { value: true, source: 'default' });
});

test('readSetting falls back to the legacy global config for lSe keys', () => {
  bindHost({
    legacyConfig: () => ({ verbose: 2 }),
    legacyDefaults: () => ({ verbose: false }),
  });
  bindStore({});
  assert.deepEqual(readSetting('verbose', 'fallback'), { value: 2, source: 'legacyGlobalConfig' });
});

test('a boolean legacy key answers false when the value does not parse', () => {
  bindHost({
    legacyConfig: () => ({ remoteControlAtStartup: 'yes' }),
    legacyDefaults: () => ({ remoteControlAtStartup: false }),
    parseLegacySetting: (key, value) => (key === 'remoteControlAtStartup' ? undefined : value),
  });
  bindStore({});
  assert.deepEqual(readSetting('remoteControlAtStartup', true), {
    value: false,
    source: 'legacyGlobalConfig',
  });
  assert.ok(chainRecords().some((record) =>
    record.kind === 'log' && record.message.startsWith('Ignoring "remoteControlAtStartup"')));
});

test('a legacy value equal to the default falls through', () => {
  bindHost({
    legacyConfig: () => ({ verbose: false }),
    legacyDefaults: () => ({ verbose: false }),
  });
  bindStore({});
  assert.deepEqual(readSetting('verbose', 'fallback'), { value: 'fallback', source: 'default' });
});

test('readSetting refuses when the settings host is not bound', () => {
  bindWheelSettingsHost(undefined);
  bindStore({});
  assert.throws(() => readSetting('key', 1), /wheel settings host is not bound/);
});

test('mLr latches the JetBrains environment check on the wheel state', () => {
  const keys = ['INTELLIJ_TERMINAL_COMMAND_BLOCKS', 'INTELLIJ_TERMINAL_COMMAND_BLOCKS_REWORKED'] as const;
  const saved = new Map(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  try {
    const state = newJediTermWheelState();
    assert.equal(jbBugConfirmed(state), false);
    assert.equal(state.bugConfirmed, false);

    process.env.INTELLIJ_TERMINAL_COMMAND_BLOCKS_REWORKED = '1';
    assert.equal(jbBugConfirmed(state), true);
    assert.equal(state.bugConfirmed, true);

    delete process.env.INTELLIJ_TERMINAL_COMMAND_BLOCKS_REWORKED;
    assert.equal(jbBugConfirmed(state), true, 'the answer is latched on the state');

    assert.equal(jbBugConfirmed(newJediTermWheelState()), false);
  } finally {
    for (const key of keys) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('wheelStateFor announces the curve and builds the state', () => {
  bindHost();
  bindStore({ userSettings: { wheelScrollAccelerationEnabled: true } });
  invalidateTerminalEnvironment();
  clearChainRecords();

  const input = newJediTermWheelState();
  const state = wheelStateFor(input);
  assert.equal(state.accelEnabled, true);
  assert.equal(state.base, 1);
  assert.equal(state.wheelFlood, false);
  assert.equal(state.useDecayCurve, false);
  assert.equal(state.jediTerm, input);
  const messages = chainRecords().flatMap((record) => (record.kind === 'log' ? [record.message] : []));
  const announcement = messages.find((message) => message.startsWith('wheel accel: '));
  assert.ok(announcement !== undefined);
  assert.ok(announcement.includes('window (native) \xB7 base=1 \xB7 platform=darwin \xB7 TERM_PROGRAM='));
  assert.ok(!announcement.includes('accelDisabled'));

  bindStore({ userSettings: { wheelScrollAccelerationEnabled: false } });
  clearChainRecords();
  const disabled = wheelStateFor(newJediTermWheelState());
  assert.equal(disabled.accelEnabled, false);
  const disabledMessages = chainRecords().flatMap((record) => (record.kind === 'log' ? [record.message] : []));
  assert.ok(disabledMessages.some((message) => message.endsWith('\xB7 accelDisabled')));
});

test('useWheelState keeps one state and rebuilds it when the probe changes', () => {
  bindHost();
  bindStore({ userSettings: { wheelScrollAccelerationEnabled: true } });
  invalidateTerminalEnvironment();

  const jedi = newJediTermWheelState();
  let step: ((direction: number, time: number) => WheelStepResult) | undefined;
  runComponent(() => {
    step = useWheelState();
  }, {
    contexts: new Map([[Gfe, { internal_jediTermInput: jedi }]]),
  });

  const first = step!(1, 1000);
  assert.equal(first.rows, 1);
  assert.equal(first.state.jediTerm, jedi);
  const second = step!(1, 1010);
  assert.equal(second.state, first.state);

  bindTerminalEnvironmentHost({
    terminalState: () => ({ xtversionName: 'xterm.js' }),
    attacherCaps: () => undefined,
    hostKey: () => ({}),
  });
  const third = step!(1, 1020);
  assert.notEqual(third.state, second.state);
  assert.equal(third.state.wheelFlood, true);
  assert.equal(third.state.useDecayCurve, false);
  assert.equal(third.state.base, 1);
});

test('wheelDispatch scrolls by the signed rows and suppresses the event', () => {
  const calls: Array<[number, unknown]> = [];
  const target = { scrollBy: (rows: number, options?: unknown) => { calls.push([rows, options]); } };

  let prevented = 0;
  let stopped = 0;
  const dispatch = wheelDispatch(target, () => 3, (source) => source);
  const negative = {
    deltaY: -1,
    preventDefault: () => { prevented += 1; },
    stopPropagation: () => { stopped += 1; },
  };
  dispatch(negative);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], -3);
  assert.equal(calls[0][1], negative);
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);

  dispatch({ deltaY: 1, preventDefault: () => {}, stopPropagation: () => {} });
  assert.equal(calls[1][0], 3);
});

test('wheelHandler composes the state hook with the dispatch', () => {
  bindHost();
  bindStore({ userSettings: { wheelScrollAccelerationEnabled: true } });
  invalidateTerminalEnvironment();

  const calls: number[] = [];
  const target = { scrollBy: (rows: number) => { calls.push(rows); } };
  let handler: ((event: WheelEventLike) => void) | undefined;
  runComponent(() => {
    handler = wheelHandler(target, (source) => source);
  }, {
    contexts: new Map([[Gfe, { internal_jediTermInput: newJediTermWheelState() }]]),
  });

  let prevented = 0;
  let stopped = 0;
  handler!({
    deltaY: 1,
    preventDefault: () => { prevented += 1; },
    stopPropagation: () => { stopped += 1; },
  });
  assert.equal(calls.length, 1);
  assert.ok(calls[0] >= 1);
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
});
