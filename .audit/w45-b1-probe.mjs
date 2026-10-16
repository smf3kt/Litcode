// One question: does a fixture child that reads a line and appends to a file answer promptly while the
// host is loaded? The LSP regression waits on exactly that shape, so this separates "the child starved"
// from "the client never sent the frame" without touching the test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-child-'));
const log = path.join(dir, 'log.txt');
const script = `
const fs = require('node:fs');
require('node:readline').createInterface({ input: process.stdin }).on('line', () => {
  fs.appendFileSync(${JSON.stringify(log)}, 'x\\n');
});
`;
const child = spawn(process.execPath, ['-e', script], { stdio: ['pipe', 'inherit', 'inherit'] });
await new Promise((resolve) => setTimeout(resolve, 1000));
const started = Date.now();
child.stdin.write('ping\n');
let answerMs = null;
while (Date.now() - started < 20000) {
  if (fs.existsSync(log) && fs.readFileSync(log, 'utf8').includes('x')) { answerMs = Date.now() - started; break; }
  await new Promise((resolve) => setTimeout(resolve, 10));
}
console.log(JSON.stringify({ childAnswerMs: answerMs, hostLoad: os.loadavg()[0].toFixed(1) }));
child.kill();
fs.rmSync(dir, { recursive: true, force: true });
