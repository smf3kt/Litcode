// User-supplied snowy-owl artwork replaces Hee's art under the W302 S-7 exception.
export type OwlPose = 'rest' | 'breathe' | 'blink' | 'look-left' | 'look-right' | 'wings';
export type OwlPixel = ' ' | 'w' | 'g' | 'y' | 'k';
export const OWL_WIDTH = 20;
export const OWL_HEIGHT = 16;

const silhouette = [
  [0, -1], [5, 14], [4, 15], [3, 16], [3, 16], [2, 17], [2, 17], [2, 17],
  [1, 18], [0, 19], [1, 18], [2, 17], [3, 16], [4, 15], [5, 14], [4, 15],
] as const;

export function owlPixels(pose: OwlPose): OwlPixel[][] {
  const pixels = silhouette.map(([left, right], row): OwlPixel[] => Array.from({ length: OWL_WIDTH }, (_, column) =>
    row < 14 && column >= left && column <= right ? 'w' : ' '));
  const put = (x: number, y: number, color: OwlPixel) => { pixels[y]![x] = color; };
  for (const x of [6, 13]) put(x, 3, 'g');
  for (const x of [4, 15]) put(x, 11, 'g');
  for (const x of [1, 18]) put(x, 8, 'g');
  for (const x of [0, 19]) put(x, 9, 'g');
  for (const left of [5, 12]) {
    for (let x = left; x < left + 3; x++) {
      put(x, 5, pose === 'blink' ? 'w' : 'y');
      put(x, 6, pose === 'blink' ? 'k' : 'y');
    }
    if (pose !== 'blink') put(left + (pose === 'look-left' ? 0 : pose === 'look-right' ? 2 : 1), 5, 'k');
  }
  put(9, 7, 'k'); put(10, 7, 'k');
  for (const left of [5, 12]) {
    for (let x = left; x <= left + 2; x++) put(x, 14, 'k');
    put(left - 1, 15, 'k'); put(left, 15, 'k'); put(left + 2, 15, 'k'); put(left + 3, 15, 'k');
  }
  if (pose === 'wings') {
    for (const [x, y] of [[0, 8], [19, 8], [1, 7], [18, 7]] as const) put(x, y, 'g');
    put(0, 9, ' '); put(19, 9, ' ');
  }
  if (pose === 'breathe') {
    for (let y = 0; y < 8; y++) pixels[y] = [...pixels[y + 1]!];
    put(1, 8, 'w'); put(18, 8, 'w');
  }
  return pixels;
}

interface OwlFrame { pose: OwlPose; milliseconds: number }
const idle: readonly OwlFrame[] = [
  { pose: 'rest', milliseconds: 2400 }, { pose: 'breathe', milliseconds: 650 },
  { pose: 'rest', milliseconds: 800 }, { pose: 'blink', milliseconds: 150 },
  { pose: 'rest', milliseconds: 2100 }, { pose: 'look-left', milliseconds: 450 },
  { pose: 'rest', milliseconds: 700 }, { pose: 'look-right', milliseconds: 450 },
];
const working: readonly OwlFrame[] = [
  { pose: 'look-left', milliseconds: 450 }, { pose: 'breathe', milliseconds: 250 },
  { pose: 'look-right', milliseconds: 450 }, { pose: 'wings', milliseconds: 250 },
  { pose: 'rest', milliseconds: 600 }, { pose: 'blink', milliseconds: 140 },
];

/** Di/SEe, 1r9zp6s1 [24622,24997), UTF-16, adapted to authored pose delays and terminal lifetime. */
export class OwlAnimation {
  private index = 0;
  private activity = false;
  private active = false;
  private reduced = false;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private readonly changed: () => void) {}
  get pose(): OwlPose { return this.reduced ? 'rest' : this.frames[this.index]!.pose; }
  private get frames(): readonly OwlFrame[] { return this.activity ? working : idle; }

  update(active: boolean, isWorking: boolean, reduced: boolean): void {
    if (this.closed) return;
    if (isWorking !== this.activity) {
      this.activity = isWorking; this.index = 0; this.cancel();
    }
    this.reduced = reduced;
    this.active = active && !reduced;
    if (!this.active) this.cancel();
    else if (this.timer === undefined) this.schedule();
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.closed || !this.active) return;
      this.index = (this.index + 1) % this.frames.length;
      this.changed();
      if (!this.closed && this.active && this.timer === undefined) this.schedule();
    }, this.frames[this.index]!.milliseconds);
    this.timer.unref?.();
  }
  private cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
  close(): void { this.closed = true; this.active = false; this.cancel(); }
}
