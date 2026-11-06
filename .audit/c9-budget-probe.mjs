import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tsImport } from 'tsx/esm/api';
const { createPluginTools, discoverInstalledPluginComponents } = await tsImport('../src/plugins.ts', '/Users/mant1ssa/Projects/cc_reverse/scripts/x.mjs');
const { loadProjectConfig, CONFIG_LIMITS } = await tsImport('../src/config.ts', '/Users/mant1ssa/Projects/cc_reverse/scripts/x.mjs');
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'c9budget-')));
const workspace = path.join(root, 'proj'), source = path.join(root, 'source'), userDir = path.join(root, 'user');
for (const d of [workspace, source, userDir]) fs.mkdirSync(d, { recursive: true });
const put = (base, rel, v) => { const f = path.join(base, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, v); };
const chunk = 'x'.repeat(1_700_000);
for (let i = 0; i < 4; i++) put(workspace, `.harness/rules/${i}.md`, chunk);
put(workspace, '.harness/settings.json', JSON.stringify({ plugins: { enabled: true } }));
put(source, 'plugin.json', JSON.stringify({ name: 'fixture', version: '1', skills: 'skills' }));
put(source, 'skills/big/SKILL.md', `---\nname: big\n---\n${chunk}`);
const tool = createPluginTools({ enabled: true }).find(t => t.schema.name === 'plugin_install');
await tool.execute({ directory: source }, { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 });
const items = discoverInstalledPluginComponents(workspace, { enabled: true });
console.log('entries', items.length, 'skillDirs', items[0]?.skillDirectories, 'files', [...(items[0]?.componentFiles.keys() ?? [])]);
console.log('skill bytes', items[0]?.componentFiles.get('skills/big/SKILL.md')?.length);
try { const cfg = loadProjectConfig(workspace, { userDir }); console.log('loaded', cfg.skills.map(s => [s.name, s.body.length])); }
catch (e) { console.log('threw', e.message); }
fs.rmSync(root, { recursive: true, force: true });
