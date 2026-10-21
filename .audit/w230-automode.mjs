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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w230-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const settingsFile = path.join(user, 'settings.json');
fs.writeFileSync(settingsFile, JSON.stringify({ keep: { value: 'preserved' }, permissions: {} }));
const editor = path.join(temporary, 'editor.mjs');
const documentControl = path.join(temporary, 'document.json');
const editorLog = path.join(temporary, 'editor.jsonl');
fs.writeFileSync(editor, `import fs from 'node:fs';
const file = process.argv.at(-1);
fs.appendFileSync(process.env.W230_EDITOR_LOG, JSON.stringify({file, before:fs.readFileSync(file,'utf8')})+'\\n');
const control = JSON.parse(fs.readFileSync(process.env.W230_DOCUMENT, 'utf8'));
if (control.exit) process.exit(control.exit);
if (control.text !== undefined) fs.writeFileSync(file, control.text);
`);
fs.writeFileSync(documentControl, '{}');
const requests = [], classifierSystems = [];
function reply(response, tool) {
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  const send = (event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('message_start', { type: 'message_start', message: { id: `msg_${requests.length}`, type: 'message', role: 'assistant',
    model: 'fixture-model', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
  send('content_block_start', { type: 'content_block_start', index: 0, content_block: tool
    ? { type: 'tool_use', id: `toolu_${requests.length}`, name: 'write_file', input: {} } : { type: 'text', text: '' } });
  send('content_block_delta', { type: 'content_block_delta', index: 0, delta: tool
    ? { type: 'input_json_delta', partial_json: JSON.stringify({ path: 'marker', content: 'written by CLI' }) }
    : { type: 'text_delta', text: 'probe complete' } });
  send('content_block_stop', { type: 'content_block_stop', index: 0 });
  send('message_delta', { type: 'message_delta', delta: { stop_reason: tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
  send('message_stop', { type: 'message_stop' });
  response.end();
}
let mainCalls = 0;
let blockClassifier = false;
const denialReason = 'W230 preserves this denial';
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks));
    requests.push(body);
    if (JSON.stringify(body.system).includes('cc_automode_permissions')) {
      classifierSystems.push(body.system);
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      const send = (event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      send('message_start', { type: 'message_start', message: { id: 'classifier', type: 'message', role: 'assistant', model: body.model,
        content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
      send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
      send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: blockClassifier ? `<block>yes</block><reason>${denialReason}</reason>` : '<block>no</block>' } });
      send('content_block_stop', { type: 'content_block_stop', index: 0 });
      send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
      send('message_stop', { type: 'message_stop' }); response.end();
    } else reply(response, ++mainCalls % 2 === 1);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture-model', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false',
  VISUAL: `${process.execPath} ${editor}`, EDITOR: `${process.execPath} ${editor}`,
  W230_EDITOR_LOG: editorLog, W230_DOCUMENT: documentControl };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || key === 'TMUX' || key === 'STY') delete env[key];
const children = [];
const checks = [];
let active;
const screen = () => {
  const terminal = new TerminalScreen(200, 30);
  terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const lines = terminal.lines(); terminal.close();
  return lines.map(line => line.trimEnd()).join('\n');
};
const selected = () => /^Selected: (.*)$/m.exec(screen())?.[1]?.trim() ?? '';
const stored = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
async function until(predicate, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(70);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) {
  assert.ok(condition, `${label}\n${screen()}`);
  checks.push(label); console.log(`PASS ${label}`);
}
const send = data => active.child.stdin.write(data);
async function choose(match) {
  const matches = value => typeof match === 'string' ? value === match : match.test(value);
  for (let i = 0; i < 100; i++) {
    if (matches(selected())) { send('\r'); await delay(120); return; }
    const previous = selected(); send('\x1b[B');
    await until(() => selected() !== previous, `focus moved toward ${match}`, 3000);
  }
  throw new Error(`choice missing: ${match}\n${screen()}`);
}
async function launch() {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w226-wide.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive', '--permission-mode', 'auto'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => current.chunks.push(chunk));
  child.stderr.on('data', chunk => current.chunks.push(chunk));
  active = current; children.push(current);
  await until(() => screen().includes('· ready'), 'startup ready', 25000);
}
async function stop() {
  send('/exit\r');
  const code = await Promise.race([active.closed, delay(6000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
}
async function openAuto() {
  send('/permissions\r'); await until(() => screen().includes('Permissions') && screen().includes('Selected:'), 'permissions opened');
  await choose('Auto mode'); await until(() => screen().includes('[Auto mode]'), 'auto mode opened');
}
async function backToTab() {
  await until(() => selected() === 'Auto mode', 'returned to auto mode tab');
}
async function closePanel() {
  send('\x1b'); await until(() => !screen().includes('Selected:'), 'panel closed');
  await until(() => screen().includes('· ready'), 'session ready after settings');
}
try {
  await launch(); await openAuto();
  await choose('Add a new rule…'); await until(() => screen().includes('What kind of rule is this?'), 'section picker');
  pass('the add row opens the recovered four-section picker', /Soft allow/.test(selected()) && screen().includes('Hard deny'));
  await choose('Soft allow'); await until(() => screen().includes('Add soft allow rule'), 'add input');
  send('$defaults\r'); await until(() => screen().includes('is reserved'), 'validation error');
  pass('invalid input stays open and retains its draft');
  send('\x15Allow docs\r'); await backToTab();
  pass('adding the first rule writes the default splice and preserves unrelated fields',
    JSON.stringify(stored().autoMode.allow) === JSON.stringify(['$defaults', 'Allow docs']) && stored().keep.value === 'preserved');
  await choose(/^Soft allow\s+Allow docs$/); await until(() => screen().includes('Rule details'), 'details');
  await choose('Edit'); await until(() => screen().includes('Edit soft allow rule'), 'edit input');
  pass('edit starts with the existing text', screen().includes('Allow docs'));
  send('\x15Allow local docs\r'); await backToTab();
  pass('editing replaces the existing array entry', stored().autoMode.allow[1] === 'Allow local docs');
  await choose(/^Soft allow.*Built-in rules/); await until(() => screen().includes('Disable built-in rules for this section'), 'toggle action');
  await choose('Disable built-in rules for this section'); await backToTab();
  pass('disabling built-ins removes only the splice marker', JSON.stringify(stored().autoMode.allow) === JSON.stringify(['Allow local docs']));
  await choose(/^Soft allow.*Built-in rules/); await choose('Enable built-in rules for this section'); await backToTab();
  pass('enabling built-ins restores one splice marker', JSON.stringify(stored().autoMode.allow) === JSON.stringify(['$defaults', 'Allow local docs']));
  const beforeView = fs.readFileSync(settingsFile, 'utf8');
  await choose(/^Soft allow.*Built-in rules/); await choose('View in editor');
  await until(() => fs.existsSync(editorLog) && selected() === 'Disable built-in rules for this section', 'builtin export');
  const exported = JSON.parse(fs.readFileSync(editorLog, 'utf8').trim().split('\n').at(-1));
  pass('viewing builtin rules returns to the card without a settings write', fs.readFileSync(settingsFile, 'utf8') === beforeView
    && exported.before.includes('- Read-Only Operations') && fs.existsSync(exported.file));
  await choose('Cancel'); await backToTab();
  await choose(/^Soft allow\s+Allow local docs$/); await choose('Delete');
  await until(() => screen().includes('Delete auto mode rule?'), 'delete confirm');
  pass('delete confirmation defaults to No', selected() === 'No');
  await choose('No'); await until(() => screen().includes('Rule details'), 'cancel to details');
  pass('cancelling deletion preserves the rule', stored().autoMode.allow[1] === 'Allow local docs');
  await choose('Delete'); await choose('Yes'); await backToTab();
  pass('confirmed deletion persists and removes the rule row', JSON.stringify(stored().autoMode.allow) === JSON.stringify(['$defaults']) && !screen().includes('Soft allow          Allow local docs'));
  await choose(/^Environment/); await until(() => screen().includes('Replace the built-in environment?'), 'environment confirmation');
  pass('first environment replacement defaults to No', selected() === 'No');
  fs.writeFileSync(documentControl, JSON.stringify({ text: '### Host\nOwned staging fixture\n' }));
  await choose('Yes'); await backToTab();
  pass('the environment editor saves the document and prunes trailing newlines', JSON.stringify(stored().autoMode.environment) === JSON.stringify(['### Host', 'Owned staging fixture']));
  const workingFiles = fs.readFileSync(editorLog, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  pass('the external editor working file is released after the handoff', workingFiles.filter(entry => entry.file.includes('auto-mode-env-edit-')).every(entry => !fs.existsSync(entry.file)));
  await closePanel();
  send('write the marker\r');
  await until(() => fs.existsSync(path.join(workspace, 'marker')) && classifierSystems.length > 0 && mainCalls >= 2, 'classified tool effect', 25000);
  await until(() => screen().includes('· ready'), 'turn complete');
  pass('the next real tool call uses the saved environment in its classifier request', classifierSystems.some(system => JSON.stringify(system).includes('Owned staging fixture')));
  blockClassifier = true;
  send('make a denied write\r');
  await until(() => mainCalls >= 4 && screen().includes('· ready'), 'denied turn complete', 25000);
  await openAuto();
  await choose('Add a new rule…'); await choose('Soft deny');
  await until(() => screen().includes('Add soft deny rule'), 'rule input after denial');
  send('Keep review requests\r'); await backToTab(); await closePanel();
  await openAuto(); await choose('Recently denied');
  await until(() => screen().includes(denialReason), 'recent denial survives settings branch');
  pass('saving rules preserves the recent-denial store across configuration changes');
  await choose('Auto mode');
  await choose(/^Soft deny\s+Keep review requests$/); await choose('Edit');
  await until(() => screen().includes('Edit soft deny rule'), 'stale edit input');
  const externallyEdited = stored();
  externallyEdited.autoMode.soft_deny = ['$defaults', 'Rule changed externally'];
  fs.writeFileSync(settingsFile, JSON.stringify(externallyEdited));
  send('\x15Do not overwrite disk\r'); await backToTab();
  pass('a stale write preserves disk and refreshes the visible row', stored().autoMode.soft_deny[1] === 'Rule changed externally'
    && screen().includes('Rule changed externally') && !screen().includes('Soft deny           Keep review requests'));
  await closePanel(); await openAuto();
  pass('reopening after a failed write rereads the disk without config watching', screen().includes('Rule changed externally'));
  await closePanel();
  await stop(); await launch(); await openAuto();
  pass('a fresh process reads the saved environment document', screen().includes('Replaces the built-in default · from user settings · enter to edit'));
  fs.writeFileSync(documentControl, '{}');
  await choose(/^Environment/); await until(() => screen().includes('No changes detected'), 'unchanged editor recovery');
  pass('unchanged editor output offers recovery without overwriting the document', stored().autoMode.environment[1] === 'Owned staging fixture' && selected().startsWith('Reopen'));
  await choose('Cancel'); await backToTab();
  await closePanel(); await stop();
  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, identity: identity.sha256,
    inputs: identity.inputs.sha256, build: identity.build.sha256, classifierRequests: classifierSystems.length }, null, 2));
  console.log(`RESULT ${checks.length} checks; identity ${identity.sha256}; ${temporary}`);
} finally {
  for (const current of children) {
    if (current.child.exitCode === null && current.child.signalCode === null) {
      current.child.kill('SIGKILL'); await Promise.race([current.closed, delay(2000)]);
    }
  }
  await new Promise(resolve => server.close(resolve));
}
