import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w272-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false }));
const checks = [], captures = {};
let active;

const server = http.createServer((_request, response) => { response.writeHead(500); response.end(); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  HOME: temporary, LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture-model',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_EFFORT', 'TMUX', 'STY', 'TERM_PROGRAM'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(110, 40);
  terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const lines = terminal.lines(); terminal.close();
  return lines.map(line => line.trimEnd()).join('\n');
};
const ready = () => screen().includes('· ready');
// Wrapped panel lines break mid-word at the terminal width; content checks read the screen with
// every whitespace run removed so a break inside a word still matches.
const flat = () => screen().replace(/\s+/g, '');
const send = value => active.child.stdin.write(value);
const journals = () => {
  const dir = path.join(workspace, '.agent');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')) : [];
};
async function until(predicate, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(60);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) {
  assert.ok(condition, `${label}\n${screen()}`);
  checks.push(label); console.log(`PASS ${label}`);
}
try {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user,
    '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass', '--allow-shell'],
  { cwd: workspace, env, stdio: ['pipe', 'pipe', 'pipe'] });
  active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => active.chunks.push(chunk));
  child.stderr.on('data', chunk => active.chunks.push(chunk));
  await until(ready, 'startup ready', 25000);
  pass('the compiled CLI starts ready');
  const before = journals().length;

  send('/branch\r');
  await until(() => flat().includes('Branchedconversation.Youarenowinthenewbranch'),
    'branch summary');
  captures.first = screen();
  pass('/branch derives a title and does not quote it');
  await until(ready, 'branch settled');
  pass('the branch hint names the way back',
    flat().includes('toreturntotheoriginal'));
  pass('a second journal now exists', journals().length === before + 1);

  send('/branch my-topic\r');
  await until(() => flat().includes('"my-topic".'), 'named branch');
  captures.named = screen();
  pass('a typed name is quoted and stored without a branch suffix');
  await until(ready, 'named branch settled');
  pass('a third journal now exists', journals().length === before + 2);

  send('/branch\r');
  await until(() => flat().split('Youarenowinthenewbranch').length - 1 >= 3, 'ordinal branch');
  captures.ordinal = screen();
  pass('a second derived branch is not quoted either');
  await until(ready, 'ordinal branch settled');
  const titles = journals().map(name => [...fs.readFileSync(path.join(workspace, '.agent', name), 'utf8')
    .matchAll(/"title":"([^"]+)"/g)].at(-1)?.[1]);
  pass('the second derived branch takes the next ordinal in its journal',
    titles.includes('Branched conversation (Branch 2)'));

  // The composer's own command table carries the row, description included.
  send('/bran');
  await until(() => flat().includes('Createabranchofthecurrentconversationatthispoint'),
    'composer row', 30000);
  captures.composer = screen();
  pass('the composer offers the command with its recovered description');
  send('\x15');
  await until(ready, 'composer cleared');

  send('/quit\r');
  const code = await Promise.race([active.closed, delay(6000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
  pass('/quit exits the session');

  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures, identity: identity.sha256,
    ok: checks.length }, null, 2));
  console.log(`\n${checks.length} checks at identity ${identity.sha256.slice(0, 8)}…`);
} finally {
  if (active?.child.exitCode === null) active.child.kill('SIGKILL');
  server.close();
}
