import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Agent, assertPaired, defaultConfig } from '../src/agent.js';
import { autoCompactDialogMessage, autoCompactStatus, resolveAutoCompactWindow } from '../src/autocompact-command.js';
import { configPanelInput } from '../src/config-panel-input.js';
import { ConfigPanel } from '../src/config-panel.js';
import { loadProjectConfig } from '../src/config.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { reloadConfig } from '../src/reload.js';
import { parseSettings } from '../src/runtime.js';
import { Session } from '../src/session.js';
import { saveConfigPanelSetting } from '../src/theme-settings.js';

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
    ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w234-test-')));
  const userDir = path.join(root, 'user'); fs.mkdirSync(userDir);
  const config = { ...defaultConfig(root, []), model: 'fixture', configSources: { userDir } };
  const requests: ModelRequest[] = [];
  let pressure = 512_000, summaryPressure = 100;
  const provider: ModelProvider = {
    async count(request, signal) {
      signal.throwIfAborted(); assertPaired(request.messages);
      return String(request.messages[0]?.content).startsWith('Session summary') ? summaryPressure : pressure;
    },
    async complete(request, signal) {
      signal.throwIfAborted(); requests.push(request); assertPaired(request.messages);
      return { id: `fixture-${requests.length}`, role: 'assistant', type: 'message', model: 'fixture',
        content: [{ type: 'text', text: request.tool_choice?.type === 'none' ? 'Summary of the prior task.' : 'done', citations: null }],
        stop_reason: 'end_turn', stop_sequence: null, container: null, diagnostics: null, stop_details: null,
        usage: { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
          cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
    },
  };
  return { root, userDir, config, provider, requests, pressure(value: number) { pressure = value; },
    summaryPressure(value: number) { summaryPressure = value; },
    close() { fs.rmSync(root, { recursive: true, force: true }); } };
}

function history(session: Session) {
  session.append({ kind: 'message', message: { role: 'user', content: 'Prior task' } });
  session.append({ kind: 'message', message: { role: 'assistant', content: 'Prior answer' } });
  session.append({ kind: 'turn_end', reason: 'end_turn' });
}

function environment() {
  const before = { LLM_DISABLE_COMPACT: process.env.LLM_DISABLE_COMPACT,
    LLM_DISABLE_AUTO_COMPACT: process.env.LLM_DISABLE_AUTO_COMPACT };
  delete process.env.LLM_DISABLE_COMPACT; delete process.env.LLM_DISABLE_AUTO_COMPACT;
  return () => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
}

test('Config auto-compact writes false, respects higher layers and restores the setting without environment values', async () => {
  const f = fixture(), restore = environment();
  try {
    const input = configPanelInput(f.config), panel = new ConfigPanel(input);
    assert.equal(panel.focused?.id, 'autoCompact');
    assert.deepEqual(panel.activate(), { kind: 'change', update: { id: 'autoCompact', value: false } });
    fs.writeFileSync(path.join(f.userDir, 'settings.json'), JSON.stringify({ keep: { authored: true } }), { mode: 0o640 });
    await saveConfigPanelSetting({ id: 'autoCompact', value: false }, f.root, f.userDir);
    const file = path.join(f.userDir, 'settings.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { keep: { authored: true }, autoCompactEnabled: false });
    assert.equal(fs.statSync(file).mode & 0o777, 0o640);
    assert.equal(parseSettings(loadProjectConfig(f.root, { userDir: f.userDir, paths: [] }).settings).autoCompactEnabled, false);
    assert.throws(() => parseSettings({ autoCompactEnabled: 'false' }), /autoCompactEnabled/);
    const loaded = reloadConfig(f.config); assert.equal(loaded.autoCompactEnabled, false);
    const session = Session.open(f.root, { config: loaded }); const id = session.id; session.close();
    process.env.LLM_DISABLE_AUTO_COMPACT = ' yes ';
    const resumed = Session.open(f.root, { id });
    assert.equal(resumed.config.autoCompactEnabled, false); resumed.close();
    assert.equal(fs.readFileSync(path.join(f.root, '.agent', `${id}.jsonl`), 'utf8').includes('LLM_DISABLE_AUTO_COMPACT'), false);
    fs.mkdirSync(path.join(f.root, '.harness'));
    fs.writeFileSync(path.join(f.root, '.harness', 'settings.local.json'), JSON.stringify({ autoCompactEnabled: true }));
    assert.equal(reloadConfig(loaded).autoCompactEnabled, true);
    fs.unlinkSync(path.join(f.root, '.harness', 'settings.local.json'));
    fs.writeFileSync(file, '{}');
    const reset = reloadConfig(loaded); assert.equal(reset.autoCompactEnabled, undefined);
    assert.deepEqual(new ConfigPanel(configPanelInput(reset)).activate(), { kind: 'change', update: { id: 'autoCompact', value: false } });
    const window = resolveAutoCompactWindow(975_424, undefined);
    assert.match(autoCompactStatus('fixture', window, false), /Auto-compact is currently disabled \(see \/config\)/);
    assert.match(autoCompactDialogMessage('fixture', window, false), /Auto-compact is currently disabled \(see \/config\)/);
    assert.doesNotMatch(autoCompactStatus('fixture', window), /currently disabled/);
  } finally { restore(); f.close(); }
});

test('disabled auto skips both threshold triggers but keeps manual summaries and the hard capacity boundary', async () => {
  const restore = environment();
  try {
    for (const attachment of [false, true]) {
      const f = fixture();
      const session = Session.open(f.root, { config: { ...f.config, autoCompactEnabled: false } });
      try {
        history(session);
        const image = path.join(f.root, 'pixel.png');
        fs.writeFileSync(image, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
        const agent = new Agent(session, f.provider, []);
        assert.equal((await agent.run('Current task', undefined, attachment ? { path: 'pixel.png' } : undefined)).reason, 'end_turn');
        assert.equal(f.requests.length, 1); assert.equal(f.requests[0]?.tool_choice, undefined);
        assert.equal(session.events.filter(event => event.kind === 'compact').length, 0);
        await agent.compactContext(undefined, 'Keep the current task.');
        assert.equal(f.requests.length, 2); assert.deepEqual(f.requests.at(-1)?.tool_choice, { type: 'none' });
        assert.equal(session.events.filter(event => event.kind === 'compact').length, 1);
        assert.match(JSON.stringify(f.requests.at(-1)?.messages), /Keep the current task/);
      } finally { session.close(); f.close(); }
    }
    const f = fixture(); f.pressure(980_616);
    const session = Session.open(f.root, { config: { ...f.config, autoCompactEnabled: false } });
    try {
      history(session);
      const agent = new Agent(session, f.provider, []);
      assert.deepEqual(await agent.run('At hard capacity'), { reason: 'blocking_limit', text: 'Prompt is too long', modelCalls: 0 });
      assert.equal(f.requests.length, 0); assert.equal(session.awaitingResponse, false);
      await agent.compactContext(); assert.equal(f.requests.length, 1);
      assert.equal((await agent.run('Continue after manual compact')).reason, 'end_turn');
      assert.equal(f.requests.length, 2);
    } finally { session.close(); f.close(); }
    const oversized = fixture(); oversized.pressure(980_700); oversized.summaryPressure(980_700);
    const pending = Session.open(oversized.root, { config: { ...oversized.config, compactAt: 981_000 } });
    try {
      const agent = new Agent(pending, oversized.provider, []);
      assert.deepEqual(await agent.run('Initial input above capacity'), { reason: 'blocking_limit', text: 'Prompt is too long', modelCalls: 0 });
      assert.equal(oversized.requests.length, 0); assert.equal(pending.awaitingResponse, false);
      history(pending); oversized.pressure(981_000);
      assert.deepEqual(await agent.run('Summary must fit capacity'), { reason: 'blocking_limit', text: 'Prompt is too long', modelCalls: 0 });
      assert.equal(oversized.requests.length, 1); assert.deepEqual(oversized.requests[0]?.tool_choice, { type: 'none' });
      assert.equal(pending.events.filter(event => event.kind === 'compact').length, 0);
      assert.equal(pending.awaitingResponse, false);
      await assert.rejects(agent.compactContext(), /Compaction failed to free context/);
      assert.equal(pending.awaitingResponse, false);
      oversized.summaryPressure(100);
      await agent.compactContext();
      assert.equal((await agent.run('Continue after repairing the summary')).reason, 'end_turn');
    } finally { pending.close(); oversized.close(); }
  } finally { restore(); }
});

test('live environment gates preserve the stored value, re-enable auto and release a canceled manual summary', async () => {
  const f = fixture(), restore = environment();
  const session = Session.open(f.root, { config: f.config });
  try {
    history(session); const agent = new Agent(session, f.provider, []);
    process.env.LLM_DISABLE_AUTO_COMPACT = ' YeS ';
    await agent.run('Environment disables auto');
    assert.equal(f.requests.length, 1); assert.equal(session.config.autoCompactEnabled, undefined);
    process.env.LLM_DISABLE_AUTO_COMPACT = 'off';
    await agent.run('Environment enables auto');
    assert.equal(f.requests.length, 3); assert.deepEqual(f.requests[1]?.tool_choice, { type: 'none' });
    process.env.LLM_DISABLE_COMPACT = 'ON';
    await assert.rejects(agent.compactContext(), /LLM_DISABLE_COMPACT/);
    assert.equal(f.requests.length, 3);
    process.env.LLM_DISABLE_COMPACT = '0';
    const controller = new AbortController(); controller.abort();
    await assert.rejects(agent.compactContext(controller.signal), { name: 'AbortError' });
    await agent.compactContext(); assert.equal(f.requests.length, 4);
    assertPaired(session.messages);
  } finally { session.close(); restore(); f.close(); }
});
