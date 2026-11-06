import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { AgentRegistry } from '../src/agent-registry.js';
import type { ModelProvider } from '../src/provider.js';
import { createTools } from '../src/tools.js';

const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w132-probe-')));
const tools = createTools();
const config = defaultConfig(workspace, tools);
config.model = 'test';
config.allowShell = true;
let calls = 0;
const provider: ModelProvider = {
  count: async () => 0,
  complete: async request => {
    calls += 1;
    console.log('--- request', calls);
    console.log('system tail:', String(request.system).slice(-300));
    console.log('tools:', request.tools?.map(tool => 'name' in tool ? tool.name : ''));
    console.log('messages:', JSON.stringify(request.messages.map(message => ({
      role: message.role,
      content: typeof message.content === 'string' ? message.content.slice(0, 80)
        : message.content.map(block => block.type === 'text' ? `text:${block.text.slice(0, 80)}` : block.type),
    }))));
    const content: Anthropic.ContentBlock[] = calls === 1
      ? [{ type: 'tool_use', id: 'out-bad', name: 'StructuredOutput', input: { wrong: true } } as Anthropic.ContentBlock]
      : [{ type: 'tool_use', id: 'out-good', name: 'StructuredOutput', input: { answer: 'fixed' } } as Anthropic.ContentBlock];
    return { id: 'fixture', model: 'test', type: 'message', role: 'assistant', content,
      stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
  },
};
const registry = new AgentRegistry({ source: () => config, tools, provider });
const child = await registry.launch({ prompt: 'return json',
  structured_schema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'],
    additionalProperties: false } });
console.log('status', child.status, 'error', child.error, 'reason', child.reason);
console.log('structured', JSON.stringify(child.structured_output), 'serr', child.structured_error);
await registry.close();
fs.rmSync(workspace, { recursive: true, force: true });
