import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Session, SessionEvent } from './session.js';
import type { ChainModule } from './plugin-chain-types.js';

// W [12696,14205), bgo dispatch [18214,18751), zero-based UTF-16,
// p16hdq43 SHA 0876812e3099d9038f2c1c8eaf18b9f878583ce15621d5867f58b46e91050c38.
// Host S3 journal adaptation at actual module.run, before the copied chain folds errors.
export const classicModuleSchema = z.object({
  kind: z.literal('classic_hook_module'), owner: z.string().uuid(), hookId: z.string().uuid(),
  chainInvocationId: z.string().uuid(), moduleInvocationId: z.string().uuid(),
  moduleInstanceId: z.string().uuid(), moduleName: z.string(), event: z.string(),
  phase: z.enum(['admitted', 'fulfilled', 'rejected']),
}).strict();
export type ClassicModuleEvent = z.infer<typeof classicModuleSchema>;
type Owner = { owner: Session; hookId: string };
type Scope = Owner & { chainInvocationId: string; event: string };
const owners = new WeakMap<object, Owner>();
const instances = new WeakMap<ChainModule, string>();
const scope = new AsyncLocalStorage<Scope | undefined>();
const writes = new WeakMap<object, { owner: Session; event: ClassicModuleEvent }>();

export function registerClassicModuleOwner(observer: object, owner: Session, hookId: string): void {
  owners.set(observer, { owner, hookId });
}
export function withClassicModuleScope<T>(observer: object | undefined, chainInvocationId: string, event: string, body: () => T): T {
  const held = observer && owners.get(observer);
  // An unobserved nested raise must not borrow the outer chain's ownership.
  return scope.run(held ? { ...held, chainInvocationId, event: `classic.${event}` } : undefined, body);
}
export async function runObservedClassicModule<T>(module: ChainModule, event: string, body: () => T): Promise<Awaited<T>> {
  const held = scope.getStore();
  if (!held || held.event !== event) return await body();
  const { owner, hookId, chainInvocationId } = held;
  if (!owner.isOpen || owner.isJournalFenced) throw new Error('Classic module owner unavailable before invocation');
  let moduleInstanceId = instances.get(module);
  if (!moduleInstanceId) { moduleInstanceId = randomUUID(); instances.set(module, moduleInstanceId); }
  const binding = { owner: owner.id, hookId, chainInvocationId, moduleInvocationId: randomUUID(),
    moduleInstanceId, moduleName: module.name, event };
  const record = (phase: ClassicModuleEvent['phase']) => {
    if (phase !== 'admitted' && (!owner.isOpen || owner.isJournalFenced)) return;
    const row: ClassicModuleEvent = Object.freeze({ kind: 'classic_hook_module', ...binding, phase });
    writes.set(row, { owner, event: row });
    try { owner.append(row); } finally { writes.delete(row); }
  };
  record('admitted');
  let value: Awaited<T>;
  try { value = await body(); } catch (error) { record('rejected'); throw error; }
  record('fulfilled');
  return value;
}
export function consumeClassicModuleWrite(owner: Session, event: object): ClassicModuleEvent | undefined {
  const saved = writes.get(event); writes.delete(event);
  return saved?.owner === owner ? saved.event : undefined;
}
export function classicHookModules(events: readonly SessionEvent[], owner: string): ClassicModuleEvent[] {
  const chains = new Map<string, { hookId: string; event: string }>();
  const states = new Map<string, ClassicModuleEvent>();
  for (const event of events) {
    if (event.kind === 'classic_hook_chain' && event.phase === 'admitted') chains.set(event.invocationId, event);
    if (event.kind !== 'classic_hook_module') continue;
    const parent = chains.get(event.chainInvocationId), before = states.get(event.moduleInvocationId);
    const invalid = () => new Error('Invalid classic module history');
    if (event.owner !== owner || !parent || parent.hookId !== event.hookId || `classic.${parent.event}` !== event.event) throw invalid();
    if (event.phase === 'admitted') { if (before) throw invalid(); }
    else if (!before || before.phase !== 'admitted' || before.hookId !== event.hookId ||
      before.chainInvocationId !== event.chainInvocationId || before.moduleInstanceId !== event.moduleInstanceId ||
      before.moduleName !== event.moduleName || before.event !== event.event) throw invalid();
    states.set(event.moduleInvocationId, event);
  }
  return [...states.values()];
}
