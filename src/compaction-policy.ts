import type { SessionConfig } from './session.js';

/** Ne, fdxhcr6b [615,757), UTF-16; neutral environment names are recorded in W234. */
function enabledFlag(value: string | boolean | undefined): boolean {
  if (!value) return false;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase().trim());
}

/** Rfo, sfn1dbxq [1132121,1132437), UTF-16; manual compact has its own disable gate. */
export function manualCompactionEnabled(): boolean {
  return !enabledFlag(process.env.LLM_DISABLE_COMPACT);
}

/** Gm/ef, 14rnebpd [317863,318021), UTF-16; absence of the stored setting means enabled. */
export function automaticCompactionEnabled(config: Pick<SessionConfig, 'autoCompactEnabled'>): boolean {
  if (!manualCompactionEnabled() || enabledFlag(process.env.LLM_DISABLE_AUTO_COMPACT)) return false;
  return config.autoCompactEnabled ?? true;
}

/** Mrr/L$e, sfn1dbxq [863158,863237)/[859411,859734), UTF-16; capacity stays independent of auto. */
export function contextBlockingLimit(config: Pick<SessionConfig, 'contextTokens' | 'maxTokens'>): number {
  return config.contextTokens - Math.min(config.maxTokens, 20_000) - 3000;
}
