import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w220-ws-')));
const user = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w220-user-')));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'base-model', LLM_BASE_URL: 'http://127.0.0.1:1', LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) {
  if (/^ANTHROPIC_/.test(key) || key === 'TMUX' || key === 'STY') delete env[key];
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (label, condition) => console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);

/** The pty is 90x30 (`.audit/w205-footer.exp`), read at 120 columns. */
const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
const chunks = [];
child.stdout.on('data', chunk => chunks.push(chunk));
child.stderr.on('data', () => {});
const rows = () => {
  const screen = new TerminalScreen(120, 30);
  screen.write(Buffer.concat(chunks).toString('utf8'));
  const lines = screen.lines();
  screen.close();
  return lines;
};
/** A report longer than the pty is hard-wrapped mid-token, so rows are rejoined before matching. */
const flat = () => rows().join('\n').split('\n').map(row => row.replace(/\s+$/, '')).join('');

async function stop() {
  if (child.exitCode === null && child.signalCode === null) {
    const closed = new Promise(resolve => child.once('close', resolve));
    child.kill('SIGKILL');
    await Promise.race([closed, delay(2000)]);
  }
}

await delay(2500);
child.stdin.write('/tui\r'); await delay(1200);
check('an empty argument reports the current renderer and the usage line',
  flat().includes('Current renderer: fullscreen. Usage: /tui <default|fullscreen>'));

child.stdin.write('/tui fullscreen\r'); await delay(1200);
check('the current renderer is reported as already in use',
  flat().includes('Already using the fullscreen renderer.'));

child.stdin.write('/tui bogus\r'); await delay(1200);
check('an unknown word is quoted back with the usage line',
  flat().includes('Unknown renderer "bogus". Usage: /tui <default|fullscreen>'));

child.stdin.write('/tui default\r'); await delay(1200);
check('the classic renderer is refused without changing anything',
  flat().includes('Cannot switch renderers — this build draws only the fullscreen renderer. Nothing was changed.'));

child.stdin.write('/exit\r'); await delay(1200);
await stop();
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
