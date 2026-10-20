import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync('/tmp/w221-ws-'));
const user = fs.realpathSync(fs.mkdtempSync('/tmp/w221-user-'));
const outside = fs.realpathSync(fs.mkdtempSync('/tmp/w221-out-'));
const outsideFile = path.join(outside, 'note.txt');
fs.writeFileSync(outsideFile, 'x\n');
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'base-model', LLM_BASE_URL: 'http://127.0.0.1:1', LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) {
  if (/^ANTHROPIC_/.test(key) || key === 'TMUX' || key === 'STY') delete env[key];
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (label, condition) => console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);

/** The pty is 90x30 (`.audit/w205-footer.exp`), read at the pty's own 90 columns. */
const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
const chunks = [];
child.stdout.on('data', chunk => chunks.push(chunk));
child.stderr.on('data', () => {});
const rows = () => {
  const screen = new TerminalScreen(90, 30);
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
child.stdin.write('/add-dir\r'); await delay(1200);
check('an empty argument prints the usage line', flat().includes('Usage: /add-dir <path>'));

child.stdin.write(`/add-dir ${workspace}\r`); await delay(1200);
check('the workspace itself is already the working directory',
  flat().includes(`${workspace} is already the current working directory.`));

child.stdin.write(`/add-dir ${path.join(outside, 'missing')}\r`); await delay(1200);
check('a missing path is reported as not found',
  flat().includes(`Path ${path.join(outside, 'missing')} was not found.`));

child.stdin.write(`/add-dir ${outsideFile}\r`); await delay(1200);
check('a file is refused with its parent as the suggestion',
  flat().includes(`${outsideFile} is not a directory. Did you mean to add the parent directory ${outside}?`));

child.stdin.write(`/add-dir ${outside}\r`); await delay(1500);
check('a real directory outside the workspace is added for the session',
  flat().includes(`Added ${outside} as a working directory for this session`));

child.stdin.write(`/add-dir ${outside}\r`); await delay(1200);
check('adding it twice reports it as already added',
  flat().includes(`${outside} is already added as a working directory.`));

child.stdin.write('/exit\r'); await delay(1200);
await stop();
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
fs.rmSync(outside, { recursive: true, force: true });
