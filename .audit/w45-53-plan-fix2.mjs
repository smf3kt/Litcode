// Add the settings-store hook import to the settings-read plan: the copy's two bodies call `ft` and
// `fe`, which live in the store this package bounds.
import fs from 'node:fs';

const path = 'research/ports/W45-settings-read-blocks.plan.json';
const plan = JSON.parse(fs.readFileSync(path, 'utf8'));
const line = "import { fe, ft } from './plugin-chain-settings-store.js';";
if (!plan.imports.includes(line)) plan.imports.push(line);
fs.writeFileSync(path, JSON.stringify(plan, null, 2) + '\n');
console.log(plan.imports.at(-1));
