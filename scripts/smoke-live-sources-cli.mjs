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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'live-sources-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
for (const directory of [workspace, userDir]) fs.mkdirSync(directory);
const pty = path.join(temporary, 'pty.exp'), policy = path.join(temporary, 'policy.json');
fs.writeFileSync(policy, '{}');
fs.writeFileSync(pty, `set stty_init "rows 40 columns 160"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const baseline = process.argv.includes('--baseline'), owners = [], captures = {}, checks = [];
let active, requests = 0;
const gateway = http.createServer((_req, res) => { requests++; res.writeHead(500); res.end('Unexpected model request'); });
const files = () => fs.existsSync(path.join(workspace, '.agent')) ? fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl')) : [];
const frame = () => active.screen.lines().join('\n');
const send = text => active.child.stdin.write(text);
const ready = () => frame().includes('· ready') && !frame().includes('Session kind: interactive');
const journal = () => fs.readFileSync(path.join(workspace, '.agent', `${active.id}.jsonl`));
function pass(label, condition = true) { assert.ok(condition, `${label}\n${frame()}`); checks.push(label); }
async function until(predicate, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (!predicate()) {
    assert.ok(Date.now() < end, `${label}\n${active.stderr}\n${frame()}`);
    assert.ok(active.child.exitCode === null && active.child.signalCode === null, `${label}: CLI exited\n${active.stderr}`);
    await delay(25);
  }
}
async function launch(resume) {
  const before = files(), env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8' };
  for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY', 'NO_COLOR'].includes(name)) delete env[name];
  Object.assign(env, { HOME: temporary, LLM_API_KEY: 'owned-fixture', LLM_BASE_URL: `http://127.0.0.1:${gateway.address().port}`,
    LLM_MODEL: 'fixture-live-sources', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' });
  const child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    ...(resume ? ['--resume', resume] : ['--user-dir', userDir, '--managed-settings', policy]), '--interactive', '--no-inherit-gateway'],
  { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const owner = { child, screen: new TerminalScreen(160, 40), stderr: '', id: resume,
    closed: new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); }) };
  active = owner; owners.push(owner);
  const decoder = new StringDecoder('utf8');
  child.stdout.on('data', chunk => {
    fs.appendFileSync(path.join(temporary, `cli-${owners.length}.ansi`), chunk);
    owner.screen.write(decoder.write(chunk));
  });
  child.stderr.on('data', chunk => { owner.stderr += chunk.toString('utf8'); });
  await until(ready, 'CLI ready');
  owner.id ??= files().find(file => !before.includes(file))?.slice(0, -6);
  assert.ok(owner.id);
}
async function status(label, expected) {
  const before = journal(), count = files().length;
  send('/status\r'); await until(() => frame().includes('Session kind: interactive'), 'Status opens');
  captures[label] = frame();
  pass(`${label} sources`, active.screen.lines().some(line => line.trimEnd() === `Setting sources:${expected ? ` ${expected}` : ''}`));
  pass(`${label} preserves journal`, before.equals(journal()));
  pass(`${label} preserves session count`, files().length === count);
  send('\x1b'); await until(ready, 'Status closes');
}
async function command(text, notice, branch = false) {
  const before = files(); send(text + '\r');
  await until(() => ready() && frame().includes(notice) && (!branch || files().length > before.length), text);
  if (branch) active.id = files().find(file => !before.includes(file)).slice(0, -6);
}
async function stop() {
  send('/exit\r');
  assert.equal(await Promise.race([active.closed, delay(6000).then(() => 'timeout')]), 0, active.stderr);
  pass('CLI exit releases locks', fs.readdirSync(path.join(workspace, '.agent')).every(file => !file.endsWith('.lock')));
}
try {
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  await launch(); const original = active.id, originalMetadata = journal().toString('utf8').split('\n')[0];
  await status('initial', '');
  await command('/autocompact 100000', '100000', true);
  pass('setting was actually written', JSON.parse(fs.readFileSync(path.join(userDir, 'settings.json'), 'utf8')).compactAt === 100000);
  if (baseline) {
    await status('stale-after-save', ''); await stop();
  } else {
    await status('after-save', 'User settings');
    await command('/autocompact auto', 'Auto-compact', true);
    pass('last setting was removed', !Object.hasOwn(JSON.parse(fs.readFileSync(path.join(userDir, 'settings.json'), 'utf8')), 'compactAt'));
    await status('after-remove', '');
    await command('/theme dark', 'Theme: dark', true); await status('theme-save', 'User settings');
    const saved = active.id;
    fs.writeFileSync(path.join(userDir, 'settings.json'), '{');
    await command('/theme light', 'error:'); await status('failed-write', 'User settings');
    pass('failed write creates no configuration branch', active.id === saved);
    pass('failed write leaves disk bytes untouched', fs.readFileSync(path.join(userDir, 'settings.json'), 'utf8') === '{');
    pass('original metadata stays fixed', fs.readFileSync(path.join(workspace, '.agent', `${original}.jsonl`), 'utf8').split('\n')[0] === originalMetadata);
    await stop();
    // Interactive startup reads the user settings file for display preferences; a repaired empty
    // document lets both resumes run while their pinned source views stay authoritative.
    fs.writeFileSync(path.join(userDir, 'settings.json'), '{}');
    await launch(saved); await status('saved-branch-resume', 'User settings'); await stop();
    await launch(original); await status('original-resume', ''); await stop();
    pass('resumes keep their pinned views over an empty disk document',
      fs.readFileSync(path.join(userDir, 'settings.json'), 'utf8') === '{}');
  }
  pass('zero model requests', requests === 0);
  console.log(JSON.stringify({ cli: 'passed', baseline, checks: checks.length, modelRequests: requests, locksReleased: true, fixture: temporary }));
} finally {
  fs.writeFileSync(path.join(temporary, 'captures.json'), JSON.stringify(captures, null, 2));
  for (const owner of owners) {
    if (owner.child.exitCode === null && owner.child.signalCode === null) {
      try { process.kill(-owner.child.pid, 'SIGKILL'); } catch { owner.child.kill('SIGKILL'); }
      await owner.closed;
    }
    owner.screen.close();
  }
  gateway.closeAllConnections(); await new Promise(resolve => gateway.close(resolve));
}
