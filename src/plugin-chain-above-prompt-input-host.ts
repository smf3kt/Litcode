// Host tokens for the AbovePrompt input slice (W147). The source's `Xa` reads the clock context
// `b4n` from chunk-06azbynj.js; this build carries no provider for that token, so the seam owns one.
// `Xa` falls back to `Date.now()` when no provider is mounted, which is the source's own default.
import { qt } from './plugin-chain-react-hooks.js';

/** Source `b4n` (chunk-06azbynj.js): the clock context `Xa` reads, with `Date.now` as fallback. */
export const PromptClock = qt<unknown>(null);
