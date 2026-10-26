import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { createTaskTools, readTaskRecords } from '../src/tasks.js';
import { createRuntime, parseSettings, pinToolSchemas } from '../src/runtime.js';
import { Session, managedPolicySchema } from '../src/session.js';
import { reloadConfig } from '../src/reload.js';
import type { ToolContext } from '../src/tools.js';
import type { ModelProvider } from '../src/provider.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'task-visibility-test-')));
const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('No model request expected'); } };
const context = (workspace: string): ToolContext => ({ workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 });
const call = async (workspace: string, name: string, input: unknown, sourceVisibility?: boolean) => {
  const tool = createTaskTools(workspace, { reciprocal: true, sourceVisibility }).find(tool => tool.schema.name === name);
  assert.ok(tool); return JSON.parse(await tool.execute(input, context(workspace)));
};

test('source lists filter truthy internal tasks while direct Get and legacy projections retain their contracts', async () => {
  const workspace = temporary();
  try {
    const markers = [false, 0, '', null, true, 1, 'internal', [], {}];
    const ids: string[] = [];
    for (const [index, marker] of markers.entries()) {
      const task = await call(workspace, 'task_create', { subject: `Task ${index}`, description: 'owned', metadata: { _internal: marker, shown: index } });
      ids.push(task.id);
    }
    assert.deepEqual((await call(workspace, 'task_list', {}, true)).map((task: { id: string }) => task.id), ids.slice(0, 4));
    for (const source of [undefined, false]) assert.deepEqual((await call(workspace, 'task_list', {}, source)).map((task: { id: string }) => task.id), ids);
    assert.deepEqual(readTaskRecords(workspace, true).map(task => task.id), ids.slice(0, 4));
    assert.deepEqual(readTaskRecords(workspace).map(task => task.id), ids);
    const hidden = await call(workspace, 'task_get', { id: ids[4] }, true);
    assert.equal(hidden.id, ids[4]); assert.deepEqual(hidden.metadata, { shown: 4 });
    assert.equal(readTaskRecords(workspace).find(task => task.id === ids[4])?.metadata._internal, true);
    for (const sourceVisibility of [undefined, false, true]) {
      assert.deepEqual(createTaskTools(workspace, { reciprocal: true, sourceVisibility }).map(tool => tool.schema),
        createTaskTools(workspace, { reciprocal: true }).map(tool => tool.schema));
    }
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('source List derives completed blockers from visible tasks before status filtering and keeps durable edges', async () => {
  const workspace = temporary();
  try {
    const internal = await call(workspace, 'task_create', { subject: 'Hidden', description: '', metadata: { _internal: true } });
    const visible = await call(workspace, 'task_create', { subject: 'Visible blocker', description: '' });
    const dependent = await call(workspace, 'task_create', { subject: 'Dependent', description: '' });
    await call(workspace, 'task_update', { id: dependent.id, addBlockedBy: [internal.id, visible.id] });
    await call(workspace, 'task_update', { id: internal.id, status: 'completed' });
    await call(workspace, 'task_update', { id: visible.id, status: 'completed' });
    const list = await call(workspace, 'task_list', { status: 'pending' }, true);
    assert.deepEqual(list.map((task: { id: string }) => task.id), [dependent.id]);
    assert.deepEqual(list[0].blockedBy, [internal.id]); assert.equal(list[0].ready, false);
    assert.deepEqual((await call(workspace, 'task_get', { id: dependent.id }, true)).blockedBy, []);
    assert.deepEqual((await call(workspace, 'task_list', { status: 'pending' }, false))[0].blockedBy, []);
    assert.deepEqual(readTaskRecords(workspace).find(task => task.id === dependent.id)?.blockedBy, [internal.id, visible.id]);
    await call(workspace, 'task_update', { id: internal.id, removeBlocks: [dependent.id] });
    assert.equal((await call(workspace, 'task_list', { status: 'pending' }, true))[0].ready, true);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('settings, original metadata, Runtime display and explicit reload share one pinned visibility choice', async () => {
  const workspace = temporary(), userDir = path.join(workspace, 'user'); fs.mkdirSync(userDir);
  const settings = path.join(userDir, 'settings.json');
  try {
    assert.equal(parseSettings({ features: { taskSourceVisibility: false } }).features?.taskSourceVisibility, false);
    assert.throws(() => parseSettings({ features: { taskSourceVisibility: 'true' } }));
    assert.equal(managedPolicySchema.parse({ features: { taskSourceVisibility: false } }).features?.taskSourceVisibility, false);
    const hidden = await call(workspace, 'task_create', { subject: 'Internal', description: '', metadata: { _internal: true } });
    for (const selected of [undefined, false, true]) {
      const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir },
        features: { tasks: true, subagents: false, taskProjections: true, ...(selected === undefined ? {} : { taskSourceVisibility: selected }) } };
      let runtime = await createRuntime(config, provider, new AbortController().signal);
      config.tools = pinToolSchemas(runtime.tools);
      let session = Session.open(workspace, { config });
      try {
        await runtime.bindSession!(session);
        const original = fs.readFileSync(session.file);
        assert.deepEqual(runtime.taskRecords!(session.config).map(task => task.id), selected === true ? [] : [hidden.id]);
        await runtime.close(); session.close();
        fs.writeFileSync(settings, JSON.stringify({ features: { taskSourceVisibility: true } }));
        session = Session.open(workspace, { id: session.id });
        runtime = await createRuntime(session.config, provider, new AbortController().signal);
        await runtime.bindSession!(session);
        const listTool = runtime.buildTools(session.config, session.id).find(tool => tool.schema.name === 'task_list'); assert.ok(listTool);
        assert.deepEqual(JSON.parse(await listTool.execute({}, context(workspace))).map((task: { id: string }) => task.id), selected === true ? [] : [hidden.id]);
        assert.deepEqual(fs.readFileSync(session.file), original);
        const next = reloadConfig(session.config);
        assert.equal(next.features?.taskSourceVisibility, true);
        fs.writeFileSync(settings, JSON.stringify({ features: { taskSourceVisibility: false } }));
        assert.equal(reloadConfig(session.config).features?.taskSourceVisibility, false);
      } finally { await runtime.close(); session.close(); }
    }
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
