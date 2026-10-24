import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import type { Terminal } from '@xterm/headless';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { PromptSuggestionRun, normalizePromptSuggestion, promptSuggestionRejection, promptSuggestionWords,
  promptPredictionEligible, promptSuggestionTurnEligible, promptSuggestionBackedOff, promptSuggestionsInitiallyEnabled } from '../src/prompt-suggestions.js';
import { PromptSuggestionStore } from '../src/prompt-suggestion-store.js';
import { publishPromptSuggestion } from '../src/prompt-suggestion-publish.js';
import { TuiTerminal } from '../src/tui.js';
import { interactiveLoop } from '../src/interactive.js';
import { configPanelInput } from '../src/config-panel-input.js';
import { ConfigPanel } from '../src/config-panel.js';
import { loadProjectConfig } from '../src/config.js';
import { saveConfigPanelSetting } from '../src/theme-settings.js';
import { reloadConfig } from '../src/reload.js';
import { parseSettings, type Runtime } from '../src/runtime.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'prompt-suggestions-test-')));
const response = (text: string): Anthropic.Message => ({ id: 'owned-prediction', model: 'fixture', type: 'message', role: 'assistant',
  content: [{ type: 'text', text, citations: null }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 500, output_tokens: 20 } } as Anthropic.Message);
const until = async (check: () => boolean) => { const end = Date.now() + 5000;
  while (!check()) { assert.ok(Date.now() < end, 'owned prompt lifecycle settles'); await delay(10); } };
function terminal(userDir: string) {
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode() {} });
  const screen = new HeadlessTerminal({ cols: 100, rows: 30, allowProposedApi: true, logLevel: 'off' });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) {
    const core = Reflect.get(screen, '_core'); Reflect.apply(Reflect.get(core, 'writeSync'), core, [String(chunk)]); done();
  } }), { isTTY: true, columns: 100, rows: 30 });
  const tui = new TuiTerminal({ input, output, userDir, prefersReducedMotion: true }).start();
  const key = (value: string) => input.emit('data', value);
  const frame = () => Array.from({ length: 30 }, (_, row) => screen.buffer.active.getLine(row)?.translateToString(true) ?? '').join('\n');
  return { input, output, tui, key, frame, close() { tui.close(); screen.dispose(); } };
}

test('prediction preserves source filter, cache gate, isolated context and persistent backoff', async () => {
  const root = temporary(), userDir = path.join(root, 'user'); fs.mkdirSync(userDir);
  const prior = process.env.HARNESS_PROMPT_SUGGESTIONS; delete process.env.HARNESS_PROMPT_SUGGESTIONS;
  const config = defaultConfig(root, []); config.model = 'fixture';
  const session = Session.open(root, { config }), requests: ModelRequest[] = [];
  let candidate = '<suggestion>run the tests</suggestion>';
  const provider: ModelProvider = { count: async () => 0, complete: async request => { requests.push(request); return response(candidate); } };
  try {
    const agent = new Agent(session, provider, []), signal = new AbortController().signal;
    assert.equal(await agent.predictPrompt(signal), undefined);
    for (const text of ['one', 'two']) {
      session.append({ kind: 'message', message: { role: 'user', content: text } });
      const reply = response(text); session.append({ kind: 'message', message: { role: 'assistant', content: reply.content }, response: reply });
      session.append({ kind: 'turn_end', reason: 'end_turn' });
    }
    const before = JSON.stringify(session.events);
    assert.deepEqual(await agent.predictPrompt(signal), { text: 'run the tests', generationRequestId: 'owned-prediction' });
    assert.equal(JSON.stringify(session.events), before); assert.equal(requests.length, 1);
    assert.equal(requests[0]?.model, 'fixture'); assert.deepEqual(requests[0]?.tools, []);
    assert.deepEqual(requests[0]?.tool_choice, { type: 'none' });
    assert.deepEqual(requests[0]?.messages.slice(0, -1), session.messages);
    candidate = 'Let me run the tests'; assert.equal(await agent.predictPrompt(signal), undefined);
    assert.equal(normalizePromptSuggestion('建议：运行测试'), '运行测试');
    assert.equal(normalizePromptSuggestion('<output>go</output></output>'), '<output>go</output></output>');
    for (const text of ['运行测试', 'テストを実行', '테스트 실행', '/help', 'continue', '!npm test']) assert.equal(promptSuggestionRejection(text), undefined, text);
    for (const text of ['done', 'nothing to suggest', '完成了', '(run tests)', 'hello', 'thanks', 'Let me test', 'Run tests. Then commit', 'run\ntests', '太好了', '看起来不错！', 'いいですね。', 'x'.repeat(100)])
      assert.notEqual(promptSuggestionRejection(text), undefined, text);
    assert.equal(promptSuggestionWords('运行测试'), 2);
    const hot = response('tail'); hot.usage.cache_read_input_tokens = 900000;
    assert.equal(promptPredictionEligible(session.messages, hot), true);
    hot.usage.input_tokens = 10000; assert.equal(promptPredictionEligible(session.messages, hot), false);
    hot.usage.input_tokens = 1; hot.usage.cache_creation_input_tokens = 10000; assert.equal(promptPredictionEligible(session.messages, hot), false);
    assert.equal(promptSuggestionsInitiallyEnabled(config), false);
    config.features = { tasks: true, subagents: true, promptSuggestions: true };
    assert.equal(promptSuggestionsInitiallyEnabled(config), true);
    process.env.HARNESS_PROMPT_SUGGESTIONS = 'off'; assert.equal(promptSuggestionsInitiallyEnabled(config), false);
    process.env.HARNESS_PROMPT_SUGGESTIONS = 'on'; config.promptSuggestionEnabled = false;
    assert.equal(promptSuggestionsInitiallyEnabled(config), true);
    const livePanel = new ConfigPanel(configPanelInput(config, undefined, false)); livePanel.focusRow('promptSuggestionEnabled');
    assert.deepEqual(livePanel.activate(), { kind: 'change', update: { id: 'promptSuggestionEnabled', value: true } });
    delete process.env.HARNESS_PROMPT_SUGGESTIONS;
    const store = new PromptSuggestionStore(userDir), run = new PromptSuggestionRun();
    fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ preserved: 7, firstStartTime: '2020-01-01' }));
    for (let index = 0; index < 20; index++) await store.outcome(false, run);
    assert.equal(store.read().promptSuggestionUnusedStreak, 20); assert.equal(store.read().preserved, 7);
    assert.equal(promptSuggestionBackedOff(store.read()), true);
    assert.equal(promptSuggestionBackedOff({ promptSuggestionUnusedStreak: 20, firstStartTime: 'invalid-date' }), true);
    assert.equal(promptSuggestionBackedOff({ promptSuggestionUnusedStreak: 20, firstStartTime: new Date().toISOString() }), false);
    assert.equal(await store.claimNotice(), true); assert.equal(await store.claimNotice(), false);
    assert.deepEqual(Array.from({ length: 12 }, () => promptSuggestionTurnEligible(run, true)), [true, false, false, false, false, false, false, false, false, false, true, false]);
    await store.outcome(true, run); assert.equal(store.read().promptSuggestionUnusedStreak, 0);
    await saveConfigPanelSetting({ id: 'promptSuggestionEnabled', value: false }, root, userDir);
    assert.equal(JSON.parse(fs.readFileSync(path.join(userDir, 'settings.json'), 'utf8')).promptSuggestionEnabled, false);
    fs.mkdirSync(path.join(root, '.harness'), { recursive: true });
    fs.writeFileSync(path.join(root, '.harness', 'settings.json'), JSON.stringify({ promptSuggestionEnabled: 'invalid' }));
    assert.equal(loadProjectConfig(root, { userDir, paths: [], pluginHooks: 'preview' }).settings.promptSuggestionEnabled, false);
    await saveConfigPanelSetting({ id: 'promptSuggestionEnabled', value: true }, root, userDir);
    assert.equal('promptSuggestionEnabled' in JSON.parse(fs.readFileSync(path.join(userDir, 'settings.json'), 'utf8')), false);
    assert.equal(parseSettings({ features: { promptSuggestions: true } }).features?.promptSuggestions, true);
    config.configSources = { userDir }; config.promptSuggestionEnabled = false;
    assert.equal(reloadConfig(config, 'preview').promptSuggestionEnabled, undefined);
    assert.equal(configPanelInput(config).hidden.includes('promptSuggestionEnabled'), false);
    const panel = new ConfigPanel(configPanelInput(config)); panel.focusRow('promptSuggestionEnabled');
    assert.deepEqual(panel.activate(), { kind: 'change', update: { id: 'promptSuggestionEnabled', value: true } });
    config.features.promptSuggestions = false;
    assert.equal(configPanelInput(config).hidden.includes('promptSuggestionEnabled'), true);
  } finally {
    if (prior === undefined) delete process.env.HARNESS_PROMPT_SUGGESTIONS; else process.env.HARNESS_PROMPT_SUGGESTIONS = prior;
    session.close(); fs.rmSync(root, { recursive: true, force: true });
  }
});

test('native composer paints ghost text and adopts Right/Tab without surrendering input ownership', async () => {
  const root = temporary(), f = terminal(root), submitted: string[] = [], outcomes: boolean[] = [];
  let changed = 0;
  f.tui.subscribe({ onSubmit: text => submitted.push(text), onComposerChanged: () => changed++, onSuggestionOutcome: accepted => outcomes.push(accepted) });
  try {
    const published = await publishPromptSuggestion('run the tests', new AbortController().signal,
      text => f.tui.proposePromptSuggestion({ text, generationRequestId: 'owned-chain' }));
    assert.deepEqual(published, { isShown: true });
    assert.equal(f.tui.proposePromptSuggestion({ text: 'run the tests', generationRequestId: null }).isShown, true);
    assert.match(f.frame(), /run the tests/); assert.equal(f.tui.state.text, '');
    f.key('\x1b[C'); assert.equal(f.tui.state.text, 'run the tests'); assert.deepEqual(submitted, []);
    f.key(' now\r'); assert.deepEqual(submitted, ['run the tests now']); assert.deepEqual(outcomes, [true]);
    f.tui.proposePromptSuggestion({ text: '!npm test', generationRequestId: null }); f.key('\t');
    assert.equal(f.tui.state.text, 'npm test'); assert.match(f.frame(), /shell mode/); assert.equal(submitted.length, 1);
    f.key('\r'); assert.equal(submitted.at(-1), 'npm test');
    f.tui.proposePromptSuggestion({ text: 'run the tests', generationRequestId: null }); f.key('RUN THE TESTS\r'); assert.equal(outcomes.at(-1), true);
    f.tui.proposePromptSuggestion({ text: 'run the tests', generationRequestId: null }); f.key('different request\r'); assert.equal(outcomes.at(-1), false);
    const count = submitted.length, dialog = f.tui.prompt({ title: 'OWNED_FORM', message: '', allowText: true }, new AbortController().signal);
    assert.equal(f.tui.proposePromptSuggestion({ text: 'run the tests', generationRequestId: null }).isShown, false);
    f.key('answer\r'); assert.equal((await dialog)?.text, 'answer'); assert.equal(submitted.length, count);
    f.tui.proposePromptSuggestion({ text: 'run the tests', generationRequestId: 'before-child' });
    const beforeChildOutcomes = outcomes.length, childInputs: string[] = [];
    f.tui.viewAgent({ read: () => ({ id: 'child', name: 'child', status: 'completed', model: 'fixture', records: [], inProgressToolUseIDs: [] }),
      submit: async text => { childInputs.push(text); return 'child'; }, escape() {}, release() {} });
    f.key('different child work\r'); await until(() => f.tui.state.text === ''); f.tui.clearAgentView();
    assert.deepEqual(childInputs, ['different child work']); assert.equal(submitted.length, count);
    assert.deepEqual(outcomes.slice(beforeChildOutcomes), [false]); assert.doesNotMatch(f.frame(), /^❯[ \t ]*run the tests/m);
    f.key('\x1b[C'); assert.equal(f.tui.state.text, '');
    f.key('/mod'); f.key('\t'); assert.match(f.tui.state.text, /^\/model/); f.key('\x05\x15');
    f.key('\x1b[O'); assert.equal(f.tui.promptSuggestionAvailable(), false); f.key('\x1b[I');
    f.tui.bindPromptQueue({ snapshot: () => ['queued'], pop: () => undefined, popAll: () => undefined });
    assert.equal(f.tui.proposePromptSuggestion({ text: 'run the tests', generationRequestId: null }).isShown, false);
    assert.ok(changed > 0);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(publishPromptSuggestion('late text', controller.signal, () => { throw new Error('stale core'); }));
  } finally { f.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('interactive prediction cancels on edits, new turns, session handoff and exit without journal pollution', async () => {
  const root = temporary(), userDir = path.join(root, 'user'); fs.mkdirSync(userDir);
  const f = terminal(userDir), config = defaultConfig(root, []);
  config.model = 'fixture'; config.features = { tasks: false, subagents: false, promptSuggestions: true }; config.configSources = { userDir };
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ promptSuggestionUnusedStreak: 20, firstStartTime: '2020-01-01' }));
  const session = Session.open(root, { config }), requests: ModelRequest[] = [], predictionSignals: AbortSignal[] = [];
  const releases: (() => void)[] = [];
  const provider: ModelProvider = { count: async () => 0, complete: async (request, signal, onText) => {
    requests.push(request);
    if (JSON.stringify(request.messages.at(-1)?.content).includes('[SUGGESTION MODE:')) {
      predictionSignals.push(signal);
      await new Promise<void>(resolve => { releases.push(resolve); signal.addEventListener('abort', () => resolve(), { once: true }); });
      return response('stale suggestion');
    }
    onText?.('owned response'); return response('owned response');
  } };
  const runtime: Runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  const status = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const loop = interactiveLoop(session, provider, runtime, { input: f.input, output: f.output, status, terminal: f.tui, signal: new AbortController().signal });
  try {
    f.key('first\r'); await until(() => session.events.some(event => event.kind === 'turn_end'));
    f.key('second\r'); await until(() => predictionSignals.length === 1);
    f.key('typed draft'); await until(() => predictionSignals[0]!.aborted);
    releases.shift()?.(); await delay(0); assert.equal(f.tui.state.text, 'typed draft'); assert.doesNotMatch(f.frame(), /stale suggestion/);
    await new PromptSuggestionStore(userDir).enable(new PromptSuggestionRun());
    f.key('\x05\x15third\r'); await until(() => predictionSignals.length === 2);
    f.key('\x05\x15/clear\r'); await until(() => predictionSignals[1]!.aborted);
    releases.shift()?.(); await delay(0); assert.doesNotMatch(f.frame(), /stale suggestion/);
    f.key('/exit\r'); await loop;
    assert.equal(fs.readdirSync(path.join(root, '.agent')).some(name => name.endsWith('.lock')), false);
    for (const name of fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl')))
      assert.doesNotMatch(fs.readFileSync(path.join(root, '.agent', name), 'utf8'), /SUGGESTION MODE|stale suggestion/);
  } finally { f.tui.close(); await loop; f.close(); session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
