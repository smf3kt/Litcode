import assert from 'node:assert/strict';
import { test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import {
  base36Magnitude,
  pinnedProjectDirectory,
  pinnedProjectDirectoryName,
  projectDirectory,
  projectDirectoryKey,
  projectDirectoryNameFromCwd,
  projectsDirectory,
  rollingHash32,
  toolResultsProjectDirectory,
  validatedProjectDirectoryName,
} from '../src/project-directory-source.js';

const CONFIG = 'CLAUDE_CONFIG_DIR';
const NAME = 'CLAUDE_CODE_PROJECT_DIR_NAME';

function withEnv(values: Record<string, string | undefined>, run: () => void): void {
  const saved = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    saved.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { run(); } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('source rolling hash and base36 magnitude match the copied bodies', () => {
  assert.equal(rollingHash32('abc'), 96354);
  assert.equal(base36Magnitude('abc'), '22ci');
  assert.equal(rollingHash32(''), 0);
  assert.equal(base36Magnitude(''), '0');
  assert.equal(rollingHash32('a'.repeat(201)), 1667662817);
  assert.equal(base36Magnitude('a'.repeat(201)), 'rkvsv5');
});

test('source project-name validation accepts only bounded non-reserved spellings', () => {
  assert.equal(validatedProjectDirectoryName('My_Proj-1'), 'My_Proj-1');
  assert.equal(validatedProjectDirectoryName('a'.repeat(64)), 'a'.repeat(64));
  for (const bad of ['', undefined, 'a'.repeat(65), 'bad name', ' myproj ', 'con', 'PRN', 'com9', 'lpt0', 'con.']) {
    assert.equal(validatedProjectDirectoryName(bad), undefined, String(bad));
  }
});

test('source pinned name requires a truthy configuration directory', () => {
  withEnv({ [CONFIG]: '/cfg', [NAME]: 'myproj' }, () => {
    assert.equal(pinnedProjectDirectoryName(), 'myproj');
  });
  withEnv({ [CONFIG]: '/cfg', [NAME]: 'bad name' }, () => {
    assert.equal(pinnedProjectDirectoryName(), undefined);
  });
  withEnv({ [CONFIG]: '', [NAME]: 'myproj' }, () => {
    assert.equal(pinnedProjectDirectoryName(), undefined);
  });
  withEnv({ [CONFIG]: undefined, [NAME]: 'myproj' }, () => {
    assert.equal(pinnedProjectDirectoryName(), undefined);
  });
  withEnv({ [CONFIG]: '/cfg', [NAME]: undefined }, () => {
    assert.equal(pinnedProjectDirectoryName(), undefined);
  });
});

test('source directory name sanitizes the cwd and hashes the original beyond 200 units', () => {
  assert.equal(projectDirectoryNameFromCwd('/Users/a b/c'), '-Users-a-b-c');
  assert.equal(projectDirectoryNameFromCwd('a'.repeat(200)), 'a'.repeat(200));
  assert.equal(
    projectDirectoryNameFromCwd('a'.repeat(200) + '/x'),
    'a'.repeat(200) + '-2m1609',
  );
  assert.equal(
    projectDirectoryNameFromCwd('a'.repeat(200) + '-x'),
    'a'.repeat(200) + '-2m15yj',
  );
  assert.notEqual(
    projectDirectoryNameFromCwd('a'.repeat(200) + '/x'),
    projectDirectoryNameFromCwd('a'.repeat(200) + '-x'),
  );
});

test('source project directory key prefers the pinned name over the cwd spelling', () => {
  withEnv({ [CONFIG]: '/cfg', [NAME]: 'myproj' }, () => {
    assert.equal(projectDirectoryKey('/cwd'), 'myproj');
  });
  withEnv({ [CONFIG]: '/cfg', [NAME]: 'bad name' }, () => {
    assert.equal(projectDirectoryKey('/cwd'), '-cwd');
  });
  withEnv({ [CONFIG]: undefined, [NAME]: 'myproj' }, () => {
    assert.equal(projectDirectoryKey('/cwd'), '-cwd');
  });
});

test('source projects root follows the configuration directory, including empty and relative values', () => {
  withEnv({ [CONFIG]: '/tmp/cfg' }, () => {
    assert.equal(projectsDirectory(), path.join('/tmp/cfg', 'projects'));
  });
  withEnv({ [CONFIG]: 'rel/cfg' }, () => {
    assert.equal(projectsDirectory(), path.join('rel/cfg', 'projects'));
  });
  withEnv({ [CONFIG]: '' }, () => {
    assert.equal(projectsDirectory(), 'projects');
  });
  withEnv({ [CONFIG]: undefined }, () => {
    assert.equal(projectsDirectory(), path.join(os.homedir(), '.claude', 'projects'));
  });
});

test('source project directory resolution joins the pinned or sanitized name', () => {
  withEnv({ [CONFIG]: '/cfg', [NAME]: 'myproj' }, () => {
    const expected = path.join('/cfg', 'projects', 'myproj');
    assert.equal(projectDirectory('/cwd'), expected);
    assert.equal(pinnedProjectDirectory(), expected);
    assert.equal(toolResultsProjectDirectory('/cwd'), expected);
  });
  withEnv({ [CONFIG]: '/cfg', [NAME]: 'bad name' }, () => {
    const expected = path.join('/cfg', 'projects', '-cwd');
    assert.equal(projectDirectory('/cwd'), expected);
    assert.equal(pinnedProjectDirectory(), null);
    assert.equal(toolResultsProjectDirectory('/cwd'), expected);
  });
  withEnv({ [CONFIG]: undefined, [NAME]: undefined }, () => {
    const expected = path.join(os.homedir(), '.claude', 'projects', '-cwd');
    assert.equal(projectDirectory('/cwd'), expected);
    assert.equal(pinnedProjectDirectory(), null);
    assert.equal(toolResultsProjectDirectory('/cwd'), expected);
  });
});
