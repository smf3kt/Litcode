import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import { Agent, defaultConfig } from '../src/agent.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { Session } from '../src/session.js';
import { buildSystem } from '../src/runtime.js';
import type { SkillInfo } from '../src/config.js';
import { agentTypesSection, skillsSection } from '../src/skill-catalog.js';
import { allocateContextTokens, contextDetails } from '../src/context-details.js';
import { contextDetailGroups, contextPanelText, contextUsageFromCounts } from '../src/context-panel.js';
import { interactiveLoop } from '../src/interactive.js';
import type { TerminalCallbacks, TerminalPromptRequest, TerminalSurface } from '../src/terminal.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'context-detail-test-')));
function fixture(workspace: string) {
  const skill = (name: string, source: SkillInfo['source'], mode?: SkillInfo['mode']): SkillInfo => ({ name,
    source, mode, description: `${name} description`, body: 'NEVER_COUNT_THE_FULL_SKILL_BODY',
    path: path.join(workspace, name, 'SKILL.md'), userInvocable: true, disableModelInvocation: false });
  const skills = [skill('user-skill', 'userSettings'), skill('project-skill', 'projectSettings', 'name-only'),
    skill('hidden-skill', 'projectSettings', 'off'), skill('manual-skill', 'projectSettings', 'user-invocable-only')];
  const agentTypes = [{ name: 'custom-reviewer', description: 'Review the owned fixture.', mode: 'general' as const,
    body: 'NEVER_COUNT_THE_FULL_AGENT_BODY', path: path.join(workspace, '.harness', 'agents', 'reviewer.md') }];
  const file = path.join(workspace, 'AGENTS.md'), tools = [{ name: 'read_file', description: 'read', input_schema: { type: 'object' as const } },
    { name: 'mcp__owned__inspect', description: 'inspect', input_schema: { type: 'object' as const } }];
  const config = { ...defaultConfig(workspace, []), model: 'fixture', skills, agentTypes, tools,
    system: buildSystem('BASE_CONTEXT', [{ path: file, content: 'PINNED_INSTRUCTIONS' }], skills) + agentTypesSection(agentTypes),
    instructionSources: [{ path: file }] };
  return { config, file };
}

test('included rows partition counted totals, preserve source groups and render summary or expanded details', () => {
  const workspace = temporary();
  try {
    const { config, file } = fixture(workspace);
    const details = contextDetails(config, config.system + '\nHOST_FACTS', 2000, 500);
    assert.deepEqual(details.skills.map(row => row.name), ['user-skill', 'project-skill']);
    assert.deepEqual(details.agents.map(row => row.name), ['custom-reviewer']);
    assert.deepEqual(details.memoryFiles.map(row => row.name), [file]);
    assert.deepEqual(details.mcpTools.map(row => row.name), ['mcp__owned__inspect']);
    assert.deepEqual([...contextDetailGroups(details.skills).keys()], ['Project', 'User']);
    assert.deepEqual(allocateContextTokens(7, [1, 1, 1]), [3, 2, 2]);
    const usage = contextUsageFromCounts({ model: 'fixture', systemTokens: 2000, toolTokens: 500,
      messageTokens: 300, maxTokens: 10000, compactAt: 6000, autoCompact: true, details });
    assert.equal(usage.categories.filter(row => row.kind === 'category').reduce((sum, row) => sum + row.tokens, 0), 2800);
    assert.deepEqual(usage.categories.map(row => row.name), ['System prompt', 'System tools', 'MCP tools',
      'Custom agents', 'Memory files', 'Skills', 'Messages', 'Autocompact buffer', 'Free space']);
    const expanded = contextPanelText(usage, { workspace });
    assert.match(expanded, /MCP tools · \/mcp\n  mcp__owned__inspect:/);
    assert.match(expanded, /Memory files · \/memory\n  AGENTS\.md:/);
    assert.match(expanded, /Skills · \/skills\n  Project\n    project-skill:/);
    assert.doesNotMatch(expanded, /hidden-skill|manual-skill|NEVER_COUNT/);
    const collapsed = contextPanelText(usage, { collapseDetails: true });
    assert.match(collapsed, /2 skills · /);
    assert.match(collapsed, /\/context all to expand$/);
    assert.doesNotMatch(collapsed, /project-skill:|custom-reviewer:|mcp__owned__inspect:/);
    const stale = contextDetails({ ...config, skills: [] }, 'CUSTOM_OVERRIDE', 2000, 500);
    assert.deepEqual(stale.skills, []); assert.deepEqual(stale.agents, []); assert.deepEqual(stale.memoryFiles, []);
    const appended = { ...config, system: buildSystem('BASE_CONTEXT', [
      { path: file, content: 'PINNED_INSTRUCTIONS' },
      { path: path.join(workspace, '.harness', 'memory', 'extra.md'), content: 'UNTRACKED_MEMORY' },
    ], config.skills!) + agentTypesSection(config.agentTypes!) };
    assert.deepEqual(contextDetails(appended, appended.system, 2000, 500).memoryFiles, []);
    for (const example of [skillsSection(config.skills!), agentTypesSection(config.agentTypes!)]) {
      const duplicate = { ...config, system: buildSystem('BASE_CONTEXT', [
        { path: file, content: `PINNED_INSTRUCTIONS${example}` },
      ], config.skills!) + agentTypesSection(config.agentTypes!) };
      assert.deepEqual(contextDetails(duplicate, duplicate.system, 2000, 500).memoryFiles, []);
    }
    const prefixes = [{ ...config.skills![1]!, name: 'same' }, { ...config.skills![1]!, name: 'same-long' }];
    const prefixConfig = { ...config, skills: prefixes, system: buildSystem('BASE_CONTEXT', [], prefixes) };
    assert.deepEqual(contextDetails(prefixConfig, prefixConfig.system, 2000, 500).skills.map(row => row.name), ['same', 'same-long']);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('three counts share one detached request and pinned provenance without reading files or mutating the journal', async () => {
  const workspace = temporary(), { config, file } = fixture(workspace);
  const tools = config.tools.map(schema => ({ schema, readOnly: true, async execute() { return ''; } }));
  config.tools = tools.map(tool => ({ ...tool.schema, eager_input_streaming: true }));
  const session = Session.open(workspace, { config });
  session.append({ kind: 'message', message: { role: 'user', content: 'ORIGINAL_MESSAGE' } });
  session.append({ kind: 'message', message: { role: 'assistant', content: 'ORIGINAL_ANSWER' } });
  session.append({ kind: 'turn_end', reason: 'end_turn' });
  fs.writeFileSync(file, 'DISK_CHANGED_AFTER_PINNING');
  const original = fs.readFileSync(session.file, 'utf8'), requests: ModelRequest[] = [];
  let mutate = true;
  const provider: ModelProvider = { complete: async () => { throw new Error('context never completes a model turn'); },
    count: async request => {
      if (mutate) { mutate = false; session.config.skills!.length = 0; session.config.system = 'CHANGED_LIVE_SYSTEM'; }
      requests.push(request);
      return request.messages.length ? 3000 : request.tools?.length ? 2500 : 2000;
    } };
  try {
    const counts = await new Agent(session, provider, tools).contextBreakdown();
    assert.equal(requests.length, 3);
    assert.match(String(requests[0]!.system), /PINNED_INSTRUCTIONS/);
    assert.equal(requests[0]!.system, requests[1]!.system); assert.equal(requests[1]!.system, requests[2]!.system);
    assert.equal(counts.systemTokens, 2000); assert.equal(counts.toolTokens, 500); assert.equal(counts.messageTokens, 500);
    assert.deepEqual(counts.details!.skills.map(row => row.name), ['user-skill', 'project-skill']);
    assert.deepEqual(counts.details!.memoryFiles.map(row => row.name), [file]);
    assert.equal(fs.readFileSync(session.file, 'utf8'), original);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('context all expands full-screen details, inline expands by default and headless keeps JSON without completion calls', async () => {
  for (const [presentation, command, collapsed, modal] of [
    ['fullscreen', '/context', true, true], ['fullscreen', '/context ALL', false, true],
    ['inline', '/context', false, true], ['inline', '/context', false, false],
  ] as const) {
    const workspace = temporary(), { config } = fixture(workspace); config.tools = [];
    const session = Session.open(workspace, { config });
    let printed = '', count = 0;
    const output = new Writable({ write(chunk, _encoding, done) { printed += String(chunk); done(); } });
    let callbacks: TerminalCallbacks | undefined, panel: TerminalPromptRequest | undefined;
    const terminal: TerminalSurface = { isTTY: true, presentation, outputStream: output,
      subscribe(value) { callbacks = value; return () => {}; },
      start() { queueMicrotask(() => callbacks?.onSubmit?.(command)); }, close() {},
      setRunning(running) { if (!modal && !running) setImmediate(() => callbacks?.onExit?.()); },
      setKeybindings() {}, writeTerminalSequence() {},
      ...(modal ? { async prompt(request: TerminalPromptRequest) { panel = request;
        setImmediate(() => callbacks?.onExit?.()); return undefined; } } : {}) };
    const provider: ModelProvider = { count: async () => { count++; return 1000; }, complete: async () => { throw new Error('no completion'); } };
    try {
      await interactiveLoop(session, provider, { tools: [], buildTools: () => [], close: async () => {}, limits: [] },
        { input: new PassThrough(), output, status: output, terminal, signal: new AbortController().signal });
      assert.equal(count, 3);
      if (modal) assert.ok(panel); else assert.match(printed, /Context Usage/);
      const message = panel?.message ?? printed;
      assert.equal(message.includes('/context all to expand'), collapsed);
      assert.equal(message.includes('project-skill:'), !collapsed);
    } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
  }
  const workspace = temporary(), config = { ...defaultConfig(workspace, []), model: 'fixture' }, session = Session.open(workspace, { config });
  let text = '', counts = 0;
  const output = new Writable({ write(chunk, _encoding, done) { text += String(chunk); done(); } });
  try {
    await interactiveLoop(session, { count: async () => { counts++; return 123; }, complete: async () => { throw new Error('no completion'); } },
      { tools: [], buildTools: () => [], close: async () => {}, limits: [] },
      { input: Readable.from(['/context all\n', '/exit\n']), output,
        status: new Writable({ write(_chunk, _encoding, done) { done(); } }), signal: new AbortController().signal });
    assert.equal(counts, 1); const json = JSON.parse(text.trim());
    assert.equal(json.inputTokens, 123); assert.equal(json.contextTokens, config.contextTokens);
    assert.equal(Object.hasOwn(json, 'details'), false);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
