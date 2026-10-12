import type { Session, SessionEvent } from './session.js';
import { mcpServerDigest } from './mcp-session-subscriptions.js';
import type { StandardMcpTask } from './mcp-standard-task.js';
export type SavedMcpTask = Extract<SessionEvent, { kind: 'mcp_task' }>;
export function persistsMcpTasks(session: { config: Session['config'] }): boolean {
  const f = session.config.features;
  return f?.mcpPersistence === true && f.mcpRecovery === true && f.mcpStandardTasks === true;
}
export function savedMcpTasks(session: Session): SavedMcpTask[] {
  if (!persistsMcpTasks(session)) return [];
  const tasks = new Map<string, SavedMcpTask>();
  for (const event of session.events) {
    if (event.kind !== 'mcp_task') continue;
    if (session.config.mcpServers?.[event.server]?.type !== 'http' || event.configDigest !== mcpServerDigest(session, event.server)) throw new Error('Persistent MCP task configuration mismatch');
    if (event.resolved !== (event.result !== undefined)) throw new Error('Persistent MCP task result is missing');
    const key = JSON.stringify([event.server, event.taskId]);
    const previous = tasks.get(key);
    if (previous && (previous.tool !== event.tool || previous.createdAt !== event.createdAt || previous.ttl !== event.ttl || previous.resolved || !event.resolved)) throw new Error('Persistent MCP task identity changed');
    tasks.set(key, event);
    if (tasks.size > 128) throw new Error('Persistent MCP task journal limit exceeded');
  }
  return [...tasks.values()];
}
export function commitMcpTask(session: Session, server: string, tool: string, task: StandardMcpTask, resolved: boolean, result?: string, isError = false): void {
  if (!persistsMcpTasks(session) || session.config.mcpServers?.[server]?.type !== 'http') throw new Error('Persistent standard HTTP tasks are disabled');
  const existing = savedMcpTasks(session).find(item => item.server === server && item.taskId === task.taskId);
  if (existing?.resolved || (existing && !resolved)) throw new Error('Persistent MCP task already recorded');
  if (existing && (existing.tool !== tool || existing.createdAt !== task.createdAt || existing.ttl !== task.ttl)) throw new Error('Persistent MCP task identity changed');
  if (!existing && (resolved || savedMcpTasks(session).length >= 128)) throw new Error('Persistent MCP task requires a recorded creation');
  if (resolved !== (result !== undefined)) throw new Error('Persistent task resolution requires durable bounded result');
  session.append({ kind: 'mcp_task', server, configDigest: mcpServerDigest(session, server), taskId: task.taskId, tool, createdAt: task.createdAt, ttl: task.ttl, resolved, ...(result === undefined ? {} : { result, isError }) });
}
