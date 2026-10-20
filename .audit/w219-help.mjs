import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w219-ws-')));
const user = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w219-user-')));
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
const text = () => rows().join('\n');
const snap = label => { console.log('=====', label); for (const row of rows()) if (row.trim()) console.log(JSON.stringify(row)); };

async function stop() {
  if (child.exitCode === null && child.signalCode === null) {
    const closed = new Promise(resolve => child.once('close', resolve));
    child.kill('SIGKILL');
    await Promise.race([closed, delay(2000)]);
  }
}

await delay(2500);
child.stdin.write('/help\r'); await delay(1500);
const panel = text();
snap('after /help');
check('the command opens the Help panel', panel.includes('Help') && panel.includes('General'));
check('the tab row marks the open tab', panel.includes('[General]') && panel.includes('Custom commands'));
check('the general tab carries the intro line',
  panel.includes('Claude understands your codebase, makes edits with your permission, and executes commands'));
check('the shortcuts heading and the four composer sigils are drawn',
  panel.includes('Shortcuts') && panel.includes('! for shell mode') && panel.includes('/ for commands')
  && panel.includes('@ for file paths') && panel.includes('/btw for side question'));
check('the composer chords are drawn',
  panel.includes('double tap esc to clear input') && panel.includes('auto-accept edits')
  && panel.includes('toggle tasks') && panel.includes('for verbose output'));
check('a 30-row terminal is not the tall layout', panel.includes('/powerup') === false
  && panel.includes('report bugs or request features') === false);

// The dialog scrolls its body, which is how the recovered panel reaches its last rows too.
child.stdin.write('\u001b[6~'); await delay(800);
const scrolled = text();
snap('after PgDn');
check('the session chords are below the fold',
  scrolled.includes('to undo') && scrolled.includes('paste images') && scrolled.includes('switch model')
  && scrolled.includes('stash prompt') && scrolled.includes('edit in $EDITOR'));
check('the docs link is the footer',
  scrolled.includes('For more help: https://code.claude.com/docs/en/overview'));

// The chooser's rows are the tabs, so two steps down reach Custom commands.
child.stdin.write('\u001b[B\u001b[B\r'); await delay(1500);
const custom = text();
snap('after the custom tab');
check('the custom tab is reachable and reports its empty state',
  custom.includes('Browse custom commands') && custom.includes('No custom commands found'));
check('the tab row follows the selection', custom.includes('[Custom commands]'));

child.stdin.write('\u001b[A\r'); await delay(1500);
const commands = text();
snap('after the commands tab');
check('the commands tab lists the default commands by number',
  commands.includes('Browse default commands') && /1\. \/[a-z-]+ — /.test(commands));
check('the tab row follows back', commands.includes('[Commands]') && commands.includes('[Custom commands]') === false);

child.stdin.write('\u001b'); await delay(2000);
const dismissed = text();
snap('after Escape');
// The notice lands on the status row, which the footer's key hints share at this width.
check('Escape reports the recovered dismiss notice', dismissed.includes('Help dialog dismis'));
child.stdin.write('/exit\r'); await delay(1200);
await stop();
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
