import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w216-ws-')));
const user = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w216-user-')));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'base-model', LLM_BASE_URL: 'http://127.0.0.1:1', LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || key === 'TMUX' || key === 'STY') delete env[key];

const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
const chunks = [];
child.stdout.on('data', chunk => chunks.push(chunk));
child.stderr.on('data', () => {});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const raw = () => Buffer.concat(chunks).toString('utf8');
// The pty is 90x30 (`.audit/w205-footer.exp`), so the screen matches it row for row.
const screenNow = () => { const screen = new TerminalScreen(90, 30); screen.write(raw()); return screen; };
const check = (label, condition) => console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
// A wrapped report spans screen rows, so the rows are read as one run of text.
const said = screen => screen.lines().join('');
/**
 * The banner is the rule `Mk` draws one row above the input box's own top border, so the
 * search starts at the pointer row and walks up rather than matching any row of dashes.
 */
function bannerRow(screen) {
  const lines = screen.lines();
  const pointer = lines.findIndex(row => row.startsWith('❯'));
  if (pointer < 2) return undefined;
  const border = lines[pointer - 1] ?? '';
  if (!/^─+$/.test(border.trim())) return undefined;
  const candidate = lines[pointer - 2] ?? '';
  if (!/^─+$/.test(candidate.trim())) return undefined;
  return { row: pointer - 2, color: screen.cell(4, pointer - 2)?.getFgColor() };
}
/** The dark theme's eight slots, so a pick is matched rather than merely being non-default. */
const SLOT_COLORS = [0xdc2626, 0x6a9bcc, 0x16a34a, 0xca8a04, 0x827dbd, 0xd97757, 0xc46686, 0x0891b2];
const snap = label => {
  console.log('=====', label);
  const screen = screenNow();
  for (const row of screen.lines()) if (row.trim()) console.log(JSON.stringify(row));
  screen.close();
};

await delay(2500);
{
  const screen = screenNow();
  check('a fresh composer draws no banner rule', bannerRow(screen) === undefined);
  screen.close();
}

child.stdin.write('/color red\r'); await delay(1200);
{
  const screen = screenNow();
  check('the reported line names the colour', said(screen).includes('Session color set to: red'));
  const banner = bannerRow(screen);
  check('the banner rule appears above the composer', banner !== undefined);
  // Dark theme `red_FOR_SUBAGENTS_ONLY` is rgb(220,38,38).
  check('the banner paints the colour slot, not the prompt border', banner?.color === 0xdc2626);
  snap('after /color red');
  screen.close();
}

child.stdin.write('/color teal\r'); await delay(1200);
{
  const screen = screenNow();
  check('an unknown name reports the list', said(screen).includes(
    'Invalid color "teal". Available colors: red, blue, green, yellow, purple, orange, pink, cyan, default'));
  check('the refused name leaves the banner alone', bannerRow(screen)?.color === 0xdc2626);
  screen.close();
}

child.stdin.write('/color default\r'); await delay(1200);
{
  const screen = screenNow();
  check('a reset word reports the cleared colour', said(screen).includes('Session color reset to default'));
  check('the banner rule is gone again', bannerRow(screen) === undefined);
  snap('after /color default');
  screen.close();
}

child.stdin.write('/color\r'); await delay(1200);
{
  const screen = screenNow();
  const banner = bannerRow(screen);
  check('a bare /color picks one and draws the banner', banner !== undefined);
  check('the pick is one of the eight slots', banner !== undefined && SLOT_COLORS.includes(banner.color));
  snap('after a bare /color');
  screen.close();
}

child.stdin.write('/color cyan\r'); await delay(1200);
child.stdin.write('/reload\r'); await delay(3000);
{
  const screen = screenNow();
  const banner = bannerRow(screen);
  check('a configuration reload carries the colour into the new session', banner?.color === 0x0891b2);
  snap('after /color cyan then /reload');
  screen.close();
}

child.stdin.write('/exit\r'); await delay(1200);
child.kill();
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
