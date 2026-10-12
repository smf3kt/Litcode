import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from "node:child_process";

import { MEDIA_MAX_BYTES, readMedia } from "./media.js";
import { ATTACHMENT_MAX_FILES, ATTACHMENT_STORE_MAX_BYTES, attachmentPath, checkAttachmentStore, openAttachmentStore, publishAttachment } from "./media-store.js";

export const CLIPBOARD_TIMEOUT_MS = 5000;
export const CLIPBOARD_MAX_FILES = ATTACHMENT_MAX_FILES;
export const CLIPBOARD_STORE_MAX_BYTES = ATTACHMENT_STORE_MAX_BYTES;
export type ClipboardSpawn = (command: string, args: string[], options: SpawnOptionsWithoutStdio) => ChildProcessWithoutNullStreams;
/** Trusted host/test dependencies, never model-supplied command input. */
export type ClipboardOptions = { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv; spawn?: ClipboardSpawn };

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw Object.assign(new Error("Clipboard capture aborted"), { name: "AbortError" });
}

function commandFor(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): { command: string; args: string[]; hex: boolean } {
  if (platform === "darwin") return {
    command: "/usr/bin/osascript", args: ["-e", "the clipboard as «class PNGf»"], hex: true,
  };
  if (platform === "linux") {
    if (env.WAYLAND_DISPLAY) return { command: "wl-paste", args: ["--type", "image/png"], hex: false };
    if (env.DISPLAY) return { command: "xclip", args: ["-selection", "clipboard", "-t", "image/png", "-o"], hex: false };
    throw new Error("Clipboard image capture requires WAYLAND_DISPLAY or DISPLAY on Linux");
  }
  if (platform === "win32") throw new Error("Clipboard image capture on Windows is unavailable; use /attach PATH PROMPT");
  throw new Error(`Clipboard image capture is unavailable on ${platform}`);
}

function collect(command: string, args: string[], hex: boolean, workspace: string, signal: AbortSignal, options: ClipboardOptions): Promise<Buffer> {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = (options.spawn ?? ((file, argv, settings) => spawn(file, argv, settings) as ChildProcessWithoutNullStreams))(
        command, args, { cwd: workspace, env: options.env ?? process.env, shell: false, stdio: ["pipe", "pipe", "pipe"] },
      );
    } catch (error) { reject(error); return; }
    const chunks: Buffer[] = [];
    let stdoutBytes = 0, stderrBytes = 0, settled = false;
    const maxOutput = hex ? 2 * MEDIA_MAX_BYTES + 64 : MEDIA_MAX_BYTES;
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
      cleanup(); reject(error);
    };
    const abort = () => fail(Object.assign(new Error("Clipboard capture aborted"), { name: "AbortError" }));
    const timer = setTimeout(() => fail(new Error(`Clipboard capture exceeded ${CLIPBOARD_TIMEOUT_MS} ms`)), CLIPBOARD_TIMEOUT_MS);
    signal.addEventListener("abort", abort, { once: true });
    child.on("error", error => fail(new Error(`Clipboard command ${command} failed: ${error.message}`)));
    child.stdout.on("error", fail); child.stderr.on("error", fail); child.stdin.on("error", fail);
    child.stdout.on("data", (chunk: Buffer) => {
      if (settled) return;
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxOutput) { fail(new Error("Clipboard stdout exceeds byte limit")); return; }
      chunks.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes > 4096) fail(new Error("Clipboard stderr exceeds 4096 byte limit"));
    });
    child.on("close", (code, exitSignal) => {
      if (settled) return;
      settled = true; cleanup();
      if (code !== 0) reject(new Error(`Clipboard command ${command} exited ${code ?? exitSignal}; clipboard must contain a PNG image`));
      else resolve(Buffer.concat(chunks, stdoutBytes));
    });
    child.stdin.end();
    if (signal.aborted) abort();
  });
}

function pngBytes(output: Buffer, hex: boolean): Buffer {
  let bytes = output;
  if (hex) {
    // AppleScript serializes PNGf data using guillemets; accept only its exact wrapper and hex pairs.
    const match = /^«data PNGf([0-9a-fA-F]+)»(?:\r?\n)?$/.exec(output.toString("utf8"));
    if (!match || match[1]!.length % 2) throw new Error("Clipboard PNGf output has invalid hex format");
    if (match[1]!.length > MEDIA_MAX_BYTES * 2) throw new Error("Clipboard PNG exceeds 10 MiB byte limit");
    bytes = Buffer.from(match[1]!, "hex");
  }
  if (bytes.length > MEDIA_MAX_BYTES) throw new Error("Clipboard PNG exceeds 10 MiB byte limit");
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error("Clipboard does not contain PNG image data");
  }
  return bytes;
}

/** Invoke only in response to an explicit paste-image command. Returns a workspace-relative PNG path. */
export async function captureClipboardImage(workspace: string, signal: AbortSignal, options: ClipboardOptions = {}): Promise<{ path: string }> {
  checkAbort(signal);
  const root = fs.realpathSync(workspace);
  const selected = commandFor(options.platform ?? process.platform, options.env ?? process.env);
  const bytes = pngBytes(await collect(selected.command, selected.args, selected.hex, root, signal, options), selected.hex);
  checkAbort(signal);
  const store = openAttachmentStore(root, "Clipboard attachment");
  checkAttachmentStore(store.directory, bytes.length, "Clipboard attachment");
  const name = `clipboard-${randomUUID()}.png`;
  let published: { path: string; dev: number; ino: number } | undefined;
  try {
    published = publishAttachment(store, name, bytes, "Clipboard attachment", () => checkAbort(signal));
    const relative = attachmentPath(name);
    await readMedia(relative, { workspace: root, signal });
    store.verify(); checkAbort(signal);
    const validated = fs.lstatSync(published.path);
    if (!validated.isFile() || validated.dev !== published.dev || validated.ino !== published.ino) throw new Error("Clipboard attachment changed during media validation");
    return { path: relative };
  } catch (error) {
    store.verify();
    if (published) fs.unlinkSync(published.path);
    throw error;
  }
}
