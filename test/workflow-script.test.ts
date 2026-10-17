import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { AgentRegistry } from '../src/agent-registry.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { createTools } from '../src/tools.js';
import { createWorkflowTools, WorkflowRegistry } from '../src/workflow.js';
import { loadWorkflowScriptFile, parseWorkflowScript, runWorkflowScript,
  WORKFLOW_SCRIPT_MAX_BYTES, type WorkflowAgentBridge } from '../src/workflow-script.js';

const signal = () => new AbortController().signal;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;
const meta = 'export const meta = { name: \'probe\', description: \'probe workflow\' }\n';

function parsed(body: string) {
  const result = parseWorkflowScript(meta + body);
  if ('error' in result) throw new Error(result.error);
  return result;
}

async function run(body: string, agent: WorkflowAgentBridge = async () => 'ok', args?: unknown) {
  return runWorkflowScript(parsed(body), { agent, signal: signal(), args });
}

test('meta parser requires a first pure-literal export and slices the body', () => {
  const source = `export const meta = {
    name: 'scan',
    description: 'scan things',
    title: 'Scan',
    whenToUse: 'when asked',
    phases: [{ title: 'Find', detail: 'look' }, { title: 'Fix', model: 'm' }, { bad: true }],
  };
  const body = \`log('body')\`;
  return body`;
  const good = parseWorkflowScript(source);
  assert.ok(!('error' in good));
  assert.equal(good.meta.name, 'scan');
  assert.equal(good.meta.title, 'Scan');
  assert.deepEqual(good.meta.phases, [{ title: 'Find', detail: 'look' }, { title: 'Fix', model: 'm' }]);
  assert.match(good.scriptBody, /^const body = `log\('body'\)`/);

  assert.match((parseWorkflowScript(`const meta = { name: 'x', description: 'y' }`) as { error: string }).error,
    /FIRST statement/);
  assert.match((parseWorkflowScript(`export const meta = { ...base, name: 'x', description: 'y' }`) as { error: string }).error,
    /pure literal/);
  assert.match((parseWorkflowScript(`export const meta = { name: 'x', description: 'y', constructor: 1 }`) as { error: string }).error,
    /reserved key/);
  assert.match((parseWorkflowScript(`export const meta = { name: '', description: 'y' }`) as { error: string }).error,
    /name must be a non-empty/);
  assert.match((parseWorkflowScript('x'.repeat(WORKFLOW_SCRIPT_MAX_BYTES + 1)) as { error: string }).error,
    /exceeds/);
});

test('transform wraps awaits, async returns and async iteration', async () => {
  const result = await run(`
    const arrow = async (value) => value + 1
    const asyncReturn = async () => { return await arrow(1) }
    async function* sequence() { yield 1; yield Promise.resolve(2) }
    const values = []
    for await (const value of sequence()) values.push(value)
    return { first: await asyncReturn(), values }
  `);
  assert.equal(result.error, undefined);
  assert.deepEqual(json(result.result), { first: 2, values: [1, 2] });
});

test('sandbox removes host access, time, randomness and dynamic code', async () => {
  const check = async (body: string) => {
    try { return (await run(body)).error?.message ?? 'ok'; } catch (error) { return (error as Error).message; }
  };
  assert.match(await check('return Date.now()'), /Date\.now\(\) \/ new Date\(\) are unavailable/);
  assert.match(await check('return new Date()'), /Date\.now\(\) \/ new Date\(\) are unavailable/);
  assert.match(await check('return Math.random()'), /Math\.random\(\) is unavailable/);
  assert.match(await check('return Function("return 1")()'), /Code generation from strings disallowed/);
  assert.equal(await check('return typeof process + ":" + typeof require'), 'ok');
  assert.equal((await run('return typeof process + ":" + typeof require')).result, 'undefined:undefined');
  assert.match(await check('return import("node:fs")'), /import\(\) is not available/);
  assert.match(await check('const __wRg$escape = 1; return __wRg$escape'), /reserved/);
  assert.match(await check('with ({}) { return 1 }'), /strict mode/);
  const date = await run('return new Date(2020, 0, 2).getFullYear()');
  assert.equal(date.result, 2020);
});

test('agent, parallel and pipeline mirror the recovered semantics', async () => {
  const calls: { prompt: string; label?: string; phase?: string }[] = [];
  const agent: WorkflowAgentBridge = async (prompt, options) => {
    calls.push({ prompt, label: options.label, phase: options.phase });
    return `${prompt}:${options.label ?? '-'}:${options.phase ?? '-'}`;
  };
  const result = await run(`
    phase('Scan')
    const first = await agent('one', { label: 'alpha' })
    const second = await agent('two')
    phase('Fix')
    const paired = await parallel([
      () => agent('three'),
      async () => { throw new Error('boom') },
    ])
    const piped = await pipeline([1, 2, 3], (value, original, index) => value + original + index, value => value * 2)
    const stopped = await pipeline([1, 2], async value => { if (value === 2) throw new Error('stage'); return value }, value => value + 10)
    return { first, second, paired, piped, stopped }
  `, agent);
  assert.equal(result.error, undefined);
  assert.deepEqual(calls.map(call => [call.prompt, call.label, call.phase]), [
    ['one', 'alpha', 'Scan'], ['two', undefined, 'Scan'], ['three', undefined, 'Fix'],
  ]);
  assert.equal((result.result as Record<string, unknown>).first, 'one:alpha:Scan');
  assert.equal((result.result as Record<string, unknown>).second, 'two:-:Scan');
  assert.deepEqual((json(result.result) as Record<string, unknown>).paired, ['three:-:Fix', null]);
  assert.deepEqual((json(result.result) as Record<string, unknown>).piped, [4, 10, 16]);
  assert.deepEqual((json(result.result) as Record<string, unknown>).stopped, [11, null]);
  assert.deepEqual(result.failures, ['parallel[1] failed: boom', 'pipeline[1] failed: stage']);
  assert.deepEqual(result.phases, ['Scan', 'Fix']);
  assert.equal(result.agent_count, 3);

  const promises = await run('return await parallel([() => 1, 1])');
  assert.match(promises.error?.message ?? '', /not promises/);
  const nested = await run("return await workflow('saved')");
  assert.match(nested.error?.message ?? '', /named workflows are not ported/);
});

test('script-visible helpers keep values and logs JSON-safe', async () => {
  const result = await run(`
    console.log('plain', { a: 1 }, [1, 2])
    console.error('bad', 3)
    log({ hidden: true })
    const value = { fn() { return 1 }, nested: { fn: () => 2, keep: 3 }, list: [1, () => 2] }
    return { budgetTotal: budget.total, remaining: budget.remaining() === Infinity, value, args }
  `, async () => 'ok', { deep: { n: 1 }, list: [1, 2] });
  assert.equal(result.error, undefined);
  assert.deepEqual(json(result.result), {
    budgetTotal: null, remaining: true,
    value: { nested: { keep: 3 }, list: [1, null] },
    args: { deep: { n: 1 }, list: [1, 2] },
  });
  assert.deepEqual(result.logs, [
    'plain {"a":1} [1,2]', '[error] bad 3', '[object]',
  ]);
});

test('function results are rejected and args are copied into the sandbox', async () => {
  const result = await run(`
    args.list.push(3)
    args.deep.n = 9
    return () => 1
  `, async () => 'ok', { list: [1, 2], deep: { n: 1 } });
  assert.equal(result.result, null);
  assert.equal(result.error?.message, 'workflow result cannot be a function');
  assert.equal(result.agent_count, 0);
});

test('agent option failures surface as script errors without spawning', async () => {
  let calls = 0;
  const result = await run(`return await agent('x', { schema: { type: 'object' } })`, async () => {
    calls += 1; return 'ok';
  });
  assert.equal(calls, 0);
  assert.match(result.error?.message ?? '', /agent\(\{schema\}\) is not available/);

  const remote = await run(`return await agent('x', { isolation: 'remote' })`);
  assert.match(remote.error?.message ?? '', /is not available in this build/);
});

test('abort cancels a running script and timers', async () => {
  const controller = new AbortController();
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const pending = runWorkflowScript(parsed('await agent(\'slow\')\nreturn 1'), {
    signal: controller.signal,
    agent: async () => {
      entered();
      await new Promise<void>((_resolve, reject) => controller.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
      return 'never';
    },
  });
  await started;
  controller.abort();
  const result = await pending;
  assert.equal(result.result, null);
  assert.equal(result.error?.message, 'Workflow aborted');
});

test('scriptPath accepts a regular file and refuses links, directories and oversized files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-workflow-file-'));
  const failure = async (file: string) => {
    const loaded = await loadWorkflowScriptFile(file, dir);
    return 'error' in loaded ? loaded.error : 'loaded';
  };
  try {
    fs.writeFileSync(path.join(dir, 'flow.js'), meta + 'return args.value');
    const loaded = await loadWorkflowScriptFile('flow.js', dir);
    assert.ok(!('error' in loaded));
    const parsedFile = parseWorkflowScript((loaded as { source: string }).source);
    assert.ok(!('error' in parsedFile));
    const ran = await runWorkflowScript(parsedFile, {
      args: { value: 5 }, signal: signal(), agent: async () => 'ok',
    });
    assert.equal(ran.result, 5);

    fs.symlinkSync(path.join(dir, 'flow.js'), path.join(dir, 'link.js'));
    assert.match(await failure('link.js'), /Failed to read workflow script file link\.js/);
    fs.linkSync(path.join(dir, 'flow.js'), path.join(dir, 'hard.js'));
    assert.match(await failure('hard.js'), /scriptPath must be a script path this tool returned/);
    // A directory carries nlink > 1, so the source's inode/link guard refuses
    // it before the regular-file check.
    fs.mkdirSync(path.join(dir, 'folder'));
    assert.match(await failure('folder'), /scriptPath must be a script path this tool returned/);
    assert.match(await failure('missing.js'), /Workflow script file not found: missing\.js/);
    fs.writeFileSync(path.join(dir, 'huge.js'), 'a'.repeat(WORKFLOW_SCRIPT_MAX_BYTES + 1));
    assert.match(await failure('huge.js'), new RegExp(`exceeds ${WORKFLOW_SCRIPT_MAX_BYTES} bytes`));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function response(text: string): Anthropic.Message {
  return { id: 'fixture', model: 'test', type: 'message', role: 'assistant', content: [{ type: 'text', text }],
    stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}

test('workflow_run executes scripts through the child agent registry', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-workflow-script-')));
  const requests: ModelRequest[] = [];
  const provider: ModelProvider = { count: async () => 0,
    complete: async request => {
      requests.push(structuredClone(request));
      if (String(request.messages.at(-1)?.content).includes('fail task')) throw new Error('provider exploded');
      return response('child result');
    } };
  const tools = createTools(); const config = defaultConfig(workspace, tools); config.model = 'test';
  const agents = new AgentRegistry({ source: config, tools, provider });
  const workflows = new WorkflowRegistry({ agents });
  try {
    const [workflowRun] = createWorkflowTools(workflows);
    const context = { workspace, signal: signal(), allowShell: false, maxOutputBytes: 24_000 };
    const raw = await workflowRun!.execute({
      script: meta + `
        const one = await agent('first task', { label: 'alpha' })
        const two = await agent('second task', { label: 'alpha' })
        log('done')
        return { one, two }`,
      args: { ignored: true },
    }, context);
    const output = JSON.parse(String(raw)) as { result: Record<string, unknown>; logs: string[]; agent_count: number };
    assert.deepEqual(output.result, { one: 'child result', two: 'child result' });
    assert.deepEqual(output.logs, ['done']);
    assert.equal(output.agent_count, 2);
    assert.equal(requests.length, 2);
    assert.match(String(requests[0]?.messages.at(-1)?.content), /first task/);

    fs.writeFileSync(path.join(workspace, 'file-flow.js'), meta + 'return args.value');
    const fromFile = JSON.parse(String(await workflowRun!.execute({ scriptPath: 'file-flow.js', args: { value: 11 } }, context))) as
      { result: unknown; agent_count: number };
    assert.equal(fromFile.result, 11);
    assert.equal(fromFile.agent_count, 0);

    await assert.rejects(workflowRun!.execute({ script: meta, scriptPath: 'file-flow.js' }, context), /exactly one/);
    await assert.rejects(workflowRun!.execute({ script: 'throw new Error("no meta")' }, context), /FIRST statement/);
    const childFailure = JSON.parse(String(await workflowRun!.execute({
      script: meta + `const value = await agent('fail task')\nreturn { value }`,
    }, context))) as { result: { value: unknown }; logs: string[]; failures: string[] };
    assert.equal(childFailure.result.value, null);
    assert.match(childFailure.logs.at(-1) ?? '', /^\[agent 1\] failed: .*provider exploded/);
    assert.match(childFailure.failures.at(-1) ?? '', /^\[agent 1\] failed: .*provider exploded/);

    const rejected = JSON.parse(String(await workflowRun!.execute({ script: meta + 'return () => 1' }, context))) as
      { result: unknown; error?: { message: string } };
    assert.equal(rejected.result, null);
    assert.equal(rejected.error?.message, 'workflow result cannot be a function');
  } finally {
    await workflows.close(); await agents.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});
