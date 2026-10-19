// The scroll viewport the modal host registers with its content.
//
// Source `uIe`/`Kp`, chunk-3gz7s57c.js [11348,11607) (259 units, sha256 fff228a4…): the holder a
// modal host puts in `VS.scrollViewport` (`p4.viewport`/`p4.modalViewport`, same module). `Ffe`
// reads `handle` synchronously while the dialog renders, `attach` swaps the handle a scroll box
// registers, and `subscribe` forwards the attached handle's redraw signal. The recovery is a
// verbatim copy in ./diff-scroll-viewport-source.ts.
import { uIe } from './diff-scroll-viewport-source.js';

/** The methods the dialog and the scroll box use on an attached handle (`K`, chunk-6x3scwgf.js). */
export interface ScrollHandle {
  scrollTo(top: number, options?: { preserveHwm?: boolean }): void;
  scrollToElement(element: unknown, offset?: number, options?: { block?: 'start' | 'end' }): void;
  scrollBy(delta: number): void;
  scrollToBottom(): void;
  getScrollTop(): number;
  getPendingDelta(): number;
  getScrollHeight(): number;
  getFreshScrollHeight(): number;
  getViewportHeight(): number;
  getViewportTop(): number;
  isSticky(): boolean;
  subscribe(listener: () => void): () => void;
  setClampBounds(min: number | undefined, max: number | undefined): void;
  getDomElement(): unknown;
}

/** The value `VS.scrollViewport` carries: a live handle slot plus its redraw signal. */
export interface ScrollViewport {
  /** The handle currently registered by a scroll box, or null before the first attach. */
  readonly handle: ScrollHandle | null;
  /** Register a scroll box handle; returns the release that clears it. */
  attach(handle: ScrollHandle): () => void;
  subscribe(listener: () => void): () => void;
}

export function createScrollViewport(): ScrollViewport {
  return new uIe() as unknown as ScrollViewport;
}
