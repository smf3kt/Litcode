import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(process.env.CLAUDE_JOB_DIR, 'tmp');
const temporary = fs.mkdtempSync(path.join(output, 'w302-cli-'));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git'));
const settings = path.join(user, 'settings.json'), checks = [], captures = {}, children = [];
let active, pending, requests = 0;
const server = http.createServer((request, reply) => {
  request.resume(); request.on('end', () => {
    requests++;
    pending = () => {
      reply.writeHead(200, { 'content-type': 'text/event-stream' });
      const event = (name, data) => reply.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
      event('message_start', { type: 'message_start', message: { id: 'owl-fixture', type: 'message', role: 'assistant', model: 'fixture', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 4, output_tokens: 0 } } });
      event('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
      event('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'OWL_FIXTURE_DONE' } });
      event('content_block_stop', { type: 'content_block_stop', index: 0 });
      event('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 4 } });
      event('message_stop', { type: 'message_stop' }); reply.end();
    };
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', FORCE_COLOR: '3',
  LLM_API_KEY: 'fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'ZELLIJ', 'NO_COLOR'].includes(key)) delete env[key];
const text = () => active.screen.lines().join('\n');
const send = value => active.child.stdin.write(value);
const sprite = () => {
  const rows = active.screen.lines(), header = rows.findIndex(row => row.includes('LiTcode v'));
  return Array.from({ length: 8 }, (_, y) => Array.from({ length: 20 }, (_, x) => {
    const cell = active.screen.cell(x, header + y + 1);
    return cell ? [cell.getChars(), cell.getFgColor(), cell.getBgColor()] : [];
  }));
};
function pass(name, condition = true) { assert.ok(condition, `${name}\n${text()}`); checks.push(name); console.log(`PASS ${name}`); }
async function until(predicate, label, ms = 12000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (predicate()) return; if (active.child.exitCode !== null) break; await delay(25); }
  throw new Error(`${label}\n${text()}`);
}
function capture(name) {
  captures[name] = active.screen.lines().map((line, y) => ({ text: line, cells: Array.from({ length: active.columns }, (_, x) => {
    const cell = active.screen.cell(x, y);
    return { text: cell?.getChars() ?? '', foreground: cell?.getFgColor(), background: cell?.getBgColor(), fgMode: cell?.getFgColorMode(), bgMode: cell?.getBgColorMode() };
  }) }));
}
async function launch(theme, reduced, columns = 100, rows = 30) {
  fs.writeFileSync(settings, JSON.stringify({ model: 'fixture', theme, prefersReducedMotion: reduced, showTurnDuration: false, spinnerTipsEnabled: false }));
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w302-owl.exp'), process.execPath, path.join(root, 'bin/litcode.mjs'),
    '--workspace', workspace, '--interactive', '--user-dir', user, '--no-inherit-gateway'],
    { cwd: root, env: { ...env, W302_COLUMNS: String(columns), W302_ROWS: String(rows) }, stdio: ['pipe', 'pipe', 'pipe'] });
  const screen = new TerminalScreen(columns, rows), decoder = new StringDecoder('utf8');
  active = { child, screen, columns, bytes: 0, closed: new Promise(resolve => child.once('close', resolve)) }; children.push(active);
  const owner = active;
  const feed = bytes => { owner.bytes += bytes.length; owner.screen.write(decoder.write(bytes)); };
  child.stdout.on('data', feed); child.stderr.on('data', feed);
  await until(() => columns >= 40 ? text().includes('ready') : text().includes('LiTcode v') && text().includes('❯'), 'CLI ready', 30000);
}
async function stop() {
  send('\x15/exit\r');
  pass('CLI exits zero', await Promise.race([active.closed, delay(6000).then(() => 'timeout')]) === 0);
  const count = active.bytes; await delay(250); pass('exit leaves no late animation writes', active.bytes === count);
}
try {
  await launch('dark', false); capture('dark');
  pass('round pixel owl is visible in the actual compiled CLI', text().includes('▄█▀█▄  ▄█▀█▄'));
  const rgb = sprite().flat().flatMap(cell => [cell[1], cell[2]]);
  pass('white plumage and golden eyes retain reference colors', rgb.includes(0xf6f7fa) && rgb.includes(0xffd12d));
  send('kept draft'); const rest = JSON.stringify(sprite());
  await until(() => JSON.stringify(sprite()) !== rest, 'idle breath', 4000); capture('breathing'); pass('idle owl changes pose while draft remains', text().includes('kept draft'));
  send('\x1b[O'); await delay(100); const blurred = JSON.stringify(sprite()); await delay(2800);
  pass('focus loss pauses the visible owl', JSON.stringify(sprite()) === blurred);
  send('\x1b[I'); await until(() => JSON.stringify(sprite()) !== blurred, 'focused owl resumes', 4000); pass('focus resumes owl poses');
  send('\x15owned owl turn\r'); await until(() => pending !== undefined, 'owned model request');
  const working = JSON.stringify(sprite()); await until(() => JSON.stringify(sprite()) !== working, 'working animation', 1800); capture('working'); pass('real model work drives a faster owl pose');
  pending(); pending = undefined; await until(() => text().includes('OWL_FIXTURE_DONE') && text().includes('ready'), 'model completion');
  await stop();
  await launch('light', true); capture('light'); const light = JSON.stringify(sprite()); await delay(2800);
  pass('reduced motion keeps a static white owl', JSON.stringify(sprite()) === light && sprite().flat().some(cell => cell[1] === 0xf6f7fa || cell[2] === 0xf6f7fa)); await stop();
  await launch('light-ansi', true); capture('light-ansi');
  pass('light ANSI keeps white plumage and dark details', sprite().flat().some(cell => cell[1] === 15) && sprite().flat().some(cell => cell[1] === 0 || cell[2] === 0)); await stop();
  await launch('dark', false, 20, 30); capture('narrow');
  pass('20-column terminal retains the whole owl and short title', text().includes('LiTcode v0.1.0') && text().includes('▄█▀█▄  ▄█▀█▄')); await stop();
  await launch('dark', false, 40, 10); capture('short');
  pass('short terminal uses title-only fallback', !/[▀▄█]/.test(text()) && text().includes('Welcome to LiTcode')); await stop();
  pass('one owned loopback model request and no paid calls', requests === 1);
  pass('all session locks released', fs.readdirSync(path.join(workspace, '.agent')).every(name => !name.endsWith('.lock')));
  const result = { checks, requests, paidUpstreamCalls: 0, captures, identity: captureIdentity(root) };
  fs.writeFileSync(path.join(output, 'w302-cli-result.json'), JSON.stringify(result));
  console.log(`PASS ${checks.length}/${checks.length}`); console.log(`IDENTITY ${result.identity.sha256}`);
} finally {
  pending?.();
  for (const owner of children) {
    if (owner.child.exitCode === null) { owner.child.kill('SIGTERM'); await Promise.race([owner.closed, delay(1000)]); if (owner.child.exitCode === null) owner.child.kill('SIGKILL'); }
    owner.screen.close();
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
