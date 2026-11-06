import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { SkillEffectJournal } from '../src/skill-effects.js';

const workspaces: string[] = [];
function workspace(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccrev-skill-effects-')));
  workspaces.push(root);
  return root;
}
after(() => { for (const root of workspaces) fs.rmSync(root, { recursive: true, force: true }); });

function lines(journal: SkillEffectJournal): Record<string, unknown>[] {
  return fs.readFileSync(journal.file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);
}

test('a start and its terminal record close the effect without storing the command', () => {
  const journal = new SkillEffectJournal(workspace(), 'session-1');
  const command = 'printf secret-argument';
  const effect = journal.start('fixture', 0, command);
  journal.finish(effect, 'finished');
  assert.deepEqual(journal.unresolved('fixture'), []);
  const stored = lines(journal);
  assert.deepEqual(stored.map(record => record.phase), ['started', 'finished']);
  assert.equal(stored[0]!.digest, createHash('sha256').update(command, 'utf8').digest('hex'));
  assert.equal(fs.readFileSync(journal.file, 'utf8').includes('secret-argument'), false);
  assert.deepEqual([stored[0]!.skill, stored[0]!.index], ['fixture', 0]);
});

test('warning delivery preserves unknown effects and does not authorize retries', () => {
  const journal = new SkillEffectJournal(workspace(), 'session-2');
  const first = journal.start('fixture', 1, 'first');
  const other = journal.start('other', 0, 'other');
  const crashed = fs.readFileSync(journal.file);
  journal.finish(first, 'finished');
  journal.finish(other, 'finished');
  fs.writeFileSync(journal.file, crashed);
  assert.deepEqual(journal.unresolved('fixture').map(record => [record.id, record.index]), [[first.id, 1]]);
  assert.equal(journal.unresolved('other').length, 1, 'records are per skill');
  journal.acknowledge(journal.unresolved('fixture'));
  assert.deepEqual(journal.unresolved('fixture').map(record => record.id), [first.id]);
  assert.equal(lines(journal).at(-1)!.phase, 'unknown');
  journal.acknowledge(journal.unresolved('fixture'));
  assert.equal(lines(journal).filter(record => record.phase === 'unknown').length, 1);
  assert.throws(() => journal.start('fixture', 1, 'first'), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /effect is unknown/);
    assert.ok(error.message.includes(`owner session-2, effect ${first.id}`));
    assert.ok(error.message.includes(`sha256 ${first.digest}`));
    return true;
  });
  const firstBatch = journal.start('batch', 0, 'one');
  const secondBatch = journal.start('batch', 1, 'two');
  journal.abandon(firstBatch); journal.abandon(secondBatch);
  journal.acknowledge(journal.unresolved('batch'));
  assert.equal(journal.unresolved('batch').length, 2);
  const batch = lines(journal).at(-1)!;
  assert.equal(batch.phase, 'unknown_batch');
  assert.equal(Array.isArray(batch.records) && batch.records.length, 2);
});

test('processed decisions bind one complete start and never authorize execution', () => {
  const root = workspace();
  const journal = new SkillEffectJournal(root, 'decision-owner');
  const effect = journal.start('fixture', 0, 'one');
  journal.abandon(effect);
  journal.acknowledge(journal.unresolved('fixture'));
  journal.confirmProcessed(effect.id);
  journal.confirmProcessed(effect.id);
  for (let i = 0; i < 2; i++) {
    const cold = new SkillEffectJournal(root, 'decision-owner');
    cold.confirmProcessed(effect.id);
    assert.throws(() => cold.start('fixture', 0, 'two'), /effect is unknown/);
  }
  assert.throws(() => new SkillEffectJournal(root, 'another-owner').confirmProcessed(effect.id), /Unknown or ambiguous/);
  const content = fs.readFileSync(journal.file, 'utf8');
  fs.writeFileSync(journal.file, content.replace('"skill":"fixture"', '"skill":"changed"'));
  assert.throws(() => journal.confirmProcessed(effect.id), /evidence mismatch/);
});

test('retry decision consumes only the exact unresolved command and remains blocked', () => {
  const root = workspace();
  const journal = new SkillEffectJournal(root, 'retry-owner');
  const effect = journal.start('fixture', 0, 'printf x');
  journal.abandon(effect);
  journal.confirmRetry(effect.id);
  journal.confirmRetry(effect.id);
  assert.equal(journal.consumeRetry(effect.id, 'fixture', 0, 'printf y'), false);
  assert.equal(journal.consumeRetry(effect.id, 'other', 0, 'printf x'), false);
  const other = journal.start('other', 0, 'other');
  journal.abandon(other);
  assert.equal(journal.consumeRetry(effect.id, 'fixture', 0, 'printf x'), false);
  const secondRoot = workspace();
  const single = new SkillEffectJournal(secondRoot, 'retry-owner');
  const singleEffect = single.start('fixture', 0, 'printf x');
  single.abandon(singleEffect);
  single.confirmRetry(singleEffect.id);
  assert.equal(single.consumeRetry(singleEffect.id, 'fixture', 0, 'printf x'), true);
  assert.throws(() => single.consumeRetry(singleEffect.id, 'fixture', 0, 'printf x'), /EEXIST/);
  for (let i = 0; i < 2; i++) {
    const cold = new SkillEffectJournal(secondRoot, 'retry-owner');
    assert.throws(() => cold.start('fixture', 0, 'printf x'), /effect is unknown/);
  }
  assert.throws(() => new SkillEffectJournal(secondRoot, 'other-owner').confirmRetry(singleEffect.id), /Unknown or ambiguous/);
});

test('a consumed retry starts exactly one matching new effect and retains the original unknown', () => {
  const root = workspace(), journal = new SkillEffectJournal(root, 'retry-lifecycle');
  const old = journal.start('fixture', 0, 'printf x'); journal.abandon(old);
  journal.confirmRetry(old.id);
  const grant = journal.consumeRetryGrant(old.id, 'fixture', 0, 'printf x');
  assert.ok(grant);
  const current = journal.start('fixture', 0, 'printf x', journal.invocation('fixture').generation, grant);
  assert.notEqual(current.id, old.id); assert.equal(current.digest, old.digest);
  journal.finish(current, 'finished');
  assert.throws(() => journal.start('fixture', 0, 'printf x', undefined, grant), /Invalid skill effect retry grant/);
  assert.deepEqual(journal.unresolved('fixture').map(record => record.id), [old.id]);
  assert.throws(() => journal.consumeRetryGrant(old.id, 'fixture', 0, 'printf x'), /EEXIST/);
  const crashJournal = new SkillEffectJournal(workspace(), 'retry-crash');
  const crashedOld = crashJournal.start('fixture', 0, 'once'); crashJournal.abandon(crashedOld);
  crashJournal.confirmRetry(crashedOld.id);
  const crashGrant = crashJournal.consumeRetryGrant(crashedOld.id, 'fixture', 0, 'once');
  assert.ok(crashGrant);
  const crashedNew = crashJournal.start('fixture', 0, 'once', undefined, crashGrant); crashJournal.abandon(crashedNew);
  assert.deepEqual(crashJournal.unresolved('fixture').map(record => record.id), [crashedOld.id, crashedNew.id]);
  assert.equal(crashJournal.consumeRetryGrant(crashedNew.id, 'fixture', 0, 'once'), undefined);
  assert.throws(() => crashJournal.start('fixture', 0, 'once'), /effect is unknown/);
  const tampered = new SkillEffectJournal(workspace(), 'retry-tampered');
  const tamperedOld = tampered.start('fixture', 0, 'once'); tampered.abandon(tamperedOld);
  tampered.confirmRetry(tamperedOld.id);
  const tamperedGrant = tampered.consumeRetryGrant(tamperedOld.id, 'fixture', 0, 'once');
  assert.ok(tamperedGrant);
  fs.writeFileSync(`${tampered.file}.${tamperedOld.id}.decision-receipt`, '{}');
  assert.throws(() => tampered.start('fixture', 0, 'once', undefined, tamperedGrant), /evidence mismatch/);
  assert.throws(() => tampered.start('fixture', 0, 'once', undefined, tamperedGrant), /Invalid skill effect retry grant/);
});

test('consumption failures and writer death keep both cold readers fenced', () => {
  const moduleUrl = pathToFileURL(path.resolve('src/skill-effects.ts')).href;
  for (const fault of ['short', 'fsync', 'kill-before-write', 'kill-after-write', 'kill-after-fsync'] as const) {
    const root = workspace(), owner = `consume-${fault}`;
    const journal = new SkillEffectJournal(root, owner);
    const effect = journal.start('fixture', 0, 'once'); journal.abandon(effect); journal.confirmRetry(effect.id);
    const writer = `import fs from 'node:fs'; import { SkillEffectJournal } from ${JSON.stringify(moduleUrl)};
      const open=fs.openSync, write=fs.writeSync, sync=fs.fsyncSync; let target=-1;
      fs.openSync=(...args)=>{const fd=open(...args); if(String(args[0]).endsWith('.retry-consumed')) target=fd; return fd};
      fs.writeSync=(fd,...args)=>{if(fd===target){if(process.argv[3]==='kill-before-write') process.kill(process.pid,'SIGKILL'); if(process.argv[3]==='short') return 0; const n=write(fd,...args); if(process.argv[3]==='kill-after-write') process.kill(process.pid,'SIGKILL'); return n} return write(fd,...args)};
      fs.fsyncSync=fd=>{if(fd===target && process.argv[3]==='fsync') throw Error('injected fsync'); const r=sync(fd); if(fd===target && process.argv[3]==='kill-after-fsync') process.kill(process.pid,'SIGKILL'); return r};
      try { new SkillEffectJournal(process.argv[1], ${JSON.stringify(owner)}).consumeRetryGrant(process.argv[2], 'fixture', 0, 'once'); process.exit(2) } catch { process.exit(0) }`;
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, effect.id, fault], { encoding: 'utf8' });
    if (fault.startsWith('kill')) assert.equal(result.signal, 'SIGKILL', result.stderr); else assert.equal(result.status, 0, result.stderr);
    const reader = `import assert from 'node:assert/strict'; import { SkillEffectJournal } from ${JSON.stringify(moduleUrl)};
      const j=new SkillEffectJournal(process.argv[1],${JSON.stringify(owner)}); assert.throws(()=>j.start('fixture',0,'once'),/effect is unknown/); assert.throws(()=>j.consumeRetryGrant(process.argv[2],'fixture',0,'once'),/EEXIST/);`;
    for (let i = 0; i < 2; i++) {
      const cold = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, effect.id], { encoding: 'utf8' });
      assert.equal(cold.status, 0, cold.stderr);
    }
  }
});

test('a killed decision writer leaves incomplete evidence and the effect blocked across cold opens', async () => {
  const root = workspace();
  const journal = new SkillEffectJournal(root, 'kill-owner');
  const effect = journal.start('fixture', 0, 'one');
  journal.abandon(effect);
  const moduleUrl = pathToFileURL(path.resolve('src/skill-effects.ts')).href;
  const script = `import fs from 'node:fs'; import { SkillEffectJournal } from ${JSON.stringify(moduleUrl)};
    const rename = fs.renameSync; fs.renameSync = (...args) => { rename(...args); if (String(args[1]).endsWith('.decision')) process.kill(process.pid, 'SIGKILL'); };
    new SkillEffectJournal(process.argv[1], 'kill-owner').confirmProcessed(process.argv[2]);`;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, root, effect.id], { stdio: 'ignore' });
  const [code, signal] = await once(child, 'exit');
  assert.equal(code, null); assert.equal(signal, 'SIGKILL');
  const reader = `import assert from 'node:assert/strict'; import { SkillEffectJournal } from ${JSON.stringify(moduleUrl)};
    const cold = new SkillEffectJournal(process.argv[1], 'kill-owner');
    assert.throws(() => cold.confirmProcessed(process.argv[2]));
    assert.throws(() => cold.start('fixture', 0, 'repeat'), /effect is unknown/);`;
  for (let i = 0; i < 2; i++) {
    const cold = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, effect.id], { encoding: 'utf8' });
    assert.equal(cold.status, 0, cold.stderr);
  }
});

test('decision publication faults preserve the execution barrier', () => {
  for (const fault of ['write', 'short', 'fsync', 'rename', 'directory'] as const) {
    const root = workspace(), journal = new SkillEffectJournal(root, `fault-${fault}`);
    const effect = journal.start('fixture', 0, 'once'); journal.abandon(effect);
    const write = fs.writeFileSync, sync = fs.fsyncSync, rename = fs.renameSync;
    try {
      if (fault === 'write') fs.writeFileSync = (() => { throw new Error('injected write failure'); }) as typeof fs.writeFileSync;
      if (fault === 'short') fs.writeFileSync = ((fd: number, data: string) => write(fd, data.slice(0, Math.floor(data.length / 2)))) as typeof fs.writeFileSync;
      if (fault === 'fsync') fs.fsyncSync = () => { throw new Error('injected fsync failure'); };
      if (fault === 'rename') fs.renameSync = () => { throw new Error('injected rename failure'); };
      if (fault === 'directory') fs.fsyncSync = fd => { if (fs.fstatSync(fd).isDirectory()) throw new Error('injected directory failure'); return sync(fd); };
      assert.throws(() => journal.confirmProcessed(effect.id), fault === 'short' ? /expected/ : /injected/);
    } finally { fs.writeFileSync = write; fs.fsyncSync = sync; fs.renameSync = rename; }
    for (let i = 0; i < 2; i++) assert.throws(() => new SkillEffectJournal(root, `fault-${fault}`).start('fixture', 0, 'repeat'), /effect is unknown/);
  }
});

test('a torn trailing append and a malformed complete line fail closed', () => {
  const root = workspace();
  const journal = new SkillEffectJournal(root, 'session-3');
  const effect = journal.start('fixture', 0, 'printf a');
  // Simulate a crash in the middle of the next append.
  const complete = fs.readFileSync(journal.file);
  journal.finish(effect, 'finished');
  fs.writeFileSync(journal.file, complete);
  fs.appendFileSync(journal.file, '{"v":1,"id":"torn');
  assert.throws(() => journal.unresolved('fixture'), /incomplete trailing line/);
  const torn = fs.readFileSync(journal.file);
  assert.throws(() => journal.start('fixture', 1, 'another'), /incomplete trailing line/);
  assert.deepEqual(fs.readFileSync(journal.file), torn);
  // A complete but malformed line is corruption, not a torn append.
  fs.writeFileSync(journal.file, complete); fs.appendFileSync(journal.file, 'not json\n');
  assert.throws(() => journal.unresolved('fixture'), /unreadable: line 2 is not JSON/);
});

test('failed warning writes never release an unknown effect', () => {
  for (const fault of ['short', 'fsync'] as const) {
    const root = workspace();
    const journal = new SkillEffectJournal(root, `warning-${fault}`);
    const effect = journal.start('fixture', 0, 'effect');
    journal.abandon(effect);
    const pending = journal.unresolved('fixture');
    const original = fs.readFileSync(journal.file);
    const write = fs.writeSync;
    const sync = fs.fsyncSync;
    try {
      if (fault === 'short') fs.writeSync = ((fd: number, data: string) => write(fd, data.slice(0, Math.floor(data.length / 2)))) as typeof fs.writeSync;
      else fs.fsyncSync = () => { throw new Error('injected fsync failure'); };
      assert.throws(() => journal.acknowledge(pending), fault === 'short' ? /short write/ : /injected fsync failure/);
    } finally { fs.writeSync = write; fs.fsyncSync = sync; }
    assert.ok(fs.readFileSync(journal.file).subarray(0, original.length).equals(original));
    const cold = new SkillEffectJournal(root, `warning-${fault}`);
    if (fault === 'short') assert.throws(() => cold.start('fixture', 0, 'repeat'), /incomplete trailing line/);
    else assert.throws(() => cold.start('fixture', 0, 'repeat'), /effect is unknown/);
  }
});

test('journal instances sharing an owner do not report a live effect', () => {
  const root = workspace();
  const first = new SkillEffectJournal(root, 'initial');
  const second = new SkillEffectJournal(root, 'initial');
  const effect = first.start('fixture', 0, 'sleep');
  assert.deepEqual(second.unresolved('fixture'), []);
  first.finish(effect, 'finished');
  assert.deepEqual(second.unresolved('fixture'), []);
});

test('finish releases its lease when the journal mutex cannot be opened', () => {
  const journal = new SkillEffectJournal(workspace(), 'failure');
  const effect = journal.start('fixture', 0, 'command');
  const mutex = `${journal.file}.lock`;
  fs.renameSync(mutex, `${mutex}.saved`);
  fs.mkdirSync(mutex);
  assert.throws(() => journal.finish(effect, 'finished'));
  fs.rmdirSync(mutex);
  fs.renameSync(`${mutex}.saved`, mutex);
  assert.deepEqual(journal.unresolved('fixture').map(item => item.id), [effect.id]);
  journal.acknowledge(journal.unresolved('fixture'));
  assert.equal(fs.readdirSync(journal.directory).some(name => name.endsWith('.lease')), false);
});

test('completed effects do not leave per-effect lease files', () => {
  const journal = new SkillEffectJournal(workspace(), 'cleanup');
  const effect = journal.start('fixture', 0, 'command');
  journal.finish(effect, 'finished');
  assert.equal(fs.readdirSync(journal.directory).some(name => name.endsWith('.lease')), false);
});

test('a live sibling keeps its lease after another effect fails and the caller returns', async () => {
  const root = workspace();
  const journal = new SkillEffectJournal(root, 'siblings');
  const failed = journal.start('fixture', 0, 'failed command');
  const sibling = journal.start('fixture', 1, 'running command');
  journal.finish(failed, 'failed');

  const moduleUrl = pathToFileURL(path.resolve('dist/skill-effects.js')).href;
  const probe = `import { SkillEffectJournal } from ${JSON.stringify(moduleUrl)};
    const journal = new SkillEffectJournal(process.argv[1], 'siblings');
    process.stdout.write(JSON.stringify(journal.unresolved('fixture')));`;
  const inspect = async () => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', probe, root], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => { output += chunk; });
    const [code] = await once(child, 'close');
    assert.equal(code, 0);
    return JSON.parse(output) as unknown;
  };

  try {
    assert.deepEqual(await inspect(), []);
    assert.deepEqual(lines(journal).map(record => [record.index, record.phase]), [[0, 'started'], [1, 'started'], [0, 'failed']]);
    assert.equal(fs.readdirSync(journal.directory).filter(name => name.endsWith('.lease')).length, 1);
  } finally {
    journal.finish(sibling, 'finished');
  }
  assert.deepEqual(await inspect(), []);
  assert.deepEqual(lines(journal).map(record => [record.index, record.phase]), [[0, 'started'], [1, 'started'], [0, 'failed'], [1, 'finished']]);
  assert.equal(fs.readdirSync(journal.directory).filter(name => name.endsWith('.lease')).length, 0);
});

test('separate processes hold leases, serialize appends, and recover after SIGKILL', async () => {
  const root = workspace();
  const moduleUrl = pathToFileURL(path.resolve('dist/skill-effects.js')).href;
  const worker = `import { SkillEffectJournal } from ${JSON.stringify(moduleUrl)};
    const j = new SkillEffectJournal(process.argv[1], 'initial');
    const e = j.start('fixture', 0, 'command');
    process.stdout.write(e.id + '\\n');
    if (process.argv[2] === 'hold') setInterval(() => {}, 1000);
    else j.finish(e, 'finished');`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', worker, root, 'hold'], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const [chunk] = await once(child.stdout, 'data');
    const id = String(chunk).trim();
    const journal = new SkillEffectJournal(root, 'initial');
    assert.deepEqual(journal.unresolved('fixture'), []);
    const workers = Array.from({ length: 12 }, () => spawn(process.execPath, ['--input-type=module', '-e', worker, root, 'finish'], { stdio: 'ignore' }));
    const statuses = await Promise.all(workers.map(async process => (await once(process, 'exit'))[0]));
    assert.deepEqual(statuses, Array(12).fill(0));
    assert.equal(lines(journal).length, 25);
    assert.deepEqual(journal.unresolved('fixture'), []);
    assert.equal(fs.readdirSync(journal.directory).filter(name => name.endsWith('.lease')).length, 1);
    child.kill('SIGKILL');
    await once(child, 'exit');
    assert.deepEqual(journal.unresolved('fixture').map(item => item.id), [id]);
    assert.throws(() => journal.start('fixture', 0, 'retry'), /effect is unknown/);
    assert.equal(fs.readdirSync(journal.directory).some(name => name.endsWith('.lease')), false);
    journal.acknowledge(journal.unresolved('fixture'));
    assert.deepEqual(journal.unresolved('fixture').map(item => item.id), [id]);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
});

test('a pre-existing cross-process invocation stays blocked after notification commit', async () => {
  const root = workspace();
  const moduleUrl = pathToFileURL(path.resolve('dist/skill-effects.js')).href;
  const worker = `import { SkillEffectJournal } from ${JSON.stringify(moduleUrl)};
    const j = new SkillEffectJournal(process.argv[1], 'generation');
    const snapshot = j.invocation('fixture');
    process.stdout.write('ready\\n');
    process.stdin.once('data', () => {
      try { const effect = j.start('fixture', 0, 'late', snapshot.generation); j.finish(effect, 'finished'); process.stdout.write('executed\\n'); }
      catch (error) { process.stdout.write(error.message + '\\n'); }
    });`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', worker, root], { stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = once(child, 'close');
  try {
    assert.match(String((await once(child.stdout, 'data'))[0]), /ready/);
    const journal = new SkillEffectJournal(root, 'generation');
    const interrupted = journal.start('fixture', 0, 'interrupted'); journal.abandon(interrupted);
    assert.throws(() => journal.start('fixture', 0, 'before delivery'), /effect is unknown/);
    journal.acknowledge(journal.unresolved('fixture'));
    child.stdin.end('continue');
    assert.match(String((await once(child.stdout, 'data'))[0]), /effect is unknown/);
    assert.equal((await closed)[0], 0);
    assert.deepEqual(lines(journal).map(record => record.phase), ['started', 'unknown']);
    assert.throws(() => journal.start('fixture', 0, 'retry', journal.invocation('fixture').generation), /effect is unknown/);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
});

test('process death after durable model warning and before journal commit replays the warning', async () => {
  const root = workspace();
  const dist = pathToFileURL(path.resolve('dist') + '/').href;
  const worker = `import { Agent, defaultConfig } from '${dist}agent.js';
    import { Session } from '${dist}session.js';
    import { SkillEffectJournal } from '${dist}skill-effects.js';
    import { executeSkill } from '${dist}skill-runtime.js';
    import { createSkillTool } from '${dist}runtime.js';
    const root = process.argv[1], journal = new SkillEffectJournal(root, 'crash');
    const interrupted = journal.start('fixture', 0, 'old'); journal.abandon(interrupted);
    const skill = { name:'fixture', path:'/fixture/SKILL.md', description:'fixture', body:'!\x60printf retried\x60', shell:'/bin/sh', userInvocable:true, disableModelInvocation:false };
    const config = defaultConfig(root, []); config.model='fixture'; config.skills=[skill]; config.permissions={mode:'bypass',allow:[],deny:[]};
    const provider = { count:async()=>0, complete:async()=>({id:'fixture',type:'message',role:'assistant',model:'fixture',content:[{type:'tool_use',id:'call',name:'skill',input:{name:'fixture'}}],stop_reason:'tool_use',usage:{input_tokens:1,output_tokens:1}}) };
    const tool = createSkillTool(config, (item,args,ctx)=>executeSkill(item,args,{config,provider,tools:[],signal:ctx.signal,source:'model',effectJournal:journal}));
    config.tools=[{...tool.schema,eager_input_streaming:true}];
    const session = Session.open(root,{config}); process.stdout.write(session.id+'\\n');
    journal.acknowledge=()=>process.kill(process.pid,'SIGKILL');
    await new Agent(session,provider,[tool]).run('invoke');`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', worker, root], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; let errors = '';
  child.stdout.on('data', chunk => { output += String(chunk); });
  child.stderr.on('data', chunk => { errors += String(chunk); });
  const [code, signal] = await once(child, 'close');
  assert.equal(code, null, errors); assert.equal(signal, 'SIGKILL', errors);
  const sessionId = output.trim(); assert.match(sessionId, /^[a-f0-9-]{36}$/);
  assert.match(fs.readFileSync(path.join(root, '.agent', `${sessionId}.jsonl`), 'utf8'), /effect is unknown/);
  const journal = new SkillEffectJournal(root, 'crash');
  assert.equal(journal.unresolved('fixture').length, 1);
  assert.throws(() => journal.start('fixture', 0, 'retry'), /effect is unknown/);
});

test('the owner must be a session id and the journal is bounded', () => {
  const root = workspace();
  assert.throws(() => new SkillEffectJournal(root, '../escape'), /owner must be a session id/);
  assert.throws(() => new SkillEffectJournal(root, ''), /owner must be a session id/);
  const journal = new SkillEffectJournal(root, 'session-4');
  fs.mkdirSync(journal.directory, { recursive: true });
  fs.writeFileSync(journal.file, 'x'.repeat(4 * 1024 * 1024 + 1));
  assert.throws(() => journal.unresolved('fixture'), /exceeds 4194304 bytes/);
  assert.throws(() => journal.start('fixture', 0, 'printf a'), /exceeds 4194304 bytes/);
});
