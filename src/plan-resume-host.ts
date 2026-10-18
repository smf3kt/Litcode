import { zo } from './plan-deny-source.js';
import { i0 } from './plan-transition-source.js';
import { CF, zg, ty } from './plan-history-source.js';
import { currentPlanRuntime } from './plan-runtime-host.js';
export { zo, i0, CF, zg, ty };
export const fp = 'command-name', mu = 'ExitPlanMode', xk = 'EnterPlanMode';
/** Aq.isEnabled, x2 [6564,6646), UTF-16; local interactive launch is true. */
export const Aq = { name: mu, isEnabled(): boolean {
  const isNoninteractive = false;
  const allowedChannels: string[] = [];
  const permissionPromptToolName: string | undefined = undefined;
  if (allowedChannels.length > 0 && isNoninteractive) return false;
  if (isNoninteractive && !(permissionPromptToolName !== undefined && permissionPromptToolName !== 'none')) return false;
  return true;
} };
/** zr, bk5 [528770,528873), UTF-16; pin the offline default per interactive owner. */
export function zr(key: string, fallback: boolean): boolean {
  const values = currentPlanRuntime().features;
  if (!values.has(key)) values.set(key, fallback);
  return values.get(key) ?? fallback;
}
/** $m/rh/CH, a60 [682,882), UTF-16. */
export function $m(value: string): string | undefined {
  const normalized = value === 'manual' ? 'default' : value;
  return ['acceptEdits', 'auto', 'bypassPermissions', 'default', 'dontAsk', 'plan'].find(mode => mode === normalized);
}
export const t = (..._values: unknown[]): void => {};
export const i = t;
export const d = (value: unknown): unknown => value;
export const pe = d;
