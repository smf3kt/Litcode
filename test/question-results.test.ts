import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig, assertPaired } from '../src/agent.js';
import { createInteractionTools, type AskUserQuestionAnswer, type InteractionCallbacks, type InteractionToolOptions } from '../src/interaction-tools.js';
import { cardQuestionResult, questionHostResultSchema, questionResultText, questionResultLines } from '../src/question-result.js';
import { createRuntime, parseSettings, pinToolSchemas } from '../src/runtime.js';
import { reloadConfig } from '../src/reload.js';
import { Session, managedPolicySchema, type SessionConfig } from '../src/session.js';
import { agentTranscriptEntries, transcriptEvent } from '../src/agent-transcript.js';
import { TuiDocumentRenderer } from '../src/tui-document-renderer.js';
import { QuestionResultRows } from '../src/tui-question-result.js';
import { jsx } from '../src/tui-jsx.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolContext } from '../src/tools.js';
import type { ToolDisplayResult } from '../src/tui-tool-result.js';

const request = { questions: [
  { question: 'Layout?', multiSelect: false, options: [{ label: 'A', description: 'First', preview: 'Preview A' }, { label: 'B', description: 'Second' }] },
  { question: 'Tags?', multiSelect: true, options: [{ label: 'X', description: 'First tag' }, { label: 'Y, Z', description: 'Combined tag' }, { label: '"Q"', description: 'Quoted tag' }] },
] };
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'question-results-test-')));
const context = (): ToolContext => ({ workspace: '/unused', signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 });
const tool = (options: InteractionToolOptions = {}) => {
  const ask = createInteractionTools(options).find(tool => tool.schema.name === 'ask_user_question'); assert.ok(ask); return ask;
};
const answered = 'Your questions have been answered: "Layout?"="A". You can now continue with these answers in mind.';
const cautious = (answers: string) => `The user answered: ${answers}. Read the answers carefully — they may request clarification, changes, or that you not proceed — and follow what they actually say.`;
const absent = 'The user did not answer the questions.';

function reply(content: Anthropic.ContentBlock[], stop: 'tool_use' | 'end_turn'): Anthropic.Message {
  return { id: 'fixture', model: 'fixture', role: 'assistant', type: 'message', content, stop_reason: stop,
    stop_sequence: null, container: null, diagnostics: null, stop_details: null,
    usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
}

test('source question results carry complete admitted host data with model steering, images and failure boundaries', async () => {
  const fixtures: Array<{ answer: AskUserQuestionAnswer; text: string; answers: Record<string, string> }> = [
    { answer: { answers: [{ questionIndex: 0, selected: ['A'] }] }, text: answered, answers: { 'Layout?': 'A' } },
    { answer: { answers: [] }, text: absent, answers: {} },
    { answer: { answers: [{ questionIndex: 0, selected: [], other: 'Wait for my review' }] },
      text: cautious('"Layout?"="Wait for my review"'), answers: { 'Layout?': 'Wait for my review' } },
    { answer: { answers: [{ questionIndex: 0, selected: [], annotations: { notes: 'Keep this open' } }] },
      text: cautious('"Layout?"=(no option selected) notes: Keep this open'), answers: {} },
    { answer: { answers: [{ questionIndex: 1, selected: ['Y, Z', '"Q"'] }] },
      text: 'Your questions have been answered: "Tags?"=""Y, Z", "\\"Q\\""". You can now continue with these answers in mind.',
      answers: { 'Tags?': '"Y, Z", "\\"Q\\""' } },
  ];
  for (const fixture of fixtures) {
    const hosts: unknown[] = [];
    const result = await tool({ sourceQuestionResults: true, partialAnswers: true, ask: async () => fixture.answer })
      .execute(structuredClone(request), { ...context(), hostResult: host => hosts.push(host) });
    assert.equal(result, fixture.text);
    const annotations = Object.fromEntries(fixture.answer.answers.flatMap(entry => entry.annotations
      ? [[request.questions[entry.questionIndex]!.question, entry.annotations]] : []));
    assert.deepEqual(JSON.parse(JSON.stringify(hosts)), [{ kind: 'questions', questions: request.questions, answers: fixture.answers, annotations }]);
  }
  const selected = { answers: [{ questionIndex: 0, selected: ['A'] }] };
  for (const version of [undefined, false]) {
    const hosts: unknown[] = [];
    assert.deepEqual(JSON.parse(await tool({ sourceQuestionResults: version, partialAnswers: true, ask: async () => selected })
      .execute(request, { ...context(), hostResult: host => hosts.push(host) })), selected);
    assert.deepEqual(hosts, []);
  }
  const card = (response: unknown) => tool({ sourceQuestionResults: true, cardAnswers: true, extendedQuestions: true,
    askCard: async () => response });
  assert.equal(await card({}).execute(request, context()), absent);
  assert.equal(await card({ response: '  later  ' }).execute(request, context()), 'The user responded:   later  ');
  assert.equal(await card({ response: '  ', followUp: false }).execute(request, context()), absent);
  assert.equal(await card({ followUp: true }).execute(request, context()),
    'The user asked for more questions before answering. Call ask_user_question again now with further questions about this decision (do not repeat these); do not proceed with the task yet.');
  assert.equal(await card({ answers: { 'Layout?': 'A' }, response: 'Explain the tradeoff', followUp: true }).execute(request, context()),
    'The user asked for more questions before you proceed. So far they answered: "Layout?"="A". They also wrote: "Explain the tradeoff". Call ask_user_question again with follow-up questions that build on these answers (do not repeat these); do not start the task yet.');
  assert.equal(await card({ answers: { 'Tags?': ['Y, Z', '"Q"'] } }).execute(request, context()), fixtures[4]!.text);
  const keyed = { questions: ['__proto__', 'constructor', 'toString'].map(question => ({ ...request.questions[0]!, question })) };
  const keyedAnswers = Object.fromEntries(keyed.questions.map(question => [question.question, 'A']));
  const keyedNotes = Object.fromEntries(keyed.questions.map(question => [question.question, { notes: 'Please wait for review' }]));
  const keyedHosts: unknown[] = [];
  assert.equal(await card({ answers: keyedAnswers, annotations: keyedNotes }).execute(keyed, { ...context(), hostResult: host => keyedHosts.push(host) }),
    cautious('"__proto__"="A" notes: Please wait for review, "constructor"="A" notes: Please wait for review, "toString"="A" notes: Please wait for review'));
  assert.deepEqual(JSON.parse(JSON.stringify(keyedHosts[0])).answers, keyedAnswers);
  assert.deepEqual(JSON.parse(JSON.stringify(keyedHosts[0])).annotations, keyedNotes);
  assert.equal(await card({}).execute(keyed, context()), absent);
  for (const value of [new Date(0), new Map(), new Set(), Object.create({ inherited: 'A' })]) {
    assert.equal(questionHostResultSchema.safeParse({ kind: 'questions', questions: keyed.questions, answers: value }).success, false);
    assert.equal(questionHostResultSchema.safeParse({ kind: 'questions', questions: keyed.questions, answers: {}, annotations: value }).success, false);
  }
  assert.throws(() => questionHostResultSchema.parse({ kind: 'questions', questions: keyed.questions, answers: { 'Layout?': 1 } }));
  const number = { title: 'Count', questions: [{ question: 'Count?', kind: 'number', min: 0, max: 10, step: 2 }] };
  for (const value of ['3', '11', '3e0']) assert.equal(await card({ answers: { 'Count?': value } }).execute(number, context()),
    value === '3' ? 'Your questions have been answered: "Count?"="3". You can now continue with these answers in mind.' : cautious(`"Count?"="${value}"`));
  assert.equal(await card({ answers: { 'Text?': 'A' } }).execute({ questions: [{ question: 'Text?', kind: 'text' }] }, context()), cautious('"Text?"="A"'));
  assert.deepEqual(cardQuestionResult({ title: 'discard', questions: [{ question: 'Q?' }], followUp: false, response: '  ' }),
    { kind: 'questions', questions: [{ question: 'Q?', options: [] }], answers: Object.create(null) });
  const parsedKeys = questionHostResultSchema.parse({ kind: 'questions', questions: keyed.questions, answers: keyedAnswers, annotations: keyedNotes });
  assert.equal(Object.getPrototypeOf(parsedKeys.answers), null);
  assert.equal(Object.getPrototypeOf(parsedKeys.annotations), null);
  assert.deepEqual(JSON.parse(JSON.stringify(parsedKeys.answers)), keyedAnswers);
  assert.deepEqual(JSON.parse(JSON.stringify(parsedKeys.annotations)), keyedNotes);
  const priority = cardQuestionResult({ questions: request.questions, answers: { 'Layout?': 'A' }, response: 'later', followUp: true, afkTimeoutMs: 1500 });
  assert.equal(questionResultText(priority), 'No response after 2s — the user may be away from keyboard. Proceed using your best judgment based on the context so far; you can re-ask this question later if it\'s still relevant.\n\nBefore going idle the user had selected: "Layout?"="A".');
  const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PzWvWQAAAABJRU5ErkJggg==' } };
  const hosts: unknown[] = [], hostContext = { ...context(), hostResult: (host: unknown) => hosts.push(host) };
  const images = tool({ sourceQuestionResults: true, partialAnswers: true, ask: async () => ({ answers: [], contentBlocks: [image] }) });
  assert.ok(images.executeBlocks);
  assert.deepEqual(await images.executeBlocks(request, hostContext), [{ type: 'text', text: absent }, image]);
  assert.equal(JSON.stringify(hosts).includes(image.source.data), false);
  hosts.length = 0;
  await assert.rejects(tool({ sourceQuestionResults: true, partialAnswers: true, ask: async () => selected })
    .execute(request, { ...hostContext, maxOutputBytes: 1 }), /output byte limit/);
  await assert.rejects(tool({ sourceQuestionResults: true, partialAnswers: true, ask: async () => ({ answers: [], contentBlocks: [{ type: 'image' }] }) })
    .execute(request, hostContext), /content block is not a valid image or text block/);
  await assert.rejects(card({ answers: { unknown: 'A' } }).execute(request, hostContext), /card answer refused/);
  const controller = new AbortController();
  await assert.rejects(tool({ sourceQuestionResults: true, partialAnswers: true, ask: async () => { controller.abort(); return selected; } })
    .execute(request, { ...hostContext, signal: controller.signal }), { name: 'AbortError' });
  assert.deepEqual(hosts, []);
});

test('source question rows retain response and AFK conditions through native width and theme transitions', () => {
  const base = { kind: 'questions' as const, questions: request.questions, answers: { 'Layout?': 'A' }, annotations: {} };
  assert.deepEqual(questionResultLines(base), ['User answered questions:', '· Layout? → A']);
  assert.deepEqual(questionResultLines({ ...base, response: 'Please wait' }), ['User answered questions:', '· Please wait']);
  assert.deepEqual(questionResultLines({ ...base, followUp: true, response: 'Explain first' }),
    ['User asked for more questions (so far):', '· Layout? → A', '· Explain first']);
  assert.deepEqual(questionResultLines({ ...base, answers: {}, followUp: true }), ['User asked for more questions']);
  assert.deepEqual(questionResultLines({ ...base, answers: {} }), []);
  assert.deepEqual(questionResultLines({ ...base, afkTimeoutMs: 60000 }),
    ['Questions asked:', '· Layout? → A', 'No response after 60s — continued with the answers selected so far']);
  assert.deepEqual(questionResultLines({ ...base, answers: {}, afkTimeoutMs: 60000 }),
    ['Questions asked:', '· Layout? (A / B)', '· Tags? (X / Y, Z / "Q")', 'No response after 60s — continued without an answer']);
  const renderer = new TuiDocumentRenderer();
  try {
    const result = { ...base, response: 'Keep the complete response after terminal resizing and theme changes.' };
    const render = (width: number, theme: 'light-ansi' | 'dark-ansi' = 'light-ansi') =>
      renderer.renderElement(jsx(QuestionResultRows, { result }, undefined), width, { theme });
    const wide = render(120);
    assert.match(wide.map(row => row.text).join('\n'), /User answered questions:/);
    assert.ok(wide.some(row => row.text.includes(result.response)));
    const narrow = render(34).map(row => row.text).join('\n').replace(/\s+/g, ' ');
    assert.ok(narrow.includes(result.response));
    assert.ok(render(60, 'dark-ansi').length > 0);
    assert.deepEqual(render(120), wide);
    assert.deepEqual(renderer.renderElement(jsx(QuestionResultRows, { result: { ...base, answers: {} } }, undefined), 80), []);
  } finally { renderer.close(); }
  assert.equal(renderer.liveNodes, 0);
});

test('source question versions pin original sessions, managed reload and full live or cold child history', async () => {
  const workspace = temporary(), userDir = path.join(workspace, 'user'); fs.mkdirSync(userDir);
  const settingsFile = path.join(userDir, 'settings.json'), managedSettingsFile = path.join(workspace, 'managed.json');
  fs.writeFileSync(managedSettingsFile, '{}');
  const inert: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('Unexpected model call'); } };
  try {
    assert.equal(parseSettings({ features: { sourceQuestionResults: false } }).features?.sourceQuestionResults, false);
    assert.throws(() => parseSettings({ features: { sourceQuestionResults: 'true' } }));
    assert.equal(managedPolicySchema.parse({ features: { sourceQuestionResults: false } }).features?.sourceQuestionResults, false);
    for (const version of [undefined, false, true]) {
      const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir, managedSettingsFile },
        features: { tasks: false, subagents: false, interaction: true, questionPartialAnswers: true,
          ...(version === undefined ? {} : { sourceQuestionResults: version }) } };
      let runtime = await createRuntime(config, inert, new AbortController().signal); config.tools = pinToolSchemas(runtime.tools);
      let session = Session.open(workspace, { config });
      try {
        await runtime.bindSession!(session); const original = fs.readFileSync(session.file), id = session.id;
        await runtime.close(); session.close(); fs.writeFileSync(settingsFile, JSON.stringify({ features: { sourceQuestionResults: true } }));
        session = Session.open(workspace, { id }); runtime = await createRuntime(session.config, inert, new AbortController().signal); await runtime.bindSession!(session);
        const ask = runtime.buildTools(session.config, session.id).find(tool => tool.schema.name === 'ask_user_question'); assert.ok(ask);
        const answer = { answers: [{ questionIndex: 0, selected: ['A'] }] };
        const ctx: ToolContext & { interaction: InteractionCallbacks } = { ...context(), workspace, interaction: { ask: async () => answer } };
        const value = await ask.execute(request, ctx);
        if (version === true) assert.equal(value, answered); else assert.deepEqual(JSON.parse(value), answer);
        assert.deepEqual(fs.readFileSync(session.file), original);
        assert.equal(reloadConfig(session.config).features?.sourceQuestionResults, true);
        fs.writeFileSync(managedSettingsFile, JSON.stringify({ features: { sourceQuestionResults: false } }));
        assert.equal(reloadConfig(session.config).features?.sourceQuestionResults, false); fs.writeFileSync(managedSettingsFile, '{}');
      } finally { await runtime.close(); session.close(); }
    }
    const keyedRequest = { questions: ['__proto__', 'constructor', 'toString'].map(question => ({ ...request.questions[0]!, question })) };
    const keyedExpected = cautious('"__proto__"="A" notes: Please wait for review, "constructor"="A" notes: Please wait for review, "toString"="A" notes: Please wait for review');
    const tools = createInteractionTools({ sourceQuestionResults: true, partialAnswers: true });
    const config: SessionConfig = { ...defaultConfig(workspace, tools), model: 'fixture', childMode: 'general',
      features: { tasks: false, subagents: false, sourceQuestionResults: true },
      permissions: { mode: 'bypass' as const, allow: [], deny: [] } };
    let session = Session.open(workspace, { config }), calls = 0;
    const live: ToolDisplayResult[] = [];
    const model: ModelProvider = { count: async () => 0, complete: async input => {
      if (++calls === 1) return reply([{ type: 'tool_use', id: 'question', name: 'ask_user_question', input: keyedRequest, caller: { type: 'direct' } }], 'tool_use');
      const last = input.messages.at(-1)?.content; assert.ok(Array.isArray(last));
      assert.ok(last[0]?.type === 'tool_result'); assert.equal(last[0].content, keyedExpected);
      return reply([{ type: 'text', text: 'done', citations: null }], 'end_turn');
    } };
    try {
      await new Agent(session, model, tools, { interaction: { ask: async () => ({ answers: keyedRequest.questions.map((_, questionIndex) => ({ questionIndex, selected: ['A'], annotations: { notes: 'Please wait for review' } })) }) },
        toolResult: result => live.push(result) }).run('Answer the local question');
      assertPaired(session.messages); assert.equal(calls, 2);
      const expected = { kind: 'questions', questions: keyedRequest.questions,
        answers: Object.fromEntries(keyedRequest.questions.map(question => [question.question, 'A'])),
        annotations: Object.fromEntries(keyedRequest.questions.map(question => [question.question, { notes: 'Please wait for review' }])) };
      assert.deepEqual(JSON.parse(JSON.stringify(live[0]?.host)), expected);
      const event = session.events.find(event => event.kind === 'tool_result'); assert.ok(event?.kind === 'tool_result');
      assert.deepEqual(JSON.parse(JSON.stringify(event.host)), expected);
      const id = session.id, journal = fs.readFileSync(session.file); session.close(); session = Session.open(workspace, { id });
      assert.deepEqual(fs.readFileSync(session.file), journal);
      const entries = agentTranscriptEntries({ id, name: 'fixture', status: 'completed', model: 'fixture', records: session.events.filter(transcriptEvent), inProgressToolUseIDs: [] });
      const host = entries.find(entry => entry.tool?.id === 'question')?.tool?.host;
      assert.deepEqual(host, expected);
      const parsed = questionHostResultSchema.parse(host); assert.equal(parsed.kind, 'questions');
      assert.deepEqual(Object.keys(parsed.answers), ['__proto__', 'constructor', 'toString']);
      assert.deepEqual(Object.keys(parsed.annotations ?? {}), ['__proto__', 'constructor', 'toString']);
      assert.equal(questionResultText(parsed), keyedExpected);
      assert.equal(questionResultText(questionHostResultSchema.parse({ ...expected, answers: {}, annotations: {} })), absent);
      assert.equal(session.events.some(event => event.kind === 'model_plan_mode'), false);
    } finally { session.close(); }
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
