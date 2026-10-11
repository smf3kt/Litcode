import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Agent, defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';
import { forkSession } from '../src/sessions.js';
import { parseSettings } from '../src/runtime.js';
import { executeSkill } from '../src/skill-runtime.js';

function command(script: string): string {
  return `${JSON.stringify(process.execPath)} -e '${script.replaceAll("'", "'\\''")}'`;
}
const provider: ModelProvider = { count: async () => 1, complete: async () => { throw new Error('Fixture hook should not call a model'); } };

test('once claim is durable before execution, shared across Agent wrappers and preserved on resume', async t => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-hook-once-')));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const output = path.join(workspace, 'effects.txt');
  const once = command(`const fs=require("node:fs");let data="";process.stdin.on("data",x=>data+=x);process.stdin.on("end",()=>{const p=JSON.parse(data);const e=fs.readFileSync(p.transcript_path,"utf8").trim().split("\\n").map(JSON.parse);if(!e.some(x=>x.kind==="hook_once"&&x.event===p.hook_event_name))process.exit(9);fs.appendFileSync(${JSON.stringify(output)},"once\\n");process.stdout.write(JSON.stringify({additionalContext:"once context"}));});`);
  const repeated = command(`require("node:fs").appendFileSync(${JSON.stringify(output)},"repeat\\n");`);
  const config = { ...defaultConfig(workspace, []), model: 'fixture', hooks: {
    SessionStart: [{ matcher: 'startup|resume', hooks: [{ command: once, once: true }, { command: repeated }] }],
  } };
  const session = Session.open(workspace, { config });
  try {
    await new Agent(session, provider, []).startSession('startup');
    await new Agent(session, provider, []).startSession('resume');
    assert.equal(session.events.filter(event => event.kind === 'hook_once').length, 1);
    assert.equal(fs.readFileSync(output, 'utf8'), 'once\nrepeat\nrepeat\n');
  } finally { session.close(); }
  const resumed = Session.open(workspace, { id: session.id });
  try {
    await new Agent(resumed, provider, []).startSession('resume');
    assert.equal(resumed.events.filter(event => event.kind === 'hook_once').length, 1);
    assert.equal(fs.readFileSync(output, 'utf8'), 'once\nrepeat\nrepeat\nrepeat\n');
  } finally { resumed.close(); }
});

test('an interrupted once claim is skipped on resume, while a new fork owns a fresh lifecycle', async t => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-hook-recovery-')));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const output = path.join(workspace, 'effects.txt');
  const config = { ...defaultConfig(workspace, []), model: 'fixture', hooks: {
    SessionStart: [{ command: command(`require("node:fs").appendFileSync(${JSON.stringify(output)},"run\\n");`), once: true }],
  } };
  const session = Session.open(workspace, { config });
  try { await new Agent(session, provider, []).startSession('startup'); }
  finally { session.close(); }
  const events = fs.readFileSync(session.file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const claimIndex = events.findIndex(event => event.kind === 'hook_once');
  assert.ok(claimIndex >= 0);
  fs.writeFileSync(session.file, events.slice(0, claimIndex + 1).map(event => JSON.stringify(event)).join('\n') + '\n');
  const resumed = Session.open(workspace, { id: session.id });
  let fork: Session | undefined;
  try {
    await new Agent(resumed, provider, []).startSession('resume');
    assert.equal(fs.readFileSync(output, 'utf8'), 'run\n');
    fork = forkSession(resumed);
    await new Agent(fork, provider, []).startSession('fork');
    assert.equal(fs.readFileSync(output, 'utf8'), 'run\nrun\n');
    assert.equal(fork.events.filter(event => event.kind === 'hook_once').length, 1);
  } finally { fork?.close(); resumed.close(); }
});

test('settings drops unknown events while retaining grouped and legacy hook definitions', () => {
  const legacy = { command: 'true' };
  const group = { matcher: 'write_file', hooks: [{ command: 'true', once: true }] };
  const settings = parseSettings({ hooks: { PreToolUse: [legacy, group], InvalidEvent: [legacy] } });
  assert.deepEqual(settings.hooks, { PreToolUse: [legacy, group] });
});

test('grouped skill commands are approved before child journals or hook effects', async t => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-hook-skill-')));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const output = path.join(workspace, 'effects.txt');
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true };
  await assert.rejects(executeSkill({ name: 'grouped', path: '/fixture/SKILL.md', description: 'Fixture',
    body: 'Run the fixture', userInvocable: true, disableModelInvocation: false,
    hooks: { SessionStart: [{ hooks: [{ command: command(`require("node:fs").writeFileSync(${JSON.stringify(output)},"effect");`) }] }] },
  }, '', { config, provider, tools: [], signal: new AbortController().signal, source: 'user' }), /approval/);
  assert.equal(fs.existsSync(output), false);
  assert.equal(fs.existsSync(path.join(workspace, '.agent')), false);
});

test('merged hook count overflow is rejected before skill shell expansion performs effects', async t => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-hook-budget-')));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const output = path.join(workspace, 'effects.txt');
  const config = { ...defaultConfig(workspace, []), model: 'fixture', allowShell: true,
    permissions: { mode: 'bypass' as const, allow: [], deny: [] },
    hooks: { SessionStart: Array.from({ length: 1024 }, () => ({ command: 'true' })) },
  };
  const expansion = command(`require("node:fs").writeFileSync(${JSON.stringify(output)},"effect");`);
  await assert.rejects(executeSkill({ name: 'overflow', path: '/fixture/SKILL.md', description: 'Fixture',
    body: "Task !`" + expansion + "`", shell: '/bin/sh', userInvocable: true, disableModelInvocation: false,
    hooks: { SessionStart: [{ command: 'true' }] },
  }, '', { config, provider, tools: [], signal: new AbortController().signal, source: 'user' }), /1024/);
  assert.equal(fs.existsSync(output), false);
  assert.equal(fs.existsSync(path.join(workspace, '.agent')), false);
});
