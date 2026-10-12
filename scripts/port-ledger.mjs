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
const modules = names.map(name => {
  const bytes = Buffer.from(fs.readFileSync(path.join(moduleRoot, name), "utf8"), "utf8");
  return { path: name, bytes: bytes.length, sha256: hash(bytes) };
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
    else if (/\.(md|json)$/.test(entry.name) && !excluded.has(path.resolve(absolute)) &&
      !/^port-ledger\.(md|json)$/.test(entry.name)) records.push(absolute);
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
const ledger = {
  schema: "RecoveredModulePortLedger.v1",
  date: new Date().toISOString().slice(0, 10),
  sample: { input: manifest.input, sha256: manifest.sha256, manifestModuleCount: manifest.moduleCount, limitations: manifest.limitations },
  coordinateUnit: "per-module UTF-8 text; digests are sha256 of the decoded module text",
  recordCount: records.length,
  summary: { modules: modules.length, ...summarise(reviewed), narrativeOnly: summarise(narrativeOnly), unreviewed: summarise(unreviewed) },
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

## Largest modules without a citation

Unreviewed, listed so the largest gaps stay visible rather than implied covered.

| Module | Bytes |
| --- | --- |
${top}
`);
}
console.log(JSON.stringify({ ledger: output, markdown: markdown ?? null, modules: modules.length, reviewed: reviewed.length, unreviewed: unreviewed.length }));
