import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { constants as m } from 'node:fs';
import { lstat as N, open as X, mkdtemp, readFile, rm, stat, symlink, link, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Source: chunk-566cpr3w.js SHA-256 bcbbf0cd8b6c5132409afe2e38ac723d8dd65dc466aadb50e9f10ea2b1dc06e4,
// oot [6616,6768), zero-based UTF-16. This standalone fixture does not execute the recovered application.
function oot(e,n){if(e.length<=n)return{preview:e,hasMore:!1};let s=e.slice(0,n).lastIndexOf(`
`),a=s>n*0.5?s:n;return{preview:e.slice(0,a),hasMore:!0}}

const root = fileURLToPath(new URL('../extracted-v2/', import.meta.url));
const source = readFileSync(`${root}modules/chunk-566cpr3w.js`, 'utf8');
const manifest = JSON.parse(readFileSync(`${root}manifest.json`, 'utf8'));
const digest = createHash('sha256').update(source).digest('hex');
assert.equal(digest, 'bcbbf0cd8b6c5132409afe2e38ac723d8dd65dc466aadb50e9f10ea2b1dc06e4');
assert.equal(manifest.modules.find((entry) => entry.path === 'chunk-566cpr3w.js').decodedSha256, digest);
assert.equal(oot.toString(), source.slice(6616, 6768));
assert.deepEqual(oot('abcd', 4), { preview: 'abcd', hasMore: false });
assert.deepEqual(oot('abcdef\nghij', 10), { preview: 'abcdef', hasMore: true });
assert.deepEqual(oot('ab\ncdefghij', 10), { preview: 'ab\ncdefghi', hasMore: true });
assert.deepEqual(oot('😀x', 2), { preview: '😀', hasMore: true });
console.log('source-bound preview fixture: 4 cases passed');

// jMn/IYt, chunk-f0442373.js [18220,18910), [19346,19724), UTF-16.
// g is the fixture's error boundary; source swap reporting is not part of this test.
const A = m.O_NOFOLLOW ?? 0;
const E = error => error?.code;
function g(path, reason) { throw new Error(`task output swap refused (${reason}): ${path}`); }
async function jMn(e,n){let i;try{i=await N(e)}catch(u){let a=E(u);if(a==="ELOOP"||a==="ENOTDIR")g(e,`lstat refused a swapped path (${a})`);throw u}if(!i.isFile()||i.nlink!==1)g(e,"not a regular nlink-1 file");let s=!1,r=i.size>n,o;try{o=await X(e,s?r?"r+":"r":(r?m.O_RDWR:m.O_RDONLY)|A|(m.O_NONBLOCK??0))}catch(u){let a=E(u);if(a==="ELOOP"||a==="EISDIR"||a==="ENOTDIR"||a==="ENXIO"||a==="EOPNOTSUPP"||a==="ENOTSUP")g(e,`open refused a swapped path (${a})`);throw u}try{let u=await o.stat();if(!u.isFile()||u.dev!==i.dev||u.ino!==i.ino||u.nlink!==1)g(e,"file changed between lstat and open");if(r&&u.size>n)await o.truncate(n);return{handle:o,size:u.size}}catch(u){throw await o.close(),u}}
async function IYt(e,n,i){let{handle:r,size:o}=await jMn(e,i);try{let u=await X(n,m.O_WRONLY|m.O_CREAT|m.O_TRUNC|A);try{let a=Buffer.alloc(1048576),p=0;while(p<i){let d=Math.min(a.length,i-p),{bytesRead:w}=await r.read(a,0,d,p);if(w===0)break;let k=0;while(k<w){let{bytesWritten:T}=await u.write(a,k,w-k,p+k);k+=T}p+=w}}finally{await u.close()}return o}finally{await r.close()}}
// PYt [14650,14966), UTF-16. Fixture substitutes the directory pin and platform boundaries.
const links = { linkedOutputs: new Map() }, j = new Set();
const Gn = () => links, O = () => 'posix', W = unlink;
let beforeDelete = async () => {};
async function C(file, options) {
  assert.deepEqual(options, { replaceLeaf: true, create: false });
  await N(file);
  return { ioPath: file, recheckBeforeWrite: beforeDelete, close: async () => {} };
}
async function PYt(e){let n=Gn().linkedOutputs.get(e);if(Gn().linkedOutputs.delete(e),n!==void 0)j.delete(n);if(O()==="windows"){await W(e);return}let i;try{i=await C(e,{replaceLeaf:!0,create:!1})}catch(s){if(E(s)==="ENOENT")return;throw s}try{await i.recheckBeforeWrite(),await W(i.ioPath)}finally{await i.close()}}

const fileSource = readFileSync(`${root}modules/chunk-f0442373.js`, 'utf8');
const fileDigest = createHash('sha256').update(fileSource).digest('hex');
assert.equal(fileDigest, 'ff76012ebdd7b6e01188c07575ffaab34311d83eeda08e3d47681da030c8a6e9');
assert.equal(manifest.modules.find(entry => entry.path === 'chunk-f0442373.js').decodedSha256, fileDigest);
assert.equal(jMn.toString(), fileSource.slice(18220, 18910));
assert.equal(IYt.toString(), fileSource.slice(19346, 19724));
assert.equal(PYt.toString(), fileSource.slice(14650, 14966));
const temp = await mkdtemp(join(process.env.TMPDIR, 'w385-copy-'));
try {
  const input = join(temp, 'task.output'), output = join(temp, 'result.txt');
  const deleted = join(temp, 'delete.output');
  await writeFile(deleted, 'task');
  links.linkedOutputs.set(deleted, 'linked'); j.add('linked');
  await PYt(deleted);
  await assert.rejects(N(deleted), { code: 'ENOENT' });
  assert.equal(links.linkedOutputs.has(deleted), false);
  assert.equal(j.has('linked'), false);
  await PYt(deleted);
  await writeFile(deleted, 'preserved');
  beforeDelete = async () => { throw new Error('recheck refused'); };
  await assert.rejects(PYt(deleted), /recheck refused/);
  assert.equal(await readFile(deleted, 'utf8'), 'preserved');
  beforeDelete = async () => {};
  const bytes = Buffer.from('A😀é\nZ');
  await writeFile(input, bytes);
  assert.equal(await IYt(input, output, bytes.length), bytes.length);
  assert.deepEqual(await readFile(output), bytes);
  assert.equal(await IYt(input, output, 4), bytes.length);
  assert.deepEqual(await readFile(input), bytes.subarray(0, 4));
  assert.deepEqual(await readFile(output), bytes.subarray(0, 4));
  const symbolic = join(temp, 'symbolic');
  await symlink(input, symbolic);
  await assert.rejects(IYt(symbolic, output, 10), /not a regular nlink-1 file/);
  const hard = join(temp, 'hard');
  await link(input, hard);
  await assert.rejects(IYt(input, output, 10), /not a regular nlink-1 file/);
  await rm(hard);
  await assert.rejects(IYt(input, join(temp, 'missing', 'result'), 10), { code: 'ENOENT' });
  const destinationLink = join(temp, 'destination-link');
  await symlink(output, destinationLink);
  await assert.rejects(IYt(input, destinationLink, 10), { code: 'ELOOP' });
  assert.deepEqual(await readFile(input), bytes.subarray(0, 4));
  await writeFile(input, bytes);
  await assert.rejects(IYt(input, join(temp, 'missing', 'result'), 4), { code: 'ENOENT' });
  assert.deepEqual(await readFile(input), bytes.subarray(0, 4));
  const cap = 67108864;
  const large = await X(input, 'w');
  try {
    await large.write(bytes, 0, bytes.length, 0);
    await large.truncate(cap + 1);
  } finally { await large.close(); }
  assert.equal(await IYt(input, output, cap), cap + 1);
  assert.equal((await stat(input)).size, cap);
  assert.equal((await stat(output)).size, cap);
  const copied = await X(output, 'r');
  try {
    const prefix = Buffer.alloc(bytes.length);
    assert.equal((await copied.read(prefix, 0, prefix.length, 0)).bytesRead, bytes.length);
    assert.deepEqual(prefix, bytes);
    const end = Buffer.alloc(1, 1);
    assert.equal((await copied.read(end, 0, 1, cap - 1)).bytesRead, 1);
    assert.equal(end[0], 0);
  } finally { await copied.close(); }
  console.log('source-bound copy fixture: bytes, 64 MiB cap, links and destination error passed');
} finally {
  await rm(temp, { recursive: true, force: true });
}
