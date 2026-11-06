import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'agent-details-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-parent', thinking: false,
  prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled' }));
fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'OWNED_AGENT_FILE');
const pty = path.join(temporary, 'pty.exp');
fs.writeFileSync(pty, `set stty_init "rows 40 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const requests = [], held = new Map();
const foreground = process.argv.includes('--foreground-progress');
const lateProgress = process.argv.includes('--late-progress');
if (lateProgress) {
  fs.mkdirSync(path.join(workspace, '.harness/skills/fixture'), { recursive: true });
  fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ features: { skillInlineCommands: true } }));
  fs.writeFileSync(path.join(workspace, '.harness/skills/fixture/SKILL.md'), '---\nname: fixture\ndescription: Owned shell fixture\n---\n!`echo $$ > shell.pid; touch started; sleep 30; touch finished`\n');
}
const unknownStop = process.argv.includes('--parallel-unknown-stop');
const parallelStop = process.argv.includes('--parallel-stop') || unknownStop;
const unknownId = randomUUID();
let firstId;
const screen = new TerminalScreen(120, 40);
let child, exited, server;
const frame = () => screen.lines().map(line => line.trimEnd()).join('\n');
const send = value => child.stdin.write(value);
const ready = () => frame().includes('· ready') && !frame().includes('Prompt') && !frame().split('\n').includes('Background');
const until = async (check, label, timeout = 6000) => {
  const end = Date.now() + timeout;
  while (!check()) { assert.ok(Date.now() < end, `${label}\n${frame()}`);
    assert.ok(child.exitCode === null && child.signalCode === null, label); await delay(30); }
};
function respond(res, body, block, index) {
  const events = [
    { type: 'message_start', message: { id: `agent-details-${index}`, type: 'message', role: 'assistant', model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: block.type === 'text' ? { type: 'text', text: '' } : { ...block, input: {} } },
    { type: 'content_block_delta', index: 0, delta: block.type === 'text' ? { type: 'text_delta', text: block.text }
      : { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: block.type === 'text' ? 'end_turn' : 'tool_use', stop_sequence: null }, usage: { output_tokens: 25 } },
    { type: 'message_stop' },
  ];
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
}
function respondParallel(res, body, blocks, index) {
  const events = [{ type: 'message_start', message: { id: `agent-details-${index}`, type: 'message', role: 'assistant', model: body.model,
    content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 0 } } }];
  for (const [i, block] of blocks.entries()) events.push(
    { type: 'content_block_start', index: i, content_block: { ...block, input: {} } },
    { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } },
    { type: 'content_block_stop', index: i });
  events.push({ type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 25 } }, { type: 'message_stop' });
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
}
try {
  server = http.createServer((req, res) => {
    const chunks = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const index = requests.length, latest = body.messages.at(-1)?.content;
      if (parallelStop && body.model === 'fixture-parent' && Array.isArray(latest)) {
        for (const block of latest) if (block.type === 'tool_result' && typeof block.content === 'string') {
          try { const value = JSON.parse(block.content); if (typeof value.id === 'string') firstId ??= value.id; } catch {}
        }
      }
      if (body.model === 'fixture-child') {
        const name = body.messages.some(message => message.content === 'AGENT_ORIGINAL_PROMPT_SECOND') ? 'second' : 'first';
        if (typeof latest === 'string') respond(res, body, { type: 'tool_use', id: `read-${name}`, name: 'read_file', input: { path: 'fixture.txt' } }, index);
        else if (lateProgress && name === 'second') {
          held.set('second', {});
          respond(res, body, { type: 'tool_use', id: 'skill-second', name: 'skill', input: { name: 'fixture' } }, index);
        }
        else {
          assert.match(JSON.stringify(latest), /OWNED_AGENT_FILE/);
          const event = value => res.write(`event: ${value.type}\ndata: ${JSON.stringify(value)}\n\n`);
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          event({ type: 'message_start', message: { id: `agent-details-${index}`, type: 'message', role: 'assistant', model: body.model,
            content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 0 } } });
          event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
          held.set(name, {
            closed: false,
            text: text => event({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }),
            finish() {
              event({ type: 'content_block_stop', index: 0 });
              event({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 25 } });
              event({ type: 'message_stop' }); res.end();
            },
          });
          res.on('close', () => { held.get(name).closed = true; });
        }
      } else if (lateProgress && latest === 'new owner prompt') {
        held.set('owner', { finish: () => respond(res, body, { type: 'text', text: 'new owner ready' }, index) });
      } else if (parallelStop && typeof latest === 'string' && latest === 'parallel stop') {
        assert.ok(firstId, 'first child ID was returned to the model');
        respondParallel(res, body, [
          { type: 'tool_use', id: 'spawn-parallel', name: 'agent', input: { prompt: 'AGENT_ORIGINAL_PROMPT_SECOND', name: 'detail-second', model: 'fixture-child', background: false, mode: 'explore' } },
          { type: 'tool_use', id: 'stop-parallel', name: 'task_stop', input: { id: unknownStop ? unknownId : firstId } },
        ], index);
      } else if (typeof latest === 'string' && latest.startsWith('launch details ')) {
        const second = latest.includes('second');
        respond(res, body, { type: 'tool_use', id: `launch-${index}`, name: 'agent', input: {
          prompt: second ? 'AGENT_ORIGINAL_PROMPT_SECOND' : 'AGENT_ORIGINAL_PROMPT_FIRST',
          name: second ? 'detail-second' : 'detail-first', model: 'fixture-child', background: !foreground, mode: lateProgress ? 'general' : 'explore',
        } }, index);
      } else respond(res, body, { type: 'text', text: 'parent ready' }, index);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, TERM: 'xterm-256color' };
  for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY'].includes(name)) delete env[name];
  Object.assign(env, { LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture-parent', LLM_AUTH: 'bearer',
    LLM_TOKEN_COUNTING: 'estimate', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` });
  if (lateProgress) {
    assert.ok(foreground, '--late-progress requires --foreground-progress');
    const loader = path.join(temporary, 'progress-loader.mjs');
    const register = path.join(temporary, 'progress-register.mjs');
    const heldFile = path.join(temporary, 'progress-held'), releaseFile = path.join(temporary, 'progress-release');
    const deliveredFile = path.join(temporary, 'progress-delivered');
    fs.writeFileSync(loader, `import fs from 'node:fs';
export async function load(url, context, next) {
  const result = await next(url, context);
  if (!url.endsWith('/dist/interactive.js')) return result;
  const original = ${JSON.stringify(`agentProgress: event => {
                if (session === progressOwner && ownerEpoch === progressEpoch && turnController && !turnController.signal.aborted)
                    terminal?.setAgentProgress?.(event.toolUseId, event.message);
            },`)};
  const replacement = ${JSON.stringify(`agentProgress: event => {
                const deliver = () => { if (session === progressOwner && ownerEpoch === progressEpoch && turnController && !turnController.signal.aborted)
                    terminal?.setAgentProgress?.(event.toolUseId, event.message); };
                deliver();
                if (JSON.stringify(event).includes('read-second') && !fs.existsSync(process.env.FIXTURE_PROGRESS_HELD)) {
                    fs.writeFileSync(process.env.FIXTURE_PROGRESS_HELD, 'held');
                    const timer = setInterval(() => { if (!fs.existsSync(process.env.FIXTURE_PROGRESS_RELEASE)) return;
                        clearInterval(timer); deliver(); fs.writeFileSync(process.env.FIXTURE_PROGRESS_DELIVERED, 'delivered'); }, 10);
                }
            },`)};
  const source = String(result.source);
  if (!source.includes(original)) throw Error('compiled progress callback shape changed');
  return { ...result, source: source.replace(original, replacement) };
}`);
    fs.writeFileSync(register, `import { register } from 'node:module'; register(${JSON.stringify(new URL(`file://${loader}`).href)});`);
    Object.assign(env, { NODE_OPTIONS: `--import=${register}`, FIXTURE_PROGRESS_HELD: heldFile,
      FIXTURE_PROGRESS_RELEASE: releaseFile, FIXTURE_PROGRESS_DELIVERED: deliveredFile });
  }
  child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--user-dir', userDir, '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass'],
  { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', text => screen.write(text)); child.stderr.on('data', text => screen.write(text));
  await until(ready, 'startup', 15000);
  send('launch details first\r');
  if (parallelStop) {
    await until(() => held.has('first') && ready() && firstId, 'first child running with model-visible ID', 15000);
    send('parallel stop\r');
    await until(() => held.has('second'), 'second child executing in parallel group', 15000);
    if (!unknownStop) await until(() => held.get('first').closed, 'TaskStop closes first child while second is held', 15000);
    held.get('second').finish(); await until(ready, 'parallel results delivered', 15000);
    const resultRequest = requests.find(request => request.model === 'fixture-parent' && JSON.stringify(request.messages).includes('stop-parallel'));
    assert.ok(resultRequest);
    const resultBlocks = resultRequest.messages.flatMap(message => Array.isArray(message.content) ? message.content : []).filter(block => block.type === 'tool_result' && ['spawn-parallel', 'stop-parallel'].includes(block.tool_use_id));
    assert.deepEqual(resultBlocks.map(block => block.tool_use_id), ['spawn-parallel', 'stop-parallel']);
    assert.equal(resultBlocks[1].is_error, unknownStop ? true : undefined);
    if (unknownStop) {
      assert.match(String(resultBlocks[1].content), /unknown background task/i);
      assert.equal(held.get('first').closed, false, 'unknown stop leaves the existing child running');
      held.get('first').finish();
    }
    send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0, frame());
    if (unknownStop) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import fs from 'node:fs'; import path from 'node:path'; import { Session } from './dist/session.js';
        const workspace = process.argv[1], dir = path.join(workspace, '.agent');
        const files = fs.readdirSync(dir).filter(name => name.endsWith('.jsonl'));
        const file = files.find(name => fs.readFileSync(path.join(dir, name), 'utf8').includes('stop-parallel'));
        if (!file) throw Error('parent journal missing');
        const session = Session.open(workspace, { id: file.slice(0, -6) });
        try { process.stdout.write(JSON.stringify(session.events.filter(e => e.kind === 'tool_result' && ['spawn-parallel', 'stop-parallel'].includes(e.result.tool_use_id)).map(e => e.result))); }
        finally { session.close(); }
      `, workspace], { cwd: root, encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr);
      const rows = JSON.parse(cold.stdout);
      assert.deepEqual(rows.map(row => row.tool_use_id), ['spawn-parallel', 'stop-parallel']);
      assert.equal(rows[0].is_error, undefined);
      assert.equal(rows[1].is_error, true);
      assert.match(String(rows[1].content), /unknown background task/i);
    }
    console.log(JSON.stringify({ cli: 'passed', parallelAgentTaskStop: true, unknownStop, independentColdRead: unknownStop, knownIdFromModelResult: true, orderedResults: true }));
  } else if (foreground) {
    await until(() => held.has('first'), 'foreground child read and held', 15000);
    await until(() => frame().includes('read_file'), 'foreground child tool visible while parent is running', 3000);
    assert.doesNotMatch(frame(), /read-first|launch-\d+/);
    held.get('first').finish(); await until(ready, 'foreground child finished', 15000);
    assert.doesNotMatch(frame(), /read_file/);
    assert.equal(requests.filter(request => request.model === 'fixture-parent')
      .some(request => JSON.stringify(request.messages).includes('read-first')), false, 'child progress stays outside parent model messages');
    send('launch details second\r');
    await until(() => held.has('second') && frame().includes('read_file'), 'second foreground child progress', 15000);
    let oldJournals, oldRequestCount, childId;
    if (lateProgress) {
      await until(() => fs.existsSync(env.FIXTURE_PROGRESS_HELD), 'late progress captured', 5000);
      await until(() => fs.existsSync(path.join(workspace, 'started')), 'child skill shell started', 15000);
      const effectFile = fs.readdirSync(path.join(workspace, '.agent/skill-effects')).find(name => name.endsWith('.jsonl'));
      assert.ok(effectFile, 'child skill effect journal');
      childId = effectFile.slice(0, -6);
      oldJournals = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
      send('/clear\r');
      await until(() => frame().includes('/clear'), 'clear queued while turn active');
      assert.deepEqual(fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl')), oldJournals);
      oldRequestCount = requests.length;
    }
    send('\x03'); await until(() => ready() && !frame().includes('read_file'), 'cancel clears foreground progress', 15000);
    if (!lateProgress) send('/clear\r');
    if (lateProgress) await until(() => fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl')).some(name => !oldJournals.includes(name)), 'queued clear switched owner', 15000);
    await until(() => ready() && !frame().includes('read_file'), 'session switch clears old progress', 15000);
    if (lateProgress) {
      send('new owner prompt\r');
      await until(() => held.has('owner'), 'new owner turn held', 15000);
      assert.equal(requests.length, oldRequestCount + 1, 'cancelled child and parent made no further model requests');
      const newRequest = requests.find(request => request.messages.at(-1)?.content === 'new owner prompt');
      assert.doesNotMatch(JSON.stringify(newRequest.messages), /AGENT_ORIGINAL_PROMPT|read-second|OWNED_AGENT_FILE/);
      assert.doesNotMatch(JSON.stringify(newRequest.messages), new RegExp(childId));
      const newJournal = fs.readdirSync(path.join(workspace, '.agent')).find(name => name.endsWith('.jsonl') && !oldJournals.includes(name));
      const before = fs.readFileSync(path.join(workspace, '.agent', newJournal), 'utf8');
      fs.writeFileSync(env.FIXTURE_PROGRESS_RELEASE, 'release');
      await until(() => fs.existsSync(env.FIXTURE_PROGRESS_DELIVERED), 'late progress delivered after switch', 5000);
      assert.doesNotMatch(frame(), /read_file/);
      assert.equal(fs.readFileSync(path.join(workspace, '.agent', newJournal), 'utf8'), before);
      assert.doesNotMatch(before, /AGENT_ORIGINAL_PROMPT|read-second|OWNED_AGENT_FILE/);
      assert.doesNotMatch(before, new RegExp(childId));
      const pid = Number(fs.readFileSync(path.join(workspace, 'shell.pid'), 'utf8'));
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
      assert.equal(fs.existsSync(path.join(workspace, 'finished')), false);
      const effects = path.join(workspace, '.agent/skill-effects');
      assert.equal(fs.readdirSync(effects).some(name => name.endsWith('.lease')), false);
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import { SkillEffectJournal } from './dist/skill-effects.js';
        process.stdout.write(JSON.stringify(new SkillEffectJournal(process.argv[1], process.argv[2]).unresolved('fixture')));
      `, workspace, childId], { cwd: root, encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr);
      assert.equal(JSON.parse(cold.stdout).length, 1, 'cold child effect remains unresolved');
      held.get('owner').finish();
      await until(ready, 'new owner completed', 15000);
    }
    send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0, frame());
    if (lateProgress) assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
    console.log(JSON.stringify({ cli: 'passed', foregroundProgress: true, cleanup: true, switchIsolation: true, parentModelIsolation: true, lateProgress }));
  } else {
  await until(() => held.has('first') && ready(), 'first child read and held', 15000);
  const before = requests.length;
  send('/tasks\r'); await until(() => frame().includes('AGENT_ORIGINAL_PROMPT_FIRST') && frame().includes('Progress'), 'single agent source details');
  assert.match(frame(), /read_file/); assert.match(frame(), /1 tool/); assert.match(frame(), /1\.2k tokens/); assert.match(frame(), /fixture-child/);
  held.get('first').text('p'.repeat(4000));
  await until(() => frame().includes('2.2k tokens'), 'live stream raises displayed token estimate');
  await delay(1100); assert.equal(requests.length, before, 'detail polling preserves model and notification ownership');
  send(' '); await until(ready, 'Space closes agent detail');
  send('launch details second\r'); await until(() => held.has('second') && ready(), 'second child read and held', 15000);
  send('/tasks\r'); await until(() => frame().includes('2 active agents'), 'two-agent list');
  send('\r'); await until(() => frame().includes('AGENT_ORIGINAL_PROMPT_SECOND'), 'select newest running agent detail');
  send('\x1b[D'); await until(() => frame().includes('2 active agents'), 'Back to list');
  send('\r'); await until(() => frame().includes('AGENT_ORIGINAL_PROMPT_SECOND'), 'Back retains selected child');
  send('x'); await until(() => frame().includes('1 active agent'), 'stop second agent returns to list');
  send('\r'); await until(() => frame().includes('AGENT_ORIGINAL_PROMPT_FIRST'), 'remaining first detail');
  held.get('first').finish(); await until(() => frame().includes('Completed ·') && frame().includes('AGENT_ORIGINAL_PROMPT_FIRST'), 'completed child retains source detail');
  assert.doesNotMatch(frame(), /x stop/);
  send('\x1b[D'); await until(() => frame().includes('Completed (1)'), 'Back returns to completed group');
  send('\x1b'); await until(ready, 'close completed tasks');
  send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0, frame());
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  console.log(JSON.stringify({ cli: 'passed', childDetails: true, originalPrompt: true, liveCounters: true,
    actualChildRead: true, listBackStopCompletion: true, modelRequests: requests.length, gateway: 'owned loopback SSE', locksReleased: true }));
  }
} finally {
  fs.writeFileSync(path.join(temporary, 'screen.txt'), frame());
  if (child && child.exitCode === null && child.signalCode === null) {
    child.stdin.write('\x03\x03'); await Promise.race([exited, delay(1000)]);
    if (child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); } }
  }
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  screen.close(); console.log(JSON.stringify({ fixture: temporary }));
}
