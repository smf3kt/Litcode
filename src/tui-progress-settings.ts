import { z } from 'zod';
import { initializeProgressTime, initializeSpinnerWords } from './tui-progress-settings-source.js';
import { sourceSpinnerVerbs } from './tui-progress-source.js';

export const spinnerVerbsSchema = z.object({mode:z.enum(['append','replace']),verbs:z.array(z.string())});
export type SpinnerVerbs = z.infer<typeof spinnerVerbsSchema>;
export interface ProgressDisplaySettings {timeFormat?:string;timeZone?:string;spinnerVerbs?:SpinnerVerbs}

/** Each terminal closes over its pinned settings; source formatting has no global setter. */
export function progressTime(settings: ProgressDisplaySettings) {
  return initializeProgressTime((key: 'timeFormat' | 'timeZone', fallback: string) => ({value:settings[key] ?? fallback}));
}

export function progressVerbs(setting?: SpinnerVerbs): string[] {
  const base = sourceSpinnerVerbs().filter((value: string) => value !== 'Clauding');
  return initializeSpinnerWords(() => ({spinnerVerbs:setting}),base)();
}
