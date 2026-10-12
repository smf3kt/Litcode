import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  MAX_LINK_HOPS,
  PathResolutionError,
  isNetworkFileSystemType,
  nonCanonicalText,
  resolveChain,
  verifyIdentity,
} from "../src/path-identity.js";

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-pathid-"));
  return fs.realpathSync(dir);
}

test("non-canonical text is refused only where the platform makes it ambiguous", () => {
  // A replacement character means the string already lost bytes on the way in,
  // so it is refused everywhere.
  assert.equal(nonCanonicalText("bad\uFFFDname.txt"), "a replacement character");
  assert.equal(nonCanonicalText("nul\0byte"), "a NUL byte");
  assert.equal(nonCanonicalText("src/tools.ts"), undefined);
  assert.equal(nonCanonicalText("trailing.dot."), undefined);
  if (process.platform === "win32") {
    assert.equal(nonCanonicalText("C:relative.txt"), "a drive-relative path");
    assert.equal(nonCanonicalText("\\rooted.txt"), "a root-relative path without a drive");
    assert.equal(nonCanonicalText("\\\\?\\C:\\ok.txt"), undefined);
    assert.equal(nonCanonicalText("trailing.space "), "a path segment ending in a dot or a space");
  }
});

test("a local filesystem type is not mistaken for a network one", () => {
  // The magic-number list can only be wrong by refusing local work, so the
  // check runs against the real filesystem under the test's own directory.
  const dir = tmpDir();
  const local = fs.statfsSync(dir).type;
  assert.equal(typeof local, "number");
  assert.equal(isNetworkFileSystemType(local), false, `local type ${local} is listed as network`);
  assert.equal(isNetworkFileSystemType(0x6969), true);
  assert.equal(isNetworkFileSystemType(0xff534d42), true);
});

test("a chain is followed hop by hop and each hop is recorded", () => {
  const root = tmpDir();
  fs.writeFileSync(path.join(root, "real.txt"), "content");
  fs.symlinkSync("real.txt", path.join(root, "one.txt"));
  fs.symlinkSync("one.txt", path.join(root, "two.txt"));

  const resolved = resolveChain(root, "two.txt");
  assert.equal(resolved.path, path.join(root, "real.txt"));
  assert.deepEqual(
    resolved.hops.map((hop) => [path.basename(hop.link), hop.target]),
    [
      ["two.txt", "one.txt"],
      ["one.txt", "real.txt"],
    ],
  );
  assert.equal(resolved.identity?.ino, String(fs.statSync(path.join(root, "real.txt"), { bigint: true }).ino));
});

test("a chain longer than the bound is refused by name rather than by the kernel", () => {
  const root = tmpDir();
  fs.writeFileSync(path.join(root, "end.txt"), "content");
  const hops = MAX_LINK_HOPS + 8;
  let previous = "end.txt";
  for (let index = 0; index < hops; index += 1) {
    const link = `link-${index}.txt`;
    fs.symlinkSync(previous, path.join(root, link));
    previous = link;
  }
  assert.throws(
    () => resolveChain(root, previous),
    (error: unknown) =>
      error instanceof PathResolutionError &&
      error.code === "ELOOP" &&
      /too long to vet/.test(error.message),
  );
});

test("a link that loops is refused instead of walked forever", () => {
  const root = tmpDir();
  fs.symlinkSync("b.txt", path.join(root, "a.txt"));
  fs.symlinkSync("a.txt", path.join(root, "b.txt"));
  assert.throws(
    () => resolveChain(root, "a.txt"),
    (error: unknown) => error instanceof PathResolutionError && error.code === "ELOOP",
  );
});

test("a missing path resolves to where it would be, with no identity and no hops", () => {
  const root = tmpDir();
  const resolved = resolveChain(root, "nested/missing.txt");
  assert.equal(resolved.path, path.join(root, "nested", "missing.txt"));
  assert.deepEqual(resolved.hops, []);
  assert.equal(resolved.identity, undefined);
});

test("a chain that lands on a network filesystem is refused", () => {
  const root = tmpDir();
  fs.writeFileSync(path.join(root, "real.txt"), "content");
  fs.symlinkSync("real.txt", path.join(root, "link.txt"));
  assert.throws(
    () => resolveChain(root, "link.txt", { fileSystemType: () => 0x6969 }),
    (error: unknown) => error instanceof PathResolutionError && error.code === "network-path",
  );
  // A landing that is not on a network filesystem still resolves.
  assert.equal(resolveChain(root, "link.txt", { fileSystemType: () => 0x1a }).path, path.join(root, "real.txt"));
});

test("identity verification notices a file that changed after it was resolved", () => {
  const root = tmpDir();
  const target = path.join(root, "file.txt");
  fs.writeFileSync(target, "one");
  const resolved = resolveChain(root, "file.txt");
  verifyIdentity(resolved);

  // A rewrite that changes the length is caught whatever the clock does. A
  // same-size rewrite inside one timestamp tick is not, which is what the
  // module comment states: APFS here advances ctime in whole seconds.
  fs.writeFileSync(target, "two, longer");
  assert.throws(
    () => verifyIdentity(resolved),
    (error: unknown) => error instanceof PathResolutionError && error.code === "changed",
  );

  // Substituting a different file at the same path replaces the inode as well.
  const before = resolveChain(root, "file.txt");
  fs.writeFileSync(path.join(root, "replacement.txt"), "two");
  fs.renameSync(path.join(root, "replacement.txt"), target);
  assert.throws(
    () => verifyIdentity(before),
    (error: unknown) => error instanceof PathResolutionError && error.code === "changed",
  );

  // A path that disappears entirely is refused the same way.
  fs.rmSync(target);
  assert.throws(
    () => verifyIdentity(before),
    (error: unknown) => error instanceof PathResolutionError && error.code === "changed",
  );
});
