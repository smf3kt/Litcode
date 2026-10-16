// Measures the raster cell encoder and admission bucket (W45-60) before any assertion is written. One
// JSON line per case.
import { it } from '../src/plugin-chain-host.js';
import {
  admitRasterFrame, backgroundHalf, CELL_WORDS, CHANNEL_LAYOUT, COLOUR_HALVES, DEFAULT_CHANNEL,
  DEFAULT_RASTER_COLUMNS, DEFAULT_RASTER_ROWS, encodeCell, foregroundHalf, freshRasterAdmission,
  RASTER_ADMISSION_CAPACITY, RASTER_REFILL_MS, RASTER_TOKENS_PER_SECOND, rasterAdmission,
  SITE_MOUNT_FIELDS, validateDefaultRasterSize, validateRasterSize,
} from '../src/plugin-chain-raster-cells.js';
import { mb } from '../src/plugin-chain-raster-cells-source.js';

const show = (label: string, value: unknown) => console.log(label, JSON.stringify(value));

console.log('--- the constants ---');
show('capacity/rate/base/sizes', [RASTER_ADMISSION_CAPACITY, RASTER_TOKENS_PER_SECOND, RASTER_REFILL_MS, DEFAULT_RASTER_COLUMNS, DEFAULT_RASTER_ROWS]);
show('default channel', DEFAULT_CHANNEL);
show('halves', COLOUR_HALVES);
show('channels', CHANNEL_LAYOUT);
show('cell words', CELL_WORDS);
show('mount fields', SITE_MOUNT_FIELDS);

console.log('--- the row ---');
show('fresh', freshRasterAdmission());
it().rasterAdmission = undefined;
const row = rasterAdmission();
show('first read', row);
show('in the registry', it().rasterAdmission === row);
show('second read is the same row', rasterAdmission() === row);
show('a reset hook on mb', typeof (mb as { reset?: unknown }).reset, Object.keys(mb as object).join(','));

console.log('--- admission ---');
{
  const fresh = () => ({ tokens: RASTER_ADMISSION_CAPACITY, refilledAt: 0 });
  const a = fresh();
  show('cost 0 at full', [admitRasterFrame(a, 0, 0), a.tokens]);
  const b = fresh();
  show('cost 1024 at full', [admitRasterFrame(b, 0, 1024), b.tokens]);
  const c = fresh();
  show('cost over the tokens', [admitRasterFrame(c, 0, 4097), c.tokens]);
  const d = fresh();
  show('cost exactly the tokens', [admitRasterFrame(d, 0, 4096), d.tokens]);
  const e = { tokens: 0, refilledAt: 0 };
  show('cost 0 with no tokens', [admitRasterFrame(e, 0, 0), e.tokens]);
  const f = { tokens: 0, refilledAt: 0 };
  show('one second later', [admitRasterFrame(f, 1000, 160), f.tokens, f.refilledAt]);
  const g = { tokens: 0, refilledAt: 1000 };
  show('a clock that went back', [admitRasterFrame(g, 0, 0), g.tokens, g.refilledAt]);
  const h = { tokens: 0, refilledAt: 0 };
  show('a long wait caps at the capacity', [admitRasterFrame(h, 100000, 4096), h.tokens]);
  const i = { tokens: 10, refilledAt: 500 };
  show('half a second', [admitRasterFrame(i, 1000, 0), i.tokens]);
}

console.log('--- the cell writer ---');
{
  const table = new Uint32Array(CELL_WORDS.width * 2);
  encodeCell(table, 0, DEFAULT_CHANNEL);
  show('a default colour', [...table]);
  const two = new Uint32Array(CELL_WORDS.width);
  const foreground = 0x1234;
  const background = 0xabcd;
  encodeCell(two, 0, foreground | (background << 16));
  show('a packed pair', [...two]);
  show('halves of that pair', [foregroundHalf(foreground | (background << 16)), backgroundHalf(foreground | (background << 16))]);
  const third = new Uint32Array(CELL_WORDS.width * 3);
  encodeCell(third, 2, DEFAULT_CHANNEL);
  show('cell 2 of 3', [...third]);
}

console.log('--- the size check ---');
{
  const limits = { columns: 512, rows: 256 };
  for (const [w, h] of [[1, 1], [512, 256], [0, 1], [513, 1], [1, 0], [1, 257], [1.5, 1], [1, 1.5], [NaN, 1]]) {
    show(`validate ${w}x${h}`, validateRasterSize(w, h, limits));
  }
  show('default 512x256', validateDefaultRasterSize(512, 256));
  show('default 513x256', validateDefaultRasterSize(513, 256));
  show('default 512x257', validateDefaultRasterSize(512, 257));
  show('default with a string', validateDefaultRasterSize('4' as never, 1));
  show('columns bad and rows bad', validateRasterSize(0, 0, limits));
}
