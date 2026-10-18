import { Ae, qt } from './plugin-chain-react-hooks.js';
import { Re } from './plugin-chain-hover-source.js';
import { Lc } from './plugin-chain-press-button-source.js';
import { P as ProjectContext } from './plugin-chain-session-context-source.js';
import type { GitDiffData } from './git-diff-data.js';
import type { GitDiffBaseMode } from './git-diff-data.js';
import type { DiffSelection } from './diff-selection.js';

export interface DiffPanelHost {
  store: { getSnapshot(): any; getState(): any; setState(update: (state: any) => any): void; subscribe(listener: () => void): () => void };
  data: GitDiffData;
  baseMode: GitDiffBaseMode;
  cycleBase(mode: string): GitDiffBaseMode;
  close(): void;
  denied(file: string): boolean;
  attachSelection(selection: DiffSelection): void;
}
export const DiffPanelContext = qt<DiffPanelHost | null>(null);
const host = (): DiffPanelHost => {
  const value = Ae(DiffPanelContext);
  if (!value) throw new Error('Diff panel has no terminal owner');
  return value;
};
export const V = <T>(selector: (state: any) => T): T => Re(host().store, selector) as T;
export const Mn = () => host().store.setState;
export const is = host;
export const Pe = () => ({ storageV5: host() });
export const WKn = (): GitDiffData => host().data;
export const iFt = (): GitDiffBaseMode => host().baseMode;
export const DMr = (mode: string, owner: DiffPanelHost): GitDiffBaseMode => owner.cycleBase(mode);
export const MMr = (owner: DiffPanelHost): void => owner.close();
export const mz = (): boolean => true;
export const vo = () => ({ processQueue() {} });
export const F = (values: any[], predicate: (item: any) => boolean): number => values.filter(predicate).length;
export const L4 = (): boolean => false;
export const nKn = (): boolean => false;
export const U3t = (): string => (Ae(ProjectContext) as unknown as { get(): { cwd: string } }).get().cwd;
export const ur = (value: string): string => value;
export const Ui = (file: string, permission: DiffPanelHost): string | null => permission.denied(file) ? file : null;
export const Xe = (): string => 'current';
export const us = (action: string, context: string, fallback: string): string => Lc()?.getDisplayText?.(action, context) ?? fallback;
export const nI = (callback: () => void, ms: number): (() => void) => {
  const timer = setTimeout(callback, ms);
  timer.unref?.();
  return () => clearTimeout(timer);
};
export const Cje = (): (() => void) => () => {};
export const Lt = (text: string, part: string): number => text.split(part).length - 1;
export const g = (): void => {};
export const vie = (node: { scrollTop?: number; scrollHeight?: number; scrollViewportHeight?: number }): number => node.scrollHeight === undefined
  ? node.scrollTop ?? 0 : Math.min(node.scrollTop ?? 0, Math.max(0, node.scrollHeight - (node.scrollViewportHeight ?? 0)));

export { IT } from './diff-panel-progress-source.js';
