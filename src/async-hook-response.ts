import { z } from 'zod';
import { permissionUpdateListSchema } from './permissions.js';
import { syncJsonAfterAsyncHeader, type CommandHookExecution } from './hooks.js';

// Copy/adapt L1/Une/NI, n3ykh62m SHA-256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac,
// [390486,396651), zero-based half-open UTF-16. Descriptions removed; permission updates use the existing host adapter.
const context = <T extends string>(event: T) => z.object({ hookEventName: z.literal(event), additionalContext: z.string().optional() });
const responseSchema = z.object({
  continue: z.boolean().optional(), suppressOutput: z.boolean().optional(), stopReason: z.string().optional(),
  decision: z.enum(['approve', 'block']).optional(), reason: z.string().optional(), systemMessage: z.string().optional(), terminalSequence: z.string().optional(),
  hookSpecificOutput: z.union([
    z.object({ hookEventName: z.literal('PreToolUse'), permissionDecision: z.enum(['allow', 'deny', 'ask', 'defer']).optional(),
      permissionDecisionReason: z.string().optional(), updatedInput: z.record(z.unknown()).optional(), additionalContext: z.string().optional() }),
    context('UserPromptSubmit').extend({ sessionTitle: z.string().optional(), suppressOriginalPrompt: z.boolean().optional() }),
    context('UserPromptExpansion').extend({ suppressOriginalPrompt: z.boolean().optional() }),
    context('SessionStart').extend({ initialUserMessage: z.string().optional(), sessionTitle: z.string().optional(), watchPaths: z.array(z.string()).optional(), reloadSkills: z.boolean().optional() }),
    context('Setup'),
    z.object({ hookEventName: z.literal('PreModelSwitch'), permissionDecision: z.enum(['allow', 'deny', 'ask']).optional(), permissionDecisionReason: z.string().optional() }),
    context('PostModelSwitch'), context('SubagentStart'),
    context('PostToolUse').extend({ classifierContext: z.string().optional(), updatedToolOutput: z.unknown().optional(), updatedMCPToolOutput: z.unknown().optional() }),
    context('PostToolUseFailure'), context('PostToolBatch'), context('Stop'), context('SubagentStop'),
    z.object({ hookEventName: z.literal('PermissionDenied'), retry: z.boolean().optional() }), context('Notification'),
    z.object({ hookEventName: z.literal('PermissionRequest'), decision: z.union([
      z.object({ behavior: z.literal('allow'), updatedInput: z.record(z.unknown()).optional(), updatedPermissions: permissionUpdateListSchema.optional() }),
      z.object({ behavior: z.literal('deny'), message: z.string().optional(), interrupt: z.boolean().optional() }),
    ]) }),
    z.object({ hookEventName: z.literal('Elicitation'), action: z.enum(['accept', 'decline', 'cancel']).optional(), content: z.record(z.unknown()).optional() }),
    z.object({ hookEventName: z.literal('ElicitationResult'), action: z.enum(['accept', 'decline', 'cancel']).optional(), content: z.record(z.unknown()).optional() }),
    z.object({ hookEventName: z.literal('CwdChanged'), watchPaths: z.array(z.string()).optional() }),
    z.object({ hookEventName: z.literal('FileChanged'), watchPaths: z.array(z.string()).optional() }),
    z.object({ hookEventName: z.literal('WorktreeCreate'), worktreePath: z.string() }),
    z.object({ hookEventName: z.literal('MessageDisplay'), displayContent: z.string().optional() }),
  ]).optional(),
});
const object = z.record(z.unknown());
const outputSchema = z.union([z.object({ async: z.literal(true), asyncTimeout: z.number().optional() }), responseSchema]);

// Adapt ybt, sfn1dbxq SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// [622984,624230), UTF-16. Diagnostic telemetry omitted; retain the same recognized-field salvage.
export function parseAsyncHookResponse(value: unknown): Record<string, unknown> {
  const input = object.safeParse(value);
  if (!input.success) return {};
  const parsed = outputSchema.safeParse(input.data);
  if (parsed.success && !('async' in parsed.data && parsed.data.async === true)) return parsed.data;
  const result: Record<string, unknown> = {};
  if (typeof input.data.systemMessage === 'string') result.systemMessage = input.data.systemMessage;
  const metrics = object.safeParse(input.data.metrics);
  if (metrics.success) result.metrics = Object.fromEntries(Object.entries(metrics.data).filter(([, value]) => typeof value === 'boolean' || typeof value === 'number'));
  const specific = object.safeParse(input.data.hookSpecificOutput);
  if (specific.success) {
    const { additionalContext, ...rest } = specific.data;
    result.hookSpecificOutput = typeof additionalContext === 'string' ? specific.data : rest;
  }
  return result;
}

export const asyncHookAttachmentSchema = z.object({ type: z.literal('async_hook_response'), processId: z.string(),
  hookName: z.string(), hookEvent: z.string(), toolName: z.string().optional(), command: z.string().optional(), pluginId: z.string().optional(),
  response: object, stdout: z.string(), stderr: z.string(), exitCode: z.number().nullable() }).strict();
export type AsyncHookAttachment = z.infer<typeof asyncHookAttachmentSchema>;

// Adapt lnn [2483510,2483675), sfn1dbxq SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// zero-based half-open UTF-16. The host stores these strings with their actual conversation message.
export function startupContextAttachments(content: readonly string[]) {
  return content.length ? [{ type: 'hook_additional_context' as const, hookEvent: 'SessionStart' as const, content: [...content] }] : [];
}

type StartupAttachment = AsyncHookAttachment
  | { type: 'hook_additional_context'; hookEvent: string; content: string[] }
  | { type: 'hook_success'; hookEvent: string; content: string }
  | { type: 'hook_non_blocking_error'; hookEvent: string; command?: string; exitCode: number | null; stderr: string };

// Copy/adapt vhe/h$t/lHe, sfn1dbxq SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// [1300642,1301158)/[1301271,1301736), zero-based half-open UTF-16. Attachment envelopes are unwrapped.
// p9, 566cpr3w SHA-256 bcbbf0cd8b6c5132409afe2e38ac723d8dd65dc466aadb50e9f10ea2b1dc06e4 [1967,1990), same unit.
function startupContextKey(text: string): string {
  return text.startsWith('<persisted-output>') ? text.replace(/(saved to: ).*$/m, '$1<persisted>') : text;
}
function startupAttachmentKeys(row: StartupAttachment): string[] {
  if (row.hookEvent !== 'SessionStart') return [];
  if (row.type === 'hook_additional_context') return row.content.map(startupContextKey);
  if (row.type === 'hook_success' && row.content !== '') return [startupContextKey(row.content)];
  if (row.type === 'hook_non_blocking_error') return [`${row.command ?? ''}\x00${row.exitCode}\x00${row.stderr}`];
  return [];
}
export function filterStartupAttachments(history: readonly StartupAttachment[], incoming: readonly StartupAttachment[]): StartupAttachment[] {
  if (!incoming.length) return [];
  const seen = new Set(history.flatMap(startupAttachmentKeys));
  if (!seen.size) return [...incoming];
  let changed = false;
  const result: StartupAttachment[] = [];
  for (const row of incoming) {
    const keys = startupAttachmentKeys(row);
    if (!keys.length) { result.push(row); continue; }
    if (row.type === 'hook_additional_context' && row.content.length > 1) {
      const content = row.content.filter(text => !seen.has(startupContextKey(text)));
      if (!content.length) continue;
      changed = true;
      result.push(content.length === row.content.length ? row : { ...row, content });
      continue;
    }
    if (seen.has(keys[0]!)) continue;
    changed = true;
    result.push(row);
  }
  return changed ? result : [];
}

// Adapt Sbt/LLr [626520,627570)/[3703453,3704511), same sfn1dbxq digest and UTF-16 unit.
// dbt/ubt's ordinary non-account path is identity. Raw output already uses the host's capture cap.
export function asyncHookAttachment(raw: CommandHookExecution, identity: { id: string; event: string; toolName?: string; pluginId?: string }): AsyncHookAttachment | undefined {
  const response = parseAsyncHookResponse(syncJsonAfterAsyncHeader(raw.stdout));
  if (Object.keys(response).length === 0 && raw.code === 0 && !raw.stderr.trim()) return;
  return { type: 'async_hook_response', processId: identity.id, hookName: identity.event, hookEvent: identity.event,
    ...(identity.pluginId === undefined ? {} : { pluginId: identity.pluginId }),
    ...(identity.toolName === undefined ? {} : { toolName: identity.toolName }),
    ...(identity.event === 'SessionStart' ? { command: raw.command } : {}), response,
    stdout: raw.stdout, stderr: raw.stderr, exitCode: raw.code };
}

// Copy/adapt rDr/sDr/yyn/iDr/_yn [3630017,3631285), same sfn1dbxq digest and UTF-16 unit.
const textsSchema = z.object({ systemMessage: z.string().optional().catch(undefined),
  hookSpecificOutput: z.object({ additionalContext: z.string().optional() }).optional().catch(undefined) });
const historySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('async_hook_response'), hookEvent: z.literal('SessionStart'), response: z.unknown().optional(), command: z.unknown().optional(), pluginId: z.unknown().optional(), exitCode: z.unknown().optional() }),
  z.object({ type: z.literal('hook_additional_context'), hookEvent: z.literal('SessionStart'), content: z.array(z.unknown()).catch([]) }),
  z.object({ type: z.literal('hook_success'), hookEvent: z.literal('SessionStart'), content: z.unknown().optional() }),
]);
function texts(response: unknown): string[] {
  const parsed = textsSchema.safeParse(response);
  if (!parsed.success) return [];
  return [parsed.data.systemMessage, parsed.data.hookSpecificOutput?.additionalContext].filter((text): text is string => text !== undefined && text !== '');
}
export function duplicateSessionStart(candidate: Pick<AsyncHookAttachment, 'response' | 'command' | 'pluginId'>, history: readonly unknown[]): boolean {
  const current = texts(candidate.response);
  if (!current.length) return false;
  for (let index = history.length - 1; index >= 0; index--) {
    const parsed = historySchema.safeParse(history[index]);
    if (!parsed.success) continue;
    const row = parsed.data;
    const previous = row.type === 'async_hook_response' ? { ...row, texts: texts(row.response) }
      : { command: undefined, pluginId: undefined, exitCode: undefined,
          texts: row.type === 'hook_additional_context' ? row.content : row.content === '' ? [] : [row.content] };
    const same = previous.command === candidate.command && previous.pluginId === candidate.pluginId;
    if (previous.command !== undefined && !same) continue;
    if (previous.texts.length) return current.every(text => previous.texts.includes(text));
    if (same && previous.exitCode === 0) return false;
  }
  return false;
}
