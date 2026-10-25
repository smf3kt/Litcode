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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'status-sources-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
for (const directory of [workspace, userDir, path.join(workspace, '.harness')]) fs.mkdirSync(directory);
const pty = path.join(temporary, 'pty.exp');
fs.writeFileSync(pty, `set stty_init "rows 40 columns 180"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const baseline = process.argv.includes('--baseline'), checks = [], captures = {}, owners = [];
const user = path.join(userDir, 'settings.json'), project = path.join(workspace, '.harness/settings.json');
const local = path.join(workspace, '.harness/settings.local.json'), flag = path.join(temporary, 'flag.json');
const policy = path.join(temporary, 'policy.json');
let active, modelRequests = 0;
const gateway = http.createServer((_request, response) => { modelRequests++; response.writeHead(500); response.end('Unexpected fixture model request'); });
const frame = () => active.screen.lines().join('\n');
const send = text => active.child.stdin.write(text);
const ready = () => frame().includes('· ready') && !frame().includes('Session kind: interactive');
const journalFiles = () => fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
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
  const before = journalFilesSafe();
  const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8' };
  for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY', 'NO_COLOR'].includes(name)) delete env[name];
  Object.assign(env, { LLM_API_KEY: 'owned-fixture', LLM_BASE_URL: `http://127.0.0.1:${gateway.address().port}`,
    LLM_MODEL: 'fixture-sources', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' });
  const child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    ...(resume ? ['--resume', resume] : ['--user-dir', userDir, '--settings', flag, '--managed-settings', policy]),
    '--interactive', '--no-inherit-gateway'], { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const owner = { child, screen: new TerminalScreen(180, 40), stderr: '', id: resume,
    closed: new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); }) };
  active = owner; owners.push(owner);
  const decoder = new StringDecoder('utf8');
  child.stdout.on('data', chunk => owner.screen.write(decoder.write(chunk)));
  child.stderr.on('data', chunk => { owner.stderr += chunk.toString('utf8'); });
  await until(ready, 'CLI ready');
  owner.id ??= journalFiles().find(name => !before.includes(name))?.slice(0, -6);
  assert.ok(owner.id);
}
function journalFilesSafe() { return fs.existsSync(path.join(workspace, '.agent')) ? journalFiles() : []; }
async function stop() {
  send('/exit\r');
  assert.equal(await Promise.race([active.closed, delay(6000).then(() => 'timeout')]), 0, active.stderr);
  pass('CLI exits zero');
  pass('session locks release', fs.readdirSync(path.join(workspace, '.agent')).every(name => !name.endsWith('.lock')));
}
async function status(label, expected) {
  const before = journal(), files = journalFiles();
  send('/status\r'); await until(() => frame().includes('Session kind: interactive'), 'Status opens');
  captures[label] = frame();
  if (baseline) pass(`${label} old build omits Setting sources`, !frame().includes('Setting sources:'));
  else pass(`${label} setting sources`, active.screen.lines().some(line => line.trimEnd() === `Setting sources:${expected ? ` ${expected}` : ''}`));
  pass(`${label} preserves journal`, before.equals(journal()));
  pass(`${label} creates no session`, JSON.stringify(journalFiles()) === JSON.stringify(files));
  send('\x1b'); await until(ready, 'Status closes');
}
async function reload(fails = false) {
  const before = journalFiles(); send('/reload\r');
  await until(() => ready() && (fails ? frame().includes('error:') : journalFiles().length === before.length + 1), 'reload settles');
  if (!fails) active.id = journalFiles().find(name => !before.includes(name)).slice(0, -6);
  pass(fails ? 'failed reload keeps accepted session' : 'reload creates accepted configuration branch',
    fails ? journalFiles().length === before.length : journalFiles().length === before.length + 1);
}
try {
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  for (const file of [user, project, local, flag, policy]) fs.writeFileSync(file, '{}');
  await launch(); await status('empty', ''); await stop();
  fs.writeFileSync(user, JSON.stringify({ model: 'fixture-sources', preferredNotifChannel: 'notifications_disabled' }));
  fs.writeFileSync(project, JSON.stringify({ theme: 'dark' }));
  fs.writeFileSync(local, JSON.stringify({ prefersReducedMotion: true }));
  fs.writeFileSync(flag, JSON.stringify({ thinking: false }));
  fs.writeFileSync(policy, JSON.stringify({ spinnerTipsEnabled: false }));
  const all = 'User settings, Shared project settings, Project local settings, Command line arguments, Enterprise managed settings (file)';
  await launch(); const original = active.id, originalBytes = journal();
  await status('all-layers', all);
  if (!baseline) {
    fs.writeFileSync(project, '{}'); fs.writeFileSync(flag, '{}'); fs.writeFileSync(policy, '{}');
    await status('unaccepted-disk-change', all);
    await reload();
    const fewer = 'User settings, Project local settings';
    await status('accepted-reload', fewer);
    fs.writeFileSync(project, '{'); await reload(true); await status('failed-reload', fewer);
    pass('original journal stays unchanged', originalBytes.equals(fs.readFileSync(path.join(workspace, '.agent', `${original}.jsonl`))));
    await stop();
    fs.unlinkSync(flag); fs.unlinkSync(policy); fs.unlinkSync(user); fs.unlinkSync(local);
    await launch(original); await status('original-resume', all); await stop();
    pass('original resume does not reload broken settings', fs.readFileSync(project, 'utf8') === '{');
  } else await stop();
  pass('zero model requests', modelRequests === 0);
  console.log(JSON.stringify({ cli: 'passed', baseline, checks: checks.length, modelRequests, locksReleased: true, fixture: temporary }));
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
