import { classicPreToolUseEnvelope } from '../src/plugin-chain-tool-raise.js';
console.log('plain   ->', JSON.stringify(classicPreToolUseEnvelope('Bash', 'toolu_9', {command: 'ls'})));
console.log('pinned  ->', JSON.stringify(classicPreToolUseEnvelope('Bash', 'toolu_9', {command: 'ls', consent: 'yes', agentId: 'a1', requestMeta: {k: 'v'}})));
console.log('no id   ->', JSON.stringify(classicPreToolUseEnvelope('Bash', undefined, {command: 'ls'})));
