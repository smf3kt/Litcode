// W78-01 record: permissive skill argument names and escaped expansion.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

function replaceOnce(path, from, to) {
  const text = read(path);
  if (text.split(from).length - 1 !== 1) throw new Error(`${path}: expected one occurrence of ${JSON.stringify(from)}`);
  write(path, text.replace(from, to));
}

function replaceAll(path, from, to, expected) {
  const text = read(path);
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} occurrences of ${JSON.stringify(from)}, found ${count}`);
  write(path, text.split(from).join(to));
}

const note = `# W78 — permissive argument names

## Source position

\`$oe(e)\` (chunk-sfn1dbxq.js, UTF-16 [435233,435431)) reads the frontmatter
\`arguments\` field:

- falsy input returns \`[]\`;
- an array keeps every string that is non-empty after trimming and is not
  all digits, silently dropping other values;
- a string splits on whitespace and applies the same filter;
- anything else returns \`[]\`.

The frontmatter schema accepts \`QP() = Ue([lOe(), A(o())])\` (a scalar union or
an array of strings, offset 423443), so the filter, not a name regex, defines
what a name may be. Duplicates are kept.

\`uHe\` (chunk-sfn1dbxq.js [435534,436487)) builds the replacement pattern with
names sorted longest first and each name escaped through \`gl\`
(chunk-ax7r0qj7.js [677,739)): \`value.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&")\`.
The per-name replacement uses the escaped name with \`(?!\\[\\w)\`, so a name may
contain regex metacharacters without changing the match.

## Port

\`argumentNamesFrom\` ports \`$oe\`; \`config.ts\` uses it for frontmatter names and
\`expandSkill\` filters its incoming names through it. \`escapeRegExp\` ports \`gl\`
and is applied to every name before the alternation is built. The first
occurrence of a duplicate name owns the position, matching the source's
longest-first replacement loop. The session skill schema accepts the same name
form (non-empty, not all digits) instead of the identifier regex.

## Adaptation

The product keeps its existing quote-aware tokenizer and single-pass combined
replacement; only name admission and pattern escaping change. The source's
sentinel handling for escaped dollars is already present in the product pattern
and is unchanged.

## Verification

\`config\`+\`session\` 70/70: \`argumentNamesFrom\` accepts dotted, plus, and non-ASCII
names and drops digits, empties, non-strings and non-list input; expansion
replaces all four permissive names in order; duplicate names use the first
position; the frontmatter test now accepts duplicates and permissive names and
drops an all-digit list, while the malformed-field loop no longer expects those
three headers to throw. tsc 0; build 0; full 2,105/2,105; chain 767/767;
notices 0; source index unchanged; identity \`1c2b556a…\`.
`;
write('research/ports/W78-argument-names.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W78-01 ports the recovered permissive skill argument names. \`argumentNamesFrom\`
follows \`$oe\`: any non-empty string that is not all digits, from a
whitespace-split string or an array, with duplicates kept; non-strings and other
shapes are dropped. \`expandSkill\` filters names through it and escapes every
name with the recovered \`gl\` before the replacement alternation, so dotted,
plus and non-ASCII names substitute correctly; the session schema accepts the
same form. \`config\`+\`session\` 70/70, tsc 0, full 2,105/2,105, chain 767/767,
identity \`1c2b556a…\`. [W78 record](ports/W78-argument-names.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W78-01 许可名/转义形式：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 $oe [435233,435431)、uHe [435534,436487) 与 QP 偏移 423443，以及 chunk-ax7r0qj7.js 的 gl [677,739)（UTF-16）。S-2（不臆造）：非空非纯数字字符串、字符串按空白切分、数组过滤、重复保留、最长优先且逐名 gl 转义后加 (?!\[\\w) 均按源；无效形状静默为空。S-3（边界）：保留产品既有引号分词与单遍替换；session schema 放宽为同一许可形式。S-4（可测）：新增 argumentNamesFrom 四例、四类许可名替换、重复名首位置，及 frontmatter 许可名/纯数字列表用例；畸形字段循环移除三项已按源接受的 header。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：config+session 70/70、tsc 0、build 0、全量 2,105/2,105、链 767/767、身份 1c2b556a…。
`);

replaceOnce('research/FEATURES.md',
  'permissive name/escape forms,source precedence,dynamic discovery and effect-journal crash recovery remain gaps',
  'W78 ports the recovered permissive argument-name filter ($oe: any non-empty, non-all-digit string; duplicates kept) and regex-escapes names in the expansion pattern (gl); source precedence, dynamic discovery and effect-journal crash recovery remain gaps');

replaceAll('research/CURRENT.md',
  '许可名/转义形式、来源优先级、动态发现、效果日志崩溃恢复；引用 URL 变化即丢弃、shell AST 遗留',
  'W78完成许可名/转义形式移植（$oe：非空非纯数字字符串，重复保留；gl 转义后进入替换正则）；来源优先级、动态发现、效果日志崩溃恢复；引用 URL 变化即丢弃、shell AST 遗留', 3);

const tsv = [
  ['2026-10-17T20:10:00Z', 'package', 'W78-01 许可名/转义形式',
    '$oe [435233,435431)、uHe [435534,436487)、QP 偏移 423443、gl [677,739)；argumentNamesFrom/escapeRegExp',
    '非空非纯数字、空白切分/数组过滤、重复保留、最长优先+逐名转义；静默丢弃无效形状',
    'config+session 70/70；tsc 0；build 0；全量 2,105/2,105；链 767/767'],
  ['2026-10-17T20:12:00Z', 'decision', 'W78-01 放宽名字并保留产品展开器',
    '① 名字过滤按 $oe 而非标识符正则；② 展开前 gl 转义；③ 重复名取首次位置；④ 保留既有引号分词与单遍替换',
    '残余：来源优先级、动态发现、效果日志崩溃恢复',
    '.audit/w78-01-full.txt'],
  ['2026-10-17T20:15:00Z', 'verification', 'W78-01 验收：config+session 70/70、tsc 0、build 0、2,105/2,105、767/767',
    '点号/加号/非 ASCII 名替换；重复名首位置；纯数字与空名丢弃；frontmatter 接受重复与许可名',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 1c2b556a…（inputs c02b333c…、validation 8b0656ce…、build 51087c21…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w78-runtime.tsv', tsv + '\n');

write('.audit/w78-runtime.todo.md', `# W78 runtime trail

## W78-01 acceptance (2026-10-17)

- [x] **Source read.** \`$oe\`, \`uHe\`, \`QP\` and \`gl\` measured in UTF-16 code
  units.
- [x] **Port.** Permissive name filter, longest-first escaped alternation, first
  duplicate position, session schema relaxation.
- [x] **Tests updated.** Three headers now parse permissively instead of
  throwing; new filter and expansion cases added.
- [x] **Gates.** config+session 70/70, tsc 0, build 0, full 2,105/2,105, chain
  767/767, notices 0, source index unchanged, identity \`1c2b556a…\`.
- [ ] Remaining C-10: source precedence, dynamic discovery, effect-journal crash
  recovery; shell AST stays not-ported.
`);

const evidence = {
  schema: 'W78ArgumentNamesEvidence.v1',
  package: 'W78-01 — permissive argument names',
  date: '2026-10-17',
  question: 'Does the product accept and expand skill argument names with the recovered $oe filter and gl escaping?',
  answer: 'Yes: argumentNamesFrom ports $oe (non-empty, non-all-digit strings from a whitespace-split string or array, duplicates kept) and expandSkill escapes every name with gl before building the alternation; the session schema accepts the same form.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    nameFilter: { symbol: '$oe', range: [435233, 435431] },
    expansion: { symbol: 'uHe', range: [435534, 436487] },
    frontmatterShape: { symbol: 'QP', position: 423443, form: 'scalar union or array of strings' },
    escape: { module: 'extracted-v2/modules/chunk-ax7r0qj7.js', symbol: 'gl', range: [677, 739] },
  },
  behavior: {
    valid: 'string, trimmed non-empty, not /^\\d+$/',
    string: 'split /\\s+/ then filter',
    array: 'filter valid strings, drop other values',
    other: 'empty list',
    duplicates: 'kept; first occurrence owns the position',
    pattern: 'longest-first, each name escaped, (?!\\[\\w) suffix',
  },
  changes: [
    { file: 'src/config.ts', change: 'argumentNamesFrom/escapeRegExp; permissive frontmatter and expansion', sha256: sha(read('src/config.ts')) },
    { file: 'src/session.ts', change: 'argumentNames schema relaxation', sha256: sha(read('src/session.ts')) },
    { file: 'test/config.test.ts', change: 'permissive name and expansion cases; malformed list update', sha256: sha(read('test/config.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-10 rows record permissive names', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Skills row records permissive names', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W78-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W78-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    configSession: '70/70',
    build: 'exit 0',
    full: '2,105/2,105',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '1c2b556af2908234ecca9c54f574c485b9148b1d69e453c8c5f515c015a97a74',
  },
  residuals: [
    'Source precedence, dynamic discovery and effect-journal crash recovery remain C-10 work.',
    'The recovered shell-AST splitter stays not-ported per ports/remaining-dispositions.md.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-10 continues with source precedence, dynamic discovery and effect-journal crash recovery.',
};
write('research/ports/W78-argument-names-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW78-01 ports the recovered permissive skill argument names',
  'research/coding-standard.md': '\n2026-10-17 W78-01 ',
  'research/FEATURES.md': 'W78 ports the recovered permissive argument-name filter',
  'research/ports/W78-argument-names.md': '# W78 — permissive argument names',
  '.audit/w78-runtime.todo.md': '\n## W78-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
