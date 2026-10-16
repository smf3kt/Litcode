import { createRequire } from 'node:module';
const { Terminal } = createRequire(import.meta.url)('@xterm/headless');

/** Pinned xterm5.5 synchronous decoder for fixture assertions only. */
export class TerminalScreen {
  constructor(columns, rows) {
    this.terminal = new Terminal({ cols: columns, rows, allowProposedApi: true, logLevel: 'off' });
  }
  write(text) { this.terminal._core.writeSync(text); }
  resize(columns, rows) { this.terminal.resize(columns, rows); }
  lines() {
    const buffer = this.terminal.buffer.active;
    return Array.from({ length: this.terminal.rows }, (_, row) => buffer.getLine(buffer.viewportY + row)?.translateToString(true) ?? '');
  }
  cell(column, row) { const buffer = this.terminal.buffer.active; return buffer.getLine(buffer.viewportY + row)?.getCell(column); }
  get cursor() { const buffer = this.terminal.buffer.active; return { column: buffer.cursorX, row: buffer.cursorY }; }
  close() { this.terminal.dispose(); }
}
