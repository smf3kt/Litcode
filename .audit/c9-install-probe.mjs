import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tsImport } from 'tsx/esm/api';
const { createPluginTools } = await tsImport('../src/plugins.ts', '/Users/mant1ssa/Projects/cc_reverse/scripts/x.mjs');
const manifests = [
  { name: "../escape", version: "1" }, { name: "Sample", version: "1" }, { name: "sample", version: "" },
  { name: "sample", version: "1", skills: "../skills" }, { name: "sample", version: "1", skills: "/skills" },
  { name: "sample", version: "1", skills: "missing" }, { name: "sample", version: "1", skills: "data.bin" },
  { name: "sample", version: "1", hooks: { command: "execute" } },
];
for (const manifest of manifests) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'c9inst-')));
  const workspace = path.join(root, 'ws'), source = path.join(root, 'src');
  fs.mkdirSync(workspace); fs.mkdirSync(path.join(source, 'skills/example'), { recursive: true });
  fs.writeFileSync(path.join(source, 'plugin.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(source, 'data.bin'), Buffer.from([0,255,10]));
  fs.writeFileSync(path.join(source, 'skills/example/SKILL.md'), '---\nname: example\n---\nFixture skill.');
  const tool = createPluginTools({ enabled: true }).find(t => t.schema.name === 'plugin_install');
  try { const out = await tool.execute({ directory: source }, { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 }); console.log('ACCEPTED', JSON.stringify(manifest), String(out).slice(0, 120)); }
  catch (e) { console.log('rejected', JSON.stringify(manifest), '-', e.message.slice(0, 100)); }
  fs.rmSync(root, { recursive: true, force: true });
}
