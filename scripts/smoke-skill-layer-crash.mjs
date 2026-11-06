import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Agent, defaultConfig } from '../dist/agent.js';
import { createRuntime } from '../dist/runtime.js';
import { Session } from '../dist/session.js';
import { SkillEffectJournal } from '../dist/skill-effects.js';

const script = fileURLToPath(import.meta.url);
const response = (content, stop_reason = 'end_turn') => ({ id: 'fixture', type: 'message', role: 'assistant', model: 'fixture', content, stop_reason, usage: { input_tokens: 1, output_tokens: 1 } });
const call = (id, name) => response([{ type: 'tool_use', id, name, input: name === 'skill' ? { name: 'fixture' } : {} }], 'tool_use');
const hold = () => new Promise(() => { setInterval(() => {}, 1000); });

async function worker(root, scenario, mode, id) {
  const config = defaultConfig(root, []);
  config.model = 'fixture';
  config.skills = [{ name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: 'LAYER_INSTRUCTIONS', allowedTools: ['fixture_effect'], userInvocable: true, disableModelInvocation: false }];
  config.permissions = { mode: 'default', allow: ['skill'], deny: scenario === 'deny' ? ['fixture_effect'] : [], ask: scenario === 'ask' ? ['fixture_effect'] : [] };
  let calls = 0, prompts = 0, layeredProbe = false;
  const effect = { schema: { name: 'fixture_effect', description: 'Fixture effect', input_schema: { type: 'object', properties: {} } }, readOnly: false, execute: async () => {
    fs.appendFileSync(path.join(root, 'effect'), 'effect\n');
    if (mode === 'writer' && scenario === 'effect') { process.stdout.write('READY effect\n'); await hold(); }
    return 'EFFECT_DONE';
  } };
  const provider = { count: async () => 0, complete: async () => {
    if (mode === 'writer') {
      if (++calls === 1) return call('skill-call', 'skill');
      if (['provider', 'deny', 'torn'].includes(scenario)) { process.stdout.write('READY provider\n'); await hold(); }
      return call('old-effect', 'fixture_effect');
    }
    calls++;
    if (layeredProbe) return calls === 1 ? call('probe-skill', 'skill') : calls === 2 ? call('probe-effect', 'fixture_effect') : response([{ type: 'text', text: 'done' }]);
    return calls === 1 ? call('fresh-effect', 'fixture_effect') : response([{ type: 'text', text: 'done' }]);
  } };
  const session = mode === 'writer' ? Session.open(root, { config }) : Session.open(root, { id, recoverLock: true });
  const runtime = await createRuntime(session.config, provider, new AbortController().signal);
  try {
    await runtime.bindSession(session);
    const tool = runtime.buildTools(session.config, session.id).find(item => item.schema.name === 'skill');
    assert.ok(tool);
    session.config.tools = [tool, effect].map(item => ({ ...item.schema, eager_input_streaming: true }));
    if (mode === 'writer') process.stdout.write(`ID ${session.id}\n`);
    const agent = new Agent(session, provider, [tool, effect], { permission: async () => {
      prompts++;
      if (mode === 'writer' && scenario === 'ask') { process.stdout.write('READY ask\n'); await hold(); }
      return false;
    } });
    await agent.run(mode === 'writer' ? 'invoke' : session.awaitingResponse ? undefined : 'fresh turn');
    if (mode !== 'writer') {
      const result = session.messages.flatMap(message => Array.isArray(message.content) ? message.content : []).find(block => block.type === 'tool_result' && block.tool_use_id === 'fresh-effect');
      assert.ok(result?.is_error, 'fresh effect must be denied');
      if (scenario === 'ask') assert.ok(session.config.permissions.ask.includes('fixture_effect'));
      if (scenario === 'deny') assert.ok(session.config.permissions.deny.includes('fixture_effect'));
      assert.equal(prompts, 0);
      if (scenario === 'ask' || scenario === 'deny') {
        layeredProbe = true; calls = 0;
        await agent.run('probe explicit policy');
        const probe = session.messages.flatMap(message => Array.isArray(message.content) ? message.content : []).find(block => block.type === 'tool_result' && block.tool_use_id === 'probe-effect');
        assert.ok(probe?.is_error);
        assert.equal(prompts, scenario === 'ask' ? 1 : 0);
      }
      process.stdout.write('RECOVERED\n');
    }
  } finally { await runtime.close(); session.close(); }
}

async function inlineWorker(root, stage, mode, id) {
  const config = defaultConfig(root, []);
  config.model = 'fixture';
  config.allowShell = true;
  config.features = { tasks: true, subagents: true, ...config.features, skillInlineCommands: true };
  const command = stage === 'side-effect' ? 'printf x >> effect; if [ ! -f shell-pid ]; then printf %s $$ > shell-pid; while :; do sleep 1; done; fi; printf DONE' : 'printf x >> effect; printf DONE';
  config.skills = [
    { name: 'layer', path: '/layer/SKILL.md', description: 'Layer', body: 'LAYER', allowedTools: ['fixture_effect'], userInvocable: true, disableModelInvocation: false },
    { name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: `!\`${command}\``, allowedTools: ['Bash', 'fixture_effect'], userInvocable: true, disableModelInvocation: false },
  ];
  config.permissions = { mode: 'default', allow: ['skill', 'Bash'], deny: [], ask: [] };
  const effect = { schema: { name: 'fixture_effect', description: 'Fixture', input_schema: { type: 'object', properties: {} } }, readOnly: false, execute: async () => { fs.appendFileSync(path.join(root, mode === 'writer' ? 'layer-proof' : 'leaked'), 'x'); return 'EFFECT'; } };
  let calls = 0;
  const provider = { count: async () => 0, complete: async () => {
    calls++;
    if (mode !== 'writer') {
      if (mode === 'warning' && process.env.SKILL_AUTO_RETRY_PROBE === '1' && calls === 2) return call('unconfirmed-retry', 'skill');
      return calls === 1 ? call(mode === 'reader' ? 'fresh-effect' : `${mode}-skill`, mode === 'reader' ? 'fixture_effect' : 'skill') : response([{ type: 'text', text: 'done' }]);
    }
    if (calls === 1) return response([{ type: 'tool_use', id: 'layer-call', name: 'skill', input: { name: 'layer' } }], 'tool_use');
    if (calls === 2) return call('layer-proof', 'fixture_effect');
    return calls === 3 ? call('skill-call', 'skill') : response([{ type: 'text', text: 'done' }]);
  } };
  const session = mode === 'writer' ? Session.open(root, { config }) : Session.open(root, { id, recoverLock: true });
  const runtime = await createRuntime(session.config, provider, new AbortController().signal);
  try {
    await runtime.bindSession(session);
    const tool = runtime.buildTools(session.config, session.id).find(item => item.schema.name === 'skill');
    assert.ok(tool);
    session.config.tools = [tool, effect].map(item => ({ ...item.schema, eager_input_streaming: true }));
    if (mode === 'writer') {
      fs.writeFileSync(path.join(root, 'identity'), session.id);
      const write = fs.writeSync, sync = fs.fsyncSync;
      let phase;
      const barrier = () => { fs.writeFileSync(path.join(root, 'barrier'), stage); process.kill(process.pid, 'SIGSTOP'); };
      fs.writeSync = function(fd, data, ...args) {
        let row;
        try { row = JSON.parse(data.toString()); } catch {}
        if (row?.phase === 'started' || row?.phase === 'finished') phase = row.phase;
        if (row?.kind === 'tool_result' && row.result?.tool_use_id === 'skill-call') {
          phase = 'result';
          if (stage === 'result-short') { const n = Math.floor(data.length / 2); write.call(fs, fd, data, 0, n); barrier(); return n; }
        }
        const n = write.call(fs, fd, data, ...args);
        if (stage === 'result-write' && phase === 'result') barrier();
        return n;
      };
      fs.fsyncSync = function(fd) {
        const result = sync.call(fs, fd);
        if (stage === `${phase}-sync`) barrier();
        phase = undefined;
        return result;
      };
    }
    let unknownFd, unknownSynced = false;
    if (mode === 'warning') {
      const write = fs.writeSync, sync = fs.fsyncSync;
      fs.writeSync = function(fd, data, ...args) {
        try { if (JSON.parse(data.toString()).phase === 'unknown') unknownFd = fd; } catch {}
        return write.call(fs, fd, data, ...args);
      };
      fs.fsyncSync = function(fd) { const result = sync.call(fs, fd); if (fd === unknownFd) unknownSynced = true; return result; };
    }
    await new Agent(session, provider, [tool, effect]).run(mode === 'writer' ? 'invoke' : session.awaitingResponse ? undefined : 'fresh turn');
    if (mode === 'reader') {
      const result = session.messages.flatMap(message => Array.isArray(message.content) ? message.content : []).find(block => block.type === 'tool_result' && block.tool_use_id === 'fresh-effect');
      assert.ok(result?.is_error);
      const journal = new SkillEffectJournal(root, session.id);
      process.stdout.write(JSON.stringify({ pending: journal.unresolved('fixture').length }));
    } else if (mode === 'warning' || mode === 'retry') {
      const result = session.messages.flatMap(message => Array.isArray(message.content) ? message.content : []).find(block => block.type === 'tool_result' && block.tool_use_id === `${mode}-skill`);
      assert.ok(result);
      if (mode === 'warning') { assert.match(JSON.stringify(result), /effect is unknown/); assert.ok(unknownSynced, 'unknown record must be fsynced'); }
      else assert.match(JSON.stringify(result), /effect is unknown/);
      process.stdout.write(JSON.stringify({ result }));
    } else throw new Error(`missed ${stage}`);
  } finally { await runtime.close(); session.close(); }
}

async function inlineParent() {
  for (const stage of ['started-sync', 'side-effect', 'finished-sync', 'result-write', 'result-short', 'result-sync']) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'skill-layer-inline-')));
    let child;
    try {
      child = spawn(process.execPath, [script, 'inline-writer', root, stage], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let errors = ''; child.stderr.on('data', data => { errors += data; });
      const exit = once(child, 'exit');
      const deadline = Date.now() + 15000;
      const barrier = path.join(root, stage === 'side-effect' ? 'shell-pid' : 'barrier');
      while (!fs.existsSync(barrier) || (stage === 'side-effect' && !fs.readFileSync(barrier, 'utf8'))) { assert.ok(Date.now() < deadline && child.exitCode === null && child.signalCode === null, `${stage}: ${errors}`); await new Promise(resolve => setTimeout(resolve, 10)); }
      const shellPid = stage === 'side-effect' ? Number(fs.readFileSync(barrier, 'utf8')) : undefined;
      process.kill(-child.pid, 'SIGKILL'); assert.equal((await exit)[1], 'SIGKILL');
      const id = fs.readFileSync(path.join(root, 'identity'), 'utf8');
      assert.equal(fs.readFileSync(path.join(root, 'layer-proof'), 'utf8'), 'x');
      const sessionFile = path.join(root, '.agent', `${id}.jsonl`);
      const original = fs.readFileSync(sessionFile);
      const effectFile = path.join(root, '.agent', 'skill-effects', `${id}.jsonl`);
      const effects = fs.readFileSync(effectFile, 'utf8').trim().split('\n').map(JSON.parse);
      assert.deepEqual(effects.map(row => row.phase), ['started-sync', 'side-effect'].includes(stage) ? ['started'] : ['started', 'finished']);
      assert.equal(fs.existsSync(path.join(root, 'effect')) ? fs.readFileSync(path.join(root, 'effect'), 'utf8') : '', stage === 'started-sync' ? '' : 'x');
      for (let i = 0; i < 2; i++) {
        const reader = spawn(process.execPath, [script, 'inline-reader', root, stage, id], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '', err = ''; reader.stdout.on('data', data => { out += data; }); reader.stderr.on('data', data => { err += data; });
        assert.equal((await once(reader, 'close'))[0], 0, `${stage}: ${err}`);
        assert.equal(JSON.parse(out).pending, ['started-sync', 'side-effect'].includes(stage) ? 1 : 0);
        assert.equal(fs.existsSync(path.join(root, 'leaked')), false);
        assert.equal(fs.existsSync(`${sessionFile}.lock`), false);
        assert.equal(fs.readdirSync(path.dirname(effectFile)).some(name => name.endsWith('.lease')), false);
        if (stage === 'result-short') {
          const evidence = fs.readdirSync(path.dirname(sessionFile)).filter(name => name.startsWith(`${id}.jsonl.torn-`));
          assert.ok(evidence.some(name => fs.readFileSync(path.join(path.dirname(sessionFile), name)).equals(original)));
        } else assert.ok(fs.readFileSync(sessionFile).subarray(0, original.length).equals(original));
      }
      if (stage === 'side-effect') {
        assert.deepEqual(new SkillEffectJournal(root, 'another-owner').unresolved('fixture'), []);
        for (const mode of ['warning', 'retry']) {
          const reader = spawn(process.execPath, [script, `inline-${mode}`, root, stage, id], { stdio: ['ignore', 'pipe', 'pipe'] });
          let out = '', err = ''; reader.stdout.on('data', data => { out += data; }); reader.stderr.on('data', data => { err += data; });
          assert.equal((await once(reader, 'close'))[0], 0, `${mode}: ${err}`);
          JSON.parse(out);
          assert.equal(fs.readFileSync(path.join(root, 'effect'), 'utf8'), 'x');
          const rows = fs.readFileSync(effectFile, 'utf8').trim().split('\n').map(JSON.parse);
          assert.deepEqual(rows.map(row => row.phase), ['started', 'unknown']);
          assert.equal(rows[0].id, rows[1].id);
          assert.equal(fs.existsSync(`${sessionFile}.lock`), false);
          assert.equal(fs.readdirSync(path.dirname(effectFile)).some(name => name.endsWith('.lease')), false);
        }
      }
      if (shellPid) { let alive = true; try { process.kill(shellPid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; } assert.equal(alive, false, 'shell PID must exit'); }
      process.stdout.write(`inline ${stage}: passed\n`);
    } finally { if (child && child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} } fs.rmSync(root, { recursive: true, force: true }); }
  }
}

async function parent() {
  for (const scenario of ['provider', 'ask', 'deny', 'effect', 'torn']) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'skill-layer-crash-')));
    let child;
    try {
      child = spawn(process.execPath, [script, 'writer', root, scenario], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '', errors = '';
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', chunk => { errors += chunk; });
      const deadline = Date.now() + 15000;
      while (!output.includes('READY ') && child.exitCode === null && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      assert.match(output, /READY /, errors);
      const id = /ID ([a-f0-9-]+)/.exec(output)?.[1]; assert.ok(id);
      const file = path.join(root, '.agent', `${id}.jsonl`);
      const before = fs.readFileSync(file);
      child.kill('SIGKILL');
      const [code, signal] = await once(child, 'close');
      assert.equal(code, null); assert.equal(signal, 'SIGKILL');
      if (scenario === 'torn') fs.appendFileSync(file, '{"kind":"message"');
      const torn = scenario === 'torn' ? fs.readFileSync(file) : undefined;
      for (let i = 0; i < 2; i++) {
        const reader = spawn(process.execPath, [script, 'reader', root, scenario, id], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '', err = ''; reader.stdout.on('data', chunk => { out += chunk; }); reader.stderr.on('data', chunk => { err += chunk; });
        const [readerCode] = await once(reader, 'close'); assert.equal(readerCode, 0, err); assert.match(out, /RECOVERED/);
        assert.ok(fs.readFileSync(file).subarray(0, before.length).equals(before));
        if (torn) {
          const evidence = fs.readdirSync(path.dirname(file)).filter(name => name.startsWith(`${id}.jsonl.torn-`));
          assert.equal(evidence.length, 1);
          assert.ok(fs.readFileSync(path.join(path.dirname(file), evidence[0])).equals(torn));
        }
        assert.equal(fs.existsSync(path.join(root, 'effect')) ? fs.readFileSync(path.join(root, 'effect'), 'utf8') : '', scenario === 'effect' ? 'effect\n' : '');
      }
      process.stdout.write(`${scenario}: SIGKILL and two cold Agent readers passed\n`);
    } finally { if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); fs.rmSync(root, { recursive: true, force: true }); }
  }
}

if (process.argv[2] === 'inline') await inlineParent();
else if (process.argv[2]?.startsWith('inline-')) await inlineWorker(process.argv[3], process.argv[4], process.argv[2].slice(7), process.argv[5]);
else if (process.argv[2]) await worker(process.argv[3], process.argv[4], process.argv[2], process.argv[5]);
else await parent();
