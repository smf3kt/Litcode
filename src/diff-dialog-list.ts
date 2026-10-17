// The diff dialog's list (W172). Copied bodies live in ./diff-dialog-list-source.ts: 59 blocks,
// 31,687 UTF-16 units across nine modules. The list component `Tl` is `Cn` with `Item` (`Po`) and
// `Heading` (`Bo`) attached; `Cn` renders the accessible branch through `ZY` and the normal branch
// through `Eo`/`Qe`.
//
// Ranges and module digests are recorded in ./diff-dialog-list-source-blocks.json and
// research/ports/W172-list.md. Host bindings live in ./diff-dialog-list-host.ts.
import {
  Bo as ListHeadingSource, Mo, NXe, Po as ListItemSource, Tl, fn, rx,
} from './diff-dialog-list-source.js';
import type { SurfaceElement } from './plugin-chain-react-hooks.js';

export interface ListProps {
  children?: unknown;
  emptyMessage?: unknown;
  visibleCount?: number;
  maxVisibleCount?: number;
  defaultFocusIndex?: number;
  resetKey?: unknown;
  onSelect?: (index: number) => void;
  onFocus?: (index: number) => void;
  onRowKeyDown?: (event: unknown, index: number) => void;
  isDisabled?: boolean | (() => boolean);
  onDisabledRowClick?: (index: number) => void;
  wrap?: boolean;
  onUpFromFirstItem?: () => void;
  onDownFromLastItem?: () => void;
  declineHomeEnd?: boolean;
  keybindingContext?: string;
  overflowHint?: 'count' | 'glyph' | 'none';
  scrollBar?: boolean;
  hoverStyle?: string;
  rowClick?: 'select' | 'move';
  styled?: boolean;
}

export interface ListItemProps {
  children?: unknown;
}

export interface ListHeadingProps {
  children?: unknown;
}

/** Source `Tl`: the list with `Item` and `Heading` attached as statics. */
export const List = Tl as unknown as ((props: ListProps) => SurfaceElement) & {
  Item: (props: ListItemProps) => SurfaceElement;
  Heading: (props: ListHeadingProps) => SurfaceElement;
};

/** Source `Po`: a selectable list row. */
export function ListItem(props: ListItemProps): SurfaceElement {
  return ListItemSource(props as never) as SurfaceElement;
}

/** Source `Bo`: a list heading row. */
export function ListHeading(props: ListHeadingProps): SurfaceElement {
  return ListHeadingSource(props as never) as SurfaceElement;
}

/** Source `NXe`: the container that measures its box and rows for the list. */
export function ListContainer(props: { reserve?: number; children?: unknown }): SurfaceElement {
  return NXe(props as never) as SurfaceElement;
}

/** Source `fn`: the list navigation state (cursor, window, scrollbar bindings). */
export function useListNavigation(options: Record<string, unknown>): Record<string, unknown> {
  return fn(options as never) as Record<string, unknown>;
}

/** Source `rx`: whether the current row is selected, from the `Mo` context. */
export function useListSelection(): boolean {
  return rx() as boolean;
}

/** The selection context token (`Mo`). */
export const ListSelectionContext = Mo;

/** The copied bodies under their source names. */
export const SOURCE_BODIES = { Tl, Po: ListItemSource, Bo: ListHeadingSource, NXe, fn, rx, Mo };
