import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { AsyncHookRegistry } from '../src/async-hooks.js';
import { runHooks } from '../src/hooks.js';
import { duplicateSessionStart, parseAsyncHookResponse } from '../src/async-hook-response.js';
import { Agent, defaultConfig } from '../src/agent.js';
import type { ModelProvider } from '../src/provider.js';
import { forkSession } from '../src/sessions.js';
import { createRuntime, pinToolSchemas } from '../src/runtime.js';
import { Session, renderNotificationBatch } from '../src/session.js';
import { fixtureAppend } from './notification-fixture.js';

const quote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;
const temp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'async-response-')));

test('configured and adopted commands keep lifecycle completion separate from source attachment suppression', async () => {
  const root = temp();
  const registry = new AsyncHookRegistry({ workspace: root });
  try {
    for (const adopted of [false, true]) for (const sample of [
      { stdout: '', stderr: '', code: 0, delivered: false },
      { stdout: '{}', stderr: '', code: 0, delivered: false },
      { stdout: '{"unrecognized":true}', stderr: '', code: 0, delivered: false },
      { stdout: '{"systemMessage":""}', stderr: '', code: 0, delivered: true },
      { stdout: '{"systemMessage":"hello"}', stderr: '', code: 0, delivered: true },
      { stdout: '{"systemMessage":1,"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"salvaged"}}', stderr: '', code: 0, delivered: true },
      { stdout: '{}', stderr: 'warning', code: 0, delivered: true },
      { stdout: '{}', stderr: '', code: 2, delivered: true },
    ]) {
      const command = `${adopted ? `printf '{"async":true}\\n'; sleep 0.03; ` : ''}printf '%s' ${quote(sample.stdout)}; printf '%s' ${quote(sample.stderr)} >&2; exit ${sample.code}`;
      const result = await runHooks({ SessionStart: [{ command, ...(adopted ? {} : { async: true }) }] }, 'SessionStart', { cwd: root }, new AbortController().signal,
        { startAsyncCommand: request => request.handle ? registry.adopt(request, request.handle, 'response') : registry.start(request) });
      assert.equal(result.backgroundTasks?.length, 1);
      const done = await registry.wait(result.backgroundTasks![0]!);
      assert.equal(done.delivery.kind, sample.delivered ? 'attachment' : 'none');
      if (done.delivery.kind === 'attachment') {
        assert.equal(done.delivery.attachment.command, command);
        assert.equal(done.delivery.attachment.exitCode, sample.code);
        assert.equal(done.delivery.attachment.stderr, sample.stderr);
      }
    }
    assert.deepEqual(parseAsyncHookResponse({ systemMessage: 1, hookSpecificOutput: { additionalContext: 2, retained: true }, metrics: { count: 2, invalid: 'x' } }),
      { hookSpecificOutput: { retained: true }, metrics: { count: 2 } });
    assert.deepEqual(parseAsyncHookResponse({ systemMessage: 'text', unknown: true }), { systemMessage: 'text' });
  } finally { await registry.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('SessionStart source dedup preserves command boundaries, empty successes and mixed attachment order', () => {
  const candidate = { command: 'one', response: { systemMessage: 'text', hookSpecificOutput: { additionalContext: 'context' } } };
  const prior = { type: 'async_hook_response', hookEvent: 'SessionStart', ...candidate, exitCode: 0 };
  assert.equal(duplicateSessionStart(candidate, [prior]), true);
  assert.equal(duplicateSessionStart({ ...candidate, command: 'two' }, [prior]), false);
  assert.equal(duplicateSessionStart(candidate, [prior, { ...prior, response: {}, exitCode: 0 }]), false);
  assert.equal(duplicateSessionStart(candidate, [prior, { ...prior, response: {}, exitCode: 1 }]), true);
  assert.equal(duplicateSessionStart(candidate, [{ type: 'hook_additional_context', hookEvent: 'SessionStart', content: ['text', 'context'] }]), true);
  assert.equal(duplicateSessionStart(candidate, [prior, { type: 'hook_success', hookEvent: 'SessionStart', content: 'newer' }]), false);
  assert.equal(duplicateSessionStart({ ...candidate, response: {} }, [prior]), false);
});

test('runtime SessionStart dedup uses receipted attachment history across reopen, not pending intents', async () => {
  const root = temp(), controller = new AbortController();
  const config = { ...defaultConfig(root, []), model: 'fixture', skills: [] };
  const provider: ModelProvider = { count: async () => 1, complete: async request => {
    assert.doesNotMatch(JSON.stringify(request.messages), /retained-anchor|Hook output/);
    return { id: 'summary', model: 'fixture', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'SUMMARY', citations: null }],
      container: null, diagnostics: null, stop_details: null, stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
        cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
  } };
  let runtime = await createRuntime(config, provider, controller.signal);
  config.tools = pinToolSchemas(runtime.tools);
  let session = Session.open(root, { config });
  // Observe the real completion Promise, without replacing admission, parsing or publication.
  const descriptor = Object.getOwnPropertyDescriptor(AsyncHookRegistry.prototype, 'finish')!;
  let settled: (() => void) | undefined;
  Object.defineProperty(AsyncHookRegistry.prototype, 'finish', { ...descriptor, value: function(this: AsyncHookRegistry, ...args: unknown[]) {
    const result: unknown = Reflect.apply(descriptor.value, this, args);
    assert.ok(result instanceof Promise);
    void result.then(() => settled?.());
    return result;
  } });
  try {
    const command = `printf x >> runs; cat response`;
    fs.writeFileSync(path.join(root, 'response'), JSON.stringify({ systemMessage: 'same' }));
    const start = async (home?: string) => {
      const done = new Promise<void>(resolve => { settled = resolve; });
      const payload = { cwd: root, session_id: session.id };
      await runtime.hookOptions!(session.config, session.id).startAsyncCommand!({ definition: { command, async: true }, event: 'SessionStart', payload,
        input: `${JSON.stringify({ ...payload, hook_event_name: 'SessionStart' })}\n`, cwd: root, timeoutMs: 5000, signal: controller.signal,
        ...(home ? { commandHome: { value: home } } : {}) });
      await done;
    };
    await runtime.bindSession!(session);
    await start(); await start();
    let intents = session.events.filter(e => e.kind === 'notification_intent_v2');
    assert.equal(intents.length, 2, 'unconfirmed output must not suppress another completion');
    const intent = intents[0]!;
    assert.equal(intent.batch.kind, 'async_hook');
    const scope = intent.batch.kind === 'async_hook' ? intent.batch.commandScope! : '';
    assert.deepEqual(session.sessionStartAttachments(scope), []);
    session.append({ kind: 'message', message: { role: 'user', content: 'old question' } });
    session.append({ kind: 'message', message: { role: 'assistant', content: 'old answer' } });
    session.append({ kind: 'message', message: { role: 'user', content: 'recent question' } });
    session.append({ kind: 'message', message: { role: 'assistant', content: 'retained-anchor' } });
    fixtureAppend(session, { kind: 'message', message: { role: 'user', content: renderNotificationBatch(intent.batch) }, notificationDelivery: { owner: session.id, deliveryId: intent.deliveryId } });
    assert.equal(session.sessionStartAttachments(scope).length, 1);
    session.append({ kind: 'turn_end', reason: 'fixture' });
    await new Agent(session, provider, runtime.tools).compactContext();
    assert.equal(session.sessionStartAttachments(scope).length, 1);
    assert.match(JSON.stringify(session.messages), /retained-anchor/);
    assert.doesNotMatch(JSON.stringify(session.messages), /old answer/);
    const fork = forkSession(session);
    try {
      assert.deepEqual(fork.messages, session.messages);
      assert.deepEqual(fork.sessionStartAttachments(scope), session.sessionStartAttachments(scope));
      assert.equal(fork.notificationCoordination.length, 0);
    } finally { fork.close(); }
    await start(); assert.equal(session.events.filter(e => e.kind === 'notification_intent_v2').length, 2);
    await runtime.close(); session.close();
    session = Session.open(root, { id: session.id });
    runtime = await createRuntime(session.config, provider, controller.signal); await runtime.bindSession!(session);
    assert.equal(session.sessionStartAttachments(scope).length, 1);
    await start(); assert.equal(session.events.filter(e => e.kind === 'notification_intent_v2').length, 2);
    await start(root); assert.equal(session.events.filter(e => e.kind === 'notification_intent_v2').length, 3, 'a different command HOME must not match');
    fs.writeFileSync(path.join(root, 'response'), JSON.stringify({ systemMessage: 'different' }));
    await start(); intents = session.events.filter(e => e.kind === 'notification_intent_v2'); assert.equal(intents.length, 4);
    assert.equal(fs.readFileSync(path.join(root, 'runs'), 'utf8'), 'xxxxxx');
    await runtime.close(); session.close();
    fs.unlinkSync(`${session.file}.notification-${intent.deliveryId}.receipt`);
    assert.throws(() => Session.open(root, { id: session.id }), /Preserved compaction message no longer matches/);
  } finally { Object.defineProperty(AsyncHookRegistry.prototype, 'finish', descriptor); await runtime.close(); session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
