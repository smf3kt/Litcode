import './plugin-chain-registry.js';
import { z } from 'zod';
import { ga } from './plugin-chain-entry.js';
import { registerChainSite } from './plugin-chain-host.js';
import { C, er, fe, m$ } from './plugin-chain-source.js';

const argument = z.object({ text: z.string(), origin: z.unknown() }).passthrough();
const answer = z.object({ isShown: z.boolean() });

// Ar/lo, nyce03br [26489,26957), UTF-16; existing copied helpers retain origin and answer validation.
registerChainSite('prompt.suggest', {
  event: 'prompt.suggest',
  restoreArgument: (next, original) => m$(['origin'], next, original),
  checkArgument: (next, original) => {
    const changed = argument.safeParse(next), initial = argument.parse(original);
    if (!changed.success) return 'no { text } (a string)';
    return er(changed.data.origin) !== er(initial.origin)
      ? 'a changed origin (the engine set it; next(e) passes it on)' : undefined;
  },
  measureArgument: (next, original) => fe(argument.parse(next).text, argument.parse(original).text),
  check: C((value: unknown) => answer.safeParse(value).success ? undefined : 'no { isShown } (true or false)'),
});

// c7o/qht, sfn1dbxq [470316,470671), UTF-16; the core is bound to this generation's composer.
export async function publishPromptSuggestion(text: string, signal: AbortSignal,
  place: (text: string) => { isShown: boolean }): Promise<{ isShown: boolean }> {
  const result: unknown = await ga('prompt.suggest', {
    signal,
    core: { 'prompt.suggest': { name: 'core', isCore: true, budgetMs: 0,
      run: async (value: unknown) => { signal.throwIfAborted(); return place(argument.parse(value).text); } } },
  })({ text, origin: { kind: 'suggestion' } });
  return answer.parse(result);
}
