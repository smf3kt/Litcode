import { z } from 'zod';
import { notificationChannelSchema } from './terminal-notifications.js';

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

// Uw/hs/TN, 3cynezh1 [395555,396291), js2bhabe [1114,1499), qtksmp3x [41417,41484), UTF-16.
export function normalizeSettingsDocument(document: Record<string, unknown>): Record<string, unknown> {
  const parsed = { ...document };
  if ('preferredNotifChannel' in parsed) {
    const channel = notificationChannelSchema.parse(parsed.preferredNotifChannel);
    if (channel === undefined) delete parsed.preferredNotifChannel;
    else parsed.preferredNotifChannel = channel;
  }
  if ('promptSuggestionEnabled' in parsed) {
    const enabled = z.boolean().optional().catch(undefined).parse(parsed.promptSuggestionEnabled);
    if (enabled === undefined) delete parsed.promptSuggestionEnabled;
    else parsed.promptSuggestionEnabled = enabled;
  }
  return parsed;
}
