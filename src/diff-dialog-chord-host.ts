// Host adapter for the copied chord formatter. Source `BF` (chunk-6ccen3s8.js [34816,34980))
// reads the platform from `O()` and treats the three macOS terminal programs as macOS. `O` is
// already ported, so only the environment branch lives here.
import { O } from './plugin-chain-fs-boundaries.js';

/** Source `BF`: the platform, with iTerm2/Apple Terminal/iTerm.app reported as macOS. */
export function BF(): string {
  const platform = O();
  if (platform === 'macos') return platform;
  const env = process.env;
  if (env.LC_TERMINAL === 'iTerm2' || env.TERM_PROGRAM === 'Apple_Terminal'
    || env.TERM_PROGRAM === 'iTerm.app') return 'macos';
  return platform;
}
