import { Writable, PassThrough } from 'node:stream';
import { createRequire } from 'node:module';
const { Terminal } = createRequire(import.meta.url)('@xterm/headless');
import { TuiTerminal } from '../src/tui.js';

const output = new Writable({ write(chunk, _encoding, done) { done(); } });
Object.assign(output, { isTTY: true, columns: 80, rows: 20 });
const terminal = new Terminal({ allowProposedApi: true, logLevel: 'off' });
terminal.resize(80, 20);
const write = output.write.bind(output);
output.write = ((...args) => {
  terminal._core.writeSync(String(args[0]));
  return write(...args);
});
const lines = () => Array.from({ length: 20 }, (_, row) =>
  terminal.buffer.active.getLine(row)?.translateToString(true) ?? '');

const input = new PassThrough();
input.isTTY = true; input.setRawMode = () => {};
const tui = new TuiTerminal({ input, output }).start();
const pending = tui.prompt({ title: 'Model', message: 'Current: fixture/probe\nChoose a local model or enter another gateway model ID.',
  choices: [{ label: 'fixture/probe', value: 'fixture/probe' }], allowText: true }, new AbortController().signal);
await new Promise(resolve => setTimeout(resolve, 200));
for (const [index, line] of lines().entries()) console.log(String(index).padStart(2), JSON.stringify(line));
tui.close();
void pending;
