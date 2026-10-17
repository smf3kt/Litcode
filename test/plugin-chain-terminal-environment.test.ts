import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bindTerminalEnvironmentHost,
  invalidateTerminalEnvironment,
  terminalEnvironment,
  type AttacherCaps,
  type TerminalEnvironmentHost,
  type TerminalStateView,
} from '../src/plugin-chain-terminal-environment.js';

const ENV_KEYS = [
  'TERM_PROGRAM',
  'TERM_PROGRAM_VERSION',
  'CURSOR_TRACE_ID',
  'VSCODE_GIT_ASKPASS_MAIN',
  'WT_SESSION',
  'TERMINAL_EMULATOR',
  'CLAUDE_CODE_SCROLL_SPEED',
  'CLAUDE_CODE_SESSION_KIND',
] as const;

function bindHost(
  state: TerminalStateView,
  caps?: AttacherCaps,
  key: object = {},
): TerminalEnvironmentHost {
  const host: TerminalEnvironmentHost = {
    terminalState: () => state,
    attacherCaps: () => caps,
    hostKey: () => key,
  };
  bindTerminalEnvironmentHost(host);
  return host;
}

function withEnv<T>(vars: Record<string, string>, run: () => T): T {
  const saved = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(vars)) process.env[key] = value;
  invalidateTerminalEnvironment();
  try {
    return run();
  } finally {
    bindTerminalEnvironmentHost(undefined);
    invalidateTerminalEnvironment();
    for (const key of ENV_KEYS) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const DEFAULTS = {
  useDecayCurve: false,
  useAdaptiveDrain: false,
  base: 1,
  xtermJs: false,
  wheelFlood: false,
  jediTerm: false,
  termProgram: 'unset',
  termProgramVersion: 'unset',
  xtversion: '(no reply)',
  wtSession: false,
  scrollSpeedEnv: 'unset',
  platform: 'darwin',
};

test('the unbound host answers the source defaults', () => {
  withEnv({}, () => {
    assert.deepEqual(terminalEnvironment(), DEFAULTS);
  });
});

test('an xterm.js DA reply is a flood, so it keeps the window curve', () => {
  withEnv({}, () => {
    bindHost({ xtversionName: 'xterm.js(5.5.0)' });
    assert.deepEqual(terminalEnvironment(), {
      ...DEFAULTS,
      useAdaptiveDrain: true,
      wheelFlood: true,
      xtermJs: true,
      xtversion: 'xterm.js(5.5.0)',
    });
  });
});

test('Cursor marks wheel events as a flood and turns the decay curve off', () => {
  withEnv({ CURSOR_TRACE_ID: '1' }, () => {
    assert.deepEqual(terminalEnvironment(), {
      ...DEFAULTS,
      wheelFlood: true,
    });
  });
});

test('VS Code floods only inside the source version window', () => {
  for (const [version, flood] of [
    ['1.92.0', true],
    ['1.100.2', true],
    ['1.105.0', false],
    ['1.91.0', false],
  ] as const) {
    withEnv({ TERM_PROGRAM: 'vscode', TERM_PROGRAM_VERSION: version }, () => {
      const probe = terminalEnvironment();
      assert.equal(probe.wheelFlood, flood, version);
    });
  }
});

test('the VS Code terminal is xterm.js even without a DA reply', () => {
  withEnv({ TERM_PROGRAM: 'vscode' }, () => {
    assert.deepEqual(terminalEnvironment(), {
      ...DEFAULTS,
      useDecayCurve: true,
      useAdaptiveDrain: true,
      base: 3,
      xtermJs: true,
      termProgram: 'vscode',
    });
  });
});

test('a JetBrains terminal takes the base two', () => {
  withEnv({ TERMINAL_EMULATOR: 'JetBrains-JediTerm' }, () => {
    assert.deepEqual(terminalEnvironment(), {
      ...DEFAULTS,
      base: 2,
      jediTerm: true,
    });
  });
});

test('JediTerm plus Windows Terminal switches to the decay curve', () => {
  withEnv({ TERMINAL_EMULATOR: 'JetBrains-JediTerm', WT_SESSION: 'fixture' }, () => {
    assert.deepEqual(terminalEnvironment(), {
      ...DEFAULTS,
      useDecayCurve: true,
      base: 2,
      jediTerm: true,
      wtSession: true,
    });
  });
});

test('attacher capabilities override the environment probes', () => {
  withEnv({}, () => {
    bindHost({}, { wheelFlood: true });
    assert.equal(terminalEnvironment().wheelFlood, true);

    bindHost({}, { terminal: 'intellij' });
    assert.equal(terminalEnvironment().jediTerm, true);
    assert.equal(terminalEnvironment().base, 2);

    bindHost({}, { wtSession: true });
    assert.equal(terminalEnvironment().wtSession, true);
    assert.equal(terminalEnvironment().base, 3);
    assert.equal(terminalEnvironment().useDecayCurve, true);

    bindHost({}, { isVscodeTerm: true });
    assert.equal(terminalEnvironment().xtermJs, true);
    assert.equal(terminalEnvironment().base, 3);
  });
});

test('CLAUDE_CODE_SCROLL_SPEED overrides the base within the source bounds', () => {
  for (const [speed, base] of [
    ['5', 5],
    ['2.5', 2.5],
    ['50', 20],
    ['0', 1],
    ['-1', 1],
    ['nope', 1],
  ] as const) {
    withEnv({ CLAUDE_CODE_SCROLL_SPEED: speed }, () => {
      bindHost({ xtversionName: 'xterm.js' });
      // The source cache guard does not include the speed, so a rebind alone keeps the old probe.
      invalidateTerminalEnvironment();
      const probe = terminalEnvironment();
      assert.equal(probe.base, base, speed);
      assert.equal(probe.scrollSpeedEnv, speed);
    });
  }
});

test('the probe is cached until an input changes or it is invalidated', () => {
  withEnv({}, () => {
    const state: TerminalStateView = {};
    bindHost(state);
    const first = terminalEnvironment();
    assert.equal(terminalEnvironment(), first);

    state.xtversionName = 'xterm.js';
    const second = terminalEnvironment();
    assert.notEqual(second, first);
    assert.equal(second.xtermJs, true);

    invalidateTerminalEnvironment();
    const third = terminalEnvironment();
    assert.notEqual(third, second);
    assert.equal(third.xtversion, 'xterm.js');
  });
});

test('the cache is per host key and survives a rebind to the same key', () => {
  withEnv({}, () => {
    const keyA = {};
    const keyB = {};
    bindHost({}, undefined, keyA);
    const onA = terminalEnvironment();
    bindHost({}, undefined, keyB);
    const onB = terminalEnvironment();
    assert.notEqual(onB, onA);
    bindHost({}, undefined, keyA);
    assert.equal(terminalEnvironment(), onA);
  });
});
