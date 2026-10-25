import { z } from 'zod';

// ws/Lo, wtch2p0g [3863,3948)/[5585,5823), UTF-16; only locally implemented settings tiers.
export const SETTING_SOURCE_ORDER = ['userSettings', 'projectSettings', 'localSettings', 'flagSettings', 'policySettings'] as const;
export const managedSettingsOriginSchema = z.enum(['file', 'drop-ins', 'file + drop-ins']);
export type ManagedSettingsOrigin = z.infer<typeof managedSettingsOriginSchema>;
export const settingSourcesSchema = z.array(z.discriminatedUnion('source', [
  z.object({ source: z.enum(['userSettings', 'projectSettings', 'localSettings', 'flagSettings']) }).strict(),
  z.object({ source: z.literal('policySettings'), origin: managedSettingsOriginSchema }).strict(),
])).max(SETTING_SOURCE_ORDER.length).refine(sources => new Set(sources.map(item => item.source)).size === sources.length,
  'Setting sources must be unique');
export type SettingSource = z.infer<typeof settingSourcesSchema>[number];
