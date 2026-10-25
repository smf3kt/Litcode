import type { Agent, RunResult } from './agent.js';
import { promptBlockMessage } from './hooks.js';
import type { MediaAttachment, MediaBlocks } from './media.js';
import type { McpPromptCommand, McpPromptCommands } from './mcp-prompt.js';

/** at/We/rt/Tt, htgmc2p1 [26319,37337)/[38278,39841)/[40137,44501), UTF-16. */
export async function runMcpPrompt(agent: Agent, commands: McpPromptCommands, command: McpPromptCommand,
  args: string, signal: AbortSignal, options: { attachment?: MediaAttachment; schema?: unknown } = {}): Promise<RunResult> {
  signal.throwIfAborted();
  if (agent.isRunning()) throw new Error('Agent is already running');
  if (agent.session.awaitingResponse) throw new Error('Session has an unfinished turn; continue it first');
  const prompt = `/${command.commandName}${args ? ` ${args}` : ''}`;
  const expansion = { expansion_type: 'mcp_prompt' as const, command_name: command.commandName,
    command_args: args, command_source: 'mcp' as const, prompt };
  const hook = await agent.emitHook('UserPromptExpansion', expansion, signal);
  if (hook.blocked) return { reason: 'hook_blocked', modelCalls: 0,
    text: promptBlockMessage('UserPromptExpansion', hook.reason ?? 'blocked', prompt, hook.suppressOriginalPrompt === true) };
  if (hook.stopRequested) return { reason: 'hook_blocked', modelCalls: 0,
    text: `Operation stopped by hook${hook.reason ? `: ${hook.reason}` : ''}` };
  let content: MediaBlocks;
  try { content = await commands.invoke(command, args, signal); signal.throwIfAborted(); }
  catch (error) {
    const aborted = signal.aborted || error instanceof Error && error.name === 'AbortError';
    const text = aborted ? 'Interrupted' : String(error);
    agent.session.append({ kind: 'message', classifier: { origin: { kind: 'human' }, humanText: prompt },
      message: { role: 'user', content: prompt } });
    agent.session.append({ kind: 'message', message: { role: 'user', content: aborted ? text
      : `<local-command-stderr>${text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</local-command-stderr>` } });
    agent.session.append({ kind: 'turn_end', reason: aborted ? 'aborted' : 'command_error' });
    return { reason: aborted ? 'aborted' : 'command_error', text, modelCalls: 0 };
  }
  const marker = `<command-message>${command.commandName}</command-message>\n<command-name>/${command.commandName}</command-name>${args ? `\n<command-args>${args}</command-args>` : ''}`;
  if (options.schema !== undefined) content.push({ type: 'text', text: `Return a complete JSON value matching this schema:\n${JSON.stringify(options.schema)}` });
  return agent.run(marker, signal, options.attachment, { kind: 'raised', payload: expansion }, hook.additionalContext,
    undefined, { kind: 'human' }, content);
}
