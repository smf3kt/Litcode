import { xhr, Phr, ZNs, X } from './auto-dangerous-rules-source.js';
import { currentPlanRuntime } from './plan-runtime-host.js';
import { Un } from './permission-rule-source.js';
export const t = (..._values: unknown[]): void => {};
export const nre = t;
export const C$e = (value: unknown): void => { currentPlanRuntime().provisionalStartupMode = value; };
export const ER = (value: boolean): void => { currentPlanRuntime().active = value; };
export const ap = (): boolean => currentPlanRuntime().active;
export const ND = (value: boolean): void => { currentPlanRuntime().needsAutoModeExitAttachment = value; };
export const BN = (value: boolean): void => { currentPlanRuntime().hasExitedPlanMode = value; };
// Availability is the owned shared provider. Remote identity and protected MCP producers are absent.
export const O_ = (): boolean => true;
export const rnn = (): boolean => currentPlanRuntime().useAutoModeDuringPlan;
export function Bre(name: string, pattern?: string): boolean {
  const sourceName = ['run_command', 'run_background', 'bash'].includes(name) ? 'Bash' : name === 'agent' ? 'Agent' : name === 'monitor' ? 'Monitor' : name;
  return (sourceName === 'Bash' || sourceName === 'PowerShell') && currentPlanRuntime().classifyAllShell ||
    xhr(sourceName, pattern) || Phr(sourceName, pattern) || ZNs(sourceName, pattern) || X(sourceName);
}
/** AAn/B5e, sfn [3082144,3082239), UTF-16; certified command grants expire on restore. */
export function AAn(value: string): boolean {
  const rule = Un(value);
  return rule.toolName === 'Bash' && rule.ruleContent !== undefined && rule.ruleContent.startsWith('certified: ');
}
/** tfe/AIo, 4bw [109204,109386)/[109525,109760), UTF-16. */
export function tfe(from: string, to: string): void {
  if (to === 'plan' && from !== 'plan') currentPlanRuntime().needsPlanModeExitAttachment = false;
  if (from === 'plan' && to !== 'plan') currentPlanRuntime().needsPlanModeExitAttachment = true;
}
export function AIo(from: string, to: string): void {
  if (from === 'auto' && to === 'plan' || from === 'plan' && to === 'auto') return;
  if (to === 'auto' && from !== 'auto') ND(false);
  if (from === 'auto' && to !== 'auto') ND(true);
}
export const ws = ['userSettings', 'projectSettings', 'localSettings', 'flagSettings', 'policySettings'];
export const jy = ['userSettings', 'projectSettings', 'localSettings'];
export const yn = (): undefined => undefined;
export const df = (): null => null;
export const Re = (_root: string, value: string): string => value;
