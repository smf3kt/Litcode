import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import type { Terminal } from '@xterm/headless';
import { TuiTerminal } from '../src/tui.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
Object.assign(output, { isTTY: true, columns: 60, rows: 10 });
const term = new HeadlessTerminal({ allowProposedApi: true, logLevel: 'off' });
term.resize(60, 10);
const write = output.write.bind(output);
output.write = ((...args: Parameters<Writable['write']>) => {
  (term as unknown as { _core: { writeSync(text: string): void } })._core.writeSync(String(args[0]));
  return write(...args);
}) as Writable['write'];
const lines = () => Array.from({ length: term.rows }, (_, row) => term.buffer.active.getLine(row)?.translateToString(true) ?? '');
const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode(raw: boolean): void };
input.isTTY = true; input.setRawMode = () => {};
const tui = new TuiTerminal({ input, output }).start();
const key = (text: string) => input.emit('data', text);
try {
  key('plain ultracode');
  console.log('before', JSON.stringify(lines()));
  key('\x1bw');
  console.log('after', JSON.stringify(lines()));
  console.log('status', JSON.stringify((tui as unknown as { status: string }).status));
} finally { tui.close(); }
