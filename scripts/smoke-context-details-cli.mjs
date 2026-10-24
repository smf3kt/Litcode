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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'context-details-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
fs.mkdirSync(path.join(userDir, 'skills', 'inspect-fixture'), { recursive: true });
fs.writeFileSync(path.join(userDir, 'skills', 'inspect-fixture', 'SKILL.md'),
  '---\nname: inspect-fixture\ndescription: Inspect the owned context fixture.\n---\nUse only this local fixture.\n');
fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-context', thinking: false,
  prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled' }));
const pty = path.join(temporary, 'pty.exp');
fs.writeFileSync(pty, `set stty_init "rows 44 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const baseline = process.argv.includes('--baseline'), inline = process.argv.includes('--inline');
const headless = process.argv.includes('--headless'), screen = new TerminalScreen(120, 44);
assert.ok(!inline || !headless);
let child, exited, server, completions = 0, mcpRequests = 0, stdout = '', stderr = '';
const errors = [];
const frame = () => screen.lines().map(line => line.trimEnd()).join('\n');
const plain = () => (stdout + stderr).replace(/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '');
const journals = () => Object.fromEntries(fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'))
  .map(name => [name, fs.readFileSync(path.join(workspace, '.agent', name), 'utf8')]));
const send = value => child.stdin.write(value);
const ready = () => frame().includes('· ready') && !frame().includes('Context Usage');
async function until(check, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (!check()) {
    assert.ok(Date.now() < end, `${label}\n${frame()}`);
    assert.ok(child.exitCode === null && child.signalCode === null, `${label}: CLI exited`);
    await delay(30);
  }
}
try {
  server = http.createServer((req, res) => {
    void (async () => {
      if (req.url !== '/mcp') { completions++; res.writeHead(500).end(); return; }
      mcpRequests++;
      if (req.method === 'DELETE') { res.writeHead(204).end(); return; }
      let text = ''; for await (const chunk of req) text += chunk;
      const body = JSON.parse(text);
      const json = result => { res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result })); };
      if (body.method === 'initialize') {
        res.setHeader('Mcp-Session-Id', 'context-owned');
        json({ protocolVersion: '2025-06-18', capabilities: { tools: {} } });
      } else if (body.method === 'tools/list') json({ tools: [{ name: 'inspect', description: 'Owned context inspection.',
        inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } }] });
      else res.writeHead(202).end();
    })().catch(error => { errors.push(error.message); res.destroy(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  fs.mkdirSync(path.join(userDir, 'agents'));
  fs.writeFileSync(path.join(userDir, 'agents', 'reviewer.md'),
    '---\nname: context-reviewer\ndescription: Review the owned context fixture.\nmode: general\n---\nOwned agent definition.\n');
  fs.writeFileSync(path.join(workspace, 'AGENTS.md'), 'OWNED_PINNED_CONTEXT_INSTRUCTIONS\n');
  const settings = JSON.parse(fs.readFileSync(path.join(userDir, 'settings.json'), 'utf8'));
  settings.mcpServers = { owned: { type: 'http', url: `http://127.0.0.1:${server.address().port}/mcp` } };
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify(settings));
  const env = { ...process.env, TERM: 'xterm-256color' };
  for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY'].includes(name)) delete env[name];
  Object.assign(env, { LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture-context', LLM_AUTH: 'bearer',
    LLM_TOKEN_COUNTING: 'estimate', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` });
  const args = [path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--user-dir', userDir, '--interactive', '--no-inherit-gateway', ...(inline ? ['--no-tui'] : [])];
  child = headless ? spawn(process.execPath, args, { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] })
    : spawn('/usr/bin/expect', [pty, process.execPath, ...args],
      { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', text => { stdout += text; screen.write(text); });
  child.stderr.on('data', text => { stderr += text; screen.write(text); });
  await until(headless || inline ? () => plain().includes('/help for commands.') : ready, 'startup', 20000);
  const before = journals();
  send(headless ? '/context all\n' : inline ? '/context\r' : '/context all\r');
  if (headless) {
    await until(() => stdout.includes('inputTokens'), 'headless context JSON');
    const report = JSON.parse(stdout.trim());
    assert.equal(typeof report.inputTokens, 'number'); assert.equal(report.contextTokens, 1000000);
    assert.equal(Object.hasOwn(report, 'details'), false); assert.doesNotMatch(stdout, /Context Usage|inspect-fixture:/);
  } else if (inline) {
    await until(() => plain().includes('inspect-fixture:'), 'inline expanded details');
    assert.match(plain(), /Context Usage/); assert.match(plain(), /mcp__owned__inspect:/);
    assert.match(plain(), /context-reviewer:/); assert.match(plain(), /AGENTS\.md:/);
    assert.doesNotMatch(plain(), /\/context all to expand/);
  } else if (baseline) {
    await until(() => frame().includes('Unknown command') && ready(), 'baseline lacks /context all');
    assert.doesNotMatch(frame(), /Context Usage/);
  } else {
    await until(() => frame().includes('Context Usage'), 'expanded context');
    const first = frame(); send('\x1b[6~');
    await until(() => frame().includes('inspect-fixture'), 'expanded skill details');
    const expanded = first + '\n' + frame();
    assert.match(expanded, /mcp__owned__inspect:/);
    assert.match(expanded, /context-reviewer:/);
    assert.match(expanded, /AGENTS\.md:/);
    assert.match(expanded, /Skills/);
    send('\x1b'); await until(ready, 'close expanded context');
    send('/context\r');
    await until(() => frame().includes('Context Usage'), 'collapsed context');
    assert.doesNotMatch(frame(), /inspect-fixture:/);
    send('\x1b[6~'); await until(() => frame().includes('/context all to expand'), 'collapsed expansion hint');
    assert.match(frame(), /1 skill/);
    assert.doesNotMatch(frame(), /inspect-fixture:|context-reviewer:|mcp__owned__inspect:/);
    send('\x1b'); await until(ready, 'close collapsed context');
  }
  assert.deepEqual(journals(), before);
  send(headless ? '/exit\n' : '/exit\r');
  const code = await Promise.race([exited, delay(6000).then(() => 'timeout')]);
  assert.equal(code, 0, `exit ${code}\n${frame()}`);
  assert.equal(completions, 0); assert.deepEqual(errors, []);
  assert.ok(mcpRequests >= 3);
  assert.deepEqual(fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.lock')), []);
  console.log(JSON.stringify({ cli: 'passed', baseline, mode: headless ? 'headless' : inline ? 'inline' : 'fullscreen',
    expanded: !baseline && !headless, completions, mcpRequests, journalUnchanged: true, locksReleased: true, fixture: temporary }));
} finally {
  fs.writeFileSync(path.join(temporary, 'screen.txt'), frame());
  if (child?.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    await exited;
  }
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
  screen.close();
}
