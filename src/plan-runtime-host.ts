import { AsyncLocalStorage } from 'node:async_hooks';

export type PlanRuntime = {
  features: Map<string, boolean>;
  active: boolean;
  useAutoModeDuringPlan: boolean;
  classifyAllShell: boolean;
  provisionalStartupMode?: unknown;
  needsPlanModeExitAttachment: boolean;
  needsAutoModeExitAttachment: boolean;
  hasExitedPlanMode: boolean;
};
export const planRuntime = new AsyncLocalStorage<PlanRuntime>();
export function createPlanRuntime(): PlanRuntime {
  return { features: new Map(), active: false, useAutoModeDuringPlan: true, classifyAllShell: false, needsPlanModeExitAttachment: false,
    needsAutoModeExitAttachment: false, hasExitedPlanMode: false };
}
export function currentPlanRuntime(): PlanRuntime {
  const owner = planRuntime.getStore();
  if (!owner) throw new Error('Plan transition requires an interactive owner');
  return owner;
}
