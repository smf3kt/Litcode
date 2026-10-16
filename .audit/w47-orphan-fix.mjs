// Clearing the TS2304 orphans left by the strip. Every one of these names belongs to a feature the
// shipped build no longer has, and each sits inside a `feature('X')` guard whose body is the
// feature's only home — so the edit is the guard block, not the name. Three shapes need something
// other than a block delete, and they are marked: a constant-folded condition keeps its value, and
// a React-compiler memo slot keeps its shape.
//
//   node .audit/w47-orphan-fix.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';

const HARNESS = '/tmp/cc-2188-src';
const APPLY = process.argv.includes('--apply');

// [file, from, to] — inclusive line ranges, verified by reading each boundary.
const ranges = [
  ['utils/analyzeContext.ts', 1119, 1125],
  ['commands/context/context-noninteractive.ts', 113, 145],
  ['components/ContextVisualization.tsx', 23, 65],
  ['components/Spinner.tsx', 222, 224],
  ['components/Spinner.tsx', 216, 220],
  ['utils/messages.ts', 4639, 4643],
  ['utils/messages.ts', 4143, 4150],
  ['utils/messages.ts', 2411, 2432],
  ['utils/messages.ts', 2351, 2361],
  ['components/Message.tsx', 249, 271],
  ['hooks/useReplBridge.tsx', 193, 197],
  ['memdir/findRelevantMemories.ts', 64, 70],
  ['screens/REPL.tsx', 4847, 4885],
  ['screens/REPL.tsx', 4845, 4845],
  ['screens/REPL.tsx', 2799, 2804],
  ['tools/AgentTool/builtInAgents.ts', 32, 41],
  ['tools/SendMessageTool/SendMessageTool.ts', 775, 795],
  ['utils/attribution.ts', 376, 388],
  ['utils/conversationRecovery.ts', 492, 505],
];

// A block whose tail is a value the function must still return: the range is replaced, not dropped.
const replacements = [
  ['utils/attachments.ts', 3968, 3978, '  return []'],
];

// Single-line edits. `false && <X />` already evaluates to `false`, and a memo slot that held a
// removed component holds `null` — both keep the expression's value exactly.
const lines = [
  ['components/LogoV2/LogoV2.tsx', 't21 = false && <GateOverridesWarning />;', 't21 = false;'],
  ['components/LogoV2/LogoV2.tsx', 't22 = false && <ExperimentEnrollmentNotice />;', 't22 = false;'],
  ['components/LogoV2/LogoV2.tsx', 't18 = false && <GateOverridesWarning />;', 't18 = false;'],
  ['components/LogoV2/LogoV2.tsx', 't19 = false && <ExperimentEnrollmentNotice />;', 't19 = false;'],
  ['components/LogoV2/LogoV2.tsx', 't39 = false && <GateOverridesWarning />;', 't39 = false;'],
  ['components/LogoV2/LogoV2.tsx', 't40 = false && <ExperimentEnrollmentNotice />;', 't40 = false;'],
  ['components/Settings/Settings.tsx', 't7 = false ? [<Tab key="gates" title="Gates"><Gates onOwnsEscChange={setGatesOwnsEsc} contentHeight={contentHeight} /></Tab>] : [];', 't7 = [];'],
  ['components/PromptInput/PromptInputFooterLeftSide.tsx', `...("external" === 'ant' && hasTmuxSession ? [<TungstenPill key="tmux" selected={tmuxSelected} />] : []), `, ''],
  ['components/messages/UserTextMessage.tsx', 't2 = <UserGitHubWebhookMessage addMargin={addMargin} param={param} />;', 't2 = null;'],
  ['components/messages/UserTextMessage.tsx', 't2 = <UserForkBoilerplateMessage addMargin={addMargin} param={param} />;', 't2 = null;'],
];

const byFile = new Map();
const push = (file, op) => {
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push(op);
};
// Descending per file: a deletion at the end cannot move an earlier line number.
for (const [file, from, to] of ranges.sort((a, b) => a[0].localeCompare(b[0]) || b[1] - a[1])) {
  push(file, { kind: 'range', from, to });
}
for (const [file, from, to, text] of replacements) push(file, { kind: 'range', from, to, text });
for (const [file, find, replace] of lines) push(file, { kind: 'line', find, replace });

const report = [];
for (const [file, ops] of byFile) {
  const full = path.join(HARNESS, file);
  const original = fs.readFileSync(full, 'utf8');
  let out = original;
  let failed = 0;
  for (const op of ops) {
    if (op.kind === 'range') {
      const lines_ = out.split('\n');
      const head = lines_.slice(0, op.from - 1);
      const tail = lines_.slice(op.to);
      const kept = op.text === undefined ? [] : [op.text];
      out = [...head, ...kept, ...tail].join('\n');
      report.push({ file, op: `range ${op.from}-${op.to}`, ok: true });
    } else {
      const at = out.indexOf(op.find);
      if (at < 0 || out.indexOf(op.find, at + 1) >= 0) {
        failed += 1;
        report.push({ file, op: 'line', ok: false, find: op.find.slice(0, 60) });
        continue;
      }
      out = out.slice(0, at) + op.replace + out.slice(at + op.find.length);
      report.push({ file, op: 'line', ok: true });
    }
  }
  if (failed > 0) {
    console.log(`SKIP ${file}: ${failed} anchor(s) not unique`);
    continue;
  }
  if (APPLY) {
    if (!fs.existsSync(full + '.w47o3bak')) fs.writeFileSync(full + '.w47o3bak', original);
    fs.writeFileSync(full, out);
  }
}

const ok = report.filter((r) => r.ok).length;
console.log(`edits ${ok}/${report.length} in ${byFile.size} files`);
for (const r of report.filter((x) => !x.ok)) console.log(`  MISS ${r.file}: ${r.find}`);
if (APPLY) {
  fs.writeFileSync('.audit/w47-orphan-fix.json', JSON.stringify({ report }, null, 1) + '\n');
  console.log('applied (originals kept as .w47o3bak)');
}
