import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { expandSkill, type SkillInfo } from '../src/config.js';
import type { AgentTypeInfo } from '../src/agent-types.js';
import { createSubagentTool, preloadAgentSkills } from '../src/subagents.js';
import { AgentRegistry } from '../src/agent-registry.js';
import { createTools } from '../src/tools.js';
import type { ModelProvider } from '../src/provider.js';
import { reloadConfig } from '../src/reload.js';
import { sourceSkillArgumentsDefault } from '../src/skill-arguments.js';
import { Session } from '../src/session.js';

const source = { sourceArguments: true };

test('source skill words follow command syntax and keep substitutions inert', () => {
  const body = '$0|$1|$2';
  for (const args of ['alpha beta; gamma delta', 'A=1 alpha beta', 'alpha beta | gamma', 'alpha beta # gamma'])
    assert.equal(expandSkill(body, args, source), 'alpha|beta|$2');
  assert.equal(expandSkill(body, 'alpha $(touch marker) trailing', source), 'alpha|$1|$2');
  assert.equal(expandSkill(body, 'alpha "$(touch marker)" trailing', source), 'alpha|$(touch marker)|trailing');
  assert.equal(expandSkill(body, '"open quote', source), '"open quote|$1|$2');
  assert.equal(expandSkill(body, 'alpha beta gamma', source), 'alpha beta|gamma|$2');
  assert.equal(expandSkill(body, '"alpha\\$beta" gamma', source), 'alpha\\$beta|gamma|$2');
  assert.equal(expandSkill('$0|$1', '"" x', source), '|x');
  assert.equal(expandSkill('$0|$1', `${'a'.repeat(10001)} beta`, source), `${'a'.repeat(10001)}|beta`);
});

test('source expansion protects inserted dollars, sentinels and named positions', async () => {
  assert.equal(expandSkill('$target|$0|$ARGUMENTS[1]|$ARGUMENTS', 'alpha "beta gamma"',
    { ...source, argumentNames: ['target'] }), 'alpha|alpha|beta gamma|alpha "beta gamma"');
  assert.equal(expandSkill('$0|$1|$ARGUMENTS', '"$1" beta', source), '$1|beta|"$1" beta');
  assert.equal(expandSkill('Task', 'alpha $1', source), 'Task\n\nARGUMENTS: alpha $1');
  assert.equal(expandSkill('Task', 'alpha', { ...source, appendUnusedArguments: false }), 'Task');
  assert.equal(expandSkill('\\$ARGUMENTS[0]|\\$1|$0', 'alpha', source), '$ARGUMENTS[0]|$1|alpha');
  assert.equal(expandSkill('￿|$ARGUMENTS', '￾ $1', source), '�|� $1');
  assert.equal(expandSkill('$0|$1', 'alpha beta', { quotedArguments: true }), '$0|alpha');
  const type: AgentTypeInfo = { name: 'helper', description: 'Fixture', body: '', path: '/fixture/helper.md', mode: 'general', skills: ['preloaded'] };
  const skill: SkillInfo = { name: 'preloaded', description: 'Fixture', path: '/fixture/SKILL.md',
    body: 'Task $1 $ARGUMENTS \\$1', userInvocable: true, disableModelInvocation: false };
  assert.equal(preloadAgentSkills(type, [skill], type.name, undefined, true)[0]?.content,
    '<command-message>preloaded</command-message>\n<command-name>preloaded</command-name>\n<skill-format>true</skill-format>\nTask $1  $1');
  assert.equal(preloadAgentSkills(type, [skill], type.name)[0]?.content,
    '<command-message>preloaded</command-message>\n<command-name>preloaded</command-name>\n<skill-format>true</skill-format>\nTask   \\');
  const namedSkill = { ...skill, body: '$target|$1|$ARGUMENTS', argumentNames: ['target'] };
  assert.equal(preloadAgentSkills(type, [namedSkill], type.name)[0]?.content,
    '<command-message>preloaded</command-message>\n<command-name>preloaded</command-name>\n<skill-format>true</skill-format>\n$target||');
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'source-skill-preload-')));
  const tools = createTools().filter(tool => tool.readOnly);
  const config = defaultConfig(workspace, tools);
  config.model = 'fixture';
  config.features = { tasks: true, subagents: true, skillSourceArguments: true };
  config.agentTypes = [type]; config.skills = [skill];
  let calls = 0;
  let expectedPreload = '<command-message>preloaded</command-message>\n<command-name>preloaded</command-name>\n<skill-format>true</skill-format>\nTask $1  $1';
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    assert.equal(request.messages[0]?.content, expectedPreload);
    assert.equal(request.messages.at(-1)?.content, 'source preload task');
    calls++;
    return { id: 'fixture', type: 'message', role: 'assistant', model: 'fixture', content: [{ type: 'text', text: 'done', citations: null }],
      container: null, diagnostics: null, stop_details: null, stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
        cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
  } };
  const registry = new AgentRegistry({ source: config, tools, provider, enableAdvanced: true });
  try {
    const registered = await registry.launch({ prompt: 'source preload task', subagent_type: type.name });
    assert.equal(registered.status, 'completed', registered.error ?? undefined);
    const standalone = createSubagentTool(config, provider, tools, { enableAdvanced: true });
    const result = JSON.parse(await standalone.execute({ prompt: 'source preload task', subagent_type: type.name },
      { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 }));
    assert.equal(result.reason, 'end_turn');
    assert.equal(calls, 2);
    config.features.skillSourceArguments = false;
    config.skills = [namedSkill];
    expectedPreload = '<command-message>preloaded</command-message>\n<command-name>preloaded</command-name>\n<skill-format>true</skill-format>\n$target||';
    const legacyRegistered = await registry.launch({ prompt: 'source preload task', subagent_type: type.name });
    assert.equal(legacyRegistered.status, 'completed', legacyRegistered.error ?? undefined);
    const legacyResult = JSON.parse(await standalone.execute({ prompt: 'source preload task', subagent_type: type.name },
      { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 }));
    assert.equal(legacyResult.reason, 'end_turn');
    assert.equal(calls, 4);
  } finally {
    await registry.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('source argument selection is pinned while explicit reload resolves current settings', () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'source-skill-arguments-')));
  const userDir = path.join(workspace, 'user');
  fs.mkdirSync(userDir);
  fs.mkdirSync(path.join(workspace, '.harness'));
  const settings = path.join(workspace, '.harness/settings.json');
  let session: Session | undefined;
  try {
    assert.equal(sourceSkillArgumentsDefault(undefined), true);
    assert.equal(sourceSkillArgumentsDefault({ skillQuotedArguments: true }), false);
    assert.equal(sourceSkillArgumentsDefault({ skillExtendedArguments: false }), false);
    assert.equal(sourceSkillArgumentsDefault({ skillQuotedArguments: true, skillSourceArguments: true }), true);
    const config = defaultConfig(workspace, []);
    config.model = 'fixture';
    config.configSources = { userDir };
    config.features = { tasks: true, subagents: true };
    session = Session.open(workspace, { config });
    const id = session.id;
    const bytes = fs.readFileSync(session.file, 'utf8');
    session.close();
    fs.writeFileSync(settings, JSON.stringify({ features: { skillSourceArguments: true } }));
    session = Session.open(workspace, { id });
    assert.equal(session.config.features?.skillSourceArguments, undefined);
    assert.equal(fs.readFileSync(session.file, 'utf8'), bytes);
    assert.equal(reloadConfig(session.config).features?.skillSourceArguments, true);
    fs.writeFileSync(settings, JSON.stringify({ features: { skillQuotedArguments: true } }));
    assert.equal(reloadConfig(session.config).features?.skillSourceArguments, false);
    fs.writeFileSync(settings, '{}');
    assert.equal(reloadConfig(session.config).features?.skillSourceArguments, true);
  } finally {
    session?.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
