import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAugmentTask, parseStandardTask, driveStandardMcpTask, MCP_TASK_PROTOCOL_VERSION, MCP_RELATED_TASK } from '../src/mcp-standard-task.js';
import { McpClientRequestHandler } from '../src/mcp-client-requests.js';
const state = (status = 'working', taskId = 'owned') => ({ taskId, status, ttl: 30000, createdAt: '2026-10-12T00:00:00Z', lastUpdatedAt: '2026-10-12T00:00:00Z', pollInterval: 250 });
const flush = async () => { for (let i=0;i<100;i++) await Promise.resolve(); };
const result = { content: [{ type: 'text', text: 'owned result' }], _meta: { [MCP_RELATED_TASK]: { taskId: 'owned' } } };

test('standard task requestor gates capabilities and validates correlated terminal/result streams', async t => {
  const caps = { tasks: { requests: { tools: { call: {} } }, cancel: {} } };
  assert.equal(canAugmentTask(MCP_TASK_PROTOCOL_VERSION, caps, 'optional'), true);
  assert.equal(canAugmentTask(MCP_TASK_PROTOCOL_VERSION, caps, 'forbidden'), false);
  assert.equal(canAugmentTask('2025-06-18', caps, 'optional'), false);
  assert.throws(() => canAugmentTask(MCP_TASK_PROTOCOL_VERSION, {}, 'required'));
  assert.throws(() => parseStandardTask({ task: state('completed') }));
  const task = parseStandardTask({ task: state() });
  for (const status of ['completed','failed','cancelled','input_required']) {
    const calls: string[] = [];
    const out = await driveStandardMcpTask(task, async method => { calls.push(method); return method==='tasks/get'?state(status):result; }, new AbortController().signal, true);
    assert.deepEqual(out, result); assert.deepEqual(calls, ['tasks/get','tasks/result']);
  }
  for (const bad of [state('working','foreign'), {...state(),ttl:-1}, {...state(),createdAt:'invalid'}]) {
    const calls: string[]=[];
    await assert.rejects(driveStandardMcpTask(task,async method=>{calls.push(method);return bad;},new AbortController().signal,true),/Malformed/);
    assert.deepEqual(calls,['tasks/get','tasks/cancel']);
  }
  await assert.rejects(driveStandardMcpTask(task,async method=>method==='tasks/get'?state('completed'):{...result,_meta:{[MCP_RELATED_TASK]:{taskId:'foreign'}}},new AbortController().signal,true),/Malformed/);
  t.mock.timers.enable({apis:['setTimeout']});
  try {
    let polls=0;const pending=driveStandardMcpTask(task,async method=>method==='tasks/result'?result:(++polls===1?state():state('completed')),new AbortController().signal,true);
    await flush();assert.equal(polls,1);t.mock.timers.tick(250);await flush();assert.deepEqual(await pending,result);
    const owner=new AbortController();let cancels=0;const work=driveStandardMcpTask(task,async method=>{if(method==='tasks/cancel'){cancels++;return {};}return state();},owner.signal,true);
    const checked=assert.rejects(work,/cancel/);await flush();owner.abort();await checked;assert.equal(cancels,1);
  } finally {t.mock.timers.reset();}
});

test('related task reverse RPCs require active ownership and return correlated metadata', async () => {
  let called=0;const handler=new McpClientRequestHandler('fixture',{roots:()=>{called++;return[{uri:'file:///owned'}];}});
  const params={_meta:{[MCP_RELATED_TASK]:{taskId:'owned'}}};const replies:any[]=[];
  const request=(id:number)=>handler.handle({jsonrpc:'2.0',id,method:'roots/list',params},value=>{replies.push(value);});
  try {
    await request(1);assert.equal(replies[0].error.code,-32602);assert.equal(called,0);
    const release=handler.ownTask('owned');await request(2);release();
    assert.equal(called,1);assert.equal(replies[1].result._meta[MCP_RELATED_TASK].taskId,'owned');
    await request(3);assert.equal(replies[2].error.code,-32602);assert.equal(called,1);
    let observed: AbortSignal | undefined;
    const slow = new McpClientRequestHandler('fixture', { roots: (_context, signal) => { observed = signal; return new Promise(() => {}); } });
    const releaseSlow = slow.ownTask('owned');
    const pending = slow.handle({ jsonrpc: '2.0', id: 4, method: 'roots/list', params }, value => { replies.push(value); });
    await flush(); releaseSlow(); await pending;
    assert.equal(observed?.aborted, true);
    assert.equal(replies.at(-1).error.code, -32603);
    assert.equal(replies.at(-1)._meta[MCP_RELATED_TASK].taskId, 'owned');
    await slow.close();
  } finally {await handler.close();}
});
