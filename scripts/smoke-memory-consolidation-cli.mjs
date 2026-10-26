import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { defaultConfig } = await import(path.join(root, 'dist/agent.js'));
const { Session } = await import(path.join(root, 'dist/session.js'));
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'memory-consolidation-cli-')));
const requests = [];
let child, server;
try {
  fs.mkdirSync(path.join(workspace, 'user'));
  fs.mkdirSync(path.join(workspace, '.harness/memory'), { recursive: true });
  fs.writeFileSync(path.join(workspace, '.harness/memory/practical.md'), 'Prefer actual CLI checks.');
  const seed = count => {
    const ids = [];
    for (let index = 0; index < count; index++) {
      const config = defaultConfig(workspace, []); config.model = 'fixture/history'; config.automaticCheckpoints = false;
      const session = Session.open(workspace, { config });
      session.append({ kind: 'message', message: { role: 'user', content: `Remember fixture preference ${index}: actual CLI checks.` } });
      session.append({ kind: 'message', message: { role: 'assistant', content: 'Recorded fixture preference.' } });
      session.append({ kind: 'turn_end', reason: 'end_turn' });
      ids.push(session.id); session.close();
    }
    return ids;
  };
  const history = seed(5);
  const writeSettings = extra => fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({
    autoMemory: true, autoMemoryConsolidation: true, automaticCheckpoints: false, ...extra,
  }));
  writeSettings({});
  let cancelMode = false;
  let cancelledRequest;
  const pending = new Promise(resolve => { cancelledRequest = resolve; });
  server = http.createServer((request, response) => {
    const chunks = []; let bytes = 0;
    request.on('data', chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) request.destroy(); else chunks.push(chunk); });
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const first = JSON.stringify(body.messages[0]?.content);
      const memory = first.includes('# Memory Consolidation');
      if (memory && cancelMode) { cancelledRequest(); return; }
      const last = body.messages.at(-1).content;
      let block = { type: 'text', text: memory ? 'Consolidated practical preference.' : 'main complete' };
      if (memory && !Array.isArray(last)) block = { type: 'tool_use', id: 'list-memory', name: 'memory_list', input: {} };
      else if (memory && Array.isArray(last) && last[0]?.type === 'tool_result') {
        const prior = body.messages.at(-2).content.find(item => item.type === 'tool_use');
        if (prior?.name === 'memory_list') block = { type: 'tool_use', id: 'search-sessions', name: 'memory_session_search',
          input: { session_id: history[0], pattern: 'actual CLI checks' } };
        else if (prior?.name === 'memory_session_search') {
          assert.equal(last[0].is_error, undefined, JSON.stringify(last));
          assert.match(last[0].content, /actual CLI checks/);
          block = { type: 'tool_use', id: 'write-memory', name: 'memory_write', input: { name: 'consolidated', content: 'Durable fixture preference: actual CLI checks.' } };
        }
      }
      const useTool = block.type === 'tool_use';
      const events = [
        { type: 'message_start', message: { id: `fixture-${requests.length}`, type: 'message', role: 'assistant', model: body.model,
          content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: useTool ? { ...block, input: {} } : { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: useTool ? { type: 'input_json_delta', partial_json: JSON.stringify(block.input) }
          : { type: 'text_delta', text: block.text } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: useTool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } },
        { type: 'message_stop' },
      ];
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const run = async (prompt, flags = []) => {
    child = spawn(process.execPath, [path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace,
      ...(flags.includes('--resume') ? [] : ['--user-dir', path.join(workspace, 'user')]), ...flags, prompt], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, LLM_API_KEY: 'owned-memory-fixture', LLM_MODEL: 'fixture/memory',
        LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' } });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    const deadline = setTimeout(() => child?.kill('SIGKILL'), 15000);
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    clearTimeout(deadline); child = undefined;
    return { code, stdout, stderr };
  };
  const completed = await run('complete one main task');
  assert.equal(completed.code, 0, completed.stderr);
  assert.equal(fs.existsSync(path.join(workspace, '.harness/memory/consolidated.md')), true, 'eligible main stop must run consolidation');
  assert.match(completed.stderr, /Memory consolidation completed/);
  assert.equal(requests.length, 5);
  const memoryRequests = requests.filter(body => JSON.stringify(body.messages[0]?.content).includes('# Memory Consolidation'));
  assert.equal(memoryRequests.length, 4);
  for (const request of memoryRequests) {
    assert.equal(request.system.includes('without a separate extraction model call'), false);
    assert.ok(request.tools.some(tool => tool.name === 'memory_session_search'));
    assert.equal(request.tools.some(tool => ['run_command', 'write_file', 'edit_file', 'agent', 'web_fetch'].includes(tool.name)), false);
  }
  const stampFile = path.join(workspace, '.harness/memory-consolidation.json');
  const stamp = fs.readFileSync(stampFile, 'utf8');
  assert.ok(JSON.parse(stamp).lastConsolidatedAt > 0);
  const id = /session: ([a-f0-9-]{36})/.exec(completed.stderr)[1];
  const metadata = fs.readFileSync(path.join(workspace, '.agent', `${id}.jsonl`), 'utf8').split('\n')[0];
  writeSettings({ autoMemoryConsolidation: false });
  const resumed = await run('continue with pinned memory settings', ['--resume', id]);
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.equal(requests.length, 6);
  assert.equal(fs.readFileSync(stampFile, 'utf8'), stamp);
  assert.equal(fs.readFileSync(path.join(workspace, '.agent', `${id}.jsonl`), 'utf8').split('\n')[0], metadata);
  fs.unlinkSync(stampFile);
  writeSettings({ permissions: { mode: 'bypass', allow: [], deny: ['memory_write'] } });
  const denied = await run('complete with memory writes denied');
  assert.equal(denied.code, 0, denied.stderr);
  assert.equal(requests.length, 7);
  assert.match(denied.stderr, /Memory consolidation skipped/);
  assert.equal(fs.existsSync(stampFile), false);
  writeSettings({}); cancelMode = true;
  const interrupted = run('complete then cancel consolidation');
  await Promise.race([pending, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('consolidation request did not start')), 10000); timer.unref(); })]);
  child.kill('SIGINT');
  const cancelled = await interrupted;
  assert.equal(cancelled.code, 130, cancelled.stderr);
  assert.equal(fs.existsSync(stampFile), false);
  assert.equal(fs.existsSync(stampFile + '.lock'), false);
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  cancelMode = false;
  fs.unlinkSync(path.join(workspace, '.harness/memory/consolidated.md'));
  child = spawn(process.execPath, [path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace,
    '--user-dir', path.join(workspace, 'user'), '--interactive'], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, LLM_API_KEY: 'owned-memory-fixture', LLM_MODEL: 'fixture/memory',
      LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' } });
  let interactiveOutput = '', interactiveErrors = '', wake;
  child.stdout.on('data', chunk => { interactiveOutput += chunk; wake?.(); });
  child.stderr.on('data', chunk => { interactiveErrors += chunk; wake?.(); });
  const exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  const wait = predicate => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { wake = undefined; reject(new Error(`interactive memory wait expired: ${interactiveErrors}`)); }, 10000);
    wake = () => { if (predicate()) { clearTimeout(timer); wake = undefined; resolve(); } }; wake();
  });
  await wait(() => interactiveErrors.includes('Personal harness.'));
  const beforeInteractive = requests.length;
  child.stdin.write('complete one interactive task\n');
  await wait(() => interactiveErrors.includes('Memory consolidation completed'));
  assert.match(interactiveErrors, /finished: end_turn/);
  assert.equal(requests.length, beforeInteractive + 5);
  child.stdin.end('/exit\n');
  assert.equal(await exit, 0, interactiveErrors); child = undefined;
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  assert.equal(fs.existsSync(stampFile + '.lock'), false);
  console.log(JSON.stringify({ cli: 'passed', compiled: true, eligibility: true, internalSessionSearch: true,
    boundedTools: true, originalResume: true, permissionDenial: true, cancellation: true, interactive: true, ambientNoMainReplay: true, stampPreserved: true,
    locksReleased: true, modelRequests: requests.length, gateway: 'owned loopback SSE' }));
} finally {
  child?.kill('SIGKILL');
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
