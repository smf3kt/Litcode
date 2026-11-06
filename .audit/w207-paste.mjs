import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'w207p-ws-'));
const user = fs.mkdtempSync(path.join(os.tmpdir(), 'w207p-user-'));
fs.mkdirSync(path.join(workspace, '.harness'), { recursive: true });

const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture/probe', LLM_BASE_URL: 'http://127.0.0.1:9',
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)) delete env[key];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run(args, drive) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, ...args],
    { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const chunks = [];
  child.stdout.on('data', chunk => chunks.push(chunk));
  child.stderr.on('data', () => {});
  await delay(1500);
  await drive(child);
  child.kill('SIGKILL');
  await new Promise(resolve => child.once('close', resolve));
  const raw = Buffer.concat(chunks).toString('utf8');
  const screen = new TerminalScreen(100, 30); screen.write(raw);
  const rows = screen.lines(); screen.close();
  return { rows, raw };
}

const lines = Array.from({ length: 60 }, (_, i) => `paste line ${i} ${'x'.repeat(20)}`);
const paste = '\u001b[200~' + lines.join('\n') + '\u001b[201~';
await run(['--interactive'], async child => {
  child.stdin.write(paste); await delay(600);
  child.stdin.write('\r'); await delay(1200);
});
const cache = path.join(user, 'paste-cache');
const stored = fs.existsSync(cache) ? fs.readdirSync(cache) : [];
console.log('paste files:', JSON.stringify(stored));
const historyFile = path.join(user, 'history.jsonl');
console.log('history exists:', fs.existsSync(historyFile));
if (fs.existsSync(historyFile)) {
  const rows = fs.readFileSync(historyFile, 'utf8').trim().split('\n');
  console.log('HISTORY', JSON.stringify(rows.map(r => { try { const e = JSON.parse(r); return {display: e.display, pastes: e.pastedContents, keys: Object.keys(e)}; } catch { return r.slice(0, 120); } })));
}
for (const file of stored) fs.rmSync(path.join(cache, file));
console.log('deleted stored paste files:', stored.length);

const text = rows => rows.join('\n');
await run(['--interactive'], async child => {
  child.stdin.write('\u001b[A'); await delay(500);
  child.stdin.write('\r'); await delay(900);
}).then(({ rows }) => {
  const frame = text(rows);
  console.log('DRAFT ROW', JSON.stringify(rows.filter(row => row.includes('Pasted text')).map(row => row.trim())));
  console.log('TAIL', JSON.stringify(rows.filter(row => row.trim()).slice(-4)));
  console.log('notice (100-col footer):', frame.includes('Pasted text #1 is'));
  console.log('user row sent:', /^\s*>\s*\[Pasted text #1 \+59 lines\]\s*$/m.test(frame));
});

fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
