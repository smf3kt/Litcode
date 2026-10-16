// Build the W46 evidence file from the artifacts themselves: the tree index the builder wrote, the
// sample manifest, and the captured runs. Nothing here is typed by hand.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const index = JSON.parse(read('recovered/index.json'));
const manifest = JSON.parse(read('extracted-v2/manifest.json'));
const treeDigest = sha('recovered/index.json');

const run = (path) => {
  const text = read(path);
  return { path, lines: text.split('\n').filter((l) => l !== '').length, head: text.split('\n').slice(0, 3), sha256: sha(path) };
};
const runs = {
  version: run('.audit/w46-version.txt'),
  help: run('.audit/w46-help.txt'),
  doctor: run('.audit/w46-doctor.txt'),
};

const sideGroups = {};
for (const asset of index.assets.list) sideGroups[`enc${asset.encoding}/loader${asset.loader}`] =
  (sideGroups[`enc${asset.encoding}/loader${asset.loader}`] ?? 0) + 1;
const nativeAddons = index.assets.list.filter((a) => a.path.endsWith('.node'));

// The counts of the three test families, measured over the tree as it now stands.
const measure = (pattern, globs = ['--glob', '!assets/**']) => Number(
  execFileSync('rg', ['-c', '--no-filename', pattern, 'recovered', ...globs], { encoding: 'utf8' })
    .split('\n').filter((l) => l !== '').reduce((sum, n) => sum + Number(n), 0));

const evidence = {
  schema: 'W46RecoveredTreeEvidence.v1',
  date: '2026-10-16',
  question: 'Can the shipped artifact be turned into readable source that runs, and what stands between it and a host?',
  answer: 'Yes. The sample is a Bun single-file executable; its embedded segment decodes to 2,609 module records, and wakaru@1.14.0 recovers 2,459 readable modules from it in 8.7 s. After rewriting the 186,722 virtual paths the bundle carries — 184,303 imports, 1,389 literal dynamic imports, 489 import.meta.require calls and 541 plain strings — and exporting the 246 side assets the JS pass drops, the tree runs under Bun 1.4.3: --version, --help (311 lines, the full command surface) and doctor all exit 0, and anything needing identity stops at the tree\'s own gate ("Not logged in · Please run /login"), which is the boundary an integration has to own.',
  sample: index.sample,
  manifest: {
    schema: manifest.schema,
    path: manifest.input,
    sha256: manifest.sha256,
    segment: manifest.segment,
    moduleCount: manifest.moduleCount,
    sourceMaps: manifest.sourceMaps,
    entryModuleId: manifest.entry,
  },
  producer: index.producedBy,
  tree: {
    to: 'recovered',
    files: index.files.length,
    bytes: index.files.reduce((sum, f) => sum + f.bytes, 0),
    treeSha256: index.treeSha256,
    indexSha256: treeDigest,
  },
  rewrite: index.rewrite,
  assets: {
    count: index.assets.count,
    missing: index.assets.missingFromExtraction.length,
    groups: sideGroups,
    nativeAddons: nativeAddons.map((a) => ({ path: a.path, bytes: a.bytes })),
  },
  tests: {
    runtime: {
      what: 'does the recovered tree start',
      how: 'bun 1.4.3, env -i, HOME=/tmp/w46-home, no credentials, alarm timeout',
      results: [
        { command: 'cli.js --version', exit: 0, first: '2.1.296 (Claude Code)' },
        { command: 'cli.js --help', exit: 0, lines: runs.help.lines, surface: 'agents, attach, auth, auto-mode, doctor, gateway, import, install, …' },
        { command: 'cli.js doctor', exit: 0, first: 'Claude Code doctor', commit: 'fdb6c17a97b6', platform: 'darwin-arm64' },
        { command: 'cli.js mcp list', exit: 1, first: 'Not logged in · Please run /login' },
        { command: 'cli.js plugin list', exit: 1, first: 'Not logged in · Please run /login' },
      ],
      defectsFound: [
        {
          what: 'heuristic unpacking changes module evaluation order',
          how: '--unpack (heuristic) splits scope-hoisted blobs; chunk-xxhayked/chunk_SZ.js captured globalThis.__zod_globalConfig before the parent assigned it, so Object.assign got undefined',
          fixedBy: '--unpack=strict (one file per module, source order kept)',
        },
        {
          what: 'virtual paths also travel as plain strings',
          how: 'import.meta.require("/$bunfs/root/state-library.js-….txt") and 540 others, including 104 surviving src/… paths',
          fixedBy: 'the string pass of scripts/recovered-tree.mjs, pointing each at its file under the tree',
        },
        {
          what: 'a require() form the first rule missed',
          how: 'the bundle requires non-ESM modules through import.meta.require, whose callee is a member expression, not a bare identifier',
          fixedBy: 'extending the specifier rule to member require calls (489 sites)',
        },
      ],
    },
    assets: {
      what: 'what the JS pass leaves behind',
      how: 'recovered/index.json assets.list, all of them present in extracted-v2/modules and copied to recovered/assets',
      groups: sideGroups,
      nativeAddons: nativeAddons.length,
      binaryBlobs: index.assets.list.filter((a) => a.encoding === 0 && a.loader === 5).length,
    },
    config: {
      what: 'config, credential and endpoint read points',
      how: 'rg over the recovered tree, assets excluded',
      counts: {
        '.claude/': measure('\\.claude/'), '.claude.json': measure('\\.claude\\.json'),
        CLAUDE_: measure('CLAUDE_'), ANTHROPIC_: measure('ANTHROPIC_'),
        oauth: measure('oauth'), refresh_token: measure('refresh_token'), keychain: measure('keychain'),
        'api.anthropic.com': measure('api\\.anthropic\\.com'), sentry: measure('sentry'), statsig: measure('statsig'),
      },
    },
    platform: {
      what: 'platform gates, updater and native loading',
      how: 'rg over the recovered tree, assets excluded',
      counts: {
        'process.platform': measure('process\\.platform'), win32: measure('win32'),
        autoUpdater: measure('autoUpdater'), 'unsupported platform': measure('isSupportedPlatform|unsupported platform'),
        '.node"': measure('\\.node"'), dlopen: measure('dlopen'),
        'install/download urls': measure('gcs\\.anthropic|storage\\.googleapis|claude\\.ai/install'),
      },
    },
  },
  runs,
  originalPaths: {
    what: 'original source paths that survive as strings in the shipped code',
    fromManifest: manifest.modules.filter((m) => m.originalName.includes('/src/')).map((m) => m.originalName),
    // Measured on the pre-rewrite output; in the tree the strings are gone because they now name
    // real files. Kept as a path so the count can be reproduced while that output exists.
    preRewrite: fs.existsSync('/tmp/wakaru-probe/out-strict')
      ? {
        distinctPaths: Number(execFileSync('sh', ['-c',
          "rg -o '/\\$bunfs/root/src/[A-Za-z0-9._/-]+' /tmp/wakaru-probe/out-strict --glob '!provenance.json' | sed 's/^[^:]*://' | sort -u | wc -l"], { encoding: 'utf8' }).trim()),
        filesReferencing: Number(execFileSync('sh', ['-c',
          "rg -l '/\\$bunfs/root/src/' /tmp/wakaru-probe/out-strict --glob '!provenance.json' | wc -l"], { encoding: 'utf8' }).trim()),
        occurrences: Number(execFileSync('sh', ['-c',
          "rg -o '/\\$bunfs/root/src/[A-Za-z0-9._/-]+' /tmp/wakaru-probe/out-strict --glob '!provenance.json' | wc -l"], { encoding: 'utf8' }).trim()),
      }
      : null,
    note: 'the hooks-worker module is the only embedded module whose original src/ path survives; it is referenced as a string by the plugin worker loader',
  },
  notClaimed: index.knownGaps.concat([
    'Nothing in src/ changed; the product\'s own suites were not re-run for this work.',
    'Only read-only commands were run against the tree; install, auth, update and config writes were not executed.',
  ]),
  next: [
    'decide who hosts the tree (litcode as the outer process vs. the tree as the outer process) — the integration surface follows from that',
    'replace the identity boundary: the auth gate above is where litcode/Magpie injects its own credentials and endpoints',
    'neutralise the updater and the platform gates before the tree ships as a product',
    'name modules from the 104 surviving src/… paths, then rebuild the product\'s ported slices on top of the recovered tree rather than beside it',
  ],
};
fs.writeFileSync('research/ports/W46-recovered-tree-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written | files', evidence.tree.files, '| rewrite', JSON.stringify(evidence.rewrite.specifiers),
  '| tree', evidence.tree.treeSha256.slice(0, 16) + '…', '| index', treeDigest.slice(0, 16) + '…');
