/**
 * The bundled `asciichart` plotter (`plot`, chunk-dag4qhha.js [6162,7637), UTF-16 half-open).
 * The recovered body colours each series through the `colors` namespace; this host renders plain
 * text, so `color` is the identity function and the default padding label is kept.
 */
export type AsciiPlotOptions = {
  min?: number; max?: number; height?: number; offset?: number; padding?: string;
  format?: (value: number, index: number) => string; symbols?: readonly string[];
};

const SYMBOLS = ['┼', '┤', '╶', '╴', '─', '╰', '╭', '╮', '╯', '│'] as const;

export function asciiPlot(input: readonly number[] | readonly number[][], options: AsciiPlotOptions = {}): string {
  const series: readonly (readonly number[])[] = typeof input[0] === 'number'
    ? [input as readonly number[]] : input as readonly (readonly number[])[];
  let min = options.min ?? series[0]![0]!;
  let max = options.max ?? series[0]![0]!;
  for (const line of series) for (const value of line) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const range = Math.abs(max - min);
  const offset = options.offset ?? 3;
  const padding = options.padding ?? '           ';
  const height = options.height ?? range;
  const scale = range !== 0 ? height / range : 1;
  const low = Math.round(min * scale);
  const high = Math.round(max * scale);
  const rows = Math.abs(high - low);
  let width = 0;
  for (const line of series) width = Math.max(width, line.length);
  width += offset;
  const symbols = options.symbols ?? SYMBOLS;
  const format = options.format ?? ((value: number) => (padding + value.toFixed(2)).slice(-padding.length));
  const chart: string[][] = Array.from({ length: rows + 1 }, () => Array<string>(width).fill(' '));
  for (let row = low; row <= high; ++row) {
    const label = format(rows > 0 ? max - (row - low) * range / rows : row, row - low);
    chart[row - low]![Math.max(offset - label.length, 0)] = label;
    chart[row - low]![offset - 1] = row === 0 ? symbols[0]! : symbols[1]!;
  }
  for (const line of series) {
    const start = Math.round(line[0]! * scale) - low;
    chart[rows - start]![offset - 1] = symbols[0]!;
    for (let index = 0; index < line.length - 1; index++) {
      const from = Math.round(line[index]! * scale) - low;
      const to = Math.round(line[index + 1]! * scale) - low;
      if (from === to) chart[rows - from]![index + offset] = symbols[4]!;
      else {
        chart[rows - to]![index + offset] = from > to ? symbols[5]! : symbols[6]!;
        chart[rows - from]![index + offset] = from > to ? symbols[7]! : symbols[8]!;
        const lower = Math.min(from, to);
        const upper = Math.max(from, to);
        for (let level = lower + 1; level < upper; level++) chart[rows - level]![index + offset] = symbols[9]!;
      }
    }
  }
  return chart.map(row => row.join('')).join('\n');
}
