import { PassThrough, Writable } from 'node:stream';
import { TuiTerminal } from '../src/tui.js';
const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
input.isTTY = true; input.setRawMode = () => {};
let drawn = '';
const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
Object.assign(output, { isTTY: true, columns: 100, rows: 40 });
const tui = new TuiTerminal({ input, output }).start() as unknown as {
  autocompleteBand?: { top: number; first: number; count: number };
  autocompleteIndex: number; state: { text: string }; close(): void };
try {
  input.emit('data', '/work');
  const band = tui.autocompleteBand;
  console.log('band:', JSON.stringify(band), 'index:', tui.autocompleteIndex, 'draft:', JSON.stringify(tui.state.text));
  if (!band) throw new Error('no band');
  const screenRow = band.top + 2;            // 0-based frame row of the third visible suggestion
  const oneBased = screenRow + 1;
  input.emit('data', `\x1b[<0;4;${oneBased}M\x1b[<0;4;${oneBased}m`);
  console.log('after click draft:', JSON.stringify(tui.state.text), 'index:', tui.autocompleteIndex);
} finally { tui.close(); }
