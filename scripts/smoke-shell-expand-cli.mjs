import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'shell-expand-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-shell', thinking: false,
  prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled', respondToBashCommands: false }));
const pty = path.join(temporary, 'pty.exp'), worker = path.join(temporary, 'worker.mjs');
fs.writeFileSync(pty, `set stty_init "rows 40 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
fs.writeFileSync(worker, `import fs from 'node:fs';\nconst [release,label]=process.argv.slice(2);\nfor(let i=1;i<=9;i++)console.log(label+'_LINE_'+i);\nconst timer=setInterval(()=>{if(fs.existsSync(release)){clearInterval(timer);console.log(label+'_FINISHED');}},25);\n`);
const baseline = process.argv.includes('--baseline'), screen = new TerminalScreen(120, 40);
const requests = [], captures = {}, releases = [];
let child, exited, server, stderr = '';
const frame = () => screen.lines().join('\n');
const send = value => child.stdin.write(value);
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const pointer = (button, column, row, end = 'M') => send(`\x1b[<${button};${column};${row}${end}`);
const ready = () => frame().includes('· ready');
async function until(check, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (!check()) {
    assert.ok(Date.now() < end, `${label}\n${stderr}\n${frame()}`);
    assert.ok(child.exitCode === null && child.signalCode === null, `${label}: CLI exited`);
    await delay(25);
  }
}
function locate(text) {
  const row = screen.lines().findIndex(line => line.includes(text));
  assert.ok(row >= 0, `${text}\n${frame()}`);
  return { row: row + 1, column: screen.lines()[row].indexOf(text) + 1 };
}
async function click(text, blank = false) {
  const cell = locate(text), column = blank ? 115 : cell.column;
  pointer(35, column, cell.row); pointer(0, column, cell.row); pointer(0, column, cell.row, 'm');
  await delay(100);
}
async function begin(label) {
  const release = path.join(workspace, label + '.release'); releases.push(release);
  send(`!exec ${quote(process.execPath)} ${quote(worker)} ${quote(release)} ${quote(label)}\r`);
  await until(() => frame().includes(label + '_LINE_9') && /\(\d+s/.test(frame()), label + ' running output');
  assert.doesNotMatch(frame(), new RegExp(label + '_LINE_1'));
  return release;
}
try {
  server = http.createServer((req, res) => {
    void (async () => {
      let text = ''; for await (const chunk of req) text += chunk;
      const body = JSON.parse(text); requests.push(body);
      const events = [
        { type: 'message_start', message: { id: 'shell-main', type: 'message', role: 'assistant', model: body.model,
          content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 80, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'SHELL_MAIN_RECOVERED' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 8 } },
        { type: 'message_stop' },
      ];
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
    })().catch(error => { stderr += error.stack; res.destroy(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3' };
  for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY'].includes(name)) delete env[name];
  Object.assign(env, { LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture-shell', LLM_AUTH: 'bearer',
    LLM_TOKEN_COUNTING: 'estimate', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` });
  child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--user-dir', userDir, '--interactive', '--no-inherit-gateway'],
  { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  const decoder = new StringDecoder('utf8');
  child.stdout.on('data', chunk => screen.write(decoder.write(chunk)));
  child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
  await until(ready, 'startup', 20000);
  const release = await begin('FIRST');
  send('retained shell draft');
  captures.collapsed = frame();
  const row = locate('FIRST_LINE_7');
  pointer(35, row.column, row.row); await delay(100);
  assert.doesNotMatch(frame(), /FIRST_LINE_1/);
  captures.hover = frame();
  await click('FIRST_LINE_7');
  if (baseline) {
    assert.doesNotMatch(frame(), /FIRST_LINE_1/);
    captures.baselineClick = frame();
  } else {
    await until(() => frame().includes('FIRST_LINE_1'), 'click expands full retained output');
    pointer(35, 1, 1); await delay(80);
    assert.match(frame(), /FIRST_LINE_1/);
    assert.match(frame(), /retained shell draft/);
    captures.expanded = frame();
    const secondary = locate('FIRST_LINE_7');
    pointer(2, secondary.column, secondary.row); pointer(2, secondary.column, secondary.row, 'm');
    await click('FIRST_LINE_7');
    await until(() => !frame().includes('FIRST_LINE_1'), 'right press resets click chain before folding');
    pointer(1, secondary.column, secondary.row); pointer(1, secondary.column, secondary.row, 'm');
    await click('FIRST_LINE_7'); await until(() => frame().includes('FIRST_LINE_1'), 'middle press resets click chain before expansion');
    await click('FIRST_LINE_7', true);
    await until(() => !frame().includes('FIRST_LINE_1'), 'blank click folds expanded output');
    await click('FIRST_LINE_7', true);
    assert.doesNotMatch(frame(), /FIRST_LINE_1/);
    const drag = locate('FIRST_LINE_7');
    pointer(0, drag.column, drag.row); pointer(32, drag.column + 5, drag.row); pointer(0, drag.column + 5, drag.row, 'm');
    await delay(100); assert.doesNotMatch(frame(), /FIRST_LINE_1/);
    captures.drag = frame();
    send('\x15');
  }
  fs.writeFileSync(release, 'release');
  await until(() => ready() && frame().includes('FIRST_FINISHED'), 'first command completes');
  send('\x15');
  if (!baseline) {
    const next = await begin('SECOND');
    assert.doesNotMatch(frame(), /SECOND_LINE_1/);
    captures.nextOwner = frame();
    await click('SECOND_LINE_7'); await until(() => frame().includes('SECOND_LINE_1'), 'second owner can expand');
    fs.writeFileSync(next, 'release'); await until(() => ready() && frame().includes('SECOND_FINISHED'), 'second command completes');
  }
  send('MAIN_AFTER_SHELL\r'); await until(() => ready() && frame().includes('SHELL_MAIN_RECOVERED'), 'main turn after shell');
  assert.equal(requests.length, 1);
  assert.match(JSON.stringify(requests[0].messages), /FIRST_LINE_1/);
  assert.match(JSON.stringify(requests[0].messages), /FIRST_FINISHED/);
  send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0, stderr);
  const journals = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
  assert.equal(journals.length, 1);
  const journal = fs.readFileSync(path.join(workspace, '.agent', journals[0]), 'utf8');
  assert.match(journal, /FIRST_LINE_1/); assert.match(journal, /FIRST_FINISHED/);
  assert.deepEqual(fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.lock')), []);
  console.log(JSON.stringify({ cli: 'passed', baseline, expanded: !baseline, collapse: !baseline, dragPreserved: !baseline,
    ownerReset: !baseline, modelRequests: requests.length, journalComplete: true, locksReleased: true, fixture: temporary }));
} finally {
  for (const release of releases) if (!fs.existsSync(release)) fs.writeFileSync(release, 'release');
  fs.writeFileSync(path.join(temporary, 'captures.json'), JSON.stringify(captures, null, 2));
  fs.writeFileSync(path.join(temporary, 'screen.txt'), frame());
  if (child?.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    await exited;
  }
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve)); screen.close();
}
