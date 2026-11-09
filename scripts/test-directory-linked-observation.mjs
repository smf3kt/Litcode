import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'directory-linked-observation-'));
const production = path.join(root, 'native/directory-read/read'), instrumented = path.join(work, 'read-test');
const results = [];
try {
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_READ_TEST',
    '-o', instrumented, path.join(root, 'native/directory-read/read.c')]);
  for (const kind of ['normal', 'empty', 'binary', 'same-name', 'traversal', 'missing', 'foreign', 'third-link',
    'symlink', 'target-symlink', 'late-alias', 'late-target', 'late-parent', 'late-content', 'late-third-link']) {
    const dir = path.join(work, kind), nested = path.join(dir, 'sub'); fs.mkdirSync(nested, { recursive: true });
    const target = path.join(nested, 'target'), alias = path.join(nested, '.litcode-tmp-123-0');
    const bytes = kind === 'empty' ? Buffer.alloc(0) : kind === 'binary' ? Buffer.from([0, 255, 128, 1]) : Buffer.from('ORIGINAL');
    fs.writeFileSync(alias, bytes, { mode: 0o640 }); fs.linkSync(alias, target);
    const before = fs.statSync(target, { bigint: true });
    const fd = fs.openSync(dir, 'r');
    const args = ['--sync-linked-pair', 'sub/target', path.basename(alias), '--observe'];
    try {
      const ordinary = spawnSync(production, ['--sync-backup', 'sub/target'], { stdio: ['ignore', 'pipe', 'pipe', fd, 'pipe'] });
      assert.notEqual(ordinary.status, 0, 'ordinary recovery must refuse hardlinks');
      if (kind === 'same-name') args[2] = 'target';
      if (kind === 'traversal') args[2] = '../sub/target';
      if (kind === 'missing') fs.unlinkSync(alias);
      if (kind === 'foreign') { fs.renameSync(alias, `${alias}-held`); fs.writeFileSync(alias, bytes); }
      if (kind === 'third-link') fs.linkSync(target, `${alias}-third`);
      if (kind === 'symlink') { fs.renameSync(alias, `${alias}-held`); fs.symlinkSync('target', alias); }
      if (kind === 'target-symlink') { fs.renameSync(target, `${target}-held`); fs.symlinkSync(path.basename(alias), target); }
      let code, status, output;
      if (kind.startsWith('late-')) {
        const child = spawn(instrumented, args, { stdio: ['ignore', 'pipe', 'pipe', fd, 'pipe', 'pipe'] });
        const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
        const chunks = []; let text = '';
        child.stdout.on('data', chunk => chunks.push(chunk)); child.stderr.resume();
        let changed = false;
        child.stdio[4].on('data', chunk => {
          text += chunk;
          if (!changed && text.includes('test linked_before_final\n')) {
            changed = true;
            if (kind === 'late-alias') { fs.renameSync(alias, `${alias}-held`); fs.writeFileSync(alias, bytes); }
            if (kind === 'late-target') { fs.renameSync(target, `${target}-held`); fs.writeFileSync(target, bytes); }
            if (kind === 'late-parent') { fs.renameSync(nested, `${nested}-held`); fs.mkdirSync(nested); }
            if (kind === 'late-content') fs.writeFileSync(alias, 'MODIFIED');
            if (kind === 'late-third-link') fs.linkSync(target, `${alias}-third`);
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
      if (['normal', 'empty', 'binary'].includes(kind)) {
        assert.equal(code, 0, kind); assert.deepEqual(output, bytes);
        const lines = status.trim().split('\n'); assert.equal(lines.length, 2);
        assert.match(lines[0], /^v2 linked_begin /); assert.match(lines[1], /^v2 linked_stable /);
        assert.equal(lines[0].replace('linked_begin', 'linked_stable'), lines[1]);
        const fields = lines[1].split(' '); assert.equal(fields.length, 13);
        const [, , dev, ino, size, , , , , mode, nlink, parentDev, parentIno] = fields;
        const parent = fs.statSync(nested, { bigint: true });
        assert.equal(dev, String(before.dev)); assert.equal(ino, String(before.ino)); assert.equal(nlink, '2');
        assert.equal(size, String(bytes.length)); assert.equal(mode, String(before.mode & 0o7777n));
        assert.equal(parentDev, String(parent.dev)); assert.equal(parentIno, String(parent.ino));
        assert.equal(fs.statSync(alias, { bigint: true }).ino, before.ino); assert.equal(fs.statSync(target).nlink, 2);
      } else {
        assert.notEqual(code, 0, kind); assert.doesNotMatch(status, /linked_stable/);
      }
      results.push(kind);
    } finally { fs.closeSync(fd); }
  }
  console.log(JSON.stringify({ platform: process.platform, linkedObservation: results }));
} finally { fs.rmSync(work, { recursive: true, force: true }); }
