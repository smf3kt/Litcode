import { expandSourceSkill } from './skill-arguments-source.js';
import type { SessionConfig } from './session.js';

// i5r/uHe, sfn1dbxq [435128,435233)/[435534,436487), UTF-16.
export function sourceSkillExpansion(body: string, args: string, names: readonly string[] = [], append = true): string {
  return expandSourceSkill(body, args, append, names);
}

export function sourceSkillArgumentsDefault(features: Partial<NonNullable<SessionConfig['features']>> | undefined): boolean {
  return features?.skillSourceArguments ?? !(['skillQuotedArguments', 'skillArgumentFallback', 'skillExtendedArguments'] as const)
    .some(name => features?.[name] !== undefined);
}
