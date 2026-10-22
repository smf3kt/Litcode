import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w232-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(user, 'agents'));
for (let number = 2; number <= 12; number++) {
  const id = String(number).padStart(2, '0');
  fs.writeFileSync(path.join(user, 'agents', `${id}.md`),
    `---\nname: agent-${id}\ndescription: Local fixture ${id}\nmodel: model-${id}\n---\nFixture agent.\n`);
}
const wrapper = path.join(temporary, 'pty.exp');
fs.writeFileSync(wrapper, `set stty_init "rows $env(W232_ROWS) columns $env(W232_COLUMNS)"\nsource ${path.join(root, 'scripts/pty-cli.exp')}\n`);
const hookLog = path.join(temporary, 'hooks.jsonl'), hookScript = path.join(temporary, 'hook.mjs');
fs.writeFileSync(hookScript, `import fs from 'node:fs';\nlet input='';\nfor await (const chunk of process.stdin) input+=chunk;\nconst event=JSON.parse(input);\nfs.appendFileSync(${JSON.stringify(hookLog)},JSON.stringify({event:event.hook_event_name,from:event.from_model,to:event.to_model})+'\\n');\n`);
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const hook = { type: 'command', command: `${quote(process.execPath)} ${quote(hookScript)}` };
const settingsFile = path.join(user, 'settings.json');
fs.writeFileSync(settingsFile, JSON.stringify({ model: 'model-01', effort: 'medium', keep: 'preserved',
  prefersReducedMotion: true, hooks: { PreModelSwitch: [hook], PostModelSwitch: [hook] } }));
const stored = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
const hooks = () => fs.existsSync(hookLog)
  ? fs.readFileSync(hookLog, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
const requests = [], children = [], checks = [], captures = {};
let active;
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    const send = (event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('message_start', { type: 'message_start', message: { id: `msg_${requests.length}`, type: 'message',
      role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 0 } } });
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    send('content_block_delta', { type: 'content_block_delta', index: 0,
      delta: { type: 'text_delta', text: `response ${requests.length}` } });
    send('content_block_stop', { type: 'content_block_stop', index: 0 });
    send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
    send('message_stop', { type: 'message_stop' }); response.end();
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || ['LLM_MODEL', 'LLM_EFFORT', 'TMUX', 'STY'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(active.columns, active.rows);
  terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const lines = terminal.lines(); terminal.close();
  return lines.map(line => line.trimEnd()).join('\n');
};
const openPicker = () => /^Select model$/m.test(screen());
const ready = () => screen().includes('· ready') || (active.columns < 40 && !openPicker()
  && /^❯\s*$/mu.test(screen()) && screen().includes('⏸ manual mode on'));
const focus = () => /^❯\s+(\d+)\.\s+(model-\d+)/mu.exec(screen());
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(60);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) {
  assert.ok(condition, `${label}\n${screen()}`); checks.push(label); console.log(`PASS ${label}`);
}
async function launch(columns = 90, rows = 30) {
  const child = spawn('/usr/bin/expect', [wrapper, process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env: { ...env, W232_COLUMNS: String(columns), W232_ROWS: String(rows) }, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, columns, rows, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => current.chunks.push(chunk));
  child.stderr.on('data', chunk => current.chunks.push(chunk));
  active = current; children.push(current);
  await until(() => ready(), 'startup ready', 25000);
}
async function stop() {
  send('/exit\r');
  const code = await Promise.race([active.closed, delay(6000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
}
async function open() {
  send('/model\r'); await until(() => openPicker() && /^❯\s+\d+\./mu.test(screen()), 'picker open');
}
async function accept(key, model) {
  const before = hooks().length;
  send(key);
  await until(() => !openPicker() && ready() && hooks().length === before + 2, 'selection applied');
  assert.deepEqual(hooks().slice(-2).map(event => [event.event, event.to]),
    [['PreModelSwitch', model], ['PostModelSwitch', model]]);
}
async function turn(model, effort) {
  const before = requests.length;
  send(`model probe ${before + 1}\r`);
  await until(() => requests.length === before + 1 && screen().includes(`response ${before + 1}`) && ready(), 'turn finished');
  assert.equal(requests.at(-1).model, model);
  assert.equal(requests.at(-1).output_config?.effort, effort);
}
async function press(value, model) {
  send(value); await until(() => focus()?.[2] === model, `focus ${model}`);
}
try {
  await launch(); await open();
  pass('numbered model rows open with the current tick, caption and effort guide',
    focus()?.[2] === 'model-01' && screen().includes('model-01 ✔') && screen().includes('Current model')
    && screen().includes('◐ medium effort ←/→ to adjust') && screen().includes('… +4 models')
    && !screen().includes('Selected:') && !screen().includes('Other'));
  captures.open = screen();
  const initial = fs.readFileSync(settingsFile, 'utf8');
  send('/abc\t\x1b[200~s9\x1b[201~'); await delay(100);
  pass('closed search, Tab and pasted selection keys leave the modal unchanged',
    openPicker() && focus()?.[2] === 'model-01' && screen().includes('… +4 models'));
  await press('\x1b[6~', 'model-09');
  pass('PageDown advances by the eight visible model rows', focus()?.[1] === '9' && screen().includes('… +3 models'));
  await press('\x1b[5~', 'model-01');
  await press('\x1b[F', 'model-12');
  await press('\x1b[B', 'model-01');
  await press('\x1b[A', 'model-12');
  await press('\x1b[H', 'model-01');
  await press('j', 'model-02'); await press('k', 'model-01');
  await press('\x0e', 'model-02'); await press('\x10', 'model-01');
  pass('Home, End, wrap, j/k and control navigation agree with the source list');
  send('\x1b[C\x1b[C\x1b[C'); await until(() => screen().includes('◈ max effort'), 'max preview');
  captures.max = screen();
  pass('preview keeps settings bytes, hooks and requests unchanged',
    fs.readFileSync(settingsFile, 'utf8') === initial && hooks().length === 0 && requests.length === 0);
  send('\x1b'); await until(() => !openPicker() && ready(), 'cancel closed');
  pass('Escape discards both row and effort preview', fs.readFileSync(settingsFile, 'utf8') === initial && hooks().length === 0);
  await open(); await accept('9', 'model-09');
  pass('numeric acceptance writes the selected model default and preserves other settings',
    stored().model === 'model-09' && stored().effort === 'medium' && stored().keep === 'preserved');
  await turn('model-09', 'medium'); pass('an untouched effort keeps the existing level in the actual request');
  await open();
  send('\x1b[C\x1b[C\x1b[C'); await until(() => screen().includes('◈ max effort'), 'max adjusted');
  await press('\x1b[B', 'model-02');
  pass('manual max effort survives moving to another model', screen().includes('◈ max effort'));
  const beforeSessionOnly = fs.readFileSync(settingsFile, 'utf8');
  await accept('s', 'model-02');
  pass('s accepts without changing the stored defaults', fs.readFileSync(settingsFile, 'utf8') === beforeSessionOnly);
  await turn('model-02', 'max'); pass('session model and manual effort reach the next request together');
  await open(); await accept('\r', 'model-02');
  pass('Enter on the current model promotes a session choice to the saved default', stored().model === 'model-02');
  assert.deepEqual(hooks().slice(-2).map(event => [event.from, event.to]), [['model-02', 'model-02'], ['model-02', 'model-02']]);
  pass('same-model Enter still runs the pre and post switch hooks');
  await stop(); await launch(); await turn('model-02', 'medium');
  pass('fresh CLI restores the selected model and the independent saved effort');
  await open();
  const target = screen().split('\n').findIndex(row => /^. \d+\.\s+model-03(?: |$)/u.test(row));
  assert.ok(target >= 0, 'third model is visible');
  send(`\x1b[<0;6;${target + 1}M`); await delay(100);
  pass('a pointer press alone leaves the selection pending', openPicker());
  const beforeClick = hooks().length;
  send(`\x1b[<0;6;${target + 1}m`);
  await until(() => !openPicker() && hooks().length === beforeClick + 2 && ready(), 'pointer selection applied');
  pass('a release on the same painted row accepts and saves the clicked model', stored().model === 'model-03');
  await turn('model-03', 'medium'); pass('the clicked model reaches the next request');
  await stop(); await launch(); await turn('model-03', 'medium');
  pass('the pointer-selected model persists across a new process');
  await stop();
  for (const columns of [20, 24]) {
    await launch(columns, 24);
    await turn('model-03', 'medium');
    const beforeReset = hooks().length;
    send('/model model-01\r');
    await until(() => stored().model === 'model-01' && hooks().length === beforeReset + 2 && ready(), 'reset narrow fixture roster');
    await open();
    send('\x1b[F'); await until(() => /^❯ 12\./mu.test(screen()), 'narrow last model visible');
    captures[`narrow${columns}`] = screen();
    pass(`${columns}-column CLI keeps the last focused model visible`, /^❯ 12\./mu.test(screen()));
    const last = screen().split('\n').findIndex(row => /^❯ 12\./u.test(row));
    const before = hooks().length;
    send(`\x1b[<0;6;${last + 1}M\x1b[<0;6;${last + 1}m`);
    await until(() => !openPicker() && hooks().length === before + 2 && ready(), 'narrow pointer accepted');
    assert.equal(stored().model, 'model-12');
    await turn('model-12', 'medium');
    pass(`${columns}-column click selects the painted model and reaches its request`);
    send('/model model-03\r');
    await until(() => stored().model === 'model-03' && hooks().length === before + 4 && ready(), 'restore fixture model');
    await stop();
  }
  const sessions = path.join(workspace, '.agent');
  assert.ok(fs.readdirSync(sessions).some(file => file.endsWith('.jsonl')), 'compiled sessions exist');
  const lockPaths = fs.readdirSync(sessions).filter(file => file.endsWith('.jsonl.lock'));
  pass('all compiled CLI processes exit cleanly and release their session locks',
    children.every(item => item.child.exitCode === 0) && lockPaths.length === 0);
  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures, identity: identity.sha256,
    inputs: identity.inputs.sha256, validation: identity.validation.sha256, build: identity.build.sha256,
    requests: requests.map(body => ({ model: body.model, effort: body.output_config?.effort })), hooks: hooks() }, null, 2));
  console.log(`RESULT ${checks.length} checks; identity ${identity.sha256}; ${temporary}`);
} finally {
  if (active) fs.writeFileSync(path.join(temporary, 'screen.txt'), screen());
  fs.writeFileSync(path.join(temporary, 'captures.json'), JSON.stringify(captures, null, 2));
  for (const current of children) {
    if (current.child.exitCode === null && current.child.signalCode === null) {
      current.child.kill('SIGKILL'); await Promise.race([current.closed, delay(2000)]);
    }
  }
  await new Promise(resolve => server.close(resolve));
}
