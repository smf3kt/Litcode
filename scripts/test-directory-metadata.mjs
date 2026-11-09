import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'directory-metadata-'));
const production = path.join(root, 'native/directory-read/read'), instrumented = path.join(work, 'read-test');
const results = [];
try {
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_READ_TEST',
    '-o', instrumented, path.join(root, 'native/directory-read/read.c')]);
  for (const kind of ['zero', 'write-only', 'readable', 'symlink', 'hardlink', 'directory', 'fifo', 'missing', 'traversal',
    'late-target', 'late-parent', 'late-mode', 'late-content']) {
    const dir = path.join(work, kind), nested = path.join(dir, 'sub'), target = path.join(nested, 'target');
    fs.mkdirSync(nested, { recursive: true }); fs.writeFileSync(target, 'ORIGINAL');
    const held = fs.openSync(target, 'r+'), fd = fs.openSync(dir, 'r');
    fs.chmodSync(target, kind === 'readable' ? 0o640 : kind === 'write-only' ? 0o200 : 0);
    const before = fs.statSync(target, { bigint: true });
    const args = ['--sync-named-metadata', kind === 'traversal' ? 'sub/../sub/target' : 'sub/target'];
    try {
      if (['symlink', 'directory', 'fifo', 'missing'].includes(kind)) fs.unlinkSync(target);
      if (kind === 'symlink') fs.symlinkSync('absent', target);
      if (kind === 'hardlink') fs.linkSync(target, `${target}-alias`);
      if (kind === 'directory') fs.mkdirSync(target);
      if (kind === 'fifo') execFileSync('mkfifo', [target]);
      let code, status, output;
      if (kind.startsWith('late-')) {
        const child = spawn(instrumented, args, { stdio: ['ignore', 'pipe', 'ignore', fd, 'pipe', 'pipe'] });
        const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
        let changed = false, text = ''; const chunks = [];
        child.stdout.on('data', chunk => chunks.push(chunk));
        child.stdio[4].on('data', chunk => {
          text += chunk;
          if (!changed && text.includes('test metadata_before_final\n')) {
            changed = true;
            if (kind === 'late-target') { fs.renameSync(target, `${target}-held`); fs.writeFileSync(target, 'ORIGINAL', { mode: 0 }); }
            if (kind === 'late-parent') { fs.renameSync(nested, `${nested}-held`); fs.mkdirSync(nested); }
            if (kind === 'late-mode') fs.chmodSync(target, 0o200);
            if (kind === 'late-content') fs.writeSync(held, 'MODIFIED', 0, 'utf8');
            child.stdio[5].end('c');
          }
        });
        const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
        try { code = await done; } finally { clearTimeout(timer); }
        assert.ok(changed, kind); status = text; output = Buffer.concat(chunks);
      } else {
        const result = spawnSync(production, args, { stdio: ['ignore', 'pipe', 'pipe', fd, 'pipe'], timeout: 10000 });
        assert.equal(result.error, undefined); code = result.status; status = result.output[4].toString(); output = result.stdout;
      }
      assert.equal(output.length, 0, 'metadata must never return content');
      if (['zero', 'write-only', 'readable'].includes(kind)) {
        assert.equal(code, 0, kind);
        const lines = status.trim().split('\n'); assert.equal(lines.length, 2);
        assert.match(lines[0], /^v2 metadata_begin /);
        assert.equal(lines[0].replace('metadata_begin', 'metadata_stable'), lines[1]);
        assert.equal(lines[1].split(' ')[3], String(before.ino));
        const after = fs.statSync(target, { bigint: true });
        for (const key of ['dev', 'ino', 'mode', 'size', 'mtimeNs', 'ctimeNs']) assert.equal(after[key], before[key], key);
      } else { assert.notEqual(code, 0, kind); assert.ok(!status.includes('metadata_stable'), kind); }
      results.push(kind);
    } finally { fs.closeSync(fd); fs.closeSync(held); }
  }
  console.log(JSON.stringify({ metadata: 'passed', cases: results.length, results }));
} finally { fs.rmSync(work, { recursive: true, force: true }); }
