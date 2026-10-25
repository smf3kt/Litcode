import path from 'node:path';
import { Oe } from './plugin-chain-registry-stores-source.js';
import { normalizeSettingsDocument } from './setting-sources.js';

export interface SettingsWrite { readonly file: string; readonly present: boolean }

// Oe/Er, fdxhcr6b [1196,1457), x0dc37w9 [106006,106115), UTF-16; reuse the recovered signal.
const changed: {
  subscribe(listener: (write: SettingsWrite) => void): () => void;
  emit(write: SettingsWrite): void;
} = Oe();

export function subscribeSettingsWrites(listener: (write: SettingsWrite) => void): () => void {
  return changed.subscribe(listener);
}

// us/Pr, x0dc37w9 [102833,105519), wtch2p0g [3708,3745), UTF-16; callers publish only committed documents.
export function publishSettingsWrite(file: string, document: Record<string, unknown>): void {
  const present = Object.keys(normalizeSettingsDocument(document)).length > 0;
  try { changed.emit(Object.freeze({ file: path.resolve(file), present })); }
  catch { /* Observer failures do not undo the committed settings write. */ }
}
