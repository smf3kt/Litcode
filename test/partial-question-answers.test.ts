import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import type Anthropic from '@anthropic-ai/sdk';
import { createInteractionTools, type AskUserQuestionAnswer } from '../src/interaction-tools.js';
import { createRuntime, parseSettings, pinToolSchemas } from '../src/runtime.js';
import { reloadConfig } from '../src/reload.js';
import { Session, managedPolicySchema } from '../src/session.js';
import { TuiTerminal } from '../src/tui.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolContext } from '../src/tools.js';

const request = { questions: [
  { question: 'Layout?', multiSelect: false, options: [{ label: 'A', description: 'First', preview: 'Preview A' }, { label: 'B', description: 'Second' }] },
  { question: 'Tags?', multiSelect: true, options: [{ label: 'X', description: 'First tag' }, { label: 'Y', description: 'Second tag' }] },
] };
const context = (workspace = '/unused'): ToolContext => ({ workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 });
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'partial-answers-test-')));
const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('No model request expected'); } };

function tools(answer: AskUserQuestionAnswer, partialAnswers?: boolean) {
  const all = createInteractionTools({ ask: async () => answer, partialAnswers });
  const ask = all.find(tool => tool.schema.name === 'ask_user_question'); assert.ok(ask);
  return { all, execute: () => ask.execute(structuredClone(request), context()) };
}

test('source partial and AFK answers admit empty maps while preserving legacy and finite shown-field checks', async () => {
  const partial: AskUserQuestionAnswer = { answers: [{ questionIndex: 1, selected: ['Y'], other: 'extra' }] };
  for (const answer of [partial, { answers: [] }, { answers: [{ questionIndex: 0, selected: [], annotations: { notes: 'note' } }] }] satisfies AskUserQuestionAnswer[]) {
    assert.deepEqual(JSON.parse(await tools(answer, true).execute()), answer);
    for (const legacy of [undefined, false]) await assert.rejects(tools(answer, legacy).execute());
  }
  for (const answers of [[], [{ questionIndex: 0, selected: ['B'] }]]) {
    const result = JSON.parse(await tools({ answers, afkTimeoutMs: 60000 }, true).execute());
    assert.deepEqual(result.answers, answers);
    assert.equal(result.afkTimeoutMs, 60000);
    assert.match(result.notice, /^No response after 60s/);
    assert.equal(result.notice.includes('Before going idle'), answers.length > 0);
  }
  for (const answer of [
    { answers: [{ questionIndex: 0, selected: ['A', 'B'] }] },
    { answers: [{ questionIndex: 1, selected: ['Z'] }] },
    { answers: [{ questionIndex: 2, selected: [] }] },
    { answers: [{ questionIndex: 0, selected: [] }, { questionIndex: 0, selected: [] }] },
    { answers: [{ questionIndex: 0, selected: [], annotations: { preview: 'foreign' } }] },
    { answers: [], afkTimeoutMs: 0 },
  ]) await assert.rejects(tools(answer, true).execute());
  const image = { type: 'image', source: { type: 'base64', media_type: 'image/png',
    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PzWvWQAAAABJRU5ErkJggg==' } };
  for (const afkTimeoutMs of [undefined, 60000]) {
    const answer = { answers: [], contentBlocks: [image], ...(afkTimeoutMs === undefined ? {} : { afkTimeoutMs }) };
    const ask = tools(answer, true).all.find(tool => tool.schema.name === 'ask_user_question'); assert.ok(ask?.executeBlocks);
    const blocks = await ask.executeBlocks(request, context()); assert.ok(Array.isArray(blocks));
    assert.equal(blocks[0]?.type, 'text');
    if (blocks[0]?.type === 'text') {
      const value = JSON.parse(blocks[0].text);
      assert.deepEqual(value.answers, []);
      assert.equal(value.contentBlocks, undefined);
      assert.equal(value.afkTimeoutMs, afkTimeoutMs);
    }
    assert.deepEqual(blocks.slice(1), [image]);
  }
  assert.deepEqual(tools(partial, true).all.map(tool => tool.schema), tools(partial, false).all.map(tool => tool.schema));
});

test('source AFK projects uncommitted notes and clears its per-dialog state while legacy retains taken groups only', async testContext => {
  testContext.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    for (const partialAnswers of [true, false]) {
      let release: (value: AskUserQuestionAnswer) => void = () => assert.fail('host not started');
      const host = new Promise<AskUserQuestionAnswer>(resolve => { release = resolve; });
      let timedOut = false;
      const controller = new AbortController();
      const ask = createInteractionTools({ partialAnswers, ask: async () => host }).find(tool => tool.schema.name === 'ask_user_question'); assert.ok(ask);
      const pending = ask.execute(request, { ...context(), signal: controller.signal });
      const observed = pending.catch(error => { assert.equal(error.name, partialAnswers ? 'AbortError' : 'TimeoutError'); timedOut = true; });
      await Promise.resolve(); await Promise.resolve();
      testContext.mock.timers.tick(600001);
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.equal(timedOut, !partialAnswers);
      if (partialAnswers) controller.abort();
      await observed; release({ answers: [] });
      await Promise.resolve(); await Promise.resolve();
    }
    const ask = createInteractionTools({ partialAnswers: true, timeoutMs: 20,
      ask: async () => new Promise(() => {}) }).find(tool => tool.schema.name === 'ask_user_question'); assert.ok(ask);
    const pending = ask.execute(request, context());
    const rejected = assert.rejects(pending, { name: 'TimeoutError' });
    testContext.mock.timers.tick(20); await rejected;
  } finally { testContext.mock.timers.reset(); }
  const input = new PassThrough();
  Object.assign(input, { isTTY: true, setRawMode() {} });
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 100, rows: 30 });
  const tui = new TuiTerminal({ input, output }).start();
  const groups = request.questions.map(question => ({ key: question.question, message: question.question,
    choices: question.options.map(option => ({ ...option, value: option.label })), allowText: true, multiple: question.multiSelect }));
  try {
    for (const partialAnswers of [true, false]) {
      const pending = tui.prompt({ message: '', groups, partialAnswers, afkTimeoutMs: 20 }, new AbortController().signal);
      input.emit('data', 'n'); input.emit('data', 'live notes'); input.emit('data', '\x1b'); await delay(80);
      input.emit('data', '\x1b[O');
      const answer = await pending;
      assert.equal(answer?.afkTimeoutMs, 20);
      assert.deepEqual(answer.groups, partialAnswers ? [
        { key: 'Layout?', selected: [], notes: 'live notes' }, { key: 'Tags?', selected: [] },
      ] : []);
    }
    const pending = tui.prompt({ message: '', groups, partialAnswers: true, afkTimeoutMs: 20 }, new AbortController().signal);
    input.emit('data', '\x1b[O');
    assert.deepEqual((await pending)?.groups, [{ key: 'Layout?', selected: [] }, { key: 'Tags?', selected: [] }]);
  } finally { tui.close(); }
});

test('partial-answer version stays pinned across original Runtime resume and changes only on explicit reload or managed choice', async () => {
  const workspace = temporary(), userDir = path.join(workspace, 'user'); fs.mkdirSync(userDir);
  const settingsFile = path.join(userDir, 'settings.json'), managedSettingsFile = path.join(workspace, 'managed.json');
  fs.writeFileSync(managedSettingsFile, '{}');
  try {
    assert.equal(parseSettings({ features: { questionPartialAnswers: false } }).features?.questionPartialAnswers, false);
    assert.throws(() => parseSettings({ features: { questionPartialAnswers: 'true' } }));
    assert.equal(managedPolicySchema.parse({ features: { questionPartialAnswers: false } }).features?.questionPartialAnswers, false);
    for (const selected of [undefined, false, true]) {
      const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir, managedSettingsFile },
        features: { tasks: false, subagents: false, interaction: true, ...(selected === undefined ? {} : { questionPartialAnswers: selected }) } };
      let runtime = await createRuntime(config, provider, new AbortController().signal);
      config.tools = pinToolSchemas(runtime.tools);
      let session = Session.open(workspace, { config });
      try {
        await runtime.bindSession!(session);
        const original = fs.readFileSync(session.file), id = session.id;
        await runtime.close(); session.close();
        fs.writeFileSync(settingsFile, JSON.stringify({ features: { questionPartialAnswers: true } }));
        session = Session.open(workspace, { id });
        runtime = await createRuntime(session.config, provider, new AbortController().signal);
        await runtime.bindSession!(session);
        const ask = runtime.buildTools(session.config, session.id).find(tool => tool.schema.name === 'ask_user_question'); assert.ok(ask);
        const result = ask.execute(request, { ...context(workspace), interaction: { ask: async () => ({ answers: [] }) } });
        if (selected === true) assert.deepEqual(JSON.parse(await result), { answers: [] });
        else await assert.rejects(result);
        assert.deepEqual(fs.readFileSync(session.file), original);
        assert.equal(reloadConfig(session.config).features?.questionPartialAnswers, true);
        fs.writeFileSync(managedSettingsFile, JSON.stringify({ features: { questionPartialAnswers: false } }));
        assert.equal(reloadConfig(session.config).features?.questionPartialAnswers, false);
        fs.writeFileSync(managedSettingsFile, '{}');
        fs.writeFileSync(settingsFile, JSON.stringify({ features: { questionPartialAnswers: false } }));
        assert.equal(reloadConfig(session.config).features?.questionPartialAnswers, false);
      } finally { await runtime.close(); session.close(); }
    }
    for (const partialAnswers of [false, true]) {
      const toolset = createInteractionTools({ partialAnswers });
      const config = defaultConfig(workspace, toolset);
      config.model = 'fixture';
      config.features = { tasks: false, subagents: false, interaction: true, questionPartialAnswers: partialAnswers };
      const session = Session.open(workspace, { config }), input = new PassThrough();
      let text = '', prompts = 0, turns = 0;
      const output = new Writable({ write(chunk, _encoding, done) {
        text += String(chunk);
        const count = text.split('or Other text:').length - 1;
        while (prompts < count) { prompts++; setImmediate(() => input.write(prompts === 1 ? '1\n' : '\n')); }
        done();
      } });
      const model: ModelProvider = { count: async () => 0, complete: async modelRequest => {
        turns++;
        if (turns === 1) return { id: 'partial', type: 'message', role: 'assistant', model: 'fixture',
          content: [{ type: 'tool_use', id: 'question', name: 'ask_user_question', input: request }],
          stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
        const content = modelRequest.messages.at(-1)?.content;
        assert.ok(Array.isArray(content));
        const result = content.find(block => block.type === 'tool_result'); assert.ok(result);
        if (partialAnswers) {
          assert.equal(result.is_error ?? false, false);
          assert.equal(typeof result.content, 'string');
          assert.deepEqual(JSON.parse(String(result.content)), { answers: [{ questionIndex: 0, selected: ['A'] }] });
        } else assert.equal(result.is_error, true);
        setImmediate(() => input.write('/exit\n'));
        return { id: 'done', type: 'message', role: 'assistant', model: 'fixture', content: [{ type: 'text', text: 'done' }],
          stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
      } };
      try {
        const running = interactiveLoop(session, model, { tools: toolset, buildTools: () => toolset, close: async () => {}, limits: [] },
          { input, output, status: new Writable({ write(_chunk, _encoding, done) { done(); } }), signal: new AbortController().signal });
        input.write('question\n'); await running;
        assert.equal(turns, 2);
      } finally { input.destroy(); session.close(); }
    }
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
