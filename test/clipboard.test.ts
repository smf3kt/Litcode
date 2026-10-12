import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { test, type TestContext } from "node:test";

import { captureClipboardImage, CLIPBOARD_STORE_MAX_BYTES, type ClipboardSpawn } from "../src/clipboard.js";
import { IMAGE_TARGET_RAW_BYTES, MEDIA_MAX_BYTES, readMedia } from "../src/media.js";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
function fixture(t: TestContext) {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "clipboard-test-")));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  return { workspace, signal: new AbortController().signal };
}
const runner = (program: string): ClipboardSpawn => (_command, _args, options) => spawn(process.execPath, ["-e", program], options);
const output = (value: Buffer): ClipboardSpawn => runner(`process.stdout.write(Buffer.from(${JSON.stringify(value.toString("base64"))}, "base64"))`);
const linux = (provider: ClipboardSpawn) => ({ platform: "linux" as const, env: { DISPLAY: ":fixture" }, spawn: provider });
function files(workspace: string): string[] {
  const directory = path.join(workspace, ".harness", "attachments");
  return fs.existsSync(directory) ? fs.readdirSync(directory) : [];
}

test("explicit clipboard capture selects PNG commands and publishes private readable attachments", async (t) => {
  const f = fixture(t);
  for (const [platform, env, command, args, bytes] of [
    ["darwin", {}, "/usr/bin/osascript", ["-e", "the clipboard as «class PNGf»"], Buffer.from(`«data PNGf${PNG.toString("hex")}»\n`)],
    ["linux", { WAYLAND_DISPLAY: "fixture", DISPLAY: ":fixture" }, "wl-paste", ["--type", "image/png"], PNG],
    ["linux", { DISPLAY: ":fixture" }, "xclip", ["-selection", "clipboard", "-t", "image/png", "-o"], PNG],
  ] as const) {
    let calls = 0;
    const provider: ClipboardSpawn = (actual, argv, options) => {
      calls++; assert.equal(actual, command); assert.deepEqual(argv, args);
      assert.equal(options.shell, false); assert.equal(options.cwd, f.workspace);
      return output(bytes)(actual, argv, options);
    };
    const result = await captureClipboardImage(f.workspace, f.signal, { platform, env, spawn: provider });
    assert.equal(calls, 1); assert.match(result.path, /^\.harness[\\/]attachments[\\/]clipboard-[a-f0-9-]+\.png$/);
    const absolute = path.join(f.workspace, result.path);
    assert.deepEqual(fs.readFileSync(absolute), PNG);
    assert.equal(fs.statSync(absolute).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.dirname(absolute)).mode & 0o777, 0o700);
    const media = await readMedia(result.path, f);
    assert.equal(media.metadata.mediaType, "image/png"); assert.equal(media.metadata.width, 1);
  }
  assert.equal(files(f.workspace).length, 3);
  assert.equal(files(f.workspace).some(name => name.endsWith(".tmp")), false);
});

test("clipboard bounds, strict hex, cancellation, cleanup and directory confinement fail closed", async (t) => {
  const f = fixture(t);
  const forbidden: ClipboardSpawn = () => { throw new Error("unexpected clipboard process"); };
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(captureClipboardImage(f.workspace, aborted.signal, linux(forbidden)), { name: "AbortError" });
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, { platform: "linux", env: {}, spawn: forbidden }), /DISPLAY/);
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, { platform: "win32", spawn: forbidden }), /Windows.*attach/);
  for (const text of ["text", "«data PNGf0»", "«data PNGfzz»", `junk«data PNGf${PNG.toString("hex")}»`, `«data PNGf${PNG.toString("hex")}»\nextra`]) {
    await assert.rejects(captureClipboardImage(f.workspace, f.signal, { platform: "darwin", spawn: output(Buffer.from(text)) }), /hex format/);
  }
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, linux(output(Buffer.from("clipboard text")))), /PNG image/);
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, linux(output(PNG.subarray(0, 8)))), /invalid.*image/i);
  assert.deepEqual(files(f.workspace), []);
  const pngAtSize = (size: number) => `const bytes = Buffer.alloc(${size}); Buffer.from(${JSON.stringify(PNG.toString("base64"))}, "base64").copy(bytes); process.stdout.write(bytes)`;
  const boundary = await captureClipboardImage(f.workspace, f.signal, linux(runner(pngAtSize(IMAGE_TARGET_RAW_BYTES))));
  assert.equal(fs.statSync(path.join(f.workspace, boundary.path)).size, IMAGE_TARGET_RAW_BYTES);
  fs.unlinkSync(path.join(f.workspace, boundary.path));
  // The 10 MiB clipboard byte cap is reachable, but media validation refuses what the API cannot take.
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, linux(runner(pngAtSize(MEDIA_MAX_BYTES)))), /base64 API limit/);
  assert.deepEqual(files(f.workspace), []);
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, { platform: "darwin", spawn: runner(`process.stdout.write("\\u00abdata PNGf" + "00".repeat(${MEDIA_MAX_BYTES + 1}) + "\\u00bb")`) }), /PNG exceeds 10 MiB/);
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, linux(runner(`process.stdout.write(Buffer.alloc(${MEDIA_MAX_BYTES + 1}))`))), /stdout.*limit/);
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, { platform: "darwin", spawn: runner(`process.stdout.write(Buffer.alloc(${2 * MEDIA_MAX_BYTES + 65}))`) }), /stdout.*limit/);
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, linux(runner("process.stderr.write(Buffer.alloc(4097))"))), /stderr.*4096/);
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, linux(runner("process.exit(2)"))), /exited 2/);
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, linux((_command, _args, options) => spawn("/clipboard-fixture-missing", [], options))), /command.*failed/);
  const cancel = new AbortController(); let child: ReturnType<ClipboardSpawn> | undefined;
  const pending = captureClipboardImage(f.workspace, cancel.signal, linux((command, args, options) => {
    child = runner("setInterval(() => {}, 1000)")(command, args, options);
    return child;
  }));
  const closed = new Promise(resolve => child!.once("close", resolve));
  cancel.abort(); await assert.rejects(pending, { name: "AbortError" }); await closed;
  assert.equal(child!.signalCode, "SIGKILL");
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, linux(runner("setInterval(() => {}, 1000)"))), /5000 ms/);
  const directory = path.join(f.workspace, ".harness", "attachments");
  for (let index = 0; index < 128; index++) fs.writeFileSync(path.join(directory, `${index}.png`), "");
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, linux(output(PNG))), /128 file/);
  fs.rmSync(directory, { recursive: true }); fs.mkdirSync(directory);
  const large = path.join(directory, "large.png"); fs.writeFileSync(large, ""); fs.truncateSync(large, CLIPBOARD_STORE_MAX_BYTES);
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, linux(output(PNG))), /64 MiB/);
  fs.rmSync(directory, { recursive: true });
  const external = fixture(t);
  fs.symlinkSync(external.workspace, directory);
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, linux(output(PNG))), /regular directory/);
  assert.deepEqual(fs.readdirSync(external.workspace), []);
  fs.rmSync(path.join(f.workspace, ".harness"), { recursive: true });
  fs.symlinkSync(external.workspace, path.join(f.workspace, ".harness"));
  await assert.rejects(captureClipboardImage(f.workspace, f.signal, linux(output(PNG))), /regular directory/);
  assert.deepEqual(fs.readdirSync(external.workspace), []);
});
