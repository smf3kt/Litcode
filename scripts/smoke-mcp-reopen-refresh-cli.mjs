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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'mcp-reopen-refresh-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
let generation = 1, failTemplates = false, modelRequests = 0, gets = 0, deletes = 0;
const requests = [], streams = new Set();
let current;
const server = http.createServer((request, response) => {
  void (async () => {
    if (request.url !== '/mcp') { modelRequests++; response.writeHead(500).end('Unexpected model request'); return; }
    if (request.method === 'GET') {
      gets++; current = response; streams.add(response); response.on('close', () => streams.delete(response));
      requests.push({ method: 'GET', generation, resume: request.headers['last-event-id'] });
      response.writeHead(200, { 'content-type': 'text/event-stream' }); response.flushHeaders();
      response.write(`id: generation${generation}\nretry: 60\n\n`); return;
    }
    if (request.method === 'DELETE') { deletes++; response.writeHead(204).end(); return; }
    let text = ''; for await (const part of request) text += part;
    const message = JSON.parse(text); requests.push({ method: message.method, generation });
    const reply = result => response.writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
    if (message.method === 'initialize') {
      response.setHeader('Mcp-Session-Id', 'owned-reopen');
      reply({ protocolVersion: message.params.protocolVersion, capabilities: { resources: { listChanged: true } } });
    } else if (message.method === 'resources/list') reply({ resources: generation === 4 ? [] : [{ uri: `doc://generation${generation}`, name: `RESOURCE_${generation}` }] });
    else if (message.method === 'resources/templates/list') {
      if (failTemplates) response.writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: 'owned template failure' } }));
      else reply({ resourceTemplates: generation === 4 ? [] : [{ uriTemplate: `template://generation${generation}/{id}`, name: `TEMPLATE_${generation}` }] });
    } else response.writeHead(202).end();
  })().catch(() => response.destroy());
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-reopen', thinking: false,
  promptSuggestionEnabled: false, prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled',
  features: { mcpCatalog: true, mcpRecovery: true, mcpNotificationStream: true },
  mcpServers: { docs: { type: 'http', url: base + '/mcp' } } }));
const pty = path.join(temporary, 'terminal.exp');
fs.writeFileSync(pty, `set stty_init "rows 40 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8', HOME: temporary };
for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY', 'NO_COLOR'].includes(name)) delete env[name];
Object.assign(env, { LLM_API_KEY: 'fixture', LLM_BASE_URL: base, LLM_MODEL: 'fixture-reopen', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' });
const terminal = new TerminalScreen(120, 40);
const child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'),
  '--workspace', workspace, '--user-dir', user, '--interactive', '--no-inherit-gateway'],
{ cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
const closed = new Promise(resolve => child.once('close', resolve));
let errors = '';
child.stdout.setEncoding('utf8'); child.stdout.on('data', text => terminal.write(text));
child.stderr.setEncoding('utf8'); child.stderr.on('data', text => { errors += text; });
const screen = () => terminal.lines().join('\n');
const checks = [];
function pass(label, condition = true) { assert.ok(condition, `${label}\n${screen()}`); checks.push(label); console.log(`PASS ${label}`); }
async function until(predicate, label) {
  const end = Date.now() + 12000;
  while (!predicate()) { assert.ok(Date.now() < end, `${label}\n${errors}\n${screen()}`); assert.equal(child.exitCode, null); await delay(20); }
}
try {
  await until(() => screen().includes('? for shortcuts') && gets === 1, 'CLI ready');
  child.stdin.write('@docs'); await until(() => screen().includes('RESOURCE_1') && screen().includes('TEMPLATE_1'), 'initial catalog');
  pass('initial rows populate before stream recovery');
  const directory = path.join(workspace, '.agent');
  const journal = path.join(directory, fs.readdirSync(directory).find(name => name.endsWith('.jsonl')));
  const before = fs.readFileSync(journal);
  generation = 2; current.end(': remote close\n\n');
  await until(() => gets === 2, 'GET reopened');
  pass('reopen retains the last event id', requests.find(row => row.method === 'GET' && row.generation === 2)?.resume === 'generation1');
  await until(() => screen().includes('RESOURCE_2') && screen().includes('TEMPLATE_2'), 'missed catalog refreshed after reopen');
  pass('reopen refreshes the same draft without a server list notification', !screen().includes('RESOURCE_1'));
  generation = 3; failTemplates = true; current.end(': remote close\n\n');
  await until(() => screen().includes('RESOURCE_3'), 'partial reopened catalog');
  pass('failed template family retains accepted rows', screen().includes('TEMPLATE_2'));
  generation = 4; failTemplates = false; current.end(': remote close\n\n');
  await until(() => gets === 4 && !screen().includes('RESOURCE_3') && !screen().includes('TEMPLATE_2'), 'empty reopened catalog');
  pass('successful empty reopened catalogs remove rows');
  pass('recovery leaves journal bytes unchanged', before.equals(fs.readFileSync(journal)));
  pass('recovery sends zero model requests', modelRequests === 0);
  child.stdin.write('\x01\x0b/exit\r'); assert.equal(await Promise.race([closed, delay(6000).then(() => 'timeout')]), 0, errors);
  await until(() => streams.size === 0, 'GET cleanup');
  pass('exit releases streams, session and locks', deletes === 1 && fs.readdirSync(directory).every(name => !name.endsWith('.lock')));
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, gets, deletes, modelRequests, requests }, null, 2));
  console.log(`${checks.length} checks, ${gets} GETs, ${modelRequests} model requests, fixture ${temporary}`);
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    await Promise.race([closed, delay(1000)]);
    if (child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
  }
  terminal.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
