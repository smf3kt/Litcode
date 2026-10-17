import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import type { AgentRegistry } from '../src/agent-registry.js';
import {
  clearNamedWorkflowCache, configureNamedWorkflows, listNamedWorkflows, resolveNamedWorkflow,
} from '../src/workflow-named.js';
import { parseWorkflowScript } from '../src/workflow-script.js';
import { createWorkflowTools, WorkflowRegistry } from '../src/workflow.js';

const roots: string[] = [];
const logs: string[] = [];

function meta(name: string, description = name): string {
  return `export const meta = { name: ${JSON.stringify(name)}, description: ${JSON.stringify(description)} }`;
}

async function writeWorkflow(directory: string, file: string, name: string, description?: string): Promise<string> {
  await fs.mkdir(directory, { recursive: true });
  const target = path.join(directory, file);
  await fs.writeFile(target, `${meta(name, description)}\nreturn ${JSON.stringify(name)}\n`);
  return target;
}

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-workflow-named-'));
  roots.push(root);
  return root;
}

beforeEach(() => {
  logs.length = 0;
  configureNamedWorkflows({ plugins: [], bundled: [], bundledOnly: false, logger: (message) => logs.push(message) });
});

afterEach(async () => {
  clearNamedWorkflowCache();
  configureNamedWorkflows({ userDir: undefined, plugins: [], bundled: [], bundledOnly: false, logger: undefined });
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

test('discovery merges the user and project providers and the inner project directory wins', async () => {
  const root = await temporaryRoot();
  const userDir = path.join(root, 'user');
  const outer = path.join(root, 'repo');
  const workspace = path.join(outer, 'pkg');
  await writeWorkflow(path.join(userDir, 'workflows'), 'alpha.js', 'alpha', 'from user');
  await writeWorkflow(path.join(userDir, 'workflows'), 'user-only.js', 'user-only');
  await writeWorkflow(path.join(outer, '.harness', 'workflows'), 'alpha.js', 'alpha', 'from outer project');
  await writeWorkflow(path.join(outer, '.harness', 'workflows'), 'outer-only.js', 'outer-only');
  await writeWorkflow(path.join(workspace, '.harness', 'workflows'), 'alpha.js', 'alpha', 'from inner project');
  await writeWorkflow(path.join(workspace, '.harness', 'workflows'), 'inner-only.js', 'inner-only');
  configureNamedWorkflows({ userDir });

  const catalog = await listNamedWorkflows(workspace);
  assert.deepEqual(catalog.map(entry => entry.name), ['alpha', 'inner-only', 'outer-only', 'user-only']);
  const alpha = catalog.find(entry => entry.name === 'alpha')!;
  assert.equal(alpha.description, 'from inner project');
  assert.equal(alpha.source, 'projectSettings');
  assert.equal(catalog.find(entry => entry.name === 'user-only')!.source, 'userSettings');
  assert.match(alpha.script, /^export const meta/);
});

test('an unparsable project override keeps the earlier copy', async () => {
  const root = await temporaryRoot();
  const userDir = path.join(root, 'user');
  const workspace = path.join(root, 'repo');
  await writeWorkflow(path.join(userDir, 'workflows'), 'same.js', 'same', 'from user');
  const projectDir = path.join(workspace, '.harness', 'workflows');
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(path.join(projectDir, 'same.js'), `${meta('same', 'broken project')}\nreturn (\n`);
  configureNamedWorkflows({ userDir });

  const catalog = await listNamedWorkflows(workspace);
  const same = catalog.find(entry => entry.name === 'same')!;
  assert.equal(same.description, 'from user');
  assert.equal(same.source, 'userSettings');
  assert.match(logs.join('\n'), /would override same/);
});

test('meta-only discovery lists a workflow whose body does not parse', async () => {
  const root = await temporaryRoot();
  const workspace = path.join(root, 'repo');
  const projectDir = path.join(workspace, '.harness', 'workflows');
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(path.join(projectDir, 'broken.js'), `${meta('broken')}\nreturn (\n`);

  const catalog = await listNamedWorkflows(workspace);
  assert.deepEqual(catalog.map(entry => entry.name), ['broken']);

  const parsed = parseWorkflowScript(`${meta('broken')}\nreturn (\n`, { validateBody: false });
  assert.ok(!('error' in parsed));
  assert.equal(parsed.meta.name, 'broken');
  assert.ok('error' in parseWorkflowScript(`${meta('broken')}\nreturn (\n`));
});

test('oversize files and near-miss extensions are skipped', async () => {
  const root = await temporaryRoot();
  const workspace = path.join(root, 'repo');
  const projectDir = path.join(workspace, '.harness', 'workflows');
  await writeWorkflow(projectDir, 'ok.js', 'ok');
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(path.join(projectDir, 'typed.ts'), `${meta('typed')}\nreturn 1\n`);
  await fs.writeFile(path.join(projectDir, 'huge.js'), `${meta('huge')}\n${'x'.repeat(524_289)}\n`);

  const catalog = await listNamedWorkflows(workspace);
  assert.deepEqual(catalog.map(entry => entry.name), ['ok']);
  assert.match(logs.join('\n'), /exceeds 524288 bytes/);
});

test('the catalog cache is per workspace and clears on demand', async () => {
  const root = await temporaryRoot();
  const workspace = path.join(root, 'repo');
  const projectDir = path.join(workspace, '.harness', 'workflows');
  await writeWorkflow(projectDir, 'first.js', 'first');

  const first = await listNamedWorkflows(workspace);
  const second = await listNamedWorkflows(workspace);
  assert.equal(first, second);
  await writeWorkflow(projectDir, 'later.js', 'later');
  assert.deepEqual((await listNamedWorkflows(workspace)).map(entry => entry.name), ['first']);

  clearNamedWorkflowCache();
  assert.deepEqual((await listNamedWorkflows(workspace)).map(entry => entry.name), ['first', 'later']);
});

test('resolution matches the exact workflow name', async () => {
  const root = await temporaryRoot();
  const workspace = path.join(root, 'repo');
  await writeWorkflow(path.join(workspace, '.harness', 'workflows'), 'alpha.js', 'alpha');

  const found = await resolveNamedWorkflow('alpha', workspace);
  assert.equal(found?.name, 'alpha');
  assert.match(found!.filePath, /alpha\.js$/);
  assert.equal(await resolveNamedWorkflow('alp', workspace), undefined);
});

test('bundled-only narrows the catalog to the bundled provider', async () => {
  const root = await temporaryRoot();
  const workspace = path.join(root, 'repo');
  await writeWorkflow(path.join(workspace, '.harness', 'workflows'), 'project.js', 'project');
  configureNamedWorkflows({
    bundledOnly: true,
    bundled: [{
      source: 'built-in', name: 'builtin', description: 'bundled', script: `${meta('builtin')}\nreturn 1`,
      filePath: 'builtin',
    }],
  });

  const catalog = await listNamedWorkflows(workspace);
  assert.deepEqual(catalog.map(entry => entry.name), ['builtin']);
});

test('workflow_run resolves a name, lists alternatives, and lets an explicit script win', async () => {
  const root = await temporaryRoot();
  const workspace = path.join(root, 'repo');
  await writeWorkflow(path.join(workspace, '.harness', 'workflows'), 'named.js', 'named');
  const agents = { limits: { maxMessageBytes: 32 * 1024, maxOutputBytes: 24_000 } } as unknown as AgentRegistry;
  const [workflowRun] = createWorkflowTools(new WorkflowRegistry({ agents }));
  const context = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24_000 };

  const named = JSON.parse(String(await workflowRun!.execute({ name: 'named' }, context))) as { result: unknown };
  assert.equal(named.result, 'named');

  await assert.rejects(workflowRun!.execute({ name: 'missing' }, context),
    /Workflow "missing" not found\. Available: named/);

  const overridden = JSON.parse(String(await workflowRun!.execute({
    name: 'named', script: `${meta('alternate')}\nreturn 2`,
  }, context))) as { result: unknown };
  assert.equal(overridden.result, 2);
});

async function runnableTools(workspace: string) {
  const agents = { limits: { maxMessageBytes: 32 * 1024, maxOutputBytes: 24_000 } } as unknown as AgentRegistry;
  const [workflowRun] = createWorkflowTools(new WorkflowRegistry({ agents }));
  const context = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24_000 };
  return { workflowRun: workflowRun!, context };
}

test('a script can nest a named workflow with args, logs, phases and the one-level limit', async () => {
  const root = await temporaryRoot();
  const workspace = path.join(root, 'repo');
  const projectDir = path.join(workspace, '.harness', 'workflows');
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(path.join(projectDir, 'child.js'),
    `${meta('child')}\nlog('hello')\nphase('hidden')\nreturn { ok: args === undefined ? null : args.value }\n`);
  await fs.writeFile(path.join(projectDir, 'nested.js'),
    `${meta('nested')}\ntry { await workflow('child') } catch (error) { return error.message }\n`);
  const { workflowRun, context } = await runnableTools(workspace);

  const child = JSON.parse(String(await workflowRun.execute({
    script: `${meta('parent')}\nphase('parent')\nreturn await workflow('child', { value: 4 })`,
  }, context))) as { result: { ok: number }; logs: string[]; phases: string[] };
  assert.deepEqual(child.result, { ok: 4 });
  assert.ok(child.logs.includes('[child] hello'));
  assert.ok(child.phases.includes('▸ child'));
  assert.ok(child.phases.includes('parent'));
  assert.ok(!child.phases.includes('hidden'));

  const nested = JSON.parse(String(await workflowRun.execute({
    script: `${meta('parent')}\nreturn await workflow('nested')`,
  }, context))) as { result: string };
  assert.equal(nested.result, 'workflow() cannot be called from within a child workflow '
    + '— nesting is limited to one level. Inline the inner script or call its agents directly.');
});

test('nested workflow resolution reports missing names, bad requests and scriptPath children', async () => {
  const root = await temporaryRoot();
  const workspace = path.join(root, 'repo');
  const projectDir = path.join(workspace, '.harness', 'workflows');
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(path.join(projectDir, 'leaf.js'), `${meta('leaf')}\nreturn 9\n`);
  await fs.writeFile(path.join(workspace, 'path-child.js'), `${meta('path-child')}\nreturn 11\n`);
  const { workflowRun, context } = await runnableTools(workspace);

  const missing = JSON.parse(String(await workflowRun.execute({
    script: `${meta('parent')}\nawait workflow('absent')`,
  }, context))) as { error: { message: string } };
  assert.match(missing.error.message, /workflow\('absent'\): no workflow with that name\. Available: leaf/);

  const bad = JSON.parse(String(await workflowRun.execute({
    script: `${meta('parent')}\nawait workflow(42)`,
  }, context))) as { error: { message: string } };
  assert.equal(bad.error.message, 'workflow() expects a workflow name (string) or {scriptPath: string}');

  const fromPath = JSON.parse(String(await workflowRun.execute({
    script: `${meta('parent')}\nreturn await workflow({ scriptPath: 'path-child.js' })`,
  }, context))) as { result: number };
  assert.equal(fromPath.result, 11);

  process.env.HARNESS_WORKFLOW_NAME_ONLY = '1';
  try {
    const nameOnly = JSON.parse(String(await workflowRun.execute({
      script: `${meta('parent')}\nawait workflow({ scriptPath: 'path-child.js' })`,
    }, context))) as { error: { message: string } };
    assert.match(nameOnly.error.message, /HARNESS_WORKFLOW_NAME_ONLY is set/);
  } finally {
    delete process.env.HARNESS_WORKFLOW_NAME_ONLY;
  }

  const twice = JSON.parse(String(await workflowRun.execute({
    script: `${meta('parent')}\nawait workflow('leaf')\nreturn await workflow('leaf')`,
  }, context))) as { result: number; phases: string[] };
  assert.equal(twice.result, 9);
  assert.ok(twice.phases.includes('▸ leaf'));
  assert.ok(twice.phases.includes('▸ leaf #2'));
});
