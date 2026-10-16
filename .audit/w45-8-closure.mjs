// W45-8 reconnaissance: the decoration runtime closure. Seeds the bodies the composer needs, then
// reports every identifier they use that is not declared among them, with where the module declares it
// (so a block can be added by module+offset, never by bare name).
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import {topLevelIndex, extractFn, extent} from '../scripts/source-copy-scan.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse/';
const MODULE = 'chunk-sfn1dbxq.js';
const file = path.join(root, 'extracted-v2/modules', MODULE);
const text = fs.readFileSync(file, 'utf8');

const SEEDS = [
  ['ihe', 'var ihe=Object.freeze([])'],
  ['Rke', 'function Rke('],
  ['a7o', 'function a7o('],
  ['Fht', 'var Fht='],
];

const blocks = new Map();
for (const [name, needle] of SEEDS) {
  const at = topLevelIndex(text, needle);
  if (at < 0) throw new Error(`seed not found: ${name}`);
  const range = needle.startsWith('function') || needle.startsWith('class') ? extractFn(text, at) : extent(text, at);
  blocks.set(name, {at, range, body: text.slice(range[0], range[1])});
}

const declared = new Set();
const used = new Set();
for (const {body} of blocks.values()) {
  const ast = acorn.parse(body, {ecmaVersion: 'latest', sourceType: 'module'});
  const walk = (node, fn) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const child of node) walk(child, fn); return; }
    if (typeof node.type === 'string') fn(node);
    for (const key of Object.keys(node)) if (key !== 'type') walk(node[key], fn);
  };
  walk(ast, node => {
    if (node.type === 'Identifier' || node.type === 'PrivateIdentifier') return;
  });
  // Declared at any depth inside these bodies: treat function/var/class declarations and parameters.
  walk(ast, node => {
    if (node.type === 'FunctionDeclaration' && node.id) declared.add(node.id.name);
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') declared.add(node.id.name);
    if (node.type === 'ClassDeclaration' && node.id) declared.add(node.id.name);
    if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      for (const p of node.params) if (p.type === 'Identifier') declared.add(p.name);
    }
  });
  walk(ast, node => {
    if (node.type === 'Identifier') used.add(node.name);
  });
}

const GLOBALS = new Set(['Object', 'Array', 'Map', 'Set', 'Math', 'Number', 'String', 'JSON', 'Uint32Array', 'undefined', 'this', 'if', 'of', 'in']);
const unknown = [...used].filter(name => !declared.has(name) && !GLOBALS.has(name)).sort();
console.log('declared in the closure:', [...declared].sort().join(', '));
console.log('\nused but not declared here:');
for (const name of unknown) {
  const re = new RegExp(`(?:function|var|let|const|class)\\s+${name}\\b`, 'g');
  const hits = [];
  let m;
  while ((m = re.exec(text)) && hits.length < 3) hits.push(m.index);
  console.log(' ', name, hits.length ? `declared at ${hits.map(h => text.slice(h, h + 60).split('(')[0].trim()).join(' | ')}` : 'not found in this module');
  for (const hit of hits) console.log('      ', hit, JSON.stringify(text.slice(hit, hit + 120)));
}
