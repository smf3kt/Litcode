import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { atomicWriteFile } from './atomic-write.js';
import { CONFIG_LIMITS, defaultUserDir, readBoundedBytes } from './config.js';
import { queuePermissionSettingsWrite } from './permission-settings.js';
import { PromptSuggestionRun, promptSuggestionBackedOff } from './prompt-suggestions.js';

const documentSchema = z.object({
  promptSuggestionUnusedStreak: z.number().finite().catch(0).default(0),
  firstStartTime: z.string().optional().catch(undefined),
}).passthrough();

// ce/Ce/uH and r/K2t/m/XGr, kyy5nfa1 [1088,2265), UTF-16; reuse the host's serialized settings file.
export class PromptSuggestionStore {
  private readonly file: string;
  constructor(userDir = defaultUserDir()) { this.file = path.join(path.resolve(userDir), 'settings.json'); }
  private document(): { settings: z.infer<typeof documentSchema>; mode: number } {
    let mode = 0o600, value: unknown = {};
    try {
      const stat = fs.lstatSync(this.file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Prompt suggestion settings must be a regular file');
      mode = stat.mode & 0o777;
      const read = readBoundedBytes(this.file, CONFIG_LIMITS.settingsBytes);
      if (read.overflow) throw new Error('Prompt suggestion settings exceed the byte limit');
      value = JSON.parse(read.buffer.toString('utf8') || '{}');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    return { settings: documentSchema.parse(value), mode };
  }
  read(): z.infer<typeof documentSchema> { return this.document().settings; }
  private update(change: (current: z.infer<typeof documentSchema>) => number | undefined): Promise<boolean> {
    return queuePermissionSettingsWrite(this.file, () => {
      const { settings, mode } = this.document(), next = change(settings);
      if (next === undefined || settings.promptSuggestionUnusedStreak === next) return false;
      settings.promptSuggestionUnusedStreak = next;
      const text = JSON.stringify(settings, null, 2) + '\n';
      if (Buffer.byteLength(text) > CONFIG_LIMITS.settingsBytes) throw new Error('Prompt suggestion settings exceed the byte limit');
      atomicWriteFile(this.file, text, { mode, label: 'prompt suggestion backoff' });
      return true;
    });
  }
  async outcome(accepted: boolean, run: PromptSuggestionRun): Promise<void> {
    if (accepted) { run.unusedInARow = 0; await this.update(() => 0); return; }
    if (this.read().promptSuggestionUnusedStreak >= 20) return;
    run.unusedInARow++;
    if (run.unusedInARow >= 20) {
      run.unusedInARow = 0;
      await this.update(current => current.promptSuggestionUnusedStreak >= 20 ? undefined : 20);
    }
  }
  async enable(run: PromptSuggestionRun): Promise<void> {
    run.unusedInARow = 0;
    await this.update(() => 0);
  }
  claimNotice(): Promise<boolean> {
    return this.update(current => promptSuggestionBackedOff(current)
      && current.promptSuggestionUnusedStreak !== 21 ? 21 : undefined);
  }
}
