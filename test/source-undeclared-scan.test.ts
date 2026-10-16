// scripts/source-undeclared-scan.mjs: a generated copy's gaps are what the next blocks have to fill,
// so the scan must not accept a name that only *some* other scope declares. W45-22 shipped
// src/plugin-chain-stream-source.ts with an undeclared `a8` while the scan said `unresolved 0`,
// because a `let a8` inside one copied function counted for the whole file. These fixtures pin the
// scope rules the scan now enforces: the same shape must be reported, and each legitimate binding
// (import, parameter, own local, hoisted var/function, block-local inside its block) must not be.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const project = path.resolve(import.meta.dirname, '..');
const scan = path.join(project, 'scripts/source-undeclared-scan.mjs');

/** Run the scan over one fixture and return its `unresolved` names in the order it printed them. */
function scanFixture(dir: string, name: string, source: string) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, source);
  const run = spawnSync(process.execPath, [scan, file], { encoding: 'utf8' });
  assert.equal(run.status, 0, `scan exited ${run.status}: ${run.stderr}`);
  const lines = run.stdout.split('\n');
  assert.match(lines[0], new RegExp(`^file .*${name.replace('.', '\\.')}$`), 'the first line names the file');
  assert.match(lines[1], /^declared \d+ {2}imports /u, 'the second line reports the declared count and imports');
  const count = Number(/^unresolved (\d+)$/u.exec(lines[2])?.[1]);
  assert.equal(Number.isInteger(count), true, `no unresolved line: ${run.stdout}`);
  const names = lines.slice(3).filter((l) => l.trim() !== '').map((l) => /^ {2}(\S+)/u.exec(l)?.[1]);
  assert.equal(names.length, count, 'the listed names match the count');
  return names;
}

test('undeclared scan: a declaration in one function does not cover another function', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-23-scan-'));
  try {
    // The W45-22 shape: `a8` is a local of `one`, and `two` reads a free `a8`.
    assert.deepEqual(
      scanFixture(dir, 'nested-local.mjs', 'function one(){let a8=1;return a8}\nfunction two(){return a8+1}\n'),
      ['a8'],
    );
    // A parameter is the same kind of binding: visible in its own function only.
    assert.deepEqual(
      scanFixture(dir, 'param-local.mjs', 'function one(a8){return a8}\nfunction two(){return a8}\n'),
      ['a8'],
    );
    // An import is a module binding, so every function in the file may read it.
    assert.deepEqual(
      scanFixture(dir, 'imported.mjs', "import { a8 } from './x.mjs';\nfunction two(){return a8}\n"),
      [],
    );
    // A block-local is visible inside its block and nowhere else.
    assert.deepEqual(
      scanFixture(dir, 'blocks.mjs', '{\n  let inside = 1;\n  console.log(inside);\n}\nfunction after(){return inside}\n'),
      ['inside'],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('undeclared scan: hoisting, shadowing and property positions stay clean', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-23-scan-'));
  try {
    // Function declarations and `var` hoist to the module scope, so a use above the declaration is
    // bound; a module binding is also visible from every function below it.
    assert.deepEqual(
      scanFixture(dir, 'hoisted.mjs', 'function later(){return helper()}\nfunction helper(){return v}\nvar v = 2;\n'),
      [],
    );
    // The same short name used locally in two functions is two bindings, not a gap.
    assert.deepEqual(
      scanFixture(dir, 'shadowed.mjs', 'function one(shared){return shared()}\nfunction two(){const shared = 1; return shared}\n'),
      [],
    );
    // Member properties, non-computed keys and labels are not references.
    assert.deepEqual(
      scanFixture(dir, 'positions.mjs', "const object = { key: 1, method(){ return object.key } };\nobject.missing;\nloop: for (;;) { break loop }\n"),
      [],
    );
    // A name only ever assigned as a property value is not a binding.
    assert.deepEqual(
      scanFixture(dir, 'property-value.mjs', 'const holder = {};\nholder.slot = 1;\nfunction read(){return holder.slot}\n'),
      [],
    );
    // A class declaration binds its name like any other declaration, and its body is its own scope.
    assert.deepEqual(
      scanFixture(dir, 'classes.mjs', 'class Box{constructor(v){this.v=v} read(){return this.v}}\nfunction make(){return new Box(1)}\n'),
      [],
    );
    // A class expression's name lives inside its own body only.
    assert.deepEqual(
      scanFixture(dir, 'class-expression.mjs', 'const made = class Inner{ self(){return Inner} };\nfunction outside(){return Inner}\n'),
      ['Inner'],
    );
    // The shape the scan was written for: a free name that only a branch this product never takes
    // would reach. It must be reported even though the branch is dead here.
    assert.deepEqual(
      scanFixture(dir, 'dead-branch.mjs', 'function text(t){if(typeof Buffer<"u")return Buffer.from(t).toString();return x(t)}\n'),
      ['x'],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
