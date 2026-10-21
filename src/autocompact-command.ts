/**
 * The `/autocompact` command. Every text below is recovered verbatim; the offsets are zero-based
 * UTF-16 code units into the named module.
 *
 * | Module | SHA-256 | Range | Contents |
 * | --- | --- | --- | --- |
 * | `chunk-agx4redd.js` | `cab9f4f64094d99c72ce9e0ba08b19e54674d00ab32ffaca90dfd9667af6a6de` | `g` 1005, `w` 1174 | the source-label table and the status block |
 * | ↳ | | `$2t` 1968, `m2s` 3167 | the setter and the empty-argument dispatch |
 * | `chunk-cj162a3d.js` | `59dc1de21ddf4f1e0c6756edeabdede1e2f3bebcb5b02699807004998801a62a` | 615 | the `local` registration's loader, whose body is only imports |
 * | `chunk-c27zz9xr.js` | `c53fa3e31a80e202f6222f8a2fce021df73abf4d53961da47286de0a6472e94d` | `Fe` 15738 | the setting reader |
 * | ↳ | | 15782 | `C = 1e5`, `v = 1e5`, `x = 1e6`, `t = 0`, the step, the bounds and the auto sentinel |
 * | ↳ | | `ue` 15808 | the dialog: the caption, the body, the selection and the apply arm |
 * | ↳ | | `io` 19858 | the `local-jsx` `call`, argument or dialog |
 * | `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `Xd` 406553 | the model record, whose `settingsKey` the messages name |
 * | ↳ | | `pVt` 859792, `fVt` 860242, `aE` 861173, `Mwt` 862752 | the stored value, the parser, the resolver, the override test |
 * | ↳ | | `SNt` 1132446, `que` 1132674 | the `local-jsx` and `local` registrations |
 * | `chunk-ppsy9aeg.js` | `465947c512c63aa3df813d9f08b9abb0a1ae82d32b05de3ea872eed55094f756` | 1374 | `vD = 1e5` and `xN = 1e6`, the accepted range |
 * | `chunk-bk5ct2gw.js` | `efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1` | `qo` 386338, `SW` 393400 | the model display name and the 200k fallback |
 * | `chunk-yn0pfn70.js` | `1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f` | `Lr` 10967 | the compact token count |
 *
 * The handler, read from `chunk-agx4redd.js`:
 *
 * ```js
 * function fVt(e){let n=e.trim().toLowerCase();if(n==="auto")return"auto";let r;
 *   if(n.endsWith("m"))r=parseFloat(n)*1e6;else if(n.endsWith("k"))r=parseFloat(n)*1000;
 *   else{let s=Dd(n);r=s>=100&&s<=1000?s*1000:s}
 *   if(!Number.isFinite(r)||r<vD||r>xN)return;return Math.round(r)}
 * function Mwt(e){return e==="env"||e==="settings"}
 * ```
 *
 * Two recovered sources are out. The environment source `CLAUDE_CODE_AUTO_COMPACT_WINDOW` has no
 * local counterpart, so the "is set and takes precedence" branch, the dialog's lock line and the
 * `env` label are unreachable, and `Mwt` reduces to "is the source settings". The
 * `experiment`/`clientdata` sources remain absent.
 *
 * The local resolved window is the one `src/cli.ts` computes: `min(configured, contextTokens -
 * maxTokens - 8192)`. That is `aE`'s `Math.min(h, configured)` with the launch-time ceiling in
 * place of the model's context window, so the `capped` suffix keeps its recovered meaning.
 */

/** Source `vD` in `chunk-ppsy9aeg.js` 1374, and `v`/`C` in `chunk-c27zz9xr.js` 15782. */
export const AUTO_COMPACT_MIN = 100_000;
/** Source `xN` in `chunk-ppsy9aeg.js` 1374, and `x` in `chunk-c27zz9xr.js` 15782. */
export const AUTO_COMPACT_MAX = 1_000_000;
/** Source `C` in `chunk-c27zz9xr.js` 15782: the dialog's adjust step. */
export const AUTO_COMPACT_STEP = 100_000;
/** `defaultConfig().compactAt` in `src/agent.ts`: the window when nothing is stored. */
export const AUTO_COMPACT_FALLBACK = 512_000;

export type AutoCompactSource = 'settings' | 'model-default';

export type ResolvedWindow = { window: number; configured: number; source: AutoCompactSource };

/** Source `Lr` in `chunk-yn0pfn70.js` 10967: a compact count, lowercased, without a trailing `.0`. */
export function formatTokens(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
    .format(value).toLowerCase().replace('.0', '');
}

/** Source `xd`'s numeric arm through `Dd`, narrowed to the plain decimal form `fVt` accepts. */
function number(value: string): number {
  return /^-?\d+$/.test(value) ? Number(value) : Number.NaN;
}

/**
 * Source `fVt` in `chunk-sfn1dbxq.js` 860242. `m`/`k` are multipliers, a bare number of 100 to
 * 1000 is shorthand for thousands, and the result must land in `[vD, xN]`. The `reset`/`unset`/
 * `default` aliases live in the caller (`$2t`), not here.
 */
export function parseAutoCompactWindow(argument: string): number | 'auto' | undefined {
  const value = argument.trim().toLowerCase();
  if (value === 'auto') return 'auto';
  let tokens: number;
  if (value.endsWith('m')) tokens = Number.parseFloat(value) * 1e6;
  else if (value.endsWith('k')) tokens = Number.parseFloat(value) * 1000;
  else {
    const parsed = number(value);
    tokens = parsed >= 100 && parsed <= 1000 ? parsed * 1000 : parsed;
  }
  if (!Number.isFinite(tokens) || tokens < AUTO_COMPACT_MIN || tokens > AUTO_COMPACT_MAX) return undefined;
  return Math.round(tokens);
}

/** The launch-time ceiling `src/cli.ts` applies to `compactAt`. */
export function autoCompactLimit(contextTokens: number, maxTokens: number): number {
  return contextTokens - maxTokens - 8192;
}

/**
 * Source `aE` in `chunk-sfn1dbxq.js` 861173, restricted to the two sources this host has.
 * `source` is `settings` when the store carries a value; otherwise the built-in fallback applies
 * and the source is `model-default`. `window` is the ceiling-clamped value.
 */
export function resolveAutoCompactWindow(limit: number, stored: number | undefined,
  fallback = AUTO_COMPACT_FALLBACK): ResolvedWindow {
  const configured = stored ?? Math.min(limit, fallback);
  return { window: Math.min(limit, configured), configured,
    source: stored === undefined ? 'model-default' : 'settings' };
}

/** Source `g` in `chunk-agx4redd.js` 1005, without the sources this host lacks. */
function sourceLabel(source: AutoCompactSource): string {
  return source === 'settings' ? 'from settings' : 'default for this model';
}

/**
 * The window caption both `w` and the dialog build: `Lr(configured) tokens (source)`, with the
 * `capped` suffix when the ceiling is lower than what was configured. Source `w`'s `d` at 1174
 * and `ue`'s `he` at `chunk-c27zz9xr.js` 15808.
 */
export function autoCompactWindowText(resolved: ResolvedWindow): string {
  const capped = resolved.configured > resolved.window
    ? ` · capped to ${formatTokens(resolved.window)} by model` : '';
  return `${formatTokens(resolved.configured)} tokens (${sourceLabel(resolved.source)})${capped}`;
}

/** w, agx4redd [1174,1968), UTF-16; ef's effective policy controls the disabled caption. */
export function autoCompactStatus(model: string, resolved: ResolvedWindow, enabled = true): string {
  const lines = [`Auto-compact window for ${model}: ${autoCompactWindowText(resolved)}`];
  if (!enabled) lines.push('Auto-compact is currently disabled (see /config)');
  lines.push('Auto-compact summarizes the conversation when context usage approaches this limit. ' +
    'The actual threshold is the minimum of this setting and your model\'s maximum context window.',
    'The auto setting picks a window tuned for your model and is strongly recommended for the best cost and performance.');
  if (resolved.source === 'settings') {
    lines.push('Overriding auto may result in high token usage, especially when resuming long sessions.');
  }
  return lines.join('\n');
}

/** The unchanged answer `ue` emits on cancel and on an accept with no adjustment. */
export function autoCompactUnchangedMessage(model: string, resolved: ResolvedWindow): string {
  return `Auto-compact window for ${model} unchanged: ${autoCompactWindowText(resolved)}`;
}

/**
 * ue, chunk-c27zz9xr.js [15808,19858), UTF-16. The dialog renders the two fixed paragraphs,
 * the disabled line and, when a window is stored, the override warning.
 *
 * The recovered warning follows the selection state (`a !== t`, so moving off auto raises it and
 * moving back clears it). The local dialog body is fixed when it opens, so the warning reflects
 * the opening state instead. That matches the recovered open for both sources, because a stored
 * window opens on its own row and an unset one opens on auto; only a move inside the dialog
 * leaves the line in place. `TerminalPromptChoice.description` renders for every row, so it
 * cannot carry a per-selection line either.
 */
export function autoCompactDialogMessage(model: string, resolved: ResolvedWindow, enabled = true): string {
  const lines = [`Current setting for ${model}: ${autoCompactWindowText(resolved)}`,
    'This command configures when auto-compaction happens. The actual threshold is the minimum ' +
    'of this setting and your model\'s maximum context window.',
    'The auto setting picks a window tuned for your model and is strongly recommended for the ' +
    'best cost and performance. You can override it below.'];
  if (!enabled) lines.push('Auto-compact is currently disabled (see /config)');
  if (resolved.source === 'settings') {
    lines.push('Overriding auto may result in high token usage, especially when resuming long sessions.');
  }
  return lines.join('\n');
}

/**
 * The dialog's selectable values: the auto sentinel (`t = 0` in `chunk-c27zz9xr.js` 15782) first,
 * then every step from the lower to the upper bound. The recovered adjust ring wraps at both ends
 * onto auto; a list chooser reaches the same values without the wrap.
 */
export function autoCompactChoices(): { label: string; value: string }[] {
  const rows = [{ label: 'auto', value: 'auto' }];
  for (let tokens = AUTO_COMPACT_MIN; tokens <= AUTO_COMPACT_MAX; tokens += AUTO_COMPACT_STEP) {
    rows.push({ label: `${formatTokens(tokens)} tokens`, value: String(tokens) });
  }
  return rows;
}

/**
 * The dialog's initial row, `me` at `chunk-c27zz9xr.js` 15808: auto unless the source is one the
 * `Mwt` test admits, in which case the configured value rounded to the step and clamped.
 */
export function autoCompactSelection(resolved: ResolvedWindow): number {
  if (resolved.source !== 'settings') return 0;
  const rounded = Math.min(AUTO_COMPACT_MAX,
    Math.max(AUTO_COMPACT_MIN, Math.round(resolved.configured / AUTO_COMPACT_STEP) * AUTO_COMPACT_STEP));
  return (rounded - AUTO_COMPACT_MIN) / AUTO_COMPACT_STEP + 1;
}

/** The row's value, so an accept can tell an unchanged pick from a changed one. */
export function autoCompactSelectionValue(resolved: ResolvedWindow): string {
  const index = autoCompactSelection(resolved);
  return index === 0 ? 'auto' : String(AUTO_COMPACT_MIN + (index - 1) * AUTO_COMPACT_STEP);
}

export type AutoCompactApply = {
  message: string;
  /** `auto` clears the stored window; a number is written to it; absent means nothing parsed. */
  saved?: number | 'auto';
};

/**
 * Source `$2t` in `chunk-agx4redd.js` 1968, minus the env-precedence arm and the persistence
 * error arm (the caller owns the write). `reset`, `unset` and `default` are the recovered aliases
 * for `auto`, tested on the trimmed argument before the parser runs.
 */
export function applyAutoCompactWindow(argument: string, options: {
  model: string; limit: number; fallback?: number;
}): AutoCompactApply {
  const value = argument.trim().toLowerCase();
  const parsed = value === 'reset' || value === 'unset' || value === 'default'
    ? 'auto' as const : parseAutoCompactWindow(value);
  if (parsed === undefined) {
    return { message: `Couldn't parse '${argument}'. Expected 'auto' or 100k–1M tokens ` +
      '(e.g. 500k, 200000, or 200 as shorthand)' };
  }
  const head = `Auto-compact window for ${options.model}`;
  if (parsed === 'auto') return { message: `${head} set to auto`, saved: 'auto' };
  const resolved = resolveAutoCompactWindow(options.limit, parsed, options.fallback);
  const capped = resolved.window < parsed
    ? ` (capped to model limit of ${formatTokens(resolved.window)})` : '';
  return { message: `${head} set to ${formatTokens(parsed)} tokens${capped}`, saved: parsed };
}
