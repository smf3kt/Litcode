import { z } from 'zod';
import { McpTaskError, waitForPoll } from './mcp-task.js';

export const MCP_TASK_PROTOCOL_VERSION = '2025-11-25';
export const MCP_RELATED_TASK = 'io.modelcontextprotocol/related-task';
const record = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value);
const taskSchema = z.object({ taskId: z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/),
  status: z.enum(['working', 'input_required', 'completed', 'failed', 'cancelled']),
  createdAt: z.string().datetime({ offset: true }), lastUpdatedAt: z.string().datetime({ offset: true }),
  ttl: z.number().finite().int().nonnegative().nullable(), pollInterval: z.number().finite().int().nonnegative().optional(),
  statusMessage: z.string().optional(),
});
export type StandardMcpTask = z.infer<typeof taskSchema>;
export function standardTaskSupport(value: unknown): 'required' | 'optional' | 'forbidden' | undefined {
  if (!record(value) || value.taskSupport === undefined) return undefined;
  if (!['required', 'optional', 'forbidden'].includes(value.taskSupport)) throw new McpTaskError('malformed');
  return value.taskSupport;
}
export function canAugmentTask(version: string, capabilities: unknown, support: string | undefined): boolean {
  const allowed = version === MCP_TASK_PROTOCOL_VERSION && record(capabilities) && record(capabilities.tasks) &&
    record(capabilities.tasks.requests) && record(capabilities.tasks.requests.tools) && record(capabilities.tasks.requests.tools.call);
  if (support === 'required' && !allowed) throw new Error('MCP required task execution is unavailable for the negotiated server');
  return allowed && (support === 'required' || support === 'optional');
}
export function parseStandardTask(value: unknown): StandardMcpTask {
  const parsed = z.object({ task: taskSchema }).safeParse(value);
  if (!parsed.success || parsed.data.task.status !== 'working') throw new McpTaskError('malformed');
  return parsed.data.task;
}

/** Foreground requestor loop; result streams retain ordinary reverse RPC dispatch. */
export async function driveStandardMcpTask(task: StandardMcpTask, request: (method: string, params: unknown, signal: AbortSignal) => Promise<unknown>,
  signal: AbortSignal, cancelSupported: boolean): Promise<unknown> {
  let failures = 0, interval = Math.max(250, Math.min(30000, task.pollInterval ?? 1000));
  let terminal = false, first = true;
  const readResult = async () => {
    const value = await request('tasks/result', { taskId: task.taskId }, signal);
    if (!record(value) || !record(value._meta) || !record(value._meta[MCP_RELATED_TASK]) ||
      value._meta[MCP_RELATED_TASK].taskId !== task.taskId || !Array.isArray(value.content) ||
      (value.isError !== undefined && typeof value.isError !== 'boolean')) throw new McpTaskError('malformed');
    return value;
  };
  try {
    for (;;) {
      signal.throwIfAborted();
      if (!first) await waitForPoll(interval, signal);
      first = false;
      let raw: unknown;
      try { raw = await request('tasks/get', { taskId: task.taskId }, signal); }
      catch (error) {
        if (signal.aborted) throw error;
        const code = record(error) && typeof error.code === 'number' ? error.code : undefined;
        if (code !== undefined && code !== -32603 && code !== -32700 && !(code >= -32099 && code <= -32000)) throw new McpTaskError('poll_failed', code);
        if (++failures >= 5) throw new McpTaskError('poll_failed');
        continue;
      }
      const parsed = taskSchema.safeParse(raw);
      if (!parsed.success || parsed.data.taskId !== task.taskId) throw new McpTaskError('malformed');
      failures = 0; interval = Math.max(250, Math.min(30000, parsed.data.pollInterval ?? interval));
      terminal = ['completed', 'failed', 'cancelled'].includes(parsed.data.status);
      if (terminal || parsed.data.status === 'input_required') return await readResult();
    }
  } catch (error) {
    if (!terminal && cancelSupported) {
      const cleanup = AbortSignal.timeout(5000);
      let timer: NodeJS.Timeout | undefined;
      try { await Promise.race([request('tasks/cancel', { taskId: task.taskId }, cleanup).catch(() => undefined),
        new Promise<void>(resolve => { timer = setTimeout(resolve, 5000); })]); }
      finally { if (timer) clearTimeout(timer); }
    }
    if (signal.aborted) throw new McpTaskError('cancelled');
    if (error instanceof McpTaskError) throw error;
    throw new McpTaskError('poll_failed');
  }
}
