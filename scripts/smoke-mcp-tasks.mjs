import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { register } from 'tsx/esm/api';
import { captureIdentity } from './identity.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const compiled = process.argv.includes('--compiled');
const standard = process.argv.includes('--standard');
const getInputs = process.argv.includes('--get');
const durable = process.argv.includes('--durable');
if (durable && !standard) throw new Error('--durable requires --standard');
let savedTaskId;
if (getInputs && !standard) throw new Error('--get requires --standard');
let getStream, gets = 0, getClosed = 0;

const related = 'io.modelcontextprotocol/related-task';
const taskState = (taskId, status = 'working') => ({ taskId, status, ttl: 30000, createdAt: '2026-10-12T00:00:00Z', lastUpdatedAt: '2026-10-12T00:00:00Z', pollInterval: 250 });
let inputStream;
const unregister = compiled ? undefined : register();
const { connectMcpServers } = await import(compiled ? '../dist/mcp.js' : '../src/mcp.ts');
const tmp = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : path.join(root, '.agent');
fs.mkdirSync(tmp, { recursive: true });
const workspace = fs.mkdtempSync(path.join(tmp, 'task-cli-'));
const calls = [], model = [], failures = [], children = new Set();
const tasks = new Map(); let seq = 0, deletes = 0;
const send = (res, id, result) => { res.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 'owned-task-fixture' }); res.end(JSON.stringify({ jsonrpc: '2.0', id, result })); };
const server = http.createServer((req, res) => {
  void (async () => {
    if (req.method === 'GET') {
      gets++; getStream = res;
      res.on('close', () => { getClosed++; if (getStream === res) getStream = undefined; });
      res.writeHead(200, { 'content-type': 'text/event-stream' }); res.flushHeaders(); return;
    }
    if (req.method === 'DELETE') { deletes++; res.writeHead(204).end(); return; }
    const chunks = []; let size = 0; for await (const c of req) { size += c.length; assert.ok(size < 2 ** 20); chunks.push(c); }
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    if (req.url === '/v1/messages') {
      model.push(body); const tool = model.filter(item => item.messages[0]?.content === 'run owned task').length === 1 && !body.messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'tool_result'));
      const recovering = body.messages.some(m => typeof m.content === 'string' && m.content.includes('recover owned task'));
      const recoveryTool = recovering && body.messages.at(-1)?.role === 'user' && typeof body.messages.at(-1)?.content === 'string';
      const block = recoveryTool ? { type: 'tool_use', id: 'recover-call', name: 'mcp_task_recover', input: { server: 'srv', taskId: savedTaskId } }
        : tool ? { type: 'tool_use', id: 'task-call', name: 'mcp__srv__run', input: { mode: durable ? 'cancel' : 'complete' } } : { type: 'text', text: 'task done' };
      const events = [
        { type: 'message_start', message: { id: 'owned', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: block.type === 'text' ? { type: 'text', text: '' } : block },
        { type: 'content_block_delta', index: 0, delta: block.type === 'text' ? { type: 'text_delta', text: block.text } : { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: block.type === 'tool_use' ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }, { type: 'message_stop' } ];
      res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end(events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')); return;
    }
    calls.push({ body, taskHeader: req.headers['mcp-name'] });
    if (body.method === 'initialize') send(res, body.id, { protocolVersion: standard && body.params.protocolVersion === '2025-11-25' ? '2025-11-25' : '2025-06-18', capabilities: { tools: {}, ...(standard ? { tasks: { cancel: {}, requests: { tools: { call: {} } } } } : {}) } });
    else if (body.method === 'tools/list') send(res, body.id, { tools: [{ name: 'run', ...(standard ? { execution: { taskSupport: 'optional' } } : {}), inputSchema: { type: 'object', properties: { mode: { type: 'string' } } } }] });
    else if (body.method === 'tools/call') { const taskId = `owned-${++seq}`; tasks.set(taskId, { mode: body.params.arguments.mode, polls: 0, answered: false }); if (standard) { if (!body.params.task) { send(res, body.id, { content: [{ type: 'text', text: 'normal legacy result' }] }); return; } assert.deepEqual(body.params.task, { ttl: 30000 }); send(res, body.id, { task: taskState(taskId) }); } else send(res, body.id, { resultType: 'task', taskId, status: 'working', pollIntervalMs: 250 }); }
    else if (body.method === 'tasks/get') {
      const { taskId } = body.params, task = tasks.get(taskId); assert.ok(task); assert.equal(req.headers['mcp-name'], standard ? undefined : taskId); task.polls++;
      if (standard) {
        const status = task.mode === 'cancel' ? 'working' : task.mode === 'failed' ? 'failed' : ['form', 'complete'].includes(task.mode) ? 'input_required' : 'completed';
        send(res, body.id, taskState(task.mode === 'mismatch' ? 'foreign' : taskId, status)); return;
      }
      if (task.mode === 'mismatch') send(res, body.id, { taskId: 'foreign', status: 'completed', result: {} });
      else if (task.mode === 'unsupported') send(res, body.id, { taskId, status: 'input_required', inputRequests: { key: { method: 'unserved/method', params: {} } } });
      else if (task.mode === 'cancel') send(res, body.id, { taskId, status: 'working', pollIntervalMs: 250 });
      else if (!task.answered) send(res, body.id, { taskId, status: 'input_required', inputRequests: { root: task.mode === 'form'
        ? { method: 'elicitation/create', params: { message: 'owned form', requestedSchema: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] } } }
        : { method: 'roots/list', params: {} } } });
      else send(res, body.id, { taskId, status: 'completed', result: { content: [{ type: 'text', text: 'OWNED_TASK_RESULT' }] } });
    } else if (standard && body.method === 'tasks/result') {
      const taskId = body.params.taskId, task = tasks.get(taskId);
      if (['form', 'complete'].includes(task.mode)) {
        inputStream = { res, id: body.id, taskId }; res.writeHead(200, { 'content-type': 'text/event-stream' });
        if (getInputs) {
          const deadline = Date.now() + 2000;
          while (!getStream && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
          assert.ok(getStream, 'GET input stream ready');
        }
        (getInputs ? getStream : res).write(`data: ${JSON.stringify({ jsonrpc: '2.0', id: 'standard-form', method: task.mode === 'form' ? 'elicitation/create' : 'roots/list', params: { ...(task.mode === 'form' ? { message: 'owned form', requestedSchema: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] } } : {}), _meta: { [related]: { taskId } } } })}\n\n`);
      } else send(res, body.id, { content: [{ type: 'text', text: 'OWNED_TASK_RESULT' }], isError: task.mode === 'failed', _meta: { [related]: { taskId: task.mode === 'unsupported' ? 'foreign' : taskId } } });
    } else if (standard && body.id === 'standard-form') {
      assert.equal(body.result._meta[related].taskId, inputStream.taskId);
      if (tasks.get(inputStream.taskId).mode === 'form') assert.deepEqual(body.result.content, { label: 'owned' });
      else assert.ok(body.result.roots[0].uri.startsWith('file:'));
      res.writeHead(202).end(); inputStream.res.end(`data: ${JSON.stringify({ jsonrpc: '2.0', id: inputStream.id, result: { content: [{ type: 'text', text: 'OWNED_TASK_RESULT' }], _meta: { [related]: { taskId: inputStream.taskId } } } })}\n\n`);
    } else if (body.method === 'tasks/update') { const task = tasks.get(body.params.taskId); if (task.mode === 'form') assert.deepEqual(body.params.inputResponses.root, { action: 'accept', content: { label: 'owned' } }); else assert.ok(body.params.inputResponses.root.roots[0].uri.startsWith('file:')); task.answered = true; send(res, body.id, {}); }
    else if (body.method === 'tasks/cancel') { tasks.get(body.params.taskId).cancelled = true; send(res, body.id, { taskId: body.params.taskId, status: 'cancelled' }); }
    else res.writeHead(202).end();
  })().catch(e => { failures.push(String(e)); res.destroy(); });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const config = { srv: { type: 'http', url: url + '/mcp' } };
const context = { workspace, signal: new AbortController().signal, maxOutputBytes: 24000 };
const invoke = async (connection, mode, signal = context.signal) => connection.tools.find(t => t.schema.name === 'mcp__srv__run').execute({ mode }, { ...context, signal });
try {
  const connection = await connectMcpServers(config, context, { ...(standard ? { standardTasks: true, notificationStream: getInputs } : { tasks: true }), clientRequests: { roots: () => [{ uri: new URL('file://' + workspace).href }], elicitation: () => ({ action: 'accept', content: { label: 'owned' } }) } });
  try {
    assert.match(await invoke(connection, 'complete'), /OWNED_TASK_RESULT/);
    assert.match(await invoke(connection, 'form'), /OWNED_TASK_RESULT/);
    await assert.rejects(invoke(connection, 'mismatch'), /malformed|Malformed/i);
    await assert.rejects(invoke(connection, 'unsupported'), standard ? /Malformed/i : /unsupported|input/i);
    if (standard) await assert.rejects(invoke(connection, 'failed'), /OWNED_TASK_RESULT/);
    const abort = new AbortController(); const pending = invoke(connection, 'cancel', abort.signal);
    const timer = setTimeout(() => abort.abort(), 100);
    try { await assert.rejects(pending, /cancel/i); } finally { clearTimeout(timer); }
    assert.equal([...tasks.values()].filter(t => t.cancelled).length, standard ? 2 : 3);
  } finally { await connection.close(); }
  const legacy = await connectMcpServers(config, context);
  try { const before = calls.filter(c => c.body.method === 'tasks/get').length; await invoke(legacy, 'complete'); assert.equal(calls.filter(c => c.body.method === 'tasks/get').length, before); } finally { await legacy.close(); }
  const stdio = path.join(workspace, 'owned-stdio.mjs');
  fs.writeFileSync(stdio, `import readline from 'node:readline';
const reply=(id,result)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\\n');
let adjacent=false, getId;
readline.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);
if(m.id==='adjacent-roots'){if(!m.result?.roots || m.result?._meta?.['io.modelcontextprotocol/related-task']?.taskId!=='stdio-owned')process.exit(13);else{adjacent=true;if(getId!==undefined)reply(getId,${JSON.stringify(taskState('stdio-owned','completed'))});}}
else if(m.method==='initialize')reply(m.id,{protocolVersion:${JSON.stringify(standard ? '2025-11-25' : '2024-11-05')},capabilities:{tools:{},${standard ? 'tasks:{cancel:{},requests:{tools:{call:{}}}}' : ''}}});
else if(m.method==='tools/list')reply(m.id,{tools:[{name:'run',inputSchema:{type:'object'},${standard ? "execution:{taskSupport:'required'}" : ''}}]});
else if(m.method==='tools/call'){${standard ? "process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:" + JSON.stringify({task:taskState('stdio-owned')}) + "})+'\\n'+JSON.stringify({jsonrpc:'2.0',id:'adjacent-roots',method:'roots/list',params:{_meta:{'io.modelcontextprotocol/related-task':{taskId:'stdio-owned'}}}})+'\\n');" : "reply(m.id,{resultType:'task',taskId:'stdio-owned',status:'working',pollIntervalMs:250});"}}
else if(m.method==='tasks/get'){${standard ? "getId=m.id;if(adjacent)reply(getId,"+JSON.stringify(taskState('stdio-owned','completed'))+");" : "reply(m.id,{taskId:'stdio-owned',status:'completed',result:{content:[{type:'text',text:'STDIO_TASK_RESULT'}]}});"}}
else if(m.method==='tasks/result')reply(m.id,{content:[{type:'text',text:'STDIO_TASK_RESULT'}],_meta:{'io.modelcontextprotocol/related-task':{taskId:'stdio-owned'}}});});
`);
  const local = await connectMcpServers({ srv: { command: process.execPath, args: [stdio] } }, context, standard ? { standardTasks: true, clientRequests: { roots: () => [{ uri: 'file:///owned-adjacent' }] } } : { tasks: true });
  try { assert.match(await invoke(local, 'complete'), /STDIO_TASK_RESULT/); } finally { await local.close(); }
  const lifetime = await connectMcpServers(config, context, standard ? { standardTasks: true, notificationStream: getInputs } : { tasks: true });
  const outstanding = invoke(lifetime, 'cancel'); const checked = assert.rejects(outstanding, /cancel/i);
  await new Promise(resolve => setTimeout(resolve, 25)); await lifetime.close(); await checked;
  fs.mkdirSync(path.join(workspace, '.harness')); fs.mkdirSync(path.join(workspace, 'user'));
  fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ mcpServers: config, mcpClient: { roots: true }, features: { ...(standard ? { mcpStandardTasks: true, mcpNotificationStream: getInputs, ...(durable ? { mcpPersistence: true, mcpRecovery: true } : {}) } : { mcpTasks: true }), mcpDynamic: false } }));
  const run = async (resume, continuing = false) => {
    const env = { ...process.env }; for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name)) delete env[name];
    Object.assign(env, { LLM_API_KEY: 'OWNED_TASK_KEY', LLM_MODEL: 'fixture/task', LLM_BASE_URL: url, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' });
    const args = ['--workspace', workspace, ...(resume ? ['--resume', resume, ...(durable ? ['--recover-lock'] : [])] : ['--user-dir', path.join(workspace, 'user')]), '--output-format', 'json', ...(continuing ? ['--continue'] : [resume ? (durable ? 'recover owned task' : 'continue owned task') : 'run owned task'])];
    const child = spawn(process.execPath, [...(compiled ? ['dist/cli.js'] : ['--import', 'tsx', 'src/cli.ts']), ...args], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] }); children.add(child);
    let out = '', err = ''; child.stdout.on('data', c => { out += c; assert.ok(out.length < 100000); }); child.stderr.on('data', c => { err = (err + c).slice(-100000); });
    let killedSession;
    const watcher = durable && !resume ? setInterval(() => {
      const directory = path.join(workspace, '.agent');
      if (!fs.existsSync(directory)) return;
      for (const name of fs.readdirSync(directory).filter(n => n.endsWith('.jsonl'))) {
        const events = fs.readFileSync(path.join(directory, name), 'utf8').trim().split('\n').flatMap(row => { try { return [JSON.parse(row)]; } catch { return []; } });
        const saved = events.find(e => e.kind === 'mcp_task' && !e.resolved);
        if (saved) { savedTaskId = saved.taskId; killedSession = name.slice(0, -6); child.kill('SIGKILL'); break; }
      }
    }, 5) : undefined;
    const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
    try { const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); }); if (killedSession) return { session_id: killedSession, reason: 'killed' }; assert.equal(code, 0, err); return JSON.parse(out); } finally { clearTimeout(timer); if (watcher) clearInterval(watcher); children.delete(child); }
  };
  const first = await run(); assert.equal(first.reason, durable ? 'killed' : 'end_turn');
  if (durable) { assert.ok(savedTaskId); tasks.get(savedTaskId).mode = 'complete'; }
  const journalPath = path.join(workspace, '.agent', first.session_id + '.jsonl'); const journal = fs.readFileSync(journalPath, 'utf8');
  if (!durable) assert.match(journal, /OWNED_TASK_RESULT/); else assert.match(journal, /mcp_task/); assert.doesNotMatch(journal, /OWNED_TASK_KEY/);
  assert.equal(JSON.parse(journal.split('\n')[0]).config.features[standard ? 'mcpStandardTasks' : 'mcpTasks'], true);
  const callsBefore = calls.filter(c => c.body.method === 'tools/call').length;
  fs.writeFileSync(path.join(workspace, '.harness/settings.json'), '{ malformed current settings');
  if (durable) { const continued = await run(first.session_id, true); assert.equal(continued.reason, 'end_turn'); }
  const resumed = await run(first.session_id); assert.equal(resumed.session_id, first.session_id);
  assert.equal(calls.filter(c => c.body.method === 'tools/call').length, callsBefore);
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(n => n.endsWith('.lock')), false); assert.deepEqual(failures, []);
  if (durable) {
    const recovered = fs.readFileSync(journalPath, 'utf8');
    assert.match(recovered, /OWNED_TASK_RESULT/); assert.match(recovered, /"resolved":true/);
    assert.doesNotMatch(recovered, /OWNED_TASK_KEY/);
    const remoteBefore = calls.filter(c => ['tasks/get', 'tasks/result'].includes(c.body.method)).length;
    const cached = await run(first.session_id); assert.equal(cached.reason, 'end_turn');
    assert.equal(calls.filter(c => ['tasks/get', 'tasks/result'].includes(c.body.method)).length, remoteBefore);
    assert.equal(calls.filter(c => c.body.method === 'tools/call').length, callsBefore);
  }
  if (getInputs) { assert.equal(gets, durable ? 6 : 4); assert.equal(getClosed, gets); }
  console.log(JSON.stringify({ tasks: 'passed', standard, ...(durable ? { durable: true, sigkill: true, cachedResult: true } : {}), ...(getInputs ? { getInputs: true, gets, getClosed } : {}), compiledCLI: compiled, modelRequests: model.length, cancelled: standard ? 2 : 3, rootsInput: true, formInput: true, stdio: true, closeCleanup: true, malformed: true, unsupported: true, legacyGate: true, pinnedResume: true, noReplay: true, deletes, identity: captureIdentity().sha256 }));
} finally { for (const child of children) child.kill('SIGKILL'); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(workspace, { recursive: true, force: true }); unregister?.(); }
