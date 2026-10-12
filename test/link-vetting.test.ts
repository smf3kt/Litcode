import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadPathInstructions } from "../src/config.js";
import { LINK_VET_HOP_LIMIT, LinkVetError, linkBodyClimbsOut, vetLinkChain } from "../src/link-vetting.js";

function tmpDir(): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-linkvet-")));
}

test("a link body that enters a directory and climbs back out is caught", () => {
  // Leading `..` segments are simply a relative link; the rule is about a body
  // that goes into a directory and then comes back out of it.
  assert.equal(linkBodyClimbsOut("../sibling.md"), false);
  assert.equal(linkBodyClimbsOut(".."), false);
  assert.equal(linkBodyClimbsOut("./local.md"), false);
  assert.equal(linkBodyClimbsOut("docs/guide.md"), false);
  assert.equal(linkBodyClimbsOut("/absolute/path.md"), false);
  assert.equal(linkBodyClimbsOut("docs/../other.md"), true);
  assert.equal(linkBodyClimbsOut("docs/.."), true);
  assert.equal(linkBodyClimbsOut("a/b/../../c.md"), true);
  assert.equal(linkBodyClimbsOut("docs\\..\\other.md"), true);
});

test("a plain file, a simple link and a missing path all pass", () => {
  const root = tmpDir();
  fs.writeFileSync(path.join(root, "plain.md"), "# plain");
  fs.writeFileSync(path.join(root, "target.md"), "# target");
  fs.symlinkSync("target.md", path.join(root, "simple.md"));
  vetLinkChain(path.join(root, "plain.md"));
  vetLinkChain(path.join(root, "simple.md"));
  vetLinkChain(path.join(root, "absent.md"));
});

test("a chain past the bound, a loop and a climbing body are each refused by name", () => {
  const root = tmpDir();
  fs.writeFileSync(path.join(root, "end.md"), "# end");
  let previous = "end.md";
  for (let index = 0; index < LINK_VET_HOP_LIMIT + 5; index += 1) {
    const link = `hop-${index}.md`;
    fs.symlinkSync(previous, path.join(root, link));
    previous = link;
  }
  assert.throws(
    () => vetLinkChain(path.join(root, previous)),
    (error: unknown) => error instanceof LinkVetError && error.reason === "too-long",
  );

  fs.mkdirSync(path.join(root, "loop"));
  fs.symlinkSync("b.md", path.join(root, "loop", "a.md"));
  fs.symlinkSync("a.md", path.join(root, "loop", "b.md"));
  assert.throws(
    () => vetLinkChain(path.join(root, "loop", "a.md")),
    (error: unknown) => error instanceof LinkVetError && error.reason === "cycle",
  );

  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(path.join(root, "docs", "guide.md"), "# guide");
  fs.symlinkSync("docs/../docs/guide.md", path.join(root, "climb.md"));
  assert.throws(
    () => vetLinkChain(path.join(root, "climb.md")),
    (error: unknown) => error instanceof LinkVetError && error.reason === "climbs-out",
  );
});

test("a link body that is not valid UTF-8 is refused", () => {
  const root = tmpDir();
  const link = path.join(root, "bad.md");
  // The raw bytes are a path prefix followed by a lone continuation byte, so the
  // body cannot be decoded as a path at all.
  fs.symlinkSync(Buffer.from([0x2e, 0x2f, 0xff, 0xfe]), link);
  assert.throws(
    () => vetLinkChain(link),
    (error: unknown) => error instanceof LinkVetError && error.reason === "not-utf8",
  );
});

test("an instruction file reached through a refused link is not read as instructions", () => {
  const root = tmpDir();
  // A target inside the tree gives the loader an ancestor to walk, which is what
  // makes it read the project instruction file and follow its import.
  const target = path.join("sub", "file.txt");
  fs.mkdirSync(path.join(root, "sub"));
  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(path.join(root, "docs", "guide.md"), "# imported");
  // The loader walks the ancestors below the workspace root, so the instruction
  // file and its import live one level down.
  fs.writeFileSync(path.join(root, "sub", "HARNESS.md"), "# project\n@climb.md\n");

  // The body is written verbatim: path.join would normalize the `..` away and
  // the link would no longer climb.
  fs.symlinkSync("../docs/../docs/guide.md", path.join(root, "sub", "climb.md"));
  assert.throws(() => loadPathInstructions(root, target), /climbs out of a directory it entered/);

  // The same import through a link that does not climb is read normally, so the
  // refusal is the rule and not the presence of a link.
  fs.rmSync(path.join(root, "sub", "climb.md"));
  fs.symlinkSync(path.join("..", "docs", "guide.md"), path.join(root, "sub", "climb.md"));
  const files = loadPathInstructions(root, target);
  assert.deepEqual(
    files.map(file => path.basename(file.path)),
    ["HARNESS.md", "guide.md"],
  );
});
