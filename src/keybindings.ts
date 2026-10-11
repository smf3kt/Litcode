import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import { decodeTerminalKeybindings, type Keybindings } from "./terminal.js";

export const KEYBINDINGS_MAX_BYTES = 2 * 1024 * 1024;
export type KeybindingsReport = {
  keybindings: Keybindings;
  /** Existing independent harness files in precedence order. */
  sources: string[];
  limitations: string[];
};

/** Keep the terminal decoder as the single authority for sequences and actions. */
export const keybindingsSchema = z.unknown().transform((value, context): Keybindings => {
  try { return decodeTerminalKeybindings(value); }
  catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof Error ? error.message : String(error) });
    return z.NEVER;
  }
});

export function decodeKeybindingsJson(text: string): Keybindings {
  if (Buffer.byteLength(text, "utf8") > KEYBINDINGS_MAX_BYTES) throw new Error("Keybindings JSON exceeds the 2 MiB limit");
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (error) { throw new Error("Keybindings JSON is malformed", { cause: error }); }
  return keybindingsSchema.parse(value);
}

function statOptional(file: string): fs.Stats | undefined {
  try { return fs.lstatSync(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

function directoryWithoutSymlinks(directory: string): boolean {
  const absolute = path.resolve(directory);
  let current = path.parse(absolute).root;
  for (const component of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    const stat = statOptional(current);
    if (!stat) return false;
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Keybindings directory must be a real directory: ${current}`);
  }
  return true;
}

function readOptional(directory: string): { file: string; bindings: Keybindings } | undefined {
  if (!directoryWithoutSymlinks(directory)) return undefined;
  const file = path.join(directory, "keybindings.json");
  const before = statOptional(file);
  if (!before) return undefined;
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) throw new Error(`Invalid keybindings file or symlink: ${file}`);
  if (before.size > KEYBINDINGS_MAX_BYTES) throw new Error(`Keybindings file exceeds the 2 MiB limit: ${file}`);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error(`Keybindings file identity changed: ${file}`);
    }
    if (opened.size > KEYBINDINGS_MAX_BYTES) throw new Error(`Keybindings file exceeds the 2 MiB limit: ${file}`);
    const bytes = Buffer.allocUnsafe(KEYBINDINGS_MAX_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const read = fs.readSync(fd, bytes, length, bytes.length - length, length);
      if (!read) break;
      length += read;
    }
    if (length > KEYBINDINGS_MAX_BYTES) throw new Error(`Keybindings file exceeds the 2 MiB limit: ${file}`);
    const after = fs.lstatSync(file);
    if (after.isSymbolicLink() || after.dev !== opened.dev || after.ino !== opened.ino ||
      after.size !== length || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs ||
      !directoryWithoutSymlinks(directory)) throw new Error(`Keybindings file changed while reading: ${file}`);
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)); }
    catch (error) { throw new Error(`Keybindings file must contain UTF-8 JSON: ${file}`, { cause: error }); }
    try { return { file, bindings: decodeKeybindingsJson(text) }; }
    catch (error) {
      const detail = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join("; ") : (error as Error).message;
      throw new Error(`Invalid keybindings configuration: ${file}: ${detail}`, { cause: error });
    }
  } finally { fs.closeSync(fd); }
}

/**
 * userDir is the independent harness user directory, default ~/.harness.
 * Project overrides live in <root>/.harness/keybindings.json. Missing files
 * mean no overrides; this function never creates files or executes actions.
 */
export function loadKeybindingsReport(root: string, userDir = path.join(os.homedir(), ".harness")): KeybindingsReport {
  const workspace = fs.realpathSync(path.resolve(root));
  if (!fs.statSync(workspace).isDirectory()) throw new Error("Keybindings workspace must be a directory");
  // Explicit roots are trusted anchors, like workspace. Canonicalizing the
  // existing user root admits OS aliases such as macOS /var -> /private/var;
  // configuration paths below that anchor retain all symlink checks.
  const declaredUser = path.resolve(userDir);
  let canonicalUser = declaredUser;
  try { canonicalUser = fs.realpathSync(declaredUser); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || statOptional(declaredUser)?.isSymbolicLink()) throw error;
  }
  const directories = [canonicalUser, path.join(workspace, ".harness")];
  const merged: Record<string, Keybindings[string]> = Object.create(null);
  const sources: string[] = [];
  for (const directory of new Set(directories)) {
    const source = readOptional(directory);
    if (!source) continue;
    for (const [sequence, action] of Object.entries(source.bindings)) merged[sequence] = action;
    sources.push(source.file);
  }
  return {
    keybindings: decodeTerminalKeybindings(merged), sources,
    limitations: ["Bindings use literal terminal input sequences and editor commands. Named keystrokes, vendor contexts and timed chord syntax are outside this decoder's contract."],
  };
}

export function loadKeybindings(root: string, userDir?: string): Keybindings {
  return loadKeybindingsReport(root, userDir).keybindings;
}
