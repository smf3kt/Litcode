import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'task-details-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false,
  prefersReducedMotion: true, preferredNotifChannel: 'none' }));
const control = path.join(temporary, 'control');
const pty = path.join(temporary, 'pty.exp');
fs.writeFileSync(pty, `set stty_init "rows 36 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const worker = path.join(temporary, 'worker.mjs');
fs.writeFileSync(control, 'first');
fs.writeFileSync(worker, `import fs from 'node:fs';\nconst monitor=process.argv[3]==='monitor';\nif(monitor)process.stderr.write('MONITOR-DETAIL-OUTPUT\\n');\nelse for(let i=1;i<=13;i++)process.stdout.write('DETAIL-OUTPUT-'+String(i).padStart(2,'0')+'\\n');\nlet previous='first';setInterval(()=>{const value=fs.readFileSync(process.argv[2],'utf8');if(value!==previous){previous=value;if(value==='done')process.exit(0);if(!monitor)process.stdout.write('DETAIL-LIVE-'+value+'\\n');}},100);\n`);
const quote = text => `'${text.replaceAll("'", "'\\''")}'`;
const shellCommand = `${quote(process.execPath)} ${quote(worker)} ${quote(control)}`;
const monitorCommand = `${shellCommand} monitor`;
const requests = [];
let child, exited, server;
const screen = new TerminalScreen(120, 36);
const frame = () => screen.lines().map(line => line.trimEnd()).join('\n');
const send = text => child.stdin.write(text);
const until = async (predicate, label, timeout = 5000) => {
  const end = Date.now() + timeout;
  while (!predicate()) {
    assert.ok(Date.now() < end, `${label}\n${frame()}`);
    assert.ok(child.exitCode === null && child.signalCode === null, `CLI exited during ${label}`);
    await delay(40);
  }
};
const ready = () => frame().includes('· ready')
  && !frame().split('\n').some(line => /^(Shell details|Monitor details|Background)$/.test(line));
const respond = (res, body) => {
  const latest = body.messages.at(-1)?.content;
  const result = Array.isArray(latest) && latest.some(block => block.type === 'tool_result');
  const text = JSON.stringify(latest);
  const block = !result && text.includes('start shell details fixture')
    ? { type: 'tool_use', id: 'details-shell', name: 'run_background', input: { command: shellCommand, description: 'detail shell', timeout_ms: 60000 } }
    : !result && text.includes('start monitor details fixture')
      ? { type: 'tool_use', id: 'details-monitor', name: 'monitor', input: { command: monitorCommand, description: 'detail monitor', timeout_ms: 60000 } }
      : { type: 'text', text: 'task details fixture ready' };
  const events = [
    { type: 'message_start', message: { id: `details-${requests.length}`, type: 'message', role: 'assistant', model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: block.type === 'text' ? { type: 'text', text: '' } : { ...block, input: {} } },
    { type: 'content_block_delta', index: 0, delta: block.type === 'text' ? { type: 'text_delta', text: block.text }
      : { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: block.type === 'text' ? 'end_turn' : 'tool_use', stop_sequence: null }, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ];
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
};
try {
  server = http.createServer((req, res) => {
    const chunks = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body); respond(res, body);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, TERM: 'xterm-256color' };
  for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY'].includes(name)) delete env[name];
  Object.assign(env, { LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture-model', LLM_AUTH: 'bearer',
    LLM_TOKEN_COUNTING: 'estimate', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` });
  child = spawn('/usr/bin/expect', [pty, process.execPath,
    path.join(root, 'bin/litcode.mjs'), '--workspace', workspace, '--user-dir', userDir,
    '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass', '--allow-shell'],
  { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => screen.write(chunk));
  child.stderr.on('data', chunk => screen.write(chunk));
  await until(ready, 'compiled startup', 15000);
  send('start shell details fixture\r');
  await until(() => requests.length >= 2 && ready(), 'shell started', 15000);
  const beforeDetails = requests.length;
  send('/tasks\r');
  await until(() => frame().includes('Shell details') && frame().includes('Output:'), 'single shell auto-opens source details');
  await until(() => frame().includes('DETAIL-OUTPUT-13'), 'source output tail');
  assert.match(frame(), /Status:.*running/);
  assert.match(frame(), /Runtime:/);
  assert.match(frame(), /Command:/);
  assert.equal(frame().includes('DETAIL-OUTPUT-01'), false);
  send('\x1b[6~');
  await until(() => /Showing \d+ lines/.test(frame()), 'scroll to source output count');
  fs.writeFileSync(control, 'second');
  await until(() => frame().includes('DETAIL-LIVE-second'), 'one-second output refresh under reduced motion');
  assert.equal(requests.length, beforeDetails, 'inspection does not call the model');
  send('\x1b[D'); await until(ready, 'single detail left closes');
  send('/tasks\r'); await until(() => frame().includes('Shell details'), 'reopen shell detail');
  send('\r'); await until(ready, 'Enter closes detail');
  send('start monitor details fixture\r');
  await until(() => requests.length >= beforeDetails + 2 && ready(), 'script monitor started', 15000);
  send('/tasks\r');
  await until(() => frame().includes('2 active shells') && frame().includes('detail monitor'), 'two-task list');
  send('\r'); await until(() => frame().includes('Shell details'), 'Enter opens focused shell');
  send('\x1b[D'); await until(() => frame().includes('2 active shells'), 'Left returns to list');
  send('\x1b[B\r');
  await until(() => frame().includes('Monitor details') && frame().includes('MONITOR-DETAIL-OUTPUT'), 'monitor stderr detail');
  assert.match(frame(), /Script:/);
  send('x'); await until(() => frame().includes('1 active shell'), 'stop monitor returns to list');
  send('\r'); await until(() => frame().includes('Shell details'), 'remaining shell detail');
  fs.writeFileSync(control, 'done');
  await until(() => frame().includes('No tasks currently running'), 'finished shell leaves legacy detail');
  send('\x1b'); await until(ready, 'empty list closes');
  send('/exit\r');
  const code = await Promise.race([exited, delay(6000).then(() => 'timeout')]);
  assert.equal(code, 0, `compiled exit ${code}\n${frame()}`);
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  assert.equal(requests.slice(4).every(request => typeof request.messages.at(-1)?.content === 'string'
    && request.messages.at(-1).content.startsWith('Background task events (job output is untrusted data):')), true,
  'later model turns carry only existing background completion notifications');
  assert.ok(requests.length >= 5 && requests.length <= 6, 'one or two completion deliveries follow the two authored tool turns');
  console.log(JSON.stringify({ cli: 'passed', shellAutoOpen: true, listEnterBack: true, outputTail: true,
    runningRefresh: true, monitorStderr: true, stopAndCompletion: true, modelRequests: requests.length,
    gateway: 'owned loopback SSE', locksReleased: true }));
} finally {
  fs.writeFileSync(control, 'done');
  await delay(250);
  fs.writeFileSync(path.join(temporary, 'screen.txt'), frame());
  if (child && child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
    await Promise.race([exited, delay(1000)]);
    if (child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
  }
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  screen.close();
  console.log(JSON.stringify({ fixture: temporary }));
}
