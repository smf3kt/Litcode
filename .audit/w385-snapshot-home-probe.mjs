import { mkdtempSync, writeFileSync, readFileSync, statSync, accessSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = mkdtempSync(join(tmpdir(), 'w385-snapshot-'));
const hash = (data) => createHash('sha256').update(data).digest('hex');
const identity = (path) => ({ sha256: hash(readFileSync(path)), inode: statSync(path).ino });
const quote = (s) => `'${s.replaceAll("'", "'\\''")}'`;
const run = (args, env) => {
  const p = spawnSync('/bin/bash', args, { env, encoding: 'utf8', cwd: root });
  if (p.status !== 0) throw new Error(`shell exit ${p.status}: ${p.stderr}`);
  return p.stdout.trim();
};
try {
  for (const scenario of ['startup-after-create', 'snapshot-after-access']) {
    const dir = join(root, scenario);
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir);
    const startup = join(dir, 'startup');
    const snapshot = join(dir, 'snapshot');
    const oldHome = join(dir, 'home-old');
    const newHome = join(dir, 'home-new');
    const inheritedHome = join(dir, 'home-inherited');
    const body = (value) => `export HOME=${quote(value)}\nprobe_home() { export HOME=${quote(value)}; }\n`;
    writeFileSync(startup, body(oldHome));
    const env = { HOME: inheritedHome, PATH: '/usr/bin:/bin', SHELL: '/bin/bash', GIT_EDITOR: 'true', CLAUDECODE: '1' };
    const script = `SNAPSHOT_FILE=${quote(snapshot)}
source ${quote(startup)} < /dev/null
echo '# Snapshot file' >| "$SNAPSHOT_FILE"
echo 'unalias -a 2>/dev/null || true' >> "$SNAPSHOT_FILE"
shopt -p | head -n 1000 >> "$SNAPSHOT_FILE"
declare -F | cut -d' ' -f3 | grep -vE '^_[^_]' | while read -r func; do
  printf 'eval %q > /dev/null 2>&1\n' "$(declare -f "$func")" >> "$SNAPSHOT_FILE"
done
set -o | grep 'on' | awk '{print "set -o " $1}' | head -n 1000 >> "$SNAPSHOT_FILE"
echo 'shopt -s expand_aliases' >> "$SNAPSHOT_FILE"
alias | sed 's/^alias //g' | sed 's/^/alias -- /' | head -n 1000 >> "$SNAPSHOT_FILE"
printf 'export PATH=%s\n' "${quote(env.PATH)}" >> "$SNAPSHOT_FILE"
test -f "$SNAPSHOT_FILE"`;
    run(['-c', '-l', script], env);
    const initial = { startup: identity(startup), snapshot: identity(snapshot) };
    if (scenario === 'startup-after-create') {
      writeFileSync(`${startup}.new`, body(newHome));
      renameSync(`${startup}.new`, startup);
    }
    accessSync(snapshot);
    const checked = identity(snapshot);
    if (scenario === 'snapshot-after-access') {
      writeFileSync(`${snapshot}.new`, `export HOME=${quote(newHome)}\nprobe_home() { :; }\n`);
      renameSync(`${snapshot}.new`, snapshot);
    }
    const beforeLoad = { startup: identity(startup), snapshot: identity(snapshot) };
    const output = run(['-c', `source ${quote(snapshot)} 2>/dev/null || true; printf 'before=%s\n' "$HOME"; probe_home; printf 'after=%s\n' "$HOME"`], env)
      .replaceAll(root, '$ROOT');
    console.log(JSON.stringify({ scenario, initial, checked, beforeLoad, output }));
  }
} finally { rmSync(root, { recursive: true, force: true }); }
