import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(script), '..');
const compiled = process.argv.includes('--compiled');
const childMode = process.argv.indexOf('--child');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const modulePath = name => path.join(root, compiled ? 'dist' : 'src', `${name}.${compiled ? 'js' : 'ts'}`);
const nodeArgs = compiled ? [] : ['--import', 'tsx'];

if (childMode >= 0) {
  const [mode, workspace, cut] = process.argv.slice(childMode + 1);
  const { defaultConfig } = await import(pathToFileURL(modulePath('agent')));
  const { Session } = await import(pathToFileURL(modulePath('session')));
  const { checkpointConversation, previewRewind, applyRewind } = await import(pathToFileURL(modulePath('rewind')));
  const { recoverCheckpoint } = await import(pathToFileURL(modulePath('checkpoints')));
  const signal = new AbortController().signal;
  const ctx = { workspace, signal, allowShell: false, maxOutputBytes: 24000 };
  const fixture = path.join(workspace, '.agent/fixture.json');
  if (mode === 'prepare') {
    fs.writeFileSync(path.join(workspace, 'a'), 'base A');
    fs.mkdirSync(path.join(workspace, 'nested'));
    fs.writeFileSync(path.join(workspace, 'nested/b'), 'base B');
    fs.chmodSync(path.join(workspace, 'a'), 0o751);
    const config = defaultConfig(workspace, []); config.model = 'fixture';
    const session = Session.open(workspace, { config });
    checkpointConversation(session, 'base', signal);
    fs.writeFileSync(path.join(workspace, 'a'), 'edited A');
    fs.chmodSync(path.join(workspace, 'a'), 0o600);
    fs.writeFileSync(path.join(workspace, 'new'), 'new bytes');
    if (cut.startsWith('mkdir')) fs.rmSync(path.join(workspace, 'nested'), { recursive: true });
    else fs.writeFileSync(path.join(workspace, 'nested/b'), 'edited B');
    const preview = previewRewind(session, 0, signal);
    fs.writeFileSync(fixture, JSON.stringify({ id: session.id, preview }));
    session.close();
  } else if (mode === 'crash') {
    const { id, preview } = JSON.parse(fs.readFileSync(fixture, 'utf8'));
    const session = Session.open(workspace, { id });
    const kill = () => { process.kill(process.pid, 'SIGKILL'); throw new Error('SIGKILL returned'); };
    const rename = fs.renameSync, unlink = fs.unlinkSync, mkdir = fs.mkdirSync;
    const write = fs.writeSync, sync = fs.fsyncSync;
    let branchFd;
    fs.renameSync = (from, to) => {
      if (cut === 'before-effect' && String(to) === path.join(workspace, 'a')) kill();
      const result = rename(from, to);
      if (cut === 'after-rename' && String(to) === path.join(workspace, 'a')) kill();
      if (cut === 'after-marker' && String(to) === path.join(workspace, '.agent/checkpoints/transaction.json') && JSON.parse(fs.readFileSync(to, 'utf8')).state === 'committed') kill();
      if (cut === 'mkdir-owned' && String(to) === path.join(workspace, '.agent/checkpoints/transaction.json') && JSON.parse(fs.readFileSync(to, 'utf8')).directories.some(item => item.inode !== null)) kill();
      return result;
    };
    fs.unlinkSync = target => {
      const result = unlink(target);
      if (cut === 'after-remove' && String(target) === path.join(workspace, 'new')) kill();
      return result;
    };
    fs.mkdirSync = (target, options) => {
      const result = mkdir(target, options);
      if (cut === 'mkdir-unowned' && String(target) === path.join(workspace, 'nested')) kill();
      return result;
    };
    fs.writeSync = (fd, bytes, ...args) => {
      const result = write(fd, bytes, ...args);
      if (Buffer.isBuffer(bytes) && bytes.toString().startsWith('{"kind":"branch"')) branchFd = fd;
      return result;
    };
    fs.fsyncSync = fd => {
      const result = sync(fd);
      if (cut === 'after-branch-commit' && fd === branchFd) kill();
      return result;
    };
    applyRewind(session, preview, preview.token, signal);
    throw new Error(`Cutpoint was missed: ${cut}`);
  } else if (mode === 'recover') {
    try { console.log(JSON.stringify(recoverCheckpoint(ctx))); }
    catch (error) { console.error(String(error)); process.exitCode = 2; }
  } else if (mode === 'resume') {
    const tx = JSON.parse(fs.readFileSync(path.join(workspace, '.agent/recovered-branch.json'), 'utf8'));
    const session = Session.open(workspace, { id: tx.id, recoverLock: true });
    assert.ok(session.events.some(event => event.kind === 'branch' && event.reason === 'rewind'));
    assert.equal(previewRewind(session, 0, signal).operations.length, 0);
    session.append({ kind: 'message', message: { role: 'user', content: 'continue after recovery' } });
    session.append({ kind: 'message', message: { role: 'assistant', content: 'fixture complete' } });
    session.append({ kind: 'turn_end', reason: 'end_turn' });
    session.close();
    console.log(JSON.stringify({ resumed: true, nextTurn: true }));
  } else throw new Error(`Unknown fixture mode: ${mode}`);
} else {
  const job = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'checkpoint-crash-')));
  const observations = [];
  const child = (mode, workspace, cut = '') => spawnSync(process.execPath,
    [...nodeArgs, script, ...(compiled ? ['--compiled'] : []), '--child', mode, workspace, cut],
    { cwd: root, encoding: 'utf8', timeout: 20000, maxBuffer: 256000 });
  const checked = result => { assert.ifError(result.error); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout || '{}'); };
  const cliRecover = async (workspace, expected) => {
    const cli = spawn(process.execPath, [...nodeArgs, compiled ? path.join(root, 'bin/personal-harness.mjs') : path.join(root, 'src/cli.ts'),
      '--workspace', workspace, '--user-dir', path.join(job, 'user'), '--interactive'],
    { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture',
      LLM_BASE_URL: 'http://127.0.0.1:1', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' } });
    let stdout = '', stderr = '', requested = false, ended = false;
    const timer = setTimeout(() => cli.kill('SIGKILL'), 20000);
    cli.stderr.on('data', bytes => {
      stderr += bytes;
      if (!requested && stderr.includes('Personal harness.')) { requested = true; cli.stdin.write('/checkpoint-recover\n'); }
    });
    cli.stdout.on('data', bytes => {
      stdout += bytes;
      if (!ended && stdout.includes(`"recovery": "${expected}"`)) { ended = true; cli.stdin.end('/exit\n'); }
    });
    try {
      const exit = await new Promise((resolve, reject) => { cli.on('error', reject); cli.on('close', (code, signal) => resolve({ code, signal })); });
      assert.equal(exit.code, 0, JSON.stringify({ ...exit, stdout, stderr }));
      assert.ok(ended, stdout + stderr);
      return { command: '/checkpoint-recover', recovery: expected, exit: 0 };
    } finally { clearTimeout(timer); if (cli.exitCode === null) cli.kill('SIGKILL'); }
  };
  try {
    fs.mkdirSync(path.join(job, 'user'));
    for (const cut of ['before-effect', 'after-rename', 'after-remove', 'mkdir-owned', 'mkdir-unowned', 'after-branch-commit', 'after-marker', 'conflict']) {
      const workspace = path.join(job, cut); fs.mkdirSync(workspace);
      checked(child('prepare', workspace, cut));
      const killed = child('crash', workspace, cut === 'conflict' ? 'after-rename' : cut);
      assert.ifError(killed.error); assert.equal(killed.signal, 'SIGKILL', killed.stderr);
      const pending = path.join(workspace, '.agent/checkpoints/transaction.json');
      const transaction = JSON.parse(fs.readFileSync(pending, 'utf8'));
      assert.equal(transaction.state, cut === 'after-marker' ? 'committed' : 'pending');
      const branchFile = path.join(workspace, '.agent', `${transaction.branch.id}.jsonl`);
      const residual = cut === 'conflict' || cut === 'mkdir-unowned';
      if (cut === 'conflict') fs.writeFileSync(path.join(workspace, 'a'), 'outside edit');
      const txHash = hash(fs.readFileSync(pending)), branchHash = hash(fs.readFileSync(branchFile));
      const recovered = child('recover', workspace);
      if (residual) {
        assert.equal(recovered.status, 2, recovered.stderr);
        assert.match(recovered.stderr, cut === 'conflict' ? /recovery conflict/ : /ownership is unknown/);
        assert.equal(hash(fs.readFileSync(pending)), txHash);
        assert.equal(hash(fs.readFileSync(branchFile)), branchHash);
        assert.equal(fs.readFileSync(path.join(workspace, 'a'), 'utf8'), cut === 'conflict' ? 'outside edit' : 'base A');
        checkedRecoveryResidual(workspace, cut);
        observations.push({ cut, signal: killed.signal, recovery: 'retained', journalUnchanged: true, branchUnchanged: true });
      } else {
        const committed = cut === 'after-branch-commit' || cut === 'after-marker';
        const expected = committed ? 'committed' : 'rolled_back';
        assert.deepEqual(checked(recovered), { recovery: expected });
        assert.equal(fs.readFileSync(path.join(workspace, 'a'), 'utf8'), committed ? 'base A' : 'edited A');
        assert.equal(fs.statSync(path.join(workspace, 'a')).mode & 0o7777, committed ? 0o751 : 0o600);
        assert.equal(fs.existsSync(path.join(workspace, 'new')), !committed);
        assert.equal(fs.existsSync(path.join(workspace, 'nested')), cut !== 'mkdir-owned');
        if (cut !== 'mkdir-owned') assert.equal(fs.readFileSync(path.join(workspace, 'nested/b'), 'utf8'), committed ? 'base B' : 'edited B');
        assert.equal(fs.existsSync(pending), false);
        assert.equal(fs.existsSync(branchFile), committed);
        assert.equal(fs.existsSync(`${branchFile}.lock`), false);
        assert.deepEqual(checked(child('recover', workspace)), { recovery: 'none' });
        if (committed) {
          assert.equal(hash(fs.readFileSync(branchFile)), branchHash);
          fs.writeFileSync(path.join(workspace, '.agent/recovered-branch.json'), JSON.stringify(transaction.branch));
          assert.deepEqual(checked(child('resume', workspace)), { resumed: true, nextTurn: true });
        }
        observations.push({ cut, signal: killed.signal, recovery: expected, bytesModesRemoval: true, branchPreserved: committed, idempotent: true });
      }
      // Interrupted staging has no durable pathname/inode ownership record.
      // Report retained scratch files explicitly rather than claiming total cleanup.
      observations.at(-1).stagingResidue = [workspace, path.join(workspace, '.agent/checkpoints')].flatMap(directory =>
        fs.readdirSync(directory).filter(name => /^\.checkpoint-.*\.tmp$/.test(name)).map(name => path.relative(workspace, path.join(directory, name))));
      assert.equal(fs.existsSync(path.join(workspace, '.agent/checkpoints/lock')), false);
      assert.equal(fs.existsSync(path.join(workspace, '.agent/checkpoints/lock.recovery')), false);
    }
    // Exercise the actual command on a second interrupted workspace.
    const cliWorkspace = path.join(job, 'cli'); fs.mkdirSync(cliWorkspace);
    checked(child('prepare', cliWorkspace, 'after-rename'));
    assert.equal(child('crash', cliWorkspace, 'after-rename').signal, 'SIGKILL');
    observations.push(await cliRecover(cliWorkspace, 'rolled_back'));
    assert.equal(fs.readFileSync(path.join(cliWorkspace, 'a'), 'utf8'), 'edited A');
    const frozen = ['src/checkpoints.ts', 'src/rewind.ts', 'src/interactive.ts', 'test/checkpoints.test.ts', 'test/rewind.test.ts', 'scripts/smoke-checkpoint-crash.mjs',
      ...(compiled ? ['dist/checkpoints.js', 'dist/rewind.js', 'dist/interactive.js'] : [])].map(file => ({ path: file, sha256: hash(fs.readFileSync(path.join(root, file))) }));
    console.log(JSON.stringify({ result: 'passed', compiled, observations, frozen, job, fixturesRemoved: true }));
  } finally { fs.rmSync(job, { recursive: true, force: true }); }
}

function checkedRecoveryResidual(workspace, cut) {
  assert.equal(fs.existsSync(path.join(workspace, 'new')), true);
  if (cut === 'mkdir-unowned') {
    assert.deepEqual(fs.readdirSync(path.join(workspace, 'nested')), []);
    assert.equal(fs.existsSync(path.join(workspace, 'nested/b')), false);
  } else assert.equal(fs.readFileSync(path.join(workspace, 'nested/b'), 'utf8'), 'edited B');
}
