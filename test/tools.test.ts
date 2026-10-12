import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { createTools, type ToolContext, type ToolDefinition } from "../src/tools.js";

const tools = createTools();
const byName = new Map(tools.map((tool) => [tool.schema.name, tool]));

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const tempDirs: string[] = [];
function tmpDir(prefix = "ccrev-"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function tool(name: string): ToolDefinition {
  const found = byName.get(name);
  assert.ok(found, `tool ${name} is missing`);
  return found;
}
function run(name: string, input: unknown, context: ToolContext): Promise<string> {
  return tool(name).execute(input, context);
}
function makeContext(workspace: string, overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    workspace,
    signal: new AbortController().signal,
    allowShell: false,
    maxOutputBytes: 100_000,
    ...overrides,
  };
}
function write(ws: string, rel: string, content: string): void {
  const target = path.join(ws, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function read(ws: string, rel: string): string {
  return fs.readFileSync(path.join(ws, rel), "utf8");
}

test("createTools exposes the expected tool set with correct read-only flags", () => {
  assert.deepEqual(
    [...byName.keys()].sort(),
    ["edit_file", "list_files", "read_file", "run_command", "search", "write_file"],
  );
  assert.equal(tool("read_file").readOnly, true);
  assert.equal(tool("list_files").readOnly, true);
  assert.equal(tool("search").readOnly, true);
  assert.equal(tool("write_file").readOnly, false);
  assert.equal(tool("edit_file").readOnly, false);
  assert.equal(tool("run_command").readOnly, false);

  const schema = tool("read_file").schema;
  assert.equal(schema.input_schema.type, "object");
  assert.equal(schema.name, "read_file");
});

test("read_file returns the requested 1-based line range", async () => {
  const ws = tmpDir();
  write(ws, "a.txt", "l1\nl2\nl3\nl4\n");

  assert.equal(await run("read_file", { path: "a.txt" }, makeContext(ws)), "l1\nl2\nl3\nl4\n");
  assert.equal(await run("read_file", { path: "a.txt", offset: 2, limit: 2 }, makeContext(ws)), "l2\nl3");
  assert.equal(await run("read_file", { path: "a.txt", offset: 10 }, makeContext(ws)), "");
});

test("read_file truncates output at maxOutputBytes and notes it", async () => {
  const ws = tmpDir();
  write(ws, "big.txt", Array.from({ length: 200 }, (_, i) => `line-${i}`).join("\n"));

  const out = await run("read_file", { path: "big.txt" }, makeContext(ws, { maxOutputBytes: 32 }));
  assert.match(out, /read_file: output truncated/);
  assert.ok(Buffer.byteLength(out, "utf8") < 200, "output should be small");
});

test("file tools reject a symlink escape (final and ancestor)", async () => {
  const ws = tmpDir();
  const outside = tmpDir();
  write(outside, "secret.txt", "TOP SECRET");

  // Direct file symlink pointing outside the workspace.
  fs.symlinkSync(path.join(outside, "secret.txt"), path.join(ws, "link.txt"));
  await assert.rejects(run("read_file", { path: "link.txt" }, makeContext(ws)), /escapes/);

  // Directory symlink used as an ancestor component.
  fs.symlinkSync(outside, path.join(ws, "outdir"));
  await assert.rejects(run("read_file", { path: "outdir/secret.txt" }, makeContext(ws)), /escapes/);
  await assert.rejects(run("search", { pattern: "SECRET", path: "outdir" }, makeContext(ws)), /escapes/);
  await assert.rejects(run("list_files", { path: "outdir" }, makeContext(ws)), /escapes/);

  // A write through a symlinked directory must not create anything outside.
  await assert.rejects(
    run("write_file", { path: "outdir/planted.txt", content: "x" }, makeContext(ws)),
    /escapes/,
  );
  assert.equal(fs.existsSync(path.join(outside, "planted.txt")), false);
});

test("file tools reject paths that escape lexically", async () => {
  const ws = tmpDir();
  await assert.rejects(run("read_file", { path: "../outside.txt" }, makeContext(ws)), /escapes/);
  await assert.rejects(run("read_file", { path: path.join(ws, "abs.txt") }, makeContext(ws)), /escapes/);
});

test("file tools refuse the reserved .agent directory", async () => {
  const ws = tmpDir();
  write(ws, ".agent/x.txt", "hidden");
  await assert.rejects(run("read_file", { path: ".agent/x.txt" }, makeContext(ws)), /\.agent/);
  await assert.rejects(run("write_file", { path: ".agent/y.txt", content: "z" }, makeContext(ws)), /\.agent/);
});

test("an in-workspace symlink that stays inside is followed", async () => {
  const ws = tmpDir();
  write(ws, "real.txt", "content");
  fs.symlinkSync(path.join(ws, "real.txt"), path.join(ws, "alias.txt"));
  assert.equal(await run("read_file", { path: "alias.txt" }, makeContext(ws)), "content");
});

test("write_file is atomic, refuses overwrite by default, and preserves mode", async () => {
  const ws = tmpDir();

  await run("write_file", { path: "nested/dir/w.txt", content: "one" }, makeContext(ws));
  assert.equal(read(ws, "nested/dir/w.txt"), "one");

  await assert.rejects(
    run("write_file", { path: "nested/dir/w.txt", content: "two" }, makeContext(ws)),
    /already exists/,
  );
  assert.equal(read(ws, "nested/dir/w.txt"), "one");

  fs.chmodSync(path.join(ws, "nested/dir/w.txt"), 0o600);
  await run("write_file", { path: "nested/dir/w.txt", content: "two", overwrite: true }, makeContext(ws));
  assert.equal(read(ws, "nested/dir/w.txt"), "two");
  assert.equal(fs.statSync(path.join(ws, "nested/dir/w.txt")).mode & 0o777, 0o600);

  // No temporary files left behind by the atomic write.
  const leftovers = fs.readdirSync(path.join(ws, "nested/dir")).filter((name) => name.includes(".tmp"));
  assert.deepEqual(leftovers, []);
});

test("the write tools land the verified byte count on disk", async () => {
  const ws = tmpDir();
  const multibyte = "héllo — 世界\n";

  await run("write_file", { path: "u.txt", content: multibyte }, makeContext(ws));
  assert.equal(read(ws, "u.txt"), multibyte);
  assert.equal(fs.statSync(path.join(ws, "u.txt")).size, Buffer.byteLength(multibyte, "utf8"));

  // An edit that shortens a file leaves no tail of the longer content behind.
  fs.writeFileSync(path.join(ws, "shrink.txt"), "x".repeat(4000));
  await run("edit_file", { path: "shrink.txt", old_string: "x".repeat(4000), new_string: "two\n" },
    makeContext(ws));
  assert.equal(read(ws, "shrink.txt"), "two\n");
  assert.equal(fs.statSync(path.join(ws, "shrink.txt")).size, 4);

  // The tool refuses a non-regular target before any write is attempted, so the
  // kept-content refusal belongs to the writer and is covered there.
  fs.mkdirSync(path.join(ws, "occupied"));
  await assert.rejects(
    run("write_file", { path: "occupied", content: "x", overwrite: true }, makeContext(ws)),
    /not a regular file/,
  );

  const leftovers = fs.readdirSync(ws).filter((name) => name.includes(".tmp"));
  assert.deepEqual(leftovers, []);
});

test("edit_file requires a unique match and supports replace_all", async () => {
  const ws = tmpDir();
  write(ws, "e.txt", "alpha\nbeta\nalpha\n");

  await assert.rejects(
    run("edit_file", { path: "e.txt", old_string: "alpha", new_string: "X" }, makeContext(ws)),
    /not unique/,
  );
  await assert.rejects(
    run("edit_file", { path: "e.txt", old_string: "zzz", new_string: "q" }, makeContext(ws)),
    /not found/,
  );

  await run("edit_file", { path: "e.txt", old_string: "beta", new_string: "B" }, makeContext(ws));
  assert.equal(read(ws, "e.txt"), "alpha\nB\nalpha\n");

  await run("edit_file", { path: "e.txt", old_string: "alpha", new_string: "A", replace_all: true }, makeContext(ws));
  assert.equal(read(ws, "e.txt"), "A\nB\nA\n");
});

test("list_files lists workspace-relative paths, honors glob and limit", async () => {
  const ws = tmpDir();
  write(ws, "root.ts", "");
  write(ws, "src/a.ts", "");
  write(ws, "src/b.ts", "");
  write(ws, "src/c.txt", "");

  const all = await run("list_files", {}, makeContext(ws));
  assert.match(all, /^root\.ts$/m);
  assert.match(all, /^src\/a\.ts$/m);

  const tsOnly = await run("list_files", { glob: "*.ts" }, makeContext(ws));
  assert.match(tsOnly, /src\/a\.ts/);
  assert.doesNotMatch(tsOnly, /c\.txt/);

  const limited = await run("list_files", { limit: 2 }, makeContext(ws));
  assert.match(limited, /truncated at limit 2/);
});

test("search finds literal matches, supports regex and limit", async () => {
  const ws = tmpDir();
  write(ws, "s.txt", "hello world\nfoo bar\nHELLO again\n");

  const literal = await run("search", { pattern: "hello" }, makeContext(ws));
  assert.match(literal, /s\.txt:1:hello world/);
  assert.doesNotMatch(literal, /HELLO again/);

  const regex = await run("search", { pattern: "(?i)hello", regex: true }, makeContext(ws));
  assert.match(regex, /s\.txt:1:hello world/);
  assert.match(regex, /s\.txt:3:HELLO again/);

  assert.equal(await run("search", { pattern: "zzzznomatch" }, makeContext(ws)), "");

  write(ws, "many.txt", Array.from({ length: 10 }, (_, i) => `hit ${i}`).join("\n"));
  const limited = await run("search", { pattern: "hit", limit: 3 }, makeContext(ws));
  assert.match(limited, /truncated at limit 3/);
});

test("input is validated strictly by zod", async () => {
  const ws = tmpDir();
  write(ws, "a.txt", "x");
  await assert.rejects(run("read_file", { path: "a.txt", bogus: true }, makeContext(ws)));
  await assert.rejects(run("read_file", { path: "a.txt", limit: 99999 }, makeContext(ws)));
});

test("run_command refuses to run when allowShell is false", async () => {
  const ws = tmpDir();
  await assert.rejects(
    run("run_command", { command: "echo hi" }, makeContext(ws)),
    /shell access is disabled/,
  );
});

test("run_command combines stdout/stderr and reports the exit code", async () => {
  const ws = tmpDir();
  const out = await run(
    "run_command",
    { command: "echo out-line; echo err-line 1>&2; exit 3" },
    makeContext(ws, { allowShell: true }),
  );
  assert.match(out, /out-line/);
  assert.match(out, /err-line/);
  assert.match(out, /exit code 3/);
});

test("run_command caps output keeping the tail and still drains the process", async () => {
  const ws = tmpDir();
  const out = await run(
    "run_command",
    { command: "for i in $(seq 1 2000); do echo line$i; done" },
    makeContext(ws, { allowShell: true, maxOutputBytes: 200 }),
  );
  assert.match(out, /output truncated/);
  assert.match(out, /line2000/);
  assert.match(out, /exit code 0/);
  assert.ok(!out.includes("line1\n"), "head of the output should be dropped");
});

test("run_command times out and cleans up the whole process group", async () => {
  const ws = tmpDir();
  const ticks = path.join(ws, "ticks.txt");
  const started = Date.now();
  const out = await run(
    "run_command",
    { command: "for i in $(seq 1 400); do echo tick >> ticks.txt; sleep 0.05; done", timeout_ms: 400 },
    makeContext(ws, { allowShell: true }),
  );
  const elapsed = Date.now() - started;

  assert.match(out, /timed out/);
  assert.ok(elapsed < 5000, `command should be killed promptly, took ${elapsed}ms`);

  // If the process group were still alive, the background loop would keep writing.
  const sizeAfterKill = fs.statSync(ticks).size;
  await delay(400);
  assert.equal(fs.statSync(ticks).size, sizeAfterKill, "process group should be dead after timeout");
});

test("run_command abort signal kills the process group", async () => {
  const ws = tmpDir();
  const ticks = path.join(ws, "ticks.txt");
  const controller = new AbortController();
  const pending = run(
    "run_command",
    { command: "for i in $(seq 1 400); do echo tick >> ticks.txt; sleep 0.05; done" },
    makeContext(ws, { allowShell: true, signal: controller.signal }),
  );
  setTimeout(() => controller.abort(), 300);
  const out = await pending;

  assert.match(out, /aborted/);
  const sizeAfterKill = fs.statSync(ticks).size;
  await delay(300);
  assert.equal(fs.statSync(ticks).size, sizeAfterKill, "process group should be dead after abort");
});

test("search treats a leading-dash literal pattern as data, not an option", async () => {
  const ws = tmpDir();
  write(ws, "dash.txt", "-leading dash\nplain line\n");

  const out = await run("search", { pattern: "-leading" }, makeContext(ws));
  assert.match(out, /dash\.txt:1:-leading dash/);
});

test("search and list include hidden files but never the reserved .agent directory", async () => {
  const ws = tmpDir();
  write(ws, "visible.txt", "hello secret world\n");
  write(ws, ".env", "HELLO_SECRET_ENV=1\n");
  write(ws, ".agent/other.txt", "hello secret world\n");

  const found = await run("search", { pattern: "hello secret" }, makeContext(ws));
  assert.match(found, /visible\.txt:1:hello secret world/);
  assert.doesNotMatch(found, /\.agent/);

  const listed = await run("list_files", {}, makeContext(ws));
  assert.match(listed, /^\.env$/m);
  assert.match(listed, /^visible\.txt$/m);
  assert.doesNotMatch(listed, /\.agent/);
});

test("a caller glob cannot re-include .agent, and the exclusion glob itself excludes it", async () => {
  const ws = tmpDir();
  write(ws, "keep.txt", "");
  write(ws, ".agent/hidden.txt", "");

  const broad = await run("list_files", { glob: "**" }, makeContext(ws));
  assert.match(broad, /^keep\.txt$/m);
  assert.doesNotMatch(broad, /\.agent/);

  const agentGlob = await run("list_files", { glob: "**/.agent/**" }, makeContext(ws));
  assert.equal(agentGlob, "");
});

test("a symlink aliasing .agent is rejected when directly selected", async () => {
  const ws = tmpDir();
  write(ws, ".agent/hidden.txt", "inner");
  fs.symlinkSync(path.join(ws, ".agent"), path.join(ws, "agentlink"));
  fs.symlinkSync(path.join(ws, ".agent", "hidden.txt"), path.join(ws, "filelink.txt"));

  await assert.rejects(run("list_files", { path: "agentlink" }, makeContext(ws)), /\.agent/);
  await assert.rejects(
    run("search", { pattern: "inner", path: "agentlink" }, makeContext(ws)),
    /\.agent/,
  );
  await assert.rejects(run("read_file", { path: "filelink.txt" }, makeContext(ws)), /\.agent/);
});

test("an absolute path inside the workspace is rejected", async () => {
  const ws = tmpDir();
  write(ws, "abs-target.txt", "x");
  await assert.rejects(
    run("read_file", { path: path.join(ws, "abs-target.txt") }, makeContext(ws)),
    /escapes/,
  );
});

test("a pre-aborted signal prevents all side effects before spawn or write", async () => {
  const ws = tmpDir();
  const controller = new AbortController();
  controller.abort();
  const ctx = makeContext(ws, { signal: controller.signal, allowShell: true });

  await assert.rejects(run("write_file", { path: "p.txt", content: "y" }, ctx), /aborted/);
  assert.equal(fs.existsSync(path.join(ws, "p.txt")), false);

  write(ws, "e.txt", "orig");
  await assert.rejects(run("edit_file", { path: "e.txt", old_string: "orig", new_string: "z" }, ctx), /aborted/);
  assert.equal(read(ws, "e.txt"), "orig");

  const ticks = path.join(ws, "ticks.txt");
  await assert.rejects(
    run("run_command", { command: `echo tick >> "${ticks}"` }, ctx),
    /aborted/,
  );
  assert.equal(fs.existsSync(ticks), false);

  await assert.rejects(run("read_file", { path: "e.txt" }, ctx), /aborted/);
});

test("edit_file inserts new_string literally (no dollar-pattern expansion)", async () => {
  const ws = tmpDir();
  write(ws, "r.txt", "value=PLACEHOLDER;\n");
  const replacement = "$&$`$'";

  await run("edit_file", { path: "r.txt", old_string: "PLACEHOLDER", new_string: replacement }, makeContext(ws));
  assert.equal(read(ws, "r.txt"), `value=${replacement};\n`);

  write(ws, "r2.txt", "a\na\n");
  await run(
    "edit_file",
    { path: "r2.txt", old_string: "a", new_string: "$1", replace_all: true },
    makeContext(ws),
  );
  assert.equal(read(ws, "r2.txt"), "$1\n$1\n");
});

test("read_file truncation never emits a U+FFFD replacement char", async () => {
  const ws = tmpDir();
  write(ws, "u.txt", "aaaa😀bbbb");

  const out = await run("read_file", { path: "u.txt" }, makeContext(ws, { maxOutputBytes: 6 }));
  assert.ok(!out.includes("�"), "truncated output must stay valid UTF-8");
  assert.match(out, /read_file: output truncated/);
});

test("run_command returns promptly when a detached descendant holds the pipes", async () => {
  const ws = tmpDir();
  const started = Date.now();
  const out = await run(
    "run_command",
    { command: "sleep 30 & echo bg-started", timeout_ms: 5000 },
    makeContext(ws, { allowShell: true }),
  );
  const elapsed = Date.now() - started;

  assert.match(out, /bg-started/);
  assert.ok(elapsed < 3000, `must not wait for the detached sleep, took ${elapsed}ms`);
});

test("run_command kills a detached descendant that redirects output when the shell exits", async () => {
  const ws = tmpDir();
  const ticks = path.join(ws, "ticks.txt");
  const out = await run(
    "run_command",
    {
      command: `( for i in $(seq 1 400); do echo tick >> "${ticks}"; sleep 0.05; done ) >/dev/null 2>&1 & echo spawned`,
      timeout_ms: 5000,
    },
    makeContext(ws, { allowShell: true }),
  );

  assert.match(out, /spawned/);
  await delay(200);
  const sizeAfterExit = fs.existsSync(ticks) ? fs.statSync(ticks).size : 0;
  await delay(400);
  const sizeLater = fs.existsSync(ticks) ? fs.statSync(ticks).size : 0;
  assert.equal(sizeLater, sizeAfterExit, "detached descendant should be killed when the shell exits");
});

// ---------------------------------------------------------------------------
// Bounded subprocess regression guards (ripgrep path)
// ---------------------------------------------------------------------------

test("search reports an in-flight abort as aborted, not a partial result", async () => {
  const ws = tmpDir();
  // A FIFO makes ripgrep block on open, giving a deterministic window in which
  // the abort fires while the child is genuinely still running.
  execFileSync("mkfifo", [path.join(ws, "pipe.txt")]);
  const controller = new AbortController();
  const pending = run(
    "search",
    { pattern: "x", path: "pipe.txt" },
    makeContext(ws, { signal: controller.signal }),
  );
  setTimeout(() => controller.abort(), 100);

  // Before the fix the bounded runner resolved with an empty (partial) result
  // and aborted:false, so the abort vanished instead of surfacing.
  await assert.rejects(pending, /aborted/);
});

test("search bounds surfaced ripgrep stderr by maxOutputBytes (byte cap, not chunk count)", async (t) => {
  const ws = tmpDir();
  const denied = path.join(ws, "denied");
  fs.mkdirSync(denied);
  fs.writeFileSync(path.join(denied, "a.txt"), "x");
  fs.chmodSync(denied, 0o000);

  let unreadable = false;
  try {
    fs.readdirSync(denied);
  } catch {
    unreadable = true;
  }
  if (!unreadable) {
    // The directory stayed readable (for example when running as root); there
    // is no way to make ripgrep emit stderr, so skip rather than assert falsely.
    fs.chmodSync(denied, 0o700);
    t.skip("cannot deny directory read in this environment");
    return;
  }

  const maxBytes = 16;
  try {
    await assert.rejects(
      run("search", { pattern: "x", path: "denied" }, makeContext(ws, { maxOutputBytes: maxBytes })),
      (error: Error) => {
        const marker = "): ";
        const at = error.message.indexOf(marker);
        assert.notEqual(at, -1, `expected an rg failure message, got: ${error.message}`);
        const stderrPart = error.message.slice(at + marker.length);
        assert.ok(
          Buffer.byteLength(stderrPart, "utf8") <= maxBytes,
          `surfaced stderr exceeded the byte cap: ${JSON.stringify(stderrPart)}`,
        );
        return true;
      },
    );
  } finally {
    fs.chmodSync(denied, 0o700);
  }
});

test("run_command keeps a UTF-8 boundary at the truncated tail (no U+FFFD)", async () => {
  const ws = tmpDir();
  // 7 bytes: emoji (4) followed by "abc" (3). Caps of 4..6 force the tail cut
  // to land at every position around the emoji's continuation bytes.
  for (const cap of [4, 5, 6]) {
    const out = await run(
      "run_command",
      { command: "printf '\\360\\237\\230\\200abc'" },
      makeContext(ws, { allowShell: true, maxOutputBytes: cap }),
    );
    assert.ok(!out.includes("�"), `cap ${cap} emitted U+FFFD: ${JSON.stringify(out)}`);
    assert.match(out, /abc|😀/, `cap ${cap} should keep a decodable tail: ${JSON.stringify(out)}`);
  }
});
