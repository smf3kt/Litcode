import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

/** The provider streams, so the stub answers with Anthropic SSE events, not one JSON body. */
function sse(res, text, stopReason) {
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('message_start', { type: 'message_start', message: { id: 'msg_probe', type: 'message', role: 'assistant',
    model: 'fixture/probe', content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 } } });
  send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: null } });
  send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } });
  send('content_block_stop', { type: 'content_block_stop', index: 0 });
  send('message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: 1 } });
  send('message_stop', { type: 'message_stop' });
  res.end();
}

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w277-cli-')));
const checks = [], captures = {};
let active;

const requests = [];
const server = http.createServer((request, response) => {
  let body = '';
  request.on('data', chunk => { body += chunk; });
  request.on('end', () => {
    let parsed = {};
    try { parsed = JSON.parse(body); } catch { /* a stream body that is not JSON stays empty */ }
    requests.push(parsed);
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    sse(response, 'PROBE_REPLY', 'end_turn');
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseEnv = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture-model',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(baseEnv)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_EFFORT', 'TMUX', 'STY', 'TERM_PROGRAM', 'CLAUDE_CODE_DISABLE_AGENT_VIEW', 'IS_DEMO',
    'CLAUDE_CODE_COORDINATOR_MODE'].includes(key)) delete baseEnv[key];
const screen = () => {
  const terminal = new TerminalScreen(140, 30);
  terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const lines = terminal.lines(); terminal.close();
  return lines.map(line => line.trimEnd()).join('\n');
};
const flat = () => screen().replace(/\s+/g, '');
const ready = () => screen().includes('· ready') || flat().includes('?forshortcuts');
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(80);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) {
  assert.ok(condition, `${label}\n${screen()}`);
  checks.push(label); console.log(`PASS ${label}`);
}
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false }));
try {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user,
    '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass', '--allow-shell'],
  { cwd: workspace, env: { ...baseEnv, HOME: temporary }, stdio: ['pipe', 'pipe', 'pipe'] });
  active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => active.chunks.push(chunk));
  child.stderr.on('data', chunk => active.chunks.push(chunk));
  await until(ready, 'startup ready', 30000);
  // The footer reports `ready` before the composer hint does; wait for the empty-composer
  // hint so the startup frame (which owns the first key context) has handed over.
  await until(() => flat().includes('?forshortcuts'), 'composer hint', 15000);
  pass('the compiled CLI starts ready');

  // `Yc` (chunk-24k7d6mw.js 828570): 25 characters shrinking to 5 raises the tip for `XS`.
  send('x'.repeat(25));
  await until(() => flat().includes('xxxxxxxxxxxxxxxxxxxxxxxxx'), 'long draft');
  send('\x7f'.repeat(20));
  await until(() => flat().includes('Tip:'), 'stash tip');
  // The footer clips the row at half its width, so the compiled check is the leading label;
  // the full `Tip: ctrl+s to stash` string is asserted in the unit tests.
  pass('a 20-character shrink raises the stash tip');
  captures.tip = screen();

  // Typing clears the tip row before the next observation (`cq`, 830089).
  send('y');
  await until(() => !flat().includes('Tip:'), 'tip cleared by typing');
  pass('typing clears the tip row');

  // `qq` (843876): a non-empty draft stashes and reports nothing; the empty composer is the sign.
  await until(() => flat().includes('❯xxxxxy'), 'draft ready for the chord');
  await delay(300);
  send('\u0013');
  await until(() => !flat().includes('xxxxxy'), 'draft stashed');
  pass('the stash chord empties the composer with no status line');
  captures.stashed = screen();

  // A second press pops the slot back into the composer.
  send('\u0013');
  await until(() => flat().includes('xxxxxy'), 'draft restored by the chord');
  pass('a second stash chord returns the draft');
  pass('the chord itself raises no Draft restored notice', !flat().includes('Draftrestored'));
  captures.restored = screen();

  // The stash latched `hasUsedStash` (`bJt` 817896) in the user settings document.
  const saved = JSON.parse(fs.readFileSync(path.join(user, 'settings.json'), 'utf8'));
  pass('the stash wrote hasUsedStash into the user settings', saved.hasUsedStash === true);

  // `#s` (1495345): submitting with a stash waiting returns it with `Draft restored`.
  send('\x7f'.repeat(6));
  send('yy\u0013');
  await until(() => !flat().includes('xxxxxy'), 'stash before submit');
  send('PROBE_TASK');
  await until(() => flat().includes('PROBE_TASK'), 'task typed');
  send('\r');
  await until(() => flat().includes('Draftrestored'), 'restore notice');
  pass('a submit brings the stashed draft back with Draft restored');
  await until(() => flat().includes('PROBE_REPLY'), 'turn answer');
  captures.afterSubmit = screen();
  pass('the submitted turn still runs while the draft is restored',
    requests.some(request => JSON.stringify(request.messages ?? '').includes('PROBE_TASK')));

  // The latch suppresses the tip for the rest of the record's life.
  send('\x7f'.repeat(2));
  send('z'.repeat(25));
  await until(() => flat().includes('z'.repeat(25)), 'long second draft');
  send('\x7f'.repeat(20));
  await delay(400);
  pass('the tip stays away once hasUsedStash is set', !flat().includes('Tip:'));

  // The latch check leaves a draft behind, so clear it before the slash command; a composer with
  // text would submit `…/exit` as a prompt instead.
  send('\x7f'.repeat(40));
  await until(() => !flat().includes('zzzzz'), 'composer cleared');
  send('/exit\r');
  const code = await Promise.race([active.closed, delay(8000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
  pass('/exit ends the session');

  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures,
    identity: identity.sha256, ok: checks.length, requests: requests.length }, null, 2));
  console.log(`\n${checks.length} checks at identity ${identity.sha256.slice(0, 8)}…`);
} finally {
  if (active?.child.exitCode === null) active.child.kill('SIGKILL');
  server.close();
}
