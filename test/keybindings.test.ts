import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { decodeKeybindingsJson, KEYBINDINGS_MAX_BYTES, keybindingsSchema, loadKeybindings, loadKeybindingsReport } from "../src/keybindings.js";
import { TerminalKeyDecoder } from "../src/terminal.js";

const roots: string[] = [];
function temp(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-keybindings-")));
  roots.push(dir); return dir;
}
function write(directory: string, value: unknown): string {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, "keybindings.json");
  fs.writeFileSync(file, JSON.stringify(value)); return file;
}
after(() => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); });

test("missing user/project files return no overrides and produce no filesystem effects", () => {
  const root = temp(); const userRoot = temp(); const user = path.join(userRoot, "missing");
  const report = loadKeybindingsReport(root, user);
  assert.deepEqual({ ...report.keybindings }, {});
  assert.deepEqual(report.sources, []);
  assert.ok(report.limitations.some((limitation) => limitation.includes("literal terminal input sequences")));
  assert.deepEqual(fs.readdirSync(root), []);
  assert.deepEqual(fs.readdirSync(userRoot), []);
});

test("user bindings are additive and project bindings override individual sequences including null", () => {
  const root = temp(); const user = temp();
  const first = write(user, { "\u0013": "submit", "\r": "newline", "\u0012": "search" });
  const second = write(path.join(root, ".harness"), { "\u0013": null, "\r": "submit", "\u0014": "newline" });
  const report = loadKeybindingsReport(root, user);
  assert.deepEqual({ ...report.keybindings }, { "\u0013": null, "\r": "submit", "\u0012": "search", "\u0014": "newline" });
  assert.deepEqual(report.sources, [first, second]);
  const decoder = new TerminalKeyDecoder(report.keybindings);
  assert.deepEqual(decoder.push("\u0013\r\u0014"), [{ type: "submit" }, { type: "newline" }]);
});

test("single user/project layers work and identical paths are read once", () => {
  const root = temp(); const user = temp();
  write(user, { "\u0014": "submit" });
  assert.equal(loadKeybindings(root, user)["\u0014"], "submit");
  fs.unlinkSync(path.join(user, "keybindings.json"));
  const directory = path.join(root, ".harness");
  const file = write(directory, { "\u0014": "newline" });
  assert.equal(loadKeybindings(root, user)["\u0014"], "newline");
  assert.deepEqual(loadKeybindingsReport(root, directory).sources, [file]);
});

test("JSON decode and schema follow the actual terminal action and sequence contract", () => {
  assert.deepEqual({ ...decodeKeybindingsJson('{"\\u0013":"submit","\\r":null}') }, { "\u0013": "submit", "\r": null });
  assert.equal(keybindingsSchema.parse({ "\u0014": "wordLeft" })["\u0014"], "wordLeft");
  for (const value of [null, [], 1, "string", { "": "submit" }, { ["x".repeat(65)]: "submit" }, { x: "chat:submit" }, { x: 1 }, { x: false }]) {
    assert.equal(keybindingsSchema.safeParse(value).success, false);
  }
  assert.throws(() => decodeKeybindingsJson("{ invalid"), /malformed/);
});

test("invalid user or project configuration fails explicitly rather than silently falling back", () => {
  const root = temp(); const user = temp();
  const file = write(user, { x: "unsupported" });
  assert.throws(() => loadKeybindings(root, user), /Invalid keybindings configuration.*Unknown terminal command/);
  assert.equal(fs.readFileSync(file, "utf8"), '{"x":"unsupported"}');
  write(user, { "\u0013": "submit" });
  const project = write(path.join(root, ".harness"), {});
  fs.writeFileSync(project, "{ malformed");
  assert.throws(() => loadKeybindings(root, user), /Invalid keybindings configuration.*malformed/);
});

test("schema preserves prototype-named input sequences as ordinary keys", () => {
  const bindings = decodeKeybindingsJson('{"__proto__":"submit","constructor":null,"prototype":"left"}');
  assert.equal(Object.getPrototypeOf(bindings), null);
  assert.equal(bindings["__proto__"], "submit");
  assert.equal(bindings["constructor"], null);
  assert.equal(bindings["prototype"], "left");
  const root = temp(); const user = temp();
  fs.writeFileSync(path.join(user, "keybindings.json"), '{"__proto__":"submit"}');
  assert.equal(loadKeybindings(root, user)["__proto__"], "submit");
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
});

test("exact byte limit succeeds and larger input/file JSON fails", () => {
  const minimum = '{"\\u0013":"submit"}';
  const atLimit = minimum + " ".repeat(KEYBINDINGS_MAX_BYTES - Buffer.byteLength(minimum));
  assert.equal(decodeKeybindingsJson(atLimit)["\u0013"], "submit");
  assert.throws(() => decodeKeybindingsJson(atLimit + " "), /2 MiB limit/);
  const root = temp(); const user = temp(); const file = path.join(user, "keybindings.json");
  fs.writeFileSync(file, atLimit);
  assert.equal(loadKeybindings(root, user)["\u0013"], "submit");
  fs.appendFileSync(file, " ");
  assert.throws(() => loadKeybindings(root, user), /2 MiB limit/);
});

test("invalid UTF-8, file directories and hardlinked configuration files are rejected", () => {
  const root = temp(); const user = temp(); const file = path.join(user, "keybindings.json");
  fs.writeFileSync(file, Buffer.from([0x7b, 0xff, 0x7d]));
  assert.throws(() => loadKeybindings(root, user), /UTF-8 JSON/);
  fs.unlinkSync(file); fs.mkdirSync(file);
  assert.throws(() => loadKeybindings(root, user), /Invalid keybindings file/);
  fs.rmdirSync(file);
  const outside = path.join(temp(), "source.json"); fs.writeFileSync(outside, "{}"); fs.linkSync(outside, file);
  assert.throws(() => loadKeybindings(root, user), /Invalid keybindings file/);
});

test("file, directory, ancestor and dangling symlinks are rejected without reading targets", () => {
  const root = temp(); const user = temp(); const outside = temp();
  const external = write(outside, { x: "submit" });
  const file = path.join(user, "keybindings.json");
  fs.symlinkSync(external, file);
  assert.throws(() => loadKeybindings(root, user), /symlink/);
  fs.unlinkSync(file); fs.symlinkSync(path.join(outside, "missing"), file);
  assert.throws(() => loadKeybindings(root, user), /symlink/);
  const projectRoot = temp(); fs.symlinkSync(outside, path.join(projectRoot, ".harness"));
  assert.throws(() => loadKeybindings(projectRoot, temp()), /real directory/);
  const parent = temp(); fs.symlinkSync(outside, path.join(parent, "alias"));
  assert.throws(() => loadKeybindings(root, path.join(parent, "alias", "nested")), /real directory/);
  assert.equal(fs.readFileSync(external, "utf8"), '{"x":"submit"}');
});

test("explicit user roots canonicalize aliases and lexical OS temp paths", () => {
  const root = temp(); const user = temp(); const aliases = temp();
  write(user, { "\u0014": "submit" });
  const alias = path.join(aliases, "user"); fs.symlinkSync(user, alias);
  assert.equal(loadKeybindings(root, alias)["\u0014"], "submit");
  assert.deepEqual(loadKeybindingsReport(root, alias).sources, [path.join(user, "keybindings.json")]);
  const lexical = fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-keybindings-lexical-"));
  roots.push(fs.realpathSync(lexical));
  write(lexical, { "\u0012": "search" });
  assert.equal(loadKeybindings(root, lexical)["\u0012"], "search");
  const absentLink = path.join(aliases, "dangling"); fs.symlinkSync(path.join(user, "missing"), absentLink);
  assert.throws(() => loadKeybindings(root, absentLink), /ENOENT/);
});

test("workspace aliases canonicalize but invalid workspace/config directories fail", () => {
  const root = temp(); const aliasRoot = temp(); const alias = path.join(aliasRoot, "workspace");
  fs.symlinkSync(root, alias);
  write(path.join(root, ".harness"), { "\u0014": "search" });
  assert.equal(loadKeybindings(alias, temp())["\u0014"], "search");
  const invalid = path.join(temp(), "file"); fs.writeFileSync(invalid, "fixture");
  assert.throws(() => loadKeybindings(invalid, temp()), /workspace must be a directory/);
  assert.throws(() => loadKeybindings(root, invalid), /real directory/);
});

test("bounded descriptor read detects a file that grows after initial fstat", () => {
  const root = temp(); const user = temp(); const file = write(user, {});
  const original = fs.fstatSync;
  let grew = false;
  fs.fstatSync = ((fd: number, options?: { bigint?: boolean }) => {
    const stat = original(fd, options as never);
    if (!grew) { grew = true; fs.appendFileSync(file, " ".repeat(KEYBINDINGS_MAX_BYTES + 1)); }
    return stat;
  }) as typeof fs.fstatSync;
  try { assert.throws(() => loadKeybindings(root, user), /2 MiB limit/); }
  finally { fs.fstatSync = original; }
  assert.equal(grew, true);
});
