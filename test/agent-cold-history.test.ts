import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { getEventListeners } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig } from '../src/agent.js';
import { forkSession } from '../src/sessions.js';
import { checkpointConversation, previewRewind, applyRewind } from '../src/rewind.js';
import { turnDiffMessages } from '../src/turn-diff-messages.js';
import { AgentRegistry } from '../src/agent-registry.js';
import { AgentHistoryStore } from '../src/agent-history.js';
import { createRuntime, createSkillTool, pinToolSchemas } from '../src/runtime.js';
import { fingerprintOf, readSessionJournal, Session } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolContext } from '../src/tools.js';
import { ToolCancellation } from '../src/tool-cancellation.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'agent-cold-test-')));
// Root tool-results follow CLAUDE_CONFIG_DIR, including in cold-reader subprocesses.
// Keep persistence fixtures out of the user's actual configuration directory.
const previousConfigDirectory = process.env.CLAUDE_CONFIG_DIR;
let fixtureConfigDirectory: string | undefined;
before(() => {
  fixtureConfigDirectory = temporary();
  process.env.CLAUDE_CONFIG_DIR = fixtureConfigDirectory;
});
after(() => {
  if (previousConfigDirectory === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = previousConfigDirectory;
  if (fixtureConfigDirectory) fs.rmSync(fixtureConfigDirectory, { recursive: true, force: true });
});
const reply = (content: Anthropic.ContentBlock[], stop_reason: Anthropic.Message['stop_reason'] = 'end_turn'): Anthropic.Message => ({
  id: 'owned', model: 'fixture', type: 'message', role: 'assistant', content, stop_reason, stop_sequence: null,
  container: null, diagnostics: null, stop_details: null,
  usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null },
});
const textReply = () => reply([{ type: 'text', text: 'OWNED_COMPLETE', citations: null }]);
const context = (workspace: string): ToolContext => ({ workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 });
const until = async (check: () => boolean, diagnostic: () => string = () => 'owned child settles') => {
  const deadline = Date.now() + 5000;
  while (!check()) { if (Date.now() >= deadline) assert.fail(diagnostic()); await new Promise(resolve => setTimeout(resolve, 5)); }
};
const tool = (runtime: Awaited<ReturnType<typeof createRuntime>>, session: Session, name: string) => {
  const found = runtime.buildTools(session.config, session.id).find(candidate => candidate.schema.name === name);
  assert.ok(found, name); return found;
};

test('concurrent real reads retain descriptor identity across same-mtime replacement', async () => {
  const provider: ModelProvider = { count: async () => 0, complete: async () => textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  const file = path.join(workspace, 'fixture.txt');
  const replacement = path.join(workspace, 'replacement.txt');
  const original = Object.getOwnPropertyDescriptor(fs, 'createReadStream');
  assert.ok(original);
  const opened: Array<{ fd: number; release: () => void }> = [];
  try {
    const stamp = new Date('2020-01-01T00:00:00Z');
    fs.writeFileSync(file, 'OLD_CONTENT');
    fs.utimesSync(file, stamp, stamp);
    const read = tool(runtime, parent, 'read_file');
    const ctx = { ...context(workspace), readFileCache: parent.fileReadCache };
    Object.defineProperty(fs, 'createReadStream', { ...original, value: (...args: Parameters<typeof fs.createReadStream>) => {
      const stream = original.value(...args) as fs.ReadStream;
      const iterator = stream[Symbol.asyncIterator].bind(stream);
      let release = () => {};
      const gate = new Promise<void>(resolve => { release = resolve; });
      const options = args[1];
      assert.ok(options && typeof options === 'object' && typeof options.fd === 'number');
      opened.push({ fd: options.fd, release });
      Object.defineProperty(stream, Symbol.asyncIterator, { value: async function* () {
        await gate;
        yield* iterator();
      } });
      return stream;
    } });
    const gatedStream = Object.getOwnPropertyDescriptor(fs, 'createReadStream');
    assert.ok(gatedStream);
    const first = read.execute({ path: 'fixture.txt' }, ctx);
    assert.equal(opened.length, 1);
    const oldStat = fs.fstatSync(opened[0]!.fd);
    fs.writeFileSync(replacement, 'NEW_CONTENT');
    fs.utimesSync(replacement, stamp, stamp);
    fs.renameSync(replacement, file);
    const second = read.execute({ path: 'fixture.txt' }, ctx);
    assert.equal(opened.length, 2);
    const newStat = fs.fstatSync(opened[1]!.fd);
    assert.notEqual(oldStat.ino, newStat.ino);
    assert.equal(Math.floor(oldStat.mtimeMs), Math.floor(newStat.mtimeMs));
    opened[1]!.release();
    assert.equal(await second, 'NEW_CONTENT');
    opened[0]!.release();
    assert.equal(await first, 'OLD_CONTENT');
    const last = parent.fileReadCache.get(file);
    assert.equal(last?.content, 'OLD_CONTENT');
    assert.ok(last);
    parent.fileReadCache.set(file, { ...last, contentNotInModelContext: false });
    Object.defineProperty(fs, 'createReadStream', original);
    assert.equal(await read.execute({ path: 'fixture.txt' }, ctx), 'NEW_CONTENT');
    assert.equal(parent.fileReadCache.get(file)?.content, 'NEW_CONTENT');
    fs.writeFileSync(path.join(workspace, 'other.txt'), 'OTHER_CONTENT');
    Object.defineProperty(fs, 'createReadStream', gatedStream);
    const firstKey = read.execute({ path: 'fixture.txt' }, ctx);
    const secondKey = read.execute({ path: 'other.txt' }, ctx);
    assert.equal(opened.length, 4);
    assert.notEqual(fs.fstatSync(opened[2]!.fd).ino, fs.fstatSync(opened[3]!.fd).ino);
    opened[3]!.release();
    assert.equal(await secondKey, 'OTHER_CONTENT');
    opened[2]!.release();
    assert.deepEqual(await Promise.all([firstKey, secondKey]), ['NEW_CONTENT', 'OTHER_CONTENT']);
    assert.equal(parent.fileReadCache.get(file)?.content, 'NEW_CONTENT');
    assert.equal(parent.fileReadCache.get(path.join(workspace, 'other.txt'))?.content, 'OTHER_CONTENT');
  } finally {
    for (const entry of opened) entry.release();
    Object.defineProperty(fs, 'createReadStream', original);
    await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('agent journals concurrent descriptor replacements for cold reconstruction', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1 ? reply([
    { type: 'tool_use', id: 'old-fd', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'new-fd', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
  ], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  const file = path.join(workspace, 'fixture.txt');
  const replacement = path.join(workspace, 'replacement.txt');
  const stamp = new Date('2020-01-01T00:00:00Z');
  const original = Object.getOwnPropertyDescriptor(fs, 'createReadStream');
  assert.ok(original);
  const opened: Array<{ fd: number; release: () => void }> = [];
  try {
    fs.writeFileSync(file, 'OLD_CONTENT'); fs.utimesSync(file, stamp, stamp);
    fs.writeFileSync(replacement, 'NEW_CONTENT'); fs.utimesSync(replacement, stamp, stamp);
    Object.defineProperty(fs, 'createReadStream', { ...original, value: (...args: Parameters<typeof fs.createReadStream>) => {
      const stream = original.value(...args) as fs.ReadStream;
      const iterator = stream[Symbol.asyncIterator].bind(stream);
      let release = () => {};
      const gate = new Promise<void>(resolve => { release = resolve; });
      const options = args[1];
      assert.ok(options && typeof options === 'object' && typeof options.fd === 'number');
      opened.push({ fd: options.fd, release });
      if (opened.length === 1) fs.renameSync(replacement, file);
      Object.defineProperty(stream, Symbol.asyncIterator, { value: async function* () { await gate; yield* iterator(); } });
      return stream;
    } });
    const running = new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('read both');
    await until(() => opened.length === 2);
    const oldStat = fs.fstatSync(opened[0]!.fd), newStat = fs.fstatSync(opened[1]!.fd);
    assert.notEqual(oldStat.ino, newStat.ino);
    assert.equal(Math.floor(oldStat.mtimeMs), Math.floor(newStat.mtimeMs));
    opened[1]!.release();
    await until(() => parent.fileReadCache.get(file)?.content === 'NEW_CONTENT');
    opened[0]!.release();
    assert.equal((await running).reason, 'end_turn');
    assert.equal(parent.fileReadCache.get(file)?.content, 'OLD_CONTENT');
    const rows = parent.events.filter(event => event.kind === 'tool_result' && ['old-fd', 'new-fd'].includes(event.result.tool_use_id));
    assert.deepEqual(rows.map(event => event.kind === 'tool_result' && [event.result.tool_use_id, event.result.content]),
      [['old-fd', 'OLD_CONTENT'], ['new-fd', 'NEW_CONTENT']]);
    Object.defineProperty(fs, 'createReadStream', original);
    const id = parent.id;
    await runtime.close(); parent.close();
    const script = `
      import fs from 'node:fs'; import path from 'node:path';
      import {Session} from './src/session.ts'; import {Agent} from './src/agent.ts'; import {createRuntime} from './src/runtime.ts';
      const [workspace,id] = process.argv.slice(1); const session = Session.open(workspace,{id});
      const file=path.join(workspace,'fixture.txt'); const entry=session.fileReadCache.get(file);
      const tmp=path.join(workspace,'third.txt'); fs.writeFileSync(tmp,'THIRD_CONTENT');
      const stamp=new Date('2020-01-01T00:00:00Z'); fs.utimesSync(tmp,stamp,stamp); fs.renameSync(tmp,file);
      let calls=0, output=''; const provider={count:async()=>0,complete:async()=>({id:'cold',model:'fixture',type:'message',role:'assistant',
        content:++calls===1?[{type:'tool_use',id:'cold-read',name:'read_file',input:{path:'fixture.txt'},caller:{type:'direct'}}]:[{type:'text',text:'done',citations:null}],
        stop_reason:calls===1?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:0,output_tokens:0}})};
      const runtime=await createRuntime(session.config,provider,new AbortController().signal); await runtime.bindSession(session);
      const agent=new Agent(session,provider,runtime.buildTools(session.config,session.id),{toolResult:e=>{if(e.id==='cold-read')output=e.content}});
      const result=await agent.run('read after restart'); await runtime.close(); session.close();
      process.stdout.write(JSON.stringify({entry,output,reason:result.reason}));`;
    const cold = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, workspace, id],
      { cwd: process.cwd(), encoding: 'utf8' }));
    assert.equal(cold.entry.content, 'NEW_CONTENT');
    assert.equal(cold.output, 'THIRD_CONTENT');
    assert.equal(cold.reason, 'end_turn');
  } finally {
    for (const entry of opened) entry.release();
    Object.defineProperty(fs, 'createReadStream', original);
    await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('owner release during concurrent reads preserves their completed journal results', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1 ? reply([
    { type: 'tool_use', id: 'release-first', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'release-second', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
  ], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  const original = Object.getOwnPropertyDescriptor(fs, 'createReadStream'); assert.ok(original);
  const gates: Array<() => void> = [];
  try {
    Object.defineProperty(fs, 'createReadStream', { ...original, value: (...args: Parameters<typeof fs.createReadStream>) => {
      const stream = original.value(...args) as fs.ReadStream;
      const iterator = stream[Symbol.asyncIterator].bind(stream);
      let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; }); gates.push(release);
      Object.defineProperty(stream, Symbol.asyncIterator, { value: async function* () { await gate; yield* iterator(); } });
      return stream;
    } });
    const running = new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('read during release');
    await until(() => gates.length === 2);
    gates[0]!();
    await until(() => parent.events.some(event => event.kind === 'tool_result' && event.result.tool_use_id === 'release-first'));
    await runtime.releaseSession!(parent.id);
    gates[1]!();
    assert.equal((await running).reason, 'end_turn');
    const id = parent.id; await runtime.close(); parent.close();
    const reopened = Session.open(workspace, { id });
    try {
      const rows = reopened.events.filter(event => event.kind === 'tool_result' && ['release-first', 'release-second'].includes(event.result.tool_use_id));
      assert.deepEqual(rows.map(event => event.kind === 'tool_result' && [event.result.tool_use_id, event.result.content]),
        [['release-first', 'OWNED_FILE'], ['release-second', 'OWNED_FILE']]);
    } finally { reopened.close(); }
  } finally {
    for (const release of gates) release(); Object.defineProperty(fs, 'createReadStream', original);
    await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('agent publishes batched reads before marking them visible and clears cache on compaction', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    calls++;
    if (calls === 1) return reply([
      { type: 'tool_use', id: 'batch-read', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
      { type: 'tool_use', id: 'batch-second', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    ], 'tool_use');
    return textReply();
  } };
  const { workspace, runtime, parent } = await setup(provider);
  const file = path.join(workspace, 'fixture.txt');
  try {
    let observed = false;
    const outputs: string[] = [];
    const signals: AbortSignal[] = [];
    const tools = runtime.buildTools(parent.config, parent.id);
    const read = tools.find(candidate => candidate.schema.name === 'read_file');
    assert.ok(read);
    const wrapped = { ...read, execute(input: unknown, context: ToolContext) {
      signals.push(context.signal);
      return read.execute(input, context);
    } };
    const agent = new Agent(parent, provider, tools.map(candidate => candidate === read ? wrapped : candidate), {
      toolResult: event => { outputs.push(String(event.content)); if (event.id === 'batch-read') {
        assert.equal(parent.fileReadCache.get(file)?.contentNotInModelContext, true); observed = true;
      } },
    });
    await agent.run('read and observe');
    assert.equal(observed, true);
    assert.equal(signals.length, 2);
    assert.notEqual(signals[0], signals[1]);
    assert.deepEqual(outputs, ['OWNED_FILE', 'OWNED_FILE']);
    assert.equal(parent.fileReadCache.get(file)?.contentNotInModelContext, false);
    await agent.compactContext();
    assert.equal(parent.fileReadCache.has(file), false);
    const id = parent.id;
    parent.close();
    const reopened = Session.open(workspace, { id });
    try { assert.equal(reopened.fileReadCache.has(file), false); } finally { reopened.close(); }
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('agent propagates explicit tool cancellation and preserves returned versus thrown sibling outcomes', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1 ? reply([
    { type: 'tool_use', id: 'cancel-first', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'cancel-second', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
  ], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  try {
    const tools = runtime.buildTools(parent.config, parent.id);
    const read = tools.find(candidate => candidate.schema.name === 'read_file');
    assert.ok(read);
    let entered = 0;
    let release = () => {};
    const identities: AbortSignal[] = [];
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const reason = new Error('owned tool cancellation');
    const wrapped = { ...read, async execute(_input: unknown, context: ToolContext) {
      const index = entered++;
      if (context.authorizationIdentity) identities.push(context.authorizationIdentity.signal);
      await barrier;
      const controller = context.abortController;
      assert.ok(controller, 'tool has a call-owned cancellation controller');
      if (index === 0) controller.abort(reason);
      assert.equal(context.signal.reason, reason);
      if (index === 1) throw reason;
      return 'cancelled';
    } };
    const running = new Agent(parent, provider, tools.map(candidate => candidate === read ? wrapped : candidate)).run('cancel');
    await until(() => entered === 2);
    assert.ok(identities.every(identity => !identity.aborted));
    release();
    const result = await running;
    assert.equal(result.reason, 'aborted');
    assert.ok(identities.every(identity => identity.aborted));
    assert.equal(entered, 2);
    assert.equal(calls, 1);
    // KWo, sfn1dbxq [2292400,2294250)/[2302000,2304720), UTF-16:
    // a completed tool return is retained even when the shared signal is aborted.
    assert.ok(parent.events.some(event => event.kind === 'tool_result' && event.result.tool_use_id === 'cancel-first' && event.result.content === 'cancelled'));
    assert.ok(parent.events.some(event => event.kind === 'tool_result' && event.result.tool_use_id === 'cancel-second' && String(event.result.content).includes(reason.message)));
    const persisted = parent.events.filter(event => event.kind === 'tool_result' && ['cancel-first', 'cancel-second'].includes(event.result.tool_use_id));
    assert.deepEqual(persisted.map(event => event.kind === 'tool_result' && [event.result.tool_use_id, event.result.is_error]),
      [['cancel-first', undefined], ['cancel-second', true]]);
    const id = parent.id;
    await runtime.close(); parent.close();
    const reopened = Session.open(workspace, { id });
    try {
      const rows = reopened.events.filter(event => event.kind === 'tool_result' && ['cancel-first', 'cancel-second'].includes(event.result.tool_use_id));
      assert.deepEqual(rows.map(event => event.kind === 'tool_result' && [event.result.tool_use_id, event.result.is_error]),
        [['cancel-first', undefined], ['cancel-second', true]]);
    } finally { reopened.close(); }
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('cancellation coordinator propagates concurrent child and parent reasons and releases listeners', async () => {
  const parent = new AbortController();
  const initial = getEventListeners(parent.signal, 'abort').length;
  const group = new ToolCancellation(parent.signal);
  const first = group.call();
  const second = group.call();
  const reason = new Error('child cancellation');
  let release = () => {};
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const sibling = (async () => { await barrier; return second.controller.signal.reason; })();
  first.controller.abort(reason);
  release();
  assert.equal(await sibling, reason);
  assert.equal(group.signal.reason, reason);
  assert.equal(parent.signal.aborted, false);
  first.dispose(); second.dispose(); group.dispose();
  assert.equal(getEventListeners(parent.signal, 'abort').length, initial);
  assert.equal(getEventListeners(group.signal, 'abort').length, 0);
  assert.equal(getEventListeners(first.controller.signal, 'abort').length, 0);
  assert.equal(getEventListeners(second.controller.signal, 'abort').length, 0);
  const other = new ToolCancellation(parent.signal);
  const child = other.call();
  const parentReason = new Error('parent cancellation');
  parent.abort(parentReason);
  assert.equal(child.controller.signal.reason, parentReason);
  child.dispose(); other.dispose();
});

test('ordinary tool failure preserves the turn and executes the following tool', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1 ? reply([
    { type: 'tool_use', id: 'fail-first', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'after-failure', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
  ], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  try {
    const tools = runtime.buildTools(parent.config, parent.id);
    const read = tools.find(candidate => candidate.schema.name === 'read_file');
    assert.ok(read);
    let entered = 0;
    const wrapped = { ...read, async execute(input: unknown, context: ToolContext) {
      if (++entered === 1) throw new Error('ordinary failure');
      return read.execute(input, context);
    } };
    const result = await new Agent(parent, provider, tools.map(candidate => candidate === read ? wrapped : candidate)).run('continue');
    assert.equal(result.reason, 'end_turn');
    assert.equal(entered, 2);
    assert.equal(calls, 2);
    assert.ok(parent.events.some(event => event.kind === 'tool_result' && event.result.tool_use_id === 'fail-first' && String(event.result.content).includes('ordinary failure')));
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('agent starts compatible file reads together and pairs results in call order', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1 ? reply([
    { type: 'tool_use', id: 'parallel-first', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'parallel-second', name: 'read_file', input: { path: 'second.txt' }, caller: { type: 'direct' } },
  ], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  fs.writeFileSync(path.join(workspace, 'second.txt'), 'SECOND');
  try {
    const tools = runtime.buildTools(parent.config, parent.id);
    const read = tools.find(candidate => candidate.schema.name === 'read_file');
    assert.ok(read);
    let entered = 0;
    let firstReturned = false;
    let overlapped = false;
    let release = () => {};
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const wrapped = { ...read, async execute(input: unknown, context: ToolContext) {
      if (++entered === 2) { overlapped = !firstReturned; release(); }
      await Promise.race([barrier, new Promise<void>(resolve => setTimeout(resolve, 100))]);
      firstReturned = true;
      if (entered < 2) release();
      return read.execute(input, context);
    } };
    await new Agent(parent, provider, tools.map(candidate => candidate === read ? wrapped : candidate)).run('read both');
    assert.equal(entered, 2);
    assert.equal(overlapped, true, 'both reads must enter before either returns');
    const batch = parent.messages.find(message => Array.isArray(message.content) && message.content.some(block => block.type === 'tool_result'));
    assert.ok(batch && Array.isArray(batch.content));
    assert.deepEqual(batch.content.filter(block => block.type === 'tool_result').map(block => block.tool_use_id), ['parallel-first', 'parallel-second']);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('agent starts two source-safe Reads together with PreToolUse hook', { skip: process.env.RUN_W385_HOOK_CONCURRENCY_RED !== '1' }, async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1 ? reply([
    { type: 'tool_use', id: 'hook-parallel-first', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'hook-parallel-second', name: 'read_file', input: { path: 'second.txt' }, caller: { type: 'direct' } },
  ], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider, 24000, () => ({
    PreToolUse: [{ hooks: [{ type: 'command', command: `printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'` }] }],
  }));
  fs.writeFileSync(path.join(workspace, 'second.txt'), 'SECOND');
  try {
    const tools = runtime.buildTools(parent.config, parent.id);
    const read = tools.find(tool => tool.schema.name === 'read_file');
    assert.ok(read);
    let entered = 0, firstReturned = false, overlapped = false, release = () => {};
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const wrapped = { ...read, async execute(input: unknown, context: ToolContext) {
      if (++entered === 2) { overlapped = !firstReturned; release(); }
      await Promise.race([barrier, new Promise<void>(resolve => setTimeout(resolve, 250))]);
      firstReturned = true;
      if (entered < 2) release();
      return read.execute(input, context);
    } };
    await new Agent(parent, provider, tools.map(tool => tool === read ? wrapped : tool)).run('read both with hooks');
    assert.equal(entered, 2);
    assert.equal(overlapped, true, 'both hooked reads must enter before either returns');
    const batch = parent.messages.find(message => Array.isArray(message.content) && message.content.some(block => block.type === 'tool_result'));
    assert.ok(batch && Array.isArray(batch.content));
    assert.deepEqual(batch.content.filter(block => block.type === 'tool_result').map(block => block.tool_use_id), ['hook-parallel-first', 'hook-parallel-second']);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('hooked Read rewrite denial and permission update retain their call ownership', { skip: process.env.RUN_W385_HOOK_CONCURRENCY_RED !== '1' }, async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1 ? reply([
    { type: 'tool_use', id: 'rewrite-denied', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'rewrite-updated', name: 'read_file', input: { path: 'second.txt' }, caller: { type: 'direct' } },
  ], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider, 24000, root => {
    const script = path.join(root, 'pre-hook.cjs');
    fs.writeFileSync(script, `const fs = require('node:fs');\nlet input = ''; process.stdin.on('data', x => input += x); process.stdin.on('end', async () => {\nconst call = JSON.parse(input); const first = call.tool_use_id === 'rewrite-denied';\nif (first) { const deadline = Date.now() + 1000; while (!fs.existsSync(${JSON.stringify(path.join(root, 'second-entered'))}) && Date.now() < deadline) await new Promise(r => setTimeout(r, 10)); fs.writeFileSync(${JSON.stringify(path.join(root, 'overlapped'))}, String(fs.existsSync(${JSON.stringify(path.join(root, 'second-entered'))}))); }\nprocess.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',updatedInput:{path:first?'blocked.txt':'asked.txt'}}})); });`);
    const update = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow', updatedPermissions: [
      { type: 'addRules', behavior: 'deny', destination: 'session', rules: [{ toolName: 'write_file' }] },
    ] } } });
    return { PreToolUse: [{ hooks: [{ type: 'command', command: `node ${JSON.stringify(script)}` }] }],
      PermissionRequest: [{ hooks: [{ type: 'command', command: `printf '%s' '${update}'` }] }] };
  });
  fs.writeFileSync(path.join(workspace, 'second.txt'), 'SECOND');
  fs.writeFileSync(path.join(workspace, 'asked.txt'), 'ASKED_CONTENT');
  parent.adoptPermissionUpdates([
    { type: 'setMode', mode: 'default', destination: 'session' },
    { type: 'addRules', behavior: 'deny', destination: 'session', rules: [{ toolName: 'Read', ruleContent: 'blocked.txt' }] },
    { type: 'addRules', behavior: 'ask', destination: 'session', rules: [{ toolName: 'Read', ruleContent: 'asked.txt' }] },
  ]);
  try {
    const tools = runtime.buildTools(parent.config, parent.id);
    const read = tools.find(candidate => candidate.schema.name === 'read_file');
    assert.ok(read);
    const inputs: unknown[] = [];
    const wrapped = { ...read, async execute(input: unknown, ctx: ToolContext) {
      inputs.push(structuredClone(input));
      fs.writeFileSync(path.join(workspace, 'second-entered'), 'entered');
      return read.execute(input, ctx);
    } };
    await new Agent(parent, provider, tools.map(candidate => candidate === read ? wrapped : candidate)).run('read both');
    assert.deepEqual(inputs, [{ path: 'asked.txt' }]);
    assert.ok(parent.permissionOwner.state().deny.includes('write_file'));
    const batch = parent.messages.find(message => Array.isArray(message.content) && message.content.some(block => block.type === 'tool_result'));
    assert.ok(batch && Array.isArray(batch.content));
    const results = batch.content.filter(block => block.type === 'tool_result');
    assert.deepEqual(results.map(result => result.tool_use_id), ['rewrite-denied', 'rewrite-updated']);
    assert.equal(results[0]?.is_error, true);
    assert.match(String(results[1]?.content), /ASKED_CONTENT/);
    assert.equal(fs.readFileSync(path.join(workspace, 'overlapped'), 'utf8'), 'true', 'second Read must execute while first hook is held');
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('agent holds an unknown tool as a barrier between Read groups', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1 ? reply([
    { type: 'tool_use', id: 'before', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'unknown', name: 'unknown_tool', input: {}, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'after', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
  ], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  try {
    const tools = runtime.buildTools(parent.config, parent.id);
    await new Agent(parent, provider, tools).run('read across barrier');
    const events = parent.events;
    const before = events.findIndex(event => event.kind === 'tool_result' && event.result.tool_use_id === 'before');
    const barrier = events.findIndex(event => event.kind === 'tool_result' && event.result.tool_use_id === 'unknown');
    const after = events.findIndex(event => event.kind === 'tool_start' && event.id === 'after');
    assert.ok(before >= 0 && before < barrier && barrier < after);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('agent delivers same-key reads in call order when they finish in reverse', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1 ? reply([
    { type: 'tool_use', id: 'first', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'second', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
  ], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  try {
    const tools = runtime.buildTools(parent.config, parent.id);
    const read = tools.find(tool => tool.schema.name === 'read_file');
    assert.ok(read);
    let count = 0, release = () => {};
    const secondFinished = new Promise<void>(resolve => { release = resolve; });
    const completion: number[] = [];
    const wrapped = { ...read, async execute(input: unknown, context: ToolContext) {
      const order = ++count;
      if (order === 1) await secondFinished;
      const value = await read.execute(input, context);
      completion.push(order);
      if (order === 2) release();
      return value;
    } };
    await new Agent(parent, provider, tools.map(tool => tool === read ? wrapped : tool)).run('read same file');
    assert.deepEqual(completion, [2, 1]);
    const result = parent.messages.find(message => Array.isArray(message.content) && message.content.some(block => block.type === 'tool_result'));
    assert.ok(result && Array.isArray(result.content));
    assert.deepEqual(result.content.filter(block => block.type === 'tool_result').map(block => block.tool_use_id), ['first', 'second']);
    assert.equal(parent.fileReadCache.get(path.join(workspace, 'fixture.txt'))?.contentNotInModelContext, false);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('parent cancellation reaches both running Agent reads', async () => {
  const provider: ModelProvider = { count: async () => 0, complete: async () => reply([
    { type: 'tool_use', id: 'parent-first', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'parent-second', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
  ], 'tool_use') };
  const { workspace, runtime, parent } = await setup(provider);
  try {
    const tools = runtime.buildTools(parent.config, parent.id);
    const read = tools.find(tool => tool.schema.name === 'read_file');
    assert.ok(read);
    const signals: AbortSignal[] = [];
    const wrapped = { ...read, async execute(_input: unknown, context: ToolContext) {
      signals.push(context.signal);
      await new Promise<void>(resolve => context.signal.addEventListener('abort', () => resolve(), { once: true }));
      context.signal.throwIfAborted();
      return '';
    } };
    const controller = new AbortController();
    const running = new Agent(parent, provider, tools.map(tool => tool === read ? wrapped : tool)).run('cancel reads', controller.signal);
    await until(() => signals.length === 2);
    const reason = new Error('parent cancelled');
    controller.abort(reason);
    assert.equal((await running).reason, 'aborted');
    assert.ok(signals.every(signal => signal.reason === reason));
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('Read hooks and their approval requests remain ordered', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1 ? reply([
    { type: 'tool_use', id: 'hook-first', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'hook-second', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
  ], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider, 24000, () => ({
    PreToolUse: [{ hooks: [{ type: 'command', command: `printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask"}}'` }] }],
  }));
  try {
    let approvals = 0;
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id), {
      permissionPrompt: 'interactive', permission: async () => { approvals++; return true; },
    }).run('read with approval');
    assert.equal(approvals, 2);
    const events = parent.events;
    const first = events.findIndex(event => event.kind === 'tool_result' && event.result.tool_use_id === 'hook-first');
    const second = events.findIndex(event => event.kind === 'tool_start' && event.id === 'hook-second');
    assert.ok(first >= 0 && first < second);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('agent keeps late file result callbacks bound to their original call', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1 ? reply([
    { type: 'tool_use', id: 'first-read', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    { type: 'tool_use', id: 'second-read', name: 'read_file', input: { path: 'second.txt' }, caller: { type: 'direct' } },
  ], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  fs.writeFileSync(path.join(workspace, 'second.txt'), 'SECOND');
  try {
    const tools = runtime.buildTools(parent.config, parent.id);
    const read = tools.find(candidate => candidate.schema.name === 'read_file');
    assert.ok(read);
    let replay: (() => void) | undefined;
    let count = 0;
    const wrapped = { ...read, async execute(input: unknown, context: ToolContext) {
      count++;
      if (count === 1) return read.execute(input, { ...context, hostResult: value => {
        context.hostResult?.(value); replay = () => context.hostResult?.(value);
      } });
      const result = await read.execute(input, context);
      assert.ok(replay); replay();
      return result;
    } };
    await new Agent(parent, provider, tools.map(candidate => candidate === read ? wrapped : candidate)).run('read both');
    const results = parent.events.filter(event => event.kind === 'tool_result');
    const first = results.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'first-read');
    const second = results.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'second-read');
    assert.ok(first?.kind === 'tool_result' && first.host && 'kind' in first.host && first.host.kind === 'file_read');
    assert.ok(second?.kind === 'tool_result' && second.host && 'kind' in second.host && second.host.kind === 'file_read');
    assert.equal(first.host.content, 'OWNED_FILE');
    assert.equal(second.host.content, 'SECOND');
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('agent deduplicates visible reads and rereads changed or compacted files', async () => {
  let calls = 0;
  let compacting = false;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    if (compacting) return textReply();
    calls++;
    return calls % 2 === 1 ? reply([{ type: 'tool_use', id: `read-${calls}`, name: 'read_file',
      input: { path: 'fixture.txt' }, caller: { type: 'direct' } }], 'tool_use') : textReply();
  } };
  const { workspace, runtime, parent } = await setup(provider);
  const file = path.join(workspace, 'fixture.txt');
  const outputs: string[] = [];
  try {
    const agent = new Agent(parent, provider, runtime.buildTools(parent.config, parent.id), {
      toolResult: event => outputs.push(String(event.content)),
    });
    await agent.run('read');
    await agent.run('read again');
    assert.match(outputs[1], /file unchanged since your last Read/);
    fs.writeFileSync(file, 'CHANGED');
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(file, later, later);
    await agent.run('read changed');
    assert.equal(outputs[2], 'CHANGED');
    compacting = true;
    await agent.compactContext();
    compacting = false;
    await agent.run('read after compaction');
    assert.equal(outputs[3], 'CHANGED');
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('real agent rereads same-mtime inode replacement through retargeted alias', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls % 2 === 1
    ? reply([{ type: 'tool_use', id: `alias-replace-${calls}`, name: 'read_file',
      input: { path: 'alias.txt' }, caller: { type: 'direct' } }], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  const alias = path.join(workspace, 'alias.txt'), target = path.join(workspace, 'target.txt');
  const outputs: string[] = [];
  let cold: Session | undefined;
  try {
    fs.writeFileSync(target, 'OLD_TARGET');
    const fixedTime = new Date(1700000000000);
    fs.utimesSync(target, fixedTime, fixedTime);
    fs.symlinkSync('fixture.txt', alias);
    const agent = new Agent(parent, provider, runtime.buildTools(parent.config, parent.id), {
      toolResult: event => outputs.push(String(event.content)),
    });
    await agent.run('read original alias');
    assert.equal(parent.fileReadCache.get(alias)?.content, 'OWNED_FILE');
    await agent.run('repeat same lexical read');
    assert.match(outputs.at(-1)!, /file unchanged/);
    fs.unlinkSync(alias); fs.symlinkSync('target.txt', alias);
    await agent.run('read retargeted alias');
    const previous = fs.statSync(target);
    const replacement = path.join(workspace, 'replacement.txt');
    fs.writeFileSync(replacement, 'NEW_TARGET');
    fs.utimesSync(replacement, previous.atime, previous.mtime);
    fs.renameSync(replacement, target);
    assert.notEqual(fs.statSync(target).ino, previous.ino);
    assert.equal(Math.floor(fs.statSync(target).mtimeMs), Math.floor(previous.mtimeMs));
    await agent.run('read replaced alias');
    assert.equal(outputs[0], 'OWNED_FILE');
    assert.equal(outputs[2], 'OLD_TARGET');
    assert.equal(outputs[3], 'NEW_TARGET');
    assert.equal(fs.readFileSync(target, 'utf8'), 'NEW_TARGET');
    const id = parent.id;
    parent.close();
    cold = Session.open(workspace, { id });
    assert.equal(cold.fileReadCache.get(alias)?.content, 'NEW_TARGET');
    assert.equal(cold.fileReadCache.has(target), false);
    const coldAgent = new Agent(cold, provider, runtime.buildTools(cold.config, cold.id), {
      toolResult: event => outputs.push(String(event.content)),
    });
    await coldAgent.run('repeat after restart');
    assert.match(outputs.at(-1)!, /file unchanged/);
    fs.unlinkSync(alias); fs.symlinkSync('fixture.txt', alias);
    await coldAgent.run('retarget after restart');
    assert.equal(outputs.at(-1), 'OWNED_FILE');
    fs.linkSync(path.join(workspace, 'fixture.txt'), path.join(workspace, 'hardlink.txt'));
    fs.unlinkSync(alias); fs.symlinkSync('hardlink.txt', alias);
    await coldAgent.run('retarget to same inode at another real path');
    assert.equal(outputs.at(-1), 'OWNED_FILE');
  } finally { cold?.close(); await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('cold read identity rejects replacement, foreign device and legacy observations', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls % 2 === 1
    ? reply([{ type: 'tool_use', id: `identity-${calls}`, name: 'read_file',
      input: { path: 'fixture.txt' }, caller: { type: 'direct' } }], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  const file = path.join(workspace, 'fixture.txt'), outputs: string[] = [];
  let cold: Session | undefined;
  try {
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('read');
    const id = parent.id;
    parent.close();
    cold = Session.open(workspace, { id });
    const agent = new Agent(cold, provider, runtime.buildTools(cold.config, cold.id), {
      toolResult: event => outputs.push(String(event.content)),
    });
    await agent.run('unchanged after restart');
    assert.match(outputs.at(-1)!, /file unchanged since your last Read/);
    const old = fs.statSync(file), replacement = path.join(workspace, 'replacement.txt');
    fs.writeFileSync(replacement, 'COLD_REPLACEMENT');
    fs.utimesSync(replacement, old.atimeMs / 1000, old.mtimeMs / 1000);
    fs.renameSync(replacement, file);
    assert.notEqual(fs.statSync(file).ino, old.ino);
    await agent.run('replacement after restart');
    assert.equal(outputs.at(-1), 'COLD_REPLACEMENT');
    const cached = cold.fileReadCache.get(file);
    assert.ok(cached.identity);
    cold.fileReadCache.set(file, { ...cached, identity: { ...cached.identity, dev: `${cached.identity.dev}0` } });
    await agent.run('different device');
    assert.equal(outputs.at(-1), 'COLD_REPLACEMENT');
    const current = cold.fileReadCache.get(file);
    cold.fileReadCache.set(file, { ...current, identity: undefined });
    await agent.run('legacy cache');
    assert.equal(outputs.at(-1), 'COLD_REPLACEMENT');
    await agent.run('deduplicate again');
    assert.match(outputs.at(-1)!, /file unchanged since your last Read/);
  } finally { cold?.close(); await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('legacy persisted read observation reopens and rereads a same-mtime replacement', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls % 2 === 1
    ? reply([{ type: 'tool_use', id: `legacy-persisted-${calls}`, name: 'read_file',
      input: { path: 'fixture.txt' }, caller: { type: 'direct' } }], 'tool_use') : textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  const file = path.join(workspace, 'fixture.txt'), outputs: string[] = [];
  let cold: Session | undefined;
  try {
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('read');
    const id = parent.id, journal = parent.file;
    parent.close();
    const records = fs.readFileSync(journal, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const observed = records.find(record => record.kind === 'tool_result' && record.host?.kind === 'file_read');
    assert.ok(observed?.host.identity);
    delete observed.host.identity;
    delete observed.host.cacheKey;
    fs.writeFileSync(journal, `${records.map(record => JSON.stringify(record)).join('\n')}\n`);
    const old = fs.statSync(file), replacement = path.join(workspace, 'replacement.txt');
    fs.writeFileSync(replacement, 'LEGACY_REPLACEMENT');
    fs.utimesSync(replacement, old.atimeMs / 1000, old.mtimeMs / 1000);
    fs.renameSync(replacement, file);
    assert.notEqual(fs.statSync(file).ino, old.ino);
    assert.equal(Math.floor(fs.statSync(file).mtimeMs), Math.floor(old.mtimeMs));
    cold = Session.open(workspace, { id });
    assert.equal(cold.fileReadCache.get(file)?.identity, undefined);
    const agent = new Agent(cold, provider, runtime.buildTools(cold.config, cold.id), {
      toolResult: event => outputs.push(String(event.content)),
    });
    await agent.run('read after legacy restart');
    assert.equal(outputs.at(-1), 'LEGACY_REPLACEMENT');
    assert.ok(cold.fileReadCache.get(file)?.identity);
    await agent.run('read again');
    assert.match(outputs.at(-1)!, /file unchanged since your last Read/);
  } finally { cold?.close(); await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('write and edit retain lexical directory aliases across restart', async () => {
  for (const operation of ['write_file', 'edit_file'] as const) {
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => {
      calls++;
      if (calls === 1) return reply([{ type: 'tool_use', id: `lexical-read-${operation}`, name: 'read_file',
        input: { path: 'alias/file.txt' }, caller: { type: 'direct' } }], 'tool_use');
      if (calls !== 2) return textReply();
      const input = operation === 'write_file'
        ? { path: 'alias/file.txt', content: 'LANDED', overwrite: true }
        : { path: 'alias/file.txt', old_string: 'OWNED_FILE', new_string: 'LANDED' };
      return reply([{ type: 'tool_use', id: `lexical-${operation}`, name: operation, input, caller: { type: 'direct' } }], 'tool_use');
    } };
    const { workspace, runtime, parent } = await setup(provider);
    const directory = path.join(workspace, 'actual'), alias = path.join(workspace, 'alias');
    const real = path.join(directory, 'file.txt'), key = path.join(alias, 'file.txt');
    let cold: Session | undefined;
    try {
      fs.mkdirSync(directory); fs.writeFileSync(real, 'OWNED_FILE'); fs.symlinkSync('actual', alias);
      parent.config.model = 'claude-sonnet-4-5';
      const outputs: string[] = [];
      await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id), {
        toolResult: event => outputs.push(String(event.content)),
      }).run('mutate alias');
      assert.equal(outputs[0], 'OWNED_FILE');
      assert.match(outputs[1], operation === 'write_file' ? /overwrote/ : /edited/);
      assert.equal(fs.readFileSync(real, 'utf8'), 'LANDED');
      assert.equal(parent.fileReadCache.get(key)?.content, 'LANDED');
      assert.equal(parent.fileReadCache.has(real), false);
      const id = parent.id; parent.close();
      cold = Session.open(workspace, { id });
      assert.equal(cold.fileReadCache.get(key)?.content, 'LANDED');
      assert.equal(cold.fileReadCache.has(real), false);
    } finally { cold?.close(); await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
  }
});

test('landed write and edit identity survives restart and legacy rows fail safe', async () => {
  for (const operation of ['write_file', 'edit_file'] as const) for (const legacy of [false, true]) {
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => {
      calls++;
      if (calls % 2 === 0) return textReply();
      const input = calls === 1 ? operation === 'write_file'
        ? { path: 'fixture.txt', content: 'LANDED', overwrite: true }
        : { path: 'fixture.txt', old_string: 'OWNED_FILE', new_string: 'LANDED' }
        : { path: 'fixture.txt' };
      return reply([{ type: 'tool_use', id: `landed-${calls}`, name: calls === 1 ? operation : 'read_file',
        input, caller: { type: 'direct' } }], 'tool_use');
    } };
    const { workspace, runtime, parent } = await setup(provider);
    const file = path.join(workspace, 'fixture.txt'), outputs: string[] = [];
    let cold: Session | undefined;
    try {
      await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('mutate');
      assert.equal(fs.readFileSync(file, 'utf8'), 'LANDED');
      const id = parent.id, journal = parent.file, stat = fs.statSync(file, { bigint: true });
      const records = fs.readFileSync(journal, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
      const effect = records.find(record => record.kind === 'tool_result' && record.host?.landed);
      assert.deepEqual(effect.host.landed.identity, { dev: String(stat.dev), ino: String(stat.ino) });
      parent.close();
      if (legacy) {
        delete effect.host.landed;
        fs.writeFileSync(journal, `${records.map(record => JSON.stringify(record)).join('\n')}\n`);
      }
      const old = fs.statSync(file), replacement = path.join(workspace, 'replacement.txt');
      fs.writeFileSync(replacement, 'REPLACEMENT');
      fs.utimesSync(replacement, old.atimeMs / 1000, old.mtimeMs / 1000);
      fs.renameSync(replacement, file);
      assert.notEqual(fs.statSync(file).ino, old.ino);
      assert.equal(Math.floor(fs.statSync(file).mtimeMs), Math.floor(old.mtimeMs));
      cold = Session.open(workspace, { id });
      assert.deepEqual(cold.fileReadCache.get(file)?.identity, legacy ? undefined : { dev: String(stat.dev), ino: String(stat.ino) });
      const agent = new Agent(cold, provider, runtime.buildTools(cold.config, cold.id), {
        toolResult: event => outputs.push(String(event.content)),
      });
      await agent.run('read replacement');
      assert.equal(outputs.at(-1), 'REPLACEMENT');
      await agent.run('read unchanged');
      assert.match(outputs.at(-1)!, /file unchanged since your last Read/);
    } finally { cold?.close(); await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
  }
});

test('real read observation survives cold fork and rewind without inherited effects', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
    ? reply([{ type: 'tool_use', id: 'read-real', name: 'read_file', input: { path: 'alias.txt' }, caller: { type: 'direct' } }], 'tool_use')
    : textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  let fork: Session | undefined, rewound: Session | undefined;
  try {
    fs.symlinkSync('fixture.txt', path.join(workspace, 'alias.txt'));
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('READ');
    const file = path.join(workspace, 'fixture.txt');
    const alias = path.join(workspace, 'alias.txt');
    assert.equal(parent.readFileState.get(alias)?.content, 'OWNED_FILE');
    assert.equal(parent.fileReadCache.get(alias)?.content, 'OWNED_FILE');
    checkpointConversation(parent, 'read-state', new AbortController().signal);
    fork = forkSession(parent);
    assert.equal(fork.readFileState.get(alias)?.content, 'OWNED_FILE');
    assert.equal(fork.fileReadCache.get(alias)?.content, 'OWNED_FILE');
    assert.equal(turnDiffMessages(fork.events).some(row => 'toolUseResult' in row), false);
    const forkId = fork.id; fork.close(); fork = Session.open(workspace, { id: forkId });
    assert.equal(fork.readFileState.get(alias)?.content, 'OWNED_FILE');
    assert.equal(fork.fileReadCache.get(alias)?.content, 'OWNED_FILE');
    fs.writeFileSync(file, 'CHANGED');
    const preview = previewRewind(parent, 1, new AbortController().signal);
    rewound = applyRewind(parent, preview, preview.token, new AbortController().signal);
    assert.equal(fs.readFileSync(file, 'utf8'), 'OWNED_FILE');
    assert.equal(rewound.readFileState.has(alias), false);
    assert.equal(rewound.fileReadCache.has(alias), false);
    const rewindId = rewound.id; rewound.close(); rewound = Session.open(workspace, { id: rewindId });
    assert.equal(rewound.readFileState.has(alias), false);
    assert.equal(rewound.fileReadCache.has(alias), false);
  } finally { fork?.close(); rewound?.close(); await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('real agent write validates complete reads and external changes', async () => {
  for (const scenario of ['normal', 'changed', 'partial'] as const) {
    let calls = 0;
    let workspace = '';
    const provider: ModelProvider = { count: async () => 0, complete: async () => {
      calls++;
      if (calls === 1) return reply([{ type: 'tool_use', id: 'read-before-write', name: 'read_file',
        input: { path: 'fixture.txt' }, caller: { type: 'direct' } }], 'tool_use');
      if (calls === 2) {
        if (scenario === 'changed') {
          const file = path.join(workspace, 'fixture.txt');
          fs.writeFileSync(file, 'EXTERNAL');
          const future = new Date(Date.now() + 10000);
          fs.utimesSync(file, future, future);
        }
        return reply([{ type: 'tool_use', id: 'write-after-read', name: 'write_file',
          input: { path: 'fixture.txt', content: 'WRITTEN', overwrite: true }, caller: { type: 'direct' } }], 'tool_use');
      }
      return textReply();
    } };
    const fixture = await setup(provider, scenario === 'partial' ? 5 : undefined);
    workspace = fixture.workspace;
    try {
      if (scenario === 'partial') {
        fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'FIRST\nSECOND\nTHIRD');
      }
      await new Agent(fixture.parent, provider, fixture.runtime.buildTools(fixture.parent.config, fixture.parent.id)).run('READ AND WRITE');
      const file = path.join(workspace, 'fixture.txt');
      const result = fixture.parent.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'write-after-read');
      assert.ok(result?.kind === 'tool_result');
      assert.equal(result.result.is_error === true, scenario !== 'normal');
      assert.equal(fs.readFileSync(file, 'utf8'), scenario === 'normal' ? 'WRITTEN' : scenario === 'changed' ? 'EXTERNAL' : 'FIRST\nSECOND\nTHIRD');
      if (scenario === 'normal') assert.equal(fixture.parent.fileReadCache.get(file)?.content, 'WRITTEN');
    } finally { await fixture.runtime.close(); fixture.parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
  }
});

test('real agent records both symlink read and write directions through cold reopen', async () => {
  for (const direction of ['link-to-target', 'target-to-link'] as const) {
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => {
      calls++;
      if (calls === 1) return reply([{ type: 'tool_use', id: 'alias-read', name: 'read_file',
        input: { path: direction === 'link-to-target' ? 'alias.txt' : 'fixture.txt' }, caller: { type: 'direct' } }], 'tool_use');
      if (calls === 2) return reply([{ type: 'tool_use', id: 'alias-write', name: 'write_file',
        input: { path: direction === 'link-to-target' ? 'fixture.txt' : 'alias.txt', content: 'AFTER', overwrite: true }, caller: { type: 'direct' } }], 'tool_use');
      return textReply();
    } };
    const { workspace, runtime, parent } = await setup(provider);
    let reopened: Session | undefined;
    try {
      const file = path.join(workspace, 'fixture.txt'), alias = path.join(workspace, 'alias.txt');
      fs.symlinkSync('fixture.txt', alias);
      await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('READ AND WRITE');
      assert.equal(calls, 3, direction);
      const result = (id: string) => {
        const event = parent.events.find(row => row.kind === 'tool_result' && row.result.tool_use_id === id);
        assert.ok(event?.kind === 'tool_result', `${direction}: missing ${id}`);
        return event.result;
      };
      assert.notEqual(result('alias-read').is_error, true, direction);
      assert.match(String(result('alias-read').content), /OWNED_FILE/);
      const write = result('alias-write');
      if (direction === 'target-to-link') {
        assert.equal(write.is_error, true);
        assert.match(String(write.content), /symbolic link/i);
      } else assert.notEqual(write.is_error, true, String(write.content));
      const expected = direction === 'link-to-target' ? 'AFTER' : 'OWNED_FILE';
      assert.equal(fs.readFileSync(file, 'utf8'), expected);
      assert.equal(parent.fileReadCache.get(file)?.content, expected);
      assert.equal(parent.fileReadCache.has(alias), false);
      const id = parent.id;
      await runtime.close(); parent.close();
      reopened = Session.open(workspace, { id });
      assert.equal(reopened.fileReadCache.get(file)?.content, expected);
      assert.equal(reopened.fileReadCache.has(alias), false);
    } finally { reopened?.close(); await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
  }
});

test('real agent alias cache follows explicit read permission through cold reopen', async () => {
  for (const permission of ['allow', 'ask', 'deny'] as const) {
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => {
      calls++;
      if (calls === 1) return reply([{ type: 'tool_use', id: 'policy-read', name: 'read_file',
        input: { path: 'alias.txt' }, caller: { type: 'direct' } }], 'tool_use');
      if (calls === 2) return reply([{ type: 'tool_use', id: 'policy-write', name: 'write_file',
        input: { path: 'fixture.txt', content: 'AFTER', overwrite: true }, caller: { type: 'direct' } }], 'tool_use');
      return textReply();
    } };
    const fixture = await setup(provider);
    let reopened: Session | undefined;
    try {
      const { workspace, runtime, parent } = fixture;
      const file = path.join(workspace, 'fixture.txt'), alias = path.join(workspace, 'alias.txt');
      fs.symlinkSync('fixture.txt', alias);
      const state = parent.permissionOwner.state();
      state.mode = 'default';
      state.allow.push('write_file', 'read_file');
      if (permission !== 'allow') state[permission].push('read_file');
      await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('READ AND WRITE');
      const results = parent.events.filter(event => event.kind === 'tool_result');
      const read = results.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'policy-read');
      const write = results.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'policy-write');
      assert.ok(read?.kind === 'tool_result' && write?.kind === 'tool_result');
      assert.equal(read.result.is_error === true, permission !== 'allow', `${permission}: ${read.result.content}`);
      if (permission === 'ask') assert.match(String(read.result.content), /approv/i);
      assert.equal(write.result.is_error === true, permission !== 'allow', `${permission}: ${write.result.content}`);
      const expected = permission === 'allow' ? 'AFTER' : 'OWNED_FILE';
      assert.equal(fs.readFileSync(file, 'utf8'), expected);
      assert.equal(parent.fileReadCache.get(file)?.content, permission === 'allow' ? expected : undefined);
      assert.equal(parent.fileReadCache.has(alias), false);
      const id = parent.id;
      await runtime.close(); parent.close();
      reopened = Session.open(workspace, { id });
      assert.equal(reopened.fileReadCache.get(file)?.content, permission === 'allow' ? expected : undefined);
      assert.equal(reopened.fileReadCache.has(alias), false);
    } finally { reopened?.close(); await fixture.runtime.close(); fixture.parent.close(); fs.rmSync(fixture.workspace, { recursive: true, force: true }); }
  }
});

test('real agent records approved read and reverse alias permissions across reopen', async () => {
  for (const direction of ['link-to-target', 'target-to-link'] as const) {
    for (const permission of ['allow', 'ask-approved', 'ask-no-callback', 'deny'] as const) {
      let calls = 0;
      let prompts = 0;
      const provider: ModelProvider = { count: async () => 0, complete: async () => {
        calls++;
        if (calls === 1) return reply([{ type: 'tool_use', id: 'matrix-read', name: 'read_file',
          input: { path: direction === 'link-to-target' ? 'alias.txt' : 'fixture.txt' }, caller: { type: 'direct' } }], 'tool_use');
        if (calls === 2) return reply([{ type: 'tool_use', id: 'matrix-write', name: 'write_file',
          input: { path: direction === 'link-to-target' ? 'fixture.txt' : 'alias.txt', content: 'AFTER', overwrite: true }, caller: { type: 'direct' } }], 'tool_use');
        return textReply();
      } };
      const fixture = await setup(provider);
      let reopened: Session | undefined;
      try {
        const { workspace, runtime, parent } = fixture;
        const file = path.join(workspace, 'fixture.txt'), alias = path.join(workspace, 'alias.txt');
        fs.symlinkSync('fixture.txt', alias);
        const state = parent.permissionOwner.state();
        state.mode = 'default'; state.allow.push('read_file', 'write_file');
        if (permission.startsWith('ask')) state.ask.push('read_file');
        if (permission === 'deny') state.deny.push('read_file');
        await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id), permission === 'ask-approved'
          ? { permissionPrompt: 'interactive', permission: async request => {
            prompts++;
            assert.equal(request.tool, 'read_file');
            assert.deepEqual(request.input, { path: direction === 'link-to-target' ? 'alias.txt' : 'fixture.txt' });
            assert.match(request.reason, /approv/i);
            return true;
          } } : {}).run('READ AND WRITE');
        assert.equal(calls, 3);
        assert.equal(prompts, permission === 'ask-approved' ? 1 : 0);
        const results = parent.events.filter(event => event.kind === 'tool_result');
        const read = results.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'matrix-read');
        const write = results.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'matrix-write');
        assert.ok(read?.kind === 'tool_result' && write?.kind === 'tool_result');
        const allowed = permission === 'allow' || permission === 'ask-approved';
        assert.equal(read.result.is_error === true, !allowed, `${direction}/${permission}: ${read.result.content}`);
        assert.match(String(read.result.content), allowed ? /OWNED_FILE/ : permission === 'deny' ? /denied/i : /approv/i);
        const written = permission === 'allow' && direction === 'link-to-target';
        assert.equal(write.result.is_error === true, !written, `${direction}/${permission}: ${write.result.content}`);
        if (direction === 'target-to-link') assert.match(String(write.result.content), /symbolic link/i);
        else if (!written) assert.match(String(write.result.content), /not been read in full/i);
        const expected = written ? 'AFTER' : 'OWNED_FILE';
        assert.equal(fs.readFileSync(file, 'utf8'), expected);
        assert.equal(parent.fileReadCache.get(file)?.content, written || (allowed && direction === 'target-to-link') ? expected : undefined);
        assert.equal(parent.fileReadCache.get(alias)?.content, allowed && !written && direction === 'link-to-target' ? 'OWNED_FILE' : undefined);
        const id = parent.id;
        await runtime.close(); parent.close();
        reopened = Session.open(workspace, { id });
        assert.equal(reopened.fileReadCache.get(file)?.content, written || (allowed && direction === 'target-to-link') ? expected : undefined);
        assert.equal(reopened.fileReadCache.get(alias)?.content, allowed && !written && direction === 'link-to-target' ? 'OWNED_FILE' : undefined);
      } finally { reopened?.close(); await fixture.runtime.close(); fixture.parent.close(); fs.rmSync(fixture.workspace, { recursive: true, force: true }); }
    }
  }
});

test('real agent enforces local missing-read model and Read permission gates', async () => {
  for (const scenario of ['allowed', 'model', 'read-denied', 'read-path-ask', 'read-hidden', 'write-model'] as const) {
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
      ? reply([{ type: 'tool_use', id: 'edit-without-read', name: scenario === 'write-model' ? 'write_file' : 'edit_file',
        input: scenario === 'write-model' ? { path: 'fixture.txt', content: 'EDITED', overwrite: true } :
          { path: 'fixture.txt', old_string: 'OWNED_FILE', new_string: 'EDITED' }, caller: { type: 'direct' } }], 'tool_use')
      : textReply() };
    const fixture = await setup(provider);
    try {
      if (scenario === 'model' || scenario === 'write-model') fixture.parent.config.model = 'claude-sonnet-4-5';
      if (scenario === 'read-denied') fixture.parent.permissionOwner.state().deny.push('read_file');
      if (scenario === 'read-path-ask') {
        fixture.parent.permissionOwner.state().ask.push('Read(fixture.txt)');
        fixture.parent.permissionOwner.state().alwaysAskRules.session = ['Read(fixture.txt)'];
      }
      const tools = fixture.runtime.buildTools(fixture.parent.config, fixture.parent.id)
        .filter(candidate => scenario !== 'read-hidden' || candidate.schema.name !== 'read_file');
      fixture.parent.config.tools = pinToolSchemas(tools);
      await new Agent(fixture.parent, provider, tools).run('EDIT');
      const result = fixture.parent.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'edit-without-read');
      assert.ok(result?.kind === 'tool_result');
      assert.equal(result.result.is_error === true, scenario !== 'allowed', scenario);
      assert.equal(fs.readFileSync(path.join(fixture.workspace, 'fixture.txt'), 'utf8'), scenario === 'allowed' ? 'EDITED' : 'OWNED_FILE');
    } finally { await fixture.runtime.close(); fixture.parent.close(); fs.rmSync(fixture.workspace, { recursive: true, force: true }); }
  }
});

test('real agent edit accepts an externally changed file after a read when replacement remains applicable', async () => {
  let calls = 0;
  let workspace = '';
  let externalMtime = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    calls++;
    if (calls === 1) return reply([{ type: 'tool_use', id: 'read-before-edit', name: 'read_file',
      input: { path: 'fixture.txt' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) {
      const file = path.join(workspace, 'fixture.txt');
      fs.writeFileSync(file, 'OWNED_FILE external');
      const future = new Date(Date.now() + 10_000);
      fs.utimesSync(file, future, future);
      externalMtime = fs.statSync(file).mtimeMs;
      return reply([{ type: 'tool_use', id: 'edit-after-change', name: 'edit_file',
        input: { path: 'fixture.txt', old_string: 'OWNED_FILE', new_string: 'EDITED' },
        caller: { type: 'direct' } }], 'tool_use');
    }
    return textReply();
  } };
  const fixture = await setup(provider);
  workspace = fixture.workspace;
  try {
    await new Agent(fixture.parent, provider, fixture.runtime.buildTools(fixture.parent.config, fixture.parent.id)).run('READ AND EDIT');
    const file = path.join(workspace, 'fixture.txt');
    const observed = fixture.parent.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'read-before-edit');
    assert.ok(observed?.kind === 'tool_result' && observed.timestamp);
    assert.ok(Math.floor(externalMtime) > Date.parse(observed.timestamp));
    assert.equal(fs.readFileSync(file, 'utf8'), 'EDITED external');
    assert.equal(fixture.parent.fileReadCache.get(file)?.content, 'EDITED external');
    assert.equal(fixture.parent.fileReadCache.get(file)?.timestamp, Math.floor(fs.statSync(file).mtimeMs));
    const result = fixture.parent.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'edit-after-change');
    assert.ok(result?.kind === 'tool_result');
    assert.notEqual(result.result.is_error, true);
  } finally {
    await fixture.runtime.close(); fixture.parent.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('write and edit observations survive fork, rewind and process restart', async () => {
  for (const operation of ['write_file', 'edit_file'] as const) {
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
      ? reply([{ type: 'tool_use', id: 'older-read', name: 'read_file', input: { path: 'older.txt' }, caller: { type: 'direct' } }], 'tool_use')
      : calls === 2 ? reply([{ type: 'tool_use', id: 'mutation', name: operation, caller: { type: 'direct' },
        input: operation === 'write_file' ? { path: './new.txt', content: 'WRITTEN' }
          : { path: './fixture.txt', old_string: 'OWNED_FILE', new_string: 'EDITED' } }], 'tool_use')
      : textReply() };
    const { workspace, runtime, parent } = await setup(provider);
    let fork: Session | undefined, rewound: Session | undefined;
    try {
      fs.writeFileSync(path.join(workspace, 'older.txt'), 'OLDER');
      await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('mutate');
      const file = path.join(workspace, operation === 'write_file' ? 'new.txt' : 'fixture.txt');
      const stat = fs.statSync(file);
      checkpointConversation(parent, 'mutation-state', new AbortController().signal);
      fork = forkSession(parent);
      const preview = previewRewind(parent, 1, new AbortController().signal);
      rewound = applyRewind(parent, preview, preview.token, new AbortController().signal);
      for (const branch of [fork, rewound]) {
        const observation = branch.events.find(event => event.kind === 'write_observation');
        assert.ok(observation && observation.kind === 'write_observation');
        assert.equal(observation.landed.cacheKey, file);
        assert.equal(observation.landed.filePath, file);
        assert.equal(Math.floor(observation.landed.mtimeMs), Math.floor(stat.mtimeMs));
        assert.deepEqual(observation.landed.identity, { dev: String(stat.dev), ino: String(stat.ino) });
        assert.equal(branch.fileReadCache.get(file)?.content, operation === 'write_file' ? 'WRITTEN' : 'EDITED');
        assert.equal(branch.readFileState.has(path.join(workspace, 'older.txt')), false);
        assert.equal(turnDiffMessages(branch.events).some(row => 'toolUseResult' in row), false);
      }
      const forkId = fork.id, rewindId = rewound.id;
      fork.close(); fork = undefined; rewound.close(); rewound = undefined;
      const script = `import { Session } from './src/session.ts';
        const s = Session.open(process.argv[1], { id: process.argv[2] });
        console.log(JSON.stringify({ entry: s.fileReadCache.get(process.argv[3]), observations: s.events.filter(e => e.kind === 'write_observation').length })); s.close();`;
      for (const id of [forkId, rewindId]) {
        const result = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, workspace, id, file], { cwd: process.cwd(), encoding: 'utf8' }));
        assert.equal(result.observations, 1);
        assert.deepEqual(result.entry.identity, { dev: String(stat.dev), ino: String(stat.ino) });
      }
      const replacement = path.join(workspace, 'replacement.txt');
      fs.writeFileSync(replacement, 'REPLACED'); fs.utimesSync(replacement, stat.atimeMs / 1000, stat.mtimeMs / 1000); fs.renameSync(replacement, file);
      assert.notEqual(fs.statSync(file).ino, stat.ino);
      assert.equal(Math.floor(fs.statSync(file).mtimeMs), Math.floor(stat.mtimeMs));
      fork = Session.open(workspace, { id: forkId });
      let readCalls = 0; const outputs: string[] = [];
      const reader: ModelProvider = { count: async () => 0, complete: async () => ++readCalls === 1
        ? reply([{ type: 'tool_use', id: 'read-replacement', name: 'read_file', input: { path: path.basename(file) }, caller: { type: 'direct' } }], 'tool_use') : textReply() };
      await new Agent(fork, reader, runtime.buildTools(fork.config, fork.id), { toolResult: event => outputs.push(String(event.content)) }).run('read replacement');
      assert.equal(outputs[0], 'REPLACED');
    } finally { fork?.close(); rewound?.close(); await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
  }
});

test('write and edit cache entries survive cold session reopen', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    calls++;
    if (calls === 1) return reply([{ type: 'tool_use', id: 'write-cold', name: 'write_file',
      input: { path: 'new.txt', content: 'BEFORE' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'edit-cold', name: 'edit_file',
      input: { path: 'fixture.txt', old_string: 'OWNED_FILE', new_string: 'AFTER' }, caller: { type: 'direct' } }], 'tool_use');
    return textReply();
  } };
  const { workspace, runtime, parent } = await setup(provider);
  let reopened: Session | undefined;
  try {
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('WRITE AND EDIT');
    const written = path.join(workspace, 'new.txt'), edited = path.join(workspace, 'fixture.txt');
    assert.equal(fs.readFileSync(written, 'utf8'), 'BEFORE');
    assert.equal(fs.readFileSync(edited, 'utf8'), 'AFTER');
    assert.equal(parent.fileReadCache.has(written), false);
    assert.equal(parent.fileReadCache.get(edited)?.content, 'AFTER');
    fs.writeFileSync(edited, '﻿DISK CONTENT');
    const fork = forkSession(parent);
    try {
      assert.equal(fork.fileReadCache.has(written), false);
      assert.equal(fork.fileReadCache.get(edited)?.content, 'AFTER');
    } finally { fork.close(); }
    const id = parent.id;
    await runtime.close(); parent.close();
    reopened = Session.open(workspace, { id });
    assert.equal(reopened.fileReadCache.has(written), false);
    assert.equal(reopened.fileReadCache.get(edited)?.content, 'AFTER');
    assert.equal(reopened.fileReadCache.get(edited)?.contentNotInModelContext, true);
  } finally { reopened?.close(); await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

async function setup(provider: ModelProvider, maxOutputBytes = 24000, prepare?: (workspace: string) => Session['config']['hooks']) {
  const workspace = temporary();
  fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'OWNED_FILE');
  const config = { ...defaultConfig(workspace, []), model: 'fixture', skills: [], maxOutputBytes,
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, hooks: prepare?.(workspace),
    features: { tasks: false, subagents: true, agentMessaging: true, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  await runtime.bindSession!(parent);
  return { workspace, runtime, parent };
}

test('ordinary child executes its skill with messaging disabled', async () => {
  const workspace = temporary();
  let calls = 0, childMessages = '';
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    if (++calls === 1) return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 3) childMessages = JSON.stringify(request.messages);
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`printf CHILD_SKILL_EXECUTED`',
      shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] },
    features: { tasks: false, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  try {
    await runtime.bindSession!(parent);
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE CHILD');
    assert.match(childMessages, /CHILD_SKILL_EXECUTED/);
    assert.doesNotMatch(childMessages, /Child skill session owner released|!`printf/);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('messaging-disabled failed child retains its terminal error for cold readers', async () => {
  const workspace = temporary();
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    if (++calls === 1) return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) throw new Error('fixture child provider failure');
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture',
    features: { tasks: false, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  try {
    await runtime.bindSession!(parent);
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE CHILD');
    const witness = parent.events.findLast(event => event.kind === 'agent_history');
    assert.ok(witness && witness.kind === 'agent_history');
    const parentId = parent.id, childId = witness.id;
    await runtime.close(); parent.close();
    const script = `import { Session } from './src/session.ts'; import { AgentHistoryStore } from './src/agent-history.ts';
      const [workspace, id] = process.argv.slice(1); const parent = Session.open(workspace, { id });
      try { process.stdout.write(JSON.stringify(new AgentHistoryStore(parent, 16777216, 100).read().records)); } finally { parent.close(); }`;
    const records = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script,
      workspace, parentId], { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 }));
    const record = records.find((item: { id: string }) => item.id === childId);
    assert.equal(record?.state.kind, 'settled');
    assert.equal(record.state.status, 'failed');
    assert.match(record.state.error, /fixture child provider failure/);
    const continuation = `import { Session } from './src/session.ts'; import { createRuntime } from './src/runtime.ts';
      const [workspace, parentId, childId] = process.argv.slice(1);
      const parent = Session.open(workspace, { id: parentId });
      let finish; const done = new Promise(resolve => { finish = resolve; });
      const provider = { count: async () => 0, complete: async request => {
        const messages = JSON.stringify(request.messages);
        finish(messages.includes('CHILD') && messages.includes('CONTINUE FAILED CHILD') ? 'continued' : 'missing history');
        return { id:'r', model:'fixture', type:'message', role:'assistant', content:[{type:'text',text:'recovered'}], stop_reason:'end_turn', usage:{input_tokens:1,output_tokens:1} };
      }};
      const runtime = await createRuntime(parent.config, provider, new AbortController().signal);
      try { await runtime.bindSession(parent); await runtime.submitAgentInput(parentId, childId, 'CONTINUE FAILED CHILD');
        const timer = setTimeout(() => finish('timeout'), 5000); const result = await done; clearTimeout(timer); process.stdout.write(result);
      } catch (error) { process.stdout.write('error:' + error.message); }
      finally { await runtime.close(); parent.close(); }`;
    const continued = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', continuation,
      workspace, parentId, childId], { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 });
    assert.equal(continued, 'continued');
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('messaging-disabled failed child retains active witness when settlement intent fails', async () => {
  const workspace = temporary();
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    if (++calls === 1) return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) throw new Error('original provider failure');
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture',
    features: { tasks: false, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  const append = parent.append.bind(parent);
  try {
    await runtime.bindSession!(parent);
    parent.append = event => { if (event.kind === 'agent_history_intent') throw new Error('injected history intent failure'); append(event); };
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE CHILD');
    parent.append = append;
    assert.match(JSON.stringify(parent.messages), /original provider failure/);
    const id = parent.id;
    await runtime.close(); parent.close();
    const script = `import { Session } from './src/session.ts'; import { AgentHistoryStore } from './src/agent-history.ts';
      const [workspace, id] = process.argv.slice(1); const parent = Session.open(workspace, { id });
      try { process.stdout.write(JSON.stringify(new AgentHistoryStore(parent, 16777216, 100).read())); } finally { parent.close(); }`;
    const result = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script,
      workspace, id], { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 }));
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].state.kind, 'active');
    assert.deepEqual(result.warnings, []);
  } finally { parent.append = append; await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('messaging-disabled child can continue in an independent process', async () => {
  const workspace = temporary();
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
    ? reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use')
    : textReply() };
  const config = { ...defaultConfig(workspace, []), model: 'fixture',
    features: { tasks: false, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  try {
    await runtime.bindSession!(parent);
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE CHILD');
    const childResult = JSON.stringify(parent.messages);
    const childId = /session_id\\?"\s*:\s*\\?"([a-f0-9-]{36})/.exec(childResult)?.[1];
    assert.ok(childId, childResult.slice(-1000));
    const parentId = parent.id;
    await runtime.close(); parent.close();
    const continuation = `
      import { Session } from './src/session.ts';
      import { createRuntime } from './src/runtime.ts';
      const [workspace, parentId, childId] = process.argv.slice(1);
      const parent = Session.open(workspace, { id: parentId });
      const provider = { count: async () => 0, complete: async () => ({ id:'fixture', model:'fixture', type:'message', role:'assistant', content:[{type:'text',text:'continued'}], stop_reason:'end_turn', usage:{input_tokens:1,output_tokens:1} }) };
      const runtime = await createRuntime(parent.config, provider, new AbortController().signal);
      try { await runtime.bindSession(parent); await runtime.submitAgentInput(parentId, childId, 'CONTINUE'); process.stdout.write('continued'); }
      catch (error) { process.stdout.write('error: ' + error.message); }
      finally { await runtime.close(); parent.close(); }
    `;
    const observed = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', continuation,
      workspace, parentId, childId], { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 });
    assert.equal(observed, 'continued');
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('standalone child cold continuation reads witnessed output and rejects damaged evidence', { timeout: 30000 }, async () => {
  const workspace = temporary();
  let calls = 0, saved = '';
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    if (++calls === 1) return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    saved = /Full output saved to: ([^\s\\]+)/.exec(JSON.stringify(request.messages))?.[1] ?? saved;
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true, maxOutputBytes: 256000,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`head -c 40000 /dev/zero | tr "\\0" x`',
      shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] },
    features: { tasks: false, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  try {
    await runtime.bindSession!(parent);
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE');
    assert.ok(saved);
    const witness = parent.events.findLast(event => event.kind === 'agent_history');
    assert.ok(witness && witness.kind === 'agent_history');
    const parentId = parent.id, childId = witness.id;
    await runtime.close(); parent.close();
    const childFile = path.join(workspace, '.agent', `${childId}.jsonl`);
    const sidecar = path.join(workspace, '.agent', 'subagents', parentId, `${childId}.meta.json`);
    const script = `
      import { Session } from './src/session.ts'; import { createRuntime } from './src/runtime.ts';
      const [workspace, parentId, childId, saved] = process.argv.slice(1);
      const parent = Session.open(workspace, { id: parentId });
      let count = 0, finish; const done = new Promise(resolve => { finish = resolve; });
      const provider = { count: async () => 0, complete: async request => {
        if (++count === 1) return {id:'r',model:'fixture',type:'message',role:'assistant',content:[{type:'tool_use',id:'read',name:'read_file',input:{path:saved},caller:{type:'direct'}}],stop_reason:'tool_use',usage:{input_tokens:1,output_tokens:1}};
        finish(JSON.stringify(request.messages).includes('x'.repeat(40000)) ? 'read-complete' : 'read-incomplete');
        return {id:'r',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1}};
      }};
      const runtime = await createRuntime(parent.config, provider, new AbortController().signal);
      try { await runtime.bindSession(parent); await runtime.releaseSession(parentId); await runtime.bindSession(parent);
        await runtime.submitAgentInput(parentId, childId, 'READ PREVIOUS OUTPUT');
        const timer = setTimeout(() => finish('timeout'), 5000); const result = await done; clearTimeout(timer); process.stdout.write(result);
      } catch (error) { process.stdout.write('error:' + error.message); }
      finally { await runtime.close(); parent.close(); }
    `;
    const run = () => execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script,
      workspace, parentId, childId, saved], { cwd: process.cwd(), encoding: 'utf8', timeout: 12000 });
    const metadata = fs.readFileSync(sidecar);
    const altered = JSON.parse(metadata.toString()); altered.prompt = 'ALTERED';
    fs.writeFileSync(sidecar, JSON.stringify(altered));
    assert.match(run(), /^error:Unknown child agent/);
    fs.writeFileSync(sidecar, metadata);
    const parentFile = path.join(workspace, '.agent', `${parentId}.jsonl`);
    const parentJournal = fs.readFileSync(parentFile);
    const rows = parentJournal.toString().trimEnd().split('\n').map(line => JSON.parse(line));
    const parentWitness = rows.findLast(row => row.kind === 'agent_history' && row.id === childId);
    assert.ok(parentWitness); parentWitness.digest = '0'.repeat(64);
    fs.writeFileSync(parentFile, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    assert.match(run(), /^error:Unknown child agent/);
    fs.writeFileSync(parentFile, parentJournal);
    const journal = fs.readFileSync(childFile);
    fs.appendFileSync(childFile, 'corrupt');
    assert.match(run(), /^error:Unknown child agent/);
    assert.equal(fs.readFileSync(childFile).subarray(journal.length).toString(), 'corrupt');
    fs.writeFileSync(childFile, journal);
    assert.equal(run(), 'read-complete');
  } finally {
    await runtime.close(); parent.close();
    if (saved) fs.rmSync(saved, { force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

for (const messaging of [true, false]) test(`ordinary real child persists and reads its skill shell output under its root (messaging ${messaging})`, async () => {
  const workspace = temporary();
  let calls = 0, saved = '', childMessages = '';
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    calls++;
    if (calls === 1) return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 3) {
      childMessages = JSON.stringify(request.messages);
      saved = /Full output saved to: ([^\s\\]+)/.exec(childMessages)?.[1] ?? '';
      assert.ok(saved, `child skill must expose a saved path: ${childMessages.slice(-1000)}`);
      return reply([{ type: 'tool_use', id: 'read', name: 'read_file', input: { path: saved }, caller: { type: 'direct' } }], 'tool_use');
    }
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true, maxOutputBytes: 256000,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`head -c 40000 /dev/zero | tr "\\0" x`',
      shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] },
    features: { tasks: false, subagents: true, agentMessaging: messaging, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  try {
    await runtime.bindSession!(parent);
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE CHILD');
    assert.ok(saved, `calls=${calls}, child=${childMessages.slice(-1200)}, parent=${JSON.stringify(parent.messages).slice(-1600)}`);
    assert.equal(fs.readFileSync(saved, 'utf8'), 'x'.repeat(40000));
    const witness = parent.events.findLast(event => event.kind === 'agent_history');
    const files = fs.readdirSync(path.join(workspace, '.agent', 'skill-effects')).filter(name => name.endsWith('.jsonl'));
    assert.equal(files.length, 1);
    const childId = files[0]!.slice(0, -'.jsonl'.length);
    if (!messaging) {
      const coldWitness = execFileSync(process.execPath, ['-e',
        'const fs=require("node:fs");const events=fs.readFileSync(process.argv[1],"utf8").trim().split("\\n").map(JSON.parse);process.stdout.write(JSON.stringify(events.some(e=>e.kind==="agent_history"&&e.id===process.argv[2])));',
        parent.file, childId], { encoding: 'utf8' });
      assert.equal(coldWitness, 'true', 'independent process must observe the parent history witness');
    }
    assert.ok(witness && witness.kind === 'agent_history' && witness.id === childId, 'child history must be witnessed by its parent');
    const journal = fs.readFileSync(path.join(workspace, '.agent', `${childId}.jsonl`), 'utf8');
    assert.ok(journal.includes('x'.repeat(40000)), 'child Read must return complete output');
    const effects = fs.readFileSync(path.join(workspace, '.agent', 'skill-effects', `${childId}.jsonl`), 'utf8');
    assert.match(effects, /"started"/);
    assert.match(effects, /"finished"/);
    assert.equal(fs.existsSync(path.join(workspace, '.agent', 'skill-effects', `${parent.id}.jsonl`)), false);
    if (!messaging) {
      const cold = Session.open(workspace, { id: childId });
      try {
        assert.equal(cold.rootIdentity, undefined);
        assert.equal(cold.config.parentSessionId, parent.id);
        assert.match(JSON.stringify(cold.messages), /Full output saved to/);
      } finally { cold.close(); }
    }
    let otherCalls = 0, otherResult = '';
    const otherProvider: ModelProvider = { count: async () => 0, complete: async request => {
      if (++otherCalls === 1) return reply([{ type: 'tool_use', id: 'foreign-read', name: 'read_file', input: { path: saved }, caller: { type: 'direct' } }], 'tool_use');
      otherResult = JSON.stringify(request.messages);
      return textReply();
    } };
    const other = Session.open(workspace, { config });
    try {
      await runtime.bindSession!(other);
      await new Agent(other, otherProvider, runtime.buildTools(other.config, other.id)).run('READ FOREIGN OUTPUT');
      assert.match(otherResult, /is_error/);
      assert.equal(otherResult.includes('x'.repeat(40000)), false);
    } finally { await runtime.releaseSession!(other.id); other.close(); }
  } finally {
    await runtime.close(); parent.close();
    if (saved) fs.rmSync(saved, { force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('child skill failure leaves its concurrent sibling running and journaled', async () => {
  const workspace = temporary();
  let calls = 0, failure = '';
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    if (++calls === 1) return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 3) {
      failure = JSON.stringify(request.messages);
      assert.equal(fs.existsSync(path.join(workspace, 'sibling-finished')), false);
      fs.writeFileSync(path.join(workspace, 'release-sibling'), '');
      await until(() => fs.existsSync(path.join(workspace, 'sibling-finished')));
      const directory = path.join(workspace, '.agent', 'skill-effects');
      await until(() => fs.readdirSync(directory).filter(name => name.endsWith('.jsonl'))
        .some(name => fs.readFileSync(path.join(directory, name), 'utf8').includes('"finished"')));
    }
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture',
      body: '!`while [ ! -f sibling-started ]; do sleep 0.01; done; exit 7` !`touch sibling-started; while [ ! -f release-sibling ]; do sleep 0.01; done; touch sibling-finished`',
      shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, subagents: true, agentMessaging: true, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  try {
    await runtime.bindSession!(parent);
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE');
    assert.match(failure, /Shell command failed/);
    const witness = parent.events.findLast(event => event.kind === 'agent_history');
    assert.ok(witness && witness.kind === 'agent_history');
    const file = path.join(workspace, '.agent', 'skill-effects', `${witness.id}.jsonl`);
    const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(rows.filter(row => row.phase === 'started').length, 2);
    assert.equal(rows.filter(row => row.phase === 'failed').length, 1);
    assert.equal(rows.filter(row => row.phase === 'finished').length, 1);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('cold child skill binds the newly opened Session and its journal', async () => {
  const workspace = temporary();
  let invoked = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    const last = request.messages.at(-1);
    if (last?.role === 'user' && last.content === 'CREATE') return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (last?.role === 'user' && last.content === 'CONTINUE') {
      invoked++;
      return reply([{ type: 'tool_use', id: 'skill-cold', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    }
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`printf cold-child`', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, subagents: true, agentMessaging: true, agentTypes: true } };
  let runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  let parent = Session.open(workspace, { config });
  try {
    await runtime.bindSession!(parent);
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE');
    const witness = parent.events.findLast(event => event.kind === 'agent_history');
    assert.ok(witness && witness.kind === 'agent_history');
    const parentId = parent.id;
    await runtime.close(); await parent.close();
    parent = Session.open(workspace, { id: parentId });
    runtime = await createRuntime(parent.config, provider, new AbortController().signal);
    await runtime.bindSession!(parent);
    await runtime.submitAgentInput!(parentId, witness.id, 'CONTINUE');
    const file = path.join(workspace, '.agent', 'skill-effects', `${witness.id}.jsonl`);
    const deadline = Date.now() + 5000;
    while (!fs.existsSync(file) || !fs.readFileSync(file, 'utf8').includes('"finished"')) {
      if (Date.now() > deadline) throw new Error(`cold child skill timed out: ${JSON.stringify(runtime.agentTranscript!(parentId, witness.id))}`);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(invoked, 1);
    assert.equal(fs.existsSync(path.join(workspace, '.agent', 'skill-effects', `${parentId}.jsonl`)), false);
  } finally { await runtime.close(); await parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

for (const messaging of [true, false]) test(`closing the parent cancels a running child skill command (messaging ${messaging})`, async () => {
  const workspace = temporary();
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    calls++;
    if (calls === 1) return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`touch started; sleep 3; touch finished`', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, subagents: true, agentMessaging: messaging, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  try {
    await runtime.bindSession!(parent);
    const running = new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE').catch(() => undefined);
    const deadline = Date.now() + 5000;
    while (!fs.existsSync(path.join(workspace, 'started'))) {
      if (Date.now() > deadline) throw new Error('child command did not start');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    await parent.close();
    await runtime.close();
    await running;
    assert.equal(fs.existsSync(path.join(workspace, 'finished')), false);
  } finally { await runtime.close(); await parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('stop transaction crash worker', { skip: !process.env.W385_STOP_CRASH_WORKSPACE }, async () => {
  const workspace = process.env.W385_STOP_CRASH_WORKSPACE!;
  const stage = process.env.W385_STOP_CRASH_STAGE!;
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    if (++calls === 1) return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`touch started; sleep 30; touch finished`', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  await runtime.bindSession!(parent);
  void new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE').catch(() => undefined);
  await until(() => fs.existsSync(path.join(workspace, 'started')));
  const witness = parent.events.findLast(event => event.kind === 'agent_history');
  assert.ok(witness && witness.kind === 'agent_history');
  const child = witness.id;
  const barrier = () => {
    fs.writeFileSync(path.join(workspace, 'stop-barrier.json'), JSON.stringify({ parent: parent.id, child, stage }));
    process.kill(process.pid, 'SIGSTOP');
  };
  let intent = false, published = false, tempFd: number | undefined;
  const open = fs.openSync, sync = fs.fsyncSync, rename = fs.renameSync;
  fs.openSync = ((file, ...args) => {
    const fd = open(file, ...args);
    if (intent && String(file).includes(`.${child}.meta.json.`) && String(file).endsWith('.tmp')) tempFd = fd;
    return fd;
  }) as typeof fs.openSync;
  fs.fsyncSync = fd => {
    if (intent && fd === tempFd && stage === 'file-before') barrier();
    sync(fd);
    if (intent && fd === tempFd && stage === 'file-after') barrier();
    if (published && stage === 'directory-after' && fs.fstatSync(fd).isDirectory()) barrier();
  };
  fs.renameSync = (from, to) => {
    const match = intent && String(to).endsWith(`${child}.meta.json`);
    if (match && stage === 'rename-before') barrier();
    rename(from, to);
    if (match) { published = true; if (stage === 'rename-after') barrier(); }
  };
  const append = parent.append.bind(parent);
  parent.append = event => {
    if (intent && event.kind === 'agent_history' && stage === 'witness-before') barrier();
    append(event);
    if (event.kind === 'agent_history_intent' && event.id === child) {
      intent = true;
      if (stage === 'intent-after') barrier();
    } else if (intent && event.kind === 'agent_history' && stage === 'witness-after') barrier();
  };
  await runtime.stopTask!(parent.id, child);
  throw new Error(`stop barrier ${stage} not reached`);
});

test('explicit stop writer death preserves history and fences across two cold processes', { timeout: 90000 }, async () => {
  for (const stage of ['intent-after', 'file-before', 'file-after', 'rename-before', 'rename-after', 'directory-after', 'witness-before', 'witness-after']) {
    const workspace = temporary();
    const worker = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-isolation=none', '--test-name-pattern', '^stop transaction crash worker$', 'test/agent-cold-history.test.ts'], {
      cwd: process.cwd(), env: { ...process.env, W385_STOP_CRASH_WORKSPACE: workspace, W385_STOP_CRASH_STAGE: stage }, stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = ''; worker.stderr.on('data', chunk => { stderr += chunk; });
    const exited = new Promise<void>(resolve => worker.once('exit', () => resolve()));
    try {
      const barrier = path.join(workspace, 'stop-barrier.json');
      await until(() => fs.existsSync(barrier) || worker.exitCode !== null, () => `${stage}: ${stderr}`);
      assert.ok(fs.existsSync(barrier), `${stage}: ${stderr}`);
      const ids = JSON.parse(fs.readFileSync(barrier, 'utf8')) as { parent: string; child: string };
      worker.kill('SIGKILL'); await exited;
      const journal = path.join(workspace, '.agent', `${ids.parent}.jsonl`);
      const childJournal = path.join(workspace, '.agent', `${ids.child}.jsonl`);
      const sidecar = path.join(workspace, '.agent', 'subagents', ids.parent, `${ids.child}.meta.json`);
      const effects = path.join(workspace, '.agent', 'skill-effects', `${ids.child}.jsonl`);
      const original = fs.readFileSync(journal), originalChild = fs.readFileSync(childJournal), originalSidecar = fs.readFileSync(sidecar), originalEffects = fs.readFileSync(effects);
      assert.match(originalEffects.toString(), /"started"/); assert.doesNotMatch(originalEffects.toString(), /"finished"/);
      assert.equal(fs.existsSync(path.join(workspace, 'finished')), false);
      const settled = ['rename-after', 'directory-after', 'witness-before', 'witness-after'].includes(stage);
      assert.equal(JSON.parse(originalSidecar.toString()).state.kind, settled ? 'settled' : 'active', stage);
      const reader = `import {Session} from './src/session.ts'; import {createRuntime} from './src/runtime.ts';
        const [workspace,parentId,childId,pass]=process.argv.slice(1);
        const parent=Session.open(workspace,{id:parentId,recoverLock:pass==='0'});
        const provider={count:async()=>0,complete:async()=>{throw Error('unexpected model call')}};
        const runtime=await createRuntime(parent.config,provider,new AbortController().signal);
        try {await runtime.bindSession(parent);process.stdout.write(JSON.stringify({status:runtime.agentTranscript(parentId,childId)?.status ?? null,foreign:runtime.agentTranscript('foreign',childId) ?? null}));}
        finally {await runtime.close();parent.close()}`;
      const fenced = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader,
        workspace, ids.parent, ids.child, '0'], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 }));
      assert.equal(fenced.status, null, `${stage}: stale child lock must fence import`);
      execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
        `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});s.close()`,
        workspace, ids.child], { cwd: process.cwd(), timeout: 10000 });
      for (let pass = 0; pass < 2; pass++) {
        const result = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader,
          workspace, ids.parent, ids.child, '1'], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 }));
        assert.equal(result.status, settled ? 'cancelled' : null, `${stage}, cold ${pass}`);
        assert.equal(result.foreign, null, stage);
        assert.ok(fs.readFileSync(journal).subarray(0, original.length).equals(original), stage);
        assert.deepEqual(fs.readFileSync(childJournal), originalChild, stage);
        assert.deepEqual(fs.readFileSync(sidecar), originalSidecar, stage);
        assert.deepEqual(fs.readFileSync(effects), originalEffects, stage);
        if (pass === 0) fs.writeFileSync(path.join(workspace, 'first-cold'), fs.readFileSync(journal));
        else assert.deepEqual(fs.readFileSync(journal), fs.readFileSync(path.join(workspace, 'first-cold')), stage);
      }
    } finally { if (worker.exitCode === null && worker.signalCode === null) { worker.kill('SIGKILL'); await exited; } fs.rmSync(workspace, { recursive: true, force: true }); }
  }
});

test('TaskStop limits registry children to their owning Session', { timeout: 15000 }, async () => {
  const workspace = temporary();
  const provider: ModelProvider = { count: async () => 0, complete: async () => reply([
    { type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } },
  ], 'tool_use') };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`touch started; sleep 30; touch finished`', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, background: true, subagents: true, agentMessaging: true, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const owner = Session.open(workspace, { config }), foreign = Session.open(workspace, { config });
  try {
    await runtime.bindSession!(owner); await runtime.bindSession!(foreign);
    const spawned = JSON.parse(await tool(runtime, owner, 'agent').execute({ prompt: 'FIRST', mode: 'general', background: true }, { ...context(workspace), session: owner }));
    await until(() => fs.existsSync(path.join(workspace, 'started')));
    await assert.rejects(tool(runtime, foreign, 'task_stop').execute({ id: spawned.id }, { ...context(workspace), session: foreign }), /unknown background task/);
    const result = await tool(runtime, owner, 'task_stop').execute({ id: spawned.id }, { ...context(workspace), session: owner });
    assert.match(result, /Successfully stopped task/);
    assert.equal(fs.existsSync(path.join(workspace, 'finished')), false);
  } finally { await runtime.close(); owner.close(); foreign.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('parallel Agent and TaskStop stop an already known owned child while another runs', { timeout: 15000 }, async () => {
  const workspace = temporary();
  let calls = 0;
  let target = '';
  let secondEntered = false;
  let stopped = false;
  let releaseSecond = () => {};
  const secondGate = new Promise<void>(resolve => { releaseSecond = resolve; });
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    const call = ++calls;
    if (call === 1) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    if (call === 2) return reply([
      { type: 'tool_use', id: 'spawn-second', name: 'agent', input: { prompt: 'SECOND', mode: 'general' }, caller: { type: 'direct' } },
      { type: 'tool_use', id: 'stop-first', name: 'task_stop', input: { id: target }, caller: { type: 'direct' } },
    ], 'tool_use');
    if (call === 3) { secondEntered = true; await secondGate; }
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`touch started; sleep 30; touch finished`', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, background: true, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  const controller = new AbortController();
  let first: Promise<string> | undefined;
  try {
    await runtime.bindSession!(parent);
    const tools = runtime.buildTools(parent.config, parent.id);
    const launch = tools.find(item => item.schema.name === 'agent')!;
    const stop = tools.find(item => item.schema.name === 'task_stop')!;
    first = launch.execute({ prompt: 'FIRST', mode: 'general' }, { ...context(workspace), session: parent });
    await until(() => fs.existsSync(path.join(workspace, 'started')));
    const witness = parent.events.findLast(event => event.kind === 'agent_history');
    assert.ok(witness && witness.kind === 'agent_history');
    target = witness.id;
    await assert.rejects(stop.execute({ id: target }, context(workspace)), /unknown background task/);
    const wrapped = tools.map(item => item === stop ? { ...item, async execute(input: unknown, ctx: ToolContext) {
      await until(() => secondEntered, () => 'second Agent did not enter before TaskStop');
      try { const result = await stop.execute(input, ctx); stopped = true; return result; }
      finally { releaseSecond(); }
    } } : item);
    await new Agent(parent, provider, wrapped).run('STOP', controller.signal);
    await first;
    assert.equal(stopped, true);
    assert.equal(fs.existsSync(path.join(workspace, 'finished')), false);
    const results = parent.events.filter(event => event.kind === 'tool_result').map(event => event.result.tool_use_id);
    assert.deepEqual(results.slice(-2), ['spawn-second', 'stop-first']);
  } finally {
    releaseSecond(); controller.abort(); await first?.catch(() => undefined);
    await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('parallel TaskStop failure does not cancel a running child Agent', { timeout: 15000 }, async () => {
  const workspace = temporary();
  let calls = 0;
  let entered = false;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    const call = ++calls;
    if (call === 1) return reply([
      { type: 'tool_use', id: 'child', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } },
      { type: 'tool_use', id: 'stop', name: 'task_stop', input: { id: randomUUID() }, caller: { type: 'direct' } },
    ], 'tool_use');
    if (call === 2) { entered = true; await gate; }
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture',
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, background: true, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  try {
    await runtime.bindSession!(parent);
    const tools = runtime.buildTools(parent.config, parent.id);
    const stop = tools.find(item => item.schema.name === 'task_stop')!;
    const wrapped = tools.map(item => item === stop ? { ...item, async execute(input: unknown, ctx: ToolContext) {
      await until(() => entered, () => 'child Agent did not enter before TaskStop');
      try { return await stop.execute(input, ctx); }
      finally { release(); }
    } } : item);
    await new Agent(parent, provider, wrapped).run('START');
    const results = parent.events.filter(event => event.kind === 'tool_result').map(event => event.result);
    assert.deepEqual(results.map(result => result.tool_use_id), ['child', 'stop']);
    assert.equal(results[0]?.is_error, undefined);
    assert.equal(results[1]?.is_error, true);
    assert.match(String(results[1]?.content), /unknown background task/i);
  } finally { release(); await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('parallel foreign TaskStop leaves both owners children running', { timeout: 15000 }, async () => {
  const workspace = temporary();
  let calls = 0, target = '', entered = false;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    const call = ++calls;
    if (call === 1) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    if (call === 2) return reply([
      { type: 'tool_use', id: 'foreign-child', name: 'agent', input: { prompt: 'SECOND', mode: 'general' }, caller: { type: 'direct' } },
      { type: 'tool_use', id: 'foreign-stop', name: 'task_stop', input: { id: target }, caller: { type: 'direct' } },
    ], 'tool_use');
    if (call === 3) { entered = true; await gate; }
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`touch started; while ! test -f release-owned; do sleep 0.05; done; touch finished`', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, background: true, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const owner = Session.open(workspace, { config }), foreign = Session.open(workspace, { config });
  let first: Promise<string> | undefined;
  try {
    await runtime.bindSession!(owner); await runtime.bindSession!(foreign);
    const ownerTools = runtime.buildTools(owner.config, owner.id);
    const launch = ownerTools.find(item => item.schema.name === 'agent')!;
    first = launch.execute({ prompt: 'FIRST', mode: 'general' }, { ...context(workspace), session: owner });
    await until(() => fs.existsSync(path.join(workspace, 'started')));
    const witness = owner.events.findLast(event => event.kind === 'agent_history');
    assert.ok(witness && witness.kind === 'agent_history'); target = witness.id;
    const tools = runtime.buildTools(foreign.config, foreign.id);
    const stop = tools.find(item => item.schema.name === 'task_stop')!;
    const wrapped = tools.map(item => item === stop ? { ...item, async execute(input: unknown, ctx: ToolContext) {
      await until(() => entered, () => 'foreign child did not enter before TaskStop');
      try { return await stop.execute(input, ctx); } finally { release(); }
    } } : item);
    await new Agent(foreign, provider, wrapped).run('FOREIGN STOP');
    const results = foreign.events.filter(event => event.kind === 'tool_result').map(event => event.result);
    assert.deepEqual(results.map(result => result.tool_use_id), ['foreign-child', 'foreign-stop']);
    assert.equal(results[0]?.is_error, undefined);
    assert.equal(results[1]?.is_error, true);
    assert.match(String(results[1]?.content), /unknown background task/i);
    assert.equal(fs.existsSync(path.join(workspace, 'finished')), false);
    fs.writeFileSync(path.join(workspace, 'release-owned'), '');
    await first;
    assert.equal(fs.existsSync(path.join(workspace, 'finished')), true);
  } finally {
    release(); fs.writeFileSync(path.join(workspace, 'release-owned'), ''); await first?.catch(() => undefined);
    await runtime.close(); owner.close(); foreign.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('task_stop tool reaches a running messaging-disabled foreground child', { timeout: 15000 }, async () => {
  const workspace = temporary();
  const progress: Array<{ agentId: string; toolUseId: string; message: { id: string; name: string } }> = [];
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    if (++calls === 1) return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`touch started; sleep 30; touch finished`', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, background: true, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  const controller = new AbortController();
  let running: Promise<unknown> | undefined;
  try {
    await runtime.bindSession!(parent);
    running = new Agent(parent, provider, runtime.buildTools(parent.config, parent.id), { agentProgress: event => progress.push(event) }).run('CREATE', controller.signal).catch(() => undefined);
    await until(() => fs.existsSync(path.join(workspace, 'started')));
    const witness = parent.events.findLast(event => event.kind === 'agent_history');
    assert.ok(witness && witness.kind === 'agent_history');
    assert.ok(progress.some(event => event.agentId === witness.id && event.toolUseId === 'spawn' && event.message.id === 'skill' && event.message.name === 'skill'));
    assert.equal(runtime.backgroundTasks!(parent.id).agents.some(child => child.id === witness.id), false);
    await assert.rejects(tool(runtime, parent, 'task_stop').execute({ id: witness.id }, context(workspace)), /unknown background task/);
    const result = await tool(runtime, parent, 'task_stop').execute({ id: witness.id }, { ...context(workspace), session: parent });
    assert.match(result, /stopp|cancel/i);
    await running;
    assert.equal(fs.existsSync(path.join(workspace, 'finished')), false);
    const effects = fs.readFileSync(path.join(workspace, '.agent', 'skill-effects', `${witness.id}.jsonl`), 'utf8');
    assert.match(effects, /"started"/);
    assert.doesNotMatch(effects, /"finished"/);
  } finally {
    controller.abort(); await running; await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

for (const fault of [false, true]) test(`explicit task stop reaches a running messaging-disabled child (intent fault ${fault})`, { timeout: 15000 }, async () => {
  const workspace = temporary();
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    if (++calls === 1) return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`touch started; sleep 30; touch finished`', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  const controller = new AbortController();
  let running: Promise<unknown> | undefined;
  try {
    await runtime.bindSession!(parent);
    running = new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE', controller.signal).catch(() => undefined);
    await until(() => fs.existsSync(path.join(workspace, 'started')));
    const witness = parent.events.findLast(event => event.kind === 'agent_history');
    assert.ok(witness && witness.kind === 'agent_history');
    assert.equal(await runtime.stopTask!('unrelated-owner', witness.id), undefined);
    if (fault) {
      const append = parent.append.bind(parent);
      parent.append = event => { if (event.kind === 'agent_history_intent') throw new Error('injected stop intent failure'); append(event); };
      await assert.rejects(runtime.stopTask!(parent.id, witness.id), /injected stop intent failure/);
    } else assert.equal(await runtime.stopTask!(parent.id, witness.id), 'agent');
    await running;
    assert.equal(fs.existsSync(path.join(workspace, 'finished')), false);
    const parentId = parent.id;
    await runtime.close(); parent.close();
    const script = `import { Session } from './src/session.ts'; import { AgentHistoryStore } from './src/agent-history.ts';
      const [workspace, id] = process.argv.slice(1); const parent = Session.open(workspace, { id });
      try { process.stdout.write(JSON.stringify(new AgentHistoryStore(parent, 16777216, 100).read())); } finally { parent.close(); }`;
    const history = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script,
      workspace, parentId], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 }));
    assert.equal(history.records.length, 1);
    assert.equal(history.records[0].state.kind, fault ? 'active' : 'settled');
    if (!fault) assert.equal(history.records[0].state.status, 'cancelled');
    const effects = fs.readFileSync(path.join(workspace, '.agent', 'skill-effects', `${witness.id}.jsonl`), 'utf8');
    assert.match(effects, /"started"/);
    assert.doesNotMatch(effects, /"finished"/);
  } finally {
    controller.abort(); await running; await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

for (const parallelStop of [false, true]) test(`foreground abort preserves the standalone child and unfinished skill evidence for a cold reader (parallel stop ${parallelStop})`, { timeout: 15000 }, async () => {
  const workspace = temporary();
  let calls = 0, stopEntered = false;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    if (++calls === 1) return reply([
      { type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } },
      ...(parallelStop ? [{ type: 'tool_use' as const, id: 'stop-unknown', name: 'task_stop', input: { id: randomUUID() }, caller: { type: 'direct' as const } }] : []),
    ], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`touch started; sleep 30; touch finished`', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, background: true, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  const controller = new AbortController();
  try {
    await runtime.bindSession!(parent);
    const tools = runtime.buildTools(parent.config, parent.id);
    const stop = tools.find(item => item.schema.name === 'task_stop')!;
    const wrapped = tools.map(item => item === stop && parallelStop ? { ...item, async execute(input: unknown, ctx: ToolContext) {
      stopEntered = true;
      await new Promise<void>(resolve => ctx.signal.addEventListener('abort', () => resolve(), { once: true }));
      return stop.execute(input, ctx);
    } } : item);
    const running = new Agent(parent, provider, wrapped).run('CREATE', controller.signal).catch(() => undefined);
    await until(() => fs.existsSync(path.join(workspace, 'started')));
    if (parallelStop) await until(() => stopEntered, () => 'parallel stop did not reach its barrier');
    controller.abort();
    await running;
    assert.equal(calls, 2, 'aborted parent does not send tool results to the model');
    const parentId = parent.id;
    await runtime.close(); parent.close();
    const script = `import { Session } from './src/session.ts'; import { AgentHistoryStore } from './src/agent-history.ts';
      const [workspace, id] = process.argv.slice(1); const parent = Session.open(workspace, { id });
      try { process.stdout.write(JSON.stringify(new AgentHistoryStore(parent, 16777216, 100).read())); } finally { parent.close(); }`;
    const history = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script,
      workspace, parentId], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 }));
    assert.equal(history.records.length, 1);
    assert.equal(history.records[0].state.kind, 'active');
    assert.equal(fs.existsSync(path.join(workspace, 'finished')), false);
    const directory = path.join(workspace, '.agent', 'skill-effects');
    const files = fs.readdirSync(directory).filter(name => name.endsWith('.jsonl'));
    assert.equal(files.length, 1);
    const rows = fs.readFileSync(path.join(directory, files[0]!), 'utf8');
    assert.match(rows, /"started"/);
    assert.doesNotMatch(rows, /"finished"/);
    assert.equal(fs.readdirSync(directory).some(name => name.endsWith('.lease')), false);
  } finally { controller.abort(); await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('parallel child and stop remain fenced across owner release and same-ID rebind', { timeout: 20000 }, async () => {
  const workspace = temporary();
  let calls = 0, stopEntered = false, agentSettled = false;
  let releaseResults = () => {};
  const gate = new Promise<void>(resolve => { releaseResults = resolve; });
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    if (++calls === 1) return reply([
      { type: 'tool_use', id: 'spawn-old', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } },
      { type: 'tool_use', id: 'stop-old', name: 'task_stop', input: { id: randomUUID() }, caller: { type: 'direct' } },
    ], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'skill-old', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`echo $$ > shell.pid; touch started; sleep 30; touch finished`', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, background: true, subagents: true, agentMessaging: false, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  let reopened: Session | undefined;
  let running: Promise<unknown> | undefined;
  try {
    await runtime.bindSession!(parent);
    const tools = runtime.buildTools(parent.config, parent.id).map(item => {
      if (item.schema.name === 'agent') return { ...item, async execute(input: unknown, ctx: ToolContext) {
        try { return await item.execute(input, ctx); } finally { agentSettled = true; await gate; }
      } };
      if (item.schema.name === 'task_stop') return { ...item, async execute(input: unknown, ctx: ToolContext) {
        stopEntered = true; await gate; return item.execute(input, ctx);
      } };
      return item;
    });
    running = new Agent(parent, provider, tools).run('CREATE').catch(() => undefined);
    await until(() => fs.existsSync(path.join(workspace, 'started')) && stopEntered);
    const pid = Number(fs.readFileSync(path.join(workspace, 'shell.pid'), 'utf8'));
    const witness = parent.events.findLast(event => event.kind === 'agent_history');
    assert.ok(witness && witness.kind === 'agent_history');
    await runtime.releaseSession!(parent.id);
    await until(() => agentSettled, () => 'old child did not settle after release');
    parent.close();
    reopened = Session.open(workspace, { id: parent.id, config });
    await runtime.bindSession!(reopened);
    const before = JSON.stringify(reopened.events);
    const journalPath = path.join(workspace, '.agent', `${parent.id}.jsonl`);
    const journal = fs.readFileSync(journalPath, 'utf8');
    const storageFiles = fs.readdirSync(path.join(workspace, '.agent'), { recursive: true }).sort();
    releaseResults();
    await running;
    assert.equal(calls, 2, 'old turn must not call the model after rebind');
    assert.equal(JSON.stringify(reopened.events), before, 'old results must not enter the new owner journal');
    assert.equal(fs.readFileSync(journalPath, 'utf8'), journal);
    assert.deepEqual(fs.readdirSync(path.join(workspace, '.agent'), { recursive: true }).sort(), storageFiles);
    assert.equal(fs.existsSync(path.join(workspace, 'finished')), false);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    const directory = path.join(workspace, '.agent', 'skill-effects');
    const rows = fs.readFileSync(path.join(directory, `${witness.id}.jsonl`), 'utf8');
    assert.match(rows, /"started"/);
    assert.doesNotMatch(rows, /"finished"/);
    assert.equal(fs.readdirSync(directory).some(name => name.endsWith('.lease')), false);
    await runtime.releaseSession!(reopened.id); reopened.close(); reopened = undefined;
    const script = `import { Session } from './src/session.ts'; import { SkillEffectJournal } from './src/skill-effects.ts';
      const [workspace, parentId, childId] = process.argv.slice(1); const session = Session.open(workspace, { id: parentId });
      try { process.stdout.write(JSON.stringify({ events: session.events, pending: new SkillEffectJournal(workspace, childId).unresolved('fixture') })); }
      finally { session.close(); }`;
    const cold = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script,
      workspace, parent.id, witness.id], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 }));
    assert.equal(cold.pending.length, 1, 'cold reader classifies the abandoned effect as unresolved');
    assert.equal(JSON.stringify(cold.events), before);
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  } finally {
    releaseResults(); await running; await runtime.close(); parent.close(); reopened?.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

for (const messaging of [true, false]) test(`releasing and rebinding a parent cancels its old child skill (messaging ${messaging})`, async () => {
  const workspace = temporary();
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    if (++calls === 1) return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`touch started; sleep 30; touch finished`', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, subagents: true, agentMessaging: messaging, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  let reopened: Session | undefined;
  try {
    await runtime.bindSession!(parent);
    const running = new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE').catch(() => undefined);
    await until(() => fs.existsSync(path.join(workspace, 'started')));
    const id = parent.id;
    await runtime.releaseSession!(id);
    await running;
    await parent.close();
    reopened = Session.open(workspace, { id });
    await runtime.bindSession!(reopened);
    assert.equal(fs.existsSync(path.join(workspace, 'finished')), false);
    if (!messaging) {
      const history = new AgentHistoryStore(reopened, 16 * 1024 * 1024, 100).read();
      assert.equal(history.records.length, 1);
      assert.equal(history.records[0]?.state.kind, 'active');
    }
    const directory = path.join(workspace, '.agent', 'skill-effects');
    const files = fs.readdirSync(directory).filter(name => name.endsWith('.jsonl'));
    assert.equal(files.length, 1);
    const rows = fs.readFileSync(path.join(directory, files[0]!), 'utf8');
    assert.match(rows, /"started"/);
    assert.doesNotMatch(rows, /"finished"/);
    assert.equal(fs.readdirSync(directory).some(name => name.endsWith('.lease')), false);
  } finally { await runtime.close(); await parent.close(); await reopened?.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

for (const messaging of [true, false]) test(`child skill shell respects inherited command restrictions (messaging ${messaging})`, async () => {
  const workspace = temporary();
  let calls = 0, result = '';
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    calls++;
    if (calls === 1) return reply([{ type: 'tool_use', id: 'spawn', name: 'agent', input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) return reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 3) result = JSON.stringify(request.messages);
    return textReply();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true, bashCommandClamp: [['Bash(echo:*)']],
    skills: [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: '!`touch prohibited`', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] }, features: { tasks: false, subagents: true, agentMessaging: messaging, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  try {
    await runtime.bindSession!(parent);
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE');
    assert.match(result, /is_error/);
    assert.equal(fs.existsSync(path.join(workspace, 'prohibited')), false);
  } finally { await runtime.close(); await parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('real agent child exposes the cold root identity and nesting gap', async () => {
  let calls = 0;
  let childTools: string[] = [];
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    calls++;
    if (calls === 1) return reply([{ type: 'tool_use', id: 'nested-owner', name: 'agent',
      input: { prompt: 'CHILD', mode: 'general' }, caller: { type: 'direct' } }], 'tool_use');
    if (calls === 2) childTools = (request.tools ?? []).flatMap(item => 'name' in item ? [item.name] : []);
    return textReply();
  } };
  const { workspace, runtime, parent } = await setup(provider);
  try {
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CREATE CHILD');
    assert.equal(calls, 3);
    assert.equal(childTools.includes('agent'), false);
    const witness = parent.events.findLast(event => event.kind === 'agent_history');
    assert.ok(witness && witness.kind === 'agent_history');
    const parentId = parent.id;
    await runtime.close(); parent.close();
    const inspect = `const fs=require('node:fs'),p=require('node:path');
      const [workspace,parent,child]=process.argv.slice(1);
      const events=fs.readFileSync(p.join(workspace,'.agent',parent+'.jsonl'),'utf8').trim().split('\\n').map(JSON.parse);
      const meta=JSON.parse(fs.readFileSync(p.join(workspace,'.agent',child+'.jsonl'),'utf8').split('\\n')[0]);
      const witness=events.findLast(e=>e.kind==='agent_history'&&e.id===child);
      process.stdout.write(JSON.stringify({parent:meta.config.parentSessionId,rootIdentity:meta.rootIdentity??null,witness:!!witness}));`;
    const observed = JSON.parse(execFileSync(process.execPath, ['-e', inspect, workspace, parentId, witness.id], { encoding: 'utf8' }));
    assert.deepEqual(observed, { parent: parentId, rootIdentity: { rootSessionId: parentId, originalCwd: fs.realpathSync(workspace) }, witness: true });
    const sidecar = path.join(workspace, '.agent', 'subagents', parentId, `${witness.id}.meta.json`);
    const journal = path.join(workspace, '.agent', `${witness.id}.jsonl`);
    const savedSidecar = fs.readFileSync(sidecar), savedJournal = fs.readFileSync(journal);
    const owner = Session.open(workspace, { id: parentId });
    try {
      const tampered = JSON.parse(savedSidecar.toString()); tampered.state.journal.sha256 = '0'.repeat(64);
      fs.writeFileSync(sidecar, JSON.stringify(tampered));
      const forged = new AgentRegistry({ source: owner.config, provider, tools: runtime.tools });
      assert.match(forged.bindHistory(owner).join('\n'), /no matching parent witness/);
      assert.deepEqual(forged.list(), []); await forged.close();
      fs.writeFileSync(sidecar, savedSidecar);
      fs.appendFileSync(journal, '\n');
      const altered = new AgentRegistry({ source: owner.config, provider, tools: runtime.tools });
      assert.match(altered.bindHistory(owner).join('\n'), /journal continuity mismatch/);
      assert.deepEqual(altered.list(), []); await altered.close();
    } finally { fs.writeFileSync(sidecar, savedSidecar); fs.writeFileSync(journal, savedJournal); owner.close(); }
    const continuation = `
      import { Session } from './src/session.ts';
      import { createRuntime } from './src/runtime.ts';
      const [workspace, parentId, childId] = process.argv.slice(1);
      const direct = Session.open(workspace, { id: childId });
      const unwitnessed = direct.rootIdentity ?? null; direct.close();
      const parent = Session.open(workspace, { id: parentId });
      let child, called = false, during = null, afterRelease = null;
      const open = Session.open;
      Session.open = function(workspace, options) { const session = open.call(Session, workspace, options);
        if (options.id === childId) child = session; return session; };
      const provider = { count: async () => 0, complete: async () => {
        called = true; during = child?.rootIdentity ?? null; parent.close(); afterRelease = child?.rootIdentity ?? null;
        return { id:'fixture', model:'fixture', type:'message', role:'assistant', content:[{type:'text',text:'complete'}],
          stop_reason:'end_turn', usage:{input_tokens:1,output_tokens:1} };
      } };
      const runtime = await createRuntime(parent.config, provider, new AbortController().signal);
      try {
        await runtime.bindSession(parent); await runtime.submitAgentInput(parentId, childId, 'CONTINUE');
        const deadline = Date.now() + 5000;
        while (!called) { if (Date.now() > deadline) throw new Error('child recovery timed out: ' + JSON.stringify(runtime.agentTranscript(parentId, childId))); await new Promise(r => setTimeout(r, 5)); }
        process.stdout.write(JSON.stringify({ unwitnessed, during, afterRelease }));
      } finally { await runtime.close(); parent.close(); }
    `;
    const recovered = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', continuation,
      workspace, parentId, witness.id], { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 }));
    assert.deepEqual(recovered, { unwitnessed: null, during: observed.rootIdentity, afterRelease: null });
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('default runtime agent requires session-owned tools before and after binding', async () => {
  const workspace = temporary();
  const provider: ModelProvider = { count: async () => 0, complete: async () => textReply() };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', skills: [],
    features: { tasks: false, subagents: true, agentMessaging: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  let parent: Session | undefined;
  try {
    const agent = runtime.tools.find(candidate => candidate.schema.name === 'agent');
    assert.ok(agent);
    const launch = () => agent.execute({ prompt: 'OWNED' }, context(workspace));
    await assert.rejects(launch, /requires session-owned tools/);
    config.tools = pinToolSchemas(runtime.tools);
    parent = Session.open(workspace, { config });
    await runtime.bindSession!(parent);
    await assert.rejects(launch, /requires session-owned tools/);
    const result = await tool(runtime, parent, 'agent').execute({ prompt: 'OWNED' }, context(workspace));
    assert.match(result, /OWNED_COMPLETE/);
  } finally { await runtime.close(); parent?.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('messaging owner follows the open Session through release and cold restore', async () => {
  let launchParent = false;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    if (launchParent) { launchParent = false; return reply([{ type: 'tool_use', id: 'owner-check', name: 'agent',
      input: { prompt: 'OWNED', isolation: 'worktree' }, caller: { type: 'direct' } }], 'tool_use'); }
    return textReply();
  } };
  const { workspace, runtime, parent } = await setup(provider, 24000, root => ({
    WorktreeCreate: [{ hooks: [{ type: 'command', command: `printf started > '${path.join(root, 'wrong-owner-prepared')}'` }] }],
  }));
  let other: Session | undefined, reopened: Session | undefined;
  try {
    const wrong = runtime.buildTools(parent.config, randomUUID()).find(candidate => candidate.schema.name === 'agent')!;
    await assert.rejects(wrong.execute({ prompt: 'OWNED' }, context(workspace)), /requires session-owned tools/);
    other = Session.open(workspace, { config: parent.config });
    const results: string[] = [];
    launchParent = true;
    await new Agent(other, provider, runtime.buildTools(parent.config, parent.id), {
      toolResult: event => results.push(String(event.content)),
    }).run('WRONG OWNER');
    assert.match(results.join('\n'), /session does not match the tool owner/);
    assert.equal(fs.existsSync(path.join(workspace, 'wrong-owner-prepared')), false);
    const owned = tool(runtime, parent, 'agent');
    assert.match(await owned.execute({ prompt: 'OWNED' }, context(workspace)), /OWNED_COMPLETE/);
    const id = parent.id;
    await parent.close();
    await assert.rejects(owned.execute({ prompt: 'OWNED' }, context(workspace)), /requires session-owned tools/);
    reopened = Session.open(workspace, { id });
    await assert.rejects(runtime.bindSession!(reopened), /another session instance/);
    await runtime.releaseSession!(id);
    await runtime.bindSession!(reopened);
    const restored = await tool(runtime, reopened, 'list_agents').execute({}, context(workspace));
    assert.match(restored, /OWNED_COMPLETE/);
    assert.match(await tool(runtime, reopened, 'agent').execute({ prompt: 'OWNED' }, context(workspace)), /OWNED_COMPLETE/);
    const liveTool = tool(runtime, reopened, 'agent');
    const releasing = runtime.releaseSession!(id);
    await assert.rejects(liveTool.execute({ prompt: 'OWNED' }, context(workspace)), error =>
      error instanceof Error && error.name === 'AbortError' && error.message === 'Runtime session cleanup is unconfirmed; operation aborted');
    await releasing;
  } finally {
    await runtime.close(); await parent.close(); await other?.close(); await reopened?.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('another real Session cannot list children through an owner catalog', async () => {
  let requestTool = false;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    if (requestTool) { requestTool = false; return reply([{ type: 'tool_use', id: 'wrong-list', name: 'list_agents',
      input: {}, caller: { type: 'direct' } }], 'tool_use'); }
    return textReply();
  } };
  const { workspace, runtime, parent } = await setup(provider);
  const other = Session.open(workspace, { config: parent.config });
  try {
    await runtime.bindSession!(other);
    await tool(runtime, parent, 'agent').execute({ prompt: 'PRIVATE', name: 'private-child' }, context(workspace));
    const results: string[] = [];
    requestTool = true;
    await new Agent(other, provider, runtime.buildTools(parent.config, parent.id), {
      toolResult: event => results.push(String(event.content)),
    }).run('LIST WRONG OWNER');
    assert.match(results.join('\n'), /session does not match the tool owner/);
    assert.doesNotMatch(results.join('\n'), /private-child/);
  } finally {
    await runtime.close(); parent.close(); other.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('background job catalogs belong to their live Session across parallel Agents and rebind', async () => {
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    const prompt = request.messages.at(-1)?.content;
    if (typeof prompt === 'string' && prompt.startsWith('CALL:')) {
      const [, name, id] = prompt.split(':');
      return reply([{ type: 'tool_use', id: `call-${name}`, name: name!,
        input: name === 'read_notifications' ? {} : { id }, caller: { type: 'direct' } }], 'tool_use');
    }
    return textReply();
  } };
  const workspace = temporary();
  const config = { ...defaultConfig(workspace, []), model: 'fixture', skills: [],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] },
    features: { tasks: false, subagents: true, agentMessaging: true, background: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const a = Session.open(workspace, { config });
  const b = Session.open(workspace, { config });
  let reopened: Session | undefined;
  try {
    await runtime.bindSession!(a); await runtime.bindSession!(b);
    const direct = { ...context(workspace), allowShell: true };
    const start = async (session: Session, label: string) => JSON.parse(await tool(runtime, session, 'run_background').execute(
      { command: `printf ${label}; sleep 30`, description: label }, direct)) as { id: string };
    const [jobA, jobB] = await Promise.all([start(a, 'OWNER_A'), start(b, 'OWNER_B')]);
    const output: string[] = [];
    const runWrong = (session: Session, owner: Session, name: string, id: string) =>
      new Agent(session, provider, runtime.buildTools(owner.config, owner.id), { toolResult: event => output.push(String(event.content)) })
        .run(`CALL:${name}:${id}`);
    await Promise.all([runWrong(b, a, 'get_background_task', jobA.id), runWrong(a, b, 'task_stop', jobB.id)]);
    await runWrong(b, a, 'read_notifications', jobA.id);
    assert.equal(output.length, 3);
    for (const result of output) assert.match(result, /session does not match the tool owner/i);
    assert.match(await tool(runtime, a, 'get_background_task').execute({ id: jobA.id }, direct), /running/);
    assert.match(await tool(runtime, b, 'get_background_task').execute({ id: jobB.id }, direct), /running/);
    const witness = JSON.parse(await tool(runtime, a, 'agent').execute({ prompt: 'WITNESS', name: 'witness' }, direct)) as { id: string };
    const old = tool(runtime, a, 'task_stop');
    const waiting = tool(runtime, a, 'get_background_task').execute({ id: jobA.id, wait_ms: 5000 }, { ...direct, session: a });
    const stale = assert.rejects(waiting, /released|closed|aborted|owner/i);
    await runtime.releaseSession!(a.id); a.close();
    await stale;
    reopened = Session.open(workspace, { id: a.id });
    await runtime.bindSession!(reopened);
    await assert.rejects(old.execute({ id: jobA.id }, direct), /released|closed|aborted/i);
    await assert.rejects(tool(runtime, reopened, 'get_background_task').execute({ id: jobA.id }, direct), /unknown|not found/i);
    assert.match(await tool(runtime, reopened, 'get_agent').execute({ id: witness.id }, direct), /OWNED_COMPLETE/);
    assert.match(await tool(runtime, b, 'get_background_task').execute({ id: jobB.id }, direct), /running/);
    await tool(runtime, b, 'task_stop').execute({ id: jobB.id }, direct);
    await tool(runtime, b, 'get_background_task').execute({ id: jobB.id, wait_ms: 5000 }, direct);
    assert.match(await tool(runtime, b, 'read_notifications').execute({}, direct), new RegExp(jobB.id));
  } finally {
    await runtime.close(); a.close(); b.close(); reopened?.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('real Agents keep child notification identities isolated through cancellation and owner release', { timeout: 10000 }, async () => {
  const entered = new Set<string>();
  const provider: ModelProvider = { count: async () => 0, complete: async (request, signal) => {
    const prompt = request.messages.at(-1)?.content;
    if (typeof prompt === 'string' && prompt.startsWith('START:')) return reply([{ type: 'tool_use', id: 'launch-child',
      name: 'agent', input: { prompt: prompt.slice(6), background: true }, caller: { type: 'direct' } }], 'tool_use');
    if (typeof prompt === 'string' && prompt.startsWith('STOP:')) return reply([{ type: 'tool_use', id: 'stop-child',
      name: 'stop_agent', input: { id: prompt.slice(5) }, caller: { type: 'direct' } }], 'tool_use');
    if (typeof prompt === 'string' && prompt.startsWith('HELD-')) {
      entered.add(prompt);
      await new Promise<void>(resolve => { if (signal.aborted) resolve(); else signal.addEventListener('abort', () => resolve(), { once: true }); });
    }
    return textReply();
  } };
  const { workspace, runtime, parent: a } = await setup(provider);
  const b = Session.open(workspace, { config: a.config });
  try {
    await runtime.bindSession!(b);
    const invoke = async (session: Session, prompt: string) => {
      let result = '';
      await new Agent(session, provider, runtime.buildTools(session.config, session.id),
        { toolResult: event => { result = String(event.content); } }).run(prompt);
      return JSON.parse(result) as { id: string; session_id: string; status: string };
    };
    const first = await invoke(a, 'START:HELD-A1');
    const second = await invoke(a, 'START:HELD-A2');
    const other = await invoke(b, 'START:HELD-B');
    await until(() => entered.size === 3);
    assert.equal(new Set([first.id, second.id, other.id]).size, 3);
    for (const child of [first, second, other]) assert.equal(child.id, child.session_id);
    await invoke(a, `STOP:${first.id}`);
    const notifications = runtime.drainEvents!(a.id).find(event => event.kind === 'agent_events');
    assert.ok(notifications && notifications.kind === 'agent_events');
    assert.equal(notifications.owner, a.id);
    assert.ok(notifications.events.some(event => event.agent.id === first.id && event.agent.status === 'cancelled'));
    assert.equal(notifications.events.some(event => event.agent.id === other.id), false);
    assert.equal(runtime.drainEvents!(b.id).some(event => event.kind === 'agent_events'), false);
    await runtime.releaseSession!(a.id);
    assert.deepEqual(runtime.drainEvents!(a.id), []);
    const result = await invoke(b, `STOP:${other.id}`);
    assert.equal(result.id, other.id);
    const otherEvents = runtime.drainEvents!(b.id).find(event => event.kind === 'agent_events');
    assert.ok(otherEvents && otherEvents.kind === 'agent_events');
    assert.equal(otherEvents.owner, b.id);
    assert.ok(otherEvents.events.some(event => event.agent.id === other.id && event.agent.status === 'cancelled'));
    assert.equal(otherEvents.events.some(event => event.agent.id === second.id), false);
  } finally { await runtime.close(); a.close(); b.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('real Agent lookup leaves both concurrently completed background notifications queued', async () => {
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    const prompt = request.messages.at(-1)?.content;
    if (typeof prompt === 'string' && prompt.startsWith('LOOKUP:')) {
      return reply([{ type: 'tool_use', id: 'lookup', name: 'get_background_task',
        input: { id: prompt.slice('LOOKUP:'.length) }, caller: { type: 'direct' } }], 'tool_use');
    }
    return textReply();
  } };
  const workspace = temporary();
  const config = { ...defaultConfig(workspace, []), model: 'fixture', skills: [],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] },
    features: { tasks: false, subagents: true, agentMessaging: true, background: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(workspace, { config });
  try {
    await runtime.bindSession!(session);
    const direct = { ...context(workspace), allowShell: true, session };
    const start = async (label: string) => JSON.parse(await tool(runtime, session, 'run_background').execute(
      { command: `printf ${label}`, description: label }, direct)) as { id: string };
    const [first, second] = await Promise.all([start('FIRST'), start('FIRST')]);
    await until(() => [first, second].every(job => {
      const state = runtime.backgroundTaskDetail?.(session.id, job.id);
      return state !== undefined && 'state' in state && state.state !== 'running';
    }), () => 'background jobs did not settle');
    const results: string[] = [];
    await new Agent(session, provider, runtime.buildTools(session.config, session.id), {
      toolResult: event => results.push(String(event.content)),
    }).run(`LOOKUP:${first.id}`);
    assert.match(results.join('\n'), /FIRST/);
    const pending = runtime.drainEvents!(session.id).find(event => event.kind === 'background');
    assert.ok(pending && pending.kind === 'background');
    assert.equal(pending.owner, session.id);
    for (const job of [first, second]) assert.ok(pending.events.some(event => event.job_id === job.id && event.kind === 'exit'));
    assert.deepEqual(pending.events.map(event => event.seq), [...pending.events.map(event => event.seq)].sort((a, b) => a - b));
    await runtime.releaseSession!(session.id);
    assert.deepEqual(runtime.drainEvents!(session.id), []);
  } finally {
    await runtime.close(); session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('releasing a messaging owner cancels a real Agent child without affecting another owner', async () => {
  let entered!: () => void;
  const childEntered = new Promise<void>(resolve => { entered = resolve; });
  let childAborted = false;
  const provider: ModelProvider = { count: async () => 0, complete: async (request, signal) => {
    const prompt = request.messages.at(-1)?.content;
    if (prompt === 'START OWNER A') return reply([{ type: 'tool_use', id: 'start-a', name: 'agent',
      input: { prompt: 'HELD CHILD' }, caller: { type: 'direct' } }], 'tool_use');
    if (prompt === 'HELD CHILD') {
      entered();
      await new Promise<void>(resolve => {
        if (signal.aborted) return resolve();
        signal.addEventListener('abort', () => resolve(), { once: true });
      });
      childAborted = true;
    }
    return textReply();
  } };
  const { workspace, runtime, parent } = await setup(provider);
  const other = Session.open(workspace, { config: parent.config });
  try {
    await runtime.bindSession!(other);
    const results: string[] = [];
    const running = new Agent(parent, provider, runtime.buildTools(parent.config, parent.id), {
      toolResult: event => results.push(String(event.content)),
    }).run('START OWNER A');
    await childEntered;
    await runtime.releaseSession!(parent.id);
    await running;
    assert.equal(childAborted, true);
    assert.match(results.join('\n'), /abort|cancel|stop/i);
    assert.match(await tool(runtime, other, 'agent').execute({ prompt: 'OWNER B' }, context(workspace)), /OWNED_COMPLETE/);
  } finally {
    await runtime.close(); await parent.close(); await other.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('release during actual Agent worktree preparation stops the hook and preserves cold history', async () => {
  let parentCalls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    if (request.messages.at(-1)?.content === 'PREPARE') {
      parentCalls++;
      return reply([{ type: 'tool_use', id: 'prepare-child', name: 'agent',
        input: { prompt: 'CHILD', isolation: 'worktree' }, caller: { type: 'direct' } }], 'tool_use');
    }
    return textReply();
  } };
  const { workspace, runtime, parent } = await setup(provider, 24000, root => ({ WorktreeCreate: [{ hooks: [{ type: 'command',
    command: `printf '%s' $$ > '${path.join(root, 'hook-pid')}'; exec sleep 30` }] }] }));
  let reopened: Session | undefined;
  try {
    const witness = await tool(runtime, parent, 'agent').execute({ prompt: 'WITNESS', name: 'witness', background: true }, context(workspace));
    const witnessId = (JSON.parse(witness) as { id: string }).id;
    await tool(runtime, parent, 'get_agent').execute({ id: witnessId, wait_ms: 5000 }, context(workspace));
    const marker = path.join(workspace, 'hook-pid');
    const results: string[] = [];
    const running = new Agent(parent, provider, runtime.buildTools(parent.config, parent.id), {
      toolResult: event => results.push(String(event.content)),
    }).run('PREPARE');
    await until(() => fs.existsSync(marker) && /^\d+$/.test(fs.readFileSync(marker, 'utf8')));
    const pid = Number(fs.readFileSync(marker, 'utf8'));
    assert.ok(pid > 0);
    const releasing = runtime.releaseSession!(parent.id);
    await releasing;
    await running;
    assert.equal(parentCalls, 1);
    assert.match(results.join('\n'), /WorktreeCreate hook failed/);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    const id = parent.id;
    parent.close();
    reopened = Session.open(workspace, { id });
    await runtime.bindSession!(reopened);
    const restored = await tool(runtime, reopened, 'list_agents').execute({}, context(workspace));
    assert.match(restored, /witness/);
    assert.match(restored, /OWNED_COMPLETE/);
    assert.equal(fs.existsSync(path.join(workspace, '.agent', `${witnessId}.jsonl.lock`)), false);
  } finally {
    await runtime.close(); parent.close(); reopened?.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('closing the owner during worktree preparation prevents a child launch', async () => {
  let childCalls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    if (request.messages.at(-1)?.content === 'CHILD') childCalls++;
    return textReply();
  } };
  const { workspace, runtime, parent } = await setup(provider, 24000, root => ({
    WorktreeCreate: [{ hooks: [{ type: 'command', command: `printf ready > '${path.join(root, 'ready')}'; read gate < '${path.join(root, 'gate')}'; printf '%s' '${path.join(root, 'checkout')}'` }] }],
    WorktreeRemove: [{ hooks: [{ type: 'command', command: `printf removed > '${path.join(root, 'removed')}'` }] }],
  }));
  let reopened: Session | undefined;
  try {
    const witness = JSON.parse(await tool(runtime, parent, 'agent').execute({ prompt: 'WITNESS', name: 'witness', background: true }, context(workspace))) as { id: string };
    await tool(runtime, parent, 'get_agent').execute({ id: witness.id, wait_ms: 5000 }, context(workspace));
    fs.mkdirSync(path.join(workspace, 'checkout'));
    execFileSync('mkfifo', [path.join(workspace, 'gate')]);
    const before = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl')).sort();
    const launch = tool(runtime, parent, 'agent').execute({ prompt: 'CHILD', isolation: 'worktree' }, context(workspace));
    await until(() => fs.existsSync(path.join(workspace, 'ready')));
    parent.close();
    reopened = Session.open(workspace, { id: parent.id });
    await assert.rejects(runtime.bindSession!(reopened), /another session instance/);
    fs.writeFileSync(path.join(workspace, 'gate'), 'go\n');
    await assert.rejects(launch, /session-owned tools|closed|owner/i);
    assert.equal(childCalls, 0);
    assert.ok(fs.existsSync(path.join(workspace, 'removed')));
    assert.deepEqual(fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl')).sort(), before);
    await runtime.releaseSession!(parent.id);
    await runtime.bindSession!(reopened);
    assert.match(await tool(runtime, reopened, 'list_agents').execute({}, context(workspace)), /witness/);
    assert.equal(fs.existsSync(path.join(workspace, '.agent', `${witness.id}.jsonl.lock`)), false);
  } finally { await runtime.close(); parent.close(); reopened?.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('child plan uses rewound parent plan identity across cold resume and obeys live rules', async () => {
  let expected = '';
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    const prompt = request.messages.at(-1)?.content;
    if (prompt === 'FIRST' || prompt === 'FOLLOW' || prompt === 'DENIED' || prompt === 'ASK') return reply([
      { type: 'tool_use', id: String(prompt), name: 'write_file', input: { path: expected, content: String(prompt) }, caller: { type: 'direct' } },
    ], 'tool_use');
    return textReply();
  } };
  const fixture = await setup(provider), { workspace } = fixture;
  let runtime = fixture.runtime, parent = fixture.parent;
  try {
    await runtime.close();
    parent.config.features = { ...parent.config.features, tasks: false, subagents: true, sourcePlanTools: true };
    parent.config.plansDirectory = 'plans';
    parent.planMode!.enter();
    runtime = await createRuntime(parent.config, provider, new AbortController().signal);
    await runtime.bindSession!(parent);
    await new Agent(parent, provider, runtime.buildTools(parent.config, parent.id)).run('CHECKPOINT');
    checkpointConversation(parent, 'plan-owner', new AbortController().signal);
    const preview = previewRewind(parent, 1, new AbortController().signal);
    const rewound = applyRewind(parent, preview, preview.token, new AbortController().signal);
    await runtime.close(); parent.close(); parent = rewound;
    assert.notEqual(parent.planId, parent.id);
    runtime = await createRuntime(parent.config, provider, new AbortController().signal);
    await runtime.bindSession!(parent);
    const child = JSON.parse(await tool(runtime, parent, 'agent').execute({ prompt: 'READY', name: 'plan', mode: 'general', background: true }, context(workspace))) as { id: string };
    await tool(runtime, parent, 'get_agent').execute({ id: child.id, wait_ms: 5000 }, context(workspace));
    expected = path.join(workspace, 'plans', `${parent.planId}-agent-${child.id}.md`);
    await runtime.submitAgentInput!(parent.id, child.id, 'FIRST');
    await until(() => runtime.agentTranscript!(parent.id, child.id)?.status === 'completed');
    assert.equal(fs.readFileSync(expected, 'utf8'), 'FIRST');
    fs.unlinkSync(expected);
    const id = parent.id;
    await runtime.close(); parent.close();
    const script = `import { Session } from './src/session.ts'; const s=Session.open(process.argv[1],{id:process.argv[2]}); try { process.stdout.write(JSON.stringify({path:s.planFilePath, owner:s.config.parentPlanId, ownership:s.planOwnership})); } finally { s.close(); }`;
    const observed = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, workspace, child.id], { cwd: process.cwd(), encoding: 'utf8' }));
    const owner = path.basename(expected).split('-agent-')[0];
    assert.deepEqual(observed, { path: expected, owner, ownership: { directory: path.dirname(expected), slug: owner } });
    parent = Session.open(workspace, { id });
    const sidecar = path.join(workspace, '.agent', 'subagents', id, `${child.id}.meta.json`);
    const original = fs.readFileSync(sidecar, 'utf8');
    const altered = JSON.parse(original);
    assert.equal(altered.parentPlanId, parent.planId);
    altered.parentPlanId = parent.id;
    fs.writeFileSync(sidecar, JSON.stringify(altered));
    parent.append({ kind: 'agent_history', id: child.id, digest: fingerprintOf(altered) });
    const rejected = new AgentRegistry({ source: parent.config, provider, tools: [] });
    assert.match(rejected.bindHistory(parent).join('\n'), /parent plan witness mismatch/);
    assert.deepEqual(rejected.list(), []);
    await rejected.close();
    fs.writeFileSync(sidecar, original);
    parent.append({ kind: 'agent_history', id: child.id, digest: fingerprintOf(JSON.parse(original)) });
    parent.close();
    const continuation = `
      import { Session } from './src/session.ts';
      import { createRuntime } from './src/runtime.ts';
      const [workspace, parentId, childId, target] = process.argv.slice(1);
      let calls = 0;
      const provider = { count: async () => 0, complete: async () => ({ id: 'fixture', model: 'fixture', type: 'message', role: 'assistant',
        content: calls++ === 0 ? [{ type: 'tool_use', id: 'follow', name: 'write_file', input: { path: target, content: 'FOLLOW' } }] : [{ type: 'text', text: 'complete' }],
        stop_reason: calls === 1 ? 'tool_use' : 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }) };
      const parent = Session.open(workspace, { id: parentId });
      const runtime = await createRuntime(parent.config, provider, new AbortController().signal);
      try {
        await runtime.bindSession(parent);
        await runtime.submitAgentInput(parent.id, childId, 'FOLLOW');
        const deadline = Date.now() + 5000;
        while (runtime.agentTranscript(parent.id, childId)?.status !== 'completed') {
          if (Date.now() > deadline) throw new Error('child continuation timed out');
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      } finally { await runtime.close(); parent.close(); }
    `;
    const mainPlan = path.join(workspace, 'plans', `${parent.planId}.md`);
    execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', continuation, workspace, id, child.id, mainPlan],
      { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' });
    assert.equal(fs.readFileSync(mainPlan, 'utf8'), 'FOLLOW');
    parent = Session.open(workspace, { id });
    runtime = await createRuntime(parent.config, provider, new AbortController().signal);
    await runtime.bindSession!(parent);
    parent.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'write_file' }], behavior: 'deny', destination: 'session' }]);
    await runtime.submitAgentInput!(parent.id, child.id, 'DENIED');
    await until(() => runtime.agentTranscript!(parent.id, child.id)?.status === 'completed');
    assert.equal(fs.existsSync(expected), false);
    assert.equal(fs.readFileSync(mainPlan, 'utf8'), 'FOLLOW');
    parent.adoptPermissionUpdates([{ type: 'removeRules', rules: [{ toolName: 'write_file' }], behavior: 'deny', destination: 'session' },
      { type: 'addRules', rules: [{ toolName: 'write_file' }], behavior: 'ask', destination: 'session' }]);
    await runtime.submitAgentInput!(parent.id, child.id, 'ASK');
    await until(() => runtime.agentTranscript!(parent.id, child.id)?.status === 'completed');
    assert.equal(fs.existsSync(expected), false);
    assert.match(JSON.stringify(runtime.agentTranscript!(parent.id, child.id)), /approv|permission/i);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('original parent cold startup retains passive child history, mutable context, same UUID and one follow-up effect', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    calls++;
    if (request.messages.at(-1)?.content === 'FIRST') return reply([
      { type: 'tool_use', id: 'read', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    ], 'tool_use');
    if (request.messages.at(-1)?.content === 'FOLLOW') return reply([
      { type: 'tool_use', id: 'write', name: 'write_file', input: { path: 'effect.txt', content: 'ONCE' }, caller: { type: 'direct' } },
    ], 'tool_use');
    return textReply();
  } };
  const fixture = await setup(provider), { workspace } = fixture;
  let runtime = fixture.runtime, parent = fixture.parent;
  try {
    const child = JSON.parse(await tool(runtime, parent, 'agent').execute({ prompt: 'FIRST', name: 'cold', mode: 'general', background: true }, context(workspace))) as { id: string };
    await tool(runtime, parent, 'get_agent').execute({ id: child.id, wait_ms: 5000 }, context(workspace));
    const journal = path.join(workspace, '.agent', `${child.id}.jsonl`), metadata = fs.readFileSync(journal, 'utf8').split('\n')[0];
    assert.equal(JSON.parse(metadata!).config.parentSessionId, parent.id);
    await runtime.close(); parent.close();
    parent = Session.open(workspace, { id: parent.id });
    runtime = await createRuntime(parent.config, provider, new AbortController().signal);
    const before = calls, parentBytes = fs.readFileSync(parent.file), childBytes = fs.readFileSync(journal);
    await runtime.bindSession!(parent);
    assert.equal(calls, before);
    assert.deepEqual(runtime.backgroundTasks!(parent.id).agents.map(row => [row.id, row.status]), [[child.id, 'completed']]);
    assert.match(JSON.stringify(runtime.agentTranscript!(parent.id, child.id)), /OWNED_FILE/);
    assert.deepEqual(fs.readFileSync(parent.file), parentBytes); assert.deepEqual(fs.readFileSync(journal), childBytes);
    const release = runtime.retainAgentView!(parent.id, child.id); assert.ok(release); release();
    assert.equal(runtime.agentTranscript!('foreign', child.id), undefined);
    assert.equal((await tool(runtime, parent, 'get_agent').execute({ id: 'cold' }, context(workspace))).includes(child.id), true);
    await runtime.submitAgentInput!(parent.id, child.id, 'FOLLOW');
    await until(() => runtime.agentTranscript!(parent.id, child.id)?.status === 'completed');
    assert.equal(fs.readFileSync(path.join(workspace, 'effect.txt'), 'utf8'), 'ONCE');
    assert.equal(calls, before + 2);
    const events = fs.readFileSync(journal, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const readResult = events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'read');
    assert.ok(readResult);
    assert.ok(Number.isFinite(Date.parse(readResult.timestamp)));
    assert.deepEqual(readResult.host, { kind: 'file_read', filePath: path.join(workspace, 'fixture.txt'), cacheKey: path.join(workspace, 'fixture.txt'),
      content: 'OWNED_FILE', mtimeMs: fs.statSync(path.join(workspace, 'fixture.txt')).mtimeMs,
      identity: { dev: String(fs.statSync(path.join(workspace, 'fixture.txt'), { bigint: true }).dev), ino: String(fs.statSync(path.join(workspace, 'fixture.txt'), { bigint: true }).ino) },
      offset: 1, limit: 2000, truncated: false });
    const reopenedChild = Session.open(workspace, { id: child.id });
    try {
      assert.equal(reopenedChild.config.parentSessionId, parent.id);
      const restored = reopenedChild.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'read');
      assert.equal(restored?.kind === 'tool_result' ? restored.timestamp : undefined, readResult.timestamp);
      assert.deepEqual(restored?.kind === 'tool_result' ? restored.host : undefined, readResult.host);
    } finally { reopenedChild.close(); }
    assert.equal(events.filter(event => event.kind === 'tool_start' && event.name === 'write_file').length, 1);
    assert.equal(fs.readFileSync(journal, 'utf8').split('\n')[0], metadata);
    assert.equal(runtime.backgroundWorkCount!(parent.id), 0);
    await runtime.close(); parent.close();
    parent = Session.open(workspace, { id: parent.id });
    runtime = await createRuntime(parent.config, provider, new AbortController().signal);
    await runtime.bindSession!(parent);
    assert.equal(runtime.agentTranscript!(parent.id, child.id)?.status, 'completed');
    assert.equal(calls, before + 2);
    assert.equal(fs.readFileSync(path.join(workspace, 'effect.txt'), 'utf8'), 'ONCE');
  } finally {
    await runtime.close(); parent.close();
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('persistence crash worker', { skip: !process.env.W385_CRASH_WORKSPACE }, async () => {
  const workspace = process.env.W385_CRASH_WORKSPACE!;
  const stage = process.env.W385_CRASH_STAGE!;
  const skillDir = path.join(workspace, 'fixture-skills');
  fs.mkdirSync(path.join(skillDir, 'fixture'), { recursive: true });
  const skillPath = path.join(skillDir, 'fixture', 'SKILL.md');
  fs.writeFileSync(skillPath, '---\nname: fixture\ndescription: Fixture\ncontext: fork\n---\nTASK\n');
  const item = { name: 'fixture', path: skillPath, description: 'Fixture', body: 'TASK',
    userInvocable: true, disableModelInvocation: false, context: 'fork' as const, background: true };
  const provider: ModelProvider = { count: async () => 0, complete: async request =>
    request.messages.at(-1)?.content === 'INVOKE'
      ? reply([{ type: 'tool_use', id: 'skill', name: 'skill', input: { name: 'fixture' }, caller: { type: 'direct' } }], 'tool_use')
      : textReply() };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', skills: [item], dynamicSkillDirs: [skillDir],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] },
    features: { tasks: false, subagents: true, agentMessaging: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  await runtime.bindSession!(parent);
  const prior = JSON.parse(await tool(runtime, parent, 'agent').execute({ prompt: 'PRIOR', name: 'prior', background: true }, context(workspace))) as { id: string };
  await tool(runtime, parent, 'get_agent').execute({ id: prior.id, wait_ms: 5000 }, context(workspace));
  const stop = (id: string) => {
    fs.writeFileSync(path.join(workspace, 'barrier.json'), JSON.stringify({ parent: parent.id, prior: prior.id, child: id, stage }));
    process.kill(process.pid, 'SIGSTOP');
  };
  const rename = fs.renameSync;
  fs.renameSync = ((from, to) => {
    const target = String(to);
    const phase = stage.replace(/-(before|after)$/, '');
    const suffix = phase === 'marker' ? '.forked-skill.marker.json' : phase === 'scope' ? '.forked-skill.json' : phase === 'history' || phase === 'settled' ? '.meta.json' : '';
    const id = suffix && target.endsWith(suffix) ? path.basename(target).slice(0, -suffix.length) : '';
    const matched = id && (phase !== 'settled' || JSON.parse(fs.readFileSync(from, 'utf8')).state.kind === 'settled');
    if (matched && stage.endsWith('-before')) stop(id);
    rename(from, to);
    if (matched && stage.endsWith('-after')) stop(id);
  }) as typeof fs.renameSync;
  const append = parent.append.bind(parent);
  parent.append = event => {
    if (event.kind === 'agent_history_intent' && event.id !== prior.id) {
      if (stage === 'intent-before') stop(event.id);
      if (stage === 'intent-torn') {
        const write = fs.writeSync;
        fs.writeSync = ((fd, buffer, offset, length, position) => {
          fs.writeSync = write;
          if (!Buffer.isBuffer(buffer) || typeof offset !== 'number' || typeof length !== 'number') throw new Error('unexpected journal write');
          write(fd, buffer, offset, Math.floor(length / 2), position);
          stop(event.id);
          return 0;
        }) as typeof fs.writeSync;
      }
      append(event);
      if (stage === 'intent-after') stop(event.id);
      return;
    }
    if (stage === 'witness-before' && event.kind === 'agent_history' && event.id !== prior.id) stop(event.id);
    if (event.kind === 'agent_history' && event.id !== prior.id && (stage === 'witness-torn' || stage === 'settled-torn')) {
      const sidecar = path.join(workspace, '.agent', 'subagents', parent.id, `${event.id}.meta.json`);
      const state = JSON.parse(fs.readFileSync(sidecar, 'utf8')).state.kind;
      if (state === (stage === 'settled-torn' ? 'settled' : 'active')) {
        const write = fs.writeSync;
        fs.writeSync = ((fd, buffer, offset, length, position) => {
          fs.writeSync = write;
          if (!Buffer.isBuffer(buffer) || typeof offset !== 'number' || typeof length !== 'number') throw new Error('unexpected journal write');
          write(fd, buffer, offset, Math.floor(length / 2), position);
          stop(event.id);
          return 0;
        }) as typeof fs.writeSync;
      }
    }
    append(event);
    if (stage === 'witness-after' && event.kind === 'agent_history' && event.id !== prior.id) stop(event.id);
    if (stage === 'settled-witness-after' && event.kind === 'agent_history' && event.id !== prior.id) {
      const sidecar = path.join(workspace, '.agent', 'subagents', parent.id, `${event.id}.meta.json`);
      if (JSON.parse(fs.readFileSync(sidecar, 'utf8')).state.kind === 'settled') stop(event.id);
    }
  };
  const skillTool = createSkillTool(parent.config, (selected, args, ctx) => runtime.runSkill!(parent.config, parent.id, selected, args, ctx.signal, undefined, ctx.conversation, ctx.session));
  parent.config.tools = [{ ...skillTool.schema, eager_input_streaming: true }];
  await new Agent(parent, provider, [skillTool]).run('INVOKE');
  throw new Error('persistence barrier was not reached');
});

test('fork skill crash at synchronous persistence barriers preserves prior history', { timeout: 60000 }, async () => {
  for (const stage of ['marker-before', 'marker-after', 'scope-before', 'scope-after',
    'history-before', 'history-after', 'witness-before', 'witness-after', 'witness-torn',
    'intent-before', 'intent-torn', 'intent-after', 'settled-before', 'settled-after', 'settled-torn', 'settled-witness-after']) {
    const workspace = temporary();
    const worker = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-isolation=none', '--test-name-pattern', '^persistence crash worker$', 'test/agent-cold-history.test.ts'], {
      cwd: process.cwd(), env: { ...process.env, W385_CRASH_WORKSPACE: workspace, W385_CRASH_STAGE: stage }, stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = ''; worker.stderr.setEncoding('utf8'); worker.stderr.on('data', chunk => { stderr += chunk; });
    const exited = new Promise<void>(resolve => worker.once('exit', () => resolve()));
    try {
      const barrier = path.join(workspace, 'barrier.json');
      await until(() => fs.existsSync(barrier) || worker.exitCode !== null);
      assert.ok(fs.existsSync(barrier), `${stage}: worker exited: ${stderr}`);
      let parsedBarrier: { parent: string; prior: string; child: string } | undefined;
      await until(() => {
        try {
          const parsed = JSON.parse(fs.readFileSync(barrier, 'utf8')) as { parent?: unknown; prior?: unknown; child?: unknown };
          if (typeof parsed.parent === 'string' && typeof parsed.prior === 'string' && typeof parsed.child === 'string') {
            parsedBarrier = parsed as { parent: string; prior: string; child: string };
            return true;
          }
        } catch { /* The child is still writing the barrier. */ }
        return false;
      });
      assert.ok(parsedBarrier, `${stage}: barrier did not become readable`);
      const ids = parsedBarrier!;
      worker.kill('SIGKILL'); await exited;
      const parentFile = path.join(workspace, '.agent', `${ids.parent}.jsonl`);
      const before = fs.readFileSync(parentFile);
      if (stage.endsWith('-torn')) assert.notEqual(before.at(-1), 10, stage);
      const childJournal = path.join(workspace, '.agent', `${ids.child}.jsonl`);
      assert.equal(fs.existsSync(childJournal), true, stage);
      const historyDir = path.join(workspace, '.agent', 'subagents', ids.parent);
      if (stage.startsWith('intent-')) {
        const sidecar = JSON.parse(fs.readFileSync(path.join(historyDir, `${ids.child}.meta.json`), 'utf8'));
        assert.equal(sidecar.state.kind, 'active', stage);
        const events = before.toString('utf8').split('\n').filter(Boolean).filter(line => { try { JSON.parse(line); return true; } catch { return false; } }).map(line => JSON.parse(line));
        const witness = events.findLast(event => event.kind === 'agent_history' && event.id === ids.child);
        const intent = events.findLast(event => event.kind === 'agent_history_intent' && event.id === ids.child);
        assert.equal(witness.digest, createHash('sha256').update(JSON.stringify(sidecar)).digest('hex'), stage);
        if (stage === 'intent-after') {
          assert.equal(intent.parent, ids.parent);
          assert.equal(intent.oldDigest, witness.digest);
          assert.equal(intent.stagedRunId, sidecar.state.runId);
          assert.equal(fingerprintOf(intent.terminalRecord), intent.newDigest);
          const journal = fs.readFileSync(childJournal);
          assert.equal(intent.journal.bytes, journal.length);
          assert.equal(intent.journal.sha256, createHash('sha256').update(journal).digest('hex'));
          assert.match(intent.newDigest, /^[a-f0-9]{64}$/);
        } else assert.equal(intent, undefined, stage);
      }
      if (stage === 'settled-after' || stage === 'settled-witness-after') {
        const events = before.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
        const intent = events.findLast(event => event.kind === 'agent_history_intent' && event.id === ids.child);
        const settled = JSON.parse(fs.readFileSync(path.join(historyDir, `${ids.child}.meta.json`), 'utf8'));
        assert.equal(settled.state.kind, 'settled');
        assert.equal(intent.newDigest, fingerprintOf(settled));
        assert.deepEqual(intent.journal, settled.state.journal);
      }
      const retainedTemps = fs.existsSync(historyDir) ? fs.readdirSync(historyDir).filter(name => name.includes(ids.child) && name.endsWith('.tmp')) : [];
      if (stage === 'history-before' || stage === 'settled-before') assert.equal(retainedTemps.length, 1, stage);
      assert.throws(() => Session.open(workspace, { id: ids.parent }), stage);
      const child = Session.open(workspace, { id: ids.child, recoverLock: true }); child.close();
      const parent = Session.open(workspace, { id: ids.parent, recoverLock: true });
      if (stage.endsWith('-torn')) {
        assert.equal(fs.statSync(parentFile).size, before.lastIndexOf(10) + 1, stage);
        assert.equal(fs.readFileSync(parentFile).at(-1), 10, stage);
        const evidence = fs.readdirSync(path.dirname(parentFile)).filter(name => name.startsWith(`${ids.parent}.jsonl.torn-`));
        assert.equal(evidence.length, 1, stage);
        assert.deepEqual(fs.readFileSync(path.join(path.dirname(parentFile), evidence[0]!)), before, stage);
      }
      const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('unexpected provider call'); } };
      const runtime = await createRuntime(parent.config, provider, new AbortController().signal);
      try {
        const diagnostic = new AgentRegistry({ source: parent.config, provider, tools: runtime.tools });
        const warnings = diagnostic.bindHistory(parent);
        if (stage === 'settled-after' || stage === 'settled-torn') assert.doesNotMatch(warnings.join('\n'), /no matching parent witness/, stage);
        await runtime.bindSession!(parent);
        assert.equal(runtime.agentTranscript!(parent.id, ids.prior)?.status, 'completed', stage);
        assert.equal(runtime.agentTranscript!(parent.id, ids.child)?.status,
          ['intent-after', 'settled-before', 'settled-after', 'settled-torn', 'settled-witness-after'].includes(stage) ? 'completed' : undefined, `${stage} ${JSON.stringify(warnings)}`);
      } finally { await runtime.close(); parent.close(); }
      // A second cold open must reach the same result without consuming evidence.
      const sidecar = path.join(historyDir, `${ids.child}.meta.json`);
      const retainedSidecar = fs.existsSync(sidecar) ? fs.readFileSync(sidecar) : undefined;
      const committed = fs.readFileSync(parentFile);
      const reopened = Session.open(workspace, { id: ids.parent });
      const again = await createRuntime(reopened.config, provider, new AbortController().signal);
      try {
        const diagnostic = new AgentRegistry({ source: reopened.config, provider, tools: again.tools });
        const warnings = diagnostic.bindHistory(reopened);
        if (stage === 'settled-after' || stage === 'settled-torn') assert.doesNotMatch(warnings.join('\n'), /no matching parent witness/, stage);
        await diagnostic.close();
        await again.bindSession!(reopened);
        assert.equal(again.agentTranscript!(reopened.id, ids.prior)?.status, 'completed', stage);
        assert.equal(again.agentTranscript!(reopened.id, ids.child)?.status,
          ['intent-after', 'settled-before', 'settled-after', 'settled-torn', 'settled-witness-after'].includes(stage) ? 'completed' : undefined, stage);
      } finally { await again.close(); reopened.close(); }
      assert.deepEqual(fs.readFileSync(parentFile), committed, `${stage}: second recovery must not append`);
      if (retainedSidecar) assert.deepEqual(fs.readFileSync(sidecar), retainedSidecar, stage);
      assert.equal(fs.existsSync(childJournal), true, `${stage}: orphan journal retained`);
      for (const name of retainedTemps) assert.equal(fs.existsSync(path.join(historyDir, name)), true, stage);
      assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false, stage);
    } finally { if (worker.exitCode === null && worker.signalCode === null) { worker.kill('SIGKILL'); await exited; } fs.rmSync(workspace, { recursive: true, force: true }); }
  }
});

test('crashed replacement rejects missing or altered intent and failed downstream checks without a witness', { timeout: 60000 }, async () => {
  for (const mutation of ['legacy', 'old', 'new', 'parent', 'child', 'journal', 'journal-data', 'scope', 'tools']) {
    const workspace = temporary();
    const worker = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-isolation=none', '--test-name-pattern', '^persistence crash worker$', 'test/agent-cold-history.test.ts'], {
      cwd: process.cwd(), env: { ...process.env, W385_CRASH_WORKSPACE: workspace, W385_CRASH_STAGE: 'settled-after' }, stdio: ['ignore', 'ignore', 'pipe'],
    });
    const exited = new Promise<void>(resolve => worker.once('exit', () => resolve()));
    try {
      const barrier = path.join(workspace, 'barrier.json');
      let ids: { parent: string; child: string } | undefined;
      await until(() => {
        if (worker.exitCode !== null) return true;
        try {
          const value = JSON.parse(fs.readFileSync(barrier, 'utf8')) as { parent?: unknown; child?: unknown };
          if (typeof value.parent === 'string' && typeof value.child === 'string') { ids = { parent: value.parent, child: value.child }; return true; }
        } catch { /* the worker may still be writing the barrier */ }
        return false;
      });
      if (ids === undefined) throw new Error(`missing barrier: ${mutation}`);
      const barrierIds = ids as { parent: string; child: string };
      worker.kill('SIGKILL'); await exited;
      const parentFile = path.join(workspace, '.agent', `${barrierIds.parent}.jsonl`);
      const sidecar = path.join(workspace, '.agent', 'subagents', barrierIds.parent, `${barrierIds.child}.meta.json`);
      const events = fs.readFileSync(parentFile, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
      const index = events.findLastIndex(event => event.kind === 'agent_history_intent' && event.id === barrierIds.child);
      assert.ok(index >= 0);
      const intent = events[index];
      if (mutation === 'legacy') events.splice(index, 1);
      if (mutation === 'old') intent.oldDigest = '0'.repeat(64);
      if (mutation === 'new') intent.newDigest = '0'.repeat(64);
      if (mutation === 'parent') intent.parent = '00000000-0000-4000-8000-000000000000';
      if (mutation === 'child') intent.id = '00000000-0000-4000-8000-000000000000';
      if (mutation === 'journal') intent.journal.sha256 = '0'.repeat(64);
      fs.writeFileSync(parentFile, events.map(event => JSON.stringify(event)).join('\n') + '\n');
      if (mutation === 'scope') fs.unlinkSync(path.join(workspace, '.agent', `${barrierIds.child}.forked-skill.json`));
      if (mutation === 'journal-data') fs.appendFileSync(path.join(workspace, '.agent', `${barrierIds.child}.jsonl`), '{"kind":"turn_end","reason":"foreign"}\n');
      const originalParent = fs.readFileSync(parentFile), originalSidecar = fs.readFileSync(sidecar);
      const child = Session.open(workspace, { id: barrierIds.child, recoverLock: true }); child.close();
      const parent = Session.open(workspace, { id: barrierIds.parent, recoverLock: true });
      const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('unexpected provider call'); } };
      const runtime = await createRuntime(parent.config, provider, new AbortController().signal);
      try {
        const registry = new AgentRegistry({ source: parent.config, provider, tools: mutation === 'tools' ? [] : runtime.tools });
        assert.ok(registry.bindHistory(parent).length, mutation);
        assert.equal(registry.list().some(entry => entry.id === barrierIds.child), false, mutation);
        await registry.close();
        assert.deepEqual(fs.readFileSync(parentFile), originalParent, mutation);
        assert.deepEqual(fs.readFileSync(sidecar), originalSidecar, mutation);
      } finally { await runtime.close(); parent.close(); }
    } finally {
      if (worker.exitCode === null && worker.signalCode === null) { worker.kill('SIGKILL'); await exited; }
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }
});

test('failed journal writes fence further appends until recovery', async () => {
  for (const fault of ['partial', 'sync'] as const) {
    const workspace = temporary();
    const parent = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture' } });
    const write = fs.writeSync, sync = fs.fsyncSync;
    try {
      if (fault === 'partial') {
        let injected = false;
        fs.writeSync = ((fd, buffer, offset, length, position) => {
          if (!Buffer.isBuffer(buffer) || typeof offset !== 'number' || typeof length !== 'number') throw new Error('unexpected write');
          if (injected) throw new Error('injected write failure');
          injected = true;
          return write(fd, buffer, offset, Math.floor(length / 2), position);
        }) as typeof fs.writeSync;
      } else fs.fsyncSync = (() => { throw new Error('injected sync failure'); }) as typeof fs.fsyncSync;
      assert.throws(() => parent.append({ kind: 'title', title: 'first' }), /injected/);
      fs.writeSync = write; fs.fsyncSync = sync;
      const failed = fs.readFileSync(parent.file);
      assert.throws(() => parent.append({ kind: 'title', title: 'second' }), /journal.*fail/i);
      assert.deepEqual(fs.readFileSync(parent.file), failed);
      parent.close();
      const reopened = Session.open(workspace, { id: parent.id });
      try {
        reopened.append({ kind: 'title', title: 'recovered' });
        assert.equal(reopened.events.at(-1)?.kind, 'title');
      } finally { reopened.close(); }
    } finally { fs.writeSync = write; fs.fsyncSync = sync; parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
  }
});

test('ordinary session reopen recovers its incomplete final record', async () => {
  const provider: ModelProvider = { count: async () => 0, complete: async () => textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  try {
    await runtime.close(); parent.close();
    const original = fs.readFileSync(parent.file);
    fs.appendFileSync(parent.file, Buffer.from('{"kind":"消息'));
    const torn = fs.readFileSync(parent.file);
    const sync = fs.fsyncSync;
    try {
      fs.fsyncSync = fd => {
        if (fs.fstatSync(fd).isDirectory()) throw new Error('evidence directory sync failed');
        sync(fd);
      };
      assert.throws(() => Session.open(workspace, { id: parent.id }), /evidence directory sync failed/);
      assert.deepEqual(fs.readFileSync(parent.file), torn);
    } finally { fs.fsyncSync = sync; }
    const reopened = Session.open(workspace, { id: parent.id });
    try { assert.deepEqual(fs.readFileSync(parent.file), original); } finally { reopened.close(); }
    const copies = fs.readdirSync(path.dirname(parent.file)).filter(name => name.startsWith(`${parent.id}.jsonl.torn-`));
    assert.equal(copies.length, 2);
    for (const copy of copies) assert.deepEqual(fs.readFileSync(path.join(path.dirname(parent.file), copy)), torn);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('torn recovery crash worker', { skip: !process.env.W385_RECOVERY_WORKSPACE }, () => {
  const workspace = process.env.W385_RECOVERY_WORKSPACE!;
  const id = process.env.W385_RECOVERY_ID!;
  const stage = process.env.W385_RECOVERY_STAGE!;
  const stop = () => {
    fs.writeFileSync(path.join(workspace, 'recovery-barrier'), stage);
    process.kill(process.pid, 'SIGSTOP');
  };
  const open = fs.openSync, close = fs.closeSync, write = fs.writeSync, sync = fs.fsyncSync, truncate = fs.ftruncateSync, link = fs.linkSync;
  let evidenceFd = -1, lockFd = -1, journalFd = -1;
  fs.openSync = ((file, flags, mode) => {
    const fd = open(file, flags, mode);
    const name = String(file);
    if (name.includes(`${id}.jsonl.lock.init-`)) {
      lockFd = fd;
      if (stage === 'lock-created') stop();
    }
    if (name.includes(`${id}.jsonl.torn-`)) evidenceFd = fd;
    if (name.endsWith(`${id}.jsonl`) && flags !== 'r') journalFd = fd;
    return fd;
  }) as typeof fs.openSync;
  fs.closeSync = fd => {
    if (fd === lockFd) lockFd = -1;
    if (fd === evidenceFd) evidenceFd = -1;
    if (fd === journalFd) journalFd = -1;
    close(fd);
  };
  const writeFile = fs.writeFileSync;
  fs.writeFileSync = ((file, data, options) => {
    if (file === lockFd && stage === 'lock-partial') {
      const bytes = Buffer.from(String(data));
      write(lockFd, bytes, 0, Math.floor(bytes.length / 2), null);
      stop();
    }
    return writeFile(file, data, options);
  }) as typeof fs.writeFileSync;
  fs.writeSync = ((fd, buffer, offset, length, position) => {
    if (fd === evidenceFd && Buffer.isBuffer(buffer) && typeof offset === 'number' && typeof length === 'number') {
      if (stage === 'evidence-partial') { write(fd, buffer, offset, Math.floor(length / 2), position); stop(); }
      const count = write(fd, buffer, offset, length, position);
      if (stage === 'evidence-written') stop();
      return count;
    }
    return write(fd, buffer, offset, length, position);
  }) as typeof fs.writeSync;
  fs.fsyncSync = fd => {
    const point = fd === lockFd ? 'lock' : fd === evidenceFd ? 'evidence-sync' :
      fd === journalFd ? 'journal-sync' : fs.fstatSync(fd).isDirectory() ? 'directory-sync' : '';
    if (stage === `${point}-before`) stop();
    sync(fd);
    if (stage === `${point}-after`) stop();
  };
  fs.linkSync = (source, destination) => {
    link(source, destination);
    if (String(destination).endsWith(`${id}.jsonl.lock`) && stage === 'lock-published') stop();
  };
  fs.ftruncateSync = (fd, length) => {
    if (fd === journalFd && stage === 'truncate-before') stop();
    truncate(fd, length);
    if (fd === journalFd && stage === 'truncate-after') stop();
  };
  Session.open(workspace, { id, recoverLock: true });
  throw new Error(`recovery barrier ${stage} was not reached`);
});

test('SIGKILL during torn recovery preserves complete events and evidence across restarts', { timeout: 60000 }, async () => {
  for (const stage of ['lock-created', 'lock-partial', 'lock-before', 'lock-after', 'lock-published', 'evidence-partial', 'evidence-written', 'evidence-sync-before',
    'evidence-sync-after', 'directory-sync-before', 'directory-sync-after', 'truncate-before',
    'truncate-after', 'journal-sync-before', 'journal-sync-after']) {
    const provider: ModelProvider = { count: async () => 0, complete: async () => textReply() };
    const { workspace, runtime, parent } = await setup(provider);
    const child = JSON.parse(await tool(runtime, parent, 'agent').execute({ prompt: 'PRIOR', background: true }, context(workspace))) as { id: string };
    await tool(runtime, parent, 'get_agent').execute({ id: child.id, wait_ms: 5000 }, context(workspace));
    parent.append({ kind: 'title', title: 'retained event' });
    const id = parent.id, file = parent.file;
    await runtime.close();
    parent.close();
    const complete = fs.readFileSync(file);
    fs.appendFileSync(file, Buffer.from('{"kind":"消息'));
    const original = fs.readFileSync(file);
    const worker = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-isolation=none', '--test-name-pattern', '^torn recovery crash worker$', 'test/agent-cold-history.test.ts'], {
      cwd: process.cwd(), env: { ...process.env, W385_RECOVERY_WORKSPACE: workspace, W385_RECOVERY_ID: id, W385_RECOVERY_STAGE: stage }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    worker.stdout.setEncoding('utf8'); worker.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-8000); });
    worker.stderr.setEncoding('utf8'); worker.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
    const exited = new Promise<void>(resolve => worker.once('exit', () => resolve()));
    try {
      const diagnostic = () => {
        let status = 'unavailable';
        if (worker.pid) try { status = execFileSync('ps', ['-o', 'pid,ppid,state,etime', '-p', String(worker.pid)], { encoding: 'utf8', timeout: 1000 }).trim(); } catch { /* Process may already have exited. */ }
        const files = fs.readdirSync(path.dirname(file)).filter(name => name.startsWith(id)).map(name => {
          try { return `${name.replace(id, '<session>')}:${fs.statSync(path.join(path.dirname(file), name)).size}`; } catch { return `${name.replace(id, '<session>')}:gone`; }
        });
        return `recovery barrier ${stage}: pid=${worker.pid} exit=${worker.exitCode} signal=${worker.signalCode} ps=${status} files=${JSON.stringify(files)} memory=${JSON.stringify(process.memoryUsage())} stdout=${stdout} stderr=${stderr}`;
      };
      await until(() => fs.existsSync(path.join(workspace, 'recovery-barrier')) || worker.exitCode !== null || worker.signalCode !== null, diagnostic);
      if (!fs.existsSync(path.join(workspace, 'recovery-barrier'))) assert.fail(diagnostic());
      const lockPath = `${file}.lock`;
      const lockBytes = fs.existsSync(lockPath) ? fs.readFileSync(lockPath) : undefined;
      const initName = fs.readdirSync(path.dirname(file)).find(name => name.startsWith(`${id}.jsonl.lock.init-`));
      const initBytes = initName ? fs.readFileSync(path.join(path.dirname(file), initName)) : undefined;
      if (stage === 'lock-created') assert.equal(initBytes?.length, 0);
      if (stage === 'lock-partial') {
        assert.ok(initBytes?.toString().startsWith('{"pid":'));
        assert.throws(() => JSON.parse(initBytes!.toString()));
      }
      assert.throws(() => Session.open(workspace, { id }), /EEXIST|busy/, stage);
      assert.throws(() => Session.open(workspace, { id, recoverLock: true }), /active|EEXIST|busy/, stage);
      assert.equal(fs.existsSync(lockPath), lockBytes !== undefined, stage);
      if (lockBytes) assert.deepEqual(fs.readFileSync(lockPath), lockBytes, stage);
      const atBarrier = fs.readFileSync(file);
      const truncated = ['truncate-after', 'journal-sync-before', 'journal-sync-after'].includes(stage);
      assert.deepEqual(atBarrier, truncated ? complete : original, stage);
      const barrierCopies = fs.readdirSync(path.dirname(file)).filter(name => name.startsWith(`${id}.jsonl.torn-`));
      if (stage === 'evidence-partial') {
        assert.equal(barrierCopies.length, 1, stage);
        assert.deepEqual(fs.readFileSync(path.join(path.dirname(file), barrierCopies[0]!)), original.subarray(0, Math.floor(original.length / 2)), stage);
      } else if (!stage.startsWith('lock-')) {
        assert.equal(barrierCopies.length, 1, stage);
        assert.deepEqual(fs.readFileSync(path.join(path.dirname(file), barrierCopies[0]!)), original, stage);
      }
      worker.kill('SIGKILL'); await exited;
      assert.equal(worker.signalCode, 'SIGKILL', stage);
      if (lockBytes) assert.throws(() => Session.open(workspace, { id }), stage);
      for (let restart = 0; restart < 2; restart++) {
        const reopened = Session.open(workspace, { id, recoverLock: restart === 0 });
        try {
          assert.equal(reopened.events.find(event => event.kind === 'title')?.title, 'retained event', stage);
          assert.deepEqual(fs.readFileSync(file), complete, stage);
          const restored = await createRuntime(reopened.config, provider, new AbortController().signal);
          try {
            await restored.bindSession!(reopened);
            assert.equal(restored.agentTranscript!(id, child.id)?.status, 'completed', stage);
          } finally { await restored.close(); }
          assert.deepEqual(fs.readFileSync(file), complete, stage);
        } finally { reopened.close(); }
      }
      const copies = fs.readdirSync(path.dirname(file)).filter(name => name.startsWith(`${id}.jsonl.torn-`));
      assert.ok(copies.some(name => fs.readFileSync(path.join(path.dirname(file), name)).equals(original)), stage);
      assert.equal(fs.existsSync(`${file}.lock`), false, stage);
    } finally {
      if (worker.exitCode === null && worker.signalCode === null) { worker.kill('SIGKILL'); await exited; }
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }
});

test('sidecar sync failures preserve evidence and fence witness until recovery sync', async () => {
  const provider: ModelProvider = { count: async () => 0, complete: async () => textReply() };
  for (const fault of ['none', 'file', 'directory'] as const) {
    const { workspace, runtime, parent } = await setup(provider);
    const sync = fs.fsyncSync, rename = fs.renameSync, append = parent.append.bind(parent);
    try {
      const child = JSON.parse(await tool(runtime, parent, 'agent').execute({ prompt: 'OWNED', background: true }, context(workspace))) as { id: string };
      await tool(runtime, parent, 'get_agent').execute({ id: child.id, wait_ms: 5000 }, context(workspace));
      const store = new AgentHistoryStore(parent, 10_000_000, 10000);
      const original = store.read().records.find(item => item.id === child.id);
      assert.ok(original && original.state.kind === 'settled');
      const record = { ...original, state: { ...original.state, summary: `${original.state.summary} revised` } };
      const dir = path.join(workspace, '.agent', 'subagents', parent.id);
      const target = path.join(dir, `${child.id}.meta.json`), prior = fs.readFileSync(target);
      const directory = fs.statSync(dir);
      const parentJournal = fs.statSync(parent.file);
      const sequence: string[] = [];
      let renamed = false;
      parent.append = event => { if (event.kind === 'agent_history_intent') sequence.push('intent'); if (event.kind === 'agent_history') sequence.push('witness'); append(event); };
      fs.renameSync = ((from, to) => { rename(from, to); if (String(to) === target) { renamed = true; sequence.push('rename'); } }) as typeof fs.renameSync;
      fs.fsyncSync = fd => {
        const stat = fs.fstatSync(fd);
        const isDirectory = stat.dev === directory.dev && stat.ino === directory.ino;
        if (!stat.isDirectory() && stat.ino !== parentJournal.ino && !renamed && sequence.includes('intent')) {
          sequence.push('file-sync');
          if (fault === 'file') throw new Error('injected file sync');
        }
        if (isDirectory && renamed) {
          sequence.push('dir-sync');
          if (fault === 'directory') throw new Error('injected directory sync');
        }
        sync(fd);
      };
      if (fault === 'none') {
        store.write(record);
        assert.deepEqual(sequence.filter(x => ['intent', 'file-sync', 'rename', 'dir-sync', 'witness'].includes(x)), ['intent', 'file-sync', 'rename', 'dir-sync', 'witness']);
      } else {
        assert.throws(() => store.write(record), /injected/);
        assert.equal(sequence.includes('witness'), false);
        if (fault === 'file') {
          assert.deepEqual(fs.readFileSync(target), prior);
          assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.tmp')), true);
        } else {
          assert.equal(JSON.parse(fs.readFileSync(target, 'utf8')).state.summary, record.state.summary);
          assert.equal(store.read().candidates.has(child.id), true);
          const sidecar = fs.statSync(target);
          fs.fsyncSync = fd => {
            const stat = fs.fstatSync(fd);
            if (stat.dev === sidecar.dev && stat.ino === sidecar.ino) throw Object.assign(new Error('unsupported recovery sync'), { code: 'ENOTSUP' });
            sync(fd);
          };
          assert.throws(() => store.commitCandidate(record), /unsupported recovery sync/);
          assert.equal(sequence.includes('witness'), false);
          fs.fsyncSync = fd => {
            const stat = fs.fstatSync(fd);
            if (stat.dev === directory.dev && stat.ino === directory.ino) throw new Error('injected directory sync');
            sync(fd);
          };
          assert.throws(() => store.commitCandidate(record), /injected directory sync/);
          assert.equal(sequence.includes('witness'), false);
          fs.fsyncSync = sync;
          store.commitCandidate(record);
          assert.equal(sequence.filter(x => x === 'witness').length, 1);
        }
      }
    } finally {
      fs.fsyncSync = sync; fs.renameSync = rename; parent.append = append;
      await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true });
    }
  }
});

test('settled intent failure and forged prior sidecar preserve the witnessed file', async () => {
  const provider: ModelProvider = { count: async () => 0, complete: async () => textReply() };
  const { workspace, runtime, parent } = await setup(provider);
  try {
    const child = JSON.parse(await tool(runtime, parent, 'agent').execute({ prompt: 'OWNED', background: true }, context(workspace))) as { id: string };
    await tool(runtime, parent, 'get_agent').execute({ id: child.id, wait_ms: 5000 }, context(workspace));
    const store = new AgentHistoryStore(parent, 10_000_000, 10000);
    const record = store.read().records.find(item => item.id === child.id);
    assert.ok(record && record.state.kind === 'settled');
    const file = path.join(workspace, '.agent', 'subagents', parent.id, `${child.id}.meta.json`);
    const original = fs.readFileSync(file);
    const intent = parent.events.findLast(event => event.kind === 'agent_history_intent' && event.id === child.id);
    assert.ok(intent && intent.kind === 'agent_history_intent');
    assert.throws(() => parent.append({ ...intent, journal: { ...intent.journal, sha256: 'forged' } }));
    const extra = { ...intent, unexpected: true };
    assert.throws(() => parent.append(extra));
    const append = parent.append.bind(parent);
    parent.append = event => { if (event.kind === 'agent_history_intent') throw new Error('injected intent failure'); append(event); };
    assert.throws(() => store.write(record), /injected intent failure/);
    assert.deepEqual(fs.readFileSync(file), original);
    parent.append = append;
    const forged = { ...record, prompt: 'forged' };
    fs.writeFileSync(file, JSON.stringify(forged));
    const altered = fs.readFileSync(file);
    assert.throws(() => store.write(record), /no matching parent witness/);
    assert.deepEqual(fs.readFileSync(file), altered);
    fs.writeFileSync(file, original);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('cold import needs the original parent witness, complete matching journal and unique trusted tools', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => { calls++; return textReply(); } };
  const fixture = await setup(provider), { workspace } = fixture;
  let runtime = fixture.runtime, parent = fixture.parent;
  try {
    const child = JSON.parse(await tool(runtime, parent, 'agent').execute({ prompt: 'OWNED 中文', name: 'owner', background: true }, context(workspace))) as { id: string };
    await tool(runtime, parent, 'get_agent').execute({ id: child.id, wait_ms: 5000 }, context(workspace));
    await runtime.close(); parent.close();
    const sidecar = path.join(workspace, '.agent', 'subagents', parent.id, `${child.id}.meta.json`);
    const original = fs.readFileSync(sidecar, 'utf8'), journal = path.join(workspace, '.agent', `${child.id}.jsonl`);
    const originalJournal = fs.readFileSync(journal);
    parent = Session.open(workspace, { id: parent.id });
    const before = calls;
    const check = (tools: import('../src/tools.js').ToolDefinition[] = [], expected?: RegExp) => {
      const registry = new AgentRegistry({ source: parent.config, provider, tools });
      const warnings = registry.bindHistory(parent);
      assert.deepEqual(registry.list(), []); assert.ok(warnings.length > 0);
      if (expected) assert.match(warnings.join('\n'), expected);
      return registry.close();
    };
    await check();
    const scope = journal.replace(/\.jsonl$/, '.forked-skill.json');
    const marker = journal.replace(/\.jsonl$/, '.forked-skill.marker.json');
    fs.writeFileSync(marker, JSON.stringify({ forkedSkill: true, skillName: 'fixture' }));
    await check([], /scope is missing or malformed/);
    fs.writeFileSync(scope, JSON.stringify({ skillName: 'fixture', attributionName: 'fixture' }));
    fs.writeFileSync(marker, JSON.stringify({ forkedSkill: true, skillName: 'other' }));
    await check([], /skill history identity mismatch/);
    fs.writeFileSync(marker, JSON.stringify({ forkedSkill: true, skillName: 'fixture' }));
    await check([], /skill history identity mismatch/);
    fs.unlinkSync(scope); fs.unlinkSync(marker);
    fs.writeFileSync(sidecar, '{'); await check(); fs.writeFileSync(sidecar, original);
    fs.appendFileSync(journal, '{"kind":"turn_end","reason":"foreign"}\n'); await check(); fs.writeFileSync(journal, originalJournal);
    for (const suffix of [Buffer.from('{"kind":'), Buffer.from('残缺'), Buffer.from([0xe4, 0xb8])]) {
      fs.appendFileSync(journal, suffix);
      const damaged = fs.readFileSync(journal);
      await check([], /continuity mismatch/);
      assert.deepEqual(fs.readFileSync(journal), damaged);
      fs.writeFileSync(journal, originalJournal);
    }
    const incomplete = Buffer.concat([originalJournal, Buffer.from('残缺')]);
    fs.writeFileSync(journal, incomplete);
    assert.throws(() => readSessionJournal(workspace, child.id, { maxBytes: 10000000, maxEvents: 10000 }, {
      bytes: incomplete.length, sha256: createHash('sha256').update(incomplete).digest('hex'),
    }), /continuity mismatch/);
    fs.writeFileSync(journal, originalJournal);
    const changed: unknown = JSON.parse(original);
    assert.ok(changed && typeof changed === 'object' && 'parent' in changed);
    Reflect.set(changed, 'parent', '00000000-0000-4000-8000-000000000000');
    fs.writeFileSync(sidecar, JSON.stringify(changed)); await check(); fs.writeFileSync(sidecar, original);
    runtime = await createRuntime(parent.config, provider, new AbortController().signal);
    await runtime.bindSession!(parent);
    assert.equal(runtime.agentTranscript!(parent.id, child.id)?.status, 'completed');
    fs.appendFileSync(journal, '{"kind":');
    const lateBytes = fs.readFileSync(journal);
    await runtime.submitAgentInput!(parent.id, child.id, 'LATE');
    await until(() => runtime.agentTranscript!(parent.id, child.id)?.status === 'failed');
    await assert.rejects(runtime.submitAgentInput!(parent.id, child.id, 'RETRY'), /continuity/);
    assert.equal(calls, before);
    assert.deepEqual(fs.readFileSync(journal), lateBytes);
    await runtime.close();
    fs.writeFileSync(journal, originalJournal); fs.writeFileSync(sidecar, original);
    const active = JSON.parse(original); active.state = { kind: 'active' };
    fs.writeFileSync(sidecar, JSON.stringify(active));
    parent.append({ kind: 'agent_history', id: child.id, digest: fingerprintOf(active) });
    const registry = new AgentRegistry({ source: parent.config, provider, tools: [] });
    assert.deepEqual(registry.bindHistory(parent), []); assert.deepEqual(registry.list(), []); await registry.close();
    assert.equal(calls, before);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('persisted stop keeps peer input closed while explicit human restart retains live permission checks', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async (request, signal) => {
    calls++;
    if (request.messages.at(-1)?.content === 'FIRST') {
      await new Promise<void>((_resolve, reject) => {
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
    if (request.messages.at(-1)?.content === 'HUMAN_RESTART') return reply([
      { type: 'tool_use', id: 'denied', name: 'write_file', input: { path: 'denied.txt', content: 'BLOCKED' }, caller: { type: 'direct' } },
    ], 'tool_use');
    return textReply();
  } };
  const fixture = await setup(provider), { workspace } = fixture;
  let runtime = fixture.runtime, parent = fixture.parent;
  try {
    const child = JSON.parse(await tool(runtime, parent, 'agent').execute({ prompt: 'FIRST', mode: 'general', background: true }, context(workspace))) as { id: string };
    await until(() => calls > 0);
    await tool(runtime, parent, 'stop_agent').execute({ id: child.id }, context(workspace));
    await runtime.close(); parent.close();
    parent = Session.open(workspace, { id: parent.id });
    parent.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'write_file' }], behavior: 'deny', destination: 'session' }]);
    runtime = await createRuntime(parent.config, provider, new AbortController().signal);
    await runtime.bindSession!(parent);
    const before = calls;
    await assert.rejects(tool(runtime, parent, 'send_message').execute({ id: child.id, message: 'PEER' }, context(workspace)), /cancelled/);
    assert.equal(calls, before);
    await runtime.submitAgentInput!(parent.id, child.id, 'HUMAN_RESTART');
    await until(() => runtime.agentTranscript!(parent.id, child.id)?.status === 'completed');
    assert.equal(fs.existsSync(path.join(workspace, 'denied.txt')), false);
    assert.match(JSON.stringify(runtime.agentTranscript!(parent.id, child.id)), /denied|Denied/);
    assert.equal(calls, before + 2);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
