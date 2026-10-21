import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

// The empty-state probe (w228-recent.mjs) cannot reach a live denial, so this one supplies the model
// itself: a Messages-API stub that answers the main loop with `write_file` calls and the classifier
// with a block verdict. The denial then travels the real path — authorize() -> classifyAutoAction ->
// the store — and the panel is asked to show it.
const DENIAL_REASON = 'The probe blocks this write';
const GRANT = 'Allowed marker: owned';
// The grant is the only message this product appends with `origin: {kind: 'human'}`, and
// `classifierTranscript` renders a human-origin message as `{"user":"  <text>"}` while every other
// origin gets the non-user label in front of the same text. Both the stub's verdict and the
// assertions below key on that exact rendering, so a grant appended with the wrong origin is a
// failure here rather than a silent pass.
const HUMAN_GRANT = `{"user":"  ${GRANT}"}`;
const NON_USER_LABEL = '[MESSAGE FROM NON-USER SOURCE - NOT USER INPUT]';
const mainCalls = [];
const classifierTranscripts = [];
let mainTurns = 0;

// The provider consumes `messages.stream`, so every answer is an SSE sequence: message_start, one
// content block, message_delta and message_stop.
const sse = (response, events) => {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const [event, data] of events) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  response.end();
};
const streamed = (response, { id, block, stopReason, json = false }) => sse(response, [
  ['message_start', { type: 'message_start', message: { id, type: 'message', role: 'assistant',
    model: 'probe-model', content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 1 } } }],
  ['content_block_start', { type: 'content_block_start', index: 0, content_block: block.start }],
  ['content_block_delta', { type: 'content_block_delta', index: 0, delta: json
    ? { type: 'input_json_delta', partial_json: block.text }
    : { type: 'text_delta', text: block.text } }],
  ['content_block_stop', { type: 'content_block_stop', index: 0 }],
  ['message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: 10 } }],
  ['message_stop', { type: 'message_stop' }],
]);

// The transcript text itself, not its JSON encoding: the assertions below read the rendered lines.
// A `tool_result` carries the tool's answer, which is where the denial travels back.
const blockText = block => {
  if (typeof block === 'string') return block;
  if (block.type === 'text') return block.text;
  if (block.type === 'tool_result') return blockText(block.content);
  return '';
};
const transcriptText = body => (body.messages ?? []).map(message =>
  typeof message.content === 'string' ? message.content
    : (message.content ?? []).map(blockText).join('\n')).join('\n');

const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* the client reports it */ }
    if (JSON.stringify(body.system ?? '').includes('cc_automode_permissions')) {
      const text = transcriptText(body);
      classifierTranscripts.push(text);
      streamed(response, { id: `msg_classifier_${classifierTranscripts.length}`,
        block: { start: { type: 'text', text: '' },
          text: text.includes(HUMAN_GRANT)
            ? '<block>no</block>\n<thinking>the user allowed this one</thinking>'
            : `<block>yes</block>\n<reason>${DENIAL_REASON}</reason>\n`
              + '<category>probe</category>\n<thinking>probe</thinking>' },
        stopReason: 'end_turn' });
      return;
    }
    mainCalls.push(body);
    mainTurns++;
    // Round 1 is blocked and ends the turn; round 3 is the retry the grant releases.
    if (mainTurns === 1 || mainTurns === 3) {
      streamed(response, { id: `msg_main_${mainTurns}`, stopReason: 'tool_use', json: true,
        block: { start: { type: 'tool_use', id: `toolu_probe_${mainTurns}`, name: 'write_file', input: {} },
          text: JSON.stringify({ path: 'marker', content: 'owned' }) } });
      return;
    }
    streamed(response, { id: `msg_main_${mainTurns}`, stopReason: 'end_turn',
      block: { start: { type: 'text', text: '' }, text: 'probe finished' } });
  });
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync('/tmp/w228-live-ws-'));
const user = fs.realpathSync(fs.mkdtempSync('/tmp/w228-live-user-'));
// No allow list and no ask rule: in auto mode `decideOnce` reaches its `ask` arm for a write, which
// is the only path that runs the classifier (an ask *rule* would set `floor` and skip it).
fs.writeFileSync(path.join(user, 'settings.json'),
  JSON.stringify({ permissions: {} }, null, 2) + '\n');

const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'probe-model', LLM_BASE_URL: `http://127.0.0.1:${port}`, LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) {
  if (/^ANTHROPIC_/.test(key) || key === 'TMUX' || key === 'STY') delete env[key];
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (label, condition, detail) => console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${condition ? '' : `\n${detail}`}`);
const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w226-wide.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user,
  '--interactive', '--permission-mode', 'auto'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
const chunks = [];
child.stdout.on('data', chunk => chunks.push(chunk));
child.stderr.on('data', () => {});
const flat = () => {
  const screen = new TerminalScreen(200, 30);
  screen.write(Buffer.concat(chunks).toString('utf8'));
  const lines = screen.lines();
  screen.close();
  return lines.map(row => row.replace(/\s+$/, '')).join('\n').split('\n').join('  ');
};
// Every wait below is on product state, never on a bare sleep: a late redraw then fails a check
// instead of silently changing what the check read.
const waitFor = async (predicate, budgetMs = 15000) => {
  for (let waited = 0; waited < budgetMs; waited += 150) { if (predicate()) return true; await delay(150); }
  return predicate();
};
const down = async (times) => { for (let index = 0; index < times; index++) { child.stdin.write('\u001b[B'); await delay(120); } };
const enter = () => child.stdin.write('\r');
const escape = () => child.stdin.write('\u001b');
const selected = () => (flat().split('Selected:')[1] ?? '').slice(0, 60);

await waitFor(() => flat().includes('· ready'), 20000);
child.stdin.write('write the marker');
await delay(300);
enter();
// The block, its PermissionDenied hook and the turn's end run through two model round trips.
await waitFor(() => mainCalls.length >= 2, 20000);
await waitFor(() => flat().includes('· ready'), 20000);
// The denial travels back to the model as the tool result, so the second main call carries it.
check('the denial is returned to the model as the tool result',
  mainCalls.length >= 2 && transcriptText(mainCalls[1]).includes(DENIAL_REASON),
  transcriptText(mainCalls[1] ?? {}));
check('the classifier ran on the real tool call',
  classifierTranscripts.length >= 1 && classifierTranscripts[0].includes('marker: owned')
  && classifierTranscripts[0].includes('write_file'),
  classifierTranscripts[0] ?? 'no classifier request');

child.stdin.write('/permissions');
await delay(300);
enter();
await waitFor(() => flat().includes('Commands recently denied by the auto mode classifier.'), 15000);
const listed = flat();
check('the panel opens on the recent tab and lists the live denial',
  listed.includes('[Recently denied]')
  && listed.includes('marker: owned')
  && listed.includes(DENIAL_REASON)
  && !listed.includes('No recent denials.'), listed);

// The tab strip is six rows of the dialog, so the denial is six rows below the opened tab.
await down(6);
check('the denial row is the focused row before the key is sent',
  selected().includes('marker: owned'), `Selected: ${selected()}`);
child.stdin.write('r');
await waitFor(() => flat().includes('(retry)'), 8000);
check('r marks the row for retry', flat().includes('(retry)'), flat());

// The classifier runs only for a non-read-only call in auto mode, so a classifier request that
// appears after this point is the product re-issuing the blocked call, not the stub repeating itself.
const beforeGrant = classifierTranscripts.length;
escape();
await waitFor(() => flat().includes('You may now retry this command if you would like.'), 15000);
const applied = flat();
check('the Esc apply reports the grant',
  applied.includes(`Permission granted for: marker: owned`), applied);
const retryTranscripts = classifierTranscripts.slice(beforeGrant);
check('the grant reaches the classifier as the user\'s own message, not as non-user content',
  retryTranscripts.some(entry => entry.includes(HUMAN_GRANT))
  && !retryTranscripts.some(entry => entry.includes(NON_USER_LABEL)),
  JSON.stringify(retryTranscripts.map(entry => entry.slice(0, 400))));
check('the retry turn re-issues the call and the approved write lands',
  await waitFor(() => fs.existsSync(path.join(workspace, 'marker')) && mainCalls.length >= 3, 20000),
  `marker: ${fs.existsSync(path.join(workspace, 'marker'))}, main calls: ${mainCalls.length}`);

// The retry arm reports the grant without touching the store; the approved arm removes the rows it
// approves. Reopening the panel is what separates the two.
child.stdin.write('/permissions');
await delay(300);
enter();
await waitFor(() => flat().includes('Commands recently denied by the auto mode classifier.'), 15000);
const reopened = flat();
check('the retry kept the denial in the store, which an approval would have removed',
  reopened.includes('[Recently denied]') && reopened.includes('marker: owned')
  && !reopened.includes('No recent denials.'), reopened);

child.stdin.write('\u001b'); await delay(600);
child.stdin.write('/exit\r'); await delay(1200);
if (child.exitCode === null && child.signalCode === null) {
  const closed = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGKILL');
  await Promise.race([closed, delay(2000)]);
}
server.close();
