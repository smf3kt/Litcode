// W385 diff-callback rule-root probe after a real relocateSession.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Agent, defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import { relocateSession } from '../src/workspace-session.js';
import { permissionDecision } from '../src/permissions.js';

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w385-diff-relocate-')));
const parent = path.join(root, 'parent'), child = path.join(root, 'child');
fs.mkdirSync(parent); fs.mkdirSync(path.join(child, 'protected'), { recursive: true });
fs.writeFileSync(path.join(child, 'protected', 'data.txt'), 'PROTECTED_FIXTURE');
fs.symlinkSync('protected/data.txt', path.join(child, 'alias.txt'));
const rule = 'Read(protected/data.txt)';
const config = { ...defaultConfig(parent, []), model: 'fixture',
  permissions: { mode: 'default', allow: [], deny: [rule], ruleWorkspace: parent },
  features: { tasks: false, subagents: false, sourcePlanTools: true } };
const source = Session.open(parent, { config });
const provider = { count: async () => 1, complete: async () => ({ id: 'fixture', model: 'fixture', type: 'message', role: 'assistant',
  content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }) };
await new Agent(source, provider, []).run('hello');
const relocated = relocateSession(source, child, () => []);
const readTool = { schema: { name: 'read_file' }, readOnly: true };
const state = relocated.permissionUpdates, input = { path: 'alias.txt' };
try {
  const decisions = {
    relocatedDefault: permissionDecision(relocated.config.permissions, readTool, input, state, child).decision,
    relocatedNoWorkspace: permissionDecision(relocated.config.permissions, readTool, input, state).decision,
    policyChild: permissionDecision({ ...relocated.config.permissions, ruleWorkspace: child }, readTool, input, state, child).decision,
    stateChild: permissionDecision(relocated.config.permissions, readTool, input, { ...state, ruleWorkspace: child }, child).decision,
  };
  process.stdout.write(JSON.stringify({ decisions, stateRuleWorkspace: state.ruleWorkspace ?? null,
    stateRuleRoots: state.ruleRoots ?? null, configRuleWorkspace: relocated.config.permissions?.ruleWorkspace ?? null }) + '\n');
} finally {
  await source.close(); await relocated.close();
  fs.rmSync(root, { recursive: true, force: true });
}
