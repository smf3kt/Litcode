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
    env: { ...process.env, LLM_API_KEY: apiKey, LLM_BASE_URL: 'http://127.0.0.1:1', LLM_MODEL: 'test-model', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false', LLM_PROMPT_CACHE: 'false', LLM_EAGER_TOOL_INPUT: 'false' },
  });
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
