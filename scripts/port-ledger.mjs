// Builds the per-module port ledger for the recovered sample: every extracted
// module with its content digest, the research records that cite it, and the
// classification those records declare. Modules no record cites are reported as
// unreviewed rather than assigned a guessed share.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; };
const extracted = option("--extracted");
const output = option("--output");
const markdown = option("--markdown");
if (!extracted || !output) throw new Error("Usage: node scripts/port-ledger.mjs --extracted DIR --output NEW_JSON [--markdown NEW_MD]");
const sampleRoot = path.resolve(extracted);
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

const manifest = JSON.parse(fs.readFileSync(path.join(sampleRoot, "manifest.json"), "utf8"));
const moduleRoot = path.join(sampleRoot, "modules");
const names = fs.readdirSync(moduleRoot).filter(name => name.endsWith(".js")).sort();

// Literal markers observed in the recovered text. A marker records that the
// bytes contain that literal, with its first offset; it is a characterisation
// hint for the corpus, never a claim about which subsystem owns the module.
const MARKERS = [
  ["invalid_union", "validation-library messages"],
  ["google.protobuf.Struct", "protobuf runtime"],
  ["EDITION_2023", "protobuf descriptors"],
  ["timeUnixNano", "otel otlp protobuf"],
  ["ink-virtual-text", "terminal UI library"],
  ["login.microsoftonline.com", "cloud identity client"],
  ["annotation-xml", "DOM/HTML parser"],
  ["title.class", "syntax grammars"],
  ["resources/templates/list", "MCP protocol surface"],
  ["self_hosted_", "self-hosted release surface"],
  ["artifact_capability_section", "artifact capability surface"],
  ["org_memory_", "org memory surface"],
  ["fleet_view_", "background-agent UI"],
  ["manage-marketplaces", "plugin marketplace UI"],
  ["cli_plugin_eval", "plugin eval tooling"],
  ["anthropic-beta", "API beta headers"],
];

const BUILTINS = new Set(["assert","buffer","child_process","cluster","console","crypto","dgram","dns","events","fs","http","http2","https","module","net","os","path","perf_hooks","process","punycode","querystring","readline","repl","stream","string_decoder","timers","tls","tty","url","util","v8","vm","wasi","worker_threads","zlib","worker_threads"]);

const modules = names.map(name => {
  const text = fs.readFileSync(path.join(moduleRoot, name), "utf8");
  const bytes = Buffer.from(text, "utf8");
  // The recovered modules share a leading license banner; its exact length is
  // recorded so later passes can measure the readable payload instead.
  const lines = text.split("\n");
  let head = 0;
  while (head < lines.length && (lines[head].startsWith("//") || lines[head].trim() === "")) head++;
  const bannerBytes = lines.slice(0, head).join("\n").length;
  const binary = text.includes("\u0000");
  // Import specifiers are a structural signal that works for every module: the
  // recovered bundles name what a module pulls in, so a module that imports only
  // runtime builtins is a self-contained leaf, while one that imports external
  // packages or sibling chunks sits inside the product graph.
  const builtins = new Set();
  const packages = new Set();
  let chunks = 0;
  for (const match of text.matchAll(/(?:from|require\()\s*"([^"]{1,64})"/g)) {
    const specifier = match[1];
    // Minified text contains many quoted fragments; only a well-formed module
    // specifier counts, so package names are never invented from nearby code.
    if (!/^(?:node:)?(?:@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/.test(specifier)) continue;
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      if (/chunk-/.test(specifier)) chunks++;
      continue;
    }
    const bare = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
    const root = bare.split("/")[0].startsWith("@") ? bare.split("/").slice(0, 2).join("/") : bare.split("/")[0];
    if (BUILTINS.has(root) || specifier.startsWith("node:")) builtins.add(root);
    else packages.add(root);
  }
  const markers = {};
  for (const [literal, family] of MARKERS) {
    const at = text.indexOf(literal);
    if (at >= 0) markers[family] = { literal, at };
  }
  return { path: name, bytes: bytes.length, sha256: hash(bytes), bannerBytes, binary, builtins: [...builtins].sort(), packages: [...packages].sort(), chunks, markers };
});

// One pass over every research record: which module names does it mention?
const known = new Set(modules.map(module => module.path));
const citations = new Map();
const classifications = new Map();
const records = [];
// The ledger's own outputs list every module name, so they are never inputs;
// otherwise a regenerated ledger would cite itself as evidence for everything.
const excluded = new Set([output, markdown].filter(Boolean).map(target => path.resolve(target)));
const walk = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    // Inventory and evidence artifacts (this ledger, the corpus characterisation
    // and every generated `-evidence.json`) list module names without being port
    // evidence, so they are never scanned as records. Without this, an evidence
    // file that enumerates the modules its own package ported would cite them and
    // the reviewed count would be derived from the ledger's previous output.
    else if (/\.(md|json)$/.test(entry.name) && !excluded.has(path.resolve(absolute)) &&
      !/^(port-ledger|unreviewed-corpus|remaining-dispositions)\.(md|json)$/.test(entry.name) &&
      !/-evidence\.json$/.test(entry.name)) records.push(absolute);
  }
};
walk(path.join(root, "research"));
for (const record of records) {
  const text = fs.readFileSync(record, "utf8");
  const relative = path.relative(root, record);
  const seen = new Set();
  for (const token of text.split(/[^A-Za-z0-9._-]+/)) if (known.has(token) && !seen.has(token)) seen.add(token);
  for (const name of seen) {
    if (!citations.has(name)) citations.set(name, []);
    citations.get(name).push(relative);
  }
  const declared = /Classification:\s*([^\n]+)/.exec(text);
  if (declared) classifications.set(relative, declared[1].trim().slice(0, 160));
}

// A record under research/ports/ carries port evidence; any other record only
// mentions the module in prose. Only the first kind counts as reviewed here.
const ledgers = modules.map(module => {
  const citedBy = citations.get(module.path) ?? [];
  const portRecords = citedBy.filter(record => record.includes("/ports/"));
  return { ...module, citedBy, portRecords, reviewed: portRecords.length > 0 };
});
const reviewed = ledgers.filter(module => module.reviewed);
const narrativeOnly = ledgers.filter(module => !module.reviewed && module.citedBy.length > 0);
const unreviewed = ledgers.filter(module => module.citedBy.length === 0);
const summarise = list => ({ modules: list.length, bytes: list.reduce((sum, module) => sum + module.bytes, 0) });
// Which marker families appear in the modules no port record cites, so the
// unreviewed remainder is characterised instead of merely counted. A module
// can carry several markers and is counted in each.
const families = new Map();
const packageCounts = new Map();
let unmarked = 0;
let leafOnly = 0;
let chunkImporting = 0;
for (const module of unreviewed) {
  if (module.packages.length === 0 && module.chunks === 0) leafOnly++;
  if (module.chunks > 0) chunkImporting++;
  for (const name of module.packages) packageCounts.set(name, (packageCounts.get(name) ?? 0) + 1);
  const names = Object.keys(module.markers);
  if (names.length === 0) unmarked++;
  for (const family of names) {
    const entry = families.get(family) ?? { family, modules: 0, bytes: 0 };
    entry.modules += 1;
    entry.bytes += module.bytes;
    families.set(family, entry);
  }
}
const ledger = {
  schema: "RecoveredModulePortLedger.v1",
  date: new Date().toISOString().slice(0, 10),
  sample: { input: manifest.input, sha256: manifest.sha256, manifestModuleCount: manifest.moduleCount, limitations: manifest.limitations },
  coordinateUnit: "per-module UTF-8 text; digests are sha256 of the decoded module text",
  recordCount: records.length,
  summary: { modules: modules.length, ...summarise(reviewed), narrativeOnly: summarise(narrativeOnly), unreviewed: summarise(unreviewed),
    uncitedBinary: unreviewed.filter(module => module.binary).length, uncitedWithoutMarker: unmarked,
    uncitedBuiltinLeafOnly: leafOnly, uncitedImportingChunks: chunkImporting,
    uncitedPackages: [...packageCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 25).map(([name, modules]) => ({ name, modules })),
    families: [...families.values()].sort((left, right) => right.bytes - left.bytes) },
  reviewed: reviewed.map(module => ({ ...module, declared: module.portRecords.map(record => classifications.get(record)).filter(Boolean) })),
  unreviewedTop: [...unreviewed].sort((a, b) => b.bytes - a.bytes).slice(0, 25).map(module => ({ path: module.path, bytes: module.bytes })),
  modules: ledgers,
};
fs.writeFileSync(output, JSON.stringify(ledger, null, 2) + "\n");

if (markdown) {
  const rows = reviewed.map(module => `| \`${module.path}\` | ${module.bytes} | \`${module.sha256.slice(0, 12)}\` | ${module.portRecords.join(", ")} | ${ledger.reviewed.find(entry => entry.path === module.path).declared.join(" / ") || "-"} |`);
  const top = unreviewed.sort((a, b) => b.bytes - a.bytes).slice(0, 25)
    .map(module => `| \`${module.path}\` | ${module.bytes} |`).join("\n");
  fs.writeFileSync(markdown, `# Recovered module port ledger

Generated by \`node scripts/port-ledger.mjs --extracted <extracted-sample> --output research/ports/port-ledger.json --markdown research/ports/port-ledger.md\`. The sample is the recovered bundle: \`${manifest.input}\`, SHA-256 \`${manifest.sha256}\`, ${manifest.moduleCount} manifest modules; digests cover the decoded UTF-8 module text.

Sample limitations, unchanged: ${manifest.limitations.map(limit => `"${limit}"`).join(" ")}

## Summary

- Modules on disk: **${modules.length}** (${summarise(modules).bytes} bytes).
- Backed by a record under \`research/ports/\`: **${reviewed.length}** (${summarise(reviewed).bytes} bytes).
- Mentioned only by narrative records: **${narrativeOnly.length}** (${summarise(narrativeOnly).bytes} bytes).
- Not cited by any record: **${unreviewed.length}** (${summarise(unreviewed).bytes} bytes). These are recorded as unreviewed, never as ported or unported; no share is estimated.

## Modules with port evidence

| Module | Bytes | SHA-256 | Cited by | Declared classification |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

## Marker families inside the uncited set

A marker records that the module's bytes contain that literal; it characterises the corpus and never claims which subsystem owns a module. Modules may carry several markers and are counted in each.

| Family | Literal | Modules | Bytes |
| --- | --- | --- | --- |
${[...families.values()].sort((left, right) => right.bytes - left.bytes).map(entry => {
    const literal = MARKERS.find(([, family]) => family === entry.family)[0];
    return `| ${entry.family} | \`${literal}\` | ${entry.modules} | ${entry.bytes} |`;
  }).join("\n")}

Modules in the uncited set carrying no marker: **${unmarked}**. Binary payloads among them: **${unreviewed.filter(module => module.binary).length}**.

## Largest modules without a citation

Unreviewed, listed so the largest gaps stay visible rather than implied covered.

| Module | Bytes |
| --- | --- |
${top}
`);
}
console.log(JSON.stringify({ ledger: output, markdown: markdown ?? null, modules: modules.length, reviewed: reviewed.length, unreviewed: unreviewed.length }));
