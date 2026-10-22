import { z } from 'zod';

// Ng/sko and override, 3cynezh1 [191254,191675)/[254155,254933), UTF-16; project only known fields into journals.
const entry = z.object({
  id: z.string().optional().catch(undefined),
  text: z.string().optional().catch(undefined),
  cooldownSessions: z.number().optional().catch(undefined),
  priority: z.number().optional().catch(undefined),
});
export const spinnerTipEntriesSchema = z.preprocess(value => Array.isArray(value)
  ? value.filter(item => typeof item === 'string' || !!item && typeof item === 'object' && !Array.isArray(item)) : [],
  z.array(z.union([z.string(), entry])));
const override = z.object({
  excludeDefault: z.boolean().optional().catch(undefined),
  tips: spinnerTipEntriesSchema.optional(),
  tipsFile: z.string().optional().catch(undefined),
  label: z.string().optional().catch(undefined),
});
export const spinnerTipsOverrideSchema = override.optional().catch(undefined);
export const spinnerTipsSettingsSchema = z.object({
  spinnerTipsEnabled: z.boolean().optional(),
  spinnerTipsOverride: spinnerTipsOverrideSchema,
});
export const spinnerTipsLayersSchema = z.array(z.object({
  source: z.enum(['policySettings', 'flagSettings', 'userSettings', 'projectSettings', 'localSettings']),
  override,
}).strict());
export type SpinnerTipEntry = z.infer<typeof spinnerTipEntriesSchema>[number];
export type SpinnerTipsOverride = NonNullable<z.infer<typeof spinnerTipsOverrideSchema>>;
export type SpinnerTipsLayer = z.infer<typeof spinnerTipsLayersSchema>[number];
export type SpinnerTipsSettings = z.infer<typeof spinnerTipsSettingsSchema>;
