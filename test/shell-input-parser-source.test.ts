import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z, ZodError } from 'zod';
import { createPermissionInputParser } from '../src/shell-input-parser-source.js';

const schema = z.object({ command: z.string(), nested: z.object({ items: z.array(z.object({ value: z.number() }).strict()) }).strict() }).strict();
const input = () => ({ command: 'echo ok', extra: true,
  nested: { items: [{ value: 1, ignored: 'x' }, { value: 2 }], ignored: true } });

test('source input parser removes only unknown keys from cloned paths', () => {
  const featureCalls: unknown[][] = [];
  const parser = createPermissionInputParser((...args: unknown[]) => { featureCalls.push(args); return true; }, () => false, () => {});
  const original = input();
  const before = structuredClone(original);
  const parsed = parser.Zwe({ name: 'Bash', inputSchema: schema }, original, {});
  assert.deepEqual(parsed, { parsedInput: { command: 'echo ok', nested: { items: [{ value: 1 }, { value: 2 }] } }, keysSetAside: true });
  assert.deepEqual(original, before);
  assert.notEqual(parsed.parsedInput, original);
  assert.deepEqual(featureCalls, [['tengu_tidy_eclipse', true]]);
  assert.deepEqual(parser.Zwe({ name: 'Bash', inputSchema: schema }, parsed.parsedInput, {}),
    { parsedInput: parsed.parsedInput, keysSetAside: false });
  assert.equal(featureCalls.length, 1);
});

test('source permission failure classifier preserves abort, cwd and fail-closed order', () => {
  class Aborted extends Error {}
  class Interrupted extends Error {}
  const cwdFailure = new Error('missing cwd');
  const knownFailure = new Error('known error');
  const crash = new Error('unexpected error');
  const logged: unknown[] = [];
  const parser = createPermissionInputParser(() => true, (error: unknown) => error === knownFailure,
    (error: unknown) => logged.push(error), { Ye: Aborted, au: Interrupted,
      Uxr: (error: unknown) => error === cwdFailure, WWn: 'missing working directory' });
  const signal = { abortController: { signal: { aborted: false } } };
  const tool = { name: 'Bash' };
  const originalAbort = new Aborted('aborted');
  const originalInterrupt = new Interrupted('interrupted');
  assert.throws(() => parser.G9e(originalAbort, tool, {}, signal), error => error === originalAbort);
  assert.throws(() => parser.G9e(originalInterrupt, tool, {}, signal), error => error === originalInterrupt);
  assert.throws(() => parser.G9e(knownFailure, tool, {}, { abortController: { signal: { aborted: true } } }), Aborted);
  const missing = parser.G9e(cwdFailure, tool, {}, signal);
  assert.equal(missing.behavior, 'deny');
  assert.equal(missing.decisionReason.reason, 'missing working directory');
  assert.equal(logged.length, 0);
  const input = { command: 'echo ok' };
  const posture = { behavior: 'deny', message: 'fixture posture' };
  const calls: unknown[][] = [];
  const guarded = { ...tool, permissionCheckFailureDecision: (...args: unknown[]) => { calls.push(args); return posture; } };
  assert.equal(parser.G9e(crash, guarded, input, signal), posture);
  assert.deepEqual(calls, [[input, signal]]);
  assert.deepEqual(logged, [crash]);
  assert.equal(parser.G9e(knownFailure, tool, input, signal), undefined);
  assert.deepEqual(logged, [crash]);
  const failure = parser.G9e(crash, { ...tool, permissionCheckFailureDecision: () => { throw knownFailure; } }, input, signal);
  assert.equal(failure.behavior, 'deny');
  assert.equal(failure.decisionReason.reason, 'permission check crashed; tool declares a fail-closed posture');
});

test('source input parser preserves validation errors and fail-closed callbacks', () => {
  const parser = createPermissionInputParser(() => true, () => false, () => {});
  const invalid = { ...input(), command: 42 };
  assert.throws(() => parser.Zwe({ name: 'Bash', inputSchema: schema }, invalid, {}), ZodError);
  const disabled = createPermissionInputParser(() => false, () => false, () => {});
  assert.throws(() => disabled.Zwe({ name: 'Bash', inputSchema: schema }, input(), {}), ZodError);
  const deny = { behavior: 'deny', message: 'fixture' };
  const tool = { name: 'Bash', inputSchema: schema, permissionCheckFailureDecision: () => deny };
  assert.throws(() => parser.Zwe(tool, input(), {}), ZodError);
  assert.equal(parser.Dpn(tool, input(), {}), deny);
  const errors: unknown[] = [];
  const failure = new Error('posture failed');
  const logged = createPermissionInputParser(() => true, () => false, (error: unknown) => errors.push(error));
  const result = logged.Dpn({ name: 'Bash', permissionCheckFailureDecision: () => { throw failure; } }, {}, {});
  assert.equal(result.behavior, 'deny');
  assert.equal(result.decisionReason.reason, 'permission check crashed; tool declares a fail-closed posture');
  assert.equal(errors.length, 1);
  assert.equal(errors[0], failure);
  const ignored = createPermissionInputParser(() => true, () => true, (error: unknown) => errors.push(error));
  assert.equal(ignored.Dpn({ name: 'Bash', permissionCheckFailureDecision: () => { throw failure; } }, {}, {}).behavior, 'deny');
  assert.deepEqual(errors, [failure]);
});
