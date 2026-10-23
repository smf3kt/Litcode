import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { TerminalScreen } from './terminal-screen.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const scratch = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : root;
const temporary = fs.mkdtempSync(path.join(scratch, '.loop-fold-'));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const invalidZone = process.argv.includes('--invalid-zone');
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ prefersReducedMotion: true, spinnerTipsEnabled: false,
  ...(invalidZone ? { timeZone: 'UTC+8' } : {}) }));
const clock = path.join(temporary, 'clock'), preload = path.join(temporary, 'clock.mjs'), pidFile = path.join(temporary, 'pid');
fs.writeFileSync(clock, String(new Date(2024, 0, 1, 12, 0).getTime()));
fs.writeFileSync(preload, 'import fs from "node:fs";const OriginalDate=Date;const now=()=>Number(fs.readFileSync(process.env.SMOKE_CLOCK,"utf8"));globalThis.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[now()]));}static now(){return now();}};\n');
const requests = [];
let ticks = 0, child, exited, done = false, errors = '';
const screen = new TerminalScreen(120, 55);
const frame = () => screen.lines().join('\n');
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const server = http.createServer((req, res) => {
  const chunks = []; req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
    const last = body.messages.at(-1).content;
    const result = Array.isArray(last) && last.some(block => block.type === 'tool_result');
    const human = typeof last === 'string' && last === 'human barrier';
    if (!result && !human && requests.length > 1) ticks++;
    const block = human ? { type: 'text', text: 'human-kept' } : result
      ? { type: 'text', text: ticks ? `quiet-span-${ticks}` : 'loop-armed' }
      : { type: 'tool_use', id: `fold-${requests.length}`, name: 'schedule_wakeup', input: {
        delaySeconds: 60, prompt: 'quiet fold fixture', noop: ticks > 0, reason: 'Await local fixture',
      } };
    const events = [
      { type: 'message_start', message: { id: `fold-response-${requests.length}`, type: 'message', role: 'assistant',
        model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: block.type === 'text' ? { type: 'text', text: '' } : { ...block, input: {} } },
      { type: 'content_block_delta', index: 0, delta: block.type === 'text' ? { type: 'text_delta', text: block.text }
        : { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: block.type === 'text' ? 'end_turn' : 'tool_use', stop_sequence: null }, usage: { output_tokens: 5 } },
      { type: 'message_stop' },
    ];
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
  });
});
const journal = () => {
  const directory = path.join(workspace, '.agent');
  if (!fs.existsSync(directory)) return [];
  for (const name of fs.readdirSync(directory)) {
    if (!name.endsWith('.jsonl') || !fs.existsSync(path.join(directory, name + '.lock'))) continue;
    const bytes = fs.readFileSync(path.join(directory, name), 'utf8'), end = bytes.lastIndexOf('\n');
    const rows = end < 0 ? [] : bytes.slice(0, end).split('\n').filter(Boolean).map(JSON.parse);
    if (rows[0]?.kind === 'metadata') return rows;
  }
  return [];
};
const until = async predicate => {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    assert.equal(done, false, `CLI exited early: ${errors}`);
    assert.ok(Date.now() < deadline, `CLI wait expired: ${errors}\n${frame()}`);
    await delay(20);
  }
};
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { TERM: 'xterm-256color', SMOKE_CLOCK: clock, HARNESS_LOOP_KEEPALIVE: 'off',
    LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture/fold', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate',
    LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_THINKING: 'false', LLM_EFFORT: 'medium',
    LLM_INHERIT_GATEWAY: 'false', LLM_PROMPT_CACHE: 'false' });
  const command = `printf '%s' "$$" > ${quote(pidFile)}; stty rows 55 cols 120; exec ${quote(process.execPath)} --import ${quote(preload)} ${quote(path.join(root, 'bin/litcode.mjs'))} --workspace ${quote(workspace)} --user-dir ${quote(user)}`;
  child = spawn('/bin/sh', ['-c', `cat | script -q /dev/null /bin/sh -c ${quote(command)}`], { cwd: root, detached: true, env });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', text => screen.write(text)); child.stderr.on('data', text => { errors += text; });
  exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => { done = true; resolve(code); }); });
  await until(() => frame().includes('ctrl+o'));
  child.stdin.write('arm quiet loop\r');
  await until(() => journal().filter(event => event.kind === 'turn_end').length === 1);
  const fire = async expected => {
    const previous = journal().filter(event => event.kind === 'turn_end').length;
    const response = requests.at(-1).messages.at(-1).content.find(block => block.type === 'tool_result');
    const result = JSON.parse(typeof response.content === 'string' ? response.content : response.content[0].text);
    fs.writeFileSync(clock, String(result.scheduledFor));
    await until(() => journal().filter(event => event.kind === 'turn_end').length > previous);
    assert.equal(ticks, expected);
  };
  await fire(1);
  assert.equal(journal().filter(event => event.kind === 'scheduled_task_fire').length, 1, 'dynamic fire appends its owned journal marker');
  await fire(2);
  await until(() => frame().includes('1 no-op tick since') && frame().includes('quiet-span-2'));
  assert.equal(frame().includes('quiet-span-1'), false, 'quiet prior span is folded on the normal screen');
  child.stdin.write('\u000f');
  await until(() => frame().includes('quiet-span-1'));
  child.stdin.write('\u000f');
  await until(() => !frame().includes('quiet-span-1'));
  await fire(3);
  await until(() => frame().includes('2 no-op ticks since') && frame().includes('quiet-span-3'));
  assert.equal(frame().includes('quiet-span-2'), false);
  const markers = journal().filter(event => event.kind === 'scheduled_task_fire');
  assert.deepEqual(markers.map(event => event.noOpStreak ?? 0), [0, 1, 2]);
  assert.equal(markers[2].streakStartedAt, markers[0].timestamp);
  assert.ok(requests.some(request => JSON.stringify(request.messages).includes('2 prior /loop wakeups found nothing actionable')));
  child.stdin.write('human barrier\r');
  await until(() => journal().filter(event => event.kind === 'turn_end').length === 5);
  const lastToolRequest = requests.findLast(request => Array.isArray(request.messages.at(-1).content)
    && request.messages.at(-1).content.some(block => block.type === 'tool_result'));
  const resultBlock = lastToolRequest.messages.at(-1).content.find(block => block.type === 'tool_result');
  const result = JSON.parse(typeof resultBlock.content === 'string' ? resultBlock.content : resultBlock.content[0].text);
  fs.writeFileSync(clock, String(result.scheduledFor));
  await until(() => journal().filter(event => event.kind === 'turn_end').length === 6);
  const finalMarkers = journal().filter(event => event.kind === 'scheduled_task_fire');
  assert.equal(finalMarkers.at(-1).noOpStreak, undefined, 'human input vetoes the next fold');
  assert.ok(journal().some(event => event.kind === 'message' && JSON.stringify(event.message).includes('quiet-span-1')));
  child.stdin.write('/exit\r'); child.stdin.end();
  assert.equal(await exited, 0, errors);
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  console.log(JSON.stringify({ cli: 'passed', compiled: true, invalidZone, dynamicFires: 4, streak: 2, transcriptExpands: true,
    humanBarrier: true, rawMessagesRetained: true, locksReleased: true, modelRequests: requests.length, gateway: 'owned loopback SSE' }));
} finally {
  if (child && !done) {
    if (fs.existsSync(pidFile)) {
      try { process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    await exited;
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  screen.close(); fs.rmSync(temporary, { recursive: true, force: true });
}
