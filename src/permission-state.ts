import { z } from 'zod';
import { KI, Do } from './permission-reducer-source.js';
import { Un, _n } from './permission-rule-source.js';
import { permissionUpdateSchema, type PermissionUpdate } from './permissions.js';

export const permissionSources = ['userSettings', 'projectSettings', 'localSettings', 'flagSettings', 'policySettings',
  'cliArg', 'command', 'toolsNarrowing', 'mcpServerPolicy', 'hostCredential', 'session'] as const;
export type PermissionSource = typeof permissionSources[number];
export type PermissionBehavior = 'allow' | 'deny' | 'ask';
export type PermissionRules = Partial<Record<PermissionSource, string[]>>;
export const permissionLayersSchema = z.array(z.object({
  source: z.enum(permissionSources), root: z.string(), file: z.string().optional(),
  allow: z.array(z.string()), deny: z.array(z.string()), ask: z.array(z.string()),
  additionalDirectories: z.array(z.string()),
}));
export type PermissionLayers = z.infer<typeof permissionLayersSchema>;
export type PermissionState = {
  mode: 'acceptEdits' | 'auto' | 'bypassPermissions' | 'default' | 'dontAsk' | 'plan';
  isBypassPermissionsModeAvailable: boolean;
  alwaysAllowRules: PermissionRules;
  alwaysDenyRules: PermissionRules;
  alwaysAskRules: PermissionRules;
  additionalWorkingDirectories: Map<string, { path: string; source: PermissionSource }>;
  startupModeDecidedByProactivityLevel?: unknown;
};

export function emptyPermissionState(): PermissionState {
  return { mode: 'default', isBypassPermissionsModeAvailable: false, alwaysAllowRules: {}, alwaysDenyRules: {},
    alwaysAskRules: {}, additionalWorkingDirectories: new Map() };
}

export function parsePermissionRule(value: string): { toolName: string; ruleContent?: string } { return Un(value); }
export function serializePermissionRule(rule: { toolName: string; ruleContent?: string }): string { return _n(rule); }

/** KI/Do, chunk-2bcyxj9q [191671,194364)/[197487,197681), UTF-16. */
export function reducePermissionState(state: PermissionState, updates: readonly PermissionUpdate[]): PermissionState {
  return KI(state, updates);
}

export function validatedPermissionUpdates(updates: readonly PermissionUpdate[]): PermissionUpdate[] {
  return updates.flatMap(update => {
    const checked = Do(update);
    if (checked.action !== 'apply') return [];
    const parsed = permissionUpdateSchema.safeParse(checked.update);
    return parsed.success ? [parsed.data] : [];
  });
}

export function permissionBucket(state: PermissionState, behavior: PermissionBehavior): PermissionRules {
  switch (behavior) {
    case 'allow': return state.alwaysAllowRules;
    case 'deny': return state.alwaysDenyRules;
    case 'ask': return state.alwaysAskRules;
  }
}
