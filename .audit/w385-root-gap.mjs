import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultConfig } from '../dist/agent.js';
import { Session } from '../dist/session.js';

if (process.argv[2] === 'read') {
  const [workspace, ...ids] = process.argv.slice(3);
  const rows = ids.map(id => {
    const session = Session.open(workspace, { id });
    try { return { id: session.id, parent: session.config.parentSessionId ?? null,
      originalCwd: session.config.originalCwd ?? null }; }
    finally { session.close(); }
  });
  process.stdout.write(JSON.stringify(rows));
} else {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w385-root-gap-')));
  try {
    const create = parent => {
      const config = defaultConfig(workspace, []);
      config.model = 'fixture';
      if (parent) config.parentSessionId = parent;
      const session = Session.open(workspace, { config });
      const id = session.id; session.close(); return id;
    };
    const root = create(), child = create(root), grandchild = create(child), other = create();
    const rows = JSON.parse(execFileSync(process.execPath, [process.argv[1], 'read', workspace, root, child, grandchild, other], { encoding: 'utf8' }));
    assert.deepEqual(rows.map(row => row.parent), [null, root, child, null]);
    assert.equal(new Set(rows.map(row => row.id)).size, 4);
    assert.notEqual(rows[2].parent, root);
    assert.ok(rows.every(row => row.originalCwd === null));
    process.stdout.write('four distinct sessions; grandchild retains immediate parent; originalCwd absent after separate-process reopen\n');
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
}
