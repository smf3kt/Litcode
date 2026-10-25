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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'fork-row-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false,
  promptSuggestionEnabled: false }));
const checks = [], requests = [];
const title = 'FORK_RENAME_RETAINS_THE_ENTIRE_ORIGINAL_TITLE_FOR_WIDE_WINDOWS';
const server = http.createServer((request, response) => {
  let body = '';
  request.on('data', chunk => { body += chunk; });
  request.on('end', () => {
    requests.push(JSON.parse(body));
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const send = (event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('message_start', { type: 'message_start', message: { id: 'msg_row', type: 'message', role: 'assistant',
      model: 'fixture-model', content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 } } });
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: null } });
    send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'PARENT_REPLY' } });
    send('content_block_stop', { type: 'content_block_stop', index: 0 });
    send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
    send('message_stop', { type: 'message_stop' }); response.end();
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const sizeFile = path.join(temporary, 'columns');
const wrapper = path.join(temporary, 'terminal.exp');
fs.writeFileSync(sizeFile, '60');
fs.writeFileSync(wrapper, `#!/usr/bin/expect -f
set stty_init "rows 40 columns 60"
set last_columns 60
proc watch_size {} {
  global spawn_id spawn_out last_columns env
  if {[file exists $env(LITCODE_FIXTURE_SIZE)]} {
    set file [open $env(LITCODE_FIXTURE_SIZE) r]
    set columns [string trim [read $file]]
    close $file
    if {[string is integer -strict $columns] && $columns != $last_columns} {
      stty rows 40 columns $columns < $spawn_out(slave,name)
      exec kill -WINCH [exp_pid -i $spawn_id]
      set last_columns $columns
    }
  }
  after 100 watch_size
}
after 100 watch_size
source ${path.join(root, 'scripts', 'pty-cli.exp')}
`);
const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  HOME: temporary, LITCODE_FIXTURE_SIZE: sizeFile,
  LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture-model', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` };
for (const key of Object.keys(env)) if (key.startsWith('ANTHROPIC_')
  || ['NO_COLOR', 'LLM_EFFORT', 'TMUX', 'STY', 'TERM_PROGRAM', 'CLAUDE_CODE_DISABLE_AGENT_VIEW', 'IS_DEMO',
    'CLAUDE_CODE_COORDINATOR_MODE', 'CLAUDE_CODE_REMOTE'].includes(key)) delete env[key];
const terminal = new TerminalScreen(60, 40);
const child = spawn('/usr/bin/expect', [wrapper, process.execPath, path.join(root, 'bin/litcode.mjs'),
  '--workspace', workspace, '--user-dir', user, '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass'],
{ cwd: workspace, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
const closed = new Promise(resolve => child.once('close', resolve));
let output = '';
for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding('utf8');
  stream.on('data', text => { output += text; terminal.write(text); });
}
const screen = () => terminal.lines().join('\n');
const send = value => child.stdin.write(value);
const ready = () => screen().includes('? for shortcuts') || screen().includes('· ready');
async function until(predicate, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    if (child.exitCode !== null || child.signalCode !== null) break;
    await delay(60);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) {
  assert.ok(condition, `${label}\n${screen()}`);
  checks.push(label); console.log(`PASS ${label}`);
}
const forkRow = () => terminal.lines().findIndex(line => line.startsWith('  ⎿  session '));
async function resize(columns) {
  terminal.resize(columns, 40);
  fs.writeFileSync(sizeFile, String(columns));
  await delay(250);
}
try {
  await until(ready, 'startup ready');
  send('ORIGINAL_TASK\r');
  await until(() => screen().includes('PARENT_REPLY') && ready(), 'parent turn completed');
  send(`/rename ${title}\r`);
  await until(() => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'))
    .some(file => fs.readFileSync(path.join(workspace, '.agent', file), 'utf8')
      .includes(JSON.stringify({ kind: 'title', title }))), 'parent rename');
  send('/fork\r');
  await until(() => /session waiting/.test(screen()), 'waiting fork row');
  pass('the compiled fork row uses the recovered gutter', forkRow() >= 0);
  let row = forkRow(), text = terminal.lines()[row];
  pass('the narrow row shortens the waiting state and name', text.startsWith('  ⎿  session waiting · ')
    && text.includes('…') && /[0-9a-f]{8}$/.test(text.trimEnd()));
  let nameAt = text.indexOf(' · ') + 3;
  pass('the copy name is bold', Boolean(terminal.cell(nameAt, row)?.isBold()));
  pass('the state uses the inactive theme color', terminal.cell(5, row)?.getFgColor()
    !== terminal.cell(nameAt, row)?.getFgColor());
  pass('the row has no attach underline', terminal.cell(nameAt, row)?.isUnderline() === 0);

  await resize(140);
  await until(() => forkRow() >= 0 && terminal.lines()[forkRow()].includes(title), 'wide row restored');
  pass('widening restores the full original name', terminal.lines()[forkRow()].includes(`session waiting for a prompt · ${title} · `));
  await resize(60);
  await until(() => forkRow() >= 0 && terminal.lines()[forkRow()].includes('…'), 'narrow row refitted');
  pass('narrowing fits the original fields again');
  await resize(140);
  await until(() => forkRow() >= 0 && terminal.lines()[forkRow()].includes(title), 'second wide row');
  pass('a second widening still restores the name');
  row = forkRow(); text = terminal.lines()[row]; nameAt = text.indexOf(' · ') + 3;
  const start = nameAt + 1, end = nameAt + title.length + 1, y = row + 1;
  send(`\x1b[<0;${start};${y}M\x1b[<32;${end};${y}M\x1b[<0;${end};${y}m`);
  await delay(80);
  send('\x03');
  await until(() => output.includes('\x1b]52;c;'), 'row copy');
  const copied = [...output.matchAll(/\x1b\]52;c;([A-Za-z0-9+/=]*)\x07/g)]
    .map(match => Buffer.from(match[1], 'base64').toString('utf8'));
  pass('selecting the full name copies its exact text', copied.includes(title));
  pass('the waiting fork sends no additional request', requests.length === 1);
  send('/exit\r');
  const result = await Promise.race([closed, delay(8000).then(() => 'timeout')]);
  assert.equal(result, 0, `CLI exit ${result}`);
  pass('the terminal releases its session locks', fs.readdirSync(path.join(workspace, '.agent'))
    .every(name => !name.endsWith('.lock')));
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, requests: requests.length }, null, 2));
  console.log(`\n${checks.length} checks, ${requests.length} loopback request, fixture ${temporary}`);
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    await Promise.race([closed, delay(1000)]);
    if (child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }
  }
  terminal.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
