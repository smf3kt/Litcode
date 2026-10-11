import assert from 'node:assert/strict';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { compileJsonSchema, createHeadlessOutput, STRUCTURED_OUTPUT_LIMITS, UsageBudget, UsageBudgetExceeded, withUsageBudget, type OutputFormat } from '../src/structured-output.js';

const schema = { type: 'object', properties: { answer: { type: 'string', minLength: 1 }, count: { type: 'integer', minimum: 0 }, tags: { type: 'array', items: { type: 'string' }, maxItems: 3 } }, required: ['answer', 'count'], additionalProperties: false };
const done = { reason: 'end_turn', text: '{"answer":"ok","count":1}', modelCalls: 1, usage: { input_tokens: 12, output_tokens: 5 } };
function output(format: OutputFormat, requestedSchema?: unknown) {
  const stdout: string[] = []; const stderr: string[] = [];
  const sink = createHeadlessOutput({ format, sessionId: 'session-1', write: (text) => { stdout.push(text); }, writeError: (text) => { stderr.push(text); }, schema: requestedSchema });
  return { sink, stdout, stderr };
}

test('supported JSON Schema validates required fields, primitive types, arrays and additional properties', () => {
  const validator = compileJsonSchema(schema);
  assert.equal(validator.validate({ answer: 'ok', count: 1, tags: ['a'] }).valid, true);
  for (const value of [{ answer: 'ok' }, { answer: '', count: 1 }, { answer: 'ok', count: 0.5 }, { answer: 'ok', count: -1 }, { answer: 'ok', count: 1, tags: [1] }, { answer: 'ok', count: 1, extra: true }, { answer: 'ok', count: 1, tags: ['a', 'b', 'c', 'd'] }]) assert.equal(validator.validate(value).valid, false);
});

test('validator supports anyOf, type unions, structural enum and schema-valued additional properties', () => {
  const validator = compileJsonSchema({ anyOf: [{ type: ['null', 'string'], enum: [null, 'ok'] }, { type: 'object', additionalProperties: { type: 'integer' } }] });
  assert.equal(validator.validate(null).valid, true);
  assert.equal(validator.validate('ok').valid, true);
  assert.equal(validator.validate({ one: 1 }).valid, true);
  assert.equal(validator.validate({ one: 'wrong' }).valid, false);
  assert.equal(compileJsonSchema({ enum: [{ a: 1, b: [2] }] }).validate({ b: [2], a: 1 }).valid, true);
  assert.equal(compileJsonSchema({ enum: [{ a: 1 }] }).validate({ a: 1, extra: true }).valid, false);
});

test('Unicode length, number bounds and JSON Pointer paths follow the documented subset', () => {
  const v = compileJsonSchema({ type: 'object', properties: { 'a/b~c': { type: 'string', minLength: 2, maxLength: 2 }, number: { type: 'number', minimum: 1, maximum: 4, exclusiveMinimum: 1, exclusiveMaximum: 4 } } });
  assert.equal(v.validate({ 'a/b~c': '😀x', number: 2 }).valid, true);
  const result = v.validate({ 'a/b~c': '😀', number: 4 });
  assert.equal(result.valid, false);
  if (!result.valid) { assert.equal(result.issues[0].path, '/a~1b~0c'); assert.equal(result.issues[1].keyword, 'exclusiveMaximum'); }
});

test('unsupported schemas fail explicitly before output begins', () => {
  for (const s of [true, { $ref: '#/x' }, { pattern: '.*' }, { format: 'email' }, { allOf: [] }, { items: [{ type: 'string' }] }, { oneOf: [{}] }, { type: 'unknown' }, { anyOf: [] }, { required: ['x', 'x'] }, { minLength: 5, maxLength: 1 }, { type: ['string', 'string'] }]) assert.throws(() => compileJsonSchema(s));
  assert.throws(() => createHeadlessOutput({ format: 'json', sessionId: 's', write: () => assert.fail('must not print'), schema: { $ref: '#/missing' } }));
});

test('validator treats prototype property names as ordinary JSON fields and evaluates no accessors', () => {
  const v = compileJsonSchema(JSON.parse('{"type":"object","properties":{"__proto__":{"type":"string"},"constructor":{"type":"integer"}},"required":["__proto__","constructor"],"additionalProperties":false}'));
  assert.equal(v.validate(JSON.parse('{"__proto__":"data","constructor":1}')).valid, true);
  assert.equal(v.validate(JSON.parse('{"__proto__":1,"constructor":1}')).valid, false);
  let ran = false;
  const getter = Object.defineProperty({}, 'properties', { enumerable: true, get() { ran = true; return {}; } });
  assert.throws(() => compileJsonSchema(getter));
  const array = Object.defineProperty([], '0', { enumerable: true, get() { ran = true; return 1; } });
  assert.equal(compileJsonSchema({}).validate(array).valid, false);
  const hidden = Object.defineProperty({}, 'toJSON', { value: () => { ran = true; return {}; } });
  assert.equal(compileJsonSchema({}).validate(hidden).valid, false);
  const arrayJson = Object.defineProperty([], 'toJSON', { value: () => { ran = true; return []; } });
  assert.equal(compileJsonSchema({}).validate(arrayJson).valid, false);
  assert.equal(ran, false);
});

test('validator rejects invalid JSON and enforces depth, byte and issue budgets', () => {
  const v = compileJsonSchema(schema);
  for (const text of ['```json\n{}\n```', '{', '{} trailing', 'undefined', '{"answer":NaN,"count":1}']) {
    const result = v.validateText(text); assert.equal(result.valid, false); if (!result.valid) assert.equal(result.error.code, 'invalid_json');
  }
  let nested: unknown = {};
  for (let i = 0; i < STRUCTURED_OUTPUT_LIMITS.depth + 2; i++) nested = { child: nested };
  assert.throws(() => compileJsonSchema(nested));
  assert.equal(compileJsonSchema({}).validate(nested).valid, false);
  const huge = v.validateText(' '.repeat(STRUCTURED_OUTPUT_LIMITS.outputBytes + 1));
  assert.equal(huge.valid, false); if (!huge.valid) assert.equal(huge.error.code, 'output_limit');
  const many = compileJsonSchema({ type: 'object', additionalProperties: false }).validate(Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`field${i}`, i])));
  assert.equal(many.valid, false); if (!many.valid) assert.equal(many.issues.length, STRUCTURED_OUTPUT_LIMITS.issues);
  assert.equal(compileJsonSchema({}).validate(Infinity).valid, false);
  const cyclic: any = {}; cyclic.next = cyclic; assert.equal(compileJsonSchema({}).validate(cyclic).valid, false);
});

test('plain text streams once, finalization does not reprint, and zero-call output is printed', () => {
  const { sink, stdout, stderr } = output('text');
  sink.text('hello'); sink.text(' world'); sink.status('working');
  const result = sink.finish({ reason: 'end_turn', text: 'hello world', modelCalls: 1 });
  sink.finish({ reason: 'other', text: 'duplicate', modelCalls: 2 });
  assert.equal(stdout.join(''), 'hello world\n');
  assert.deepEqual(stderr, ['working\n']); assert.equal(result.usage, null);
  assert.throws(() => sink.text('late'), /finished/);
  const zero = output('text'); zero.sink.finish({ reason: 'end_turn', text: 'direct', modelCalls: 0 }); assert.equal(zero.stdout.join(''), 'direct\n');
});

test('JSON output suppresses text deltas and prints one complete result with usage', () => {
  const { sink, stdout, stderr } = output('json', schema);
  sink.text('intermediate'); sink.status('working');
  const result = sink.finish(done); sink.finish(done);
  assert.equal(stdout.length, 1);
  assert.deepEqual(JSON.parse(stdout[0]), { session_id: 'session-1', reason: 'end_turn', text: done.text, model_calls: 1, usage: done.usage, structured_output: { answer: 'ok', count: 1 } });
  assert.deepEqual(result.structured_output, { answer: 'ok', count: 1 }); assert.deepEqual(stderr, ['working\n']);
});

test('stream-json emits ordered typed line events and one final result', () => {
  const { sink, stdout } = output('stream-json');
  sink.text('hello'); sink.status('working');
  sink.event({ type: 'tool_start', id: 'call-1', name: 'read' });
  sink.event({ type: 'tool_result', id: 'call-1', is_error: false, content: { text: 'data' } });
  sink.event({ type: 'usage', usage: { input_tokens: 1, output_tokens: 2 } });
  sink.finish({ reason: 'end_turn', text: 'hello', modelCalls: 1 }); sink.finish(done);
  const lines = stdout.map((line) => JSON.parse(line));
  assert.deepEqual(lines.map((line) => line.sequence), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(lines.map((line) => line.type), ['text', 'status', 'tool_start', 'tool_result', 'usage', 'result']);
  assert.ok(lines.every((line) => line.session_id === 'session-1'));
  assert.equal(lines[5].result.model_calls, 1);
});

test('requested schema produces explicit schema_error and text mode buffers until validation', () => {
  for (const format of ['text', 'json', 'stream-json'] as const) {
    const { sink, stdout, stderr } = output(format, schema);
    sink.text('invalid');
    const result = sink.finish({ reason: 'end_turn', text: '{"answer":"ok"}', modelCalls: 1 });
    assert.equal(result.reason, 'schema_error'); assert.equal(result.error?.code, 'schema_validation');
    if (format === 'text') { assert.deepEqual(stdout, []); assert.match(stderr.join(''), /schema_error/); }
    else {
      const envelope = JSON.parse(stdout.at(-1)!);
      assert.equal((format === 'json' ? envelope : envelope.result).reason, 'schema_error');
    }
  }
  const good = output('text', schema); good.sink.text('draft'); good.sink.finish(done); assert.equal(good.stdout.join(''), done.text + '\n');
});

test('schema validation preserves operational failure reasons and validates only successful finishes', () => {
  for (const reason of ['budget_exceeded', 'aborted', 'model_error', 'turn_limit', 'hook_blocked']) {
    const { sink, stdout } = output('json', schema);
    const result = sink.finish({ reason, text: '', modelCalls: 0 });
    assert.equal(result.reason, reason);
    assert.equal(result.error, undefined);
    assert.equal(result.structured_output, undefined);
    assert.equal(JSON.parse(stdout[0]).reason, reason);
  }
  const successful = output('json', schema);
  assert.equal(successful.sink.finish({ reason: 'stop_sequence', text: '{}', modelCalls: 1 }).reason, 'schema_error');
});

test('output adapter rejects invalid metadata and keeps untyped extras out of event lines', () => {
  assert.throws(() => createHeadlessOutput({ format: 'json', sessionId: '\n', write() {} }));
  const { sink, stdout } = output('stream-json');
  sink.event({ type: 'tool_start', id: 'id', name: 'tool', credentials: 'omit' } as any);
  assert.ok(!stdout[0].includes('credentials'));
  assert.throws(() => sink.finish({ reason: 'end_turn', text: '', modelCalls: -1 }));
  assert.throws(() => sink.event({ type: 'usage', usage: { input_tokens: -1, output_tokens: 0 } }));
});

test('usage budgets count calls and cache tokens without monetary rates', () => {
  const budget = new UsageBudget({ maxCalls: 2, maxInputTokens: 20, maxTotalTokens: 30 });
  budget.beginCall(); budget.recordUsage({ input_tokens: 5, output_tokens: 3, cache_creation_input_tokens: 4, cache_read_input_tokens: 2 });
  assert.equal(budget.snapshot().model_calls, 1); assert.equal(budget.snapshot().exhausted, false);
  budget.beginCall(); budget.recordUsage({ input_tokens: 1, output_tokens: 1 });
  assert.equal(budget.snapshot().exhausted, true);
  assert.throws(() => budget.beginCall(), UsageBudgetExceeded);
  const crossed = new UsageBudget({ maxOutputTokens: 3 }); crossed.beginCall(); assert.throws(() => crossed.recordUsage({ input_tokens: 0, output_tokens: 4 }), UsageBudgetExceeded);
  assert.equal(crossed.snapshot().usage.output_tokens, 4); assert.deepEqual(crossed.snapshot().exceeded, ['maxOutputTokens']);
  assert.throws(() => new UsageBudget({ maxCalls: -1 }));
  assert.throws(() => new UsageBudget({ dollars: 1 } as any));
  assert.throws(() => new UsageBudget({ maxCalls: 0 }).beginCall(), UsageBudgetExceeded);
});

test('provider wrapper reserves every completion, retains actual usage, and delegates token counting', async () => {
  let complete = 0; let count = 0;
  const provider: ModelProvider = {
    async complete(_request, _signal, onText) { complete++; onText?.('result'); return { usage: { input_tokens: 2, output_tokens: 1, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 } } as Anthropic.Message; },
    async count() { count++; return 123; },
  };
  const budget = new UsageBudget({ maxCalls: 2 });
  const reported: unknown[] = [];
  const wrapped = withUsageBudget(provider, budget, (usage) => reported.push(usage));
  const signal = new AbortController().signal;
  const request = { model: 'fixture', max_tokens: 1, messages: [{ role: 'user', content: 'local fixture' }] } as ModelRequest;
  await wrapped.complete(request, signal); await wrapped.complete(request, signal);
  assert.equal(await wrapped.count(request, signal), 123);
  await assert.rejects(wrapped.complete(request, signal), UsageBudgetExceeded);
  assert.equal(complete, 2); assert.equal(count, 1); assert.equal(reported.length, 2);
  assert.deepEqual(budget.snapshot().usage, { input_tokens: 4, output_tokens: 2, cache_creation_input_tokens: 6, cache_read_input_tokens: 8 });
});

test('concurrent provider reservations obey maxCalls and budget errors still report actual usage', async () => {
  let started = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const provider: ModelProvider = {
    async complete() { started++; await gate; return { usage: { input_tokens: 2, output_tokens: 5 } } as Anthropic.Message; },
    async count() { return 0; },
  };
  const budget = new UsageBudget({ maxCalls: 2, maxOutputTokens: 2 });
  let reported = 0;
  const wrapped = withUsageBudget(provider, budget, () => { reported++; throw new Error('reporting failed'); });
  const request = {} as ModelRequest; const signal = new AbortController().signal;
  const first = assert.rejects(wrapped.complete(request, signal), (error: Error) => error instanceof UsageBudgetExceeded && error.code === 'usage_budget_exceeded');
  const second = assert.rejects(wrapped.complete(request, signal), UsageBudgetExceeded);
  await assert.rejects(wrapped.complete(request, signal), UsageBudgetExceeded);
  assert.equal(started, 2);
  release(); await Promise.all([first, second]);
  assert.equal(reported, 2);
  assert.equal(budget.snapshot().usage.output_tokens, 10);
  assert.equal(budget.snapshot().model_calls, 2);
});

test('provider failures consume reserved calls; pre-aborted completions consume none', async () => {
  const provider: ModelProvider = { async complete() { throw new Error('fixture failed'); }, async count() { return 0; } };
  const budget = new UsageBudget({ maxCalls: 2 }); const wrapped = withUsageBudget(provider, budget);
  const request = {} as ModelRequest;
  await assert.rejects(wrapped.complete(request, new AbortController().signal), /fixture failed/);
  assert.equal(budget.snapshot().model_calls, 1);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(wrapped.complete(request, controller.signal));
  assert.equal(budget.snapshot().model_calls, 1);
});
