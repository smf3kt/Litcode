import fs from 'node:fs';
import path from 'node:path';

import { createPathIdentity } from './path-approval-identity-source.js';
import { PathResolutionError, resolveChain } from './path-identity.js';

type SourcePathObservation = {
  requested: string;
  spellings: readonly string[];
  leafIsSymlink: boolean;
} & ({ unresolved: false; landing: string } | { unresolved: true });

export type PathPermissionObservation = SourcePathObservation & { hostRuleSpellings: readonly string[] };

// ek/di, wh2vcbh8 [3533,4269), gyf58rwf [73816,73857), UTF-16.
export function observePermissionPath(workspace: string, file: string): PathPermissionObservation {
  if (file.includes('\0')) throw new Error('Path contains null bytes');
  const requested = path.resolve(workspace, file).normalize('NFC');
  const filesystem = {
    cwd: () => workspace,
    lstatSync: fs.lstatSync,
    readlinkSync: fs.readlinkSync,
    realpathSync: (value: string) => fs.realpathSync(value).normalize('NFC'),
    openDirNoFollowSync(value: string) {
      const fd = fs.openSync(value, fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      fs.closeSync(fd);
    },
  };
  const source = createPathIdentity({ ie: () => filesystem, qpt: () => null });
  const observed: SourcePathObservation = source.di(requested);
  let hostRuleSpellings = observed.spellings;
  try {
    const legacy = resolveChain(workspace, file);
    hostRuleSpellings = [...new Set([...observed.spellings, ...(legacy.spellings ?? []), legacy.path])];
  } catch (error) {
    if (!(error instanceof PathResolutionError) || !['non-canonical', 'ELOOP', 'unreadable-ancestry'].includes(error.code)) throw error;
  }
  return { ...observed, hostRuleSpellings };
}
