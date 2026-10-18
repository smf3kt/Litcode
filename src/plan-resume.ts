import { z } from 'zod';
import { parsePermissionRule, serializePermissionRule, permissionPolicySchema, type SessionPermissionUpdates } from './permissions.js';
import type { SessionEvent } from './session.js';
import { LBs, H9n } from './plan-resume-source.js';
import { i0, nz, rge } from './plan-transition-source.js';
import { createPlanRuntime, planRuntime, type PlanRuntime } from './plan-runtime-host.js';

const nonPlanModeSchema = permissionPolicySchema.shape.mode.exclude(['plan']);
export const permissionModeCommandSchema = z.discriminatedUnion('operation', [
  z.object({ kind: z.literal('permission_mode_command'), operation: z.literal('enter'), mode: z.literal('plan'),
    command: z.enum(['plan', 'permissions']) }).strict(),
  z.object({ kind: z.literal('permission_mode_command'), operation: z.literal('exit'), mode: nonPlanModeSchema,
    command: z.literal('permissions') }).strict(),
  z.object({ kind: z.literal('permission_mode_command'), operation: z.literal('select'), mode: nonPlanModeSchema,
    command: z.literal('permissions') }).strict(),
]);
export type PermissionModeCommand = z.infer<typeof permissionModeCommandSchema>;
type LocalMode = z.infer<typeof permissionPolicySchema.shape.mode>;
const sourceMode = (mode: LocalMode | undefined) => mode === 'bypass' ? 'bypassPermissions' : mode === 'ask' ? 'default' : mode ?? 'default';

export function permissionModeCommand(command: 'plan' | 'permissions', mode: LocalMode,
  previous: LocalMode | undefined): PermissionModeCommand {
  if (mode === 'plan') return { kind: 'permission_mode_command', operation: 'enter', command, mode };
  return { kind: 'permission_mode_command', operation: previous === 'plan' ? 'exit' : 'select', command: 'permissions', mode };
}

/** H9n consumes retained history, including markers preceding compaction. */
type PlanHistoryEntry = { type: string; message?: { content: unknown }; attachment?: { type: string };
  permissionMode?: string; origin?: { kind: string }; isMeta?: boolean };
function planHistory(events: readonly SessionEvent[]): PlanHistoryEntry[] {
  return events.flatMap<PlanHistoryEntry>(event => {
    if (event.kind === 'permission_mode_command') {
      if (event.operation === 'select') return [{ type: 'user', message: { content: '' },
        permissionMode: sourceMode(event.mode), origin: { kind: 'human' } }];
      return [{ type: 'attachment', attachment: { type: event.operation === 'enter' ? 'plan_mode' : 'plan_mode_exit' } }];
    }
    // Local slash commands are consumed before messages. Ordinary user text has no command authority.
    if (event.kind === 'message' && event.message.role === 'assistant') return [{ type: 'assistant', message: event.message }];
    if (event.kind === 'message' && Array.isArray(event.message.content) && event.message.content[0]?.type === 'tool_result') {
      return [{ type: 'user', message: event.message, isMeta: event.isMeta }];
    }
    return [];
  });
}
export function planHistoryState(events: readonly SessionEvent[]): 'none' | 'open' | 'exited' {
  return H9n(planHistory(events));
}

function fromSource(state: SessionPermissionUpdates, next: Omit<SessionPermissionUpdates, 'mode'> & { mode: string }): SessionPermissionUpdates {
  const mode = permissionPolicySchema.shape.mode.parse(next.mode === 'bypassPermissions' ? 'bypass' : next.mode);
  return { ...state, ...next, mode, allow: Object.values(next.alwaysAllowRules).flat(),
    deny: Object.values(next.alwaysDenyRules).flat(), ask: Object.values(next.alwaysAskRules).flat() };
}

/** i0/j_t, xv9 [7974,8517)/[26232,26576), UTF-16. */
export function transitionPlanMode(state: SessionPermissionUpdates, mode: LocalMode, owner: PlanRuntime): SessionPermissionUpdates {
  owner.useAutoModeDuringPlan = state.useAutoModeDuringPlan ?? true;
  const current = { ...state, mode: sourceMode(state.mode) };
  owner.classifyAllShell = state.classifyAllShell ?? false;
  const next = planRuntime.run(owner, () => i0(current.mode, sourceMode(mode), current, 'local_command'));
  return { ...fromSource(state, { ...next, mode: sourceMode(mode) }), mode, autoDuringPlan: mode === 'plan' && owner.active };
}

export function refreshAutoMode(state: SessionPermissionUpdates, mode: LocalMode, owner: PlanRuntime): SessionPermissionUpdates {
  owner.useAutoModeDuringPlan = state.useAutoModeDuringPlan ?? true;
  owner.classifyAllShell = state.classifyAllShell ?? false;
  const active = mode === 'auto' || mode === 'plan' && owner.useAutoModeDuringPlan;
  owner.active = active;
  const canonical = { ...state, alwaysAllowRules: Object.fromEntries(Object.entries(state.alwaysAllowRules)
    .map(([source, rules]) => [source, rules?.map(rule => serializePermissionRule(parsePermissionRule(rule)))])) };
  const next = planRuntime.run(owner, () => active ? nz(canonical) : rge(state));
  return { ...fromSource(state, { ...next, mode: sourceMode(mode) }), mode, autoDuringPlan: mode === 'plan' && active };
}

/** LBs, fh503 [4967,5545), UTF-16. Only the local interactive slash owner calls this transform. */
export class InteractivePlanResume {
  private readonly visited: Set<string>;
  readonly runtime = createPlanRuntime();
  constructor(initialId: string) { this.visited = new Set([initialId]); }
  accept(id: string): void { this.visited.add(id); }
  resume(id: string, current: SessionPermissionUpdates, storedPermissionMode: unknown,
    events: readonly SessionEvent[]): SessionPermissionUpdates {
    if (this.visited.has(id)) return current;
    this.runtime.useAutoModeDuringPlan = current.useAutoModeDuringPlan ?? true;
    this.runtime.classifyAllShell = current.classifyAllShell ?? false;
    const source = { ...current, mode: sourceMode(current.mode) };
    const restored = planRuntime.run(this.runtime, () => LBs(source, { storedPermissionMode:
      typeof storedPermissionMode === 'string' && permissionPolicySchema.shape.mode.safeParse(storedPermissionMode).success
        ? sourceMode(permissionPolicySchema.shape.mode.parse(storedPermissionMode)) : storedPermissionMode,
      messages: planHistory(events), forkSession: false, startupModePinned: false, lane: 'interactive_slash' }));
    return restored ? { ...fromSource(current, restored), autoDuringPlan: restored.mode === 'plan' && this.runtime.active } : current;
  }
}
