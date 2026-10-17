import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createInteractionTools, INTERACTION_LIMITS, previewFragmentError,
  type AskUserQuestionAnswer, type AskUserQuestionRequest, type InteractionCallbacks, type InteractionToolOptions,
} from '../src/interaction-tools.js';
import type { ToolContext } from '../src/tools.js';

const question: AskUserQuestionRequest = { questions: [{
  question: 'Which implementation?', header: 'Approach', multiSelect: false,
  options: [{ label: 'A', description: 'First approach' }, { label: 'B', description: 'Second approach' }],
}] };
const answer: AskUserQuestionAnswer = { answers: [{ questionIndex: 0, selected: ['A'] }] };
const findings = { findings: [{ file: 'src/example.ts', line: 7, summary: 'A concrete finding.', severity: 'high' as const }] };
const context = (overrides: Partial<ToolContext> & { interaction?: InteractionCallbacks } = {}): ToolContext => ({
  workspace: '/unused', signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000, ...overrides,
});
function tools(options: InteractionToolOptions = {}) {
  const map = new Map(createInteractionTools(options).map(tool => [tool.schema.name, tool]));
  return (name: string, input: unknown, ctx = context()) => map.get(name)!.execute(input, ctx);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('interaction catalog exposes strict schemas and read-only flags without invoking callbacks', () => {
  const result = createInteractionTools({ ask: async () => { throw new Error('unexpected'); } });
  assert.deepEqual(result.map(tool => [tool.schema.name, tool.readOnly]), [
    ['ask_user_question', true], ['submit_plan', true], ['report_findings', true],
  ]);
  for (const tool of result) assert.equal(tool.schema.input_schema.additionalProperties, false);
});

test('ask delivers full questions and validates single, multiple and Other text answers', async () => {
  const request: AskUserQuestionRequest = { questions: [question.questions[0], { ...question.questions[0], multiSelect: true }] };
  const result: AskUserQuestionAnswer = { answers: [
    { questionIndex: 0, selected: [], other: '  Custom choice\nwith details  ' },
    { questionIndex: 1, selected: ['B', 'A'], other: 'Additional preference' },
  ] };
  const run = tools({ ask: async (received, signal) => {
    assert.deepEqual(received, request);
    assert.equal(signal.aborted, false);
    return result;
  } });
  assert.deepEqual(JSON.parse(await run('ask_user_question', request)), result);
});

test('question previews are advertised, preserved and bounded before host dispatch', async () => {
  const ask = createInteractionTools({ ask: async received => {
    assert.equal(received.questions[0].options[0].preview, '# Layout\n\n- item');
    assert.equal(received.questions[0].options[1].preview, '');
    return answer;
  } }).find(tool => tool.schema.name === 'ask_user_question')!;
  const schema = ask.schema.input_schema as { properties: { questions: { items: { properties: {
    options: { items: { properties: { preview: { type: string; maxLength: number } } } };
  } } } } };
  assert.deepEqual(schema.properties.questions.items.properties.options.items.properties.preview.type, 'string');
  assert.equal(schema.properties.questions.items.properties.options.items.properties.preview.maxLength, INTERACTION_LIMITS.previewChars);
  const request = structuredClone(question);
  request.questions[0].options[0].preview = '# Layout\n\n- item';
  request.questions[0].options[1].preview = '';
  assert.deepEqual(JSON.parse(await ask.execute(request, context())), answer);
  request.questions[0].options[0].preview = 'x'.repeat(INTERACTION_LIMITS.previewChars + 1);
  await assert.rejects(ask.execute(request, context()), /invalid data/);
});

test('the recovered HTML preview fragment rules report exactly the source messages', () => {
  assert.equal(previewFragmentError(undefined), null);
  assert.equal(previewFragmentError('<div><pre>+ add</pre></div>'), null);
  assert.equal(previewFragmentError('plain text without markup'), 'preview must contain HTML (previewFormat is set to "html"). Wrap content in a tag like <div> or <pre>.');
  for (const preview of ['<!DOCTYPE html><p>x</p>', '<html><p>x</p></html>', '<BODY>x</BODY>']) {
    assert.equal(previewFragmentError(preview), 'preview must be an HTML fragment, not a full document (no <html>, <body>, or <!DOCTYPE>)');
  }
  for (const preview of ['<div><script>alert(1)</script></div>', '<STYLE>p{}</STYLE><p>x</p>']) {
    assert.equal(previewFragmentError(preview), 'preview must not contain <script> or <style> tags. Use inline styles via the style attribute if needed.');
  }
});

test('the html preview format rejects invalid fragments before host dispatch', async () => {
  let calls = 0;
  const ask = createInteractionTools({ previewFormat: 'html', ask: async () => { calls++; return answer; } })
    .find(tool => tool.schema.name === 'ask_user_question')!;
  const run = async (preview: string) => {
    const request = structuredClone(question);
    request.questions[0].options[0].preview = preview;
    return ask.execute(request, context());
  };
  await assert.rejects(run('plain text'), /ask_user_question: Option "A" in question "Which implementation\?": preview must contain HTML/);
  await assert.rejects(run('<html><div>x</div></html>'), /preview must be an HTML fragment/);
  await assert.rejects(run('<div><style>p{}</style></div>'), /preview must not contain <script> or <style> tags/);
  assert.equal(calls, 0);
  const result = structuredClone(question);
  result.questions[0].options[0].preview = '<div>Option A layout</div>';
  assert.deepEqual(JSON.parse(await ask.execute(result, context())), answer);
  assert.equal(calls, 1);
  // Without the option, previews stay opaque text and are only length-checked.
  const opaque = tools({ ask: async received => { assert.equal(received.questions[0].options[0].preview, 'plain text'); return answer; } });
  const plain = structuredClone(question);
  plain.questions[0].options[0].preview = 'plain text';
  await opaque('ask_user_question', plain);
});

test('context callbacks are used when factory callbacks are absent', async () => {
  const run = tools(); let reports = 0;
  const ctx = context({ interaction: {
    ask: async () => answer, plan: async () => ({ approved: true }), report: () => { reports++; },
  } });
  assert.deepEqual(JSON.parse(await run('ask_user_question', question, ctx)), answer);
  assert.deepEqual(JSON.parse(await run('submit_plan', { plan: '# Plan' }, ctx)), { approved: true });
  assert.deepEqual(JSON.parse(await run('report_findings', findings, ctx)), findings);
  assert.equal(reports, 1);
  const factory = tools({ plan: async () => ({ approved: false }) });
  assert.deepEqual(JSON.parse(await factory('submit_plan', { plan: '# Plan' }, ctx)), { approved: false });
});

test('submit_plan preserves complete Markdown verbatim and returns host approval or denial', async () => {
  const markdown = '  # Plan\n\n1. Inspect `src/a.ts`.\n2. Apply the change.\n\n## Validation\nRun tests.\n';
  for (const approved of [true, false]) {
    let calls = 0;
    const run = tools({ plan: async (request, signal) => {
      calls++;
      assert.equal(request.plan, markdown);
      assert.equal(signal.aborted, false);
      return { approved };
    } });
    assert.deepEqual(JSON.parse(await run('submit_plan', { plan: markdown })), { approved });
    assert.equal(calls, 1);
  }
});

test('missing required host callbacks produce explicit errors', async () => {
  const run = tools();
  await assert.rejects(run('ask_user_question', question), /host ask callback is missing/);
  await assert.rejects(run('submit_plan', { plan: '# Complete plan' }), /host plan callback is missing/);
});

test('empty findings report a clean review and notify the observer', async () => {
  const clean = { findings: [] };
  assert.deepEqual(JSON.parse(await tools()('report_findings', clean)), clean);
  let calls = 0;
  const run = tools({ report: request => { calls++; assert.deepEqual(request, clean); } });
  assert.deepEqual(JSON.parse(await run('report_findings', clean)), clean);
  assert.equal(calls, 1);
});

test('report returns typed JSON and optional observer sees all content once', async () => {
  assert.deepEqual(JSON.parse(await tools()('report_findings', findings)), findings);
  let calls = 0;
  const run = tools({ report: (request, signal) => {
    calls++;
    assert.deepEqual(request, findings);
    assert.equal(signal.aborted, false);
    request.findings[0].summary = 'Observer mutation';
  } });
  assert.deepEqual(JSON.parse(await run('report_findings', findings)), findings);
  assert.equal(calls, 1);
});

test('invalid questions and form fields fail before host dispatch', async () => {
  let calls = 0;
  const run = tools({ ask: async () => { calls++; return answer; } });
  const base = question.questions[0];
  for (const input of [
    { questions: [] }, { questions: Array(5).fill(base) },
    { questions: [{ ...base, options: [base.options[0]] }] },
    { questions: [{ ...base, options: Array(5).fill(base.options[0]) }] },
    { questions: [{ ...base, options: [base.options[0], { label: 'a', description: 'Duplicate' }] }] },
    { questions: [{ ...base, options: [base.options[0], { label: 'Other', description: 'Reserved' }] }] },
    { questions: [{ ...base, multiSelect: 'yes' }] },
    { questions: [{ ...base, password: true }] },
    { questions: [{ ...base, question: ' ' }] },
    { questions: [{ ...base, options: [{ label: 'A', description: '' }, base.options[1]] }] },
    { questions: [{ ...base, question: 'a'.repeat(INTERACTION_LIMITS.questionChars + 1) }] },
  ]) await assert.rejects(run('ask_user_question', input));
  assert.equal(calls, 0);
});

test('host answers must match question coverage, labels and selection mode', async () => {
  for (const invalid of [
    { answers: [] }, { answers: [{ questionIndex: 0, selected: [] }] },
    { answers: [{ questionIndex: 0, selected: ['C'] }] },
    { answers: [{ questionIndex: 0, selected: ['A', 'B'] }] },
    { answers: [{ questionIndex: 0, selected: ['A'], other: 'also' }] },
    { answers: [{ questionIndex: 1, selected: ['A'] }] },
    { answers: [{ questionIndex: 0, selected: [], other: '' }] },
    { answers: [{ questionIndex: 0, selected: ['A'], token: 'extra' }] },
  ]) {
    const run = tools({ ask: async () => invalid as AskUserQuestionAnswer });
    await assert.rejects(run('ask_user_question', question));
  }
  const multi = { questions: [{ ...question.questions[0], multiSelect: true }] };
  await assert.rejects(tools({ ask: async () => ({ answers: [{ questionIndex: 0, selected: ['A', 'A'] }] }) })('ask_user_question', multi));
  const two = { questions: [question.questions[0], question.questions[0]] };
  await assert.rejects(tools({ ask: async () => ({ answers: [answer.answers[0], answer.answers[0]] }) })('ask_user_question', two), /exactly once/);
});

test('host mutation of request choices does not change answer validation', async () => {
  const run = tools({ ask: async request => {
    request.questions[0].options[0].label = 'C';
    return { answers: [{ questionIndex: 0, selected: ['C'] }] };
  } });
  await assert.rejects(run('ask_user_question', question), /does not match/);
});

test('invalid plan, approval and findings fail explicitly', async () => {
  let calls = 0;
  const run = tools({ plan: async () => { calls++; return { approved: true }; }, report: () => { calls++; } });
  for (const input of [{ plan: '' }, { plan: ' ' }, { plan: '# Plan', extra: 1 }, { plan: 'x'.repeat(INTERACTION_LIMITS.planChars + 1) }]) {
    await assert.rejects(run('submit_plan', input));
  }
  for (const finding of [
    { ...findings.findings[0], line: 0 }, { ...findings.findings[0], line: 1.5 },
    { ...findings.findings[0], line: Infinity }, { ...findings.findings[0], severity: 'unexpected' },
    { ...findings.findings[0], summary: '' }, { ...findings.findings[0], file: 'bad\npath' },
    { ...findings.findings[0], extra: true },
  ]) await assert.rejects(run('report_findings', { findings: [finding] }));
  await assert.rejects(run('report_findings', { findings: Array(101).fill(findings.findings[0]) }));
  assert.equal(calls, 0);
  for (const result of [{ approved: 'true' }, { approved: true, extra: 1 }, null]) {
    await assert.rejects(tools({ plan: async () => result as { approved: boolean } })('submit_plan', { plan: '# Plan' }));
  }
});

test('results are complete bounded JSON; oversized reporting fails before observer dispatch', async () => {
  let calls = 0;
  const run = tools({ report: () => { calls++; } });
  await assert.rejects(run('report_findings', findings, context({ maxOutputBytes: 20 })), /output byte limit/);
  assert.equal(calls, 0);
  await assert.rejects(tools({ ask: async () => ({ answers: [{ questionIndex: 0, selected: [], other: 'x'.repeat(1000) }] }) })('ask_user_question', question, context({ maxOutputBytes: 100 })), /output byte limit/);
  const json = await run('report_findings', findings, context({ maxOutputBytes: NaN }));
  assert.deepEqual(JSON.parse(json), findings);
  assert.ok(Buffer.byteLength(json) <= INTERACTION_LIMITS.outputBytes);
  let planCalls = 0;
  await assert.rejects(tools({ plan: async () => { planCalls++; return { approved: true }; } })('submit_plan', { plan: '# Plan' }, context({ maxOutputBytes: 1 })), /output byte limit/);
  assert.equal(planCalls, 0);
});

test('input traversal is bounded and accessor values are never invoked', async () => {
  const run = tools();
  const getter = { get findings() { throw new Error('getter was invoked'); } };
  await assert.rejects(run('report_findings', getter), /plain JSON/);
  await assert.rejects(run('report_findings', { findings: Array(3000).fill(null) }), /traversal budget/);
  await assert.rejects(run('report_findings', { findings: new Array(100_000) }), /traversal budget/);
  await assert.rejects(run('report_findings', { findings: new Array(2) }), /dense JSON arrays/);
  await assert.rejects(run('submit_plan', { plan: String.fromCharCode(0x4e2d).repeat(100_000) }), /byte budget/);
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  await assert.rejects(run('report_findings', cyclic), /traversal budget/);
});

test('pre-aborted calls invoke no host callbacks', async () => {
  let calls = 0;
  const run = tools({ ask: async () => { calls++; return answer; }, plan: async () => { calls++; return { approved: true }; }, report: () => { calls++; } });
  const controller = new AbortController(); controller.abort();
  for (const [name, input] of [['ask_user_question', question], ['submit_plan', { plan: '# Plan' }], ['report_findings', findings]] as const) {
    await assert.rejects(run(name, input, context({ signal: controller.signal })), { name: 'AbortError' });
  }
  assert.equal(calls, 0);
});

test('active abort settles once, notifies host once and consumes a late rejection', async () => {
  const started = deferred<void>(); const host = deferred<AskUserQuestionAnswer>();
  let calls = 0; let aborts = 0; let settlements = 0;
  const run = tools({ ask: async (_request, signal) => {
    calls++;
    signal.addEventListener('abort', () => { aborts++; }, { once: true });
    started.resolve(); return host.promise;
  } });
  const controller = new AbortController();
  const pending = run('ask_user_question', question, context({ signal: controller.signal }));
  void pending.then(() => { settlements++; }, () => { settlements++; });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await started.promise; controller.abort(); controller.abort(); await rejected;
  host.reject(new Error('late host failure')); await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(calls, 1); assert.equal(aborts, 1); assert.equal(settlements, 1);
});

test('shared FIFO queue bounds admissions and cancelled waiting calls never invoke the host', async () => {
  const started = deferred<void>(); const host = deferred<AskUserQuestionAnswer>();
  const seen: string[] = [];
  const run = tools({ maxPending: 2, ask: async () => { seen.push('ask'); started.resolve(); return host.promise; },
    plan: async () => { seen.push('plan'); return { approved: false }; } });
  const first = run('ask_user_question', question); await started.promise;
  const controller = new AbortController();
  const second = run('submit_plan', { plan: '# Plan' }, context({ signal: controller.signal }));
  const cancelled = assert.rejects(second, { name: 'AbortError' });
  await assert.rejects(run('submit_plan', { plan: '# Overflow' }), /queue is full/);
  controller.abort(); await cancelled;
  const third = run('submit_plan', { plan: '# Next plan' });
  assert.deepEqual(seen, ['ask']); host.resolve(answer);
  await first; assert.deepEqual(JSON.parse(await third), { approved: false });
  assert.deepEqual(seen, ['ask', 'plan']);
});

test('timeout aborts once and keeps an ignored host callback from stacking interactions', async () => {
  const host = deferred<{ approved: boolean }>(); let calls = 0; let aborts = 0;
  const run = tools({ timeoutMs: 20, maxPending: 1, plan: async (_request, signal) => {
    calls++; signal.addEventListener('abort', () => { aborts++; }, { once: true }); return host.promise;
  } });
  await assert.rejects(run('submit_plan', { plan: '# Plan' }), { name: 'TimeoutError' });
  await assert.rejects(run('submit_plan', { plan: '# Next' }), /queue is full/);
  assert.equal(calls, 1); assert.equal(aborts, 1);
  host.resolve({ approved: true }); await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(JSON.parse(await run('submit_plan', { plan: '# Recovered' })), { approved: true });
});

test('waiting deadline is bounded and callback failures release the queue', async () => {
  const firstHost = deferred<AskUserQuestionAnswer>(); const started = deferred<void>(); let planCalls = 0;
  const run = tools({ timeoutMs: 30, maxPending: 2, ask: async () => { started.resolve(); return firstHost.promise; },
    plan: async () => { planCalls++; throw new Error('review failed'); } });
  const first = run('ask_user_question', question); const firstTimeout = assert.rejects(first, { name: 'TimeoutError' });
  await started.promise;
  await assert.rejects(run('submit_plan', { plan: '# Queued' }), { name: 'TimeoutError' }); await firstTimeout;
  assert.equal(planCalls, 0); firstHost.resolve(answer); await new Promise<void>(resolve => setImmediate(resolve));
  await assert.rejects(run('submit_plan', { plan: '# Retry' }), /review failed/);
  await assert.rejects(run('submit_plan', { plan: '# Another retry' }), /review failed/);
  assert.equal(planCalls, 2);
});

test('report observers are cancellable and their failures surface', async () => {
  const started = deferred<void>(); const host = deferred<void>(); let aborts = 0;
  const run = tools({ report: async (_request, signal) => {
    signal.addEventListener('abort', () => { aborts++; }, { once: true }); started.resolve(); return host.promise;
  } });
  const controller = new AbortController();
  const pending = run('report_findings', findings, context({ signal: controller.signal }));
  const cancelled = assert.rejects(pending, { name: 'AbortError' });
  await started.promise; controller.abort(); await cancelled; host.resolve();
  assert.equal(aborts, 1);
  await assert.rejects(tools({ report: () => { throw new Error('observer failed'); } })('report_findings', findings), /observer failed/);
});

test('invalid queue configuration fails immediately', () => {
  for (const options of [{ timeoutMs: 0 }, { timeoutMs: Infinity }, { timeoutMs: 600_001 }, { maxPending: 0 }, { maxPending: 65 }, { maxPending: 1.5 }]) {
    assert.throws(() => createInteractionTools(options), /Invalid interaction/);
  }
});
