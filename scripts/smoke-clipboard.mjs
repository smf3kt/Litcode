import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { tsImport } from "tsx/esm/api";

const { captureClipboardImage } = await tsImport("../src/clipboard.ts", import.meta.url);
const { readMedia } = await tsImport("../src/media.ts", import.meta.url);
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "clipboard-smoke-")));
const workspace = path.join(root, "workspace");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const commands = [];

try {
  fs.mkdirSync(workspace, { mode: 0o700 });
  const fixture = path.join(root, "clipboard-provider.mjs");
  fs.writeFileSync(fixture, `const png = Buffer.from(${JSON.stringify(png.toString("base64"))}, "base64");
const command = process.argv[2];
if (command === "/usr/bin/osascript") process.stdout.write("\\u00abdata PNGf" + png.toString("hex") + "\\u00bb\\n");
else if (command === "wl-paste" || command === "xclip") process.stdout.write(png);
else process.exit(3);
`, { mode: 0o700, flag: "wx" });
  const provider = (command, args, options) => {
    commands.push({ command, args });
    assert.equal(options.shell, false);
    return spawn(process.execPath, [fixture, command, ...args], options);
  };
  for (const [platform, env] of [["darwin", {}], ["linux", { WAYLAND_DISPLAY: "owned-fixture" }], ["linux", { DISPLAY: ":owned-fixture" }]]) {
    const signal = new AbortController().signal;
    const captured = await captureClipboardImage(workspace, signal, { platform, env, spawn: provider });
    const result = await readMedia(captured.path, { workspace, signal });
    assert.equal(result.blocks[0].type, "image");
    assert.equal(result.blocks[0].source.media_type, "image/png");
    assert.deepEqual(Buffer.from(result.blocks[0].source.data, "base64"), png);
    assert.equal(fs.statSync(path.join(workspace, captured.path)).mode & 0o777, 0o600);
  }
  assert.deepEqual(commands.map(item => item.command), ["/usr/bin/osascript", "wl-paste", "xclip"]);
  assert.deepEqual(commands[1].args, ["--type", "image/png"]);
  assert.deepEqual(commands[2].args, ["-selection", "clipboard", "-t", "image/png", "-o"]);
  assert.equal(fs.readdirSync(path.join(workspace, ".harness", "attachments")).length, 3);
  console.log(JSON.stringify({ clipboard: "passed", provider: "owned executable fixture", platforms: ["macOS", "Wayland", "X11"], pngBytes: png.length, privateAttachments: true, hostClipboardReads: 0, networkRequests: 0 }));
} finally { fs.rmSync(root, { recursive: true, force: true }); }
