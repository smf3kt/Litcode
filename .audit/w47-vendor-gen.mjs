// A shorthand `declare module 'x'` makes every name it exports a namespace, and TypeScript then
// refuses to use one as a type (TS2709, 71 sites). The fix is to declare the names the tree actually
// imports. So: walk every import site, collect the bindings per vendor specifier, and emit a
// declaration that exports each name in both declaration spaces.
//
//   node .audit/w47-vendor-gen.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const HARNESS = '/Users/mant1ssa/Projects/cc-base-2188';
const ts = createRequire(import.meta.url)('/tmp/w47-tools/node_modules/typescript');
const APPLY = process.argv.includes('--apply');

// Family patterns and the exact specifiers from the error list.
const patterns = [
  ['@ant/*', /^@ant\//],
  ['@anthropic-ai/*', /^@anthropic-ai\//],
  ['@aws-sdk/*', /^@aws-sdk\//],
  ['@azure/*', /^@azure\//],
  ['@opentelemetry/*', /^@opentelemetry\//],
  ['@smithy/*', /^@smithy\//],
  ['*-napi', /-napi$/],
  ['bun:ffi', /^bun:ffi$/],
  ['cacache', /^cacache$/],
  ['cli-highlight', /^cli-highlight$/],
  ['fflate', /^fflate$/],
  ['plist', /^plist$/],
  ['sharp', /^sharp$/],
  ['turndown', /^turndown$/],
  ['vscode-jsonrpc/node.js', /^vscode-jsonrpc\/node\.js$/],
  ['yaml', /^yaml$/],
];
const familyOf = (spec) => patterns.find(([, re]) => re.test(spec))?.[0] ?? null;

const walk = (dir) => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'recovered' || e.name === '.git' || e.name === 'shims') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(e.name) && !/\.w47[a-z0-9]*bak$/.test(e.name)) out.push(p);
  }
  return out;
};

const names = new Map(); // family pattern -> Set(names)
const defaults = new Set();
const namespaces = new Map(); // local namespace binding -> family
for (const full of walk(HARNESS)) {
  const text = fs.readFileSync(full, 'utf8');
  if (!/from ['"]@|from ['"](?:sharp|yaml|fflate|plist|turndown|cacache|cli-highlight|highlight\.js|vscode-jsonrpc)|from ['"][^'"]*-napi['"]/.test(text) &&
      !/import\(['"]@|require\(['"]@/.test(text) &&
      !/import\(['"](?:sharp|yaml|fflate|plist|turndown|cacache|cli-highlight|highlight\.js)|import\(['"][^'"]*-napi['"]/.test(text)) continue;
  const source = ts.createSourceFile(full, text, ts.ScriptTarget.ES2022, true, full.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const add = (fam, name) => {
    if (!names.has(fam)) names.set(fam, new Set());
    names.get(fam).add(name);
  };
  const visit = (node) => {
    // `typeof import('m').X` and `import('m').X` in a type position: the name never appears in an
    // import clause, so a named-import scan alone misses it (that is how color-diff-napi and
    // cli-highlight ended up with no declared members).
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      const fam = familyOf(node.argument.literal.text);
      if (fam !== null) {
        let q = node.qualifier;
        if (q) add(fam, ts.isIdentifier(q) ? q.text : q.right.text);
      }
    }
    const spec = ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) ? node.arguments[0].text
      : ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) ? node.arguments[0].text
      : null;
    if (spec !== null) {
      const fam = familyOf(spec);
      if (fam !== null) {
        const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
        if (clause?.name) defaults.add(fam);
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const el of clause.namedBindings.elements) add(fam, el.propertyName ? el.propertyName.text : el.name.text);
        }
        if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) namespaces.set(clause.namedBindings.name.text, fam);
        // `const { a, b } = await import('x')`
        if (!ts.isImportDeclaration(node)) {
          let parent = node.parent;
          while (parent && !ts.isVariableDeclaration(parent) && !ts.isVariableDeclarationList(parent)) parent = parent.parent;
          const decl = parent && ts.isVariableDeclaration(parent) ? parent : null;
          if (decl?.name && ts.isObjectBindingPattern(decl.name)) {
            for (const el of decl.name.elements) if (ts.isIdentifier(el.name)) add(fam, el.name.text);
          }
        }
      }
    }
    // `ns.member` where `import * as ns from 'm'`: the members a namespace import uses.
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const fam = namespaces.get(node.expression.text);
      if (fam) add(fam, node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

// `*-napi` names cannot be enumerated: the native addons are reached through dynamic requires that
// member-access the module object (`mod.isNativeAudioAvailable`), which a fixed member list rejects.
// The shorthand form leaves every member `any`, and the one place a *type* is imported from an addon
// declares it locally instead.
names.delete('*-napi');

// `highlight.js` is reached only through a type query, so it never appears in the vendor list the
// error scan produced; declare it anyway, with the one member the tree asks for.
const extra = [['highlight.js', ['getLanguage']]];
for (const [spec, list] of extra) {
  if (!names.has(spec)) names.set(spec, new Set());
  for (const n of list) names.get(spec).add(n);
}
const withNames = [...patterns.map(([p]) => p), ...extra.map(([p]) => p)];

const blocks = [];
for (const family of withNames) {
  const set = names.get(family);
  if (!set || set.size === 0) {
    blocks.push(`declare module '${family}';`);
    continue;
  }
  const body = [...set].sort().flatMap((n) => [`  export type ${n} = any`, `  export const ${n}: any`]);
  if (defaults.has(family)) body.unshift('  const _default: any', '  export default _default');
  blocks.push(`declare module '${family}' {\n${body.join('\n')}\n}`);
}

const header = `// Vendor and optional dependencies the harness does not install. Two families: internal packages
// that cannot be installed from any registry (\`@ant/*\`, the \`*-napi\` native addons), and published
// optional dependencies the dump loads lazily, where installing them would pull hundreds of megabytes
// (the AWS, OpenTelemetry and Smithy SDKs) for types alone.
//
// The names below are the bindings the tree actually imports from each module, declared in both
// declaration spaces — a shorthand \`declare module 'x'\` would make them namespaces and TypeScript
// rejects a namespace in a type position (TS2709). This models an environment gap, not behaviour:
// the real build resolves these, and a product merge installs the ones that ship.
`;
const out = `${header}\n${blocks.join('\n\n')}\n`;
if (APPLY) {
  fs.writeFileSync(path.join(HARNESS, 'types/vendor.d.ts'), out);
  console.log('wrote types/vendor.d.ts');
} else {
  console.log(out.slice(0, 1200));
}
const total = [...names.values()].reduce((n, s) => n + s.size, 0);
console.log(`families ${names.size} | names ${total} | with default ${[...defaults].length}`);
for (const [f, s] of names) console.log(`  ${f}: ${s.size}`);
