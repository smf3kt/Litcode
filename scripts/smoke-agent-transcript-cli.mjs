import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'agent-transcript-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-parent', thinking: false,
  prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled',
  ...(process.argv.includes('--directory-history-disabled') ? { features: { checkpoints: false } } : {}) }));
fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'OWNED_TRANSCRIPT_FILE');
const pty = path.join(temporary, 'pty.exp');
const pidFile = path.join(temporary, 'cli.pid');
const bridge = fs.readFileSync(path.join(root, 'scripts/pty-cli.exp'), 'utf8');
fs.writeFileSync(pty, `set stty_init "rows 40 columns 120"\n` + bridge.replace('spawn -noecho {*}$argv',
  `spawn -noecho {*}$argv\nset pidfile [open {${pidFile}} w]\nputs $pidfile [exp_pid]\nclose $pidfile`));
const requests = [], held = new Map();
const directorySymlink = process.argv.includes('--directory-symlink');
const directorySwitch = process.argv.includes('--directory-switch');
const directoryRewindStale = process.argv.includes('--directory-rewind-stale');
const directoryRewindPermission = process.argv.includes('--directory-rewind-permission');
const directoryRewindRollback = process.argv.includes('--directory-rewind-rollback');
const directoryRewindReleaseError = process.argv.includes('--directory-rewind-release-error');
const directoryRewindBindFatal = process.argv.includes('--directory-rewind-bind-fatal');
const directoryRewindBindError = process.argv.includes('--directory-rewind-bind-error') || directoryRewindBindFatal;
const directoryRewindAcceptError = process.argv.includes('--directory-rewind-accept-error');
const directoryBranchHistory = process.argv.find(arg => arg.startsWith('--directory-branch-history='))?.split('=')[1];
if (directoryBranchHistory) assert.ok(['config', 'reload', 'rewind'].includes(directoryBranchHistory));
assert.ok([directoryRewindStale, directoryRewindPermission, directoryRewindRollback, directoryRewindReleaseError, directoryRewindBindError, directoryRewindAcceptError].filter(Boolean).length <= 1);
const directoryRewindAuthority = process.argv.includes('--directory-rewind-authority') || directoryRewindStale || directoryRewindPermission || directoryRewindRollback || directoryRewindReleaseError || directoryRewindBindError || directoryRewindAcceptError;
const holdThroughCancel = process.argv.includes('--directory-switch-hold-through-cancel');
if (holdThroughCancel) assert.ok(directorySwitch);
const directoryRule = process.argv.find(arg => arg.startsWith('--directory-rule='))?.split('=')[1];
if (directoryRule) assert.ok(directorySymlink && ['deny', 'ask'].includes(directoryRule));
const directoryReplacement = process.argv.includes('--directory-replacement') || directorySymlink;
const directoryRecovery = process.argv.includes('--directory-recovery');
const directoryHistoryDisabled = process.argv.includes('--directory-history-disabled');
const directoryCheckpointCrash = process.argv.includes('--directory-checkpoint-crash');
const directoryWitnessPost = process.argv.includes('--directory-witness-torn-post');
const directoryWitnessRepeated = process.argv.includes('--directory-witness-torn-repeated') || directoryWitnessPost;
const directoryWitnessDirect = process.argv.includes('--directory-witness-torn-direct') || directoryWitnessRepeated;
const directoryWitnessInvalid = process.argv.includes('--directory-witness-torn-invalid');
const directoryWitnessTorn = process.argv.includes('--directory-witness-torn') || directoryWitnessDirect || directoryWitnessInvalid;
const directoryInheritanceError = process.argv.includes('--directory-inheritance-error') || directoryWitnessTorn;
const directoryMarkerConflict = process.argv.includes('--directory-marker-conflict');
const directoryMarkerError = process.argv.includes('--directory-marker-error') || directoryMarkerConflict;
assert.ok([directoryCheckpointCrash, directoryInheritanceError, directoryMarkerError].filter(Boolean).length <= 1);
const directorySelection = process.argv.includes('--directory-selection') || directoryCheckpointCrash || directoryInheritanceError || directoryMarkerError;
const directoryRetainedPublication = process.argv.includes('--directory-retained-publication');
const directoryCheckpointBracket = process.argv.includes('--directory-checkpoint-bracket');
const directoryBackup = process.argv.includes('--directory-backup') || directoryRecovery || directoryHistoryDisabled || directorySelection || directoryRetainedPublication;
const directoryEditBackup = process.argv.includes('--directory-edit-backup');
const notebookPublication = process.argv.includes('--directory-notebook-publication');
const directoryEditTool = directoryEditBackup || process.argv.includes('--directory-edit') ? 'edit_file'
  : notebookPublication || process.argv.includes('--directory-notebook-edit') ? 'notebook_edit' : undefined;
const directoryMixedCleanupCrash = process.argv.includes('--directory-mixed-cleanup-crash');
const linkedError = process.argv.find(arg => arg.startsWith('--directory-linked-error='))?.split('=')[1];
if (linkedError) assert.ok(['complete', 'partial'].includes(linkedError));
const directoryLinkedPreparation = process.argv.includes('--directory-linked-preparation') || !!linkedError;
const directoryEarlyTorn = process.argv.includes('--directory-early-torn');
const directoryEarlyPreparation = process.argv.includes('--directory-early-preparation') || directoryEarlyTorn;
const linkedPreparationPoints = linkedError ? ['replace_before_quarantine', 'replace_quarantine', 'replace_writing', 'replace_before_intent', 'replace_after_recheck'] :
  ['replace_after_recheck', 'replace_after_recheck', 'replace_before_quarantine', 'replace_quarantine', 'replace_staging', 'replace_writing', 'replace_before_intent',
  ...Array.from({ length: 13 }, (_, field) => `receipt-partial:${field}`)];
const linkedFaultPoints = linkedError ? [...linkedPreparationPoints, linkedError === 'complete' ? 'replace_after_publish' : 'replace_after_capture'] : linkedPreparationPoints;
const directoryMixedReceipt = process.argv.find(arg => arg.startsWith('--directory-mixed-receipt='))?.split('=')[1];
const directoryPublishedError = process.argv.find(arg => arg.startsWith('--directory-published-error='))?.split('=')[1];
if (directoryPublishedError) assert.ok(['complete', 'partial'].includes(directoryPublishedError) && directoryMixedReceipt?.endsWith('-native'));
const directoryCapturedError = process.argv.find(arg => arg.startsWith('--directory-captured-error='))?.split('=')[1];
if (directoryCapturedError) assert.ok(['complete', 'partial'].includes(directoryCapturedError) && directoryMixedReceipt?.endsWith('-captured'));
const directoryUntouchedError = process.argv.find(arg => arg.startsWith('--directory-untouched-error='))?.split('=')[1];
if (directoryUntouchedError) assert.ok(['complete', 'partial'].includes(directoryUntouchedError) && directoryMixedReceipt?.endsWith('-untouched'));
const directoryCreateCut = process.argv.find(arg => arg.startsWith('--directory-create-cut='))?.split('=')[1];
const zeroPublished = directoryCreateCut === 'zero:create_after_publish';
const directoryRetainedCreate = process.argv.includes('--directory-retained-create') || !!directoryCreateCut;
const mixedRemove = process.argv.includes('--directory-mixed-remove');
const mixedMarkerCrash = process.argv.includes('--directory-mixed-marker-crash');
if (directoryLinkedPreparation) assert.ok(directoryMixedReceipt?.endsWith('-linked') && !directoryMixedCleanupCrash);
if (directoryEarlyPreparation) assert.ok(directoryMixedReceipt?.endsWith('-untouched') && !directoryMixedCleanupCrash);
if (directoryMixedReceipt) assert.ok(['forward', 'reverse', 'forward-native', 'reverse-native', 'forward-captured', 'reverse-captured', 'forward-untouched', 'reverse-untouched', 'forward-linked', 'reverse-linked'].includes(directoryMixedReceipt));
const directoryMixedColdCompensate = process.argv.includes('--directory-mixed-cold-compensate');
const directoryMixedColdRollback = process.argv.includes('--directory-mixed-cold-rollback') || directoryMixedCleanupCrash || directoryMixedColdCompensate || !!directoryMixedReceipt;
const directoryMixedRollback = process.argv.includes('--directory-mixed-rollback') || directoryMixedColdRollback;
const successorInheritanceCrash = process.argv.includes('--directory-successor-inheritance-crash');
const directoryMixedSuccessor = process.argv.includes('--directory-mixed-successor') || successorInheritanceCrash || mixedMarkerCrash;
const directoryMixedCold = process.argv.includes('--directory-mixed-cold') || directoryMixedColdRollback || directoryMixedSuccessor;
const directoryMixedRewind = process.argv.includes('--directory-mixed-rewind') || directoryMixedRollback || directoryMixedCold;
const directoryWrite = process.argv.includes('--directory-write') || directoryBackup || directoryMixedRewind;
const panelPriorError = process.argv.includes('--permission-panel-prior-error');
const directoryGrant = panelPriorError || process.argv.includes('--directory-grant') || directoryReplacement || directorySwitch || directoryWrite || directoryRewindAuthority || directoryCheckpointBracket || !!directoryEditTool || !!directoryBranchHistory;
const outside = path.join(temporary, 'outside');
const directorySecret = 'OWNED_DIRECTORY_GRANT_SECRET';
const directoryBackupBytes = directoryRetainedPublication ? Buffer.from('original text\n第二行\n') : Buffer.from([0, 255, 65, 10, 66, 128]);
const directorySnapshotBytes = Buffer.from([4, 5, 0, 255, 90]);
const directoryEditFile = directoryEditTool === 'notebook_edit' ? 'value.ipynb' : 'value.txt';
const directoryEditSource = directoryEditTool === 'notebook_edit'
  ? JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: {}, cells: [{ id: 'fixture', cell_type: 'code', metadata: {},
    execution_count: null, outputs: [], source: directorySecret }] }) : directorySecret;
if (directoryGrant) {
  if (directorySymlink) {
    fs.mkdirSync(`${outside}-target-a`);
    fs.writeFileSync(path.join(`${outside}-target-a`, 'value.txt'), directorySecret);
    fs.symlinkSync(`${outside}-target-a`, outside);
  } else { fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'value.txt'), directoryBackup ? directoryBackupBytes : directorySecret + (directorySwitch ? 'x'.repeat(8 * 1024 * 1024) : '')); }
}
if (directoryBackup || directoryCheckpointBracket) fs.chmodSync(path.join(outside, 'value.txt'), 0o751);
if (directoryEditTool) {
  fs.writeFileSync(path.join(outside, directoryEditFile), directoryEditBackup ? directoryEditBytes() : directoryEditSource);
  fs.writeFileSync(path.join(workspace, directoryEditFile), directoryEditSource);
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-parent', thinking: false,
    prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled', permissions: { allow: [directoryEditTool, 'read_file', 'notebook_read'] } }));
}
function directoryEditBytes() {
  return Buffer.from('\uFEFFfirst\r\nsecond\r\nfirst\r\nsecond', 'utf16le');
}
if (directoryRule) fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-parent', thinking: false,
  prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled', permissions: { [directoryRule]: ['read_file'] } }));
if (directoryWrite) fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-parent', thinking: false,
  prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled', permissions: { allow: directoryWitnessTorn || directoryRetainedPublication ? ['write_file', 'read_file'] : ['write_file'] },
  ...(directoryHistoryDisabled ? { features: { checkpoints: false } } : {}) }));
const postHookCrash = process.argv.includes('--post-hook-crash');
const postHook = process.argv.includes('--post-hook') || postHookCrash;
const conditionalRead = process.argv.includes('--conditional-read');
const multiRead = process.argv.includes('--multi-read') || postHook || conditionalRead;
if (postHook) fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-parent', thinking: false,
  prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled', hooks: { PostToolUse: [{ command:
    `printf '%s' '${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', updatedToolOutput: 'CLI_REWRITTEN\nSECOND\nTHIRD', additionalContext: 'CLI_HOOK_CONTEXT' } })}'` }] } }));
if (multiRead) fs.writeFileSync(path.join(workspace, 'second.txt'), 'SECOND_READ_CONTENT');
if (conditionalRead) {
  fs.mkdirSync(path.join(workspace, '.git'));
  fs.mkdirSync(path.join(workspace, '.harness/rules'), { recursive: true });
  fs.mkdirSync(path.join(workspace, 'src'));
  fs.writeFileSync(path.join(workspace, 'src/a.ts'), 'CONDITIONAL_FIRST_CONTENT');
  fs.writeFileSync(path.join(workspace, '.harness/rules/source.md'), '---\npaths: [src/**]\n---\nCONDITIONAL_SOURCE_RULE\n');
  fs.writeFileSync(path.join(workspace, '.harness/rules/test.md'), '---\npaths: [test/**]\n---\nCONDITIONAL_TEST_RULE\n');
}
const coldReplacement = process.argv.includes('--cold-replacement');
const legacyIdentity = process.argv.includes('--legacy-identity');
if (legacyIdentity) assert.ok(coldReplacement);
if (coldReplacement) fs.utimesSync(path.join(workspace, 'fixture.txt'), 1700000000, 1700000000);
const lexicalMutation = process.argv.find(arg => arg.startsWith('--lexical-mutation='))?.split('=')[1];
const legacyKey = process.argv.includes('--legacy-key');
if (lexicalMutation) {
  assert.ok(['write_file', 'edit_file'].includes(lexicalMutation));
  fs.mkdirSync(path.join(workspace, 'actual'));
  fs.writeFileSync(path.join(workspace, 'actual/file.txt'), 'OWNED_FILE');
  fs.symlinkSync('actual', path.join(workspace, 'alias'));
}
const coldHistory = process.argv.includes('--cold-history');
const crashIntent = process.argv.find(arg => arg.startsWith('--crash-intent='))?.split('=')[1];
if (crashIntent) assert.ok(coldHistory && ['valid', 'corrupt', 'unauthorized', 'torn'].includes(crashIntent));
const coldSkill = process.argv.includes('--cold-skill');
const coldWriteRedirect = process.argv.includes('--cold-write-redirect');
if (coldWriteRedirect) assert.ok(coldSkill && !process.argv.includes('--cold-skill-plan'));
const switchOrder = process.argv.find(arg => arg.startsWith('--resume-race='))?.split('=')[1];
if (switchOrder) assert.ok(['during', 'before'].includes(switchOrder));
const switchRace = process.argv.includes('--switch-race') || !!switchOrder;
const coldApproval = process.argv.find(arg => arg.startsWith('--cold-approval='))?.split('=')[1];
const coldPlan = process.argv.includes('--cold-skill-plan');
const coldExternalOverwrite = process.argv.includes('--cold-external-overwrite');
const coldExternalWrite = process.argv.includes('--cold-external-write') || coldExternalOverwrite;
const coldOriginal = Buffer.from('\uFEFFCHILD_ORIGINAL\r\n第二行\r\n');
const coldEffectFile = path.join(coldExternalWrite ? outside : workspace, 'cold-effect.txt');
if (coldExternalWrite) {
  assert.ok(coldSkill && !coldPlan && !coldWriteRedirect && (!coldApproval || coldApproval === 'allow'));
  fs.mkdirSync(outside);
  if (coldExternalOverwrite) fs.writeFileSync(coldEffectFile, coldOriginal, { mode: 0o751 });
}
const planAuto = process.argv.includes('--plan-auto');
if (coldPlan) {
  assert.ok(coldSkill && ['allow', 'deny', 'interrupt'].includes(coldApproval));
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-parent', thinking: false,
    prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled', plansDirectory: 'plans',
    ...(planAuto ? {} : { permissions: { ask: ['write_file'] } }) }));
}
if (coldApproval) assert.ok(coldSkill && ['allow', 'deny', 'interrupt', 'terminate', 'switch-probe'].includes(coldApproval));
if (coldSkill || switchRace) {
  fs.mkdirSync(path.join(workspace, '.harness/skills/fixture'), { recursive: true });
  fs.mkdirSync(path.join(workspace, '.harness/agents'), { recursive: true });
  fs.writeFileSync(path.join(workspace, '.harness/skills/fixture/SKILL.md'), '---\nname: fixture\ndescription: Fixture\ncontext: fork\nbackground: true\nagent: fixture-child\nallowed-tools: [read_file, write_file]\n---\nAGENT_VIEW_FIRST\n');
  fs.writeFileSync(path.join(workspace, '.harness/agents/fixture-child.md'), '---\nname: fixture-child\ndescription: Fixture child\nmodel: fixture-child\nmode: general\ntools: [read_file, write_file]\n---\nFixture child\n');
}
if (switchRace) {
  fs.mkdirSync(path.join(workspace, '.harness/skills/startup'), { recursive: true });
  fs.writeFileSync(path.join(workspace, '.harness/skills/startup/SKILL.md'), '---\nname: startup\ndescription: Fixture\nshell: /bin/bash\n---\n!`echo $$ > sibling-pid; touch sibling-started; while ! test -f sibling-release; do sleep 0.05; done; touch sibling-finished` !`touch denied-effect`\n');
  const marker = path.join(workspace, 'switch-entered');
  const release = path.join(workspace, 'switch-release');
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-parent', thinking: false,
    prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled',
    permissions: { ask: ['Bash(*)', 'write_file'] }, hooks: { SessionEnd: [{ command:
      `touch '${marker}'; while ! test -f '${release}'; do sleep 0.02; done`, timeout: 15 }] } }));
}
const mutationGates = process.argv.includes('--mutation-gates');
const startupProbe = process.argv.find(arg => arg.startsWith('--startup-home='))?.split('=')[1];
if (startupProbe) {
  assert.ok(['replace', 'link', 'cancel', 'concurrent', 'concurrent-close'].includes(startupProbe));
  fs.mkdirSync(path.join(workspace, '.harness/skills/startup'), { recursive: true });
  fs.writeFileSync(path.join(workspace, '.harness/skills/startup/SKILL.md'), `---\nname: startup\ndescription: Local startup fixture\nshell: /bin/bash\n---\n${startupProbe.startsWith('concurrent') ? '!`touch sibling-started; while ! test -f sibling-release; do sleep 0.05; done; touch sibling-finished` !`touch denied-effect`' : '!`X=old; X=new export Y; printf "$HOME" > startup-result` !`true`'}\n`);
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-parent', thinking: false,
    prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled', permissions: { ask: ['Bash(*)'] } }));
}
const screen = new TerminalScreen(120, 40);
let child, exited, server, planTarget;
const frame = () => screen.lines().map(line => line.trimEnd()).join('\n');
const send = value => child.stdin.write(value);
const ready = () => frame().includes('· ready') && !frame().includes('Prompt') && !frame().split('\n').includes('Background');
const until = async (check, label, timeout = 7000) => {
  const end = Date.now() + timeout;
  while (!check()) { assert.ok(Date.now() < end, `${label}\n${frame()}`);
    assert.ok(child.exitCode === null && child.signalCode === null, `${label}\n${frame()}`); await delay(30); }
};
function respond(res, body, block, index) {
  const events = [
    { type: 'message_start', message: { id: `transcript-${index}`, type: 'message', role: 'assistant', model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: block.type === 'text' ? { type: 'text', text: '' } : { ...block, input: {} } },
    { type: 'content_block_delta', index: 0, delta: block.type === 'text' ? { type: 'text_delta', text: block.text }
      : { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: block.type === 'text' ? 'end_turn' : 'tool_use', stop_sequence: null }, usage: { output_tokens: 25 } },
    { type: 'message_stop' },
  ];
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
}
run: try {
  server = http.createServer((req, res) => {
    const chunks = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const index = requests.length, latest = body.messages.at(-1)?.content;
      if (directoryGrant) {
        const directoryIndex = index - (directorySelection || directoryRetainedPublication ? 1 : 0);
        if (directoryRetainedPublication && index === 1) {
          respond(res, body, { type: 'tool_use', id: 'read-before-write', name: 'read_file', input: { path: path.join(outside, 'value.txt') } }, index);
          return;
        }
        if (directoryWitnessTorn && (latest === 'read after recovered rewind' ||
            (Array.isArray(latest) && latest.some(block => block.type === 'text' && block.text === 'read after recovered rewind')))) {
          respond(res, body, { type: 'tool_use', id: 'after-torn-read', name: 'read_file', input: { path: path.join(outside, 'after.txt') } }, index);
        } else if (directoryWitnessTorn && Array.isArray(latest) && latest.some(block => block.type === 'tool_result' && block.tool_use_id === 'after-torn-read')) {
          const result = latest.find(block => block.type === 'tool_result' && block.tool_use_id === 'after-torn-read');
          assert.notEqual(result.is_error, true, JSON.stringify(result)); assert.match(JSON.stringify(result.content), /DIRECTORY_AFTER_RECOVERY/);
          respond(res, body, { type: 'text', text: 'TORN_RECOVERY_READ_COMPLETE' }, index);
        } else if (directoryEditTool && index === 1) {
          respond(res, body, { type: 'tool_use', id: 'workspace-edit-read', name: directoryEditTool === 'notebook_edit' ? 'notebook_read' : 'read_file', input: { path: directoryEditFile } }, index);
        } else if (directoryEditTool && index <= 3) {
          if (index === 2 && !directoryEditBackup && !notebookPublication) {
            fs.renameSync(outside, `${outside}-original`); fs.mkdirSync(outside);
            fs.writeFileSync(path.join(outside, directoryEditFile), directoryEditSource);
          }
          respond(res, body, { type: 'tool_use', id: index === 2 ? 'external-edit' : 'workspace-edit', name: directoryEditTool,
            input: { path: index === 2 ? path.join(outside, directoryEditFile) : directoryEditFile,
              ...(directoryEditTool === 'edit_file' ? { old_string: directorySecret, new_string: 'CLI_EDIT_MARKER' }
                : { cell_id: 'fixture', new_source: 'CLI_EDIT_MARKER' }) } }, index);
        } else if ((directoryEditBackup && index === 4) || (notebookPublication && index === 5)) {
          respond(res, body, {type:'tool_use', id:'external-edit-read', name:notebookPublication ? 'notebook_read' : 'read_file', input:{path:path.join(outside,directoryEditFile)}}, index);
        } else if (notebookPublication && index === 6) {
          respond(res, body, {type:'tool_use', id:'external-insert', name:'notebook_edit', input:{path:path.join(outside,directoryEditFile),
            cell_id:'fixture', cell_type:'markdown', edit_mode:'insert', new_source:'inserted text'}}, index);
        } else if (notebookPublication && (index === 7 || index === 8)) {
          const target = path.join(outside,directoryEditFile);
          const nb = JSON.parse(fs.readFileSync(target,'utf8'));
          assert.equal(nb.cells[1].source,index === 7 ? 'inserted text' : 'edited text');
          const replace = index === 7;
          respond(res,body,{type:'tool_use',id:replace ? 'external-replace' : 'external-delete',name:'notebook_edit',input:{
            path:target,cell_id:replace ? nb.cells[1].id : 'fixture',edit_mode:replace ? 'replace' : 'delete',
            new_source:replace ? 'edited text' : ''}},index);
        } else if (directoryEditBackup && (index === 5 || index === 7)) {
          respond(res, body, {type:'tool_use', id:index === 5 ? 'external-edit-ambiguous' : 'external-edit-all', name:'edit_file', input:{
            path:path.join(outside,directoryEditFile), old_string:'first\nsecond', new_string:'updated', replace_all:index === 7}}, index);
        } else if (directorySelection && index === 1) respond(res, body, { type: 'text', text: 'DIRECTORY_SELECTION_READY' }, index);
        else if (directoryWrite && directoryIndex <= 2) respond(res, body, { type: 'tool_use', id: directoryIndex === 1 ? 'external-write' : 'workspace-write', name: 'write_file', input: { path: directoryIndex === 1 ? path.join(outside, directoryBackup ? 'value.txt' : 'written.txt') : 'written.txt', content: 'CLI_WRITE_MARKER', ...(directoryBackup && directoryIndex === 1 ? { overwrite: true } : {}) } }, index);
        else if (!directoryWrite && !directoryEditTool && (index === 1 || (directoryReplacement && index === 3) || (directoryRewindAuthority && index === 3) || (directoryRewindPermission && index === 5) || (directorySymlink && index === 7))) respond(res, body, { type: 'tool_use', id: index === 1 ? 'directory-read' : directoryRewindPermission && index === 5 ? 'regrant-read' : directoryRewindAuthority ? 'rewind-read' : index === 3 ? 'replacement-read' : 'regrant-read', name: 'read_file', input: { path: path.join(outside, 'value.txt') } }, index);
        else respond(res, body, { type: 'text', text: `DIRECTORY_TURN_${directoryIndex}_COMPLETE` }, index);
      } else if (multiRead) {
        if (index === 1) {
          const blocks = [
            { type: 'tool_use', id: 'multi-first', name: 'read_file', input: { path: conditionalRead ? 'src/a.ts' : 'fixture.txt' } },
            { type: 'tool_use', id: 'multi-second', name: 'read_file', input: { path: 'second.txt' } },
          ];
          const events = [{ type: 'message_start', message: { id: 'multi', type: 'message', role: 'assistant', model: body.model,
            content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 0 } } }];
          blocks.forEach((block, i) => events.push(
            { type: 'content_block_start', index: i, content_block: { ...block, input: {} } },
            { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } },
            { type: 'content_block_stop', index: i }));
          events.push({ type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 25 } }, { type: 'message_stop' });
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
        } else {
          const results = latest.filter(block => block.type === 'tool_result');
          assert.deepEqual(results.map(result => result.tool_use_id), ['multi-first', 'multi-second']);
          assert.match(JSON.stringify(results[0].content), postHook ? /CLI_REWRITTEN/ : conditionalRead ? /CONDITIONAL_FIRST_CONTENT/ : /OWNED_TRANSCRIPT_FILE/);
          assert.match(JSON.stringify(results[1].content), postHook ? /CLI_REWRITTEN/ : /SECOND_READ_CONTENT/);
          if (conditionalRead) {
            assert.match(JSON.stringify(latest.slice(2)), /CONDITIONAL_SOURCE_RULE/);
            assert.doesNotMatch(JSON.stringify(latest), /CONDITIONAL_TEST_RULE/);
          }
          if (postHook) assert.match(JSON.stringify(latest), /CLI_HOOK_CONTEXT/);
          respond(res, body, { type: 'text', text: 'MULTI_READ_COMPLETE' }, index);
        }
      } else if (coldReplacement) {
        const blocks = [
          { type: 'tool_use', id: 'replacement-initial', name: 'read_file', input: { path: 'fixture.txt' } },
          { type: 'text', text: 'REPLACEMENT_INITIAL_COMPLETE' },
          { type: 'tool_use', id: 'replacement-cold', name: 'read_file', input: { path: 'fixture.txt' } },
          { type: 'text', text: 'REPLACEMENT_COLD_COMPLETE' },
        ];
        if (index === 2 || index === 4) {
          const result = latest.find(block => block.type === 'tool_result');
          assert.equal(result?.tool_use_id, index === 2 ? 'replacement-initial' : 'replacement-cold');
          assert.equal(result?.is_error === true, false);
          assert.match(JSON.stringify(result.content), index === 2 ? /OWNED_TRANSCRIPT_FILE/ : /REPLACEMENT_NEW_CONTENT/);
          if (index === 4) assert.doesNotMatch(JSON.stringify(result.content), /unchanged/i);
        }
        respond(res, body, blocks[index - 1], index);
      } else if (lexicalMutation) {
        const blocks = [
          { type: 'tool_use', id: 'alias-read', name: 'read_file', input: { path: 'alias/file.txt' } },
          { type: 'tool_use', id: 'alias-mutate', name: lexicalMutation, input: lexicalMutation === 'write_file'
            ? { path: 'alias/file.txt', content: 'LANDED', overwrite: true }
            : { path: 'alias/file.txt', old_string: 'OWNED_FILE', new_string: 'LANDED' } },
          { type: 'text', text: 'LEXICAL_COMPLETE' },
          { type: 'tool_use', id: 'cold-alias-read', name: 'read_file', input: { path: 'alias/file.txt' } },
          { type: 'text', text: 'LEXICAL_COLD_COMPLETE' },
        ];
        if (index === 2) assert.match(JSON.stringify(latest), /OWNED_FILE/);
        if (index === 3) assert.match(JSON.stringify(latest), /alias-mutate/);
        if (index === 5) assert.match(JSON.stringify(latest), /LANDED/);
        respond(res, body, blocks[index - 1], index);
      } else if (mutationGates) {
        if (index === 1) respond(res, body, { type: 'tool_use', id: 'unread-edit', name: 'edit_file', input: {
          path: 'fixture.txt', old_string: 'OWNED_TRANSCRIPT_FILE', new_string: 'EDITED' } }, index);
        else if (index === 2) {
          assert.match(JSON.stringify(latest), /File has not been read in full/);
          assert.equal(fs.readFileSync(path.join(workspace, 'fixture.txt'), 'utf8'), 'OWNED_TRANSCRIPT_FILE');
          respond(res, body, { type: 'tool_use', id: 'read-before-edit', name: 'read_file', input: { path: 'fixture.txt' } }, index);
        } else if (index === 3) {
          assert.match(JSON.stringify(latest), /OWNED_TRANSCRIPT_FILE/);
          respond(res, body, { type: 'tool_use', id: 'read-edit', name: 'edit_file', input: {
            path: 'fixture.txt', old_string: 'OWNED_TRANSCRIPT_FILE', new_string: 'EDITED' } }, index);
        } else {
          assert.match(JSON.stringify(latest), /read-edit/);
          assert.equal(fs.readFileSync(path.join(workspace, 'fixture.txt'), 'utf8'), 'EDITED');
          respond(res, body, { type: 'text', text: 'MUTATION_GATES_COMPLETE' }, index);
        }
      } else if (body.model === 'fixture-child') {
        const name = body.messages.some(message => message.content === 'AGENT_VIEW_SECOND') ? 'second' : 'first';
        if (coldExternalOverwrite && latest === 'CHILD_FOLLOWUP_QUEUED')
          respond(res, body, { type: 'tool_use', id: 'cold-existing-read', name: 'read_file', input: { path: coldEffectFile } }, index);
        else if (coldExternalOverwrite && Array.isArray(latest) && latest.some(block => block.tool_use_id === 'cold-existing-read')) {
          assert.match(JSON.stringify(latest), /CHILD_ORIGINAL/);
          respond(res, body, { type: 'tool_use', id: `cold-write-${index}`, name: 'write_file',
            input: { path: coldEffectFile, content: 'OWNED_COLD_EFFECT', overwrite: true } }, index);
        } else if (typeof latest === 'string' && latest === 'CHILD_FOLLOWUP_QUEUED')
          respond(res, body, coldHistory || coldSkill
            ? { type: 'tool_use', id: `cold-write-${index}`, name: 'write_file', input: { path: coldPlan ? planTarget : coldExternalWrite ? coldEffectFile : 'cold-effect.txt', content: 'OWNED_COLD_EFFECT' } }
            : { type: 'text', text: 'CHILD_FOLLOWUP_COMPLETE' }, index);
        else if (Array.isArray(latest) && latest.some(block => block.type === 'tool_result' && (block.tool_use_id.startsWith('cold-write-') || (switchRace && block.tool_use_id === 'race-write'))))
          respond(res, body, { type: 'text', text: 'CHILD_FOLLOWUP_COMPLETE' }, index);
        else if (typeof latest === 'string') respond(res, body,
          { type: 'tool_use', id: `read-${name}`, name: 'read_file', input: { path: 'fixture.txt' } }, index);
        else {
          assert.match(JSON.stringify(latest), /OWNED_TRANSCRIPT_FILE/);
          const event = value => res.write(`event: ${value.type}\ndata: ${JSON.stringify(value)}\n\n`);
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          event({ type: 'message_start', message: { id: `transcript-${index}`, type: 'message', role: 'assistant', model: body.model,
            content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 0 } } });
          event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
          held.set(name, { finish() {
            if (switchRace) {
              event({ type: 'content_block_stop', index: 0 });
              event({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'race-write', name: 'write_file', input: {} } });
              event({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ path: 'race-effect.txt', content: 'STALE' }) } });
              event({ type: 'content_block_stop', index: 1 });
              event({ type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 25 } });
              event({ type: 'message_stop' }); res.end(); return;
            }
            event({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `CHILD_${name.toUpperCase()}_COMPLETE` } });
            event({ type: 'content_block_stop', index: 0 });
            event({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 25 } });
            event({ type: 'message_stop' }); res.end();
          } });
        }
      } else if (typeof latest === 'string' && latest.startsWith('launch view ')) {
        const second = latest.includes('second');
        respond(res, body, { type: 'tool_use', id: `launch-${index}`, name: 'agent', input: {
          prompt: second ? 'AGENT_VIEW_SECOND' : 'AGENT_VIEW_FIRST', name: second ? 'view-second' : 'view-first',
          model: 'fixture-child', background: true, mode: coldHistory ? 'general' : 'explore',
        } }, index);
      } else respond(res, body, { type: 'text', text: 'MAIN_TRANSCRIPT_SENTINEL' }, index);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, TERM: 'xterm-256color' };
  for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY'].includes(name)) delete env[name];
  Object.assign(env, { LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture-parent', LLM_AUTH: 'bearer',
    LLM_TOKEN_COUNTING: 'estimate', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` });
  env.HOME = temporary;
  if (panelPriorError) {
    const preload = path.join(temporary,'panel-prior-error.mjs');
    fs.writeFileSync(preload,`import fs from 'node:fs';
import {Session} from ${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)};
const adopt = Session.prototype.adoptPermissionUpdates;
let injected = false;
Session.prototype.adoptPermissionUpdates = function(updates,...args) {
  if (!injected && updates.some(update => update.type === 'addDirectories')) {
    injected = true;
    fs.mkdirSync(${JSON.stringify(path.join(workspace,'.harness'))},{recursive:true});
    fs.writeFileSync(${JSON.stringify(path.join(workspace,'.harness/settings.local.json'))},'{broken');
    adopt.call(this,[{type:'addRules',behavior:'deny',destination:'localSettings',rules:[{toolName:'fixture_rule'}]}]);
    this.drainPermissionWrites().then(results => {
      if (results.some(result => result.outcome === 'error')) fs.writeFileSync(${JSON.stringify(path.join(temporary,'prior-error'))},'observed');
    });
  }
  return adopt.call(this,updates,...args);
};`);
    env.NODE_OPTIONS = `--import=${preload}`;
  }
  if (directoryRewindStale) {
    const preload = path.join(temporary, 'directory-rewind-stale.cjs'), arm = path.join(temporary, 'rewind-stale-arm'), marker = path.join(temporary, 'rewind-stale-barrier');
    fs.writeFileSync(preload, `const fs=require('node:fs'),dir=fs.statSync(${JSON.stringify(outside)}),close=fs.closeSync;let stopped=false;
fs.closeSync=function(fd){let observed;try{observed=fs.fstatSync(fd)}catch{}const result=close.call(fs,fd);
  if(!stopped&&observed?.isDirectory()&&observed.dev===dir.dev&&observed.ino===dir.ino&&fs.existsSync(${JSON.stringify(arm)})){
    stopped=true;fs.writeFileSync(${JSON.stringify(marker)},'ready');process.kill(process.pid,'SIGSTOP');}return result;};
require('node:module').syncBuiltinESMExports();`);
    env.NODE_OPTIONS = `--require=${preload}`;
  }
  if (directoryRewindPermission) {
    const preload = path.join(temporary, 'directory-rewind-permission.mjs'), arm = path.join(temporary, 'rewind-permission-arm');
    fs.writeFileSync(preload, `import fs from 'node:fs';const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)});
const release=Session.prototype.releaseDirectoryAuthority;let changed=false;
Session.prototype.releaseDirectoryAuthority=function(...args){if(!changed&&fs.existsSync(${JSON.stringify(arm)})){
  changed=true;this.adoptPermissionUpdates([{type:'removeDirectories',directories:[${JSON.stringify(outside)}],destination:'session'},
    {type:'addDirectories',directories:[${JSON.stringify(outside)}],destination:'session'}]);}return release.apply(this,args)};`);
    env.NODE_OPTIONS = `--import=${preload}`;
  }
  if (directoryMixedCold) {
    const preload = path.join(temporary, 'mixed-cold.mjs');
    const helper = path.join(temporary, 'directory-write-test');
    if (directoryMixedReceipt?.endsWith('-native') || directoryMixedReceipt?.endsWith('-captured') || directoryMixedReceipt?.endsWith('-untouched') || directoryMixedReceipt?.endsWith('-linked')) {
      const source = fs.readFileSync(path.join(root, 'native/directory-write/write.c'), 'utf8'), claim = 'if (rename_exclusive(dir, name, dir, part)) goto done;';
      assert.equal(source.split(claim).length, 2);
      fs.writeFileSync(`${helper}.c`, source.replace(claim, `if (getenv("DIRECTORY_WRITE_TEST_LEGACY_LINK")) {
        if (linkat(dir, name, dir, part, 0) || test_point("legacy_after_link") || unlinkat(dir, name, 0)) goto done;
      } else ${claim}`));
      execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_WRITE_TEST', '-o', helper, `${helper}.c`]);
    }
    fs.writeFileSync(preload, `import fs from 'node:fs';import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
const unlink=fs.unlinkSync,rename=fs.renameSync,receiptMode=${JSON.stringify(directoryMixedReceipt ?? '')},early=${directoryEarlyPreparation},torn=${directoryEarlyTorn},createCut=${JSON.stringify(directoryCreateCut ?? '')};
const createKind=createCut.replace(/^zero:/,''),tornMode=createKind.startsWith('torn:'),partialError=createKind.startsWith('partial:'),nativePoint=tornMode?'receipt_partial_intent':createKind.replace(/^error:|^partial:[0-9]+:/,''),nativeFailure=partialError||createKind.startsWith('error:'),publicationCut=tornMode||['create_before_mode','create_after_mode','create_after_recheck','create_after_publish'].includes(nativePoint);
if(receiptMode){const native=childProcess.spawnSync;let calls=0;childProcess.spawnSync=function(...args){
  if(Array.isArray(args[1])&&args[1].includes('--prepare-create')&&receiptMode.endsWith('-linked')){
    const transaction=JSON.parse(fs.readFileSync(pending,'utf8')),op=transaction.directory.operations[0],reverse=receiptMode.startsWith('reverse');
    const attempt=reverse?op.rollback:op.stage;
    delete op[reverse?'rollbackCreation':'creation'];fs.writeFileSync(pending,JSON.stringify(transaction));
    const receipt=fs.openSync(pending.replace('transaction.json','native-attempt-'+attempt.id+'.receipt'),'r+');
    args[2]={...args[2],stdio:args[2].stdio.map((fd,index)=>index===8?receipt:fd)};
    args[1]=['--receipt',args[1][2],String(args[2].input.length),args[1][3],args[1][6]];
  }
  const selected=!createCut.endsWith('_persisted')&&Array.isArray(args[1])&&args[1].includes('--receipt')&&((createCut&&!publicationCut)||!args[1].includes('--prepare-create'))&&++calls===(receiptMode.startsWith('forward')?1:2);
  const killNative=receiptMode.endsWith('-native')||receiptMode.endsWith('-captured')||receiptMode.endsWith('-untouched')||receiptMode.endsWith('-linked');
  if(selected&&killNative){args[0]=${JSON.stringify(helper)};args[2]={...args[2],env:{...process.env,
    DIRECTORY_WRITE_TEST_SELF_KILL:nativeFailure?undefined:'1',DIRECTORY_WRITE_TEST_FAIL:nativeFailure?'1':undefined,DIRECTORY_WRITE_TEST_SHORT_READ:'1',
    ...(receiptMode.endsWith('-linked')?{DIRECTORY_WRITE_TEST_LEGACY_LINK:'1'}:{}),
    DIRECTORY_WRITE_TEST_RECEIPT_CUT:tornMode?createKind.split(':')[1]:torn?'12':undefined,
    DIRECTORY_WRITE_TEST_ERROR_CUT:partialError?createKind.split(':')[1]:undefined,
    DIRECTORY_WRITE_TEST_POINT:nativePoint||(torn?'receipt_partial_intent':early?(args[1].includes('--remove')?'remove_quarantine':'replace_staging'):receiptMode.endsWith('-linked')?'legacy_after_link':receiptMode.endsWith('-untouched')?(args[1].includes('--remove')?'remove_after_recheck':args[1].includes('--restore-retained')?'replace_after_recheck':args[1].includes('--publish-prepared-create')?'create_before_mode':'after_recheck'):
      receiptMode.endsWith('-captured')?'replace_after_capture':args[1].includes('--remove')?'remove_after_capture':args[1].includes('--restore-retained')?'replace_after_publish':args[1].includes('--publish-prepared-create')?'create_after_publish':'after_rename')}};}
  const untouchedError=${JSON.stringify(directoryUntouchedError ?? '')};
  const terminalError=${JSON.stringify(directoryPublishedError ?? directoryCapturedError ?? directoryUntouchedError ?? '')};
  if(selected&&untouchedError) args[2].env.DIRECTORY_WRITE_TEST_POINT=untouchedError==='complete'?'replace_before_quarantine':'replace_writing';
  if(selected&&terminalError) Object.assign(args[2].env,{DIRECTORY_WRITE_TEST_FAIL:'1',DIRECTORY_WRITE_TEST_SELF_KILL:undefined,
    DIRECTORY_WRITE_TEST_ERROR_CUT:terminalError==='partial'?'17':undefined});
  const result=native.apply(this,args);
  const fullError=(nativeFailure&&!partialError)||terminalError==='complete';
  if(selected){if(killNative&&(fullError?result.status!==1:result.signal!=='SIGKILL'))throw Error('native fixture did not fail as selected');process.exit(73);}return result;};syncBuiltinESMExports();}
const pending=${JSON.stringify(path.join(workspace, '.agent/checkpoints/transaction.json'))},rollback=${directoryMixedColdRollback},compensate=${directoryMixedColdCompensate};
fs.unlinkSync=function(file){if(!rollback&&file===pending)process.exit(73);return unlink.apply(this,arguments)};
if(${mixedMarkerCrash})fs.renameSync=function(from,to){if(to===pending&&JSON.parse(fs.readFileSync(from,'utf8')).state==='committed')process.exit(73);return rename.apply(this,arguments)};
if(rollback){const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)}),append=Session.prototype.append;
  Session.prototype.append=function(event,...args){if(event.kind==='rewind'){if(compensate)process.exit(73);throw Error('fixture cold compensation');}return append.call(this,event,...args)};
  fs.renameSync=function(from,to){const result=rename.apply(this,arguments);
    if(to===pending){const directory=JSON.parse(fs.readFileSync(pending,'utf8')).directory;
      if(createCut.endsWith('_persisted')){
        const op=directory?.operations[0],reverse=receiptMode.startsWith('reverse'),attempt=reverse?op?.rollback:op?.stage,creation=reverse?op?.rollbackCreation:op?.creation;
        if(attempt?.kind==='attempting'){
          if(!creation)throw Error('unbound create attempt persisted');
          if(creation.phase===(createCut==='create_attempt_persisted'?'preparing':'publishing'))process.exit(73);
        }
      }
      if(directory?.operations.every(op=>op.rollback?.kind==='completed'))process.exit(73);
    }return result;};}`);
    env.NODE_OPTIONS = `--import=${preload}`;
  }
  if (directoryMixedRollback && !directoryMixedCold) {
    const preload = path.join(temporary, 'mixed-rollback.mjs');
    fs.writeFileSync(preload, `const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)});
const append=Session.prototype.append;let injected=false;
Session.prototype.append=function(event,...args){if(!injected&&event.kind==='rewind'){injected=true;throw Error('fixture mixed commit failure');}return append.call(this,event,...args)};`);
    env.NODE_OPTIONS = `--import=${preload}`;
  }
  if (directoryRewindRollback) {
    const preload = path.join(temporary, 'directory-rewind-rollback.mjs'), marker = path.join(temporary, 'rewind-rollback-injected');
    fs.writeFileSync(preload, `import fs from 'node:fs';const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)});
const append=Session.prototype.append;let injected=false;
Session.prototype.append=function(event,...args){const result=append.call(this,event,...args);
  if(!injected&&event.kind==='rewind'){injected=true;fs.writeFileSync(${JSON.stringify(marker)},'injected');throw Error('injected rewind append failure');}return result;};`);
    env.NODE_OPTIONS = `--import=${preload}`;
  }
  if (directoryRewindReleaseError) {
    const preload = path.join(temporary, 'directory-rewind-release-error.mjs');
    const target = new URL('../dist/interactive.js', import.meta.url).href;
    fs.writeFileSync(preload, `import {registerHooks} from 'node:module';
const target=${JSON.stringify(target)},needle='await activeRuntime.releaseSession?.(session.id, completed);';
registerHooks({load(url,context,next){const result=next(url,context);if(url!==target)return result;
  const text=String(result.source);if(text.split(needle).length!==2)throw Error('release injection target changed');
  return {...result,source:text.replace(needle,needle+" throw new Error('injected completed release failure');")};}});`);
    env.NODE_OPTIONS = `--import=${preload}`;
  }
  if (directoryRewindBindError) {
    const preload = path.join(temporary, 'directory-rewind-bind-error.mjs');
    const target = new URL('../dist/runtime.js', import.meta.url).href;
    fs.writeFileSync(preload, `import {registerHooks} from 'node:module';
const target=${JSON.stringify(target)},needle='runtime.bindSession = async (session) => {';
registerHooks({load(url,context,next){const result=next(url,context);if(url!==target)return result;
  const text=String(result.source);if(text.split(needle).length!==2)throw Error('bind injection target changed');
  const injected="if(!globalThis.__rewindBindInjected&&session.events.some(e=>e.kind==='branch'&&e.reason==='rewind')){globalThis.__rewindBindInjected=true;throw Error('injected successor bind failure')}";
  return {...result,source:text.replace(needle,needle+injected)};}});`);
    env.NODE_OPTIONS = `--import=${preload}`;
  }
  if (directoryRewindBindFatal) {
    const preload = path.join(temporary, 'directory-rewind-bind-fatal.mjs'), marker = path.join(temporary, 'rewind-bind-fatal.json');
    const runtimeTarget = new URL('../dist/runtime.js', import.meta.url).href, interactiveTarget = new URL('../dist/interactive.js', import.meta.url).href;
    const fatal = `fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({id:next.id}));throw Error('injected runtime recovery failure');`;
    fs.writeFileSync(preload, `import {registerHooks} from 'node:module';
const runtimeTarget=${JSON.stringify(runtimeTarget)},interactiveTarget=${JSON.stringify(interactiveTarget)};
registerHooks({load(url,context,next){const result=next(url,context);let needle,injected;
  if(url===runtimeTarget){needle='runtime.bindSession = async (session) => {';
    injected="if(!globalThis.__rewindBindInjected&&session.events.some(e=>e.kind==='branch'&&e.reason==='rewind')){globalThis.__rewindBindInjected=true;throw Error('injected successor bind failure')}"}
  else if(url===interactiveTarget){needle='if (firstError instanceof RuntimeHandoffCleanupError)';injected=${JSON.stringify(fatal)}}
  else return result;const text=String(result.source);if(text.split(needle).length!==2)throw Error('bind fatal injection target changed');
  return {...result,source:text.replace(needle,url===runtimeTarget?needle+injected:injected+needle)};}});`);
    env.NODE_OPTIONS = `--import=${preload}`;
  }
  if (directoryRewindAcceptError) {
    const preload = path.join(temporary, 'directory-rewind-accept-error.mjs'), marker = path.join(temporary, 'rewind-accept-error.json');
    const target = new URL('../dist/interactive.js', import.meta.url).href;
    const injected = `if(session.events.some(e=>e.kind==='branch'&&e.reason==='rewind')){fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({id:session.id}));throw Error('injected accept failure')}`;
    fs.writeFileSync(preload, `import {registerHooks} from 'node:module';
const target=${JSON.stringify(target)},needle='await activeRuntime.settleScheduler?.(session.id, schedulerSessions, () => activeAgent?.isRunning() ?? false);';
registerHooks({load(url,context,next){const result=next(url,context);if(url!==target)return result;
  const text=String(result.source);if(text.split(needle).length!==2)throw Error('accept injection target changed');
  return {...result,source:text.replace(needle,${JSON.stringify(injected)}+needle)};}});`);
    env.NODE_OPTIONS = `--import=${preload}`;
  }
  if (directoryCheckpointBracket) {
    const preload = path.join(temporary, 'directory-checkpoint-bracket.mjs'), marker = path.join(temporary, 'directory-checkpoint-bracket.json');
    fs.writeFileSync(preload, `import fs from 'node:fs';import {randomUUID} from 'node:crypto';
const {Agent}=await import(${JSON.stringify(new URL('../dist/agent.js', import.meta.url).href)});
const {checkpointConversation}=await import(${JSON.stringify(new URL('../dist/rewind.js', import.meta.url).href)});
const run=Agent.prototype.run;Agent.prototype.run=async function(...args){if(args[0]==='checkpoint bracket fixture'){
  const s=this.session,signal=args[1],id=randomUUID(),backup=s.file+'.snapshot-unknown-'+id,destinationFd=fs.openSync(backup,'wx+',0o600);let bracket;
  try{bracket=await s.beginDirectoryCheckpointBracket({id,root:${JSON.stringify(outside)},lexicalPath:${JSON.stringify(path.join(outside, 'value.txt'))},destinationFd,signal});
    if(bracket.kind!=='ready')throw Error('bracket fixture not ready');const checkpoint=checkpointConversation(s,'bracket-cli',signal),result=await bracket.finish();
    if(result.kind!=='stable'||result.observation.kind!=='present')throw Error('bracket fixture unstable');
    fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({id,backup,kind:result.kind,mode:result.observation.file.mode,checkpoint:checkpoint.checkpoint_digest}));
  }finally{if(bracket?.kind==='ready')await bracket.cancel();fs.closeSync(destinationFd)}}return run.apply(this,args)};`);
    env.NODE_OPTIONS = `--import=${preload}`;
  }
  if (directoryCheckpointCrash) {
    const preload = path.join(temporary, 'directory-checkpoint-crash.mjs'), marker = path.join(temporary, 'directory-checkpoint-crash.json');
    fs.writeFileSync(preload, `import fs from 'node:fs';const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)});
const append=Session.prototype.append;Session.prototype.append=function(event,...args){const result=append.call(this,event,...args);
  if(event.kind==='directory_checkpoint_witness'&&event.name==='selection-tracked'){
    fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({id:this.id}));process.kill(process.pid,'SIGSTOP');}return result};`);
    env.NODE_OPTIONS = `--import=${preload}`;
  }
  if (directoryInheritanceError) {
    const preload = path.join(temporary, 'directory-inheritance-error.cjs'), marker = path.join(temporary, 'directory-inheritance-error.json');
    fs.writeFileSync(preload, `const fs=require('node:fs'),path=require('node:path'),directory=${JSON.stringify(path.join(workspace, '.agent'))},sync=fs.fsyncSync;let injected=false;
fs.fsyncSync=function(fd){const stat=fs.fstatSync(fd);if(!injected&&fs.existsSync(directory))for(const name of fs.readdirSync(directory).filter(x=>x.endsWith('.jsonl'))){
  const file=path.join(directory,name),named=fs.lstatSync(file);if(stat.dev!==named.dev||stat.ino!==named.ino)continue;
  const rows=fs.readFileSync(file,'utf8');if(rows.includes('"reason":"rewind"')&&rows.includes('"kind":"directory_checkpoint_inheritance"')){
    injected=true;fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({id:name.slice(0,-6)}));throw Error('injected inherited witness sync failure')}}return sync.call(this,fd)};
require('node:module').syncBuiltinESMExports();`);
    env.NODE_OPTIONS = `--require=${preload}`;
  }
  if (directoryWitnessTorn) {
    const preload = path.join(temporary, 'directory-witness-torn.cjs'), marker = path.join(temporary, 'directory-inheritance-error.json');
    fs.writeFileSync(preload, `const fs=require('node:fs'),path=require('node:path'),directory=${JSON.stringify(path.join(workspace, '.agent'))},write=fs.writeSync;let injected=0;
fs.writeSync=function(fd,bytes,offset,length,...rest){if(injected<${directoryWitnessRepeated ? 2 : 1}&&Buffer.isBuffer(bytes)&&bytes.toString().startsWith('{"kind":"directory_checkpoint_inheritance"')){
  const stat=fs.fstatSync(fd);for(const name of fs.readdirSync(directory).filter(x=>x.endsWith('.jsonl'))){const file=path.join(directory,name),named=fs.lstatSync(file);
    if(stat.dev===named.dev&&stat.ino===named.ino&&fs.readFileSync(file,'utf8').includes('"reason":"rewind"')){
      injected++;fs.writeFileSync(${JSON.stringify(marker)}+(injected===1?'':'.second'),JSON.stringify({id:name.slice(0,-6)}));
      write.call(fs,fd,bytes,offset,Math.max(1,Math.floor(length/2)),...rest);
      ${directoryWitnessInvalid ? "const source=JSON.parse(bytes.toString('utf8')).source;fs.appendFileSync(path.join(directory,source+'.jsonl'),'{');" : ''}
      throw Error('injected inherited witness short write')}}}
  return write.call(fs,fd,bytes,offset,length,...rest)};require('node:module').syncBuiltinESMExports();`);
    env.NODE_OPTIONS = `--require=${preload}`;
  }
  if (directoryMarkerError) {
    const preload = path.join(temporary, 'directory-marker-error.cjs'), marker = path.join(temporary, 'directory-marker-error.json');
    const transaction = path.join(workspace, '.agent/checkpoints/transaction.json');
    fs.writeFileSync(preload, `const fs=require('node:fs'),rename=fs.renameSync;let injected=false;
fs.renameSync=function(from,to){if(!injected&&String(to)===${JSON.stringify(transaction)}){const value=JSON.parse(fs.readFileSync(from,'utf8'));
  if(value.state==='committed'){injected=true;fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({id:value.branch.id}));
    ${directoryMarkerConflict ? `fs.writeFileSync(${JSON.stringify(path.join(workspace, 'written.txt'))},'CONFLICT_AFTER_COMMIT');` : ''}throw Error('injected marker failure')}}
  return rename.call(this,from,to)};require('node:module').syncBuiltinESMExports();`);
    env.NODE_OPTIONS = `--require=${preload}`;
  }
  if (directoryRecovery) {
    const preload = path.join(temporary, 'directory-history-crash.cjs'), marker = path.join(temporary, 'directory-history-barrier');
    fs.writeFileSync(preload, `const fs=require('node:fs');const write=fs.writeSync;let snapshots=0;
fs.writeSync=function(fd,bytes,...args){const count=write.call(fs,fd,bytes,...args);
  if(Buffer.isBuffer(bytes)){try{const row=JSON.parse(bytes.toString());if(row.kind==='directory_snapshot'&&++snapshots===2){
    fs.writeFileSync(${JSON.stringify(marker)},'ready');process.kill(process.pid,'SIGSTOP');}}catch{}}return count;};`);
    env.NODE_OPTIONS = `--require=${preload}`;
  }
  if (directorySwitch) {
    const preload = path.join(temporary, 'directory-barrier.cjs');
    const marker = path.join(temporary, 'helper-open.json'), release = path.join(temporary, 'helper-release'), released = path.join(temporary, 'helper-released.json');
    fs.writeFileSync(preload, `const cp = require('node:child_process'), fs = require('node:fs');
const spawn = cp.spawn;
cp.spawn = function(...args) { const child = spawn.apply(this, args);
  if (String(args[0]).endsWith('/native/directory-read/read')) {
    const fd = args[2].stdio[3], original = fs.fstatSync(fd);
    const metadata = child.stdio[4], iterator = metadata[Symbol.asyncIterator].bind(metadata);
    let unblock; const gate = new Promise(resolve => { unblock = resolve; });
    const kill = child.kill.bind(child); child.kill = (...killArgs) => { const result = kill(...killArgs); ${holdThroughCancel ? '' : 'unblock();'} return result; };
    metadata[Symbol.asyncIterator] = function() { const source = iterator(); return {
      async next() { const part = await source.next(); if (!part.done) { fs.writeFileSync(${JSON.stringify(marker)}, JSON.stringify({pid: child.pid, fd})); await gate; } return part; },
      return() { return source.return ? source.return() : Promise.resolve({done:true}); }, [Symbol.asyncIterator]() { return this; }
    }; };
    const timer = setInterval(() => { if (fs.existsSync(${JSON.stringify(release)})) { clearInterval(timer);
      let same = false, error; try { const now = fs.fstatSync(fd); same = now.dev === original.dev && now.ino === original.ino; } catch (e) { error = e.code; }
      fs.writeFileSync(${JSON.stringify(released)}, JSON.stringify({same, error})); unblock(); } }, 20);
    timer.unref();
  } return child;
}; require('node:module').syncBuiltinESMExports();`);
    env.NODE_OPTIONS = `--require=${preload}`;
  }
  if (postHookCrash) {
    const preload = path.join(temporary, 'post-hook-crash.cjs');
    fs.writeFileSync(preload, `const fs = require('node:fs');
const write = fs.writeSync, sync = fs.fsyncSync; let target;
fs.writeSync = function(fd, bytes, ...args) {
  if (Buffer.isBuffer(bytes)) { try { const row = JSON.parse(bytes.toString()); if (row.kind === 'hook_result' && row.event === 'PostToolUse') target = fd; } catch {} }
  return write.call(fs, fd, bytes, ...args);
};
fs.fsyncSync = function(fd) { const result = sync.call(fs, fd); if (fd === target) { fs.writeFileSync(${JSON.stringify(path.join(temporary, 'post-hook-barrier'))}, 'ready'); process.kill(process.pid, 'SIGSTOP'); } return result; };`);
    env.NODE_OPTIONS = `--require=${preload}`;
  }
  if (crashIntent) {
    const preload = path.join(temporary, 'crash-barrier.cjs');
    fs.writeFileSync(preload, `const fs = require('node:fs'); const path = require('node:path');
const root = ${JSON.stringify(path.join(workspace, '.agent', 'subagents') + path.sep)};
const barrier = ${JSON.stringify(path.join(temporary, 'crash-barrier.json'))};
const rename = fs.renameSync;
fs.renameSync = function(from, to) {
  const target = String(to);
  if (target.startsWith(root) && target.endsWith('.meta.json')) {
    const record = JSON.parse(fs.readFileSync(from, 'utf8'));
    if (record.state.kind === 'settled') {
      rename.apply(this, arguments);
      fs.writeFileSync(barrier, JSON.stringify({ parent: record.parent, child: record.id, target }));
      process.kill(process.pid, 'SIGSTOP');
      return;
    }
  }
  return rename.apply(this, arguments);
};`);
    env.NODE_OPTIONS = `--require=${preload}`;
  }
  if (startupProbe) {
    const old = path.join(temporary, 'startup-old'), replacement = path.join(temporary, 'startup-new');
    fs.writeFileSync(old, '# initial\n');
    fs.writeFileSync(replacement, `export HOME='${workspace}/changed-home'\nprintf startup >> '${workspace}/startup-effects'\n`);
    fs.symlinkSync(old, path.join(temporary, 'startup-active'));
    env.BASH_ENV = path.join(temporary, 'startup-active');
  }
  if (mutationGates || lexicalMutation || coldReplacement || multiRead) env.LLM_MODEL = 'claude-sonnet-4-5';
  const start = args => {
    child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
      '--interactive', ...args], { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', text => screen.write(text)); child.stderr.on('data', text => screen.write(text));
  };
  start(['--user-dir', userDir, '--no-inherit-gateway', ...(startupProbe || switchRace ? ['--allow-shell'] : []), '--permission-mode', coldPlan ? 'plan' : coldApproval || startupProbe || switchRace || directoryGrant ? 'ask' : 'bypass']);
  await until(ready, 'startup', 15000);
  if (directorySwitch) {
    const dir = path.join(workspace, '.agent');
    const initial = fs.readdirSync(dir).find(name => name.endsWith('.jsonl'));
    const bFile = path.join(dir, initial), bId = JSON.parse(fs.readFileSync(bFile, 'utf8').split('\n')[0]).id;
    send('/clear\r');
    await until(() => fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).length === 2 && ready(), 'create separate A', 15000);
    const aFile = path.join(dir, fs.readdirSync(dir).find(name => name.endsWith('.jsonl') && name !== initial));
    const aId = JSON.parse(fs.readFileSync(aFile, 'utf8').split('\n')[0]).id;
    assert.notEqual(aId, bId);
    send(`/add-dir ${outside}\r`); await until(() => frame().includes('Added') && ready(), 'grant A', 15000);
    send('read outside fixture\r');
    const marker = path.join(temporary, 'helper-open.json');
    await until(() => fs.existsSync(marker), 'native helper opened A file', 15000);
    const helperPid = JSON.parse(fs.readFileSync(marker, 'utf8')).pid;
    assert.doesNotThrow(() => process.kill(helperPid, 0));
    send('\x03');
    await until(ready, 'cancel foreground Read', 15000);
    send(`/resume ${bId}\r`);
    await until(() => frame().includes('Session resumed.') && ready(), 'resume B', 15000);
    send('B_NEW_TURN\r');
    await until(() => frame().includes('DIRECTORY_TURN_2_COMPLETE') && ready(), 'B new turn', 15000);
    assert.equal(requests.length, 2);
    assert.doesNotMatch(JSON.stringify(requests[1].messages), new RegExp(directorySecret));
    assert.doesNotMatch(JSON.stringify(requests[1].messages), /read outside fixture|directory-read/);
    assert.doesNotMatch(frame(), new RegExp(directorySecret));
    const rawABeforeRelease = fs.readFileSync(aFile);
    fs.writeFileSync(path.join(temporary, 'helper-release'), 'release');
    const released = path.join(temporary, 'helper-released.json');
    await until(() => fs.existsSync(released), 'loader released old stdout', 15000);
    assert.equal(JSON.parse(fs.readFileSync(released, 'utf8')).same, false, 'A directory descriptor released');
    await delay(300);
    assert.ok(fs.readFileSync(aFile).subarray(0, rawABeforeRelease.length).equals(rawABeforeRelease), 'A raw audit retained');
    assert.doesNotMatch(frame(), new RegExp(directorySecret));
    assert.doesNotMatch(fs.readFileSync(bFile, 'utf8'), new RegExp(directorySecret));
    assert.doesNotMatch(fs.readFileSync(bFile, 'utf8'), /read outside fixture|directory-read/);
    send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
    assert.throws(() => process.kill(helperPid, 0), { code: 'ESRCH' });
    assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.lock') || name.endsWith('.lease')), false);
    const effects = path.join(dir, 'skill-effects');
    assert.equal(fs.existsSync(effects) && fs.readdirSync(effects).some(name => name.endsWith('.lease')), false);
    const { spawnSync } = await import('node:child_process');
    for (const id of [aId, bId]) for (let pass = 0; pass < 2; pass++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `import { Session } from './dist/session.js'; const s = Session.open(process.argv[1], { id: process.argv[2] }); try { process.stdout.write(JSON.stringify(s.messages)); } finally { s.close(); }`, workspace, id], { cwd: root, encoding: 'utf8' });
      assert.equal(cold.status, 0, cold.stderr); assert.doesNotMatch(cold.stdout, new RegExp(directorySecret));
    }
    console.log(JSON.stringify({ cli: 'passed', directorySwitch, aId, bId, helperPid, directoryFdReleased: true, rawAContainsSecret: fs.readFileSync(aFile, 'utf8').includes(directorySecret), coldProjections: 4, gateway: 'owned loopback SSE' }));
    break run;
  }
  if (directoryGrant) {
    send(`/add-dir ${outside}\r`);
    await until(() => frame().includes('Added') && ready(), 'add directory', 15000);
    if (directoryCheckpointBracket) {
      send('checkpoint bracket fixture\r');
      await until(() => frame().includes('DIRECTORY_TURN_2_COMPLETE') && ready(), 'checkpoint bracket turn', 15000);
      const marker = JSON.parse(fs.readFileSync(path.join(temporary, 'directory-checkpoint-bracket.json'), 'utf8'));
      assert.equal(marker.kind, 'stable'); assert.equal(marker.mode, 0o751); assert.match(marker.checkpoint, /^[a-f0-9]{64}$/);
      assert.equal(fs.readFileSync(marker.backup, 'utf8'), directorySecret);
      send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
      const dir = path.join(workspace, '.agent'), name = fs.readdirSync(dir).find(value => value.endsWith('.jsonl'));
      assert.ok(name); const id = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8').split('\n')[0]).id;
      const { spawnSync } = await import('node:child_process');
      const reader = `import {Session} from './dist/session.js';const s=Session.open(process.argv[1],{id:process.argv[2]});
        const checkpoint=s.events.find(e=>e.kind==='checkpoint'&&e.name==='bracket-cli');
        process.stdout.write(JSON.stringify({digest:checkpoint?.digest,grant:!!s.workingDirectories(false).readHandle?.(process.argv[3]),
          receipted:s.events.some(e=>e.kind==='directory_snapshot_file'&&e.id===process.argv[4])}));await s.close();`;
      for (let i = 0; i < 2; i++) {
        const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, id, outside, marker.id], { cwd: root, encoding: 'utf8' });
        assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { digest: marker.checkpoint, grant: false, receipted: false });
      }
      console.log(JSON.stringify({ cli: 'passed', directoryCheckpointBracket: true, fixtureWrapper: true, coldProcesses: 2, gateway: 'owned loopback SSE' }));
      break run;
    }
    if (directoryEditTool) {
      send('edit external and workspace fixtures\r');
      if (directoryEditBackup || notebookPublication) {
        await until(() => frame().includes(notebookPublication ? 'DIRECTORY_TURN_4_COMPLETE' : 'DIRECTORY_TURN_6_COMPLETE') && ready(), 'external edit baseline', 15000);
        send('/checkpoint edit-original\r');
        await until(() => frame().includes('"external_witness": "available"') && ready(), 'external edit checkpoint', 15000);
        send('replace both occurrences\r');
      }
      const last = directoryEditBackup ? 8 : notebookPublication ? 9 : 4;
      await until(() => frame().includes(`DIRECTORY_TURN_${last}_COMPLETE`) && ready(), 'directory edit turn', 15000);
      const results = requests[last-1].messages.flatMap(message => Array.isArray(message.content) ? message.content : []).filter(block => block.type === 'tool_result');
      const external = results.find(result => result.tool_use_id === 'external-edit'), local = results.find(result => result.tool_use_id === 'workspace-edit');
      assert.equal(external?.is_error, true, JSON.stringify(results));
      assert.match(JSON.stringify(external), directoryEditBackup ? /old_string not found/ :
        notebookPublication ? /has not been read/ : /directory grant changed/);
      if (directoryEditBackup) {
        const read = results.find(row => row.tool_use_id === 'external-edit-read');
        assert.ok(read && !read.is_error, JSON.stringify(read));
        assert.match(JSON.stringify(results.find(row => row.tool_use_id === 'external-edit-ambiguous')), /2 matches/);
        const edit = results.find(row => row.tool_use_id === 'external-edit-all');
        assert.ok(edit && !edit.is_error, JSON.stringify(edit));
        assert.match(JSON.stringify(edit), /2 replacement/);
      }
      assert.notEqual(local?.is_error, true, JSON.stringify(results));
      let insertedId;
      if (notebookPublication) {
        const result = results.find(row=>row.tool_use_id==='external-insert');
        assert.ok(result && !result.is_error,JSON.stringify(result));
        const nb = JSON.parse(fs.readFileSync(path.join(outside,directoryEditFile),'utf8'));
        insertedId=nb.cells[0]?.id;
        assert.match(insertedId,/^[0-9a-f]{8}$/);
        assert.deepEqual(nb.cells,[{cell_type:'markdown',id:insertedId,metadata:{},source:'edited text'}]);
        for (const id of ['external-replace','external-delete']) {
          const effect = results.find(row=>row.tool_use_id===id);
          assert.ok(effect && !effect.is_error,JSON.stringify(effect));
        }
        assert.ok(JSON.stringify(result).includes(insertedId));
      } else assert.deepEqual(fs.readFileSync(path.join(outside, directoryEditFile)), directoryEditBackup ? Buffer.from('\uFEFFupdated\r\nupdated','utf16le') : Buffer.from(directoryEditSource));
      if (!directoryEditBackup && !notebookPublication) assert.equal(fs.readFileSync(path.join(`${outside}-original`, directoryEditFile), 'utf8'), directoryEditSource);
      const updated = fs.readFileSync(path.join(workspace, directoryEditFile), 'utf8');
      assert.equal(directoryEditTool === 'notebook_edit' ? JSON.parse(updated).cells[0].source : updated, 'CLI_EDIT_MARKER');
      const dir = path.join(workspace, '.agent'), name = fs.readdirSync(dir).find(value => value.endsWith('.jsonl'));
      assert.ok(name);
      const id = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8').split('\n')[0]).id;
      if (directoryEditBackup || notebookPublication) {
        send('/rewind 1 --files\r');
        const preview = /Apply: \/rewind 1 --files --apply ([a-f0-9]{64})/;
        await until(() => preview.test(frame()) && ready(), 'external Edit rewind preview', 15000);
        send(`/rewind 1 --files --apply ${preview.exec(frame())[1]}\r`);
        await until(() => fs.readFileSync(path.join(outside, directoryEditFile)).equals(notebookPublication ? Buffer.from(directoryEditSource) : directoryEditBytes()) && ready(), 'original Edit bytes restored', 15000);
      }
      send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
      const { spawnSync } = await import('node:child_process');
      const reader = `import {Session} from './dist/session.js'; import path from 'node:path'; const s=Session.open(process.argv[1],{id:process.argv[2]});
        const result=id=>s.events.find(e=>e.kind==='tool_result'&&e.result.tool_use_id===id)?.result;
        const backups=s.directoryBackups.map(b=>b.kind==='valid'?{tool:b.witness.toolUseId,path:b.witness.lexicalPath,
          digest:b.witness.editInputDigest,bytes:s.readDirectoryBackup(b.id)?.toString('base64')}:b.kind);
        const notebook=path.join(process.argv[1],'value.ipynb'), entry=s.fileReadCache.get(notebook);
        process.stdout.write(JSON.stringify({notebookCell:entry?JSON.parse(entry.content).cells[0].source:undefined,
          notebookInode:entry?.identity?.ino, externalError:result('external-edit')?.is_error===true,workspaceSuccess:!!result('workspace-edit')&&!result('workspace-edit').is_error,
          backups, publications:s.directoryPublications.map(p=>[p.kind,!!p.retained]),
          externalDigest:s.events.find(e=>e.kind==='tool_start'&&e.id==='external-edit')?.editInputDigest,
          workspaceDigest:s.events.find(e=>e.kind==='tool_start'&&e.id==='workspace-edit')?.editInputDigest,
          externalHistory:s.events.some(e=>e.kind==='file_history'&&e.path&&path.resolve(process.argv[1],e.path)===process.argv[3]),
          externalEffect:s.events.some(e=>e.kind==='tool_effect'&&e.result.tool_use_id==='external-edit'&&!e.result.is_error)}));await s.close();`;
      for (let i = 0; i < 2; i++) {
        const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, id, path.join(outside, directoryEditFile)], { cwd: root, encoding: 'utf8' });
        assert.equal(cold.status, 0, cold.stderr);
        const target = path.join(outside,directoryEditFile);
        const fingerprint = args => createHash('sha256').update(JSON.stringify(args)).digest('hex');
        const digest = fingerprint(directoryEditTool === 'notebook_edit' ? ['notebook_edit',target,'fixture','CLI_EDIT_MARKER',null,'replace',null] :
          ['edit_file', target, directorySecret, 'CLI_EDIT_MARKER', false]);
        const beforeNotebookEdit = source => {
          const nb = JSON.parse(directoryEditSource);
          nb.cells.push({cell_type:'markdown',id:insertedId,source,metadata:{}});
          return JSON.stringify(nb,null,1);
        };
        assert.deepEqual(JSON.parse(cold.stdout), { externalError: true, workspaceSuccess: true, externalHistory: false, externalEffect: false,
          ...(directoryEditTool === 'notebook_edit' && !notebookPublication ? { notebookCell:'CLI_EDIT_MARKER', notebookInode:String(fs.statSync(path.join(workspace,directoryEditFile),{bigint:true}).ino) } : {}),
          publications: notebookPublication ? Array.from({length:3},()=>['durable',true]) : directoryEditBackup ? [['durable',true]] : [],
          backups: notebookPublication ? [['external-edit',digest,directoryEditSource],
            ['external-insert',fingerprint(['notebook_edit',target,'fixture','inserted text','markdown','insert',insertedId]),directoryEditSource],
            ['external-replace',fingerprint(['notebook_edit',target,insertedId,'edited text',null,'replace',null]),beforeNotebookEdit('inserted text')],
            ['external-delete',fingerprint(['notebook_edit',target,'fixture','',null,'delete',null]),beforeNotebookEdit('edited text')]]
            .map(([tool,digest,original])=>({tool,path:target,digest,bytes:Buffer.from(original).toString('base64')})) :
            directoryEditBackup ? [['external-edit',digest],...[false,true].map(all=>[all?'external-edit-all':'external-edit-ambiguous',createHash('sha256').update(JSON.stringify([
            'edit_file',path.join(outside,directoryEditFile),'first\nsecond','updated',all])).digest('hex')])].map(([tool,digest]) =>
              ({tool,path:path.join(outside,directoryEditFile),digest,bytes:directoryEditBytes().toString('base64')})) : [],
          externalDigest: digest });
      }
      console.log(JSON.stringify({ cli: 'passed', directoryEditTool, directoryReplaced: !directoryEditBackup && !notebookPublication, coldProcesses: 2, gateway: 'owned loopback SSE' }));
      break run;
    }
    if (directoryRetainedPublication) {
      const target = path.join(outside, 'value.txt'), original = fs.statSync(target, { bigint: true });
      send('write both fixtures\r');
      await until(() => frame().includes('DIRECTORY_TURN_3_COMPLETE') && ready(), 'retained publication turn', 15000);
      const results = requests[3].messages.flatMap(message => Array.isArray(message.content) ? message.content : []).filter(block => block.type === 'tool_result');
      const read = results.find(result => result.tool_use_id === 'read-before-write');
      assert.ok(read && !read.is_error && JSON.stringify(read.content).includes('original text'), JSON.stringify(read));
      const external = results.find(result => result.tool_use_id === 'external-write'), local = results.find(result => result.tool_use_id === 'workspace-write');
      assert.notEqual(external?.is_error, true, JSON.stringify(external)); assert.notEqual(local?.is_error, true, JSON.stringify(local));
      assert.ok(external && local);
      assert.equal(fs.readFileSync(target, 'utf8'), 'CLI_WRITE_MARKER'); assert.equal(fs.statSync(target).mode & 0o7777, 0o751);
      assert.equal(fs.readFileSync(path.join(workspace, 'written.txt'), 'utf8'), 'CLI_WRITE_MARKER');
      const dir = path.join(workspace, '.agent'), name = fs.readdirSync(dir).find(value => value.endsWith('.jsonl'));
      assert.ok(name);
      const events = fs.readFileSync(path.join(dir, name), 'utf8').trimEnd().split('\n').map(row => JSON.parse(row));
      const id = events[0].id, publications = events.filter(row => row.kind === 'directory_publication_result');
      assert.equal(publications.length, 1);
      const publication = publications[0]; assert.equal(publication.outcome.kind, 'durable');
      assert.deepEqual(fs.readFileSync(path.join(outside, `.litcode-replace-${publication.id}`, 'held')), directoryBackupBytes);
      send('/checkpoint-archive-held\r');
      await until(() => frame().includes(publication.id) && frame().includes('publications') && ready(), 'list retained writes', 15000);
      send(`/checkpoint-archive-held ${publication.id}\r`);
      await until(() => frame().includes('"archived"') && ready(), 'archive held original', 15000);
      const slot = `.litcode-replace-${publication.id}`;
      assert.equal(fs.existsSync(path.join(outside, slot)), false);
      const archived = path.join(dir, name + '.retained-archive', slot, 'held');
      assert.equal(fs.statSync(archived, { bigint: true }).ino, original.ino);
      assert.deepEqual(fs.readFileSync(archived), directoryBackupBytes);
      assert.equal(fs.readFileSync(target, 'utf8'), 'CLI_WRITE_MARKER');
      send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
      const { spawnSync } = await import('node:child_process');
      const reader = `import {Session} from './dist/session.js';const s=Session.open(process.argv[1],{id:process.argv[2]}),signal=new AbortController().signal;
        const records=s.directoryPublications,grant=()=>s.workingDirectories(false).readHandle?.(process.argv[3]);
        const before=s.observeRetainedDirectoryPublication({id:process.argv[4],grant:grant(),signal}).kind;
        const denied=s.archiveRetainedDirectoryPublication(process.argv[4],signal).kind;
        s.adoptPermissionUpdates([{type:'addDirectories',directories:[process.argv[3]],destination:'session'}]);
        const after=s.observeRetainedDirectoryPublication({id:process.argv[4],grant:grant(),signal}).kind;
        const retry=s.archiveRetainedDirectoryPublication(process.argv[4],signal).kind;
        process.stdout.write(JSON.stringify({records,before,denied,after,retry}));await s.close();`;
      for (let i = 0; i < 2; i++) {
        const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, id, outside, publication.id], { cwd: root, encoding: 'utf8' });
        assert.equal(cold.status, 0, cold.stderr); const result = JSON.parse(cold.stdout);
        assert.equal(result.before, 'unknown'); assert.equal(result.after, 'observed'); assert.equal(result.records[0]?.kind, 'durable'); assert.equal(result.records[0]?.id, publication.id);
        assert.equal(result.records[0]?.retained?.held?.ino, String(original.ino));
        assert.equal(result.retry, 'observed');
        assert.equal(result.denied, 'unknown');
      }
      const archiveRoot = path.dirname(path.dirname(archived)), parked = archiveRoot + '-parked';
      fs.renameSync(archiveRoot, parked);
      fs.mkdirSync(archiveRoot, {mode: 0o700});
      fs.renameSync(path.join(parked, slot), path.join(archiveRoot, slot));
      const checkConflict = () => {
        const run = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, id, outside, publication.id], { cwd: root, encoding: 'utf8' });
        assert.equal(run.status, 0, run.stderr);
        const result = JSON.parse(run.stdout);
        assert.equal(result.after, 'unknown'); assert.equal(result.retry, 'unknown');
      };
      checkConflict();
      fs.renameSync(path.join(archiveRoot, slot), path.join(outside, slot));
      fs.rmdirSync(archiveRoot);
      checkConflict();
      assert.equal(fs.statSync(path.join(outside, slot, 'held'), {bigint:true}).ino, original.ino);
      fs.rmdirSync(archiveRoot);
      fs.renameSync(parked, archiveRoot);
      fs.renameSync(path.join(outside, slot), path.join(archiveRoot, slot));
      console.log(JSON.stringify({ cli: 'passed', directoryRetainedPublication: true, coldProcesses: 4, gateway: 'owned loopback SSE' }));
      break run;
    }
    if (directoryMixedRewind) {
      const target = path.join(outside, 'written.txt'), local = path.join(workspace, 'written.txt');
      send('write both fixtures\r');
      await until(() => frame().includes('DIRECTORY_TURN_3_COMPLETE') && ready(), 'mixed initial Write turn', 15000);
      assert.equal(fs.readFileSync(target, 'utf8'), 'CLI_WRITE_MARKER');
      assert.equal(fs.readFileSync(local, 'utf8'), 'CLI_WRITE_MARKER');
      // Owned setup supplies the exact binary/mode baseline and later edits.
      fs.writeFileSync(target, directoryBackupBytes); fs.chmodSync(target, directoryCreateCut?.startsWith('zero:') ? 0 : 0o751);
      if (directoryCreateCut?.startsWith('zero:')) execFileSync('/bin/chmod', ['+a', `user:${os.userInfo().username} allow read,readattr,readextattr,readsecurity`, target]);
      if (mixedRemove || directoryMixedReceipt === 'reverse-linked' || (directoryRetainedCreate && directoryMixedReceipt?.startsWith('reverse'))) fs.unlinkSync(target);
      fs.writeFileSync(local, 'WORKSPACE_BEFORE');
      send('/checkpoint mixed-before\r');
      await until(() => frame().includes('mixed-before') && frame().includes('"external_witness": "available"') && ready(), 'mixed checkpoint', 15000);
      if (zeroPublished && directoryMixedReceipt?.startsWith('reverse')) {
        fs.writeFileSync(target, 'EXTERNAL_AFTER'); fs.chmodSync(target, 0);
        execFileSync('/bin/chmod', ['+a', `user:${os.userInfo().username} allow read,readattr,readextattr,readsecurity`, target]);
      } else if (!directoryCreateCut?.startsWith('zero:')) { fs.writeFileSync(target, 'EXTERNAL_AFTER'); fs.chmodSync(target, 0o640); }
      if (directoryMixedReceipt === 'forward-linked' || (directoryRetainedCreate && directoryMixedReceipt?.startsWith('forward'))) fs.unlinkSync(target);
      fs.writeFileSync(local, 'WORKSPACE_AFTER');
      send('observe changed fixtures\r');
      await until(() => frame().includes('DIRECTORY_TURN_4_COMPLETE') && ready(), 'mixed later turn', 15000);
      send('/rewind 1 --files\r');
      const applyPattern = /Apply: \/rewind 1 --files --apply ([a-f0-9]{64})/;
      await until(() => applyPattern.test(frame()) && ready(), 'mixed preview', 15000);
      assert.match(frame(), /written\.txt/);
      const token = applyPattern.exec(frame())[1];
      const initialTarget = fs.existsSync(target) ? fs.statSync(target, { bigint: true }) : undefined;
      send(`/rewind 1 --files --apply ${token}\r`);
      if (directoryMixedCold) {
        assert.equal(await Promise.race([exited, delay(15000).then(() => 'timeout')]), 73);
        const pending = path.join(workspace, '.agent/checkpoints/transaction.json'), original = fs.readFileSync(pending);
        const transaction = JSON.parse(original.toString());
        assert.equal(transaction.state, directoryMixedColdRollback || mixedMarkerCrash ? 'pending' : 'committed');
        delete env.NODE_OPTIONS; screen.write('\x1bc');
        if (directoryLinkedPreparation) {
          const preload = path.join(temporary, 'linked-preparation.mjs');
          fs.writeFileSync(preload, `import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
const native=childProcess.spawnSync,points=${JSON.stringify(linkedFaultPoints)},linkedError=${JSON.stringify(linkedError ?? '')};let attempts=0;
childProcess.spawnSync=function(...args){if(Array.isArray(args[1])&&args[1].includes('--normalize-linked')&&attempts<points.length){
  const point=points[attempts++];
  args[0]=${JSON.stringify(path.join(temporary, 'directory-write-test'))};args[2]={...args[2],env:{...process.env,
    DIRECTORY_WRITE_TEST_RECEIPT_CUT:point.startsWith('receipt-partial:')?point.split(':')[1]:undefined,
    DIRECTORY_WRITE_TEST_POINT:point.startsWith('receipt-partial:')?'receipt_partial_intent':point,DIRECTORY_WRITE_TEST_SHORT_READ:'1',
    DIRECTORY_WRITE_TEST_FAIL:linkedError?'1':undefined,DIRECTORY_WRITE_TEST_ERROR_CUT:linkedError==='partial'?'10':undefined,DIRECTORY_WRITE_TEST_SELF_KILL:linkedError?undefined:'1'}};}
  return native.apply(this,args);};syncBuiltinESMExports();`);
          env.NODE_OPTIONS = `--import=${preload}`;
        }
        if (directoryMixedCleanupCrash) {
          const preload = path.join(temporary, 'mixed-cleanup-crash.mjs');
          fs.writeFileSync(preload, `import fs from 'node:fs';const unlink=fs.unlinkSync;
fs.unlinkSync=function(file){const result=unlink.apply(this,arguments);if(file===${JSON.stringify(path.join(workspace, '.agent', transaction.branch.id + '.jsonl'))})process.exit(74);return result;};`);
          env.NODE_OPTIONS = `--import=${preload}`;
        }
        if (successorInheritanceCrash) {
          const preload = path.join(temporary, 'interrupt-inheritance.mjs');
          fs.writeFileSync(preload, `import {Session} from ${JSON.stringify(path.join(root, 'dist/session.js'))};
Session.prototype.inheritCheckpointWitnesses=function(){process.exit(75)};`);
          env.NODE_OPTIONS = `--import=${preload}`;
        }
        const changeHandoff = directoryMixedSuccessor && directoryMixedColdCompensate;
        if (changeHandoff) {
          const preload = path.join(temporary, 'change-handoff.mjs');
          fs.writeFileSync(preload, `import fs from 'node:fs';import {randomUUID} from 'node:crypto';
import {Session} from ${JSON.stringify(path.join(root, 'dist/session.js'))};
const close=Session.prototype.close;
Session.prototype.close=function(){const releasing=this.isOpen && this.id===${JSON.stringify(transaction.branch.id)};
  const result=close.call(this);if(releasing){const file=${JSON.stringify(pending)},tx=JSON.parse(fs.readFileSync(file));
    tx.id=randomUUID();fs.writeFileSync(file,JSON.stringify(tx));}return result;};`);
          env.NODE_OPTIONS = `--import=${preload}`;
        }
        start(['--resume', directoryMixedSuccessor ? transaction.branch.id : transaction.branch.source, '--recover-lock']);
        await until(ready, 'mixed cold source resume', 15000);
        send('/checkpoint-recover\r');
        await until(() => frame().includes('error: External rewind') && ready(), 'mixed recovery without grant refused', 15000);
        assert.deepEqual(fs.readFileSync(pending), original);
        send(`/add-dir ${outside}\r`);
        await until(() => frame().includes('Added') && ready(), 'mixed recovery regrant', 15000);
        send('/checkpoint-recover\r');
        if (changeHandoff) {
          await until(() => frame().includes('error: External rewind transac') && ready() &&
            frame().includes(transaction.branch.source), 'changed handoff refused', 15000);
          const changed = JSON.parse(fs.readFileSync(pending));
          assert.notEqual(changed.id, transaction.id);
          assert.deepEqual({ ...changed, id: transaction.id }, transaction);
          assert.equal(fs.statSync(path.join(workspace, '.agent', transaction.branch.id + '.jsonl')).ino, transaction.branch.inode);
          assert.deepEqual(fs.readFileSync(target), directoryBackupBytes);
          assert.equal(fs.readFileSync(local, 'utf8'), 'WORKSPACE_BEFORE');
          fs.writeFileSync(pending, original);
          send('/checkpoint-recover\r');
        }
        if (zeroPublished) {
          await until(() => frame().includes('error: External rewind needs read') && ready(), 'published byte verification needs access', 15000);
          assert.deepEqual(fs.readFileSync(pending), original);
          assert.throws(() => fs.readFileSync(target), { code: 'EACCES' });
          const before = fs.statSync(target, { bigint: true });
          execFileSync('/bin/chmod', ['+a', `user:${os.userInfo().username} allow read,readattr,readextattr,readsecurity`, target]);
          assert.equal(fs.statSync(target, { bigint: true }).ino, before.ino);
          assert.equal(fs.statSync(target).mode & 0o7777, 0);
          send('/checkpoint-recover\r');
        }
        if (directoryLinkedPreparation) {
          for (let retry = 0; retry < linkedFaultPoints.length; retry++) {
            await until(() => {
              if (!fs.existsSync(pending) || !frame().includes('error: External rewind linked nor') || !ready()) return false;
              const operation = JSON.parse(fs.readFileSync(pending, 'utf8')).directory.operations[0];
              const normalization = directoryMixedReceipt === 'forward-linked' ? operation.normalization : operation.rollbackNormalization;
              return normalization && (operation.abandonedNormalizations?.length ?? 0) === retry &&
                fs.readFileSync(path.join(workspace, '.agent/checkpoints', `native-attempt-${normalization.id}.receipt`), 'utf8').startsWith('directory-write-receipt-v2\nstart\n');
            }, 'normalization preparation interrupted', 15000);
            if (linkedFaultPoints[retry] === 'replace_after_capture') assert.equal(fs.existsSync(target), false);
            else assert.equal(fs.statSync(target).nlink, linkedFaultPoints[retry] === 'replace_after_publish' ? 1 : 2);
            send('/checkpoint-recover\r');
          }
        }
        if (directoryMixedCleanupCrash) {
          assert.equal(await Promise.race([exited, delay(15000).then(() => 'timeout')]), 74);
          assert.equal(fs.existsSync(path.join(workspace, '.agent', transaction.branch.id + '.jsonl')), false);
          const archived = path.join(workspace, '.agent/checkpoints', `rollback-branch-${transaction.id}.jsonl`);
          assert.equal(fs.statSync(archived).ino, transaction.branch.inode);
          assert.deepEqual(fs.readFileSync(pending), original);
          delete env.NODE_OPTIONS; screen.write('\x1bc');
          start(['--resume', transaction.branch.source, '--recover-lock']);
          await until(ready, 'mixed cleanup crash resume', 15000);
          send(`/add-dir ${outside}\r`);
          await until(() => frame().includes('Added') && ready(), 'mixed cleanup crash regrant', 15000);
          send('/checkpoint-recover\r');
        }
        if (successorInheritanceCrash) {
          assert.equal(await Promise.race([exited, delay(15000).then(() => 'timeout')]), 75);
          assert.equal(fs.existsSync(pending), false);
          const archive = path.join(path.dirname(pending), `directory-rewind-${transaction.id}.json`);
          const receipt = fs.readFileSync(archive), changed = JSON.parse(receipt);
          changed.branch.prefixSha256 = '0'.repeat(64);
          fs.writeFileSync(archive, JSON.stringify(changed));
          const probe = `import {Session} from './dist/session.js';
            const [root,id]=process.argv.slice(1),s=Session.open(root,{id,recoverLock:true});
            try {console.log((await s.reconcileResumedCheckpointInheritance({recoverLock:true})).kind);}
            finally {await s.close();}`;
          const journal = path.join(workspace, '.agent', transaction.branch.id + '.jsonl'), before = fs.readFileSync(journal);
          assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', probe, workspace, transaction.branch.id],
            { cwd: root, encoding: 'utf8', timeout: 15000 }).trim(), 'unknown');
          assert.deepEqual(fs.readFileSync(journal), before);
          fs.writeFileSync(archive, receipt);
          delete env.NODE_OPTIONS; screen.write('\x1bc');
          start(['--resume', transaction.branch.id, '--recover-lock']);
          await until(ready, 'successor inheritance restart', 15000);
        } else await until(() => frame().includes(`"recovery": "${directoryMixedColdRollback ? 'rolled_back' : 'committed'}"`) && ready(), 'mixed cold recovery', 15000);
        send('/checkpoint-recover\r');
        await until(() => frame().includes('"recovery": "none"') && ready(), 'mixed cold repeat recovery', 15000);
      } else await until(() => frame().includes(directoryMixedRollback ? 'Rewind was not applied; the session was resumed.' : 'External checkpoint file operations completed.') && ready(), 'mixed rewind completion', 15000);
      assert.doesNotMatch(frame(), /those files were not restored/);
      const expectedBytes = (mixedRemove && !directoryMixedRollback) || directoryMixedReceipt === 'forward-linked' || (directoryRetainedCreate && directoryMixedReceipt?.startsWith('forward')) ? undefined : directoryMixedRollback ? Buffer.from('EXTERNAL_AFTER') : directoryBackupBytes;
      const expectedLocal = directoryMixedRollback ? 'WORKSPACE_AFTER' : 'WORKSPACE_BEFORE';
      if (expectedBytes) {
        assert.deepEqual(fs.readFileSync(target), expectedBytes);
        assert.equal(fs.statSync(target).mode & 0o7777, zeroPublished ? 0 : directoryMixedRollback ? 0o640 : 0o751);
      } else assert.equal(fs.existsSync(target), false);
      assert.equal(fs.readFileSync(local, 'utf8'), expectedLocal);
      const store = path.join(workspace, '.agent/checkpoints');
      const receipts = fs.readdirSync(store).filter(name => name.startsWith(directoryMixedRollback ? 'directory-rollback-' : 'directory-rewind-'));
      assert.equal(receipts.length, 1);
      const receipt = JSON.parse(fs.readFileSync(path.join(store, receipts[0]), 'utf8'));
      assert.equal(receipt.state, directoryMixedRollback || mixedMarkerCrash ? 'pending' : 'committed');
      const noForwardEffect = directoryMixedReceipt === 'forward-untouched';
      if (directoryMixedSuccessor) {
        send('/checkpoint-archive-held\r');
        await until(() => frame().includes('recordedRewindHolds') && ready(), 'list recorded rewind holds', 15000);
      }
      assert.equal(receipt.directory.operations[0].stage.kind, noForwardEffect ? 'refused' : 'completed');
      if (noForwardEffect) {
        assert.equal(receipt.directory.operations[0].rollback, undefined);
        if (initialTarget) assert.equal(fs.statSync(target, { bigint: true }).ino, initialTarget.ino);
        else assert.equal(fs.existsSync(target), false);
      } else if (directoryMixedRollback) assert.equal(receipt.directory.operations[0].rollback.kind, 'completed');
      if (directoryMixedReceipt?.endsWith('-untouched')) {
        const abandoned = receipt.directory.operations[0].noEffectAttempts;
        assert.equal(abandoned.length, 1); assert.equal(abandoned[0].reverse, !noForwardEffect);
        assert.ok(fs.existsSync(path.join(store, `native-attempt-${abandoned[0].id}.receipt`)));
        if (directoryRetainedCreate) {
          const publicationCut = directoryCreateCut?.includes('torn:') || ['create_before_mode', 'create_after_mode', 'create_after_recheck', 'create_after_publish'].includes(directoryCreateCut?.replace(/^zero:/, '').replace(/^error:|^partial:[0-9]+:/, ''));
          assert.equal(abandoned[0].creation.evidence.phase, directoryCreateCut && directoryCreateCut !== 'create_publication_persisted' && !publicationCut ? 'preparing' : 'publishing');
          assert.equal(createHash('sha256').update(fs.readFileSync(path.join(store, `native-attempt-${abandoned[0].creation.evidence.id}.receipt`))).digest('hex'), abandoned[0].creation.digest);
          if (directoryCreateCut?.startsWith('zero:')) {
            assert.equal(abandoned[0].preparation.kind, 'metadata');
            assert.equal(abandoned[0].preparation.content, 'unverified');
            const retained = path.join(outside, `.litcode-create-${abandoned[0].creation.evidence.id}`, 'staged');
            assert.equal(String(fs.statSync(retained, { bigint: true }).ino), abandoned[0].preparation.observation.ino);
            assert.equal(fs.statSync(retained).mode & 0o7777, 0);
            assert.throws(() => fs.readFileSync(retained), { code: 'EACCES' });
          }
        }
        if (directoryEarlyPreparation) {
          assert.equal(abandoned[0].preparation.kind, 'retained');
          assert.equal(abandoned[0].preparation.staged.kind, 'present');
          if (directoryEarlyTorn) assert.ok(abandoned[0].preparation.staged.content.bytes > 0);
          else assert.equal(abandoned[0].preparation.staged.content.bytes, 0);
          assert.equal(createHash('sha256').update(fs.readFileSync(path.join(store, `native-attempt-${abandoned[0].id}.receipt`))).digest('hex'), abandoned[0].digest);
        }
      }
      if (directoryMixedReceipt?.endsWith('-linked')) {
        const operation = receipt.directory.operations[0], normalization = directoryMixedReceipt === 'forward-linked' ? operation.normalization : operation.rollbackNormalization;
        assert.match(normalization.completedReceiptDigest, /^[a-f0-9]{64}$/);
        assert.equal(fs.statSync(path.join(outside, normalization.alias)).nlink, 2);
        assert.equal(fs.statSync(path.join(outside, normalization.alias)).ino, fs.statSync(path.join(outside, `.litcode-linked-${normalization.id}`, 'held')).ino);
        if (directoryLinkedPreparation) {
          assert.equal(operation.abandonedNormalizations.length, linkedPreparationPoints.length);
          if (linkedError) {
            const receipt = fs.readFileSync(path.join(store, `native-attempt-${normalization.id}.receipt`));
            const marker = linkedError === 'complete' ? 'renamed\nerror unknown 5\nexit 1\n' : 'captured\nerror unkn';
            assert.ok(receipt.toString().endsWith(marker));
            assert.equal(normalization.completedReceiptDigest, createHash('sha256').update(receipt).digest('hex'));
          }
          for (const abandoned of operation.abandonedNormalizations) {
            assert.notEqual(abandoned.normalization.id, normalization.id);
            assert.equal(createHash('sha256').update(fs.readFileSync(path.join(store, `native-attempt-${abandoned.normalization.id}.receipt`))).digest('hex'), abandoned.digest);
            const retained = path.join(outside, `.litcode-linked-${abandoned.normalization.id}`);
            if (abandoned.preparation?.kind === 'absent') assert.equal(fs.existsSync(retained), false);
            else if (abandoned.preparation?.staged.kind === 'missing') assert.equal(fs.existsSync(path.join(retained, 'staged')), false);
            else assert.equal(fs.statSync(path.join(retained, 'staged')).nlink, 1);
          }
        }
      }
      assert.equal(fs.existsSync(path.join(store, 'transaction.json')), false);
      if (directoryMixedRollback || directoryMixedCold) {
        send('continue after compensated rewind\r');
        await until(() => frame().includes('DIRECTORY_TURN_5_COMPLETE') && ready(), 'continued compensated session', 15000);
      }
      const testArchive = (directoryMixedSuccessor || (directoryMixedRollback && !directoryMixedCold)) && !directoryMixedReceipt && !directoryRetainedCreate;
      if (testArchive) {
        const slots = receipt.directory.operations.flatMap(op => [op.stage, op.rollback].flatMap(stage => {
          if (stage?.kind !== 'completed') return [];
          const held = stage.result.kind === 'quarantined' ? stage.result.observation : stage.result.held;
          return held ? [{ name: `.litcode-${stage.result.kind === 'quarantined' ? 'remove' : 'replace'}-${stage.id}`, held }] : [];
        }));
        assert.ok(slots.length);
        const archive = path.join(store, 'held-archive-' + receipt.id);
        fs.writeFileSync(target, 'USER_EDIT_AFTER_REWIND');
        const nativeReceipt = path.join(store, 'native-attempt-' + receipt.directory.operations[0].stage.id + '.receipt');
        fs.renameSync(nativeReceipt, nativeReceipt + '.original');
        fs.copyFileSync(nativeReceipt + '.original', nativeReceipt);
        send(`/checkpoint-archive-held ${receipt.id}\r`);
        await until(() => frame().includes('Native receipt identity') && ready(), 'reject substituted native receipt', 15000);
        assert.ok(slots.every(slot => fs.existsSync(path.join(outside, slot.name, 'held'))));
        fs.renameSync(nativeReceipt + '.original', nativeReceipt);
        if (slots.length === 2) {
          fs.mkdirSync(archive, { mode: 0o700 });
          const occupied = path.join(archive, slots[1].name);
          fs.mkdirSync(occupied, { mode: 0o700 });
          send(`/checkpoint-archive-held ${receipt.id}\r`);
          await until(() => frame().includes('Rewind hold archive unconf') && ready(), 'archive slot conflict', 15000);
          assert.equal(String(fs.statSync(path.join(archive, slots[0].name, 'held'), { bigint: true }).ino), slots[0].held.ino);
          assert.equal(String(fs.statSync(path.join(outside, slots[1].name, 'held'), { bigint: true }).ino), slots[1].held.ino);
          fs.rmdirSync(occupied);
        }
        for (let i = 0; i < 2; i++) {
          send(`/checkpoint-archive-held ${receipt.id}\r`);
          await until(() => frame().split('"files":' + slots.length).length > i + 1 && ready(), 'archive mixed rewind holds', 15000);
          for (const slot of slots) {
            assert.equal(fs.existsSync(path.join(outside, slot.name)), false);
            assert.equal(String(fs.statSync(path.join(archive, slot.name, 'held'), { bigint: true }).ino), slot.held.ino);
          }
        }
        assert.equal(fs.readFileSync(target, 'utf8'), 'USER_EDIT_AFTER_REWIND');
        if (expectedBytes) fs.writeFileSync(target, expectedBytes);
        else fs.unlinkSync(target);
      }
      send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
      const { spawnSync } = await import('node:child_process');
      const reader = `import fs from 'node:fs';import {Session} from './dist/session.js';
        const [workspace,id,outside,target,local]=process.argv.slice(1),s=Session.open(workspace,{id});
        if (${directoryMixedSuccessor}) {
          const {archiveRewindHolds,listRecordedRewindHolds}=await import('./dist/checkpoints.js');
          const holds=listRecordedRewindHolds(s);
          const expected=${JSON.stringify(receipt.directory.operations.flatMap(op => [['forward', op.stage], ['rollback', op.rollback]]
            .filter(([, stage]) => stage?.kind === 'completed' && (stage.result.kind === 'quarantined' || stage.result.held))
            .map(([phase, stage]) => ({transaction:receipt.id,attempt:stage.id,phase,disposition:directoryMixedRollback?'rolled_back':'committed',
              operation:stage.result.kind === 'quarantined'?'remove':'replace'}))))};
          if(JSON.stringify(holds)!==JSON.stringify(expected))throw Error('Recorded rewind holds differ from terminal receipt');
          if (${!directoryMixedReceipt && !directoryRetainedCreate}) {
            const {strict:assert}=await import('node:assert');
            const retry=()=>archiveRewindHolds(s,${JSON.stringify(receipt.id)},s.closeSignal);
            assert.throws(retry,/explicit grant/);
            s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
            assert.equal(retry(),expected.length);
            const archive=${JSON.stringify(path.join(store,'held-archive-'+receipt.id))},parked=archive+'-parked';
            fs.renameSync(archive,parked);fs.mkdirSync(archive,{mode:0o700});
            for(const slot of fs.readdirSync(parked))fs.renameSync(parked+'/'+slot,archive+'/'+slot);
            assert.throws(retry,/archive unconfirmed/);
            for(const slot of fs.readdirSync(archive))fs.renameSync(archive+'/'+slot,parked+'/'+slot);
            fs.rmdirSync(archive);fs.renameSync(parked,archive);
            assert.equal(retry(),expected.length);
            s.adoptPermissionUpdates([{type:'removeDirectories',directories:[outside],destination:'session'}]);
          }
        }
        if (${directoryMixedSuccessor && directoryMixedRollback}) {
          if (fs.existsSync(${JSON.stringify(path.join(workspace, '.agent', receipt.branch.id + '.jsonl'))}) ||
              !s.events.some(e=>e.kind==='message' && e.message.role==='user' && JSON.stringify(e.message.content).includes('continue after compensated rewind')))
            throw Error('Rollback did not hand the conversation back to the original session');
          const archived=fs.statSync(${JSON.stringify(path.join(store, 'rollback-branch-' + receipt.id + '.jsonl'))});
          if(archived.ino!==${JSON.stringify(receipt.branch.inode)})throw Error('Rollback branch archive identity differs');
        }
        if (${directoryMixedSuccessor && !directoryMixedRollback}) {
          const {readDirectoryCheckpointBackup}=await import('./dist/rewind.js');
          const refs=s.events.filter(e=>e.kind==='directory_checkpoint_inheritance');
          if(refs.length!==1 || readDirectoryCheckpointBackup(s,'mixed-before',target)?.toString('hex')!==${mixedRemove ? 'undefined' : JSON.stringify(directoryBackupBytes.toString('hex'))})
            throw Error('Successor checkpoint backup unavailable after reopen');
        }
        process.stdout.write(JSON.stringify({grant:!!s.workingDirectories(false).readHandle?.(outside),
          bytes:fs.existsSync(target)?fs.readFileSync(target).toString('hex'):null,local:fs.readFileSync(local,'utf8')}));await s.close();`;
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, directoryMixedCold && !directoryMixedSuccessor || directoryMixedRollback ? receipt.branch.source : receipt.branch.id, outside, target, local], { cwd: root, encoding: 'utf8' });
      assert.equal(cold.status, 0, cold.stderr);
      assert.deepEqual(JSON.parse(cold.stdout), { grant: false, bytes: expectedBytes?.toString('hex') ?? null, local: expectedLocal });
      console.log(JSON.stringify({ cli: 'passed', directoryMixedRewind: true, directoryMixedRollback, directoryMixedCold, directoryMixedCleanupCrash, directoryMixedColdCompensate, directoryMixedReceipt, directoryRetainedCreate, directoryCreateCut, coldProcesses: 1, gateway: 'owned loopback SSE' }));
      break run;
    }
    if (directoryWrite) {
      let conversationRewind;
      if (directorySelection) {
        send('capture earlier directory snapshot\r');
        await until(() => frame().includes('DIRECTORY_SELECTION_READY') && ready(), 'earlier directory snapshot', 15000);
        if (!directoryHistoryDisabled) {
          send('/checkpoint selection-boundary\r');
          await until(() => frame().includes('selection-boundary') && frame().includes('checkpoint_digest') && ready(), 'directory selection checkpoint', 15000);
        }
      }
      send('write both fixtures\r');
      await until(() => frame().includes('DIRECTORY_TURN_3_COMPLETE') && ready(), 'directory write turn', 15000);
      const results = requests[directorySelection ? 3 : 2].messages.flatMap(message => Array.isArray(message.content) ? message.content : []).filter(block => block.type === 'tool_result');
      const externalResult = results.find(result => result.tool_use_id === 'external-write');
      const workspaceResult = results.find(result => result.tool_use_id === 'workspace-write');
      assert.equal(externalResult?.is_error, true, JSON.stringify(results));
      assert.match(JSON.stringify(externalResult), directoryBackup
        ? /File has not been read in full/
        : /writes through additional directory grants are not implemented/);
      assert.notEqual(workspaceResult?.is_error, true, JSON.stringify(results));
      assert.equal(fs.existsSync(path.join(outside, 'written.txt')), false);
      if (directoryBackup) assert.deepEqual(fs.readFileSync(path.join(outside, 'value.txt')), directoryBackupBytes);
      assert.equal(fs.readFileSync(path.join(workspace, 'written.txt'), 'utf8'), 'CLI_WRITE_MARKER');
      if (directorySelection && !directoryHistoryDisabled) {
        send('/checkpoint selection-tracked\r');
        if (directoryCheckpointCrash) {
          const marker = path.join(temporary, 'directory-checkpoint-crash.json');
          await until(() => fs.existsSync(marker), 'committed checkpoint witness barrier', 15000);
          const { id } = JSON.parse(fs.readFileSync(marker, 'utf8'));
          process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGKILL');
          await Promise.race([exited, delay(6000).then(() => { throw new Error('CLI did not exit'); })]);
          fs.writeFileSync(path.join(outside, 'value.txt'), 'AFTER_CRASH');
          const { spawnSync } = await import('node:child_process');
          const reader = `import {setTimeout as delay} from 'node:timers/promises';import {Session} from './dist/session.js';import {forkSession} from './dist/sessions.js';
            import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './dist/rewind.js';
            const [root,id,outside,mode]=process.argv.slice(1);let s;const deadline=Date.now()+5000;
            while(!s){try{s=Session.open(root,{id,recoverLock:mode==='recover'})}catch(error){if(!String(error).includes('Session lock busy')||Date.now()>deadline)throw error;await delay(25)}}
            const fork=mode==='fork'?forkSession(s):undefined,current=fork??s,w=inspectDirectoryCheckpointWitness(current,'selection-tracked');
            process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(current,'selection-tracked',outside+'/value.txt')?.toString('hex')??null,
              grant:!!current.workingDirectories(false).readHandle?.(outside)}));await fork?.close();await s.close();`;
          for (const mode of ['recover', 'source', 'fork', 'fork']) {
            const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, id, outside, mode], { cwd: root, encoding: 'utf8', timeout: 15000 });
            assert.equal(cold.status, 0, cold.stderr);
            assert.deepEqual(JSON.parse(cold.stdout), { kind: 'available', bytes: directoryBackupBytes.toString('hex'), grant: false });
          }
          console.log(JSON.stringify({ cli: 'passed', preparedWitnessCrash: 'after-commit', sourceColdProcesses: 2, forkColdProcesses: 2, gateway: 'owned loopback SSE' }));
          break run;
        }
        await until(() => frame().includes('selection-tracked') && frame().includes('"external_witness": "available"') &&
          frame().includes('"external_tracked_paths": 1') && ready(), 'tracked directory checkpoint', 15000);
      }
      if (directoryBackup && !directoryHistoryDisabled) {
        fs.writeFileSync(path.join(outside, 'value.txt'), directorySnapshotBytes);
        fs.chmodSync(path.join(outside, 'value.txt'), 0o640);
        send('snapshot updated fixture\r');
        if (directoryRecovery) {
          await until(() => fs.existsSync(path.join(temporary, 'directory-history-barrier')), 'directory snapshot crash barrier', 15000);
          process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGKILL');
          await Promise.race([exited, delay(6000).then(() => { throw new Error('CLI did not exit'); })]);
          const target = path.join(outside, 'value.txt'); fs.writeFileSync(target, 'AFTER_CRASH');
          const dir = path.join(workspace, '.agent'), name = fs.readdirSync(dir).find(value => value.endsWith('.jsonl'));
          assert.ok(name);
          const journal = path.join(dir, name), before = fs.readFileSync(journal), id = JSON.parse(before.toString('utf8').split('\n')[0]).id;
          const { spawnSync } = await import('node:child_process');
          const reader = `import {Session} from './dist/session.js';const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
            process.stdout.write(JSON.stringify(s.directoryFileHistory));await s.close();`;
          const cold = () => { const p = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, id], { cwd: root, encoding: 'utf8' });
            assert.equal(p.status, 0, p.stderr); return JSON.parse(p.stdout); };
          assert.deepEqual(cold(), { kind: 'unknown' });
          const resume = `import {Session} from './dist/session.js';import {Agent} from './dist/agent.js';
            const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
            const provider={count:async()=>1,complete:async()=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}})};
            const tools=s.config.tools.map(({eager_input_streaming,...schema})=>({schema,readOnly:false,execute:async()=>{throw Error('unexpected tool replay')}}));
            await new Agent(s,provider,tools).run();process.stdout.write(JSON.stringify(s.directoryFileHistory));await s.close();`;
          const p = spawnSync(process.execPath, ['--input-type=module', '-e', resume, workspace, id], { cwd: root, encoding: 'utf8' });
          assert.equal(p.status, 0, p.stderr);
          const recovered = JSON.parse(p.stdout);
          assert.equal(recovered.kind, 'available');
          assert.equal(recovered.snapshots[0].entries[0].reference.kind, 'present');
          assert.deepEqual(recovered.snapshots[1].entries[0].reference, { kind: 'unknown', lastKnownVersion: 1, reason: 'interrupted' });
          for (let i = 0; i < 2; i++) assert.deepEqual(cold(), recovered);
          assert.ok(fs.readFileSync(journal).subarray(0, before.length).equals(before));
          assert.equal(fs.readFileSync(target, 'utf8'), 'AFTER_CRASH');
          console.log(JSON.stringify({ cli: 'passed', directoryRecovery: true, coldProcesses: 3, gateway: 'owned loopback SSE' }));
          break run;
        }
        await until(() => frame().includes('DIRECTORY_TURN_4_COMPLETE') && ready(), 'updated directory snapshot', 15000);
        send('snapshot unchanged fixture\r');
        await until(() => frame().includes('DIRECTORY_TURN_5_COMPLETE') && ready(), 'unchanged directory snapshot', 15000);
      }
      if (directorySelection && !directoryHistoryDisabled) {
        const captureSuccessor = async reason => {
          const name = `selection-${reason}`;
          send(`/checkpoint ${name}\r`);
          await until(() => frame().includes(name) && frame().includes('"external_witness": "available"') &&
            frame().includes('"external_tracked_paths": 1') && ready(), `${reason} directory checkpoint`, 15000);
        };
        if (!directoryWitnessDirect) {
          send('/thinking on\r'); await until(() => frame().includes('Thinking: on') && ready(), 'external configuration branch', 15000);
          await captureSuccessor('configuration');
          send('/reload\r'); await until(() => frame().includes('Local configuration reloaded;') && ready(), 'external reload branch', 15000);
          await captureSuccessor('reload');
        } else fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'CHANGED_BEFORE_TORN_REWIND');
        const selectionTurn = directoryWitnessDirect ? 2 : 1;
        send(`/rewind ${selectionTurn} --files\r`);
        await until(() => frame().includes('"external"') && frame().includes('"unavailable"') && ready(), 'external checkpoint uncertainty', 15000);
        assert.match(frame(), /value\.txt/);
        const applyPattern = new RegExp(`Apply: /rewind ${selectionTurn} --files --apply ([a-f0-9]{64})`);
        await until(() => applyPattern.test(frame()), 'external checkpoint apply token', 15000);
        const token = applyPattern.exec(frame())?.[1]; assert.ok(token, frame());
        const beforeRewindRequests = requests.length, fatalWitness = directoryMarkerConflict || directoryWitnessInvalid;
        send(`/rewind ${selectionTurn} --files --apply ${token}\r${fatalWitness ? 'queued after failed recovery\r' : ''}`);
        if (fatalWitness) {
          const marker = path.join(temporary, directoryMarkerConflict ? 'directory-marker-error.json' : 'directory-inheritance-error.json');
          await until(() => fs.existsSync(marker), 'committed rewind recovery fault', 15000);
          const { id } = JSON.parse(fs.readFileSync(marker, 'utf8'));
          assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
          const issue = directoryMarkerConflict ? 'checkpoint transaction' : 'checkpoint witness';
          assert.match(frame().replaceAll('\n', ''), new RegExp(`Rewind committed in session ${id}; ${issue} and runtime recovery are uncertain`));
          assert.equal(requests.length, beforeRewindRequests);
          if (directoryMarkerConflict) {
            assert.equal(fs.readFileSync(path.join(workspace, 'written.txt'), 'utf8'), 'CONFLICT_AFTER_COMMIT');
            assert.equal(fs.existsSync(path.join(workspace, '.agent/checkpoints/transaction.json')), true);
          } else assert.ok(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.startsWith(`${id}.jsonl.torn-`)));
          const { spawnSync } = await import('node:child_process');
          const reader = `import {Session} from './dist/session.js';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './dist/rewind.js';const s=Session.open(process.argv[1],{id:process.argv[2]});
            process.stdout.write(JSON.stringify({branch:s.events.some(e=>e.kind==='branch'&&e.reason==='rewind'),messages:s.messages,
              grant:!!s.workingDirectories(false).readHandle?.(process.argv[3]),witness:inspectDirectoryCheckpointWitness(s,'selection-tracked').kind,
              bytes:readDirectoryCheckpointBackup(s,'selection-tracked',process.argv[3]+'/value.txt')?.toString('hex')??null}));await s.close();`;
          for (let i = 0; i < 2; i++) {
            const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, id, outside], { cwd: root, encoding: 'utf8' });
            assert.equal(cold.status, 0, cold.stderr); const state = JSON.parse(cold.stdout);
            assert.equal(state.branch, true); assert.equal(state.grant, false);
            if (directoryWitnessTorn) { assert.equal(state.witness, 'unknown'); assert.equal(state.bytes, null); }
            assert.doesNotMatch(JSON.stringify(state.messages), /queued after failed recovery/);
          }
          console.log(JSON.stringify({ cli: 'passed', committedRecoveryFatal: issue, coldProcesses: 2, gateway: 'owned loopback SSE' }));
          break run;
        }
        if (directoryWitnessTorn) {
          await until(() => frame().replaceAll('\n', '').includes('checkpoint witness was reconciled') && ready(), 'torn witness reconciliation', 15000);
          const marker = path.join(temporary, 'directory-inheritance-error.json'); let { id } = JSON.parse(fs.readFileSync(marker, 'utf8'));
          const dir = path.join(workspace, '.agent');
          assert.ok(fs.readdirSync(dir).some(name => name.startsWith(`${id}.jsonl.torn-`)));
          fs.writeFileSync(path.join(outside, 'after.txt'), 'DIRECTORY_AFTER_RECOVERY');
          const regrant = `${outside}/.`; send(`/add-dir ${regrant}\r`);
          await until(() => {
            const screen = frame(), command = screen.lastIndexOf(`> /add-dir ${regrant}`);
            return ready() && command >= 0 && screen.lastIndexOf(`Added ${outside}`) > command;
          }, 'torn recovery regrant', 15000);
          send('read after recovered rewind\r');
          await until(() => frame().includes('TORN_RECOVERY_READ_COMPLETE') && ready(), 'read after torn recovery', 15000);
          assert.ok(requests.length > beforeRewindRequests);
          if (directoryWitnessRepeated) {
            const firstId = id; fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'CHANGED_BEFORE_SECOND_TORN_REWIND');
            if (directoryWitnessPost) {
              send('/checkpoint selection-before-second-torn\r');
              await until(() => frame().includes('selection-before-second-torn') && frame().includes('"external_witness": "available"') && ready(),
                'checkpoint before second torn recovery', 15000);
            }
            const secondTurn = directoryWitnessPost ? 3 : 2, commandText = `> /rewind ${secondTurn} --files`;
            const secondApplyPattern = new RegExp(`Apply: /rewind ${secondTurn} --files --apply ([a-f0-9]{64})`);
            send(`/rewind ${secondTurn} --files\r`);
            await until(() => {
              const screen = frame(), command = screen.lastIndexOf(commandText);
              return command >= 0 && secondApplyPattern.test(screen.slice(command)) && ready();
            }, 'second external checkpoint apply token', 15000);
            const screen = frame(), command = screen.lastIndexOf(commandText);
            const secondToken = secondApplyPattern.exec(screen.slice(command))?.[1]; assert.ok(secondToken);
            send(`/rewind ${secondTurn} --files --apply ${secondToken}\r`);
            await until(() => {
              const visible = frame().replaceAll('\n', ''), applied = visible.lastIndexOf(`${commandText} --apply`);
              return fs.existsSync(`${marker}.second`) && applied >= 0 && visible.lastIndexOf('checkpoint witness was reconciled') > applied && ready();
            }, 'second torn witness reconciliation', 30000);
            ({ id } = JSON.parse(fs.readFileSync(`${marker}.second`, 'utf8'))); assert.notEqual(id, firstId);
            for (const owner of [firstId, id]) assert.ok(fs.readdirSync(dir).some(name => name.startsWith(`${owner}.jsonl.torn-`)));
            send(`/add-dir ${regrant}\r`);
            await until(() => {
              const visible = frame(), added = visible.lastIndexOf(`> /add-dir ${regrant}`);
              return ready() && added >= 0 && visible.lastIndexOf(`Added ${outside}`) > added;
            }, 'second torn recovery regrant', 15000);
            const beforeRead = requests.length; send('read after recovered rewind\r');
            await until(() => requests.length >= beforeRead + 2 && frame().includes('TORN_RECOVERY_READ_COMPLETE') && ready(), 'read after second torn recovery', 15000);
          }
          send('/checkpoint selection-after-torn\r');
          await until(() => frame().includes('selection-after-torn') && frame().includes('"external_witness": "available"') && ready(), 'checkpoint after torn recovery', 15000);
          send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
          const { spawnSync } = await import('node:child_process');
          const reader = `import {Session} from './dist/session.js';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './dist/rewind.js';
            const [root,id,outside,name]=process.argv.slice(1),s=Session.open(root,{id}),w=inspectDirectoryCheckpointWitness(s,name);
            process.stdout.write(JSON.stringify({witness:w.kind,bytes:readDirectoryCheckpointBackup(s,name,outside+'/value.txt')?.toString('hex')??null,
              grant:!!s.workingDirectories(false).readHandle?.(outside),history:s.directoryFileHistory.kind}));await s.close()`;
          const inherited = directoryWitnessDirect ? ['selection-tracked', directoryBackupBytes] : ['selection-boundary', null];
          const checkpoints = [inherited, ['selection-after-torn', directorySnapshotBytes],
            ...(directoryWitnessPost ? [['selection-before-second-torn', directorySnapshotBytes]] : [])];
          for (const [name, bytes] of checkpoints) for (let i = 0; i < 2; i++) {
            const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, id, outside, name], { cwd: root, encoding: 'utf8' });
            assert.equal(cold.status, 0, cold.stderr);
            assert.deepEqual(JSON.parse(cold.stdout), { witness: 'available', bytes: bytes?.toString('hex') ?? null, grant: false, history: 'available' });
          }
          const fork = `import {Session} from './dist/session.js';import {forkSession} from './dist/sessions.js';
            const s=Session.open(process.argv[1],{id:process.argv[2]});let a,b;
            try{a=forkSession(s);b=forkSession(a);process.stdout.write(JSON.stringify([a.id,b.id]))}
            finally{await b?.close();await a?.close();await s.close()}`;
          const spawned = spawnSync(process.execPath, ['--input-type=module', '-e', fork, workspace, id], { cwd: root, encoding: 'utf8' });
          assert.equal(spawned.status, 0, spawned.stderr); const descendants = JSON.parse(spawned.stdout); assert.equal(descendants.length, 2);
          for (const descendant of descendants) for (const [name, bytes] of checkpoints)
            for (let i = 0; i < 2; i++) {
              const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, descendant, outside, name], { cwd: root, encoding: 'utf8' });
              assert.equal(cold.status, 0, cold.stderr); const state = JSON.parse(cold.stdout);
              assert.equal(state.grant, false); assert.equal(state.witness, 'available'); assert.equal(state.bytes, bytes?.toString('hex') ?? null);
            }
          console.log(JSON.stringify({ cli: 'passed', recoveredTornHistory: true, source: directoryWitnessPost ? 'post-recovery-checkpoint' : directoryWitnessRepeated ? 'recovered' : directoryWitnessDirect ? 'direct' : 'indirect',
            recoveredDescendants: 2, coldProcessesPerSession: 2, gateway: 'owned loopback SSE' }));
          break run;
        }
        await until(() => frame().includes('External checkpoint restore is unavailable') && ready(), 'external checkpoint warning', 15000);
        if (directoryInheritanceError || directoryMarkerError) {
          assert.ok(fs.existsSync(path.join(temporary, directoryMarkerError ? 'directory-marker-error.json' : 'directory-inheritance-error.json')));
          assert.match(frame(), directoryMarkerError ? /checkpoint transaction was recovered/ : /checkpoint witness outcome is uncertain/);
          if (directoryMarkerError) {
            assert.equal(fs.existsSync(path.join(workspace, '.agent/checkpoints/transaction.json')), false);
            assert.equal(fs.existsSync(path.join(workspace, 'written.txt')), false);
          }
          const regrant = `${outside}/.`; send(`/add-dir ${regrant}\r`);
          await until(() => {
            const screen = frame(), command = screen.lastIndexOf(`> /add-dir ${regrant}`);
            return ready() && command >= 0 && screen.lastIndexOf(`Added ${outside}`) > command;
          }, 'rewind recovery regrant', 15000);
        }
        await captureSuccessor('rewind');
        const dir = path.join(workspace, '.agent'), before = new Set(fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')));
        send('/rewind 1\r');
        await until(() => {
          const added = fs.readdirSync(dir).filter(name => name.endsWith('.jsonl') && !before.has(name));
          if (added.length !== 1 || !fs.readFileSync(path.join(dir, added[0]), 'utf8').includes('"kind":"directory_checkpoint_inheritance"') || !ready()) return false;
          conversationRewind = added[0]; return true;
        }, 'conversation-only rewind inheritance', 15000);
      }
      send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
      if (directoryBackup) {
        const dir = path.join(workspace, '.agent'), names = fs.readdirSync(dir).filter(value => value.endsWith('.jsonl'));
        const name = directorySelection && !directoryHistoryDisabled
          ? names.find(value => fs.readFileSync(path.join(dir, value), 'utf8').includes('"kind":"directory_backup"')) : names[0];
        assert.ok(name);
        const id = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8').split('\n')[0]).id;
        const { spawnSync } = await import('node:child_process');
        const reader = `import {Session} from './dist/session.js';import {previewRewind} from './dist/rewind.js'; const s=Session.open(process.argv[1],{id:process.argv[2]}); const b=s.directoryBackups[0],ctx=b?.kind==='valid'&&b.witness.messageContext;
          const user=s.events.find(e=>e.kind==='message'&&e.messageId===ctx?.userMessageId),parentMessage=s.events.find(e=>e.kind==='message'&&e.messageId===ctx?.parentMessageId);
          const start=s.events.find(e=>e.kind==='tool_start'&&e.id==='external-write');
          const history=s.directoryFileHistory,refs=history.kind==='available'?history.snapshots.map(x=>x.entries.find(e=>e.path.lexicalPath===b?.witness?.lexicalPath)?.reference):[];
          const selections=history.kind==='available'?history.snapshots.map(x=>s.selectDirectoryRewindSnapshot(x.messageId)):[];
          const selected=selections.map(x=>x.kind==='available'?x.entries.find(e=>e.path.lexicalPath===b?.witness?.lexicalPath)?.reference:null);
          process.stdout.write(JSON.stringify({kind:b?.kind,owner:b?.kind==='valid'&&b.witness.owner,tool:b?.kind==='valid'&&b.witness.toolUseId,path:b?.kind==='valid'&&b.witness.lexicalPath,mode:b?.kind==='valid'&&b.witness.source.begin.mode,parent:b?.kind==='valid'&&b.witness.source.begin.parent,bytes:b&&s.readDirectoryBackup(b.id)?.toString('hex'),context:ctx,
            provenance:!!ctx&&user?.message.role==='user'&&parentMessage?.message.role==='assistant'&&start?.parentMessageId===ctx.parentMessageId&&Array.isArray(parentMessage.message.content)&&parentMessage.message.content.some(x=>x.type==='tool_use'&&x.id==='external-write'),disabled:user?.directoryHistoryDisabled===true,
            history:history.kind,versions:refs.map(x=>x?.version),backupIds:refs.map(x=>x?.backupId),snapshotBytes:refs.map(x=>x?.kind==='present'?s.readDirectoryHistoryBackup(x.backupId)?.bytes.toString('hex'):null),snapshotModes:refs.map(x=>x?.kind==='present'?s.readDirectoryHistoryBackup(x.backupId)?.observation.mode:null),
            selectedVersions:selected.map(x=>x?.version),selectedBytes:selected.map(x=>x?.kind==='present'?s.readDirectoryHistoryBackup(x.backupId)?.bytes.toString('hex'):null),
            external:${directorySelection && !directoryHistoryDisabled ? "previewRewind(s,1,new AbortController().signal).external" : 'null'}})); await s.close();`;
        let previous;
        for (let i = 0; i < 2; i++) {
          const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, id], { cwd: root, encoding: 'utf8' });
          assert.equal(cold.status, 0, cold.stderr);
          const parent = fs.statSync(outside, { bigint: true });
          const actual = JSON.parse(cold.stdout);
          assert.match(actual.context.userMessageId, /^[0-9a-f-]{36}$/); assert.match(actual.context.parentMessageId, /^[0-9a-f-]{36}$/);
          assert.notEqual(actual.context.userMessageId, actual.context.parentMessageId);
          assert.equal(actual.backupIds.length, directoryHistoryDisabled ? 0 : directorySelection ? 4 : 3);
          if (!directoryHistoryDisabled) {
            const start = directorySelection ? 1 : 0;
            assert.notEqual(actual.backupIds[start], actual.backupIds[start + 1]); assert.equal(actual.backupIds[start + 1], actual.backupIds[start + 2]);
          }
          assert.deepEqual(actual, { kind: 'valid', owner: id, tool: 'external-write', path: path.join(outside, 'value.txt'),
            mode: 0o751, parent: { dev: String(parent.dev), ino: String(parent.ino) }, bytes: directoryBackupBytes.toString('hex'), context: actual.context, provenance: true, disabled: directoryHistoryDisabled,
            history: 'available', versions: directoryHistoryDisabled ? [] : [...(directorySelection ? [null] : []), 1, 2, 2], backupIds: actual.backupIds,
            snapshotBytes: directoryHistoryDisabled ? [] : [...(directorySelection ? [null] : []), ...[directoryBackupBytes, directorySnapshotBytes, directorySnapshotBytes].map(value => value.toString('hex'))],
            snapshotModes: directoryHistoryDisabled ? [] : [...(directorySelection ? [null] : []), 0o751, 0o640, 0o640],
            selectedVersions: directoryHistoryDisabled ? [] : [...(directorySelection ? [1] : []), 1, 2, 2],
            selectedBytes: directoryHistoryDisabled ? [] : [...(directorySelection ? [directoryBackupBytes.toString('hex')] : []), ...[directoryBackupBytes, directorySnapshotBytes, directorySnapshotBytes].map(value => value.toString('hex'))],
            external: directorySelection && !directoryHistoryDisabled ? { kind: 'unavailable', paths: [path.join(outside, 'value.txt')] } : null });
          if (previous) assert.deepEqual(actual, previous);
          previous = actual;
        }
        if (directorySelection && !directoryHistoryDisabled) {
          const witnessReader = `import {Session} from './dist/session.js';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './dist/rewind.js';
            const s=Session.open(process.argv[1],{id:process.argv[2]}),w=inspectDirectoryCheckpointWitness(s,'selection-tracked');
            const entry=w.kind==='available'&&w.entries.find(e=>e.path.lexicalPath===process.argv[4]);
            process.stdout.write(JSON.stringify({kind:w.kind,observation:entry?.observation.kind,mode:entry?.observation.file?.mode??null,
              bytes:readDirectoryCheckpointBackup(s,'selection-tracked',process.argv[4])?.toString('hex')??null,
              grant:!!s.workingDirectories(false).readHandle?.(process.argv[3])}));await s.close();`;
          for (let i = 0; i < 2; i++) {
            const cold = spawnSync(process.execPath, ['--input-type=module', '-e', witnessReader, workspace, id, outside, path.join(outside, 'value.txt')], { cwd: root, encoding: 'utf8' });
            assert.equal(cold.status, 0, cold.stderr);
            assert.deepEqual(JSON.parse(cold.stdout), { kind: 'available', observation: 'present', mode: 0o751,
              bytes: directoryBackupBytes.toString('hex'), grant: false });
          }
          const branchReader = `import {Session} from './dist/session.js';import {previewRewind,inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './dist/rewind.js';
            const s=Session.open(process.argv[1],{id:process.argv[2]}),external=previewRewind(s,1,new AbortController().signal).external,
              witness=inspectDirectoryCheckpointWitness(s,process.argv[4]),earlier=inspectDirectoryCheckpointWitness(s,'selection-boundary'),
              later=inspectDirectoryCheckpointWitness(s,'selection-tracked'),entry=earlier.kind==='available'&&earlier.entries.find(e=>e.path.lexicalPath===process.argv[5]);
            process.stdout.write(JSON.stringify({external,witness:witness.kind,bytes:readDirectoryCheckpointBackup(s,process.argv[4],process.argv[5])?.toString('hex')??null,
              earlier:earlier.kind,earlierPath:entry?.observation.kind??null,later:later.kind,
              laterBytes:readDirectoryCheckpointBackup(s,'selection-tracked',process.argv[5])?.toString('hex')??null,
              grant:!!s.workingDirectories(false).readHandle?.(process.argv[3])}));await s.close();`;
          for (const reason of ['configuration', 'reload', 'rewind']) {
            const branch = names.find(value => value !== conversationRewind && fs.readFileSync(path.join(dir, value), 'utf8').includes(`"reason":"${reason}"`));
            assert.ok(branch); const branchId = JSON.parse(fs.readFileSync(path.join(dir, branch), 'utf8').split('\n')[0]).id;
            for (let i = 0; i < 2; i++) {
              const cold = spawnSync(process.execPath, ['--input-type=module', '-e', branchReader, workspace, branchId, outside, `selection-${reason}`, path.join(outside, 'value.txt')], { cwd: root, encoding: 'utf8' });
              assert.equal(cold.status, 0, cold.stderr);
              assert.deepEqual(JSON.parse(cold.stdout), { external: { kind: 'unavailable', paths: [path.join(outside, 'value.txt')] },
                witness: 'available', bytes: directorySnapshotBytes.toString('hex'), earlier: 'available', earlierPath: 'unavailable',
                later: reason === 'rewind' ? 'unknown' : 'available', laterBytes: reason === 'rewind' ? null : directoryBackupBytes.toString('hex'), grant: false });
            }
          }
          assert.ok(conversationRewind);
          const boundedId = JSON.parse(fs.readFileSync(path.join(dir, conversationRewind), 'utf8').split('\n')[0]).id;
          for (let i = 0; i < 2; i++) {
            const cold = spawnSync(process.execPath, ['--input-type=module', '-e', branchReader, workspace, boundedId, outside, 'selection-rewind', path.join(outside, 'value.txt')], { cwd: root, encoding: 'utf8' });
            assert.equal(cold.status, 0, cold.stderr);
            assert.deepEqual(JSON.parse(cold.stdout), { external: { kind: 'unavailable', paths: [path.join(outside, 'value.txt')] },
              witness: 'available', bytes: directorySnapshotBytes.toString('hex'), earlier: 'available', earlierPath: 'unavailable',
              later: 'unknown', laterBytes: null, grant: false });
          }
        }
      } else {
        const dir = path.join(workspace, '.agent'), name = fs.readdirSync(dir).find(value => value.endsWith('.jsonl'));
        assert.ok(name);
        const id = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8').split('\n')[0]).id;
        const { spawnSync } = await import('node:child_process');
        const reader = `import {Session} from './dist/session.js';const s=Session.open(process.argv[1],{id:process.argv[2]});const h=s.directoryFileHistory;
          const r=h.kind==='available'?h.snapshots[0]?.entries.find(e=>e.path.lexicalPath===process.argv[3])?.reference:h;
          process.stdout.write(JSON.stringify(r));await s.close();`;
        const parent = fs.statSync(outside, { bigint: true });
        for (let i = 0; i < 2; i++) {
          const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, id, path.join(outside, 'written.txt')], { cwd: root, encoding: 'utf8' });
          assert.equal(cold.status, 0, cold.stderr);
          assert.deepEqual(JSON.parse(cold.stdout), { kind: 'missing', parent: { dev: String(parent.dev), ino: String(parent.ino) }, version: 1 });
        }
      }
      console.log(JSON.stringify({ cli: 'passed', directoryWrite: true, directoryBackup, directoryHistoryDisabled, directorySelection, coldProcesses: 2,
        ...(directorySelection && !directoryHistoryDisabled ? { externalCheckpointWitness: true, inheritedCheckpointWitness: true, externalPreview: true, successorCheckpoints: ['configuration', 'reload', 'rewind'], conversationRewind: true, directoryInheritanceError, directoryMarkerError, externalBranchColdProcesses: 8 } : {}), gateway: 'owned loopback SSE' }));
      break run;
    }
    if (directoryRewindAuthority) {
      send('/checkpoint before-rewind\r');
      await until(() => frame().includes('checkpoint_digest') && ready(), 'directory rewind checkpoint', 15000);
    }
    send('read outside fixture\r');
    if (directoryRule === 'ask') { await until(() => frame().includes('Allow once'), 'directory ask prompt', 15000); send('\r'); }
    await until(() => frame().includes('DIRECTORY_TURN_2_COMPLETE') && ready(), 'directory read', 15000);
    if (directoryRule === 'deny') {
      const result = requests[1].messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
        .find(block => block.type === 'tool_result' && block.tool_use_id === 'directory-read');
      assert.equal(result?.is_error, true, JSON.stringify(result));
      assert.doesNotMatch(JSON.stringify(requests[1].messages), new RegExp(directorySecret));
      send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
      console.log(JSON.stringify({ cli: 'passed', directorySymlink: true, directoryRule, gateway: 'owned loopback SSE' }));
      break run;
    }
    assert.match(JSON.stringify(requests[1].messages), new RegExp(directorySecret));
    if (directoryBranchHistory) {
      if (directoryBranchHistory === 'config') {
        send('/thinking on\r');
        await until(() => frame().includes('Thinking: on') && ready(), 'configuration branch', 15000);
      } else if (directoryBranchHistory === 'reload') {
        send('/reload\r');
        await until(() => frame().includes('Local configuration reloaded;') && ready(), 'reload branch', 15000);
      } else {
        send('/checkpoint read-turn\r');
        await until(() => frame().includes('checkpoint_digest') && ready(), 'read-turn checkpoint', 15000);
        send('/rewind 1 --files\r');
        await until(() => /Apply: \/rewind 1 --files --apply [a-f0-9]{64}/.test(frame()) && ready(), 'read-turn preview', 15000);
        const token = /Apply: \/rewind 1 --files --apply ([a-f0-9]{64})/.exec(frame())?.[1];
        assert.ok(token);
        send(`/rewind 1 --files --apply ${token}\r`);
        await until(() => frame().includes('Rewound files and conversation to turn 1') && ready(), 'read-turn rewind', 15000);
      }
      send('verify prior directory read\r');
      await until(() => frame().includes('DIRECTORY_TURN_3_COMPLETE') && ready(), 'live branch history', 15000);
      assert.match(JSON.stringify(requests[2].messages), new RegExp(directorySecret), 'active grant retains prior Read');
      send('/permissions\r'); await until(() => frame().includes('Workspace') && frame().includes('Allow'), 'branch permissions panel', 15000);
      send('\x1b[B\x1b[B\x1b[B\x1b[B\r'); await until(() => frame().includes('Original working directory'), 'branch workspace tab', 15000);
      send('\x1b[B\r'); await until(() => frame().includes('Remove directory from workspace?'), 'branch removal confirmation', 15000);
      send('\x1b[A\r'); await until(() => frame().includes('Add directory') && !frame().includes('Remove directory from workspace?'), 'branch directory removed', 15000);
      send('\x1b'); await until(ready, 'branch permissions closed', 15000);
      send('verify revoked directory read\r');
      await until(() => frame().includes('DIRECTORY_TURN_4_COMPLETE') && ready(), 'revoked branch history', 15000);
      assert.doesNotMatch(JSON.stringify(requests[3].messages), new RegExp(directorySecret), 'revoked grant hides prior Read');
      const regrant = `${outside}/.`;
      send(`/add-dir ${regrant}\r`);
      await until(() => {
        const screen = frame(), command = screen.lastIndexOf(`> /add-dir ${regrant}`);
        return ready() && command >= 0 && screen.lastIndexOf(`Added ${outside}`) > command;
      }, 'branch regrant', 15000);
      send('verify earlier read after regrant\r');
      await until(() => frame().includes('DIRECTORY_TURN_5_COMPLETE') && ready(), 'regranted branch history', 15000);
      assert.doesNotMatch(JSON.stringify(requests[4].messages), new RegExp(directorySecret), 'regrant does not restore prior Read');
      send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
      const journals = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl')).map(name =>
        fs.readFileSync(path.join(workspace, '.agent', name), 'utf8').trimEnd().split('\n').map(JSON.parse));
      const branch = journals.find(rows => rows.some(row => row.kind === 'branch' && row.reason === (directoryBranchHistory === 'config' ? 'configuration' : directoryBranchHistory)));
      assert.ok(branch);
      const { spawnSync } = await import('node:child_process');
      const reader = `import {Session} from './dist/session.js';const s=Session.open(process.argv[1],{id:process.argv[2]});
        process.stdout.write(JSON.stringify(s.messages));await s.close();`;
      for (let i = 0; i < 2; i++) {
        const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, branch[0].id], { cwd: root, encoding: 'utf8' });
        assert.equal(cold.status, 0, cold.stderr);
        assert.doesNotMatch(cold.stdout, new RegExp(directorySecret), 'cold branch hides prior Read');
      }
      console.log(JSON.stringify({ cli: 'passed', directoryBranchHistory, coldProcesses: 2, gateway: 'owned loopback SSE' }));
      break run;
    }
    if (directoryRewindAuthority) {
      if (directoryRewindRollback || directoryRewindAcceptError || directoryRewindBindFatal) fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'CHANGED_BEFORE_ROLLBACK');
      send('/rewind 0 --files\r');
      await until(() => /Apply: \/rewind 0 --files --apply [a-f0-9]{64}/.test(frame()) && ready(), 'directory rewind preview', 15000);
      const token = /Apply: \/rewind 0 --files --apply ([a-f0-9]{64})/.exec(frame())?.[1];
      assert.ok(token);
      if (directoryRewindStale || directoryRewindPermission) fs.writeFileSync(path.join(temporary,
        directoryRewindStale ? 'rewind-stale-arm' : 'rewind-permission-arm'), 'armed');
      const beforeRewindRequests = requests.length;
      send(`/rewind 0 --files --apply ${token}\r${directoryRewindAcceptError || directoryRewindBindFatal ? 'queued after acceptance failure\r' : ''}`);
      if (directoryRewindStale) {
        await until(() => fs.existsSync(path.join(temporary, 'rewind-stale-barrier')), 'rewind release barrier', 15000);
        fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'CHANGED_DURING_RELEASE');
        process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGCONT');
        await until(() => frame().includes('Rewind was not applied; the session was resumed.') && ready(), 'rewind recovery', 15000);
        assert.equal(fs.readFileSync(path.join(workspace, 'fixture.txt'), 'utf8'), 'CHANGED_DURING_RELEASE');
        fs.writeFileSync(path.join(outside, 'value.txt'), 'CHANGED_AFTER_RECOVERY');
        fs.utimesSync(path.join(outside, 'value.txt'), 1700000000, 1700000000);
      } else if (directoryRewindPermission) {
        await until(() => frame().includes('Remove and add unavailable directories again') && ready(), 'rewind permission recovery', 15000);
      } else if (directoryRewindRollback) {
        await until(() => frame().includes('Rewind was not applied; the session was resumed.') && ready(), 'rewind rollback recovery', 15000);
        assert.equal(fs.existsSync(path.join(temporary, 'rewind-rollback-injected')), true);
        assert.equal(fs.readFileSync(path.join(workspace, 'fixture.txt'), 'utf8'), 'CHANGED_BEFORE_ROLLBACK');
        assert.equal(fs.existsSync(path.join(workspace, '.agent/checkpoints/transaction.json')), false);
        fs.writeFileSync(path.join(outside, 'value.txt'), 'CHANGED_AFTER_ROLLBACK');
        fs.utimesSync(path.join(outside, 'value.txt'), 1700000000, 1700000000);
      } else if (directoryRewindReleaseError) {
        await until(() => frame().includes('Rewind was not applied; the session was resumed.') && frame().includes('error: injected completed') && ready(), 'rewind completed-release recovery', 15000);
        fs.writeFileSync(path.join(outside, 'value.txt'), 'CHANGED_AFTER_RELEASE_ERROR');
        fs.utimesSync(path.join(outside, 'value.txt'), 1700000000, 1700000000);
      } else if (directoryRewindBindFatal) {
        const marker = path.join(temporary, 'rewind-bind-fatal.json');
        await until(() => fs.existsSync(marker), 'committed rewind bind recovery failure', 15000);
        const { id } = JSON.parse(fs.readFileSync(marker, 'utf8'));
        assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
        assert.match(frame(), new RegExp(`Rewind committed in session ${id}; runtime recovery failed`));
        assert.equal(fs.readFileSync(path.join(workspace, 'fixture.txt'), 'utf8'), 'OWNED_TRANSCRIPT_FILE');
        assert.equal(requests.length, beforeRewindRequests);
        const { spawnSync } = await import('node:child_process');
        const reader = `import {Session} from './dist/session.js';const s=Session.open(process.argv[1],{id:process.argv[2]});
          process.stdout.write(JSON.stringify({branch:s.events.some(e=>e.kind==='branch'&&e.reason==='rewind'),messages:s.messages}));await s.close();`;
        for (let i = 0; i < 2; i++) {
          const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, id], { cwd: root, encoding: 'utf8' });
          assert.equal(cold.status, 0, cold.stderr); const state = JSON.parse(cold.stdout);
          assert.equal(state.branch, true); assert.doesNotMatch(JSON.stringify(state.messages), /queued after acceptance failure/);
        }
        console.log(JSON.stringify({ cli: 'passed', directoryRewindBindFatal: true, coldProcesses: 2, gateway: 'owned loopback SSE' }));
        break run;
      } else if (directoryRewindAcceptError) {
        const marker = path.join(temporary, 'rewind-accept-error.json');
        await until(() => fs.existsSync(marker), 'committed rewind accept failure', 15000);
        const { id } = JSON.parse(fs.readFileSync(marker, 'utf8'));
        assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
        assert.match(frame(), new RegExp(`Rewind committed in session ${id}; session handoff is incomplete`));
        assert.equal(fs.readFileSync(path.join(workspace, 'fixture.txt'), 'utf8'), 'OWNED_TRANSCRIPT_FILE');
        assert.equal(requests.length, 2);
        const { spawnSync } = await import('node:child_process');
        const reader = `import {Session} from './dist/session.js';const s=Session.open(process.argv[1],{id:process.argv[2]});
          process.stdout.write(JSON.stringify({branch:s.events.some(e=>e.kind==='branch'&&e.reason==='rewind'),messages:s.messages}));await s.close();`;
        for (let i = 0; i < 2; i++) {
          const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, id], { cwd: root, encoding: 'utf8' });
          assert.equal(cold.status, 0, cold.stderr); const state = JSON.parse(cold.stdout);
          assert.equal(state.branch, true); assert.doesNotMatch(JSON.stringify(state.messages), /queued after acceptance failure/);
        }
        console.log(JSON.stringify({ cli: 'passed', directoryRewindAcceptError: true, committedSession: id, coldProcesses: 2, gateway: 'owned loopback SSE' }));
        break run;
      } else if (directoryRewindBindError) {
        await until(() => frame().includes('Rewind committed; runtime connection was restored.') &&
          frame().includes('Rewound files and conversation to turn 0') && ready(), 'committed rewind runtime recovery', 15000);
      } else await until(() => frame().includes('Rewound files and conversation to turn 0') && ready(), 'directory rewind apply', 15000);
      send('read outside after rewind\r');
      await until(() => frame().includes('DIRECTORY_TURN_4_COMPLETE') && ready(), 'directory read after rewind', 15000);
      if (directoryRewindStale || directoryRewindRollback || directoryRewindReleaseError) assert.match(JSON.stringify(requests[2].messages), new RegExp(directorySecret));
      let result = requests[3].messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
        .find(block => block.type === 'tool_result' && block.tool_use_id === 'rewind-read');
      if (directoryRewindPermission) {
        assert.equal(result?.is_error, true, JSON.stringify(result));
        assert.doesNotMatch(JSON.stringify(requests[3].messages), new RegExp(directorySecret));
        send('/permissions\r'); await until(() => frame().includes('Workspace') && frame().includes('Allow'), 'permissions panel', 15000);
        send('\x1b[B\x1b[B\x1b[B\x1b[B\r'); await until(() => frame().includes('Original working directory'), 'workspace tab', 15000);
        send('\x1b[B\r'); await until(() => frame().includes('Remove directory from workspace?'), 'remove directory confirmation', 15000);
        send('\x1b[A\r'); await until(() => frame().includes('Add directory') && !frame().includes('Remove directory from workspace?'), 'removed directory', 15000);
        send('\x1b'); await until(ready, 'permissions closed', 15000);
        const regrant = `${outside}/.`;
        send(`/add-dir ${regrant}\r`);
        await until(() => {
          const screen = frame(), command = screen.lastIndexOf(`> /add-dir ${regrant}`);
          return ready() && command >= 0 && screen.lastIndexOf(`Added ${outside}`) > command;
        }, 'regrant', 15000);
        fs.writeFileSync(path.join(outside, 'value.txt'), 'NEW_GRANT_CONTENT');
        send('read after explicit regrant\r'); await until(() => frame().includes('DIRECTORY_TURN_6_COMPLETE') && ready(), 'directory read after regrant', 15000);
        assert.doesNotMatch(JSON.stringify(requests[4].messages), new RegExp(directorySecret));
        result = requests[5].messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
          .find(block => block.type === 'tool_result' && block.tool_use_id === 'regrant-read');
      }
      assert.notEqual(result?.is_error, true, JSON.stringify(result));
      assert.match(JSON.stringify(result), directoryRewindPermission ? /NEW_GRANT_CONTENT/ : directoryRewindStale ? /CHANGED_AFTER_RECOVERY/ : directoryRewindRollback ? /CHANGED_AFTER_ROLLBACK/ : directoryRewindReleaseError ? /CHANGED_AFTER_RELEASE_ERROR/ : new RegExp(directorySecret));
      send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
      const journals = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl')).map(name =>
        fs.readFileSync(path.join(workspace, '.agent', name), 'utf8').trimEnd().split('\n').map(JSON.parse));
      const prior = journals.find(rows => rows.some(row => row.kind === 'tool_result' && row.result?.tool_use_id === 'directory-read'));
      const branch = directoryRewindStale || directoryRewindPermission || directoryRewindRollback || directoryRewindReleaseError ? prior : journals.find(rows => rows.some(row => row.kind === 'branch' && row.reason === 'rewind'));
      assert.ok(prior && branch);
      const before = prior.find(row => row.kind === 'tool_result' && row.result?.tool_use_id === 'directory-read')?.readGrantWitness;
      const after = branch.find(row => row.kind === 'tool_result' && row.result?.tool_use_id === (directoryRewindPermission ? 'regrant-read' : 'rewind-read'))?.readGrantWitness;
      assert.ok(before && after);
      if (directoryRewindStale || directoryRewindPermission || directoryRewindRollback || directoryRewindReleaseError) assert.equal(before.owner, after.owner); else assert.notEqual(before.owner, after.owner);
      assert.notEqual(before.incarnation, after.incarnation);
      assert.equal(after.owner, branch[0].id);
      const { spawnSync } = await import('node:child_process');
      const reader = `import {Session} from './dist/session.js';const s=Session.open(process.argv[1],{id:process.argv[2]});
        process.stdout.write(JSON.stringify({messages:s.messages,grant:!!s.workingDirectories(false).readHandle?.(process.argv[3])}));await s.close();`;
      for (let i = 0; i < 2; i++) {
        const cold = spawnSync(process.execPath, ['--input-type=module', '-e', reader, workspace, branch[0].id, outside], { cwd: root, encoding: 'utf8' });
        assert.equal(cold.status, 0, cold.stderr);
        const projection = JSON.parse(cold.stdout);
        assert.equal(projection.grant, false); assert.doesNotMatch(JSON.stringify(projection.messages), new RegExp(directorySecret));
        if (directoryRewindStale) assert.doesNotMatch(JSON.stringify(projection.messages), /CHANGED_AFTER_RECOVERY/);
        if (directoryRewindPermission) assert.doesNotMatch(JSON.stringify(projection.messages), /NEW_GRANT_CONTENT/);
        if (directoryRewindRollback) assert.doesNotMatch(JSON.stringify(projection.messages), /CHANGED_AFTER_ROLLBACK/);
        if (directoryRewindReleaseError) assert.doesNotMatch(JSON.stringify(projection.messages), /CHANGED_AFTER_RELEASE_ERROR/);
      }
      console.log(JSON.stringify({ cli: 'passed', directoryRewindAuthority: true, directoryRewindStale,
        directoryRewindPermission, directoryRewindRollback, directoryRewindReleaseError, directoryRewindBindError,
        distinctOwners: !(directoryRewindStale || directoryRewindPermission || directoryRewindRollback || directoryRewindReleaseError), coldProcesses: 2, gateway: 'owned loopback SSE' }));
      break run;
    }
    if (directorySymlink) {
      const dir = path.join(workspace, '.agent');
      const journal = path.join(dir, fs.readdirSync(dir).find(name => name.endsWith('.jsonl')));
      const id = JSON.parse(fs.readFileSync(journal, 'utf8').split('\n')[0]).id;
      send(`/resume ${id}\r`);
      await until(() => frame().includes('Session is already active.') && ready(), 'same-ID resume', 15000);
      assert.equal(requests.length, 2);
    }
    if (directoryReplacement) {
      const replacement = path.join(temporary, 'replacement');
      fs.mkdirSync(replacement); fs.writeFileSync(path.join(replacement, 'value.txt'), 'REPLACEMENT_DIRECTORY_CONTENT');
      if (directorySymlink) fs.unlinkSync(outside);
      else fs.renameSync(outside, `${outside}-original`);
      fs.symlinkSync(replacement, outside);
      send('read replaced directory\r');
      if (directoryRule === 'ask') { await until(() => frame().includes('Allow once'), 'retarget ask prompt', 15000); send('\r'); }
      await until(() => frame().includes('DIRECTORY_TURN_4_COMPLETE') && ready(), 'replacement read', 15000);
      const result = requests[3].messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
        .find(block => block.type === 'tool_result' && block.tool_use_id === 'replacement-read');
      assert.equal(result?.is_error, true, JSON.stringify(result));
      assert.doesNotMatch(JSON.stringify(result), /REPLACEMENT_DIRECTORY_CONTENT/);
      if (!directorySymlink) {
        send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
        console.log(JSON.stringify({ cli: 'passed', directoryReplacement: true, gateway: 'owned loopback SSE' }));
        break run;
      }
    }
    if (panelPriorError) assert.equal(fs.readFileSync(path.join(temporary,'prior-error'),'utf8'),'observed');
    send('/permissions\r');
    await until(() => frame().includes('Workspace') && frame().includes('Allow'), 'permissions panel', 15000);
    send('\x1b[B\x1b[B\x1b[B\x1b[B\r');
    await until(() => frame().includes('[Workspace]') && frame().includes('Add directory'), 'workspace tab', 15000);
    send('\x1b[B\r');
    await until(() => frame().includes('Remove directory from workspace?'), 'remove directory confirmation', 15000);
    send('\x1b[A\r');
    await until(() => frame().includes('Add directory') && !frame().includes('Remove directory from workspace?'), 'removed directory', 15000);
    send('\x1b'); await until(ready, 'permissions closed', 15000);
    send('observe after revoke\r');
    const revokeIndex = directorySymlink ? 4 : 2;
    await until(() => frame().includes(`DIRECTORY_TURN_${revokeIndex + 1}_COMPLETE`) && ready(), 'post revoke turn', 15000);
    assert.doesNotMatch(JSON.stringify(requests[revokeIndex].messages), new RegExp(directorySecret));
    send(`/add-dir ${outside}\r`); await until(() => ready() && frame().split(`Added ${outside}`).length >= 3, 'regrant', 15000);
    send('observe after regrant\r');
    await until(() => frame().includes(`DIRECTORY_TURN_${revokeIndex + 2}_COMPLETE`) && ready(), 'post regrant turn', 15000);
    assert.doesNotMatch(JSON.stringify(requests[revokeIndex + 1].messages), new RegExp(directorySecret));
    if (directorySymlink) {
      send('read regranted directory\r');
      if (directoryRule === 'ask') { await until(() => frame().includes('Allow once'), 'regrant ask prompt', 15000); send('\r'); }
      await until(() => frame().includes('DIRECTORY_TURN_8_COMPLETE') && ready(), 'regranted read', 15000);
      const result = requests[7].messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
        .find(block => block.type === 'tool_result' && block.tool_use_id === 'regrant-read');
      assert.notEqual(result?.is_error, true, JSON.stringify(result));
      assert.match(JSON.stringify(result), /REPLACEMENT_DIRECTORY_CONTENT/);
      assert.doesNotMatch(JSON.stringify(requests[7].messages), new RegExp(directorySecret));
    }
    send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
    const dir = path.join(workspace, '.agent');
    const journal = path.join(dir, fs.readdirSync(dir).find(name => name.endsWith('.jsonl')));
    const raw = fs.readFileSync(journal, 'utf8'); assert.match(raw, new RegExp(directorySecret));
    const rows = raw.trimEnd().split('\n').map(JSON.parse), id = rows[0].id;
    const witnesses = rows.filter(row => ['tool_effect', 'tool_result'].includes(row.kind) && row.result?.tool_use_id === 'directory-read');
    assert.deepEqual(witnesses.map(row => row.kind), ['tool_effect', 'tool_result']);
    assert.ok(witnesses[0].readGrantWitness?.incarnation);
    assert.deepEqual(witnesses[0].readGrantWitness, witnesses[1].readGrantWitness);
    const { spawnSync } = await import('node:child_process');
    const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `import { Session } from './dist/session.js'; const s = Session.open(process.argv[1], { id: process.argv[2] }); try { process.stdout.write(JSON.stringify(s.messages)); } finally { await s.close(); }`, workspace, id], { cwd: root, encoding: 'utf8' });
    assert.equal(cold.status, 0, cold.stderr); assert.doesNotMatch(cold.stdout, new RegExp(directorySecret));
    if (directorySymlink) { assert.match(raw, /REPLACEMENT_DIRECTORY_CONTENT/); assert.doesNotMatch(cold.stdout, /REPLACEMENT_DIRECTORY_CONTENT/); }
    console.log(JSON.stringify({ cli: 'passed', directoryGrant: true, directorySymlink, cold: 'independent process', gateway: 'owned loopback SSE' }));
    break run;
  } else if (multiRead) {
    send('read both files\r');
    if (postHookCrash) {
      await until(() => fs.existsSync(path.join(temporary, 'post-hook-barrier')), 'post hook crash barrier', 15000);
      const pid = Number(fs.readFileSync(pidFile, 'utf8'));
      process.kill(pid, 'SIGKILL');
      await Promise.race([exited, delay(6000).then(() => { throw new Error('CLI did not exit'); })]);
      const dir = path.join(workspace, '.agent');
      const journal = path.join(dir, fs.readdirSync(dir).find(name => name.endsWith('.jsonl')));
      const before = fs.readFileSync(journal);
      const rows = before.toString().trimEnd().split('\n').map(JSON.parse), id = rows[0].id;
      assert.ok(rows.some(row => row.kind === 'tool_effect' && row.result.tool_use_id === 'multi-first'));
      assert.ok(rows.some(row => row.kind === 'hook_result' && row.event === 'PostToolUse'));
      assert.equal(rows.some(row => row.kind === 'tool_result' && row.result.tool_use_id === 'multi-first'), false);
      const { Session } = await import('../dist/session.js');
      const { Agent } = await import('../dist/agent.js');
      for (let pass = 0; pass < 2; pass++) {
        const session = Session.open(workspace, { id, recoverLock: true });
        try {
          if (!pass) {
            const provider = { count: async () => 1, complete: async () => ({ id: 'cold', type: 'message', role: 'assistant', model: 'fixture', content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }) };
            const tools = session.config.tools.map(({ eager_input_streaming, ...schema }) => ({ schema, readOnly: false,
              execute: async () => { throw new Error('cold recovery replayed a tool'); } }));
            await new Agent(session, provider, tools).run();
          }
          const result = session.messages.flatMap(message => Array.isArray(message.content) ? message.content.filter(block => block.type === 'tool_result' && block.tool_use_id === 'multi-first') : []);
          assert.equal(result.length, 1); assert.match(result[0].content, /post-hook result was interrupted before commit/);
          assert.ok(fs.readFileSync(journal).subarray(0, before.length).equals(before));
        } finally { session.close(); }
      }
      assert.equal(requests.length, 1);
      console.log(JSON.stringify({ cli: 'passed', postHookCrash: true, gateway: 'owned loopback SSE' }));
      break run;
    }
    await until(() => frame().includes('MULTI_READ_COMPLETE'), 'multiple reads', 15000);
    assert.equal(requests.length, 2);
    if (postHook) assert.match(frame(), /Read 3 lines/);
    send('/exit\r');
    assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
    if (postHook) {
      const dir = path.join(workspace, '.agent');
      const journal = path.join(dir, fs.readdirSync(dir).find(name => name.endsWith('.jsonl')));
      const rows = fs.readFileSync(journal, 'utf8').trimEnd().split('\n').map(JSON.parse);
      for (const id of ['multi-first', 'multi-second']) {
        const effect = rows.findIndex(row => row.kind === 'tool_effect' && row.result.tool_use_id === id);
        const hookStart = rows.findIndex(row => row.kind === 'hook_start' && row.event === 'PostToolUse' && row.toolUseId === id);
        const result = rows.findIndex(row => row.kind === 'tool_result' && row.result.tool_use_id === id);
        assert.ok(effect >= 0 && effect < hookStart && hookStart < result);
        assert.equal(rows[result].result.content, 'CLI_REWRITTEN\nSECOND\nTHIRD');
      }
    }
    console.log(JSON.stringify({ cli: 'passed', multiRead, postHook, gateway: 'owned loopback SSE' }));
    break run;
  } else if (coldReplacement) {
    send('read initial file\r');
    await until(() => frame().includes('REPLACEMENT_INITIAL_COMPLETE'), 'initial read', 15000);
    const dir = path.join(workspace, '.agent');
    const journal = path.join(dir, fs.readdirSync(dir).find(name => name.endsWith('.jsonl')));
    await until(() => fs.readFileSync(journal, 'utf8').trimEnd().split('\n').some(line => JSON.parse(line).kind === 'turn_end'), 'initial read persisted', 15000);
    send('/exit\r');
    assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
    assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.lock')), false);
    const rows = fs.readFileSync(journal, 'utf8').trimEnd().split('\n').map(JSON.parse);
    const id = rows[0].id;
    const read = rows.find(row => row.kind === 'tool_result' && row.result?.tool_use_id === 'replacement-initial');
    assert.equal(read?.host?.kind, 'file_read');
    assert.ok(read.host.identity?.dev && read.host.identity?.ino, 'initial descriptor identity persisted');
    if (legacyIdentity) {
      delete read.host.identity;
      fs.writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    }
    const target = path.join(workspace, 'fixture.txt'), replacement = path.join(workspace, 'replacement.txt');
    const { Session } = await import('../dist/session.js');
    const restored = Session.open(workspace, { id });
    try {
      const cached = restored.fileReadCache.get(target);
      assert.equal(cached?.content, 'OWNED_TRANSCRIPT_FILE');
      assert.deepEqual(cached?.identity, legacyIdentity ? undefined : read.host.identity);
    } finally { restored.close(); }
    const before = fs.statSync(target);
    fs.writeFileSync(replacement, 'REPLACEMENT_NEW_CONTENT');
    fs.utimesSync(replacement, before.atime, before.mtime);
    fs.renameSync(replacement, target);
    const after = fs.statSync(target);
    assert.equal(after.dev, before.dev);
    assert.notEqual(after.ino, before.ino);
    assert.equal(after.mtimeMs, before.mtimeMs);
    assert.equal(fs.readFileSync(target, 'utf8'), 'REPLACEMENT_NEW_CONTENT');
    screen.write('\x1bc');
    start(['--resume', id]);
    await until(ready, 'cold replacement resume', 15000);
    send('read replacement after restart\r');
    await until(() => frame().includes('REPLACEMENT_COLD_COMPLETE'), 'cold replacement read', 15000);
    assert.equal(requests.length, 4);
    send('/exit\r');
    assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
    assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.lock')), false);
    console.log(JSON.stringify({ cli: 'passed', coldReplacement, legacyIdentity, sameMtime: true, differentInode: true, locksReleased: true }));
    break run;
  } else if (lexicalMutation) {
    send('mutate linked directory file\r');
    await until(() => frame().includes('LEXICAL_COMPLETE'), 'linked directory mutation', 15000);
    assert.equal(fs.readFileSync(path.join(workspace, 'actual/file.txt'), 'utf8'), 'LANDED');
    const dir = path.join(workspace, '.agent');
    const journal = path.join(dir, fs.readdirSync(dir).find(name => name.endsWith('.jsonl')));
    await until(() => fs.readFileSync(journal, 'utf8').trimEnd().split('\n').some(line => JSON.parse(line).kind === 'turn_end'), 'mutation turn persisted', 15000);
    const rows = fs.readFileSync(journal, 'utf8').trimEnd().split('\n').map(JSON.parse);
    const id = rows[0].id;
    const result = rows.find(row => row.kind === 'tool_result' && row.result?.tool_use_id === 'alias-mutate');
    assert.equal(result?.result.is_error === true, false);
    assert.ok(result?.host?.landed, 'landed mutation observation');
    assert.equal(result.host.landed.cacheKey, path.join(workspace, 'alias/file.txt'));
    send('/exit\r');
    assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
    assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.lock')), false);
    if (legacyKey) {
      delete result.host.landed.cacheKey;
      fs.writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    }
    const { Session } = await import('../dist/session.js');
    const restored = Session.open(workspace, { id });
    try {
      assert.equal(restored.fileReadCache.get(path.join(workspace, 'alias/file.txt'))?.content, 'LANDED');
      assert.equal(restored.fileReadCache.has(path.join(workspace, 'actual/file.txt')), false);
    } finally { restored.close(); }
    screen.write('\x1bc');
    start(['--resume', id]);
    await until(ready, 'cold CLI resume', 15000);
    send('read linked file after restart\r');
    await until(() => frame().includes('LEXICAL_COLD_COMPLETE'), 'cold linked file read', 15000);
    assert.equal(requests.length, 5);
    assert.equal(fs.readFileSync(path.join(workspace, 'actual/file.txt'), 'utf8'), 'LANDED');
    send('/exit\r');
    assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
    assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.lock')), false);
    console.log(JSON.stringify({ cli: 'passed', lexicalMutation, legacyKey, locksReleased: true }));
    break run;
  } else if (switchRace) {
    const dir = path.join(workspace, '.agent');
    let resumeId;
    if (switchOrder) {
      const initial = fs.readdirSync(dir).find(name => name.endsWith('.jsonl'));
      assert.ok(initial, 'initial session journal');
      resumeId = JSON.parse(fs.readFileSync(path.join(dir, initial), 'utf8').split('\n')[0]).id;
      send('/clear\r');
      await until(() => fs.existsSync(path.join(workspace, 'switch-entered')), 'initial clear entered SessionEnd', 15000);
      fs.writeFileSync(path.join(workspace, 'switch-release'), 'release');
      await until(() => !fs.existsSync(path.join(dir, `${resumeId}.jsonl.lock`)) && fs.readdirSync(dir).some(name => name.endsWith('.jsonl.lock')) && ready(), 'prepare resumable session', 15000);
      fs.unlinkSync(path.join(workspace, 'switch-release'));
      fs.unlinkSync(path.join(workspace, 'switch-entered'));
    }
    send('/startup\r');
    await until(() => frame().includes('Allow once'), 'first shell approval', 15000); send('\r');
    await until(() => frame().includes('Allow once') && frame().includes('denied-effect'), 'second shell approval', 15000);
    await until(() => fs.existsSync(path.join(workspace, 'sibling-started')), 'old command started', 15000);
    const oldPid = Number(fs.readFileSync(path.join(workspace, 'sibling-pid'), 'utf8'));
    assert.ok(Number.isSafeInteger(oldPid) && oldPid > 1);
    send('\x1b'); await until(ready, 'denial settled', 15000);
    send('/fixture\r');
    await until(() => held.has('first') || frame().includes('Allow once'), 'child read approval', 15000);
    if (!held.has('first')) send('\r');
    await until(() => held.has('first') && ready(), 'child held', 15000);
    const before = fs.readdirSync(dir).filter(name => name.endsWith('.jsonl'));
    const oldLock = switchOrder && fs.readdirSync(dir).find(name => name.endsWith('.jsonl.lock'));
    if (switchOrder) assert.ok(oldLock, 'old session lock');
    if (switchOrder === 'before') {
      held.get('first').finish();
      await until(() => frame().includes('Allow once') && frame().includes('write_file'), 'background approval before switch', 15000);
      assert.equal(fs.existsSync(path.join(workspace, 'switch-entered')), false);
      send('\x1b');
      await until(() => ready() && !frame().includes('Allow once') && !frame().includes('1 local agent'), 'prior approval denied and child settled', 15000);
    }
    send(switchOrder ? `/resume ${resumeId}\r` : '/clear\r');
    await until(() => fs.existsSync(path.join(workspace, 'switch-entered')), 'switch entered SessionEnd', 15000);
    if (switchOrder !== 'before') {
      held.get('first').finish();
      await until(() => frame().includes('Allow once') && frame().includes('write_file'), 'background approval during switch', 15000);
    }
    fs.writeFileSync(path.join(workspace, 'switch-release'), 'release');
    await until(() => (switchOrder ? fs.existsSync(path.join(dir, `${resumeId}.jsonl.lock`)) && !fs.existsSync(path.join(dir, oldLock)) : fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).length > before.length) && !frame().includes('Allow once'), 'switch revokes approval', 15000);
    assert.equal(fs.existsSync(path.join(workspace, 'race-effect.txt')), false);
    assert.equal(fs.existsSync(path.join(workspace, 'denied-effect')), false);
    fs.writeFileSync(path.join(workspace, 'sibling-release'), 'release');
    await delay(300);
    assert.equal(fs.existsSync(path.join(workspace, 'sibling-finished')), false);
    const journalDir = path.join(dir, 'skill-effects');
    await until(() => !fs.readdirSync(journalDir).some(name => name.endsWith('.lease')), 'old effect lease released', 15000);
    assert.throws(() => process.kill(oldPid, 0), error => error.code === 'ESRCH');
    const records = fs.readdirSync(journalDir).filter(name => name.endsWith('.jsonl')).flatMap(name => fs.readFileSync(path.join(journalDir, name), 'utf8').trim().split('\n').map(JSON.parse));
    assert.deepEqual(records.map(record => record.phase), ['started']);
    const events = fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).flatMap(name => fs.readFileSync(path.join(dir, name), 'utf8').trim().split('\n').map(JSON.parse));
    const rejection = events.find(event => event.kind === 'tool_result' && event.result?.tool_use_id === 'race-write');
    assert.equal(rejection?.result.is_error, true);
    assert.match(rejection.result.content, /declined|unavailable/i);
    send('/exit\r');
    assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
    assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.lock')), false);
    console.log(JSON.stringify({ cli: 'passed', switchRace, switchOrder, phases: records.map(record => record.phase), locksReleased: true }));
    break run;
  } else if (startupProbe) {
    send('/startup\r');
    await until(() => frame().includes('Allow once'), 'first shell approval', 15000);
    assert.equal(fs.existsSync(path.join(workspace, 'startup-effects')), false);
    send('\r');
    if (startupProbe.startsWith('concurrent')) {
      await until(() => frame().includes('Allow once') && frame().includes('denied-effect'), 'second shell approval', 15000);
      await until(() => fs.existsSync(path.join(workspace, 'sibling-started')), 'approved sibling starts', 15000);
      send('\x1b');
      await until(ready, 'denial returns while sibling remains running', 15000);
      assert.equal(fs.existsSync(path.join(workspace, 'sibling-finished')), false);
      assert.equal(fs.existsSync(path.join(workspace, 'denied-effect')), false);
      const journalDir = path.join(workspace, '.agent/skill-effects');
      assert.ok(fs.readdirSync(journalDir).some(name => name.endsWith('.lease')));
      if (startupProbe === 'concurrent-close') {
        send('/exit\r');
        assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
        assert.equal(fs.existsSync(path.join(workspace, 'sibling-finished')), false);
        assert.equal(fs.existsSync(path.join(workspace, 'denied-effect')), false);
        assert.equal(fs.readdirSync(journalDir).some(name => name.endsWith('.lease')), false);
        assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
        console.log(JSON.stringify({ cli: 'passed', startupProbe, siblingFinished: false, deniedEffect: false, locksReleased: true }));
        break run;
      }
      fs.writeFileSync(path.join(workspace, 'sibling-release'), 'release');
      await until(() => fs.existsSync(path.join(workspace, 'sibling-finished')), 'approved sibling completes after denial', 15000);
      await until(() => !fs.readdirSync(journalDir).some(name => name.endsWith('.lease')), 'completed sibling releases lease', 15000);
      assert.equal(fs.existsSync(path.join(workspace, 'denied-effect')), false);
      const records = fs.readdirSync(journalDir).filter(name => name.endsWith('.jsonl')).flatMap(name => fs.readFileSync(path.join(journalDir, name), 'utf8').trim().split('\n').map(line => JSON.parse(line)));
      assert.deepEqual(records.map(record => record.phase), ['started', 'finished']);
      assert.equal(records[0].id, records[1].id);
      send('/exit\r');
      assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
      assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
      console.log(JSON.stringify({ cli: 'passed', startupProbe, deniedEffect: false, siblingFinished: true, phases: records.map(record => record.phase), locksReleased: true }));
      break run;
    }
    await until(() => frame().includes('Allow once') && frame().includes('"command":"true"'), 'second shell approval', 15000);
    if (startupProbe === 'cancel') {
      await until(() => fs.existsSync(path.join(workspace, 'startup-result')), 'approved sibling completes', 15000);
      assert.equal(fs.readFileSync(path.join(workspace, 'startup-result'), 'utf8'), temporary);
    }
    assert.equal(fs.existsSync(path.join(workspace, 'startup-effects')), false);
    const active = path.join(temporary, 'startup-active'), replacement = path.join(temporary, 'startup-new');
    if (startupProbe === 'link') { fs.unlinkSync(active); fs.symlinkSync(replacement, active); }
    else fs.writeFileSync(path.join(temporary, 'startup-old'), fs.readFileSync(replacement));
    send(startupProbe === 'cancel' ? '\x1b' : '\r');
    if (startupProbe === 'cancel') {
      await until(() => ready(), 'cancel settles', 15000);
      assert.equal(fs.readFileSync(path.join(workspace, 'startup-result'), 'utf8'), temporary);
      assert.equal(fs.existsSync(path.join(workspace, 'startup-effects')), false);
    } else {
      await until(() => fs.existsSync(path.join(workspace, 'startup-result')) && ready(), 'shell execution settles', 15000);
      assert.equal(fs.readFileSync(path.join(workspace, 'startup-result'), 'utf8'), `${workspace}/changed-home`);
      assert.equal(fs.readFileSync(path.join(workspace, 'startup-effects'), 'utf8'), 'startupstartup');
    }
    send('/exit\r');
    assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
    console.log(JSON.stringify({ cli: 'passed', startupProbe, effects: startupProbe === 'cancel' ? 0 : 2, locksReleased: true }));
    break run;
  } else if (mutationGates) {
    send('exercise file validation\r');
    await until(() => frame().includes('MUTATION_GATES_COMPLETE'), 'file mutation gates', 15000);
    assert.equal(requests.length, 4);
  } else if (coldHistory || coldSkill) {
    send(coldSkill ? '/fixture\r' : 'launch view first\r');
    if (coldApproval) {
      await until(() => held.has('first') || frame().includes('Allow once'), 'initial child approval or read', 15000);
      if (!held.has('first')) send('yes\r');
    }
    await until(() => held.has('first') && ready(), 'child read before parent exit', 15000);
    held.get('first').finish();
    if (crashIntent) {
      const barrier = path.join(temporary, 'crash-barrier.json');
      await until(() => fs.existsSync(barrier), 'settled sidecar barrier', 15000);
      const info = JSON.parse(fs.readFileSync(barrier, 'utf8'));
      const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
      assert.ok(Number.isSafeInteger(pid) && pid > 1);
      process.kill(pid, 'SIGKILL');
      assert.notEqual(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 'timeout');
      delete env.NODE_OPTIONS;
      const dir = path.join(workspace, '.agent');
      const parentFile = path.join(dir, `${info.parent}.jsonl`);
      const childFile = path.join(dir, `${info.child}.jsonl`);
      const sidecar = fs.readFileSync(info.target);
      const rows = fs.readFileSync(parentFile, 'utf8').trimEnd().split('\n').map(JSON.parse);
      const intent = rows.findLast(row => row.kind === 'agent_history_intent' && row.id === info.child);
      assert.ok(intent, 'settled intent is durable before replacement');
      const count = () => fs.readFileSync(parentFile, 'utf8').trimEnd().split('\n').map(JSON.parse)
        .filter(row => row.kind === 'agent_history' && row.id === info.child).length;
      const beforeWitnesses = count();
      if (crashIntent === 'torn') fs.appendFileSync(parentFile, '{"kind":"agent_history"');
      else if (crashIntent !== 'valid') {
        if (crashIntent === 'corrupt') intent.newDigest = '0'.repeat(64);
        else intent.parent = '00000000-0000-4000-8000-000000000000';
        fs.writeFileSync(parentFile, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
      }
      const evidence = fs.readFileSync(parentFile);
      const childEvidence = fs.readFileSync(childFile);
      for (let attempt = 0; attempt < 2; attempt++) {
        screen.write('\x1bc');
        start(['--resume', info.parent, '--recover-lock']);
        await until(ready, 'restart after SIGKILL', 15000);
        send('/tasks\r');
        if (crashIntent === 'valid' || crashIntent === 'torn') {
          await until(() => frame().includes('Completed (1)'), 'recovered child', 15000);
          send('\r');
          await until(() => frame().includes('Viewing agent') && frame().includes('CHILD_FIRST_COMPLETE'), 'recovered transcript', 15000);
          assert.equal(count(), beforeWitnesses + 1, 'exactly one new witness');
          if (crashIntent === 'torn') {
            const copies = fs.readdirSync(dir).filter(name => name.startsWith(`${info.parent}.jsonl.torn-`));
            assert.equal(copies.length, 1);
            assert.deepEqual(fs.readFileSync(path.join(dir, copies[0])), evidence, 'original torn journal retained');
          }
          send('\x1b'); await until(() => !frame().includes('Viewing agent'), 'close recovered transcript');
        } else {
          await until(() => frame().includes('No tasks currently running'), 'invalid intent omitted', 15000);
          assert.equal(count(), beforeWitnesses, 'invalid intent cannot commit a witness');
          const current = fs.readFileSync(parentFile);
          assert.deepEqual(current.subarray(0, evidence.length), evidence, 'invalid intent retained as original prefix');
          assert.match(current.subarray(evidence.length).toString(), /Child history has no matching parent witness/);
          send('\x1b'); await until(ready, 'close task list');
        }
        assert.deepEqual(fs.readFileSync(info.target), sidecar, 'sidecar retained');
        assert.deepEqual(fs.readFileSync(childFile), childEvidence, 'child journal retained');
        send('/exit\r');
        assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
      }
      assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.lock')), false);
      console.log(JSON.stringify({ cli: 'passed', crashIntent, modelRequests: requests.length, witnessDelta: count() - beforeWitnesses, locksReleased: true }));
      break run;
    }
    await until(() => ready() && !frame().includes('1 local agent'), 'child completed before parent exit', 15000);
    const dir = path.join(workspace, '.agent');
    const journals = fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).map(name => {
      const file = path.join(dir, name), bytes = fs.readFileSync(file, 'utf8');
      return { file, metadata: JSON.parse(bytes.split('\n')[0]), bytes };
    });
    const parent = journals.find(row => row.metadata.config.childMode === undefined);
    const worker = journals.find(row => row.metadata.config.childMode !== undefined);
    assert.ok(parent && worker, 'owned parent and child metadata');
    if (coldHistory) assert.deepEqual(worker.metadata.rootIdentity,
      { rootSessionId: parent.metadata.id, originalCwd: fs.realpathSync(workspace) });
    if (coldPlan) planTarget = path.join(workspace, 'plans', `${worker.metadata.config.parentPlanId}-agent-${worker.metadata.id}.md`);
    if (coldSkill) {
      assert.ok(fs.existsSync(worker.file.replace(/\.jsonl$/, '.forked-skill.json')), 'persisted skill scope');
      assert.ok(fs.existsSync(worker.file.replace(/\.jsonl$/, '.forked-skill.marker.json')), 'persisted skill witness');
    }
    send('/exit\r');
    assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0, frame());
    assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.lock')), false);
    const parentBytes = fs.readFileSync(parent.file, 'utf8'), childBytes = fs.readFileSync(worker.file, 'utf8');
    const before = requests.length;
    screen.write('\x1bc');
    if (coldWriteRedirect) {
      const preload = path.join(temporary, 'cold-write-redirect.mjs');
      fs.writeFileSync(preload, `import { Session } from ${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)};
import { directoryWriteInputSchema } from ${JSON.stringify(new URL('../dist/directory-publication-authorization.js', import.meta.url).href)};
const append = Session.prototype.append, parse = directoryWriteInputSchema.parse;
let armed = false;
Session.prototype.append = function(event, ...rest) {
  const result = append.call(this, event, ...rest);
  if (event.kind === 'tool_start' && event.id.startsWith('cold-write-')) armed = true;
  return result;
};
directoryWriteInputSchema.parse = function(...args) {
  const parsed = parse.apply(this, args);
  if (armed && parsed.path === 'cold-effect.txt') return { ...parsed, path: 'cold-redirected.txt' };
  return parsed;
};`);
      env.NODE_OPTIONS = `--import=${preload}`;
    }
    start(['--resume', parent.metadata.id]);
    await until(ready, 'original parent restart', 15000);
    assert.equal(requests.length, before, 'cold startup sends no model request');
    if (coldExternalWrite) {
      send(`/add-dir ${outside}\r`);
      await until(() => frame().includes('Added') && ready(), 'grant external directory after restart', 15000);
    }
    const beforeView = coldExternalWrite ? fs.readFileSync(parent.file, 'utf8') : parentBytes;
    send('/tasks\r');
    await until(() => frame().includes('Completed (1)'), 'cold completed child appears');
    send('\r');
    await until(() => frame().includes('Viewing agent') && frame().includes('CHILD_FIRST_COMPLETE'), 'cold child transcript opens');
    assert.equal(requests.length, before, 'viewing is passive');
    assert.equal(fs.readFileSync(parent.file, 'utf8'), beforeView);
    assert.equal(fs.readFileSync(worker.file, 'utf8'), childBytes);
    send('CHILD_FOLLOWUP_QUEUED\r');
    if (coldApproval && !planAuto) {
      await until(() => frame().includes('Allow once'), 'cold child interactive approval', 15000);
      assert.match(frame(), /write_file/);
      if (coldExternalOverwrite) assert.deepEqual(fs.readFileSync(coldEffectFile), coldOriginal);
      else assert.equal(fs.existsSync(coldPlan ? planTarget : coldEffectFile), false);
      if (coldApproval === 'switch-probe') {
        const beforeSessions = fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).sort();
        for (const text of ['/clear', `/resume ${parent.metadata.id}`]) {
          send(text);
          await delay(300);
          assert.match(frame(), /Allow once/, 'switch text remains inside the approval modal');
          assert.deepEqual(fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).sort(), beforeSessions);
        }
        assert.equal(fs.existsSync(path.join(workspace, 'cold-effect.txt')), false);
        send('\x1b');
        await until(() => frame().includes('CHILD_FOLLOWUP_COMPLETE'), 'denied child settles', 15000);
        send('\x1b');
        await until(() => !frame().includes('Viewing agent') && frame().includes('MAIN_TRANSCRIPT_SENTINEL'), 'return to parent');
        send('/clear\r');
        await until(() => fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).length > beforeSessions.length, 'clear after modal closes', 15000);
        assert.equal(fs.existsSync(path.join(workspace, 'cold-effect.txt')), false);
        send('/exit\r');
        assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0);
        assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.lock')), false);
        console.log(JSON.stringify({ cli: 'passed', coldSkill, coldApproval, locksReleased: true }));
        break run;
      }
      if (coldApproval === 'terminate') {
        const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
        assert.ok(Number.isSafeInteger(pid) && pid > 1, 'actual CLI process identity');
        process.kill(pid, 'SIGTERM');
        const status = await Promise.race([exited, delay(6000).then(() => 'timeout')]);
        assert.notEqual(status, 'timeout', 'CLI shutdown completes while approval is pending');
        assert.equal(fs.existsSync(path.join(workspace, 'cold-effect.txt')), false, 'shutdown produces no file effect');
        assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.lock')), false, 'shutdown releases session locks');
        console.log(JSON.stringify({ cli: 'passed', coldSkill, coldApproval, exitStatus: status,
          modelRequests: requests.length, gateway: 'owned loopback SSE', locksReleased: true }));
        break run;
      }
      send(coldApproval === 'allow' ? '\r' : coldApproval === 'interrupt' ? '\x03' : '\x1b');
    }
    await until(() => frame().includes('CHILD_FOLLOWUP_COMPLETE'), 'cold child follows up', 15000);
    const effect = coldPlan ? planTarget : coldEffectFile;
    if (coldWriteRedirect) {
      assert.equal(fs.existsSync(path.join(workspace, 'cold-redirected.txt')), false, 'redirected Write created a file');
      assert.equal(fs.existsSync(effect), false);
    } else if (!planAuto && (coldApproval === 'deny' || coldApproval === 'interrupt')) assert.equal(fs.existsSync(effect), false);
    else assert.equal(fs.readFileSync(effect, 'utf8'), 'OWNED_COLD_EFFECT');
    const events = fs.readFileSync(worker.file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    if (coldExternalWrite) {
      const backup = events.find(event => event.kind === (coldExternalOverwrite ? 'directory_backup' : 'directory_missing_backup') &&
        event.lexicalPath === coldEffectFile);
      assert.equal(backup?.owner, worker.metadata.id);
      if (coldExternalOverwrite) {
        assert.equal(fs.statSync(coldEffectFile).mode & 0o777, 0o751);
        assert.deepEqual(fs.readFileSync(`${worker.file}.backup-unknown-${backup.id}`), coldOriginal);
        assert.ok(events.some(event => event.kind === 'directory_publication_intent' && event.strategy === 'retained' && event.backupId === backup.id));
      }
      assert.ok(events.some(event => event.kind === 'directory_publication_result' && event.owner === worker.metadata.id));
      assert.ok(!fs.readFileSync(parent.file, 'utf8').includes('"kind":"directory_publication_result"'));
    }
    if (coldSkill && (coldWriteRedirect || coldApproval === 'allow' || !coldApproval)) {
      const stages = events.filter(row => row.kind === 'runtime_wrapper_observer' && row.toolUseId.startsWith('cold-write-') &&
        row.transition.phase === 'admitted');
      assert.deepEqual(stages.map(row => row.stage), ['checkScope', 'refresh', 'checkJournal']);
      assert.ok(stages.every(row => row.owner === worker.metadata.id && row.writeFactory?.owner === parent.metadata.id));
      if (coldWriteRedirect) assert.match(String(events.find(row => row.kind === 'tool_effect' &&
        row.result.tool_use_id.startsWith('cold-write-'))?.result.content), /input changed after permission checking/i);
    }
    assert.equal(events.filter(event => event.kind === 'tool_start' && event.name === 'write_file').length,
      coldPlan && (coldApproval === 'deny' || coldApproval === 'interrupt') ? 0 : 1);
    if (coldApproval) {
      const result = events.find(event => event.kind === 'tool_result' && event.result.tool_use_id.startsWith('cold-write-'));
      assert.ok(result, 'cold write result persisted');
      assert.equal(result.result.is_error === true, coldWriteRedirect || coldApproval !== 'allow');
    }
    assert.deepEqual(events[0], worker.metadata);
    assert.deepEqual(JSON.parse(fs.readFileSync(parent.file, 'utf8').split('\n')[0]), parent.metadata);
    assert.equal(requests.filter(body => body.model === 'fixture-child' && body.messages.at(-1)?.content === 'CHILD_FOLLOWUP_QUEUED').length, 1);
    assert.equal(requests.some(body => body.model === 'fixture-parent' && body.messages.at(-1)?.content === 'CHILD_FOLLOWUP_QUEUED'), false);
    send('\x1b'); await until(() => !frame().includes('Viewing agent') && frame().includes('MAIN_TRANSCRIPT_SENTINEL'), 'return to original main');
  } else if (process.argv.includes('--completed-history')) {
    for (const name of ['first', 'second']) {
      send(`launch view ${name}\r`);
      await until(() => held.has(name) && ready(), `${name} child read and held`, 15000);
      held.get(name).finish();
      await until(() => ready() && !frame().includes('1 local agent'), `${name} child completed`, 15000);
      await until(() => {
        if (!requests.some(body => typeof body.messages.at(-1)?.content === 'string'
          && body.messages.at(-1).content.startsWith('Child agent events') && body.messages.at(-1).content.includes(`view-${name}`))) return false;
        return ready() && fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl')).some(file => {
          const bytes = fs.readFileSync(path.join(workspace, '.agent', file), 'utf8');
          const rows = bytes.slice(0, bytes.lastIndexOf('\n')).split('\n').filter(Boolean).map(line => JSON.parse(line));
          if (rows[0]?.config.childMode !== undefined) return false;
          const index = rows.findLastIndex(row => row.kind === 'message' && row.notificationDelivery &&
            typeof row.message.content === 'string' && row.message.content.includes(`view-${name}`));
          return index >= 0 && rows.slice(index + 1).some(row => row.kind === 'turn_end');
        });
      }, `${name} completion notification committed`, 15000);
      const prompt = requests.map(body => body.messages.at(-1)?.content).find(text =>
        typeof text === 'string' && text.startsWith('Child agent events') && text.includes(`view-${name}`));
      const batch = JSON.parse(prompt.slice(prompt.indexOf('\n') + 1));
      const completion = batch.events.find(event => event.agent.name === `view-${name}`);
      assert.match(completion?.runId ?? '', /^[0-9a-z]{9}-[0-9a-f]{8}$/);
    }
    const before = requests.length;
    send('/tasks\r');
    if (process.argv.includes('--baseline')) {
      await until(() => frame().includes('No tasks currently running'), 'baseline omits retained completed children');
      console.log(JSON.stringify({ baseline: 'completed agents are absent from the picker', requests: requests.length }));
      send('\x1b'); await until(ready, 'close baseline list');
    } else {
      await until(() => frame().includes('Completed (2)'), 'completed group with both retained children');
      assert.doesNotMatch(frame(), /2 active agents/);
      assert.ok(frame().indexOf('view-second') < frame().indexOf('view-first'), 'newer child sorts first');
      send('x'); await delay(150); assert.equal(requests.length, before);
      assert.match(frame(), /Completed \(2\)/);
      send('\r'); await until(() => frame().includes('Viewing agent') && frame().includes('CHILD_SECOND_COMPLETE'), 'Enter opens completed transcript');
      assert.doesNotMatch(frame(), /MAIN_TRANSCRIPT_SENTINEL/);
      send('CHILD_FOLLOWUP_QUEUED\r');
      await until(() => frame().includes('CHILD_FOLLOWUP_COMPLETE'), 'completed child continues in the same transcript', 15000);
      assert.equal(requests.filter(body => body.model === 'fixture-child' && body.messages.at(-1)?.content === 'CHILD_FOLLOWUP_QUEUED').length, 1);
      send('\x1b'); await until(() => !frame().includes('Viewing agent') && frame().includes('MAIN_TRANSCRIPT_SENTINEL'), 'return to main');
      send('/tasks\r'); await until(() => frame().includes('Completed (2)'), 'reopen completed history');
      send('\x1b[B\r'); await until(() => frame().includes('Viewing agent') && frame().includes('CHILD_FIRST_COMPLETE'), 'select older completed transcript');
      assert.doesNotMatch(frame(), /CHILD_SECOND_COMPLETE/);
      send('\x1b'); await until(() => !frame().includes('Viewing agent'), 'release older child view');
    }
  } else {
  send('launch view first\r'); await until(() => held.has('first') && ready(), 'first child read and held', 15000);
  send('/tasks\r'); await until(() => frame().includes('AGENT_VIEW_FIRST') && frame().includes('Prompt'), 'agent details');
  send('f'); await until(() => frame().includes('Viewing agent') && !frame().includes('Prompt'), 'f opens selected agent transcript');
  assert.match(frame(), /AGENT_VIEW_FIRST/); assert.match(frame(), /read_file/); assert.doesNotMatch(frame(), /MAIN_TRANSCRIPT_SENTINEL/);
  if (!process.argv.includes('--entry-only')) {
    const before = requests.length;
    send('CHILD_FOLLOWUP_QUEUED\r');
    await until(() => frame().includes('CHILD_FOLLOWUP_QUEUED'), 'queued human row visible');
    await delay(150); assert.equal(requests.length, before, 'running child owns the pending input');
    held.get('first').finish();
    await until(() => frame().includes('CHILD_FOLLOWUP_COMPLETE'), 'queued human message resumes the same child', 15000);
    assert.equal(requests.filter(body => body.model === 'fixture-child' && body.messages.at(-1)?.content === 'CHILD_FOLLOWUP_QUEUED').length, 1);
    assert.equal(requests.some(body => body.model === 'fixture-parent' && body.messages.at(-1)?.content === 'CHILD_FOLLOWUP_QUEUED'), false);
    send('/model fixture-other\r'); await until(() => frame().includes('main conversation') && frame().includes('/model fixture-other'), 'model gate retains draft');
    assert.equal(requests.length, before + 2);
    send('\x15/compact\r'); await until(() => frame().includes('acts on the main conversation'), 'compact confirmation');
    send('\x1b'); await until(() => frame().includes('Viewing agent') && !frame().includes('acts on the main conversation'), 'cancel compact confirmation');
    send('\x15\x0f'); await until(() => frame().includes('ctrl+e all'), 'selected child transcript screen');
    assert.match(frame(), /CHILD_FOLLOWUP_COMPLETE/); send('q');
    await until(() => frame().includes('Viewing agent') && !frame().includes('ctrl+e all'), 'transcript exit retains agent view');
    send('\x1b'); await until(() => !frame().includes('Viewing agent') && frame().includes('MAIN_TRANSCRIPT_SENTINEL'), 'settled Escape returns main');
    assert.doesNotMatch(frame(), /CHILD_FOLLOWUP_COMPLETE/);
    send('launch view second\r'); await until(() => held.has('second') && ready(), 'second child read and held', 15000);
    send('/tasks\r'); await until(() => frame().includes('1 active agent') && frame().includes('Completed (1)'), 'running and completed child groups');
    send('\r'); await until(() => frame().includes('AGENT_VIEW_SECOND') && frame().includes('Prompt'), 'second child details');
    send('f'); await until(() => frame().includes('Viewing agent') && frame().includes('AGENT_VIEW_SECOND'), 'second child view', 15000);
    send('\x1b'); await until(() => frame().includes('Viewing agent') && frame().includes('cancelled'), 'Escape stops selected child');
    send('\x1b'); await until(() => !frame().includes('Viewing agent'), 'second Escape releases view');
  }
  }
  send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0, frame());
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  console.log(JSON.stringify({ cli: 'passed', entryOnly: process.argv.includes('--entry-only'),
    completedHistory: process.argv.includes('--completed-history'), coldHistory, coldSkill, coldApproval, coldWriteRedirect, coldExternalWrite, coldExternalOverwrite, mutationGates, baseline: process.argv.includes('--baseline'),
    childView: !process.argv.includes('--baseline'), modelRequests: requests.length, gateway: 'owned loopback SSE', locksReleased: true }));
} finally {
  fs.writeFileSync(path.join(temporary, 'screen.txt'), frame());
  if (child && child.exitCode === null && child.signalCode === null) {
    child.stdin.write('\x03\x03'); await Promise.race([exited, delay(1000)]);
    if (child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); } }
    await Promise.race([exited, delay(3000)]);
    if (child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      await exited;
    }
  }
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  screen.close();
  if (coldHistory || coldSkill || mutationGates || startupProbe || lexicalMutation || coldReplacement || directoryBackup || directoryCheckpointBracket || directoryEditTool || directoryRewindAuthority || directoryBranchHistory || directoryMixedRewind) fs.rmSync(temporary, { recursive: true, force: true });
  console.log(JSON.stringify({ fixture: temporary, removed: !!(coldHistory || coldSkill || mutationGates || startupProbe || lexicalMutation || coldReplacement || directoryBackup || directoryCheckpointBracket || directoryEditTool || directoryRewindAuthority || directoryBranchHistory || directoryMixedRewind) }));
}
