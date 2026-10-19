/**
 * Readable seam over the footer's permission-mode chip. The descriptor table is copied from
 * `chunk-3cynezh1.js` (sha256 c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3)
 * and the chip grammar from `chunk-24k7d6mw.js`
 * (sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31).
 *
 * Zero-based UTF-16 half-open ranges.
 */

/** Source `jbe`/`lut` (65901): the paused and running mode glyphs. */
export const MODE_PAUSED = '⏸';
export const MODE_RUNNING = '⏵⏵';

export interface ModeDescriptor {
  title: string; shortTitle: string; indicator: string; symbol: string; color: string; external: string;
}

/** Source `ur` [69464,70196): every permission mode's chip text, glyph and theme slot. */
const MODE_DESCRIPTORS: Readonly<Record<string, ModeDescriptor>> = {
  default: { title: 'Manual', shortTitle: 'Manual', indicator: 'manual mode', symbol: MODE_PAUSED, color: 'inactive', external: 'default' },
  plan: { title: 'Plan', shortTitle: 'Plan', indicator: 'plan mode', symbol: MODE_PAUSED, color: 'planMode', external: 'plan' },
  acceptEdits: { title: 'Accept edits', shortTitle: 'Accept', indicator: 'accept edits', symbol: MODE_RUNNING, color: 'autoAccept', external: 'acceptEdits' },
  bypassPermissions: { title: 'Bypass Permissions', shortTitle: 'Bypass', indicator: 'bypass permissions', symbol: MODE_RUNNING, color: 'error', external: 'bypassPermissions' },
  dontAsk: { title: "Don't Ask", shortTitle: 'DontAsk', indicator: "don't ask", symbol: MODE_RUNNING, color: 'error', external: 'dontAsk' },
  auto: { title: 'Auto', shortTitle: 'Auto', indicator: 'auto mode', symbol: MODE_RUNNING, color: 'warning', external: 'auto' },
};

/** Source `Pt` (70231): an unknown mode reads as the default descriptor. */
export function modeDescriptor(mode: string | undefined): ModeDescriptor {
  return (mode !== undefined ? MODE_DESCRIPTORS[mode] : undefined) ?? MODE_DESCRIPTORS.default!;
}

/** Source `cPs` [70583,70632): the mode whose chip is the plain default. */
export function isDefaultMode(mode: string | undefined): boolean {
  return mode === 'default' || mode === undefined;
}

/** Source `Y$`/`o9e`/`bD` [70773,70880): the indicator text, glyph and theme slot. */
export function modeIndicator(mode: string | undefined): string { return modeDescriptor(mode).indicator; }
export function modeSymbol(mode: string | undefined): string { return modeDescriptor(mode).symbol; }
export function modeColorSlot(mode: string | undefined): string { return modeDescriptor(mode).color; }

/**
 * Source `DR` [628129,628675): the chip is `symbol`, a space, the indicator, and ` on` unless the
 * caller asked for the bare form, followed by whatever the caller appends. The source renders the
 * cycle hint as that child; this product has no permission-mode key, so the chip stands alone.
 */
export function modeChip(mode: string | undefined, bare = false): string {
  return `${modeSymbol(mode)} ${modeIndicator(mode)}${bare ? '' : ' on'}`;
}

/**
 * This product's internal mode names against the table's. `PermissionPolicy['mode']` spells the
 * bypass mode `bypass` while the source, and this product's own settings schema, spell it
 * `bypassPermissions`; `ask` has no descriptor in the source, so `Pt`'s own fallback applies.
 */
export function externalMode(mode: string | undefined): string | undefined {
  return mode === 'bypass' ? 'bypassPermissions' : mode;
}
