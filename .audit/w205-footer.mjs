import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'w205f-ws-'));
const user = fs.mkdtempSync(path.join(os.tmpdir(), 'w205f-user-'));
fs.mkdirSync(path.join(workspace, '.harness'), { recursive: true });
fs.writeFileSync(path.join(workspace, '.harness', 'settings.json'),
  JSON.stringify({ permissions: { mode: 'plan', allow: [], deny: [] } }));

const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture/probe', LLM_BASE_URL: 'http://127.0.0.1:9',
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)) delete env[key];

const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
const chunks = [];
child.stdout.on('data', chunk => { chunks.push(chunk); });
child.stderr.on('data', () => {});
await new Promise(resolve => setTimeout(resolve, 2000));
child.kill('SIGKILL');
await new Promise(resolve => child.once('close', resolve));
const raw = Buffer.concat(chunks).toString('utf8');

// The chip is painted in its theme slot, so the text turns up between SGR runs.
const plain = raw.replace(/\u001b\[[0-9;]*m/g, '');
const screen = new TerminalScreen(90, 30); screen.write(raw);
const rows = screen.lines();
console.log('TAIL', JSON.stringify(rows.filter(l => l.trim()).slice(-2)));
screen.close();
console.log('footer chip:', rows.some(row => row.includes('⏸ plan mode on')));
console.log('idle hint  :', rows.some(row => row.includes('ctrl+o transcript')));

fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
