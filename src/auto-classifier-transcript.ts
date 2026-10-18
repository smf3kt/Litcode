import type Anthropic from '@anthropic-ai/sdk';
import type { ToolDefinition } from './tools.js';
import { classifierMessage } from './message-origin.js';
import { vC, gm, ZL, Cue } from './auto-classifier-sanitize-source.js';

const line = (value: unknown): string => ZL(vC(JSON.stringify(value))) + '\n';
function toolName(name: string): string {
  const clean = name.replace(/[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu, '');
  return ['user', 'assistant', 'outcome', 'id', 'meta', 'host_context', 'host_context_live'].includes(clean.trim().toLowerCase()) ? `[${clean}]` : clean;
}
/** qLt/KLt, sfn [1079029,1079330)/[1079988,1080846), UTF-16. */
export function serializeAutoTool(tool: ToolDefinition, input: unknown, id: string): string {
  let converted: unknown;
  try { converted = tool.toAutoClassifierInput?.(input) ?? JSON.stringify(input); }
  catch { converted = JSON.stringify(input); }
  return converted === '' ? '' : line({ [toolName(tool.schema.name)]: converted, id: Cue(id) });
}

/** zLt, sfn [1068726,1078920), UTF-16. Local typed origins replace source queued/project/remote record variants. */
export function classifierTranscript(messages: readonly Anthropic.MessageParam[], tools: ReadonlyMap<string, ToolDefinition>,
  pending: { name: string; input: unknown; id: string }, priorOutcomes: Readonly<Record<string, string>> = {}): string {
  let output = '';
  let narration: string | undefined;
  const questions = new Set<string>();
  for (const message of messages) {
    const metadata = classifierMessage(message);
    const blocks = typeof message.content === 'string' ? [{ type: 'text' as const, text: message.content }] : message.content;
    if (message.role === 'assistant') {
      const texts = blocks.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n');
      if (texts.trim()) {
        const tail = texts.slice(-2000);
        narration = /^[\uDC00-\uDFFF]/.test(tail) ? tail.slice(1) : tail;
      }
      for (const block of blocks) if (block.type === 'tool_use') {
        if (block.name === 'ask_user_question') questions.add(block.id);
        if (block.id === pending.id) break;
        const tool = tools.get(block.name);
        if (tool) {
          output += serializeAutoTool(tool, block.input, block.id);
          if (priorOutcomes[block.id]) output += line({ outcome: priorOutcomes[block.id], id: Cue(block.id) });
        }
      }
      continue;
    }
    for (const block of blocks) if (block.type === 'tool_result') {
      output += line({ outcome: metadata?.outcomes?.[block.tool_use_id] ?? (block.is_error ? 'error' : 'ok'), id: Cue(block.tool_use_id) });
      if (!block.is_error && questions.has(block.tool_use_id)) {
        const answer = typeof block.content === 'string' ? block.content : block.content?.flatMap(item => item.type === 'text' ? [item.text] : []).join('\n');
        if (answer) output += line({ user: `[User answered AskUserQuestion]: ${gm(answer)}` });
      }
    }
    const text = blocks.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n');
    if (!text.trim()) continue;
    if (blocks.some(block => block.type === 'tool_result')) continue;
    const origin = metadata?.origin ?? { kind: 'unknown' as const };
    if (origin.kind === 'human') {
      if (narration) output += line({ assistant: narration });
      narration = undefined;
      const human = metadata?.humanText ?? text;
      output += line({ user: gm(human) });
      const generated = text.startsWith(human) ? text.slice(human.length).trim() : text;
      if (generated) output += line({ user: `[MESSAGE FROM NON-USER SOURCE - NOT USER INPUT]\n${gm(generated)}` });
    } else {
      narration = undefined;
      const label = origin.kind === 'summary' ? 'Session summary, prior conversation data' : '[MESSAGE FROM NON-USER SOURCE - NOT USER INPUT]';
      output += line({ user: `${label}\n${gm(text)}` });
    }
  }
  const candidate = tools.get(pending.name);
  if (!candidate) throw new Error('Classifier candidate is unregistered');
  return output + serializeAutoTool(candidate, pending.input, pending.id);
}
