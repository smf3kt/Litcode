import { jsx } from './tui-jsx.js';
import { s } from './tui-base-components.js';
import { drainedShellLineVisible, type DrainedShellSnapshot } from './tui-bash-mode.js';
import type { _4n } from './tui-native-input-source.js';

// tTe/oTo, 24k7d6mw [1521960,1523589), UTF-16; one command retains explicit expansion across hover changes.
export class ShellProgressInteraction {
  expanded = false;
  hovered = false;

  clickable(snapshot: DrainedShellSnapshot, columns: number, verbose: boolean): boolean {
    return !verbose && (this.expanded || drainedShellLineVisible(snapshot.output, snapshot.fullOutput, columns, snapshot.totalLines));
  }

  click(event: Pick<InstanceType<typeof _4n>, 'hyperlinkUrl' | 'allowDefault' | 'cellIsBlank'>): void {
    if (event.hyperlinkUrl) { event.allowDefault(); return; }
    if (this.expanded || !event.cellIsBlank) this.expanded = !this.expanded;
  }
}

export interface ShellProgressRegionProps {
  interaction: ShellProgressInteraction;
  clickable: boolean;
  changed(): void;
  children: unknown;
}

// tTe native wrapper, 24k7d6mw [1521987,1523589), UTF-16; ANSI rows retain the final frame's native hit testing.
export function ShellProgressRegion({ interaction, clickable, changed, children }: ShellProgressRegionProps) {
  return jsx(s, { flexDirection: 'column', flexShrink: 0, shellProgress: true,
    backgroundColor: interaction.expanded ? 'userMessageBackgroundHover' : undefined,
    hoverIgnoresBlankCells: !interaction.expanded,
    onClick: clickable ? (event: Parameters<ShellProgressInteraction['click']>[0]) => { interaction.click(event); changed(); } : undefined,
    onMouseEnter: clickable ? () => { interaction.hovered = true; changed(); } : undefined,
    onMouseLeave: clickable ? () => { interaction.hovered = false; changed(); } : undefined,
    children }, undefined);
}
