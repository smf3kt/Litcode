import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fingerprint } from '../dist/session.js';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'cron-calendar-cli-')));
const workspace = path.join(temporary, 'workspace');
const userDir = path.join(temporary, 'user');
const settingsFile = path.join(userDir, 'settings.json');
const clockFile = path.join(temporary, 'clock');
const preload = path.join(temporary, 'clock.mjs');
const storeFile = path.join(workspace, '.harness/scheduled_tasks.json');
const leaseFile = path.join(workspace, '.harness/scheduled_tasks.lock');
const effectFile = path.join(workspace, 'calendar-effect.txt');
const requests = [];
const children = [];
const leap = Date.parse('2028-02-29T00:00:00Z');
let active;

async function until(check, label) {
  const end = Date.now() + 10000;
  while (!check()) {
    assert.ok(Date.now() < end, `${label}: ${active?.err ?? ''}`);
    if (active?.done) throw new Error(`${label}: child exited ${active.err}`);
    await delay(20);
  }
}
function settings(calendar) {
  fs.writeFileSync(settingsFile, JSON.stringify({ model: 'fixture', thinking: false, promptSuggestionEnabled: false,
    features: { schedulerDurable: true, ...(calendar === undefined ? {} : { schedulerSourceCalendar: calendar }) },
    permissions: { mode: 'bypass', allow: [], deny: [] } }));
}
function send(response, block) {
  const tool = block.type === 'tool_use';
  const events = [
    ['message_start', { type: 'message_start', message: { id: 'calendar', type: 'message', role: 'assistant', model: 'fixture',
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: tool ? { ...block, input: {} } : { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: tool
      ? { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } : { type: 'text_delta', text: block.text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }],
    ['message_stop', { type: 'message_stop' }],
  ];
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  response.end(events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''));
}
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    requests.push(body);
    const content = body.messages.at(-1)?.content;
    const text = typeof content === 'string' ? content : '';
    const tool = (name, input) => ({ type: 'tool_use', id: `calendar-${requests.length}`, name, input });
    const block = text === 'CREATE_LEAP' ? tool('cron_create', { cron: '0 0 29 2 *', prompt: 'FUTURE_LEAP_EFFECT', recurring: false, durable: true })
      : text === 'CREATE_IMPOSSIBLE' ? tool('cron_create', { cron: '0 0 30 2 *', prompt: 'impossible', recurring: false, durable: true })
      : text === 'LIST_CALENDAR' ? tool('cron_list', {})
      : text.startsWith('CANCEL ') ? tool('cron_delete', { id: text.slice(7) })
      : text === 'FUTURE_LEAP_EFFECT' ? tool('write_file', { path: 'calendar-effect.txt', content: 'source calendar fired once\n' })
      : { type: 'text', text: 'CALENDAR_DONE' };
    send(response, block);
  });
});
function launch(id) {
  const child = spawn(process.execPath, ['--import', preload, path.join(root, 'bin/litcode.mjs'),
    '--workspace', workspace, '--interactive', ...(id ? ['--resume', id] : ['--user-dir', userDir])],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const state = { child, out: '', err: '', done: false, turns: 0 };
  child.stdout.on('data', chunk => { state.out += String(chunk); });
  child.stderr.on('data', chunk => { state.err = (state.err + String(chunk)).slice(-64000); });
  state.exit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => { state.done = true; resolve(code); });
  });
  children.push(state); active = state; return state;
}
async function ready(state) {
  await until(() => state.err.includes('Personal harness.'), 'interactive startup');
  await until(() => fs.existsSync(leaseFile), 'scheduler lease publication');
  const id = JSON.parse(fs.readFileSync(leaseFile, 'utf8')).sessionId;
  const journal = path.join(workspace, '.agent', `${id}.jsonl`);
  await until(() => fs.existsSync(journal) && fs.readFileSync(journal, 'utf8').endsWith('\n'), 'committed session metadata');
  state.id = id; state.journal = journal;
  return JSON.parse(fs.readFileSync(journal, 'utf8').split('\n')[0]);
}
async function command(state, text) {
  const before = requests.length;
  const ended = state.err.split('finished: end_turn').length;
  state.child.stdin.write(`${text}\n`);
  await until(() => state.err.split('finished: end_turn').length > ended, text);
  return requests.slice(before).flatMap(body => {
    const content = body.messages.at(-1)?.content;
    return Array.isArray(content) ? content.filter(block => block.type === 'tool_result') : [];
  }).at(-1);
}
function data(result) {
  assert.ok(result, 'the real CLI supplies a paired tool result');
  assert.equal(result.is_error ?? false, false, JSON.stringify(result));
  return JSON.parse(typeof result.content === 'string' ? result.content : result.content[0].text);
}
async function close(state) {
  state.child.stdin.end('/exit\n');
  assert.equal(await state.exit, 0, state.err);
  assert.equal(fs.existsSync(leaseFile), false);
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
}

fs.mkdirSync(workspace); fs.mkdirSync(userDir);
fs.writeFileSync(clockFile, String(Date.parse('2025-01-01T00:00:00Z')));
fs.writeFileSync(preload, 'import fs from "node:fs";\nconst OriginalDate=Date;let stamp,anchor=OriginalDate.now();const now=()=>{const next=Number(fs.readFileSync(process.env.SMOKE_CLOCK,"utf8"));if(next!==stamp){stamp=next;anchor=OriginalDate.now();}return stamp+OriginalDate.now()-anchor;};globalThis.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[now()]));}static now(){return now();}};\n');
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, HOME: temporary, TZ: 'UTC', SMOKE_CLOCK: clockFile,
  HARNESS_LOOP_KEEPALIVE: 'off', LLM_API_KEY: 'owned-calendar-fixture', LLM_MODEL: 'fixture',
  LLM_AUTH: 'bearer', LLM_THINKING: 'false', LLM_TOKEN_COUNTING: 'estimate',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || key === 'LLM_EFFORT') delete env[key];
try {
  settings();
  const first = launch();
  const original = await ready(first);
  const created = data(await command(first, 'CREATE_LEAP'));
  assert.equal(created.nextAt, leap, 'the compiled fresh CLI finds the leap day more than one year ahead');
  assert.equal(original.config.features.schedulerSourceCalendar, true);
  assert.equal(created.durable, true);
  const originalRow = JSON.parse(fs.readFileSync(storeFile, 'utf8')).tasks[0];
  assert.equal(Object.hasOwn(originalRow, 'nextAt'), false);
  assert.equal(Object.hasOwn(originalRow, 'schedulerSourceCalendar'), false);
  assert.equal(fs.existsSync(effectFile), false);
  await close(first);

  settings(false);
  const second = launch(first.id);
  const resumed = await ready(second);
  assert.deepEqual(resumed, original, 'original resume retains its pinned calendar and complete metadata');
  assert.equal(data(await command(second, 'LIST_CALENDAR')).jobs[0].nextAt, leap);
  const eventCount = second.err.split('event finished: end_turn').length;
  fs.writeFileSync(clockFile, String(leap));
  await until(() => fs.existsSync(effectFile) && second.err.split('event finished: end_turn').length > eventCount, 'one scheduled file effect');
  assert.equal(fs.readFileSync(effectFile, 'utf8'), 'source calendar fired once\n');
  await until(() => JSON.parse(fs.readFileSync(storeFile, 'utf8')).tasks.length === 0, 'one-shot retirement');
  fs.writeFileSync(clockFile, String(leap + 120000));
  assert.deepEqual(data(await command(second, 'LIST_CALENDAR')).jobs, []);
  assert.equal(fs.readFileSync(second.journal, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
    .filter(row => row.kind === 'tool_start' && row.name === 'write_file').length, 1);
  const later = data(await command(second, 'CREATE_LEAP'));
  assert.equal(later.nextAt, Date.parse('2032-02-29T00:00:00Z'));
  assert.equal(data(await command(second, `CANCEL ${later.id}`)).deleted, true);
  const impossible = await command(second, 'CREATE_IMPOSSIBLE');
  assert.equal(impossible.is_error, true);
  assert.deepEqual(data(await command(second, 'LIST_CALENDAR')).jobs, []);
  await close(second);

  settings(true);
  fs.writeFileSync(storeFile, JSON.stringify({ tasks: [{ ...originalRow, id: 'catchup01', prompt: 'MISSED_LEAP_APPROVAL' }] }));
  const catchupStart = requests.length;
  const third = launch();
  await ready(third);
  await until(() => third.err.includes('event finished: end_turn'), 'source-calendar missed one-shot');
  assert.match(JSON.stringify(requests.slice(catchupStart)[0].messages.at(-1)), /MISSED_LEAP_APPROVAL/);
  assert.match(JSON.stringify(requests.slice(catchupStart)[0].messages.at(-1)), /First use the AskUserQuestion tool/);
  await until(() => JSON.parse(fs.readFileSync(storeFile, 'utf8')).tasks.length === 0, 'missed row retired');
  await close(third);

  fs.writeFileSync(clockFile, String(Date.parse('2025-01-01T00:00:00Z')));
  settings(false);
  const old = launch();
  const legacy = await ready(old);
  assert.equal(legacy.config.features.schedulerSourceCalendar, false);
  assert.equal((await command(old, 'CREATE_LEAP')).is_error, true);
  assert.deepEqual(data(await command(old, 'LIST_CALENDAR')).jobs, []);
  await close(old);
  const records = fs.readFileSync(old.journal, 'utf8').trimEnd().split('\n').map(JSON.parse);
  delete records[0].config.features.schedulerSourceCalendar;
  records[0].fingerprint = fingerprint(records[0].config);
  const historical = records.map(row => JSON.stringify(row)).join('\n') + '\n';
  fs.writeFileSync(old.journal, historical);
  settings(true);
  const absent = launch(old.id);
  const absentMetadata = await ready(absent);
  assert.equal(Object.hasOwn(absentMetadata.config.features, 'schedulerSourceCalendar'), false);
  assert.equal((await command(absent, 'CREATE_LEAP')).is_error, true);
  assert.deepEqual(data(await command(absent, 'LIST_CALENDAR')).jobs, []);
  assert.equal(fs.readFileSync(old.journal, 'utf8').startsWith(historical), true);
  const reloadOffset = absent.err.length;
  absent.child.stdin.write('/reload\n');
  await until(() => absent.err.slice(reloadOffset).includes('Local configuration reloaded;'), 'explicit calendar reload');
  const adopted = await ready(absent);
  assert.notEqual(absent.id, old.id);
  assert.equal(adopted.config.features.schedulerSourceCalendar, true);
  const adoptedJob = data(await command(absent, 'CREATE_LEAP'));
  assert.equal(adoptedJob.nextAt, leap);
  assert.equal(data(await command(absent, `CANCEL ${adoptedJob.id}`)).deleted, true);
  await close(absent);
  console.log(JSON.stringify({ cli: 'passed', sourceCalendar: true, futureLeap: true, originalResume: true,
    effectOnce: true, nextLeapAndCancel: true, impossible: true, missedCatchup: true,
    legacyFalseAndAbsent: true, explicitReload: true, processes: children.length, requests: requests.length, externalCalls: 0, locksReleased: true }));
} finally {
  for (const state of children) {
    if (!state.done) {
      state.child.kill('SIGTERM');
      const force = setTimeout(() => state.child.kill('SIGKILL'), 5000);
      await state.exit.finally(() => clearTimeout(force));
    }
  }
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
