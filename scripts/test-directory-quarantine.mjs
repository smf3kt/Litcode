import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

if (process.platform !== 'darwin') {
  process.stdout.write(JSON.stringify({ platform: process.platform, skipped: 'Darwin exclusive rename fixture' }) + '\n');
  process.exit(0);
}
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();
const work = fs.mkdtempSync(path.join(base, 'w385-quarantine-fixture-'));
const binary = path.join(work, 'probe'), source = path.join(root, '.audit/w385-quarantine-probe.c');
const outcomes = [];
try {
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-o', binary, source], { timeout: 30000 });
  for (const scenario of ['matching', 'replacement', 'occupied', 'directory', 'symlink', 'killed', 'quarantine-replace', 'same-inode', 'change-during-compare', 'witness-during-compare',
    'delete-success', 'delete-occupied', 'delete-kill', 'delete-private-race']) {
    const dir = path.join(work, scenario); fs.mkdirSync(dir);
    const target = path.join(dir, 'target'), original = path.join(dir, 'original'), quarantine = path.join(dir, '.quarantine');
    fs.writeFileSync(target, 'ORIGINAL'); fs.utimesSync(target, 1700000000, 1700000000);
    const witness = path.join(dir, 'witness'); fs.writeFileSync(witness, 'ORIGINAL', { mode: 0o600 }); fs.utimesSync(witness, 1700000000, 1700000000);
    const stat = fs.statSync(target, { bigint: true }), fd = fs.openSync(dir, 'r'), witnessFd = fs.openSync(witness, 'r');
    const compareBarrier = scenario.endsWith('-during-compare');
    const deleteAction = scenario.startsWith('delete-');
    const child = spawn(binary, ['target', '.quarantine', String(stat.dev), String(stat.ino)], { stdio: ['ignore', 'ignore', 'pipe', fd, 'pipe', 'pipe', witnessFd],
      env: { ...process.env, ...(compareBarrier ? { QUARANTINE_COMPARE_BARRIER: '1' } : {}),
        ...(deleteAction ? { QUARANTINE_DELETE: '1' } : {}), ...(scenario === 'delete-private-race' ? { QUARANTINE_DELETE_BARRIER: '1' } : {}),
        ...(scenario === 'delete-kill' ? { QUARANTINE_KILL_BARRIER: '1' } : {}) } });
    let text = '', stderr = '', exited;
    const completion = new Promise(resolve => child.once('exit', (code, signal) => { exited = { code, signal }; resolve(exited); }));
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.stdio[4].on('data', chunk => { text += String(chunk); });
    child.stdio[5].on('error', () => {});
    const waitFor = async marker => {
      const limit = Date.now() + 5000;
      while (!text.includes(marker)) {
        assert.ok(Date.now() < limit && !exited, `${scenario} waiting for ${marker}: ${text} ${stderr}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    };
    try {
      await waitFor('checked\n');
      if (['replacement', 'occupied', 'directory', 'symlink'].includes(scenario)) {
        fs.renameSync(target, original);
        if (scenario === 'directory') { fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'child'), 'DIRECTORY'); }
        else if (scenario === 'symlink') fs.symlinkSync('original', target);
        else fs.writeFileSync(target, 'OTHER');
      }
      if (scenario === 'same-inode') { fs.writeFileSync(target, 'MUTATED!'); fs.utimesSync(target, 1700000000, 1700000000); }
      child.stdio[5].write('c');
      if (compareBarrier) {
        await waitFor('comparing\n');
        const changed = scenario === 'change-during-compare' ? path.join(quarantine, 'held') : witness;
        fs.writeFileSync(changed, 'MUTATED!'); fs.utimesSync(changed, 1700000000, 1700000000);
        child.stdio[5].write('c');
      }
      await waitFor('captured ');
      const match = /^captured (\d) (\d+) (\d+) (\d+) (\d+) (-?\d+) (\d+) (-?\d+) (\d+) (-?\d+)$/m.exec(text);
      assert.ok(match, `${scenario}: ${text}`);
      assert.equal(match[1], deleteAction || ['matching', 'killed', 'quarantine-replace', 'same-inode', 'change-during-compare', 'witness-during-compare'].includes(scenario) ? '1' : '0');
      const originalDigest = createHash('sha256').update('ORIGINAL').digest('hex');
      if (scenario === 'same-inode') assert.notEqual(createHash('sha256').update(fs.readFileSync(path.join(quarantine, 'held'))).digest('hex'), originalDigest);
      const byteMatch = Number(match[10]);
      assert.equal(byteMatch, scenario === 'same-inode' ? 0 : deleteAction || ['matching', 'killed', 'quarantine-replace'].includes(scenario) ? 1 : -1);
      const ctimeChanged = match[6] !== match[8] || match[7] !== match[9];
      if (scenario === 'occupied') fs.writeFileSync(target, 'THIRD', { flag: 'wx' });
      if (scenario === 'delete-occupied') fs.writeFileSync(target, 'THIRD', { flag: 'wx' });
      if (scenario === 'quarantine-replace') {
        fs.renameSync(path.join(quarantine, 'held'), path.join(quarantine, 'original'));
        fs.writeFileSync(path.join(quarantine, 'held'), 'OTHER');
      }
      if (scenario === 'killed') child.kill('SIGKILL');
      else if (deleteAction && scenario !== 'delete-occupied') {
        child.stdio[5].write('c'); await waitFor('delete_ready\n'); child.stdio[5].write('c');
        if (scenario === 'delete-private-race') {
          await waitFor('before_unlink\n');
          fs.renameSync(path.join(quarantine, 'held'), path.join(quarantine, 'original'));
          fs.writeFileSync(path.join(quarantine, 'held'), 'OTHER'); child.stdio[5].end('c');
        } else if (scenario === 'delete-kill') {
          await waitFor('removed\n'); child.kill('SIGKILL');
        } else child.stdio[5].end();
      } else child.stdio[5].end('c');
      const result = await completion;
      if (scenario === 'delete-kill') {
        assert.equal(result.signal, 'SIGKILL'); assert.equal(fs.existsSync(target), false);
        assert.equal(fs.existsSync(path.join(quarantine, 'held')), false); assert.equal(fs.readFileSync(witness, 'utf8'), 'ORIGINAL');
      } else if (scenario === 'delete-private-race') {
        assert.equal(result.code, 20); assert.equal(fs.existsSync(target), false);
        assert.equal(fs.existsSync(path.join(quarantine, 'held')), false);
        assert.equal(fs.readFileSync(path.join(quarantine, 'original'), 'utf8'), 'ORIGINAL');
      } else if (scenario === 'delete-success') {
        assert.equal(result.code, 0, text); assert.match(text, /removed\ndeleted\n/);
        assert.equal(fs.existsSync(target), false); assert.equal(fs.existsSync(quarantine), false);
      } else if (scenario === 'delete-occupied') {
        assert.equal(result.code, 0, text); assert.match(text, /retained \d+/);
        assert.equal(fs.readFileSync(target, 'utf8'), 'THIRD'); assert.equal(fs.readFileSync(path.join(quarantine, 'held'), 'utf8'), 'ORIGINAL');
      } else if (scenario === 'killed') {
        assert.equal(result.signal, 'SIGKILL'); assert.equal(fs.existsSync(target), false);
        assert.equal(fs.readFileSync(path.join(quarantine, 'held'), 'utf8'), 'ORIGINAL');
        assert.equal(fs.statSync(path.join(quarantine, 'held'), { bigint: true }).ino, stat.ino);
      } else {
        assert.equal(result.code, 0, `${scenario}: ${text} ${stderr}`);
        if (scenario === 'quarantine-replace') {
          assert.match(text, /changed\n/); assert.equal(fs.existsSync(target), false);
          assert.equal(fs.readFileSync(path.join(quarantine, 'held'), 'utf8'), 'OTHER');
          assert.equal(fs.readFileSync(path.join(quarantine, 'original'), 'utf8'), 'ORIGINAL');
        } else if (scenario === 'occupied') {
          assert.match(text, /retained \d+/); assert.equal(fs.readFileSync(target, 'utf8'), 'THIRD');
          assert.equal(fs.readFileSync(path.join(quarantine, 'held'), 'utf8'), 'OTHER');
        } else {
          assert.match(text, /restored\n/); assert.equal(fs.existsSync(quarantine), false);
          if (scenario === 'directory') assert.equal(fs.readFileSync(path.join(target, 'child'), 'utf8'), 'DIRECTORY');
          else if (scenario === 'symlink') assert.equal(fs.readlinkSync(target), 'original');
          else assert.equal(fs.readFileSync(target, 'utf8'), ['matching', 'witness-during-compare'].includes(scenario) ? 'ORIGINAL' : ['same-inode', 'change-during-compare'].includes(scenario) ? 'MUTATED!' : 'OTHER');
        }
        if (!['matching', 'quarantine-replace', 'same-inode', 'change-during-compare', 'witness-during-compare'].includes(scenario)) assert.equal(fs.readFileSync(original, 'utf8'), 'ORIGINAL');
      }
      outcomes.push({ scenario, match: match[1] === '1', byteMatch, ctimeChanged, result: scenario === 'killed' ? 'held-after-death' : scenario === 'occupied' || scenario === 'delete-occupied' ? 'held-on-conflict' : scenario === 'quarantine-replace' ? 'held-on-replacement' : scenario === 'same-inode' ? 'changed-bytes-same-metadata' : compareBarrier ? 'unstable-byte-comparison' : deleteAction ? scenario : 'restored' });
    } finally {
      if (!exited) { child.kill('SIGKILL'); await completion; }
      fs.closeSync(fd); fs.closeSync(witnessFd);
    }
  }
  process.stdout.write(JSON.stringify({ platform: process.platform, outcomes }) + '\n');
} finally { fs.rmSync(work, { recursive: true, force: true }); }
