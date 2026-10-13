import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { assertPaired } from '../src/agent.js';
import { Session } from '../src/session.js';

const cli = path.resolve('src/cli.ts');
function invoke(args: string[], apiKey = '') {
  return spawnSync(process.execPath, ['--import', 'tsx', cli, ...args], {
    encoding: 'utf8', timeout: 15_000,
    // Inheritance is off here so a developer's own client configuration cannot reach
    // these cases; the tests that exercise it build their own fixture directory.
    env: { ...process.env, LLM_API_KEY: apiKey, LLM_BASE_URL: 'http://127.0.0.1:1', LLM_MODEL: 'test-model', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false', LLM_PROMPT_CACHE: 'false', LLM_EAGER_TOOL_INPUT: 'false', LLM_INHERIT_GATEWAY: 'false' },
  });
}
/** Like invoke, but the case owns the whole environment so inheritance can be exercised. */
function invokeEnv(args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ['--import', 'tsx', cli, ...args], { encoding: 'utf8', timeout: 20_000, env });
}
/** A fixture client configuration directory: settings.json with an env block. */
function clientDir(env: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'client-config-'));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ env }));
  return dir;
}
/** A live-run environment that carries no LLM_* gateway values of its own. */
function liveEnv(dir: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH, HOME: process.env.HOME, LLM_INHERIT_DIR: dir,
    LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false', LLM_PROMPT_CACHE: 'false', LLM_EAGER_TOOL_INPUT: 'false',
    ...extra,
  };
}
function workspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-'));
  return fs.realpathSync(dir);
}
function writeSettings(ws: string, settings: unknown): void {
  fs.mkdirSync(path.join(ws, '.harness'), { recursive: true });
  fs.writeFileSync(path.join(ws, '.harness', 'settings.json'), JSON.stringify(settings));
}

test('CLI help works without an API key', () => {
  const result = invoke(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--context-tokens/);
  assert.match(result.stdout, /--continue/);
  assert.match(result.stdout, /--settings/);
  assert.match(result.stdout, /--permission-mode/);
  assert.match(result.stdout, /--tasks/);
  assert.match(result.stdout, /--inherit-gateway/);
  assert.match(result.stdout, /--no-inherit-gateway/);
});

test('CLI rejects incompatible arguments before opening a session', () => {
  for (const args of [['--continue'], ['--demo', 'task'], ['--resume', 'x', '--model', 'changed', 'task']]) {
    const result = invoke(args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /error:/);
    assert.doesNotMatch(result.stderr, /session:/);
  }
});

test('CLI blocks config-changing flags on resume before opening a session', () => {
  for (const args of [
    ['--resume', 'x', '--settings', 'settings.json', 'task'],
    ['--resume', 'x', '--user-dir', '/tmp', 'task'],
    ['--resume', 'x', '--permission-mode', 'plan', 'task'],
    ['--resume', 'x', '--allow-tool', 'read_*', 'task'],
    ['--resume', 'x', '--deny-tool', 'run_command', 'task'],
    ['--resume', 'x', '--tasks', 'task'],
    ['--resume', 'x', '--subagents', 'task'],
  ]) {
    const result = invoke(args);
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /Resume uses stored settings/);
    assert.doesNotMatch(result.stderr, /session:/);
  }
});

test('CLI fails on a malformed settings field before opening a session', () => {
  const ws = workspace();
  try {
    writeSettings(ws, { maxTurns: 'not-a-number' });
    const result = invoke(['--workspace', ws, 'task'], 'test-key');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /settings\.maxTurns/);
    assert.doesNotMatch(result.stderr, /session:/);
  } finally { fs.rmSync(ws, { recursive: true, force: true }); }
});

test('CLI rejects an MCP server that declares environment values', () => {
  const ws = workspace();
  try {
    writeSettings(ws, { mcpServers: { srv: { command: 'node', env: { TOKEN: 'secret' } } } });
    const result = invoke(['--workspace', ws, 'task'], 'test-key');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /error:/);
    assert.doesNotMatch(result.stderr, /session:/);
  } finally { fs.rmSync(ws, { recursive: true, force: true }); }
});

test('CLI rejects an unknown permission mode before opening a session', () => {
  const ws = workspace();
  try {
    const result = invoke(['--workspace', ws, '--permission-mode', 'bogus', 'task'], 'test-key');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Expected default or plan or acceptEdits/);
    assert.doesNotMatch(result.stderr, /session:/);
  } finally { fs.rmSync(ws, { recursive: true, force: true }); }
});

test('CLI demo persists paired results and resumes a saved final response offline', () => {
  const demo = invoke(['--demo']);
  assert.equal(demo.status, 0, demo.stderr);
  assert.match(demo.stdout, /Offline demo passed/);
  const workspace = /workspace: (.+)/.exec(demo.stderr)?.[1];
  const id = /session: (.+)/.exec(demo.stderr)?.[1];
  assert.ok(workspace && id);
  try {
    assert.equal(workspace, fs.realpathSync(workspace));
    assert.equal(fs.readFileSync(path.join(workspace, 'hello.txt'), 'utf8'), 'Hello from the independent agent.\n');
    const session = Session.open(workspace, { id });
    try {
      assertPaired(session.messages);
      assert.equal(session.awaitingResponse, false);
      assert.equal(session.events.filter(e => e.kind === 'tool_result').length, 2);
      assert.equal(session.config.model, 'offline-fixture');
      assert.equal(session.config.gateway?.baseURL, 'http://127.0.0.1:1');
      assert.equal(session.config.gateway?.auth, 'bearer');
      assert.equal('apiKey' in session.config, false);
      // The offline demo stays on base tools and adds no post-MVP fields.
      assert.equal(session.config.features, undefined);
      assert.equal(session.config.mcpServers, undefined);
      assert.deepEqual(session.config.tools.map(tool => tool.name),
        ['read_file', 'list_files', 'search', 'write_file', 'edit_file', 'run_command']);
    } finally { session.close(); }
    const journal = path.join(workspace, '.agent', `${id}.jsonl`);
    const lines = fs.readFileSync(journal, 'utf8').trimEnd().split('\n');
    assert.equal(JSON.parse(lines.at(-1)!).kind, 'turn_end');
    assert.doesNotMatch(lines.join('\n'), /offline-fixture-key/);
    // Model response committed, process interrupted before the turn-end record.
    fs.writeFileSync(journal, lines.slice(0, -1).join('\n') + '\n');
    const resumed = invoke(['--workspace', workspace, '--resume', id, '--continue'], 'offline-fixture-key');
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.match(resumed.stderr, /model calls: 0/);
    assert.match(resumed.stdout, /Offline demo passed/);
    const resumedJournal = fs.readFileSync(journal, 'utf8');
    assert.equal(JSON.parse(resumedJournal.trimEnd().split('\n').at(-1)!).kind, 'turn_end');
    assert.doesNotMatch(resumedJournal, /offline-fixture-key/);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('CLI reports its version without a credential or a model call', () => {
  const result = invoke(['--version']);
  assert.equal(result.status, 0, result.stderr);
  const version = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')).version;
  assert.equal(result.stdout.trim(), version);
  assert.equal(invoke(['-v']).stdout.trim(), version);
});

test('a bare invocation without a terminal prints the help instead of failing', () => {
  const bare = invoke([]);
  assert.equal(bare.status, 0, bare.stderr);
  assert.match(bare.stdout, /litcode {2,}Interactive session in the current directory/);

  // The options that belong to an interactive session still refuse to be implied without one.
  const elicitation = invoke(['--mcp-elicitation']);
  assert.equal(elicitation.status, 1);
  assert.match(elicitation.stderr, /--mcp-elicitation requires --interactive/);
});

test('a bare invocation at a terminal opens the interactive session', { timeout: 60_000 }, () => {
  // The default under test depends on a terminal, so the child needs a real one. `script`
  // allocates it, but it refuses to run when its own standard input is a socket — which is
  // what Node hands a spawned child — so the session runs behind a shell pipeline, where
  // stdin is an ordinary pipe. A host without `script` skips rather than fails.
  const quit = ["printf '/exit\\n'", '|', 'script -q /dev/null',
    process.execPath, '--import', 'tsx', cli].join(' ');
  const result = spawnSync('/bin/sh', ['-c', quit], {
    encoding: 'utf8', timeout: 50_000,
    env: { ...process.env, TERM: 'xterm-256color', LLM_INHERIT_GATEWAY: 'false', LLM_API_KEY: 'offline-fixture-key', LLM_BASE_URL: 'http://127.0.0.1:1', LLM_MODEL: 'test-model', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false', LLM_PROMPT_CACHE: 'false', LLM_EAGER_TOOL_INPUT: 'false' },
  });
  if (result.error || /script: .*Operation not supported/.test(result.stderr ?? '')) return;
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('\x1b[?1049h'));
  assert.ok(result.stdout.includes('\x1b[?1049l'));
  assert.match(result.stdout, /^workspace: /m);
  // No task was given, so the session must not have spent a model call.
  assert.doesNotMatch(result.stdout, /model calls: [1-9]/);
});

test('explicit line mode and dumb terminals avoid alternate-screen ownership', { timeout: 60_000 }, () => {
  for (const [flag, term] of [['--no-tui', 'xterm-256color'], ['', 'dumb']]) {
    const quit = `printf '/exit\\n' | script -q /dev/null ${process.execPath} --import tsx ${cli} ${flag}`;
    const result = spawnSync('/bin/sh', ['-c', quit], {
      encoding: 'utf8', timeout: 20_000,
      env: { ...process.env, TERM: term, LLM_INHERIT_GATEWAY: 'false', LLM_API_KEY: 'offline-fixture-key',
        LLM_BASE_URL: 'http://127.0.0.1:1', LLM_MODEL: 'test-model', LLM_AUTH: 'bearer',
        LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false', LLM_PROMPT_CACHE: 'false' },
    });
    if (result.error || /script: .*Operation not supported/.test(result.stderr ?? '')) return;
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.includes('\x1b[?1049h'), false);
    assert.match(result.stdout, /Personal harness\. \/help for commands\./);
  }
  assert.match(invoke(['--tui', '--no-tui', '--interactive']).stderr, /Choose --tui or --no-tui/);
});

test('a live run takes a missing gateway, credential and model from the client configuration', () => {
  const dir = clientDir({
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:1',
    ANTHROPIC_AUTH_TOKEN: 'fixture-inherited-token',
    ANTHROPIC_MODEL: 'inherited-model',
  });
  const ws = workspace();
  try {
    // No LLM_API_KEY, LLM_BASE_URL or LLM_MODEL: everything comes from the client file.
    const result = invokeEnv(['--workspace', ws, 'task'], liveEnv(dir));
    assert.doesNotMatch(result.stderr, /Set LLM_API_KEY/);
    // Each field reports the variable and file it came from, grouped by source.
    assert.match(result.stderr, /gateway: inherited credential from ANTHROPIC_AUTH_TOKEN in .*settings\.json/);
    assert.match(result.stderr, /base URL from ANTHROPIC_BASE_URL in .*settings\.json/);
    assert.match(result.stderr, /model from ANTHROPIC_MODEL in .*settings\.json/);
    // The notice names where a value came from; it never carries the value.
    assert.doesNotMatch(result.stderr, /fixture-inherited-token/);
    assert.doesNotMatch(result.stdout, /fixture-inherited-token/);
  } finally { fs.rmSync(ws, { recursive: true, force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('an explicit value still outranks the client configuration', () => {
  const dir = clientDir({
    ANTHROPIC_BASE_URL: 'https://gateway.example.test',
    ANTHROPIC_AUTH_TOKEN: 'fixture-inherited-token',
    ANTHROPIC_MODEL: 'inherited-model',
  });
  const ws = workspace();
  try {
    // The flag names a different endpoint, so the borrowed credential does not apply.
    const refused = invokeEnv(['--workspace', ws, '--base-url', 'http://127.0.0.1:1', 'task'], liveEnv(dir));
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /it belongs to https:\/\/gateway\.example\.test and this run uses http:\/\/127\.0\.0\.1:1/);
    assert.doesNotMatch(refused.stderr, /fixture-inherited-token/);

    // With this harness's own key the borrowed one is not consulted at all.
    const own = invokeEnv(['--workspace', ws, 'task'], liveEnv(dir, { LLM_API_KEY: 'own-key', LLM_BASE_URL: 'http://127.0.0.1:1', LLM_MODEL: 'own-model' }));
    assert.doesNotMatch(own.stderr, /inherited/);
  } finally { fs.rmSync(ws, { recursive: true, force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('inheritance can be turned off and is off for the offline demo', () => {
  const dir = clientDir({ ANTHROPIC_AUTH_TOKEN: 'fixture-inherited-token', ANTHROPIC_MODEL: 'inherited-model' });
  const ws = workspace();
  try {
    const off = invokeEnv(['--workspace', ws, '--no-inherit-gateway', 'task'], liveEnv(dir));
    assert.equal(off.status, 1);
    assert.match(off.stderr, /Set LLM_API_KEY/);
    const offByEnvironment = invokeEnv(['--workspace', ws, 'task'], liveEnv(dir, { LLM_INHERIT_GATEWAY: 'false' }));
    assert.equal(offByEnvironment.status, 1);
    assert.match(offByEnvironment.stderr, /Set LLM_API_KEY/);
    const both = invokeEnv(['--workspace', ws, '--inherit-gateway', '--no-inherit-gateway', 'task'], liveEnv(dir));
    assert.equal(both.status, 1);
    assert.match(both.stderr, /Choose --inherit-gateway or --no-inherit-gateway/);
  } finally { fs.rmSync(ws, { recursive: true, force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a resumed session borrows a credential for its pinned endpoint', () => {
  const demo = invoke(['--demo']);
  assert.equal(demo.status, 0, demo.stderr);
  const demoWorkspace = /workspace: (.+)/.exec(demo.stderr)?.[1];
  const id = /session: (.+)/.exec(demo.stderr)?.[1];
  assert.ok(demoWorkspace && id);
  // The demo pinned http://127.0.0.1:1, so a client configured for that endpoint applies.
  const dir = clientDir({ ANTHROPIC_BASE_URL: 'http://127.0.0.1:1', ANTHROPIC_AUTH_TOKEN: 'fixture-inherited-token' });
  try {
    const resumed = invokeEnv(['--workspace', demoWorkspace, '--resume', id, 'task'], liveEnv(dir));
    assert.doesNotMatch(resumed.stderr, /Set LLM_API_KEY/);
    assert.match(resumed.stderr, /gateway: inherited credential from ANTHROPIC_AUTH_TOKEN in /);
    assert.doesNotMatch(resumed.stderr, /fixture-inherited-token/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
