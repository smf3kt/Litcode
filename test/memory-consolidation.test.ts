import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { MemoryConsolidation, consolidationPrompt } from '../src/memory-consolidation.js';
import { acquireMemoryConsolidation, lastMemoryConsolidation } from '../src/memory-consolidation-state.js';
import { createMemorySessionSearch, memorySessionsTouchedSince } from '../src/memory-session-search.js';
import { createMemoryTools } from '../src/memory.js';
import { createTools } from '../src/tools.js';
import { parseSettings } from '../src/runtime.js';
import { reloadConfig } from '../src/reload.js';
import { sourceConsolidationThresholds } from '../src/memory-consolidation-source.js';
import { Session } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'memory-consolidation-test-')));
function seed(workspace: string, count: number, child = false): string[] {
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const config = defaultConfig(workspace, []); config.model = 'fixture'; config.automaticCheckpoints = false;
    if (child) config.childMode = 'general';
    const session = Session.open(workspace, { config });
    session.append({ kind: 'message', message: { role: 'user', content: `durable preference ${index}` } });
    session.append({ kind: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'Use CLI checks.' },
      { type: 'tool_use', id: 'tool', name: 'read_file', input: { path: 'PRIVATE_TOOL_PAYLOAD' } }] } });
    session.append({ kind: 'message', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool', content: 'PRIVATE_TOOL_RESULT' }] } });
    session.append({ kind: 'turn_end', reason: 'end_turn' }); ids.push(session.id); session.close();
  }
  return ids;
}
function response(content: Anthropic.Message['content'], reason: Anthropic.Message['stop_reason'] = 'end_turn'): Anthropic.Message {
  return { id: randomUUID(), type: 'message', role: 'assistant', model: 'fixture', content,
    container: null, diagnostics: null, stop_details: null, stop_reason: reason, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
}

test('consolidation forwards child async attachment completion to its owning callback', async () => {
  const workspace = temporary(), controller = new AbortController();
  const tools = [...createTools(), ...createMemoryTools()];
  const config = defaultConfig(workspace, tools);
  config.model = 'fixture'; config.autoMemory = true; config.autoMemoryConsolidation = true;
  config.features = { tasks: false, subagents: false, memory: true };
  config.hooks = { SessionStart: [{ command: `printf '{"systemMessage":"MEMORY_CHILD_OUTPUT"}'`, async: true }] };
  const outputs: string[] = [];
  const runner = new MemoryConsolidation({ config, tools, signal: controller.signal, owner: randomUUID(),
    provider: { count: async () => 1, complete: async request => {
      assert.equal(JSON.stringify(request.messages).includes('MEMORY_CHILD_OUTPUT'), false);
      return response([{ type: 'text', text: 'No memory changes.', citations: null }]);
    } }, onHookCompletion: (_id, completion) => { outputs.push(JSON.stringify(completion.delivery)); } });
  try {
    seed(workspace, 5);
    await runner.tryStart(); await runner.settle();
    assert.equal(outputs.length, 1); assert.match(outputs[0]!, /MEMORY_CHILD_OUTPUT/);
  } finally { await runner.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('consolidation lease is exclusive and commits only a successful acquisition stamp', () => {
  const workspace = temporary();
  try {
    assert.equal(lastMemoryConsolidation(workspace), 0);
    const lease = acquireMemoryConsolidation(workspace, 123456)!;
    assert.equal(lease.prior, 0);
    assert.equal(acquireMemoryConsolidation(workspace), undefined);
    const source = new URL('../src/memory-consolidation-state.ts', import.meta.url).href;
    const result = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
      `import { acquireMemoryConsolidation } from ${JSON.stringify(source)}; process.stdout.write(String(acquireMemoryConsolidation(process.argv[1]) === undefined));`, workspace],
    { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' });
    assert.equal(result, 'true');
    lease.release(); lease.release();
    assert.equal(lastMemoryConsolidation(workspace), 0);
    const successful = acquireMemoryConsolidation(workspace, 234567)!;
    successful.complete(); successful.release();
    assert.equal(lastMemoryConsolidation(workspace), 234567);
    const failed = acquireMemoryConsolidation(workspace, 345678)!;
    failed.release();
    assert.equal(lastMemoryConsolidation(workspace), 234567);
    const file = path.join(workspace, '.harness/memory-consolidation.json');
    const conflicted = acquireMemoryConsolidation(workspace, 456789)!;
    fs.writeFileSync(file, JSON.stringify({ version: 1, lastConsolidatedAt: 333333 }));
    assert.throws(() => conflicted.complete(), /stamp changed/);
    conflicted.release();
    assert.equal(lastMemoryConsolidation(workspace), 333333);
    assert.equal(fs.existsSync(file + '.lock'), false);
    assert.deepEqual(fs.readdirSync(path.join(workspace, '.harness/memory')), []);
    fs.writeFileSync(file + '.lock', JSON.stringify({ pid: 99999999, token: randomUUID() }));
    const recovered = acquireMemoryConsolidation(workspace, 567890)!;
    assert.equal(recovered.prior, 333333); recovered.release();
    const lock = file + '.lock';
    fs.writeFileSync(lock, '');
    assert.equal(acquireMemoryConsolidation(workspace), undefined);
    const old = new Date(Date.now() - 7200000);
    fs.utimesSync(lock, old, old);
    const abandoned = acquireMemoryConsolidation(workspace, 678901)!;
    assert.equal(abandoned.prior, 333333); abandoned.release();
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, token: randomUUID() }));
    fs.utimesSync(lock, old, old);
    assert.equal(acquireMemoryConsolidation(workspace), undefined);
    fs.unlinkSync(lock);
    for (const point of ['created', 'written', 'published']) {
      const crashed = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
        import fs from 'node:fs';
        import { acquireMemoryConsolidation } from ${JSON.stringify(source)};
        const [workspace, point] = process.argv.slice(1);
        const lock = workspace + '/.harness/memory-consolidation.json.lock';
        const staging = file => String(file).includes('.memory-consolidation-lease-');
        const open = fs.openSync;
        fs.openSync = function(file, ...args) {
          const fd = open.call(fs, file, ...args);
          if (point === 'created' && args[0] === 'wx' && (file === lock || staging(file))) process.kill(process.pid, 'SIGKILL');
          return fd;
        };
        const sync = fs.fsyncSync;
        fs.fsyncSync = function(fd) {
          sync.call(fs, fd);
          if (point === 'written') process.kill(process.pid, 'SIGKILL');
        };
        const link = fs.linkSync;
        fs.linkSync = function(from, to) {
          link.call(fs, from, to);
          if (point === 'published' && to === lock) process.kill(process.pid, 'SIGKILL');
        };
        acquireMemoryConsolidation(workspace);
      `, workspace, point], { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8', timeout: 10000 });
      assert.equal(crashed.signal, 'SIGKILL', crashed.stderr);
      if (fs.existsSync(lock)) {
        const owner = JSON.parse(fs.readFileSync(lock, 'utf8'));
        assert.equal(owner.pid, crashed.pid);
        assert.match(owner.token, /^[a-f0-9-]{36}$/);
      }
      const next = acquireMemoryConsolidation(workspace, 789012)!;
      assert.equal(next.prior, 333333); next.release();
      assert.equal(lastMemoryConsolidation(workspace), 333333);
      assert.equal(fs.existsSync(lock), false);
      assert.equal(fs.readdirSync(path.dirname(file)).some(name => name.startsWith('.memory-consolidation-lease-')), false);
    }
    const race = execFileSync(process.execPath, ['scripts/smoke-memory-consolidation-lock.mjs', '--source'],
      { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8', timeout: 20000 });
    assert.equal(JSON.parse(race).admitted, 1);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('memory session search exposes committed main text without widening ordinary journal access', async () => {
  const workspace = temporary();
  try {
    const ids = seed(workspace, 2);
    seed(workspace, 1, true);
    const file = path.join(workspace, '.agent', `${ids[0]}.jsonl`);
    fs.appendFileSync(file, '{"kind":"message","message":{"role":"user","content":"UNCOMMITTED_TEXT"}}');
    assert.deepEqual(memorySessionsTouchedSince(workspace, 0, ids[1]!), [ids[0]]);
    const search = createMemorySessionSearch(workspace, [ids[0]!]);
    const context = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 };
    const matches = JSON.parse(await search.execute({ session_id: ids[0], pattern: 'CLI checks' }, context));
    assert.equal(matches.matches[0].text, 'Use CLI checks.');
    for (const pattern of ['UNCOMMITTED_TEXT', 'PRIVATE_TOOL_PAYLOAD', 'PRIVATE_TOOL_RESULT']) {
      assert.deepEqual(JSON.parse(await search.execute({ session_id: ids[0], pattern }, context)).matches, []);
    }
    await assert.rejects(search.execute({ session_id: ids[1], pattern: 'preference' }, context), /outside/);
    const read = createTools().find(tool => tool.schema.name === 'read_file')!;
    await assert.rejects(read.execute({ path: `.agent/${ids[0]}.jsonl` }, context), /reserved/);
    const prompt = consolidationPrompt(workspace, [ids[0]!]);
    assert.match(prompt, /memory_session_search/); assert.match(prompt, /index\.md/);
    assert.doesNotMatch(prompt, /grep -rn|Write tool|# Dream/);
    const live = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture' } });
    assert.equal(memorySessionsTouchedSince(workspace, 0, '00000000-0000-4000-8000-000000000000').includes(live.id), false);
    live.close();
    assert.equal(parseSettings({ autoMemoryConsolidation: true }).autoMemoryConsolidation, true);
    assert.throws(() => parseSettings({ autoMemoryConsolidation: 'true' }), /settings\.autoMemoryConsolidation must be true or false/);
    const settings = path.join(workspace, '.harness/settings.json');
    fs.mkdirSync(path.dirname(settings)); fs.mkdirSync(path.join(workspace, 'user'));
    fs.writeFileSync(settings, JSON.stringify({ autoMemoryConsolidation: true }));
    const current = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir: path.join(workspace, 'user') } };
    assert.equal(reloadConfig(current).autoMemoryConsolidation, true);
    fs.writeFileSync(settings, '{}');
    assert.equal(reloadConfig(current).autoMemoryConsolidation, undefined);
    assert.deepEqual(sourceConsolidationThresholds(), { minHours: 24, minSessions: 5 });
    assert.deepEqual(sourceConsolidationThresholds({ minHours: NaN, minSessions: -1 }), { minHours: 24, minSessions: 5 });
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('background memory admission keeps thresholds, conflicts, headless denials and cancellation cleanup', async () => {
  const workspace = temporary();
  const tools = [...createTools(), ...createMemoryTools()];
  const config = defaultConfig(workspace, tools); config.model = 'fixture'; config.automaticCheckpoints = false;
  config.autoMemory = true; config.autoMemoryConsolidation = true;
  config.features = { tasks: false, subagents: false, memory: true };
  const controller = new AbortController();
  const states: string[] = [];
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    calls++; return response([{ type: 'text', text: 'No memory changes.', citations: null }]);
  } };
  const options = { config, tools, provider, signal: controller.signal, owner: randomUUID(), onStatus: (text: string) => { states.push(text); } };
  const runners: MemoryConsolidation[] = [];
  const runner = () => { const result = new MemoryConsolidation(options); runners.push(result); return result; };
  try {
    seed(workspace, 4);
    await runner().tryStart(); assert.equal(calls, 0);
    seed(workspace, 1);
    const active = runner();
    await Promise.all([active.tryStart(), active.tryStart()]); await active.settle();
    assert.equal(calls, 1); assert.ok(lastMemoryConsolidation(workspace) > 0);
    await active.tryStart(); assert.equal(calls, 1);
    await runner().tryStart(); assert.equal(calls, 1);
    assert.ok(states.some(text => text.includes('completed')));
    fs.unlinkSync(path.join(workspace, '.harness/memory-consolidation.json'));
    config.permissions = { mode: 'bypass', allow: [], deny: ['memory_write'] };
    await runner().tryStart(); assert.equal(calls, 1); assert.equal(lastMemoryConsolidation(workspace), 0);
    config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const failure = new MemoryConsolidation({ ...options, provider: { count: async () => 0, complete: async () => { throw new Error('owned fixture failure'); } } });
    runners.push(failure); await failure.tryStart(); await failure.settle();
    assert.equal(lastMemoryConsolidation(workspace), 0);
    assert.ok(states.some(text => text.includes('owned fixture failure')));
    let attempted = 0;
    const conflict = new MemoryConsolidation({ ...options, provider: { count: async () => 0, complete: async request => {
      if (attempted++ === 0) return response([{ type: 'tool_use', id: 'write-conflict', name: 'memory_write',
        caller: { type: 'direct' }, input: { name: 'retained', content: 'replacement without a read' } }], 'tool_use');
      const last = request.messages.at(-1)?.content;
      assert.ok(Array.isArray(last));
      assert.equal(last[0]?.type, 'tool_result');
      assert.match(JSON.stringify(last), /create conflict/);
      return response([{ type: 'text', text: 'Retained conflicting note.', citations: null }]);
    } } });
    fs.writeFileSync(path.join(workspace, '.harness/memory/retained.md'), 'original retained fact');
    runners.push(conflict); await conflict.tryStart(); await conflict.settle();
    assert.equal(fs.readFileSync(path.join(workspace, '.harness/memory/retained.md'), 'utf8'), 'original retained fact');
    assert.equal(attempted, 2);
    fs.unlinkSync(path.join(workspace, '.harness/memory-consolidation.json'));
    const closing = runner();
    const preparation = closing.tryStart();
    await closing.close(); await preparation;
    assert.equal(fs.existsSync(path.join(workspace, '.harness/memory-consolidation.json.lock')), false);
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const cancelled = new MemoryConsolidation({ ...options, provider: { count: async () => 0, complete: async (_request, signal) => {
      entered(); return new Promise((_resolve, reject) => {
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    } } });
    runners.push(cancelled); await cancelled.tryStart(); await started;
    assert.equal(cancelled.tasks().length, 1);
    await cancelled.close();
    assert.equal(lastMemoryConsolidation(workspace), 0);
    assert.equal(fs.existsSync(path.join(workspace, '.harness/memory-consolidation.json.lock')), false);
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  } finally {
    for (const item of runners) await item.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
