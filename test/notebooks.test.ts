import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { createNotebookTools } from "../src/notebooks.js";
import type { ToolContext, ToolDefinition } from "../src/tools.js";

const tools = createNotebookTools();
const byName = new Map(tools.map((tool) => [tool.schema.name, tool]));

const NOTEBOOK_MAX_BYTES = 8 * 1024 * 1024;

const tempDirs: string[] = [];
function tmpDir(prefix = "ccrev-nb-"): string {
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

type Cell = Record<string, unknown> & { cell_type: string; source: unknown; id?: string };
function code(source: string, id?: string): Cell {
  return { cell_type: "code", id, source, metadata: { tags: [] }, execution_count: 3, outputs: [{ n: 1 }] };
}
function markdown(source: string, id?: string): Cell {
  return { cell_type: "markdown", id, source, metadata: { collapsed: false } };
}
function notebook(cells: Cell[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify(
    { cells, metadata: { kernelspec: { name: "python3" }, language_info: { name: "python" } }, nbformat: 4, nbformat_minor: 5, ...extra },
    null,
    2,
  );
}
function write(ws: string, rel: string, content: string): void {
  const target = path.join(ws, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function parse(ws: string, rel: string): { cells: Cell[]; metadata: Record<string, unknown> } {
  return JSON.parse(fs.readFileSync(path.join(ws, rel), "utf8"));
}

test("createNotebookTools exposes notebook_read and notebook_edit", () => {
  assert.deepEqual([...byName.keys()].sort(), ["notebook_edit", "notebook_read"]);
  assert.equal(tool("notebook_read").readOnly, true);
  assert.equal(tool("notebook_edit").readOnly, false);
  assert.equal(tool("notebook_read").schema.name, "notebook_read");
  assert.deepEqual(tool("notebook_edit").schema.input_schema.required, ["path", "new_source"]);
});

test("notebook_read lists stable ids with a 0-based index and reports absent ids", async () => {
  const ws = tmpDir();
  write(ws, "nb.ipynb", notebook([code("print(1)\n", "cell-a"), markdown("# Title\n")]));

  const out = await run("notebook_read", { path: "nb.ipynb" }, makeContext(ws));
  assert.match(out, /nb\.ipynb \(nbformat 4\.5, 2 cells\)/);
  assert.match(out, /\[0\] id=cell-a type=code execution_count=3 outputs=1/);
  assert.match(out, /print\(1\)/);
  assert.match(out, /\[1\] id=\(no id\) type=markdown/);
  assert.match(out, /# Title/);
});

test("notebook_edit replaces a code cell: source updated, outputs cleared, type kept", async () => {
  const ws = tmpDir();
  write(ws, "nb.ipynb", notebook([code("old\n", "c1")]));

  const msg = await run(
    "notebook_edit",
    { path: "nb.ipynb", cell_id: "c1", new_source: "new\n" },
    makeContext(ws),
  );
  assert.match(msg, /Updated cell c1/);
  const nb = parse(ws, "nb.ipynb");
  const cell = nb.cells[0]!;
  assert.equal(cell.source, "new\n");
  assert.equal(cell.cell_type, "code");
  assert.equal(cell.execution_count, null);
  assert.deepEqual(cell.outputs, []);
});

test("notebook_edit preserves unrelated cells, metadata, ids, and outputs", async () => {
  const ws = tmpDir();
  write(
    ws,
    "nb.ipynb",
    notebook([code("keep me\n", "keep"), code("edit me\n", "edit"), markdown("md\n", "md")]),
  );

  await run("notebook_edit", { path: "nb.ipynb", cell_id: "edit", new_source: "edited\n" }, makeContext(ws));
  const nb = parse(ws, "nb.ipynb");

  // Top-level metadata and cell count/order are unchanged.
  assert.deepEqual(nb.metadata, { kernelspec: { name: "python3" }, language_info: { name: "python" } });
  assert.equal(nb.cells.length, 3);
  assert.deepEqual(nb.cells.map((c) => c.id), ["keep", "edit", "md"]);

  // The untouched code cell keeps its execution_count and outputs verbatim.
  const keep = nb.cells[0]!;
  assert.equal(keep.source, "keep me\n");
  assert.equal(keep.execution_count, 3);
  assert.deepEqual(keep.outputs, [{ n: 1 }]);
  assert.deepEqual(keep.metadata, { tags: [] });

  // The edited cell keeps its id and metadata but loses stale outputs.
  const edit = nb.cells[1]!;
  assert.equal(edit.source, "edited\n");
  assert.deepEqual(edit.metadata, { tags: [] });
  assert.equal(edit.execution_count, null);
  assert.deepEqual(edit.outputs, []);

  // The untouched markdown cell is byte-identical in structure.
  assert.deepEqual(nb.cells[2], markdown("md\n", "md"));
});

test("notebook_edit inserts a cell with a crypto UUID and code defaults", async () => {
  const ws = tmpDir();
  write(ws, "nb.ipynb", notebook([markdown("first\n", "m1")]));

  const msg = await run(
    "notebook_edit",
    { path: "nb.ipynb", edit_mode: "insert", cell_type: "code", new_source: "print(2)\n" },
    makeContext(ws),
  );
  assert.match(msg, /Inserted cell /);
  const nb = parse(ws, "nb.ipynb");
  assert.equal(nb.cells.length, 2);
  // No cell_id: the new cell goes to the top.
  const inserted = nb.cells[0]!;
  assert.equal(inserted.cell_type, "code");
  assert.equal(inserted.source, "print(2)\n");
  assert.equal(inserted.execution_count, null);
  assert.deepEqual(inserted.outputs, []);
  assert.deepEqual(inserted.metadata, {});
  assert.match(String(inserted.id), /^[0-9a-f-]{36}$/);
  assert.equal(nb.cells[1]!.id, "m1");
});

test("notebook_edit insert after a given cell_id and markdown insert", async () => {
  const ws = tmpDir();
  write(ws, "nb.ipynb", notebook([markdown("a\n", "a"), markdown("b\n", "b")]));

  await run(
    "notebook_edit",
    { path: "nb.ipynb", edit_mode: "insert", cell_id: "a", cell_type: "markdown", new_source: "mid\n" },
    makeContext(ws),
  );
  const nb = parse(ws, "nb.ipynb");
  assert.deepEqual(nb.cells.map((c) => c.source), ["a\n", "mid\n", "b\n"]);
  assert.equal(nb.cells[1]!.execution_count, undefined);
});

test("notebook_edit deletes a cell by id and by index fallback", async () => {
  const ws = tmpDir();
  write(ws, "nb.ipynb", notebook([markdown("a\n", "a"), markdown("b\n", "b"), markdown("c\n", "c")]));

  const msg = await run(
    "notebook_edit",
    { path: "nb.ipynb", edit_mode: "delete", cell_id: "b", new_source: "" },
    makeContext(ws),
  );
  assert.match(msg, /Deleted cell b/);
  assert.deepEqual(parse(ws, "nb.ipynb").cells.map((c) => c.source), ["a\n", "c\n"]);

  // Numeric cell_id falls back to a 0-based index.
  await run("notebook_edit", { path: "nb.ipynb", edit_mode: "delete", cell_id: "0", new_source: "" }, makeContext(ws));
  assert.deepEqual(parse(ws, "nb.ipynb").cells.map((c) => c.source), ["c\n"]);
});

test("notebook_edit reports missing ids and invalid edit requests explicitly", async () => {
  const ws = tmpDir();
  write(ws, "nb.ipynb", notebook([markdown("a\n", "a")], {}));

  await assert.rejects(
    run("notebook_edit", { path: "nb.ipynb", cell_id: "ghost", new_source: "x" }, makeContext(ws)),
    /Cell with ID "ghost" not found/,
  );
  await assert.rejects(
    run("notebook_edit", { path: "nb.ipynb", cell_id: "9", new_source: "x" }, makeContext(ws)),
    /Cell with index 9 does not exist/,
  );
  await assert.rejects(
    run("notebook_edit", { path: "nb.ipynb", new_source: "x" }, makeContext(ws)),
    /cell_id is required/,
  );
  await assert.rejects(
    run("notebook_edit", { path: "nb.ipynb", edit_mode: "delete", new_source: "" }, makeContext(ws)),
    /cell_id is required/,
  );
  await assert.rejects(
    run("notebook_edit", { path: "nb.ipynb", edit_mode: "insert", new_source: "x" }, makeContext(ws)),
    /Cell type is required/,
  );
  // An insert that references an index naming no existing cell is rejected.
  await assert.rejects(
    run(
      "notebook_edit",
      { path: "nb.ipynb", edit_mode: "insert", cell_id: "1", cell_type: "code", new_source: "x" },
      makeContext(ws),
    ),
    /Cell with index 1 does not exist/,
  );
  // A failed edit leaves the file untouched.
  assert.equal(parse(ws, "nb.ipynb").cells[0]!.source, "a\n");
});

test("notebook_edit rejects duplicate cell ids", async () => {
  const ws = tmpDir();
  write(ws, "nb.ipynb", notebook([markdown("a\n", "dup"), markdown("b\n", "dup")]));
  await assert.rejects(
    run("notebook_edit", { path: "nb.ipynb", cell_id: "dup", new_source: "x" }, makeContext(ws)),
    /duplicate cell id "dup"/,
  );
});

test("notebook_edit initializes or removes code fields on cell_type change", async () => {
  const ws = tmpDir();
  write(ws, "nb.ipynb", notebook([markdown("md\n", "m"), code("py\n", "c")]));

  // markdown -> code initializes execution_count/outputs and keeps metadata.
  await run(
    "notebook_edit",
    { path: "nb.ipynb", cell_id: "m", cell_type: "code", new_source: "md\n" },
    makeContext(ws),
  );
  const promoted = parse(ws, "nb.ipynb").cells[0]!;
  assert.equal(promoted.cell_type, "code");
  assert.equal(promoted.execution_count, null);
  assert.deepEqual(promoted.outputs, []);
  assert.deepEqual(promoted.metadata, { collapsed: false });

  // code -> markdown removes the code-only fields.
  await run(
    "notebook_edit",
    { path: "nb.ipynb", cell_id: "c", cell_type: "markdown", new_source: "py\n" },
    makeContext(ws),
  );
  const demoted = parse(ws, "nb.ipynb").cells[1]!;
  assert.equal(demoted.cell_type, "markdown");
  assert.equal("outputs" in demoted, false);
  assert.equal("execution_count" in demoted, false);
  assert.deepEqual(demoted.metadata, { tags: [] });
});

test("notebook_read rejects malformed cell sources instead of altering them", async () => {
  const ws = tmpDir();
  write(ws, "num.ipynb", notebook([{ cell_type: "code", source: 123, id: "s" }]));
  await assert.rejects(
    run("notebook_read", { path: "num.ipynb" }, makeContext(ws)),
    /source must be a string or a list of strings/,
  );

  write(ws, "arr.ipynb", notebook([{ cell_type: "code", source: ["ok\n", 5], id: "s" }]));
  await assert.rejects(
    run("notebook_read", { path: "arr.ipynb" }, makeContext(ws)),
    /source must be a string or a list of strings/,
  );
});

test("notebook tools reject non-notebooks, invalid JSON, and non-nbformat-4", async () => {
  const ws = tmpDir();
  write(ws, "plain.txt", "hello");
  await assert.rejects(
    run("notebook_edit", { path: "plain.txt", cell_id: "a", new_source: "x" }, makeContext(ws)),
    /Jupyter notebook/,
  );

  write(ws, "bad.ipynb", "{ not json");
  await assert.rejects(run("notebook_read", { path: "bad.ipynb" }, makeContext(ws)), /not valid JSON/);

  write(ws, "v3.ipynb", JSON.stringify({ nbformat: 3, nbformat_minor: 0, cells: [] }));
  await assert.rejects(run("notebook_read", { path: "v3.ipynb" }, makeContext(ws)), /only nbformat 4/);

  write(ws, "plain.txt", "hello");
  await assert.rejects(run("notebook_read", { path: "plain.txt" }, makeContext(ws)), /\.ipynb/);
});

test("notebook_read truncates output at maxOutputBytes", async () => {
  const ws = tmpDir();
  const big = Array.from({ length: 500 }, (_, i) => `line-${i}`).join("\n");
  write(ws, "nb.ipynb", notebook([markdown(big + "\n", "m")]));

  const out = await run("notebook_read", { path: "nb.ipynb" }, makeContext(ws, { maxOutputBytes: 200 }));
  assert.match(out, /notebook_read: output truncated/);
  assert.ok(Buffer.byteLength(out, "utf8") < 400, "output should be capped");
});

test("notebook_edit rejects a result over the 8 MiB cap and leaves the file unchanged", async () => {
  const ws = tmpDir();
  // The untouched cell is large; replacing the small cell pushes the result past the cap.
  write(ws, "nb.ipynb", notebook([code("a".repeat(4_200_000), "big"), markdown("small\n", "m")]));
  const before = fs.readFileSync(path.join(ws, "nb.ipynb"));

  await assert.rejects(
    run("notebook_edit", { path: "nb.ipynb", cell_id: "m", new_source: "b".repeat(5_000_000) }, makeContext(ws)),
    /maximum size/,
  );
  assert.deepEqual(fs.readFileSync(path.join(ws, "nb.ipynb")), before, "file must be unchanged");
});

test("notebook_edit writes atomically and preserves file mode", async () => {
  const ws = tmpDir();
  write(ws, "nb.ipynb", notebook([markdown("a\n", "a")]));
  fs.chmodSync(path.join(ws, "nb.ipynb"), 0o600);

  await run("notebook_edit", { path: "nb.ipynb", cell_id: "a", new_source: "b\n" }, makeContext(ws));

  assert.equal(fs.statSync(path.join(ws, "nb.ipynb")).mode & 0o777, 0o600);
  const leftovers = fs.readdirSync(ws).filter((name) => name.includes(".tmp"));
  assert.deepEqual(leftovers, []);
});

test("a pre-aborted signal prevents all notebook side effects", async () => {
  const ws = tmpDir();
  write(ws, "nb.ipynb", notebook([markdown("orig\n", "a")]));
  const controller = new AbortController();
  controller.abort();
  const ctx = makeContext(ws, { signal: controller.signal });
  const before = fs.readFileSync(path.join(ws, "nb.ipynb"));

  await assert.rejects(run("notebook_edit", { path: "nb.ipynb", cell_id: "a", new_source: "z" }, ctx), /aborted/);
  await assert.rejects(run("notebook_read", { path: "nb.ipynb" }, ctx), /aborted/);
  assert.deepEqual(fs.readFileSync(path.join(ws, "nb.ipynb")), before);
});

test("notebook tools reject symlink escapes and the reserved .agent directory", async () => {
  const ws = tmpDir();
  const outside = tmpDir();
  write(outside, "secret.ipynb", notebook([markdown("secret\n", "s")]));
  write(ws, "ok.ipynb", notebook([markdown("a\n", "a")]));

  // A direct file symlink escaping the workspace.
  fs.symlinkSync(path.join(outside, "secret.ipynb"), path.join(ws, "link.ipynb"));
  await assert.rejects(run("notebook_read", { path: "link.ipynb" }, makeContext(ws)), /escapes/);

  // An ancestor directory symlink escaping the workspace.
  fs.symlinkSync(outside, path.join(ws, "outdir"));
  await assert.rejects(run("notebook_read", { path: "outdir/secret.ipynb" }, makeContext(ws)), /escapes/);
  await assert.rejects(
    run("notebook_edit", { path: "outdir/secret.ipynb", cell_id: "s", new_source: "x" }, makeContext(ws)),
    /escapes/,
  );

  // Lexical escapes and absolute paths.
  await assert.rejects(run("notebook_read", { path: "../outside.ipynb" }, makeContext(ws)), /escapes/);
  await assert.rejects(run("notebook_read", { path: path.join(ws, "ok.ipynb") }, makeContext(ws)), /escapes/);

  // The reserved .agent directory, including via an aliasing symlink.
  write(ws, ".agent/hidden.ipynb", notebook([markdown("h\n", "h")]));
  fs.symlinkSync(path.join(ws, ".agent"), path.join(ws, "agentlink"));
  await assert.rejects(run("notebook_read", { path: ".agent/hidden.ipynb" }, makeContext(ws)), /\.agent/);
  await assert.rejects(run("notebook_read", { path: "agentlink/hidden.ipynb" }, makeContext(ws)), /\.agent/);
});
