import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function inventory(root, directories, files = []) {
  const paths = [];
  function visit(relative) {
    const absolute = path.join(root, relative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Identity input is a symlink: ${relative}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) visit(path.posix.join(relative, name));
    } else if (stat.isFile()) {
      paths.push(relative);
    } else throw new Error(`Identity input is not a regular file: ${relative}`);
  }
  for (const directory of directories) visit(directory);
  for (const file of files) visit(file);
  const records = [...new Set(paths)].sort().map(relative => {
    const bytes = fs.readFileSync(path.join(root, relative));
    return { path: relative, bytes: bytes.length, sha256: hash(bytes) };
  });
  return { sha256: hash(JSON.stringify(records)), files: records };
}

export function captureIdentity(root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))) {
  root = path.resolve(root);
  const inputs = inventory(root, ['src', 'bin', 'scripts'],
    ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.build.json']);
  const validation = inventory(root, ['test']);
  const build = inventory(root, ['dist']);
  return {
    schema: 'HarnessContentIdentity.v1',
    algorithm: 'sha256',
    manifestEncoding: 'UTF-8 JSON array of sorted path/bytes/sha256 records',
    inputs, validation, build,
    sha256: hash(JSON.stringify({ inputs: inputs.sha256, validation: validation.sha256, build: build.sha256 })),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let root;
  let output;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) root = path.resolve(args[++i]);
    else if (args[i] === '--output' && args[i + 1]) output = path.resolve(args[++i]);
    else throw new Error('Usage: node scripts/identity.mjs [--root PROJECT] [--output NEW_JSON]');
  }
  const identity = captureIdentity(root);
  const json = JSON.stringify(identity, null, 2) + '\n';
  if (output) fs.writeFileSync(output, json, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ schema: identity.schema, sha256: identity.sha256,
    inputs: { sha256: identity.inputs.sha256, files: identity.inputs.files.length },
    validation: { sha256: identity.validation.sha256, files: identity.validation.files.length },
    build: { sha256: identity.build.sha256, files: identity.build.files.length },
    ...(output ? { output } : {}) }));
}
