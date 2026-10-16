import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, "tmp") : os.tmpdir(), "harness-package-")));
const artifacts = path.join(temporary, "artifacts"), install = path.join(temporary, "install");
const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: "utf8", timeout: 60000,
  maxBuffer: 4 * 1024 * 1024, env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" } });
try {
  fs.mkdirSync(artifacts); fs.mkdirSync(install);
  run("npm", ["run", "build"], root);
  const [packed] = JSON.parse(run("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", artifacts], root));
  assert.ok(packed.files.some(file => file.path === "dist/cli.js"));
  assert.ok(packed.files.some(file => file.path === "bin/personal-harness.mjs"));
  assert.ok(packed.files.some(file => file.path === "bin/litcode.mjs"));
  assert.ok(packed.files.some(file => file.path === "bin/litcode-magpie.mjs"));
  assert.ok(packed.files.some(file => file.path === "NOTICE.md"));
  assert.ok(packed.files.some(file => file.path === "THIRD_PARTY_NOTICES.txt"));
  assert.equal(packed.files.some(file => /^(?:extracted[^/]*|research|test|scripts|\.agent|\.harness|src)\//.test(file.path)), false);
  const archive = path.join(artifacts, packed.filename);
  fs.writeFileSync(path.join(install, "package.json"), JSON.stringify({ private: true }));
  run("npm", ["install", "--offline", "--ignore-scripts", "--omit=dev", archive], install);
  const executable = path.join(install, "node_modules/.bin/litcode");
  const help = run(executable, ["--help"], install);
  assert.match(help, /--interactive/); assert.match(help, /LLM_API_KEY/);
  assert.match(help, /^LiTcode/);
  assert.equal(run(path.join(install, "node_modules/.bin/personal-harness"), ["--help"], install), help);
  const demo = spawnSync(executable, ["--demo"], { cwd: install, encoding: "utf8", timeout: 60000 });
  assert.equal(demo.status, 0, demo.stderr);
  assert.match(demo.stdout, /Offline demo passed/);
  const directory = /^workspace: (.+)$/m.exec(demo.stderr)?.[1];
  assert.ok(directory); assert.ok(directory.startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
  assert.match(path.basename(directory), /^personal-agent-demo-/);
  assert.equal(fs.readFileSync(path.join(directory, "hello.txt"), "utf8"), "Hello from the independent agent.\n");
  assert.equal(fs.readdirSync(path.join(directory, ".agent")).some(name => name.endsWith(".lock")), false);
  fs.rmSync(directory, { recursive: true, force: true });
  assert.equal(fs.existsSync(path.join(install, "node_modules/tsx")), false);
  const launcher = path.join(install, "node_modules/.bin/litcode-magpie");
  const launcherHelp = run(launcher, ["--help"], install);
  assert.match(launcherHelp, /^Usage: litcode-magpie\b/);
  for (const flag of ["--check", "--base-url", "--model", "--start-app", "--start-command", "--startup-timeout-ms", "--workspace", "--resume"]) {
    assert.ok(launcherHelp.includes(flag), `launcher help missing ${flag}`);
  }
  assert.equal(launcherHelp.includes("scripts/launch-magpie.mjs"), false);
  // Each external driver owns its fixture server while this process waits synchronously.
  for (const [driver, key] of [["smoke-magpie-launcher.mjs", "launcher"], ["smoke-magpie-startup.mjs", "startup"]]) {
    const output = run(process.execPath, [path.join(root, "scripts", driver), "--launcher", launcher], install);
    const result = JSON.parse(output.trim());
    assert.equal(result[key], "passed");
    assert.equal(result.modelCalls, 0);
    assert.equal(result.noSecretOutput, true);
  }
  const tuiPreviews = process.argv.includes('--tui-preview');
  if (tuiPreviews) {
    for (const name of ['tui-layout', 'tui-markdown-lexer', 'tui-markdown', 'tui-markdown-host']) {
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`), `package missing ${name}`);
    }
    const driver = path.join(root, 'scripts/smoke-tui-mouse.mjs');
    for (const flags of [[], ['--narrow'], ['--line']]) {
      const result = JSON.parse(run(process.execPath, [driver, '--cli', executable, '--preview', ...flags], install).trim());
      assert.equal(result.choicePreview, true);
      assert.equal(result.installedCLI, true);
      assert.equal(result.locksReleased, true);
      assert.equal(result.paidUpstreamCalls, 0);
      console.log(JSON.stringify(result));
    }
  }
  const tuiMessages = process.argv.includes('--tui-messages');
  if (tuiMessages) {
    const driver = path.join(root, 'scripts/smoke-tui-mouse.mjs');
    for (const flags of [[], ['--narrow'], ['--stream-chunks']]) {
      const result = JSON.parse(run(process.execPath, [driver, '--cli', executable, '--messages', ...flags], install).trim());
      assert.equal(result.tuiMessages, 'passed');
      assert.equal(result.installedCLI, true);
      assert.equal(result.responseBoundaries, true);
      assert.equal(result.paidUpstreamCalls, 0);
      console.log(JSON.stringify(result));
    }
  }
  const tuiPacing = process.argv.includes('--tui-pacing');
  if (tuiPacing) {
    assert.ok(packed.files.some(file => file.path === 'dist/tui-stream-preview.js'));
    for (const flags of [['--pacing'], ['--input-close', '--narrow']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, ...flags], install).trim());
      assert.equal(result.tuiPacing, 'passed');
      assert.equal(result.installedCLI, true);
      assert.equal(result.locksReleased, true);
      assert.equal(result.paidUpstreamCalls, 0);
      if (flags.includes('--input-close')) assert.equal(result.fatalInputCancelsProvider, true);
      console.log(JSON.stringify(result));
    }
  }
  const tuiVisibility = process.argv.includes('--tui-visibility');
  if (tuiVisibility) {
    assert.ok(packed.files.some(file => file.path === 'dist/tui-preview-visibility.js'));
    for (const flags of [['--narrow'], ['--narrow', '--windows-terminal']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--visibility', ...flags], install).trim());
      assert.equal(result.tuiVisibility, 'passed');
      assert.equal(result.resumeRestoresPinned, true);
      assert.equal(result.installedCLI, true);
      assert.equal(result.paidUpstreamCalls, 0);
      console.log(JSON.stringify(result));
    }
  }
  const tuiEditing = process.argv.includes('--tui-editing');
  if (tuiEditing) {
    for (const name of ['tui-input-cursor', 'tui-input-host', 'tui-input-navigation'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    for (const flags of [[], ['--line']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--editing', ...flags], install).trim());
      assert.equal(result.tuiEditing, 'passed'); assert.equal(result.durableSubmissionMatched, true);
      assert.equal(result.installedCLI, true); assert.equal(result.paidUpstreamCalls, 0);
      console.log(JSON.stringify(result));
    }
  }
  const tuiKillRing = process.argv.includes('--tui-kill-ring');
  if (tuiKillRing) {
    assert.ok(packed.files.some(file => file.path === 'dist/tui-input-kill.js'));
    for (const flags of [[], ['--line']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--kill-ring', ...flags], install).trim());
      assert.equal(result.tuiKillRing, 'passed'); assert.equal(result.durableSubmissionMatched, true);
      assert.equal(result.installedCLI, true); assert.equal(result.paidUpstreamCalls, 0);
      console.log(JSON.stringify(result));
    }
  }
  const tuiUndo = process.argv.includes('--tui-undo');
  if (tuiUndo) {
    for (const name of ['tui-input-undo', 'tui-input-undo-source'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    for (const flags of [[], ['--line']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--undo', ...flags], install).trim());
      assert.equal(result.tuiUndo, 'passed'); assert.equal(result.durableSubmissionMatched, true);
      assert.equal(result.installedCLI, true); assert.equal(result.pendingClose, true);
      assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
    }
  }
  const tuiProseWidth = process.argv.includes('--tui-prose-width');
  if (tuiProseWidth) {
    const result = JSON.parse(run(process.execPath,
      [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--prose-width'], install).trim());
    assert.equal(result.tuiProseWidth, 'passed'); assert.equal(result.rawMessagesComplete, true);
    assert.equal(result.codeAndTableFullWidth, true); assert.equal(result.installedCLI, true);
    assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
  }
  const tuiHighlight = process.argv.includes('--tui-highlight-setting');
  if (tuiHighlight) {
    const result = JSON.parse(run(process.execPath,
      [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--highlight-setting'], install).trim());
    assert.equal(result.tuiHighlightSetting, 'passed'); assert.equal(result.rawMessagesComplete, true);
    assert.equal(result.streamedAndFinalStyles, true); assert.equal(result.installedCLI, true);
    assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
  }
  const tuiTheme = process.argv.includes('--tui-theme-setting');
  if (tuiTheme) {
    for (const name of ['tui-theme-source', 'tui-theme-state', 'theme-settings'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    const result = JSON.parse(run(process.execPath,
      [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--theme-setting'], install).trim());
    assert.equal(result.tuiThemeSetting, 'passed'); assert.equal(result.rawMessagesComplete, true);
    assert.equal(result.focusPreview, true); assert.equal(result.restartReadsSaved, true);
    assert.equal(result.installedCLI, true); assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
  }
  const tuiSystemTheme = process.argv.includes('--tui-system-theme');
  if (tuiSystemTheme) {
    for (const name of ['tui-response-source', 'tui-system-theme-source', 'tui-system-theme'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    for (const flags of [[], ['--system-theme-mux']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--system-theme', ...flags], install).trim());
      assert.equal(result.tuiSystemTheme, 'passed'); assert.equal(result.draftSubmissionExact, true);
      assert.equal(result.responseTextAbsentFromJournal, true); assert.equal(result.pendingClose, true);
      assert.equal(result.installedCLI, true); assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
    }
  }
  const tuiCustomTheme = process.argv.includes('--tui-custom-theme');
  if (tuiCustomTheme) {
    for (const name of ['tui-custom-themes', 'tui-custom-theme-source', 'tui-theme-overrides-source', 'tui-theme-watcher-source'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    const result = JSON.parse(run(process.execPath,
      [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--custom-theme'], install).trim());
    assert.equal(result.tuiCustomTheme, 'passed'); assert.equal(result.rawMessagesComplete, true);
    assert.equal(result.hotEditRefresh, true); assert.equal(result.draftSubmissionExact, true);
    assert.equal(result.pendingClose, true); assert.equal(result.installedCLI, true);
    assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
  }
  const tuiPluginTheme = process.argv.includes('--tui-plugin-theme');
  if (tuiPluginTheme) {
    assert.ok(packed.files.some(file => file.path === 'dist/tui-plugin-theme-source.js'));
    const result = JSON.parse(run(process.execPath,
      [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--plugin-theme'], install).trim());
    assert.equal(result.tuiPluginTheme, 'passed'); assert.equal(result.rawMessagesComplete, true);
    assert.equal(result.disabledFallback, true); assert.equal(result.draftSubmissionExact, true);
    assert.equal(result.installedCLI, true); assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
  }
  const tuiThemeEditor = process.argv.includes('--tui-theme-editor');
  if (tuiThemeEditor) {
    for (const name of ['theme-editor', 'tui-theme-editor-source', 'tui-theme-color-components'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    for (const flags of [[], ['--narrow']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--theme-editor', ...flags], install).trim());
      assert.equal(result.tuiThemeEditor, 'passed'); assert.equal(result.sourceColorComponents, true);
      assert.equal(result.pluginForkPreservesOriginal, true); assert.equal(result.pendingPreviewClose, true);
      assert.equal(result.rawMessagesComplete, true); assert.equal(result.installedCLI, true);
      assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
    }
  }
  const tuiExternalEditor=process.argv.includes('--tui-external-editor');
  if(tuiExternalEditor){
    for(const name of ['external-editor','external-editor-source'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line']]){
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--external-editor',...flags],install).trim());
      assert.equal(result.tuiExternalEditor,'passed');assert.equal(result.pendingChildReaped,true);
      assert.equal(result.installedCLI,true);assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  const inputHistory=process.argv.includes('--tui-input-history');
  if(inputHistory){
    for(const name of ['tui-input-history','tui-input-history-source','tui-input-history-sensitive','tui-input-history-read'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line'],['--search-chain'],['--search-chain','--line']]){
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-input-history.mjs'),'--cli',executable,...flags],install).trim());
      assert.equal(result.tuiInputHistory,'passed');assert.equal(result.crossProcessRestart,true);assert.equal(result.installedCLI,true);assert.equal(result.paidUpstreamCalls,0);
      if(flags.includes('--search-chain'))assert.equal(result.tuiHistorySearch,'passed');console.log(JSON.stringify(result));
    }
  }
  const tuiStatusLine=process.argv.includes('--tui-status-line');
  if(tuiStatusLine){
    for(const name of ['tui-statusline','tui-statusline-source','tui-statusline-schema','tui-statusline-usage','tui-statusline-components'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--status-line','--narrow'],install).trim());
    assert.equal(result.tuiStatusLine,'passed');assert.equal(result.pendingChildReaped,true);assert.equal(result.installedCLI,true);
    assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
  }
  const tuiFocus=process.argv.includes('--tui-terminal-focus');
  if(tuiFocus){
    for(const name of ['tui-focus','tui-focus-source'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line']]){
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--terminal-focus',...flags],install).trim());
      assert.equal(result.tuiTerminalFocus,'passed');assert.equal(result.sourceVisualInverse,true);assert.equal(result.installedCLI,true);
      assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  const tuiGestures=process.argv.includes('--tui-input-gestures');
  if(tuiGestures){
    for(const name of ['tui-input-gestures','tui-input-gesture-source'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line']]){
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--input-gestures',...flags],install).trim());
      assert.equal(result.tuiInputGestures,'passed');assert.equal(result.confirmedExit,true);assert.equal(result.installedCLI,true);
      assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  const tuiReturn=process.argv.includes('--tui-return');
  if(tuiReturn){
    for(const name of ['tui-input-return','tui-input-return-source'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line']]){
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--return-gesture',...flags],install).trim());
      assert.equal(result.tuiReturnGesture,'passed');assert.equal(result.exactSubmission,true);assert.equal(result.installedCLI,true);
      assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  const tuiVim=process.argv.includes('--tui-vim');
  if(tuiVim){
    for(const name of ['tui-vim','tui-vim-source','tui-vim-keys','tui-vim-settings-source'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line']]){
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--vim',...flags],install).trim());
      assert.equal(result.tuiVim,'passed');assert.equal(result.exactSubmission,true);assert.equal(result.settingSaves,true);
      assert.equal(result.installedCLI,true);assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  const tuiFoldPaste=process.argv.includes('--tui-fold-paste');
  if (tuiFoldPaste) {
    for (const name of ['tui-input-paste','tui-input-paste-source']) assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line']]) {
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--fold-paste',...flags],install).trim());
      assert.equal(result.tuiFoldPaste,'passed');assert.equal(result.exactExpandedSubmit,true);
      assert.equal(result.installedCLI,true);assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  const tuiProgress = process.argv.includes('--tui-thinking-progress');
  if (tuiProgress) {
    for (const name of ['tui-progress', 'tui-progress-source', 'tui-progress-spinner', 'tui-progress-star', 'tui-progress-time', 'tui-progress-tasks', 'tui-progress-completion'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    for (const flags of [[], ['--narrow']]) {
      const result=JSON.parse(run(process.execPath,
        [path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--thinking-progress',...flags],install).trim());
      assert.equal(result.tuiThinkingProgress,'passed'); assert.equal(result.taskSummary,true);
      assert.equal(result.sourceShimmer,true); assert.equal(result.durableTiming,true);
      assert.equal(result.installedCLI,true); assert.equal(result.paidUpstreamCalls,0); console.log(JSON.stringify(result));
    }
  }
  const tuiProgressSettings=process.argv.includes('--tui-progress-settings');
  if (tuiProgressSettings) {
    for (const name of ['tui-progress-settings','tui-progress-settings-source'])
      assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for (const flags of [[],['--narrow']]) {
      const result=JSON.parse(run(process.execPath,
        [path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--progress-settings',...flags],install).trim());
      assert.equal(result.tuiProgressSettings,'passed');assert.equal(result.cacheReflow,true);
      assert.equal(result.resumeRestores,true);assert.equal(result.installedCLI,true);
      assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  console.log(JSON.stringify({ package: "passed", compiledCLI: true, binHelp: true, offlineInstall: true,
    packagedDemo: true, installedLauncherHelp: true, installedLauncherFixtures: true, installedStartupFixtures: true,
    devRuntimeAbsent: true, extractedSamplesExcluded: true, files: packed.files.length,
    ...(tuiPreviews ? { installedTuiPreviews: true, installedLinePreview: true, localPreviewModelCalls: 15 } : {}),
    ...(tuiMessages ? { installedTuiMessages: true, localMessageModelCalls: 6, installedStreamingChunks: true } : {}),
    ...(tuiPacing ? { installedTuiPacing: true, installedFatalInputClose: true, localPacingModelCalls: 10 } : {}),
    ...(tuiVisibility ? { installedTuiVisibility: true, installedWindowsTerminalGate: true, localVisibilityModelCalls: 10 } : {}),
    ...(tuiEditing ? { installedTuiEditing: true, installedLineEditing: true, localEditingModelCalls: 10 } : {}),
    ...(tuiKillRing ? { installedTuiKillRing: true, installedLineKillRing: true, localKillModelCalls: 10 } : {}),
    ...(tuiUndo ? { installedTuiUndo: true, installedLineUndo: true, localUndoModelCalls: 10 } : {}),
    ...(tuiProseWidth ? { installedTuiProseWidth: true, localProseModelCalls: 6 } : {}),
    ...(tuiHighlight ? { installedTuiHighlightSetting: true, localHighlightModelCalls: 5 } : {}),
    ...(tuiTheme ? { installedTuiThemeSetting: true, localThemeModelCalls: 5 } : {}),
    ...(tuiSystemTheme ? { installedTuiSystemTheme: true, installedMuxFallback: true, localSystemThemeModelCalls: 4 } : {}),
    ...(tuiCustomTheme ? { installedTuiCustomTheme: true, localCustomThemeModelCalls: 3 } : {}),
    ...(tuiPluginTheme ? { installedTuiPluginTheme: true, localPluginThemeModelCalls: 3 } : {}),
    ...(tuiThemeEditor ? { installedTuiThemeEditor: true, localThemeEditorModelCalls: 4 } : {}),
    ...(inputHistory?{installedTuiInputHistory:true,localHistoryModelCalls:6}:{}),
    ...(tuiStatusLine?{installedTuiStatusLine:true,localStatusLineModelCalls:1}:{}),
    ...(tuiExternalEditor?{installedTuiExternalEditor:true,localEditorModelCalls:6}:{}),
    ...(tuiVim?{installedTuiVim:true,installedLineVim:true,localVimModelCalls:18}:{}),
    ...(tuiReturn?{installedTuiReturn:true,installedLineReturn:true,localReturnModelCalls:13}:{}),
    ...(tuiGestures?{installedTuiInputGestures:true,installedLineInputGestures:true,localGestureModelCalls:8}:{}),
    ...(tuiFoldPaste ? {installedTuiFoldPaste:true,localFoldPasteModelCalls:16} : {}),
    ...(tuiProgress ? {installedTuiThinkingProgress:true, localThinkingModelCalls:12} : {}),
    ...(tuiProgressSettings ? {installedTuiProgressSettings:true,localProgressSettingsModelCalls:16} : {}),
    archiveSha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
    upstreamRequests: 0 }));
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
