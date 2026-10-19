// The structured-patch engine and the file-effect rows built on it.
//
// Expected hunks are the recovered engine's own contract (jsdiff `structuredPatch` semantics with
// context 3): a changed line sits between its context lines with `-`/`+` prefixes, tabs reach the
// patch in their expanded form, and content that carries `&` or `$` comes back verbatim.
import assert from "node:assert/strict";
import { test } from "node:test";

import { structuredPatch, applyEdit, editsPatch } from "../src/diff-patch.js";
import { writeEffectResult, editEffectResult, projectToolUseResult } from "../src/tool-use-result.js";

test("a one-line change in a three-line file becomes one context-3 hunk", () => {
  assert.deepEqual(structuredPatch("a.txt", "a\nb\nc\n", "a\nB\nc\n"), [
    { oldStart: 1, oldLines: 3, newStart: 1, newLines: 3, lines: [" a", "-b", "+B", " c"] },
  ]);
});

test("a file without a trailing newline keeps the no-newline marker", () => {
  const [hunk] = structuredPatch("a.txt", "a\nb", "a\nB");
  assert.deepEqual(hunk.lines, [" a", "-b", "\\ No newline at end of file", "+B", "\\ No newline at end of file"]);
});

test("leading tabs reach the patch expanded when the caller asks for tab conversion", () => {
  assert.deepEqual(structuredPatch("a.txt", "x\n", "\tx\n", { convertTabs: true })[0].lines, ["-x", "+  x"]);
  assert.deepEqual(structuredPatch("a.txt", "x\n", "\tx\n")[0].lines, ["-x", "+\tx"]);
});

test("dollar and ampersand content survives the sentinel round trip", () => {
  const patch = structuredPatch("a.txt", "a\nb\n", "a\n$& and & and \\$1\n");
  assert.deepEqual(patch[0].lines, [" a", "-b", "+$& and & and \\$1"]);
});

test("identical contents produce no hunks", () => {
  assert.deepEqual(structuredPatch("a.txt", "a\n", "a\n"), []);
});

test("an applied edit reports the file it produced alongside the patch", () => {
  const result = applyEdit("a.txt", "one\ntwo\nthree\n", "two", "2");
  assert.equal(result.updatedFile, "one\n2\nthree\n");
  assert.deepEqual(result.patch[0].lines, [" one", "-two", "+2", " three"]);
});

test("a patch can be taken for edits without applying them", () => {
  const patch = editsPatch("a.txt", "one\ntwo\n", [{ old_string: "two", new_string: "2" }]);
  assert.deepEqual(patch[0].lines, [" one", "-two", "+2"]);
  assert.deepEqual(editsPatch("a.txt", "one\ntwo\n", []), []);
});

test("a write over an empty or absent file is a create row carrying the whole content", () => {
  const created = writeEffectResult("a.txt", "", "hello\n");
  assert.deepEqual(created, { type: "create", filePath: "a.txt", content: "hello\n", structuredPatch: [], originalFile: null });
  assert.deepEqual(projectToolUseResult(created),
    { type: "create", filePath: "a.txt", content: "hello\n", structuredPatch: [] });
});

test("a write over existing content is an update row and stores only its patch", () => {
  const updated = writeEffectResult("a.txt", "a\nb\n", "a\nc\n");
  assert.equal(updated.type, "update");
  assert.equal(updated.originalFile, "a\nb\n");
  assert.deepEqual(updated.structuredPatch[0].lines, [" a", "-b", "+c"]);
  assert.deepEqual(projectToolUseResult(updated),
    { type: "update", filePath: "a.txt", structuredPatch: [{ oldStart: 1, oldLines: 2, newStart: 1, newLines: 2, lines: [" a", "-b", "+c"] }] });
});

test("an edit row reports the applied content, not the requested one", () => {
  const edited = editEffectResult("a.txt", "a\nb\n", "a\nB and more\n", "b", "B", false);
  // The file gained text the request did not name, so the patch follows the effect.
  assert.deepEqual(edited.structuredPatch[0].lines, [" a", "-b", "+B and more"]);
  assert.deepEqual(projectToolUseResult(edited),
    { filePath: "a.txt", oldString: "b", newString: "B", replaceAll: false,
      structuredPatch: [{ oldStart: 1, oldLines: 2, newStart: 1, newLines: 2, lines: [" a", "-b", "+B and more"] }] });
});
