/**
 * The `/effort` command. Every text below is recovered verbatim; the offsets are zero-based
 * UTF-16 code units into the named module.
 *
 * | Module | SHA-256 | Range | Contents |
 * | --- | --- | --- | --- |
 * | `chunk-tf9zceev.js` | `ca7616f7ec5d200996ce7390e7c178b231760acfa088b6d655af8b132574e4cb` | `u` [4922,5480) | the non-interactive handler |
 * | `chunk-0q6c90q6.js` | `97c49a70fcefc8407f6fc93c4b4c8d50a7b63ca8c6d3a3aba6627e91c761457b` | `F` 1011, `wyt` 1313, `yhn` 1351, `g` 1668, `djr` 1763 | the usage table and builder, the valid-option list |
 * | ↳ | | `D` 2541, `v` 4018, `VBt` 4189, `V` 4505 | the level setter, the override reader, the status builder, the auto setter |
 * | ↳ | | `k` 5283, `A` 5896, `P` 6037, `MOe` 6286 | the ultracode toggle, its parser, the argument dispatch, the applier |
 * | `chunk-9vcaezw1.js` | `eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0` | `ZI` 5771, `VC` 5819, `CS` 6206, `b` 6243, `NNe` 7175 | the workflow gate, the ultracode predicate, the level test and index, the organization default |
 * | ↳ | | `mde` 7571, `Y9` 7619, `re` 8196, `VJ` 8408, `qJ` 8440, `Z_e` 8999, `Y0` 9148 | the offered levels, the cap clamp, the alias map, the display, the parser, the persistable set, the env override |
 * | ↳ | | `Git` 9384, `Qre` 9529, `RNn` 11760, `kE` 12972, `X9` 13965, `we` 13897, `qC` 14204, `De` 14578, `Nuo` 15007 | the effort values, the settings read, the settings write, the fallback, the descriptions |
 * | `chunk-3cynezh1.js` | `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3` | `Ia`/`V$` 29926/29967 | the level list and the `max` note |
 * | ↳ | | 65823 | the level glyphs `○ ◐ ● ◉ ◈` |
 * | `chunk-gsnbskq4.js` | `d3a5291c4b2208b78602b8cfe03d071dfd32c076a70bbd9cbe0276068ca300ee` | `UP` 10522 | the help words |
 * | `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | `eee` 153296, `z$` 153407 | the level-change notice and its glyph |
 * | ↳ | | 894081 | the notice call site, keyed `DS = "effort-level"`, `timeoutMs: 1e4` |
 * | `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `Mjt` 1659192, registrations 1659314 / 1659513 | the argument-hint builder and the two `effort` registrations |
 *
 * Three recovered branches are out.
 *
 * The per-model effort cap (`E7t`/`w_r`, the `Y9` clamp at 7619, the `Y9` call in `D`, and the
 * "exceeds the cap" message) reads a model-capability table this host has no source for, so every
 * level is offered and that message is unreachable.
 *
 * The ultracode toggle (`ZI`/`VC`/`k`/`A`, "dynamic workflows on every task") needs the
 * session-wide workflow opt-in and its system-reminder. `ZI` is false here, so `yhn` and `g` render
 * their `ZI` false form, which is a state the recovered product also produces.
 *
 * The remote transport (`vr`, `R`/`O`, the `is_remote` telemetry and the "this remote transport
 * can't change the remote session's settings" suffix) has no local counterpart.
 */

import { z } from 'zod';

/** se/de/Pe, 9vcaezw1 [10462,12370), UTF-16; arbitrary gateway IDs bypass the vendor alias table. */
export const modelSettingsSchema = z.record(z.string(), z.object({
  effortLevel: z.enum(['low', 'medium', 'high', 'xhigh']).optional(),
}));
export const effortSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('inherit'), fallback: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional() }),
  z.object({ kind: z.literal('level') }), z.object({ kind: z.literal('default') }),
]);
export type EffortSelection = z.infer<typeof effortSelectionSchema>;
export type ModelSettings = z.infer<typeof modelSettingsSchema>;

export function modelSettingsKey(model: string): string { return model.replace(/\[1m\]$/, ''); }
export function configuredEffort(settings: { modelSettings?: ModelSettings; effort?: EffortLevel }, model: string): EffortLevel | undefined {
  const key = modelSettingsKey(model);
  return settings.modelSettings !== undefined && Object.hasOwn(settings.modelSettings, key)
    ? settings.modelSettings[key]?.effortLevel ?? settings.effort : settings.effort;
}

/** uc/ys, 9vcaezw1 [12346,12719), 24k7d6mw [620537,620695), UTF-16: manual state survives focus, inherited state resolves by model. */
export function modelEffort(config: { effort?: EffortLevel; effortSelection?: EffortSelection; modelSettings?: ModelSettings }, model: string): EffortLevel | undefined {
  if (config.effortSelection?.kind === 'default') return;
  if (config.effortSelection?.kind !== 'inherit') return config.effort;
  return configuredEffort({ modelSettings: config.modelSettings, effort: config.effortSelection.fallback }, model);
}

/** Source `Ia` in `chunk-3cynezh1.js` 29926. */
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortLevel = typeof EFFORT_LEVELS[number];

/** Source `re` in `chunk-9vcaezw1.js` 8196: the one accepted alias. */
const EFFORT_ALIASES: Record<string, EffortLevel> = { med: 'medium' };

/** Source `V$` in `chunk-3cynezh1.js` 29967, interpolated into the `max` description. */
export const MAX_EFFORT_NOTE = 'May use excessive tokens resulting in long response times or overthinking. ' +
  'Use sparingly for the hardest tasks.';

/** Source `F` in `chunk-0q6c90q6.js` 1011: the short descriptions `yhn` lists. */
const USAGE_DESCRIPTIONS: Record<EffortLevel, string> = {
  low: 'Quick, straightforward implementation',
  medium: 'Balanced approach with standard testing',
  high: 'Comprehensive implementation with extensive testing',
  xhigh: 'Extended reasoning with thorough analysis (on supported models)',
  max: 'Maximum capability with deepest reasoning (on supported models)',
};

/** Source `De` in `chunk-9vcaezw1.js` 14578, reached through `Nuo` at 15007. */
export function effortDescription(level: EffortLevel): string {
  switch (level) {
    case 'low': return 'Quick, straightforward implementation with minimal overhead';
    case 'medium': return 'Balanced approach with standard implementation and testing';
    case 'high': return 'Comprehensive implementation with extensive testing and documentation';
    case 'xhigh': return 'Deeper reasoning than high, just below maximum (on supported models)';
    case 'max': return `Maximum capability with deepest reasoning. ${MAX_EFFORT_NOTE}`;
  }
}

/** Source `z$` in `chunk-24k7d6mw.js` 153407 over the glyphs at `chunk-3cynezh1.js` 65823. */
export function effortGlyph(level: EffortLevel): string {
  switch (level) {
    case 'low': return '○';
    case 'medium': return '◐';
    case 'high': return '●';
    case 'xhigh': return '◉';
    case 'max': return '◈';
  }
}

/** Source `CS` in `chunk-9vcaezw1.js` 6206. */
export function isEffortLevel(value: string): value is EffortLevel {
  return (EFFORT_LEVELS as readonly string[]).includes(value);
}

/** Source `qJ` in `chunk-9vcaezw1.js` 8440. */
export function parseEffortLevel(argument: string): EffortLevel | undefined {
  const normalised = argument.trim().toLowerCase();
  const level = EFFORT_ALIASES[normalised] ?? normalised;
  return isEffortLevel(level) ? level : undefined;
}

/**
 * Source `Z_e` in `chunk-9vcaezw1.js` 8999: the levels `X9` at 13965 writes to `userSettings`.
 * `max` is absent, so it stays session-scoped.
 */
export function persistableEffort(level: EffortLevel): Exclude<EffortLevel, 'max'> | undefined {
  return level === 'max' ? undefined : level;
}

/** Source `VJ` in `chunk-9vcaezw1.js` 8408. */
const show = (level: EffortLevel | 'auto'): string => String(level);

/** Source `g` in `chunk-0q6c90q6.js` 1668, with `ZI` false. */
function validOptions(): string {
  return `${EFFORT_LEVELS.join(', ')}, auto`;
}

/** Source `yhn` in `chunk-0q6c90q6.js` 1351, with `ZI` false. */
export function effortUsage(): string {
  return `Usage: /effort [${EFFORT_LEVELS.join('|')}|auto]

Effort levels:
${EFFORT_LEVELS.map(level => `- ${level}: ${USAGE_DESCRIPTIONS[level]}\n`).join('')}- auto: Use the default effort level for your model`;
}

/** Source `Mjt` in `chunk-sfn1dbxq.js` 1659192, the `local` registration's hint form. */
export function effortArgumentHint(): string {
  return `<${EFFORT_LEVELS.join('|')}|auto>`;
}

/** Source `wyt` in `chunk-0q6c90q6.js` 1313: what ultracode turns on. */
export const ULTRACODE_DESCRIPTION = 'dynamic workflows on every task';

/** Source `A` in `chunk-0q6c90q6.js` 5896: `ultracode`, `ultracode on` and `ultracode off`. */
export function parseUltracodeArgument(argument: string): boolean | undefined {
  const [head, mode, ...rest] = argument.trim().split(/\s+/);
  if (head !== 'ultracode' || rest.length > 0) return undefined;
  if (mode === undefined || mode === 'on') return true;
  return mode === 'off' ? false : undefined;
}

/** Source `g` in `chunk-0q6c90q6.js` 1668, with the dynamic-workflow gate open. */
export function validOptionsWithUltracode(): string {
  return `${EFFORT_LEVELS.join(', ')}, auto, ultracode`;
}

/** Source `yhn` in `chunk-0q6c90q6.js` 1351, with the ultracode paragraph. */
export function effortUsageWithUltracode(): string {
  return `${effortUsage()}

Ultracode (any effort level, ${ULTRACODE_DESCRIPTION}):
- ultracode [on|off]: Turn ultracode on or off for this session`;
}

/** Source `Mjt` in `chunk-sfn1dbxq.js` 1659192, with the ultracode arm. */
export function effortArgumentHintWithUltracode(): string {
  return `<${EFFORT_LEVELS.join('|')}|auto|ultracode [on|off]>`;
}

/**
 * Source `VBt` in `chunk-0q6c90q6.js` 4189, without the ultracode suffix (`VC`, 5819) and the
 * organization suffix (`NNe` at 7175). `current` is the session's effort, undefined on `auto`;
 * `fallback` is the level `auto` resolves to.
 */
export function effortStatus(current: EffortLevel | undefined, fallback: EffortLevel): string {
  if (current === undefined) return `Effort level: auto (currently ${show(fallback)})`;
  return `Current effort level: ${show(current)} (${effortDescription(current)})`;
}

/**
 * Source `eee` in `chunk-24k7d6mw.js` [153296,153407), UTF-16. The call site at 894081 runs it from an
 * effect that watches the effective level, clearing and re-raising the `effort-level` notice on
 * every change with `timeoutMs: 1e4`. The existing second argument is source `M`; the third is `T`.
 */
export function effortIndicator(level: EffortLevel | undefined, withPrefix = false, ultracode = false): string | undefined {
  if (!level) return;
  return `${withPrefix ? 'effort:' : effortGlyph(level)} ${level}${ultracode ? ' · ultracode' : ''} · /effort`;
}

/**
 * Source `Y0` in `chunk-9vcaezw1.js` 9148 over this host's `LLM_EFFORT`, which is what
 * `src/cli.ts` reads for the same purpose. `D` interpolates the raw string, so both are returned.
 */
export function effortOverride(env: NodeJS.ProcessEnv = process.env): { raw: string; level: EffortLevel | null } | null {
  const raw = env.LLM_EFFORT;
  if (raw === undefined) return null;
  const normalised = raw.trim().toLowerCase();
  if (normalised === 'unset' || normalised === 'auto') return { raw, level: null };
  // z1/Y0, 9vcaezw1 [8790,9267), UTF-16: invalid or empty values have no override.
  const level = parseEffortLevel(normalised);
  return level === undefined ? null : { raw, level };
}

/** Source `qC` in `chunk-9vcaezw1.js` 14204: the level `auto` resolves to, absent a model table. */
export const DEFAULT_EFFORT: EffortLevel = 'high';

export type EffortCommandResult = {
  message: string;
  /** The session effort the command leaves behind: a level, `null` for `auto`, absent to keep. */
  effort?: EffortLevel | null;
  /** The level to persist as the default, `null` to clear it; absent keeps the stored value. */
  saved?: EffortLevel | null;
  /** The session ultracode flag, absent when the command does not touch it. */
  ultracode?: boolean;
};

/**
 * Source `D` in `chunk-0q6c90q6.js` 2541. The settings write (`X9` at 13965) runs before the
 * override check, so a persistable level is saved even when `LLM_EFFORT` then wins the session.
 */
function setLevel(level: EffortLevel, save: boolean): EffortCommandResult {
  const persistable = persistableEffort(level);
  const saved = save && persistable !== undefined;
  const suffix = saved ? ' (saved as your default for new sessions)' : ' (this session only)';
  const override = effortOverride();
  if (override !== null && override.level !== level) {
    const applied = { effort: level, ...(saved ? { saved: persistable } : {}) };
    if (persistable === undefined) {
      return { message: `Not applied: LLM_EFFORT=${override.raw} overrides effort this session, ` +
        `and ${show(level)} is session-only (nothing saved)`, ...applied };
    }
    return { message: `LLM_EFFORT=${override.raw} overrides this session — clear it and ${show(level)} takes over`,
      ...applied };
  }
  return { message: `Set effort level to ${show(level)}${suffix}: ${effortDescription(level)}`,
    effort: level, ...(saved ? { saved: persistable } : {}) };
}

/** Source `V` in `chunk-0q6c90q6.js` 4505: clear the level back to `auto`. */
function setAuto(save: boolean): EffortCommandResult {
  const override = effortOverride();
  if (override !== null && override.level !== null) {
    return { message: `${save ? 'Cleared effort from settings, but' : 'Effort set to auto for this session, but'} ` +
      `LLM_EFFORT=${override.raw} still controls this session`, effort: null, ...(save ? { saved: null } : {}) };
  }
  return { message: `Effort level set to auto${save ? '' : ' (this session only)'}`,
    effort: null, ...(save ? { saved: null } : {}) };
}

/**
 * Source `P` in `chunk-0q6c90q6.js` 6037, the argument dispatch `MOe` at 6286 applies. The
 * order is `auto`/`unset`, then the ultracode arm (`A` at 5896, `k` at 5283), then a level.
 * `save` is the recovered `r` argument, which the interactive handler passes true.
 */
export function effortCommand(argument: string, options: {
  current: EffortLevel | undefined; fallback: EffortLevel; save: boolean;
  /** The current session ultracode flag; absent means off. */
  ultracode?: boolean;
  /** Source `ZI()`: whether dynamic workflows are enabled. */
  workflowsEnabled?: boolean;
  /** Source `ZI(model)`: whether the model supports them. */
  modelSupportsUltracode?: boolean;
  model?: string;
}): EffortCommandResult {
  const value = argument.trim();
  const lower = value.toLowerCase();
  const workflows = options.workflowsEnabled === true;
  // Source `UP` in `chunk-gsnbskq4.js` 10522, tested against the trimmed argument.
  if (['help', '-h', '--help'].includes(lower)) {
    return { message: workflows ? effortUsageWithUltracode() : effortUsage() };
  }
  if (lower === 'current' || lower === 'status') {
    return { message: effortStatus(options.current, options.fallback) };
  }
  // Source the handler's `if(!e)` at `chunk-tf9zceev.js` [4922,5480).
  if (value === '') return { message: `Usage: /effort ${workflows ? effortArgumentHintWithUltracode() : effortArgumentHint()}` };
  if (lower === 'auto' || lower === 'unset') return setAuto(options.save);
  // Source `A`/`k`: a malformed ultracode argument falls through to the level parser below,
  // which reports it as invalid.
  const ultracode = parseUltracodeArgument(lower);
  if (ultracode !== undefined) return setUltracode(ultracode, options);
  const level = parseEffortLevel(value);
  // Source `g(tt())`, whose list the invalid-argument message carries.
  if (level === undefined) {
    return { message: `Invalid argument: ${value}. Valid options are: ${workflows ? validOptionsWithUltracode() : validOptions()}` };
  }
  return setLevel(level, options.save);
}

/**
 * Source `k` in `chunk-0q6c90q6.js` 5283: the ultracode toggle. It refuses when dynamic
 * workflows are off or the model does not support them, and the message names the effort that
 * stays in force.
 */
function setUltracode(ultracode: boolean, options: { current?: EffortLevel; fallback: EffortLevel;
  workflowsEnabled?: boolean; modelSupportsUltracode?: boolean; model?: string }): EffortCommandResult {
  if (ultracode && options.workflowsEnabled !== true) {
    return { message: `Ultracode needs dynamic workflows enabled (see /config). Valid options are: ${validOptions()}` };
  }
  if (ultracode && options.modelSupportsUltracode === false) {
    return { message: `Ultracode isn't available on ${options.model ?? 'this model'}. Valid options are: ${validOptions()}` };
  }
  const effort = options.current ?? options.fallback;
  return {
    message: ultracode
      ? `Ultracode on (this session only): ${ULTRACODE_DESCRIPTION}. Effort stays ${effort}.`
      : `Ultracode off. Effort stays ${effort}.`,
    ultracode,
  };
}
