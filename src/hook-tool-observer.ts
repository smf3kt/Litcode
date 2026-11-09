import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Session, SessionEvent } from './session.js';

// Mln [2910556,2915370), UTF-16, sfn1dbxq SHA
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da.
// Host S3 adaptation for direct inner tools, not source agent/remote-effect parity.
export const hookToolSchema = z.object({
  kind: z.literal('hook_tool'), owner: z.string().uuid(), hookId: z.string().uuid(),
  resolverInvocationId: z.string().uuid(), invocationId: z.string().uuid(),
  tool: z.string().min(1), callId: z.string().min(1), inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  phase: z.enum(['admitted', 'fulfilled', 'rejected']),
}).strict();
export type HookToolEvent = z.infer<typeof hookToolSchema>;
type Owner = { owner: Session; hookId: string };
const owners = new WeakMap<object, Owner>();
const scope = new AsyncLocalStorage<(Owner & { resolverInvocationId: string }) | undefined>();
const writes = new WeakMap<object, { owner: Session; event: HookToolEvent }>();
export function registerHookToolOwner(observer: object, owner: Session, hookId: string): void {
  owners.set(observer, { owner, hookId });
}
export function withHookToolScope<T>(observer: object | undefined, resolverInvocationId: string, body: () => T): T {
  const held = observer && owners.get(observer);
  return scope.run(held ? { ...held, resolverInvocationId } : undefined, body);
}
export async function runObservedHookTool<T>(tool: string, callId: string, input: unknown, body: () => T): Promise<Awaited<T>> {
  const held = scope.getStore();
  if (!held) return await body();
  const { owner, hookId, resolverInvocationId } = held;
  if (!owner.isOpen || owner.isJournalFenced) throw new Error('Hook inner-tool owner unavailable before invocation');
  const binding = { owner: owner.id, hookId, resolverInvocationId, invocationId: randomUUID(), tool, callId,
    inputSha256: createHash('sha256').update(JSON.stringify(input) ?? 'undefined').digest('hex') };
  const record = (phase: HookToolEvent['phase']) => {
    if (phase !== 'admitted' && (!owner.isOpen || owner.isJournalFenced)) return;
    const row: HookToolEvent = Object.freeze({ kind: 'hook_tool', ...binding, phase });
    writes.set(row, { owner, event: row });
    try { owner.append(row); } finally { writes.delete(row); }
  };
  record('admitted');
  let result: Awaited<T>;
  try { result = await body(); } catch (error) { record('rejected'); throw error; }
  record('fulfilled'); return result;
}
export function consumeHookToolWrite(owner: Session, row: object): HookToolEvent | undefined {
  const saved = writes.get(row); writes.delete(row);
  return saved?.owner === owner ? saved.event : undefined;
}
export function hookToolExecutions(events: readonly SessionEvent[], owner: string): HookToolEvent[] {
  const resolvers = new Map<string, string>();
  const states = new Map<string, HookToolEvent>();
  for (const event of events) {
    if (event.kind === 'hook_resolver' && event.transition.phase === 'admitted' && event.owner === owner &&
      (event.resolverType === 'agent' || event.resolverType === 'mcp_tool')) resolvers.set(event.invocationId, event.hookId);
    if (event.kind !== 'hook_tool') continue;
    const before = states.get(event.invocationId);
    const invalid = () => new Error('Invalid hook inner-tool history');
    if (event.owner !== owner || resolvers.get(event.resolverInvocationId) !== event.hookId) throw invalid();
    if (event.phase === 'admitted') { if (before) throw invalid(); }
    else if (!before || before.phase !== 'admitted' || before.hookId !== event.hookId ||
      before.resolverInvocationId !== event.resolverInvocationId || before.tool !== event.tool ||
      before.callId !== event.callId || before.inputSha256 !== event.inputSha256) throw invalid();
    states.set(event.invocationId, event);
  }
  return [...states.values()];
}
