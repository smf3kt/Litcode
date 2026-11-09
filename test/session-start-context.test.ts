import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import { duplicateSessionStart, filterStartupAttachments, startupContextAttachments } from '../src/async-hook-response.js';
import type { ModelProvider } from '../src/provider.js';

const quote = (text: string) => `'${text.replaceAll("'", `'"'"'`)}'`;
const emit = (value: unknown) => `printf '%s' ${quote(JSON.stringify(value))}`;
const temp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'startup-context-')));
const answer: Anthropic.Message = { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'done', citations: null }],
  container: null, diagnostics: null, stop_details: null,
  stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: null, cache_read_input_tokens: null,
    cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
const candidate = { command: 'different-command', response: { hookSpecificOutput: { additionalContext: 'START_CONTEXT' } } };

test('startup filtering normalizes persisted paths but preserves new batch multiplicity and source row rules', () => {
  const saved = '<persisted-output>\nsaved to: /old/output\nbody';
  const moved = '<persisted-output>\nsaved to: /new/output\nbody';
  const history = startupContextAttachments([saved, 'old']);
  assert.deepEqual(filterStartupAttachments(history, startupContextAttachments([moved, 'old', 'new', 'new'])), startupContextAttachments(['new', 'new']));
  assert.deepEqual(filterStartupAttachments(history, startupContextAttachments([moved])), []);
  assert.deepEqual(filterStartupAttachments(history, startupContextAttachments(['saved to: /new/output'])), startupContextAttachments(['saved to: /new/output']));
  const error = { type: 'hook_non_blocking_error' as const, hookEvent: 'SessionStart', command: 'cmd', exitCode: 2, stderr: 'error' };
  const empty = { type: 'hook_success' as const, hookEvent: 'SessionStart', content: '' };
  assert.deepEqual(filterStartupAttachments([error], [error, empty]), []);
  assert.deepEqual(filterStartupAttachments([error], [{ ...error, command: 'other' }, empty]), [{ ...error, command: 'other' }, empty]);
  assert.deepEqual(filterStartupAttachments([{ type: 'hook_success', hookEvent: 'SessionStart', content: saved }], startupContextAttachments([moved])), []);
  assert.deepEqual(filterStartupAttachments([], [empty]), [empty]);
});

test('resumed Agent filters previously delivered startup context while preserving identical Setup context and new duplicates', async () => {
  const root = temp(), config = defaultConfig(root, []); config.model = 'fixture';
  const hook = (text: string) => ({ command: emit({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }) });
  config.hooks = { SessionStart: [hook('old')] };
  let session = Session.open(root, { config });
  try {
    const provider: ModelProvider = { count: async () => 1, complete: async () => answer };
    const first = new Agent(session, provider, []); await first.startSession('startup'); await first.run('first');
    const id = session.id; session.close(); session = Session.open(root, { id, config });
    session.config.hooks = { SessionStart: [hook('old'), hook('new'), hook('new')], Setup: [{ command: emit({ hookSpecificOutput: { hookEventName: 'Setup', additionalContext: 'old' } }) }] };
    const resumed = new Agent(session, provider, []); await resumed.startSession('resume'); await resumed.emitHook('Setup', {}); await resumed.run('second');
    const rows = session.events.filter(row => row.kind === 'message' && row.sessionStartContext);
    assert.equal(rows.length, 2); const latest = rows[1]; assert.ok(latest?.kind === 'message');
    assert.deepEqual(latest.sessionStartContext, ['new', 'new']);
    assert.ok(Array.isArray(latest.message.content));
    assert.equal(latest.message.content.filter(block => block.type === 'text' && block.text === 'Hook context:\nold').length, 1);
    assert.equal(latest.message.content.filter(block => block.type === 'text' && block.text === 'Hook context:\nnew').length, 2);
  } finally { session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('accepted Agent messages retain startup context after rejected prompts and exclude undisplayed status', async () => {
  const root = temp();
  const config = defaultConfig(root, []); config.model = 'fixture';
  config.hooks = {
    SessionStart: [{ command: emit({ systemMessage: 'STATUS_ONLY', hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'START_CONTEXT' } }) }],
    Setup: [{ command: emit({ hookSpecificOutput: { hookEventName: 'Setup', additionalContext: 'SETUP_ONLY' } }) }],
    UserPromptSubmit: [{ command: `if [ ! -f submitted ]; then touch submitted; ${emit({ decision: 'block', reason: 'hold' })}; else printf '{}'; fi` }],
  };
  const requests: Parameters<ModelProvider['complete']>[0][] = [];
  const provider: ModelProvider = { count: async () => 1, complete: async request => { requests.push(request); return answer; } };
  const session = Session.open(root, { config });
  try {
    const agent = new Agent(session, provider, []);
    await agent.startSession('startup'); await agent.emitHook('Setup', {});
    assert.deepEqual(session.sessionStartAttachments('any'), []);
    assert.equal((await agent.run('blocked prompt')).reason, 'hook_blocked');
    assert.deepEqual(session.sessionStartAttachments('any'), []); assert.equal(requests.length, 0);
    assert.equal((await agent.run('accepted prompt')).reason, 'end_turn');
    assert.match(JSON.stringify(requests[0]!.messages), /START_CONTEXT/);
    assert.doesNotMatch(JSON.stringify(requests[0]!.messages), /SETUP_ONLY|STATUS_ONLY/);
    const rows = session.events.filter(e => e.kind === 'message' && e.sessionStartContext);
    assert.equal(rows.length, 1); const row = rows[0]; assert.ok(row?.kind === 'message'); assert.deepEqual(row.sessionStartContext, ['START_CONTEXT']);
    assert.equal(duplicateSessionStart(candidate, session.sessionStartAttachments('any')), true);
    assert.equal(duplicateSessionStart({ response: { systemMessage: 'STATUS_ONLY' } }, session.sessionStartAttachments('any')), false);
    await agent.run('next prompt'); assert.equal(session.events.filter(e => e.kind === 'message' && e.sessionStartContext).length, 1);
  } finally { session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('startup visibility survives conversation-only forks and cold reads, rejects false metadata and clears on compaction', async () => {
  const root = temp(), config = defaultConfig(root, []); config.model = 'fixture';
  config.hooks = { SessionStart: [{ command: emit({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'START_CONTEXT' } }) }] };
  const session = Session.open(root, { config }); let fork: Session | undefined;
  try {
    session.append({ kind: 'message', message: { role: 'user', content: [{ type: 'text', text: 'Hook context:\nSTART_CONTEXT' }] } });
    session.append({ kind: 'turn_end', reason: 'fixture' });
    assert.deepEqual(session.sessionStartAttachments('any'), []);
    assert.throws(() => session.append({ kind: 'message', sessionStartContext: ['hidden'], message: { role: 'user', content: 'ordinary text' } }), /SessionStart context/);
    const agent = new Agent(session, { count: async () => 1, complete: async () => answer }, []);
    await agent.startSession('startup'); await agent.run('task');
    fork = forkSession(session); assert.equal(fork.events.some(e => e.kind === 'hook_result'), false);
    assert.equal(duplicateSessionStart(candidate, fork.sessionStartAttachments('any')), true);
    const id = session.id, forkId = fork.id; session.close(); fork.close();
    for (const target of [id, forkId]) for (let i = 0; i < 2; i++) {
      const read = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import {Session} from ${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)};
        const s=Session.open(process.argv[1],{id:process.argv[2]});console.log(JSON.stringify(s.sessionStartAttachments('any')));s.close();`, root, target], { encoding: 'utf8', timeout: 10000 });
      assert.equal(read.status, 0, read.stderr); assert.equal(duplicateSessionStart(candidate, JSON.parse(read.stdout)), true);
    }
    const reopened = Session.open(root, { id });
    try { reopened.append({ kind: 'compact', summary: 'summary', response: answer }); assert.deepEqual(reopened.sessionStartAttachments('any'), []); }
    finally { reopened.close(); }
    const file = path.join(root, '.agent', `${forkId}.jsonl`);
    const rows = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    rows.find(row => row.kind === 'message' && row.sessionStartContext).sessionStartContext = ['hidden'];
    fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    assert.throws(() => Session.open(root, { id: forkId }), /SessionStart context/);
  } finally { session.close(); fork?.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('compiled CLI suppresses a late async SessionStart duplicate only after synchronous context reaches its message', { timeout: 30000 }, () => {
  const root = temp(), user = path.join(root, 'user'), settings = path.join(root, '.harness');
  const release = path.join(root, 'release'), settled = path.join(root, 'settled'), observed = path.join(root, 'observed.json'), preload = path.join(root, 'provider.mjs');
  fs.mkdirSync(user); fs.mkdirSync(settings); fs.mkdirSync(path.join(root, '.git'));
  const output = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'START_CONTEXT' } };
  fs.writeFileSync(path.join(settings, 'settings.json'), JSON.stringify({ hooks: { SessionStart: [
    { command: `printf s >> runs; ${emit(output)}` },
    { command: `printf a >> runs; while [ ! -f ${quote(release)} ]; do sleep 0.01; done; ${emit(output)}`, async: true, timeout: 10 },
  ] } }));
  fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
    const {AsyncHookRegistry}=await import(${JSON.stringify(new URL('../dist/async-hooks.js', import.meta.url).href)});
    const finish=AsyncHookRegistry.prototype.finish;AsyncHookRegistry.prototype.finish=async function(...args){const value=await finish.apply(this,args);fs.writeFileSync(${JSON.stringify(settled)},'settled');return value};
    const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});let calls=0;
    GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async request=>{calls++;
      const text=JSON.stringify(request.messages);fs.writeFileSync(${JSON.stringify(release)},'release');
      for(let i=0;i<1000&&!fs.existsSync(${JSON.stringify(settled)});i++)await new Promise(r=>setTimeout(r,5));
      if(!fs.existsSync(${JSON.stringify(settled)}))throw Error('hook did not settle');
      fs.writeFileSync(${JSON.stringify(observed)},JSON.stringify({calls,occurrences:text.split('START_CONTEXT').length-1}));return ${JSON.stringify(answer)};};`);
  try {
    const cli = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture', '--interactive', '--no-tui', '--no-inherit-gateway'],
      { input: 'task\n', encoding: 'utf8', timeout: 20000, env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
    assert.equal(cli.status, 0, cli.stderr + cli.stdout);
    assert.deepEqual(JSON.parse(fs.readFileSync(observed, 'utf8')), { calls: 1, occurrences: 1 });
    assert.equal(fs.readFileSync(path.join(root, 'runs'), 'utf8'), 'sa');
    const journals = fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl'));
    assert.equal(journals.length, 1);
    const rows = fs.readFileSync(path.join(root, '.agent', journals[0]!), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    assert.equal(rows.filter(row => row.kind === 'notification_intent_v2').length, 0);
    assert.equal(rows.filter(row => row.kind === 'message' && row.sessionStartContext).length, 1);
    assert.equal(fs.readdirSync(path.join(root, '.agent')).some(name => name.endsWith('.lock')), false);
    fs.unlinkSync(settled);
    const resumed = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--resume', journals[0]!.slice(0, -6),
      '--interactive', '--no-tui', '--no-inherit-gateway'],
      { input: 'second task\n', encoding: 'utf8', timeout: 20000, env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
    assert.equal(resumed.status, 0, resumed.stderr + resumed.stdout);
    assert.deepEqual(JSON.parse(fs.readFileSync(observed, 'utf8')), { calls: 1, occurrences: 1 });
    const resumedRows = fs.readFileSync(path.join(root, '.agent', journals[0]!), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    assert.equal(resumedRows.filter(row => row.kind === 'message' && row.sessionStartContext).length, 1);
    assert.equal(resumedRows.filter(row => row.kind === 'notification_intent_v2').length, 0);
    assert.equal(fs.readFileSync(path.join(root, 'runs'), 'utf8'), 'sasa');
    assert.equal(fs.readdirSync(path.join(root, '.agent')).some(name => name.endsWith('.lock')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
