// W385 diff-callback rule-root probe with a real Session policy.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import { emptySessionPermissionUpdates, permissionDecision } from '../src/permissions.js';

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w385-diff-root-session-')));
const parent = path.join(root, 'parent'), child = path.join(root, 'child');
fs.mkdirSync(parent); fs.mkdirSync(path.join(child, 'protected'), { recursive: true });
fs.writeFileSync(path.join(child, 'protected', 'data.txt'), 'PROTECTED_FIXTURE');
fs.symlinkSync('protected/data.txt', path.join(child, 'alias.txt'));
const rule = 'Read(protected/data.txt)';
const config = { ...defaultConfig(child, []), model: 'fixture',
  permissions: { mode: 'default', allow: [], deny: [rule], ruleWorkspace: parent } };
const session = Session.open(child, { config });
const readTool = { schema: { name: 'read_file' }, readOnly: true };
const state = session.permissionUpdates;
const input = { path: 'alias.txt' };
const calls = {
  sessionDefault: () => permissionDecision(session.config.permissions, readTool, input, state, child),
  sessionNoWorkspace: () => permissionDecision(session.config.permissions, readTool, input, state),
  emptyStateChild: () => permissionDecision(session.config.permissions, readTool, input, { ...emptySessionPermissionUpdates(), ruleWorkspace: child }, child),
  policyChild: () => permissionDecision({ ...session.config.permissions, ruleWorkspace: child }, readTool, input, state, child),
};
try {
  const result = Object.fromEntries(Object.entries(calls).map(([name, run]) => [name, run().decision]));
  const policy = session.config.permissions;
  process.stdout.write(JSON.stringify({ result, configRuleWorkspace: policy?.ruleWorkspace ?? null,
    stateRuleWorkspace: state.ruleWorkspace ?? null, policyKeys: Object.keys(policy ?? {}),
    hasOwner: policy !== undefined && Object.getPrototypeOf(policy) !== Object.prototype }) + '\n');
} finally {
  await session.close();
  fs.rmSync(root, { recursive: true, force: true });
}
