import { createHash } from 'node:crypto';
import { Ae, N, qt } from './tui-react-runtime.js';

N();
export const TerminalSizeContext = qt(null);
export const y4n = qt(false);
export const RenderSettingsContext = qt({ syntaxHighlightingDisabled: false, maxProseWidth: undefined });
export const SurfaceCapabilitiesContext = qt({ hyperlinks: false });

export { RU } from './tui-highlighter.js';
export { MXe } from './tui-highlight-cache.js';
export const Kl = () => Ae(RenderSettingsContext);
export const ke = () => {
  const size = Ae(TerminalSizeContext);
  if (!size) throw new Error('Terminal size context is missing');
  return size;
};
export const ns = (size: { columns: number; rows: number }) => size;
export const uw = () => Ae(SurfaceCapabilitiesContext).hyperlinks;
export const yOe = uw;
export const fje = uw;
export const I = (count: number, singular: string, plural = singular + 's') => count === 1 ? singular : plural;
export const aU = (text: string) => createHash('sha256').update(text).digest('hex');
export const bzn = (variant: string, text: string) => aU(variant.length + ':' + variant + text);
export const n4t = () => false;
export const r4t = (_listener: () => void) => () => {};
// Local diagnostics replace the source telemetry boundary.
export const f = (_event: string, _result: string) => {};
