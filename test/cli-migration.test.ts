import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { assertPaired } from '../src/agent.js';
import { Session } from '../src/session.js';
import { listSessions } from '../src/sessions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'src/cli.ts');
const TIMEOUT = { timeout: 20_000 };
function workspace(t: TestContext): string {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-migration-')));
  fs.mkdirSync(path.join(directory, 'user')); t.after(() => fs.rmSync(directory, { recursive: true, force: true })); return directory;
}
function write(root: string, name: string, content: string): void {
  const target = path.join(root, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content);
}
function run(args: string[], url = 'http://127.0.0.1:1', effort?: string) {
  const environment = { ...process.env }; delete environment.LLM_EFFORT;
  const child = spawn(process.execPath, ['--import', 'tsx', CLI, ...args], { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], env: {
    ...environment, ...(effort === undefined ? {} : { LLM_EFFORT: effort }),
    LLM_API_KEY: 'loopback-fixture', LLM_MODEL: 'fixture', LLM_BASE_URL: url,
    LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false',
    LLM_PROMPT_CACHE: 'false', LLM_EAGER_TOOL_INPUT: 'false',
  } });
  let stdout = '', stderr = '', settled = false;
  const timer = setTimeout(() => child.kill('SIGKILL'), 12_000);
  child.stdout.on('data', chunk => { stdout += String(chunk); if (stdout.length > 1_000_000) child.kill('SIGKILL'); });
  child.stderr.on('data', chunk => { stderr += String(chunk); if (stderr.length > 1_000_000) child.kill('SIGKILL'); });
  const done = new Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }>((resolve, reject) => {
    child.once('error', error => { clearTimeout(timer); settled = true; reject(error); });
    child.once('close', (code, signal) => { clearTimeout(timer); settled = true; resolve({ code, signal, stdout, stderr }); });
  });
  child.stdin.end(); return { child, done, settled: () => settled };
}
function send(res: ServerResponse, text: string, stop = 'end_turn') {
  const events = [
    { type: 'message_start', message: { id: 'fixture', type: 'message', role: 'assistant', model: 'fixture', content: [],
      stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 1 } },
    { type: 'message_stop' },
  ];
  res.writeHead(200, { 'content-type': 'text/event-stream', connection: 'close' });
  res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
}
async function gateway(handle: (request: any, response: ServerResponse) => void) {
  const requests: any[] = []; const failures: unknown[] = [];
  const server = createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) throw new Error('fixture body limit'); chunks.push(Buffer.from(chunk)); }
      const body = JSON.parse(Buffer.concat(chunks).toString()); requests.push(body); handle(body, res);
    })().catch(error => { failures.push(error); res.destroy(); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { url: `http://127.0.0.1:${address.port}`, requests, failures,
    async close() { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
async function until(condition: () => boolean, timeout = 4000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!condition()) { if (Date.now() > deadline) assert.fail('CLI fixture wait expired'); await new Promise(resolve => setTimeout(resolve, 10)); }
}

test('CLI permission help lists all seven accepted modes', TIMEOUT, async () => {
  const result = await run(['--help']).done; assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout.split('\n').find(line => line.startsWith('  --permission-mode MODE')),
    '  --permission-mode MODE default, plan, acceptEdits, ask, bypass, auto or dontAsk (default bypass)');
  assert.match(result.stdout, /--effort LEVEL.*low, medium, high, xhigh or max/);
});

test('CLI effort flag overrides settings and resume retains the pinned level', TIMEOUT, async t => {
  const root = workspace(t); write(root, '.harness/settings.json', JSON.stringify({ effort: 'low' }));
  const local = await gateway((_request, res) => send(res, 'effort checked')); let pending: ReturnType<typeof run> | undefined;
  try {
    // `Vit(r.effort)` (chunk-9vcaezw1.js 14114) writes the flag as the session effort, so it beats
    // a settings default; `kE` (12972) still puts `Y0()`'s environment value first, which the next
    // case asserts.
    pending = run(['--workspace', root, '--user-dir', path.join(root, 'user'), '--effort', 'xhigh', 'task'], local.url);
    const result = await pending.done; assert.equal(result.code, 0, result.stderr);
    assert.equal(local.requests[0].output_config.effort, 'xhigh');
    const id = /session: ([\w-]+)/.exec(result.stderr)?.[1]; assert.ok(id);
    const session = Session.open(root, { id }); try { assert.equal(session.config.effort, 'xhigh'); } finally { session.close(); }
    pending = run(['--workspace', root, '--resume', id, 'again'], local.url, 'max');
    assert.equal((await pending.done).code, 0);
    // `kE` puts `Y0()`'s environment value ahead of the session level, so the resumed request
    // carries the environment override while the journal keeps the pinned level.
    assert.equal(local.requests[1].output_config.effort, 'max');
    const resumed = Session.open(root, { id }); try { assert.equal(resumed.config.effort, 'xhigh'); } finally { resumed.close(); }
    const locked = await run(['--workspace', root, '--resume', id, '--effort', 'high', 'again'], local.url).done;
    assert.equal(locked.code, 1); assert.match(locked.stderr, /Resume uses stored settings/);
    assert.equal(local.requests.length, 2);
    // A fresh session with both: `kE` resolves the environment override before the session level.
    pending = run(['--workspace', root, '--user-dir', path.join(root, 'user'), '--effort', 'xhigh', 'task'], local.url, 'medium');
    assert.equal((await pending.done).code, 0);
    assert.equal(local.requests[2].output_config.effort, 'medium');
  } finally { pending?.child.kill('SIGKILL'); await pending?.done; await local.close(); }
});

test('CLI interrupt during one-shot background skill wait exits 130 and closes owned child locks', TIMEOUT, async t => {
  const root = workspace(t);
  write(root, '.harness/skills/background/SKILL.md', '---\nname: background\ndescription: fixture\nbackground: true\n---\nBackground fixture task');
  let entered = false;
  const local = await gateway(() => { entered = true; }); let pending: ReturnType<typeof run> | undefined;
  try {
    pending = run(['--workspace', root, '--user-dir', path.join(root, 'user'), '/background'], local.url);
    await until(() => entered || pending!.settled());
    if (!entered) { const early = await pending.done; assert.fail(early.stderr); }
    pending.child.kill('SIGINT'); const result = await pending.done;
    assert.equal(result.code, 130, result.stderr); assert.match(result.stderr, /finished: aborted/);
    assert.equal(listSessions(root).some(session => session.active), false);
    assert.equal(fs.readdirSync(path.join(root, '.agent')).some(name => name.endsWith('.lock')), false);
  } finally { pending?.child.kill('SIGKILL'); await pending?.done; await local.close(); }
});

test('CLI pins conditional rules separately, excludes them at startup and preserves snapshot on resume', TIMEOUT, async t => {
  const root = workspace(t); const body = 'CONDITIONAL_ONLY_SOURCE_MARKER';
  write(root, '.harness/rules/always.md', 'ALWAYS_PROJECT_MARKER');
  write(root, 'user/keybindings.json', JSON.stringify({ '\u0013': 'submit', '\r': 'newline' }));
  write(root, '.harness/keybindings.json', JSON.stringify({ '\r': 'submit' }));
  write(root, '.harness/rules/source.md', `---\npaths: ["src/**"]\n---\n${body}`);
  const local = await gateway((_request, res) => send(res, 'completed')); let pending: ReturnType<typeof run> | undefined;
  try {
    pending = run(['--workspace', root, '--user-dir', path.join(root, 'user'), 'first task'], local.url);
    const result = await pending.done; assert.equal(result.code, 0, result.stderr); assert.equal(local.requests.length, 1);
    assert.match(String(local.requests[0].system), /ALWAYS_PROJECT_MARKER/);
    assert.equal(String(local.requests[0].system).includes(body), false);
    const id = /session: ([\w-]+)/.exec(result.stderr)?.[1]; assert.ok(id);
    const session = Session.open(root, { id }); let pinned: unknown;
    try {
      pinned = structuredClone(session.config.conditionalRules);
      assert.deepEqual(pinned, [{ path: path.join(root, '.harness/rules/source.md'),
        content: `---\npaths: ["src/**"]\n---\n${body}`, patterns: ['src/**'] }]);
      assert.equal(session.config.system.includes(body), false);
      assert.deepEqual(session.config.keybindings, { '\u0013': 'submit', '\r': 'submit' });
    } finally { session.close(); }
    write(root, '.harness/rules/source.md', '---\npaths: ["other/**"]\n---\nCHANGED_DISK_RULE');
    write(root, '.harness/keybindings.json', JSON.stringify({ '\r': 'newline' }));
    pending = run(['--workspace', root, '--resume', id, 'followup'], local.url);
    const resumed = await pending.done; assert.equal(resumed.code, 0, resumed.stderr);
    const reopened = Session.open(root, { id });
    try { assert.deepEqual(reopened.config.conditionalRules, pinned);
      assert.deepEqual(reopened.config.keybindings, { '\u0013': 'submit', '\r': 'submit' }); assertPaired(reopened.messages); }
    finally { reopened.close(); }
    assert.equal(String(local.requests[1].system).includes('CHANGED_DISK_RULE'), false);
    assert.deepEqual(local.failures, []);
  } finally { pending?.child.kill('SIGKILL'); await pending?.done; await local.close(); }
});

for (const stop of ['end_turn', 'refusal']) {
  test(`CLI one-shot background skill waits for child ${stop} and reports completion status`, TIMEOUT, async t => {
    const root = workspace(t);
    write(root, '.harness/skills/background/SKILL.md', '---\nname: background\ndescription: fixture\nbackground: true\n---\nBackground fixture task');
    let held: ServerResponse | undefined;
    const local = await gateway((_request, res) => { held = res; }); let pending: ReturnType<typeof run> | undefined;
    try {
      pending = run(['--workspace', root, '--user-dir', path.join(root, 'user'), '/background'], local.url);
      await until(() => Boolean(held) || pending!.settled());
      if (!held) { const early = await pending.done; assert.fail(`background child never reached provider: ${early.stderr}; stdout=${early.stdout}`); }
      assert.equal(pending.settled(), false, 'CLI must keep its runtime alive while the child response is pending');
      assert.equal(listSessions(root).filter(session => session.active).length, 2);
      send(held!, 'delayed child result', stop); const result = await pending.done;
      assert.equal(result.signal, null); assert.equal(result.code, stop === 'end_turn' ? 0 : 2, result.stderr);
      const descriptor = JSON.parse(result.stdout.trim());
      assert.equal(descriptor.status, stop === 'end_turn' ? 'completed' : 'failed');
      assert.equal(descriptor.reason, stop); assert.equal(descriptor.summary, 'delayed child result');
      assert.match(result.stderr, new RegExp(`finished: ${stop}`));
      assert.equal(listSessions(root).some(session => session.active), false);
      const child = Session.open(root, { id: descriptor.session_id });
      try { assertPaired(child.messages); assert.equal(child.events.at(-1)?.kind, 'turn_end'); }
      finally { child.close(); }
      assert.equal(fs.readdirSync(path.join(root, '.agent')).some(file => file.endsWith('.lock')), false);
      assert.deepEqual(local.failures, []);
    } finally { pending?.child.kill('SIGKILL'); await pending?.done; await local.close(); }
  });
}

for (const format of ['json', 'stream-json']) {
  test(`CLI ${format} emits parseable structured output without raw delta duplication`, TIMEOUT, async t => {
    const root = workspace(t);
    const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };
    const local = await gateway((_request, res) => send(res, '{"ok":true}')); let pending: ReturnType<typeof run> | undefined;
    try {
      pending = run(['--workspace', root, '--user-dir', path.join(root, 'user'), '--output-format', format,
        '--json-schema', JSON.stringify(schema), 'return JSON'], local.url);
      const result = await pending.done; assert.equal(result.code, 0, result.stderr);
      const records = result.stdout.trim().split('\n').map(line => JSON.parse(line));
      const final = format === 'json' ? records[0] : records.at(-1).result;
      assert.equal(final.reason, 'end_turn'); assert.deepEqual(final.structured_output, { ok: true });
      assert.equal(final.model_calls, 1); assert.equal(final.usage.input_tokens, 1);
      if (format === 'json') assert.equal(records.length, 1);
      else {
        assert.equal(records.filter(item => item.type === 'result').length, 1);
        assert.deepEqual(records.map(item => item.sequence), records.map((_item, index) => index + 1));
        assert.ok(records.some(item => item.type === 'text')); assert.ok(records.some(item => item.type === 'usage'));
      }
      assert.match(JSON.stringify(local.requests[0].messages), /matching this schema/);
      assert.equal(local.requests[0].output_config, undefined);
    } finally { pending?.child.kill('SIGKILL'); await pending?.done; await local.close(); }
  });
}

test('CLI schema mismatch produces final schema_error and releases session lock', TIMEOUT, async t => {
  const root = workspace(t), local = await gateway((_request, res) => send(res, '{"ok":"wrong"}'));
  let pending: ReturnType<typeof run> | undefined;
  try {
    pending = run(['--workspace', root, '--user-dir', path.join(root, 'user'), '--output-format', 'json',
      '--json-schema', '{"type":"object","properties":{"ok":{"type":"boolean"}}}', 'task'], local.url);
    const result = await pending.done; assert.equal(result.code, 2, result.stderr);
    const final = JSON.parse(result.stdout); assert.equal(final.reason, 'schema_error'); assert.equal(final.error.code, 'schema_validation');
    assert.equal(listSessions(root).some(item => item.active), false);
  } finally { pending?.child.kill('SIGKILL'); await pending?.done; await local.close(); }
});

test('CLI invocation budget counts actual usage and reports overshoot plus zero-call refusal before dispatch', TIMEOUT, async t => {
  const root = workspace(t), local = await gateway((_request, res) => send(res, 'response counted'));
  let pending: ReturnType<typeof run> | undefined;
  try {
    pending = run(['--workspace', root, '--user-dir', path.join(root, 'user'), '--output-format', 'json',
      '--max-total-tokens', '1', 'task'], local.url);
    const result = await pending.done; assert.equal(result.code, 2, result.stderr);
    const final = JSON.parse(result.stdout); assert.equal(final.reason, 'budget_exceeded');
    assert.equal(final.usage.input_tokens, 1); assert.equal(final.usage.output_tokens, 1); assert.equal(final.model_calls, 1);
    assert.equal(listSessions(root).some(item => item.active), false);
    pending = run(['--workspace', root, '--user-dir', path.join(root, 'user'), '--output-format', 'stream-json',
      '--json-schema', '{"type":"object"}', '--max-model-calls', '0', 'task'], local.url);
    const stopped = await pending.done; assert.equal(stopped.code, 2, stopped.stderr);
    const records = stopped.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(records.at(-1).result.reason, 'budget_exceeded'); assert.equal(records.at(-1).result.model_calls, 0);
    assert.equal(local.requests.length, 1); assert.equal(listSessions(root).some(item => item.active), false);
  } finally { pending?.child.kill('SIGKILL'); await pending?.done; await local.close(); }
});

test('CLI pins configured web search endpoint and advertises poll_agents only for modern idle feature', TIMEOUT, async t => {
  const root = workspace(t), search = { endpoint: 'http://127.0.0.1:1/search', method: 'GET' };
  write(root, '.harness/settings.json', JSON.stringify({ webSearch: search }));
  const local = await gateway((_request, res) => send(res, 'configured')); let pending: ReturnType<typeof run> | undefined;
  try {
    pending = run(['--workspace', root, '--user-dir', path.join(root, 'user'), 'task'], local.url);
    const result = await pending.done; assert.equal(result.code, 0, result.stderr);
    const names = local.requests[0].tools.map((tool: { name: string }) => tool.name);
    assert.ok(names.includes('web_search')); assert.ok(names.includes('poll_agents'));
    const id = /session: ([\w-]+)/.exec(result.stderr)?.[1]; assert.ok(id);
    const session = Session.open(root, { id });
    try { assert.deepEqual(session.config.webSearch, search); assert.equal(session.config.features?.agentIdle, true); }
    finally { session.close(); }
  } finally { pending?.child.kill('SIGKILL'); await pending?.done; await local.close(); }
});

test('CLI rejects invalid headless/schema options before opening a session', TIMEOUT, async t => {
  const root = workspace(t);
  for (const args of [['--interactive', '--output-format', 'json'], ['--json-schema', '{"$ref":"external"}', 'task'],
    ['--max-total-tokens', '-1', 'task']]) {
    const result = await run(['--workspace', root, '--user-dir', path.join(root, 'user'), ...args]).done;
    assert.equal(result.code, 1); assert.equal(result.stderr.includes('session:'), false);
  }
  assert.equal(fs.existsSync(path.join(root, '.agent')), false);
});
