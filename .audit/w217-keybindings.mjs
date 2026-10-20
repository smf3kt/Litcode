import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w217-ws-')));
const user = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w217-user-')));
// A stand-in editor: it records the argument it was handed and whether the file existed at
// spawn time, then exits 0 without writing. `true` alone would prove the spawn, not the path.
const stubDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w217-stub-')));
const witness = path.join(stubDir, 'witness.txt');
const editor = path.join(stubDir, 'editor-stub.sh');
fs.writeFileSync(editor, `#!/bin/sh\nprintf '%s %s\\n' "$1" "$([ -f "$1" ] && echo present || echo missing)" >> "$WITNESS"\n`);
fs.chmodSync(editor, 0o755);

const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'base-model', LLM_BASE_URL: 'http://127.0.0.1:1', LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false', WITNESS: witness,
  VISUAL: editor, EDITOR: editor };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || key === 'TMUX' || key === 'STY') delete env[key];

const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
const chunks = [];
child.stdout.on('data', chunk => chunks.push(chunk));
child.stderr.on('data', () => {});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const raw = () => Buffer.concat(chunks).toString('utf8');
const screenNow = () => { const screen = new TerminalScreen(90, 30); screen.write(raw()); return screen; };
const check = (label, condition) => console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
// A long report wraps across rows, so the rows are read as one run of text.
const said = screen => screen.lines().join('');
const witnessLines = () => (fs.existsSync(witness) ? fs.readFileSync(witness, 'utf8').trim().split('\n') : []);
const snap = label => {
  console.log('=====', label);
  const screen = screenNow();
  for (const row of screen.lines()) if (row.trim()) console.log(JSON.stringify(row));
  screen.close();
};

const file = path.join(user, 'keybindings.json');
const NON_REBINDABLE = ['\r', '\n', '\u0003', '\u0004', '\u007f', '\b', '\u001b', '\u0009'];

await delay(2500);
check('a fresh user directory has no keybindings file', fs.existsSync(file) === false);

child.stdin.write('/keybindings\r'); await delay(2000);
{
  const screen = screenNow();
  check('the first run reports the template as created',
    said(screen).includes(`Created ${file} with template. Opened in your editor.`));
  snap('after the first /keybindings');
  screen.close();
  check('the editor ran on the reported path', witnessLines()[0] === `${file} present`);
  check('the file was written before the editor was spawned', fs.existsSync(file));
  check('the file is private to its owner', (fs.statSync(file).mode & 0o777) === 0o600);
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('the template parses as a flat sequence-to-command map',
    Object.values(written).every(value => typeof value === 'string'));
  check('the template offers the editor key', written['\u0007'] === 'externalEditor');
  check('the template omits the keys a terminal cannot deliver',
    NON_REBINDABLE.every(sequence => sequence in written === false));
  check('the template is the full default set', Object.keys(written).length > 30);
  fs.writeFileSync(path.join(stubDir, 'first.json'), JSON.stringify(written));
}

child.stdin.write('/keybindings\r'); await delay(2000);
{
  const screen = screenNow();
  const text = said(screen);
  // The transcript is cumulative, so both reports stand on screen at once. Only the second
  // carries the file path after "Opened", which is what separates the arms.
  const occurrences = (needle) => text.split(needle).length - 1;
  check('the second run reports the file as opened', occurrences(`Opened ${file} in your editor.`) === 1);
  check('the second run does not claim to have created it',
    occurrences(`Created ${file} with template.`) === 1);
  screen.close();
  check('the editor ran a second time', witnessLines().length === 2);
  check('an existing file is left byte for byte alone',
    JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) ===
      fs.readFileSync(path.join(stubDir, 'first.json'), 'utf8'));
}

child.stdin.write('/exit\r'); await delay(1200);
child.kill();
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
fs.rmSync(stubDir, { recursive: true, force: true });
