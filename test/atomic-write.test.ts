import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { assertSameDirectory, atomicWriteFile, directoryIdentity } from "../src/atomic-write.js";

function sandbox(): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "harness-atomic-write-")));
}

const temporaries = (dir: string): string[] =>
  fs.readdirSync(dir).filter(name => name.endsWith(".tmp"));

test("a written file holds exactly the bytes that were handed to it", () => {
  const root = sandbox();
  const target = path.join(root, "note.txt");

  const result = atomicWriteFile(target, "hello\n");

  assert.equal(result.size, 6);
  assert.equal(result.keptTemporary, undefined);
  assert.equal(fs.readFileSync(target, "utf8"), "hello\n");
  assert.deepEqual(temporaries(root), [], "the temporary file is gone");
});

test("the verified size is bytes, not characters", () => {
  const root = sandbox();
  const target = path.join(root, "unicode.txt");
  const content = "héllo — 世界\n";

  const result = atomicWriteFile(target, content);

  assert.equal(result.size, Buffer.byteLength(content, "utf8"));
  assert.notEqual(result.size, content.length);
  assert.equal(fs.readFileSync(target, "utf8"), content);
});

test("a new file gets the requested mode and an overwrite keeps the caller's", () => {
  const root = sandbox();
  const target = path.join(root, "script.sh");

  atomicWriteFile(target, "#!/bin/sh\n", { mode: 0o755 });
  assert.equal(fs.statSync(target).mode & 0o777, 0o755);

  atomicWriteFile(target, "#!/bin/sh\necho hi\n", { mode: 0o600 });
  assert.equal(fs.statSync(target).mode & 0o777, 0o600);
});

test("an overwrite replaces the content wholesale", () => {
  const root = sandbox();
  const target = path.join(root, "long.txt");
  atomicWriteFile(target, "x".repeat(5000));

  const result = atomicWriteFile(target, "short");

  assert.equal(result.size, 5);
  assert.equal(fs.readFileSync(target, "utf8"), "short", "no tail of the longer file survives");
});

test("missing parent directories are created", () => {
  const root = sandbox();
  const target = path.join(root, "a", "b", "c.txt");

  atomicWriteFile(target, "deep\n");

  assert.equal(fs.readFileSync(target, "utf8"), "deep\n");
});

test("a directory that is no longer the one identified is refused", () => {
  const root = sandbox();
  const dir = path.join(root, "watched");
  fs.mkdirSync(dir);
  const before = directoryIdentity(dir);
  assert.deepEqual(assertSameDirectory(dir, before), undefined);

  // Replace the directory with a different one at the same path.
  fs.rmdirSync(dir);
  fs.mkdirSync(dir);
  assert.throws(() => assertSameDirectory(dir, before), /changed while the file was being written/);

  const gone = path.join(root, "never-existed");
  assert.throws(() => directoryIdentity(gone), /ENOENT/);
});

test("content that cannot be published is kept and named, not discarded", () => {
  const root = sandbox();
  // The target path is a non-empty directory, so the rename cannot land.
  const target = path.join(root, "occupied");
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, "child.txt"), "in the way\n");

  let kept: string | undefined;
  assert.throws(
    () => atomicWriteFile(target, "the new content\n"),
    error => {
      const message = (error as Error).message;
      const match = /The new content is kept at (.+)\.$/.exec(message);
      assert.ok(match, `the error names the kept file: ${message}`);
      kept = match[1];
      return true;
    },
  );

  assert.ok(kept);
  assert.equal(fs.readFileSync(kept, "utf8"), "the new content\n", "the bytes are still there");
  assert.equal(path.dirname(kept), root, "the kept file is the one written beside the target");
  fs.rmSync(kept, { force: true });
});

test("a write that never began leaves nothing behind", () => {
  const root = sandbox();
  // The parent path is a file, so the temporary file cannot be created.
  const blocker = path.join(root, "blocker");
  fs.writeFileSync(blocker, "not a directory\n");
  const target = path.join(blocker, "inside.txt");

  assert.throws(() => atomicWriteFile(target, "never written\n"), /ENOTDIR|EEXIST|ENOENT/);

  assert.equal(fs.readFileSync(blocker, "utf8"), "not a directory\n");
  assert.deepEqual(temporaries(root), []);
});

test("a labelled write whose temporary file cannot be created leaves nothing behind", () => {
  const root = sandbox();
  // A directory as the temporary file's parent path makes the open fail, which
  // is the only refusal the label reaches; the size and identity refusals are
  // worded for the file rather than for the tool.
  const blocker = path.join(root, "blocker");
  fs.writeFileSync(blocker, "not a directory\n");
  assert.throws(() => atomicWriteFile(path.join(blocker, "x"), "x\n", { label: "notebook_edit" }), /ENOTDIR|EEXIST/);
  assert.deepEqual(temporaries(root), []);
});
