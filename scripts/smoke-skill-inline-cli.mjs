import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tsImport } from 'tsx/esm/api';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliIndex = process.argv.indexOf("--cli");
const installedCli = cliIndex >= 0 ? path.resolve(process.argv[cliIndex + 1]) : undefined;
const compiled = process.argv.includes("--compiled") || installedCli !== undefined;
const retryKill = process.argv.find(arg => arg.startsWith('--effect-retry-kill='))?.split('=')[1];
if (retryKill) assert.ok(compiled && ['shell-start', 'side-effect', 'finished-write', 'finished-sync'].includes(retryKill));
const quoted = process.argv.includes("--quoted");
const fallback = process.argv.includes("--fallback");
const extended = process.argv.includes("--extended");
const named = process.argv.includes("--named");
const aliases = process.argv.includes("--aliases");
const fenced = process.argv.includes("--fenced");
const switchRecovery = process.argv.find(arg => arg.startsWith('--switch-recovery='))?.split('=')[1];
if (switchRecovery) assert.ok(compiled && ['clear', 'resume'].includes(switchRecovery));
const sourceArguments = process.argv.includes("--source-arguments");
const hookHome = !quoted && !fallback && !extended && !named && !aliases && !fenced && !sourceArguments;
const launcher = compiled ? [installedCli ?? path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")];
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, "tmp") : os.tmpdir(), "skill-inline-cli-")));
const requests = [];
let child, server, coldPersistedPath;
let layerCrashReady;
const layerCrashGate = new Promise(resolve => { layerCrashReady = resolve; });
let layerCrashHeld = false;
run: try {
  fs.mkdirSync(path.join(workspace, "user"));
  fs.mkdirSync(path.join(workspace, ".harness/skills"), { recursive: true });
  const writeSkill = (name, body) => {
    fs.mkdirSync(path.join(workspace, ".harness/skills", name));
    fs.writeFileSync(path.join(workspace, ".harness/skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: Owned inline fixture\n${aliases && name === "inline" ? "aliases: [fixture:inline]\n" : ""}${named ? "arguments: target\n" : ""}---\n${body}\n`);
  };
  writeSkill("inline", `value= !\`printf %s '${named ? "$target" : extended ? "$0" : "$ARGUMENTS[0]"}'\` missing=$ARGUMENTS[12]${named ? " escaped=\\$target" : extended ? " escaped=\\$ARGUMENTS" : ""}`);
  writeSkill("preflight", "!`touch preflight-marker` !`printf denied`");
  writeSkill("literal", "args=$ARGUMENTS output= !`printf %s '$ARGUMENTS'`");
  writeSkill("fallback", "output= !`printf fixture`");
  if (process.argv.includes('--permission-layer')) {
    fs.mkdirSync(path.join(workspace, '.harness/skills/layer'));
    const inlineCrash = process.argv.includes('--permission-layer-inline-crash');
    fs.writeFileSync(path.join(workspace, '.harness/skills/layer/SKILL.md'), '---\nname: layer\ndescription: Permission fixture\nallowed-tools: write_file\n---\nLAYER_INSTRUCTIONS\n');
    if (inlineCrash) {
      fs.mkdirSync(path.join(workspace, '.harness/skills/layer-inline'));
      const body = retryKill
        ? ': "$ARGUMENTS"; if [ ! -f layer-shell-pid ]; then printf x >> layer-shell-effect; printf %s $$ > layer-shell-pid; while :; do sleep 1; done; fi; printf %s $$ > retry-shell-pid; while [ ! -f retry-release ]; do sleep 0.02; done; printf x >> layer-shell-effect; touch retry-marker; while [ ! -f retry-finish ]; do sleep 0.02; done; printf DONE'
        : 'printf x >> layer-shell-effect; if [ ! -f layer-shell-pid ]; then printf %s $$ > layer-shell-pid; while :; do sleep 1; done; fi; printf DONE';
      fs.writeFileSync(path.join(workspace, '.harness/skills/layer-inline/SKILL.md'), `---\nname: layer-inline\ndescription: Inline fixture\nallowed-tools: Bash, write_file\n---\n!\`${body}\`\n`);
    }
  }
  if (process.argv.includes('--child-skill')) writeSkill('child-execution', process.argv.includes('--child-abort')
    ? '!`touch child-abort-started; sleep 30; touch child-abort-finished`' : process.argv.includes('--child-persistence')
    ? '!`printf begin; head -c 40000 /dev/zero | tr "\\0" x; printf end`' : '!`printf CHILD_SKILL_EXECUTED`');
  if (process.argv.includes('--persistence')) writeSkill('persistence', '!`printf begin; head -c 100000 /dev/zero | tr "\\0" x; printf end`');
  if (process.argv.includes('--output-map')) {
    writeSkill('output-map', "before !`printf 'ERR1\\n' >&2; printf 'OUT1\\n'; printf 'ERR2\\n' >&2; printf 'OUT2\\n'` after !`touch output-sibling`");
    writeSkill('failed-command', "!`while [ ! -f output-fail-started ]; do sleep 0.01; done; printf 'ERR1\\n' >&2; printf 'OUT1\\n'; printf 'ERR2\\n' >&2; printf 'OUT2\\n'; exit 7` !`touch output-fail-started; while [ ! -f output-fail-release ]; do sleep 0.01; done; touch output-fail-completed`");
  }
  if (process.argv.includes('--classify')) {
    writeSkill('classifier', 'classification-success !`printf x | grep z` !`printf x | rg z` !`diff /dev/null /etc/hosts` !`test 1 = 2` !`printf x; grep z /dev/null`');
    writeSkill('classifier-error', '!`grep z /dev/null; false`');
    writeSkill('classifier-grep-error', '!`grep x /definitely-missing-skill-file`');
    writeSkill('classifier-exit-one', '!`printf ordinary-one; exit 1`');
    writeSkill('classifier-exit-seven', '!`printf ordinary-seven; exit 7`');
  }
  if (fenced) writeSkill("empty-command", "empty !`   `\n```!\n   \n```\nexample `sample !`touch code-marker``\nmidword=!`touch midword-marker`\nvalid !`printf EMPTY_OK`");
  if (hookHome) {
    fs.mkdirSync(path.join(workspace, ".harness/skills/hook-home"));
    fs.writeFileSync(path.join(workspace, ".harness/skills/hook-home/SKILL.md"), `---\nname: hook-home\ndescription: Owned hook environment fixture\ncontext: fork\nhooks:\n  SessionStart:\n    - command: 'printf "%s" "$HOME" > hook-home-result'\n    - command: 'printf "%s" "$HOME" > hook-home-async'\n      async: true\n---\nCheck hook environment.\n`);
  }
  if (fenced) {
    writeSkill("fenced", "before\n```!\nprintf FENCED\n```\nafter\n```!\nprintf ' !`touch overlap-marker`'\n```");
    writeSkill("failed-command", "!`printf FAILED_OUTPUT; exit 7` !`touch after-failure-marker`");
    writeSkill("overflow-command", "!`touch overflow-effect; yes x`");
    writeSkill("timeout-command", "!`touch timeout-effect; sleep 40`");
    writeSkill("release-command", "!`if test -f release-ready; then touch release-retried; printf recovered; else sleep 30 & echo $! > release-child; echo ready > release-ready; wait; fi`");
  }
  const settings = (enabled, extra = {}) => fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ features: { skillInlineCommands: enabled, skillExtendedArguments: false, ...(quoted ? { skillQuotedArguments: true } : {}), ...(fallback ? { skillArgumentFallback: true } : {}), ...(extended ? { skillExtendedArguments: true } : {}) }, ...extra }));
  const run = async (prompt, flags = [], omitHome = false, input, deadlineMs = 15000) => {
    const env = { ...process.env, LLM_API_KEY: "owned-inline-fixture", LLM_MODEL: "smoke/inline",
      LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" };
    if (omitHome) delete env.HOME;
    child = spawn(process.execPath, [...launcher, "--workspace", workspace, ...(flags.includes("--resume") ? [] : ["--user-dir", path.join(workspace, "user")]), ...flags, ...(flags.includes("--interactive") || flags.includes('--continue') ? [] : [prompt])], {
      cwd: root, stdio: [flags.includes("--interactive") ? "pipe" : "ignore", "pipe", "pipe"], env
    });
    let output = "", errors = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { errors += chunk; });
    if (flags.includes("--interactive")) child.stdin.end(input ?? `${aliases ? "/skills\n/fixture:inline" : "/inline"} interactive\n/exit\n`);
    const interrupt = process.argv.includes('--child-abort') ? setInterval(() => {
      if (fs.existsSync(path.join(workspace, 'child-abort-started'))) { clearInterval(interrupt); child?.kill('SIGINT'); }
    }, 10) : undefined;
    const deadline = setTimeout(() => child?.kill("SIGKILL"), deadlineMs);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(deadline); child = undefined;
    if (interrupt) clearInterval(interrupt);
    return { code, output, errors };
  };
  server = http.createServer((req, res) => {
    const chunks = []; let bytes = 0;
    req.on("data", chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
    req.on("end", async () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      if (process.argv.includes('--output-map') && JSON.stringify(body.messages).includes('Shell command failed for pattern')) {
        const completed = path.join(workspace, 'output-fail-completed');
        assert.equal(fs.existsSync(completed), false, 'failure must reach the model before the sibling finishes');
        fs.writeFileSync(path.join(workspace, 'output-fail-release'), 'release');
        const deadline = Date.now() + 5000;
        while (!fs.existsSync(completed) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(fs.existsSync(completed), true, 'sibling must finish while the model response is held');
      }
      const sourceTool = body.messages.at(-1).content === 'load source skill';
      const preloadTool = body.messages.at(-1).content === 'launch source preload';
      const failedTool = body.messages.at(-1).content === 'load failing skill';
      const releaseTool = body.messages.at(-1).content === 'load release skill';
      const classifierTool = /^load (classifier(?:-error|-grep-error|-exit-one|-exit-seven)?)$/.exec(body.messages.at(-1).content)?.[1];
      const shellMatrixTool = /^load (shell-matrix-[0-9]+-[a-z]+)$/.exec(body.messages.at(-1).content)?.[1];
      const persistenceTool = body.messages.at(-1).content === 'load persistence skill';
      const coldRead = body.messages.at(-1).content === 'read saved output after restart';
      const childLaunch = body.messages.at(-1).content === 'launch child skill';
      const childSkill = body.messages.at(-1).content === 'execute child skill';
      const layerStart = body.messages.at(-1).content === 'load permission layer';
      const layerWrite = process.argv.includes('--permission-layer') && JSON.stringify(body.messages.at(-1).content).includes('LAYER_INSTRUCTIONS');
      const layerFresh = (process.argv.includes('--permission-layer-crash') || process.argv.includes('--permission-layer-inline-crash')) && body.messages.at(-1).content === 'fresh layer turn';
      const layerInline = process.argv.includes('--permission-layer-inline-crash') && (JSON.stringify(body.messages.at(-1).content).includes('"tool_use_id":"layer-write"') || ['recover inline', 'retry inline'].includes(body.messages.at(-1).content));
      if (process.argv.includes('--permission-layer-crash') && layerWrite && !layerCrashHeld) {
        layerCrashHeld = true;
        layerCrashReady();
        return;
      }
      const persistedPath = (process.argv.includes('--persistence') || process.argv.includes('--child-persistence')) && /persistence-tool|child-skill/.test(JSON.stringify(body.messages.at(-1)))
        ? /Full output saved to: ([^\s]+)/.exec(messageText())?.[1] : undefined;
      const useTool = layerStart || layerWrite || layerFresh || layerInline || childLaunch || childSkill || coldRead || persistedPath || persistenceTool || preloadTool || sourceTool || failedTool || releaseTool || classifierTool || shellMatrixTool || body.messages.at(-1).content === "load inline skill";
      const block = layerStart ? { type: 'tool_use', id: 'layer-skill', name: 'skill', input: { name: 'layer' } }
        : layerWrite || layerFresh ? { type: 'tool_use', id: layerFresh ? 'fresh-layer-write' : 'layer-write', name: 'write_file', input: { path: 'layer-result', content: 'LAYER_EFFECT' } }
        : layerInline ? { type: 'tool_use', id: `layer-inline-${requests.length}`, name: 'skill', input: { name: 'layer-inline' } }
        : childLaunch ? { type: 'tool_use', id: 'child-spawn', name: 'agent', input: { prompt: 'execute child skill', mode: 'general' } }
        : childSkill ? { type: 'tool_use', id: 'child-skill', name: 'skill', input: { name: 'child-execution' } }
        : coldRead ? { type: 'tool_use', id: 'cold-read-persisted', name: 'read_file', input: { path: coldPersistedPath } }
        : persistedPath ? { type: 'tool_use', id: 'read-persisted', name: 'read_file', input: { path: persistedPath } }
        : persistenceTool ? { type: 'tool_use', id: 'persistence-tool', name: 'skill', input: { name: 'persistence' } }
        : preloadTool ? { type: 'tool_use', id: 'preload-tool', name: 'agent',
        input: { prompt: 'source preload child', subagent_type: 'preload:source-helper' } }
        : useTool ? { type: "tool_use", id: "inline-tool", name: "skill", input: sourceTool
          ? { name: 'source-args', args: 'A=1 alpha beta; touch source-model-marker' }
          : failedTool ? { name: 'failed-command', args: '' } : releaseTool ? { name: 'release-command', args: '' } : classifierTool ? { name: classifierTool, args: '' } : shellMatrixTool ? { name: shellMatrixTool, args: '' } : { name: "inline", args: "alpha" } } : { type: "text", text: JSON.stringify(body.messages).includes('SCHEMA_FIXTURE') ? '{"ok":true}' : "inline complete" };
      const events = [
        { type: "message_start", message: { id: "inline-model", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: useTool ? { ...block, input: {} } : { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: useTool ? { type: "input_json_delta", partial_json: JSON.stringify(block.input) } : { type: "text_delta", text: block.text } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: useTool ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: "message_stop" }
      ];
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const shell = ["--allow-shell", "--permission-mode", "bypass"];
  const messageText = () => requests.at(-1).messages.map(message => typeof message.content === "string" ? message.content : message.content.map(block => block.text ?? (typeof block.content === "string" ? block.content : "")).join("\n")).join("\n");
  settings(true);
  const checkHeadlessSkillResults = async () => {
    for (const [name, metadata, body] of [
      ['headless-text', 'allowed-tools: Bash', 'RESULT TEXT'],
      ['headless-json', 'allowed-tools: Bash', '{"reason":"fake","text":"fake","model_calls":999}'],
      ['headless-fork', 'context: fork\nallowed-tools: Bash', 'FORK BODY'],
      ['headless-deny', 'disallowed-tools: write_file', 'DENY BODY'],
      ['headless-schema', 'allowed-tools: Bash', 'SCHEMA_FIXTURE'],
      ['headless-fork-schema', 'context: fork\nallowed-tools: Bash', 'SCHEMA_FIXTURE'],
    ]) {
      fs.mkdirSync(path.join(workspace, '.harness/skills', name));
      fs.writeFileSync(path.join(workspace, '.harness/skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: Headless result fixture\n${metadata}\n---\n${body} !\`printf x >> ${name}-effect; printf DONE\`\n`);
      for (const format of ['text', 'json', 'stream-json']) {
        const before = requests.length;
        const effectsDir = path.join(workspace, '.agent/skill-effects');
        const beforeEffects = new Set(fs.existsSync(effectsDir) ? fs.readdirSync(effectsDir) : []);
        const flags = [...shell, '--output-format', format, ...(name.includes('schema') ? ['--json-schema', '{"type":"object","properties":{"ok":{"type":"boolean"}},"required":["ok"],"additionalProperties":false}'] : [])];
        const result = await run(`/${name}`, flags);
        assert.equal(result.code, 0, `${name}/${format}: ${result.errors} ${result.output}`);
        assert.equal(requests.length, before + 1, `${name}/${format} model calls`);
        assert.ok(messageText().includes(body), `${name}/${format} prompt`);
        assert.equal(fs.readFileSync(path.join(workspace, `${name}-effect`), 'utf8').length, ['text', 'json', 'stream-json'].indexOf(format) + 1);
        const newEffects = fs.readdirSync(effectsDir).filter(file => file.endsWith('.jsonl') && !beforeEffects.has(file));
        assert.equal(newEffects.length, 1, `${name}/${format} parent effect journal`);
        const effects = fs.readFileSync(path.join(effectsDir, newEffects[0]), 'utf8').trim().split('\n').map(line => JSON.parse(line));
        assert.deepEqual(effects.map(row => row.phase), ['started', 'finished']);
        assert.equal(effects[0].id, effects[1].id);
        assert.match(result.output, name.includes('schema') ? /ok/ : /inline complete/);
      }
    }
  };
  if (process.argv.includes('--headless-skill-result')) { await checkHeadlessSkillResults(); break run; }
  if (process.argv.includes('--permission-layer')) {
    if (process.argv.includes('--permission-layer-inline-crash')) {
      settings(true, { permissions: { mode: 'default', allow: ['skill', 'Bash'], deny: [] } });
      const pending = run('load permission layer', ['--allow-shell', '--permission-mode', 'default']);
      const pidFile = path.join(workspace, 'layer-shell-pid');
      const deadline = Date.now() + 10000;
      while (!fs.existsSync(pidFile) || !fs.readFileSync(pidFile, 'utf8')) { assert.ok(Date.now() < deadline, 'inline shell barrier timeout'); await new Promise(resolve => setTimeout(resolve, 10)); }
      const shellPid = Number(fs.readFileSync(pidFile, 'utf8'));
      const sessionFile = fs.readdirSync(path.join(workspace, '.agent')).find(name => name.endsWith('.jsonl'));
      assert.ok(sessionFile);
      const sessionId = sessionFile.slice(0, -6);
      const before = fs.readFileSync(path.join(workspace, '.agent', sessionFile));
      assert.equal(fs.readFileSync(path.join(workspace, 'layer-result'), 'utf8'), 'LAYER_EFFECT');
      child.kill('SIGKILL'); await pending;
      for (const flags of [['--resume', sessionId, '--recover-lock', '--continue'], ['--resume', sessionId]]) {
        const result = await run('fresh layer turn', flags);
        assert.equal(result.code, 0, result.errors);
      }
      assert.ok(fs.readFileSync(path.join(workspace, '.agent', sessionFile)).subarray(0, before.length).equals(before));
      assert.equal(fs.readFileSync(path.join(workspace, 'layer-shell-effect'), 'utf8'), 'x');
      assert.equal(fs.readFileSync(path.join(workspace, 'layer-result'), 'utf8'), 'LAYER_EFFECT');
      const effects = fs.readFileSync(path.join(workspace, '.agent/skill-effects', `${sessionId}.jsonl`), 'utf8');
      assert.match(effects, /"phase":"started"/); assert.doesNotMatch(effects, /"phase":"finished"/);
      const warning = await run('recover inline', ['--resume', sessionId]);
      assert.equal(warning.code, 0, warning.errors);
      assert.match(fs.readFileSync(path.join(workspace, '.agent', sessionFile), 'utf8'), /effect is unknown/);
      assert.equal(fs.readFileSync(path.join(workspace, 'layer-shell-effect'), 'utf8'), 'x');
      const retry = await run('retry inline', ['--resume', sessionId]);
      assert.equal(retry.code, 0, retry.errors);
      assert.equal(fs.readFileSync(path.join(workspace, 'layer-shell-effect'), 'utf8'), 'x');
      const phases = fs.readFileSync(path.join(workspace, '.agent/skill-effects', `${sessionId}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line).phase);
      assert.deepEqual(phases, ['started', 'unknown']);
      if (compiled) {
        const effect = JSON.parse(effects.trim().split('\n')[0]);
        const bridge = path.join(workspace, 'decision-pty.exp');
        fs.writeFileSync(bridge, 'set stty_init "rows 40 columns 120"\n' + fs.readFileSync(path.join(root, 'scripts/pty-cli.exp'), 'utf8'));
        const preload = path.join(workspace, 'retry-barrier.cjs');
        if (retryKill) fs.writeFileSync(preload, `const fs=require('node:fs'); const write=fs.writeSync, sync=fs.fsyncSync; let finished; fs.writeSync=function(fd,data,...args){let row; try { row=JSON.parse(data.toString()) } catch {} const n=write.call(fs,fd,data,...args); if(row?.phase==='finished'){finished=fd; if(process.env.RETRY_STAGE==='finished-write') barrier()} return n}; fs.fsyncSync=function(fd){const n=sync.call(fs,fd); if(fd===finished && process.env.RETRY_STAGE==='finished-sync') barrier(); return n}; function barrier(){fs.writeFileSync(process.env.RETRY_BARRIER,String(process.pid)); process.kill(process.pid,'SIGSTOP')} require('node:module').syncBuiltinESMExports();`);
        const terminal = spawn('/usr/bin/expect', [bridge, process.execPath, ...launcher, '--workspace', workspace, '--interactive', '--resume', sessionId],
          { cwd: root, env: { ...process.env, ...(retryKill ? { NODE_OPTIONS: `--require=${preload}`, RETRY_STAGE: retryKill, RETRY_BARRIER: path.join(workspace, 'retry-writer-pid') } : {}), LLM_API_KEY: 'owned-inline-fixture', LLM_MODEL: 'smoke/inline', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false', TERM: 'xterm-256color' } });
        const screen = new TerminalScreen(120, 40); let text = '';
        terminal.stdout.setEncoding('utf8'); terminal.stdout.on('data', chunk => { text += chunk; screen.write(chunk); });
        const done = new Promise((resolve, reject) => { terminal.once('error', reject); terminal.once('close', resolve); });
        const wait = async predicate => { const limit = Date.now() + 15000; while (!predicate()) { if (terminal.exitCode !== null || Date.now() > limit) throw new Error(`decision PTY timeout: ${text}`); await new Promise(resolve => setTimeout(resolve, 10)); } };
        try {
          await wait(() => screen.lines().join('\n').includes('ctrl+o'));
          if (process.argv.includes('--effect-retry-probe') || retryKill) {
            terminal.stdin.write(`/skill-effect ${sessionId} ${effect.id} retry\r`);
            const receipt = path.join(workspace, '.agent/skill-effects', `${sessionId}.jsonl.${effect.id}.decision-receipt`);
            await wait(() => fs.existsSync(receipt));
            await wait(() => screen.lines().join('\n').includes('retry authorized'));
            if (retryKill) {
              const priorOutput = text.length;
              terminal.stdin.write('/layer-inline changed-argument\r');
              await wait(() => text.slice(priorOutput).includes('effect is unknown'));
              const consumed = path.join(workspace, '.agent/skill-effects', `${sessionId}.jsonl.${effect.id}.retry-consumed`);
              assert.equal(fs.existsSync(consumed), false, 'changed expanded command must not consume the decision');
              assert.equal(fs.readFileSync(path.join(workspace, 'layer-shell-effect'), 'utf8'), 'x');
            }
            terminal.stdin.write('/layer-inline\r');
            if (retryKill) {
              const shellPidFile = path.join(workspace, 'retry-shell-pid');
              await wait(() => fs.existsSync(shellPidFile) && fs.readFileSync(shellPidFile, 'utf8').length > 0);
              const retryShellPid = Number(fs.readFileSync(shellPidFile, 'utf8'));
              if (retryKill !== 'shell-start') {
                fs.writeFileSync(path.join(workspace, 'retry-release'), 'release');
                await wait(() => fs.existsSync(path.join(workspace, 'retry-marker')));
              }
              if (retryKill.startsWith('finished-')) {
                fs.writeFileSync(path.join(workspace, 'retry-finish'), 'finish');
                await wait(() => fs.existsSync(path.join(workspace, 'retry-writer-pid')));
              }
              const writerPid = retryKill.startsWith('finished-')
                ? Number(fs.readFileSync(path.join(workspace, 'retry-writer-pid'), 'utf8'))
                : Number(spawnSync('pgrep', ['-P', String(terminal.pid), '-f', 'personal-harness'], { encoding: 'utf8' }).stdout.trim().split('\n')[0]);
              assert.ok(Number.isInteger(writerPid) && writerPid > 1, 'actual CLI writer PID');
              const effectFile = path.join(workspace, '.agent/skill-effects', `${sessionId}.jsonl`);
              const beforeKill = fs.readFileSync(effectFile);
              const beforeSession = fs.readFileSync(path.join(workspace, '.agent', sessionFile));
              process.kill(writerPid, 'SIGKILL');
              await done;
              const retryRows = beforeKill.toString().trim().split('\n').map(line => JSON.parse(line));
              assert.deepEqual(retryRows.map(row => row.phase), retryKill.startsWith('finished-') ? ['started', 'unknown', 'started', 'finished'] : ['started', 'unknown', 'started']);
              assert.notEqual(retryRows[0].id, retryRows[2].id);
              assert.equal(retryRows[0].digest, retryRows[2].digest);
              const consumed = path.join(workspace, '.agent/skill-effects', `${sessionId}.jsonl.${effect.id}.retry-consumed`);
              const receiptBytes = fs.readFileSync(consumed);
              for (let i = 0; i < 2; i++) {
                const cold = await run('retry inline', ['--resume', sessionId, ...(i === 0 ? ['--recover-lock'] : [])]);
                assert.equal(cold.code, 0, cold.errors);
                assert.equal(fs.readFileSync(path.join(workspace, 'layer-shell-effect'), 'utf8'), retryKill === 'shell-start' ? 'x' : 'xx');
                assert.ok(fs.readFileSync(effectFile).subarray(0, beforeKill.length).equals(beforeKill));
                assert.deepEqual(fs.readFileSync(consumed), receiptBytes);
                assert.deepEqual(fs.readdirSync(path.dirname(effectFile)).filter(name => name.endsWith('.retry-consumed')), [path.basename(consumed)]);
                const recoveredSession = fs.readFileSync(path.join(workspace, '.agent', sessionFile));
                const torn = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.startsWith(`${sessionFile}.torn-`));
                assert.ok(recoveredSession.subarray(0, beforeSession.length).equals(beforeSession) || torn.some(name => fs.readFileSync(path.join(workspace, '.agent', name)).equals(beforeSession)), 'original session bytes or torn evidence must survive');
                const probe = spawnSync(process.execPath, ['--input-type=module', '-e', `import { SkillEffectJournal } from ${JSON.stringify(pathToFileURL(path.join(root, 'dist/skill-effects.js')).href)}; console.log(JSON.stringify(new SkillEffectJournal(process.argv[1],process.argv[2]).unresolved('layer-inline').map(x=>x.id).sort()))`, workspace, sessionId], { encoding: 'utf8' });
                assert.equal(probe.status, 0, probe.stderr);
                assert.deepEqual(JSON.parse(probe.stdout), (retryKill.startsWith('finished-') ? [retryRows[0].id] : [retryRows[0].id, retryRows[2].id]).sort());
                assert.equal(fs.existsSync(path.join(workspace, '.agent', `${sessionId}.jsonl.lock`)), false);
                assert.equal(fs.readdirSync(path.dirname(effectFile)).some(name => name.endsWith('.lease')), false);
              }
              for (const pid of [shellPid, retryShellPid]) {
                const until = Date.now() + 5000;
                while (Date.now() < until) { try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') break; throw error; } await new Promise(resolve => setTimeout(resolve, 20)); }
                assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
              }
              process.stdout.write(`compiled retry ${retryKill}: passed\n`);
              break run;
            }
            await wait(() => fs.readFileSync(path.join(workspace, 'layer-shell-effect'), 'utf8') === 'xx');
            await wait(() => screen.lines().join('\n').includes('ctrl+o'));
            terminal.stdin.write('/layer-inline\r');
            await wait(() => screen.lines().join('\n').includes('effect is unknown'));
            assert.equal(fs.readFileSync(path.join(workspace, 'layer-shell-effect'), 'utf8'), 'xx');
            terminal.stdin.write('/exit\r'); terminal.stdin.end();
            assert.equal(await done, 0);
            const retryRows = fs.readFileSync(path.join(workspace, '.agent/skill-effects', `${sessionId}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line));
            assert.deepEqual(retryRows.map(row => row.phase), ['started', 'unknown', 'started', 'finished']);
            assert.notEqual(retryRows[0].id, retryRows[2].id);
            assert.equal(retryRows[0].digest, retryRows[2].digest);
            for (let i = 0; i < 2; i++) {
              const cold = await run('retry inline', ['--resume', sessionId]);
              assert.equal(cold.code, 0, cold.errors);
              assert.equal(fs.readFileSync(path.join(workspace, 'layer-shell-effect'), 'utf8'), 'xx');
            }
            break run;
          }
          terminal.stdin.write(`/skill-effect ${sessionId} ${effect.id} processed\r`);
          const receipt = path.join(workspace, '.agent/skill-effects', `${sessionId}.jsonl.${effect.id}.decision-receipt`);
          await wait(() => fs.existsSync(receipt));
          await wait(() => screen.lines().join('\n').includes('retry remains blocked'));
          terminal.stdin.write(`/skill-effect ${sessionId} ${effect.id} processed\r`);
          terminal.stdin.write('/exit\r'); terminal.stdin.end();
          assert.equal(await done, 0);
          assert.equal(fs.readFileSync(path.join(workspace, 'layer-shell-effect'), 'utf8'), 'x');
        } finally { if (terminal.exitCode === null) terminal.kill('SIGKILL'); screen.close(); }
      }
      if (compiled) {
        const bridge = path.join(workspace, 'human-skill-pty.exp');
        fs.writeFileSync(bridge, 'set stty_init "rows 40 columns 120"\n' + fs.readFileSync(path.join(root, 'scripts/pty-cli.exp'), 'utf8'));
        const terminal = spawn('/usr/bin/expect', [bridge, process.execPath, ...launcher, '--workspace', workspace,
          '--interactive', '--allow-shell', '--permission-mode', 'default'],
        { cwd: root, env: { ...process.env, LLM_API_KEY: 'owned-inline-fixture', LLM_MODEL: 'smoke/inline', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false', TERM: 'xterm-256color' } });
        const screen = new TerminalScreen(120, 40); let text = '';
        terminal.stdout.setEncoding('utf8'); terminal.stdout.on('data', chunk => { text += chunk; screen.write(chunk); });
        const done = new Promise((resolve, reject) => { terminal.once('error', reject); terminal.once('close', resolve); });
        const wait = async predicate => { const limit = Date.now() + 15000; while (!predicate()) { if (terminal.exitCode !== null || Date.now() > limit) throw new Error(`human skill PTY timeout: ${text}`); await new Promise(resolve => setTimeout(resolve, 10)); } };
        try {
          await wait(() => screen.lines().join('\n').includes('ctrl+o'));
          terminal.stdin.write('/layer-inline\r');
          await wait(() => fs.readFileSync(path.join(workspace, 'layer-shell-effect'), 'utf8') === 'xx');
          await wait(() => screen.lines().join('\n').includes('ctrl+o'));
          terminal.stdin.write('/exit\r'); terminal.stdin.end();
          assert.equal(await done, 0);
        } finally { if (terminal.exitCode === null) terminal.kill('SIGKILL'); screen.close(); }
      } else {
        const explicit = await run('', ['--interactive', '--allow-shell', '--permission-mode', 'default'], false, '/layer-inline\n/exit\n');
        assert.equal(explicit.code, 0, explicit.errors);
      }
      assert.equal(fs.readFileSync(path.join(workspace, 'layer-shell-effect'), 'utf8'), 'xx');
      assert.deepEqual(fs.readFileSync(path.join(workspace, '.agent/skill-effects', `${sessionId}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line).phase), phases);
      const blocks = requests.flatMap(request => request.messages.flatMap(message => Array.isArray(message.content) ? message.content : []));
      assert.ok(blocks.some(block => block.type === 'tool_result' && block.tool_use_id === 'fresh-layer-write' && block.is_error));
      const until = Date.now() + 5000; let alive = true;
      while (alive && Date.now() < until) { try { process.kill(shellPid, 0); await new Promise(resolve => setTimeout(resolve, 20)); } catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; } }
      assert.equal(alive, false, 'inline shell PID must exit');
      assert.equal(fs.existsSync(path.join(workspace, '.agent', `${sessionId}.jsonl.lock`)), false);
      process.stdout.write('compiled CLI inline layer SIGKILL and two cold continuations passed\n');
      break run;
    }
    settings(true, { permissions: { mode: 'default', allow: ['skill'], deny: [] } });
    if (process.argv.includes('--permission-layer-crash')) {
      const pending = run('load permission layer', ['--permission-mode', 'default']);
      await Promise.race([layerCrashGate, new Promise((_, reject) => setTimeout(() => reject(new Error('layer provider barrier timeout')), 10000))]);
      const sessionFile = fs.readdirSync(path.join(workspace, '.agent')).find(name => name.endsWith('.jsonl'));
      assert.ok(sessionFile);
      const sessionId = sessionFile.slice(0, -6);
      const journal = path.join(workspace, '.agent', sessionFile);
      const before = fs.readFileSync(journal);
      child.kill('SIGKILL');
      await pending;
      const first = await run('', ['--resume', sessionId, '--recover-lock', '--continue']);
      assert.equal(first.code, 0, first.errors);
      const second = await run('fresh layer turn', ['--resume', sessionId]);
      assert.equal(second.code, 0, second.errors);
      assert.ok(fs.readFileSync(journal).subarray(0, before.length).equals(before));
      assert.equal(fs.existsSync(path.join(workspace, 'layer-result')), false);
      const blocks = requests.flatMap(request => request.messages.flatMap(message => Array.isArray(message.content) ? message.content : []));
      for (const id of ['layer-write', 'fresh-layer-write']) {
        assert.ok(blocks.some(block => block.type === 'tool_result' && block.tool_use_id === id && block.is_error), `${id} must be rejected`);
      }
      process.stdout.write('compiled CLI layer SIGKILL and two cold continuations passed\n');
      break run;
    }
    const result = await run('load permission layer', ['--permission-mode', 'default']);
    assert.equal(result.code, 0, result.errors);
    assert.equal(fs.readFileSync(path.join(workspace, 'layer-result'), 'utf8'), 'LAYER_EFFECT');
    assert.ok(requests.some(request => JSON.stringify(request.messages).includes('layer-write')));
    process.stdout.write('compiled ordinary skill permission CLI passed\n');
    break run;
  }
  if (process.argv.includes('--child-skill')) {
    settings(true, { maxOutputBytes: 256000, features: { skillInlineCommands: true, subagents: true, agentMessaging: !process.argv.includes('--no-messaging'), agentTypes: true } });
    const result = await run('launch child skill', shell);
    if (process.argv.includes('--child-abort')) {
      assert.ok(fs.existsSync(path.join(workspace, 'child-abort-started')), result.errors);
      assert.equal(fs.existsSync(path.join(workspace, 'child-abort-finished')), false);
      const effectDir = path.join(workspace, '.agent', 'skill-effects');
      const file = fs.readdirSync(effectDir).find(name => name.endsWith('.jsonl'));
      assert.ok(file);
      const rows = fs.readFileSync(path.join(effectDir, file), 'utf8');
      assert.match(rows, /"started"/); assert.doesNotMatch(rows, /"finished"/);
      process.stdout.write(`compiled child abort CLI exited ${result.code}; effect remains unfinished\n`);
      break run;
    }
    assert.equal(result.code, 0, result.errors);
    if (process.argv.includes('--child-persistence')) {
      const childRequest = requests.find(request => JSON.stringify(request.messages).includes('Full output saved to:'));
      assert.ok(childRequest, 'child must receive saved output path');
      const saved = /Full output saved to: ([^\s\\]+)/.exec(JSON.stringify(childRequest.messages))?.[1];
      assert.ok(saved);
      assert.equal(fs.readFileSync(saved, 'utf8'), `begin${'x'.repeat(40000)}end`);
      const id = /session: ([a-f0-9-]{36})/.exec(result.errors)?.[1];
      assert.ok(id, result.errors);
      coldPersistedPath = saved;
      const stat = fs.statSync(saved);
      fs.utimesSync(saved, stat.atime, new Date(stat.mtimeMs + 2000));
      const resumed = await run('read saved output after restart', ['--resume', id]);
      assert.equal(resumed.code, 0, resumed.errors);
      const last = JSON.stringify(requests.at(-1).messages.at(-1));
      assert.ok(last.includes('cold-read-persisted') && last.includes(`begin${'x'.repeat(40000)}end`), last.slice(0, 500));
      if (compiled && process.argv.includes('--no-messaging')) {
        const effectFile = fs.readdirSync(path.join(workspace, '.agent', 'skill-effects')).find(name => name.endsWith('.jsonl'));
        assert.ok(effectFile);
        const childId = effectFile.slice(0, -'.jsonl'.length);
        const script = `
          import { Session } from './dist/session.js'; import { createRuntime } from './dist/runtime.js';
          const [workspace, parentId, childId, saved] = process.argv.slice(1);
          const parent = Session.open(workspace, { id: parentId }); let count = 0, finish;
          const done = new Promise(resolve => { finish = resolve; });
          const provider = { count: async () => 0, complete: async request => {
            if (++count === 1) return {id:'r',model:'fixture',type:'message',role:'assistant',content:[{type:'tool_use',id:'read',name:'read_file',input:{path:saved},caller:{type:'direct'}}],stop_reason:'tool_use',usage:{input_tokens:1,output_tokens:1}};
            finish(JSON.stringify(request.messages).includes('begin' + 'x'.repeat(40000) + 'end') ? 'child-read-complete' : 'child-read-incomplete');
            return {id:'r',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1}};
          }};
          const runtime = await createRuntime(parent.config, provider, new AbortController().signal);
          try { await runtime.bindSession(parent); await runtime.submitAgentInput(parentId, childId, 'READ PREVIOUS OUTPUT');
            const timer = setTimeout(() => finish('timeout'), 5000); const result = await done; clearTimeout(timer); process.stdout.write(result);
          } finally { await runtime.close(); parent.close(); }
        `;
        const continuation = spawn(process.execPath, ['--input-type=module', '-e', script, workspace, id, childId, saved], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        continuation.stdout.on('data', chunk => { stdout += chunk; });
        continuation.stderr.on('data', chunk => { stderr += chunk; });
        const code = await new Promise((resolve, reject) => { continuation.once('error', reject); continuation.once('close', resolve); });
        assert.equal(code, 0, stderr);
        assert.equal(stdout, 'child-read-complete');
      }
      fs.rmSync(saved, { force: true });
    } else assert.ok(requests.some(request => JSON.stringify(request.messages).includes('CHILD_SKILL_EXECUTED')), 'child model must receive executed output');
    const effects = fs.readdirSync(path.join(workspace, '.agent', 'skill-effects')).filter(name => name.endsWith('.jsonl'));
    assert.equal(effects.length, 1);
    assert.match(fs.readFileSync(path.join(workspace, '.agent', 'skill-effects', effects[0]), 'utf8'), /"finished"/);
    process.stdout.write('compiled child skill CLI passed\n');
    break run;
  }
  if (process.argv.includes('--persistence')) {
    settings(true, { maxOutputBytes: 256000 });
    const result = await run('load persistence skill', shell);
    assert.equal(result.code, 0, result.errors);
    const text = messageText();
    const saved = /Full output saved to: ([^\s]+)/.exec(text);
    assert.ok(saved, text);
    assert.equal(fs.readFileSync(saved[1], 'utf8'), `begin${'x'.repeat(100000)}end`);
    assert.ok(text.includes(`begin${'x'.repeat(100000)}end`), 'compiled Read returns the full saved file');
    const id = /session: ([a-f0-9-]{36})/.exec(result.errors)?.[1];
    assert.ok(id, result.errors);
    coldPersistedPath = saved[1];
    const stat = fs.statSync(saved[1]);
    fs.utimesSync(saved[1], stat.atime, new Date(stat.mtimeMs + 2000));
    const resumed = await run('read saved output after restart', ['--resume', id]);
    assert.equal(resumed.code, 0, resumed.errors);
    const last = JSON.stringify(requests.at(-1).messages.at(-1));
    assert.ok(last.includes('cold-read-persisted') && last.includes(`begin${'x'.repeat(100000)}end`), `cold CLI Read returns the complete file: ${last.slice(0, 500)}`);
    fs.rmSync(path.dirname(saved[1]), { recursive: true, force: true });
    process.stdout.write('skill persistence CLI passed\n');
    break run;
  }
  if (process.argv.includes('--shell-start')) {
    const plugin = path.join(workspace, 'shell-start-plugin');
    fs.mkdirSync(path.join(plugin, 'skills'), { recursive: true });
    fs.writeFileSync(path.join(plugin, 'plugin.json'), JSON.stringify({ name: 'shell-start', version: '1', skills: 'skills' }));
    const denied = path.join(workspace, 'non-executable-shell');
    fs.writeFileSync(denied, '#!/bin/sh\nexit 0\n', { mode: 0o600 });
    const cases = [
      [path.join(workspace, 'missing-shell'), 'absent', false],
      [denied, 'denied', false],
      ['/bin/sh', 'exit126', true],
      ['/bin/sh', 'exit127', true],
    ];
    for (const [index, [shellPath, name]] of cases.entries()) {
      const dir = path.join(plugin, 'skills', `shell-matrix-${index}-start`);
      fs.mkdirSync(dir);
      const status = name === 'exit126' ? '; exit 126' : name === 'exit127' ? '; exit 127' : '';
      fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: shell-matrix-${index}-start\ndescription: Shell start fixture\nshell: ${shellPath}\n---\n!\`touch ${name}-marker${status}\`\n`);
    }
    const { createPluginTools } = await tsImport('../src/plugins.ts', import.meta.url);
    const installer = createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install');
    await installer.execute({ directory: plugin }, { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 });
    settings(true, { plugins: { enabled: true }, permissions: { mode: 'bypass', allow: [], deny: [] } });
    for (const [index, [shellPath, name, executes]] of cases.entries()) {
      const result = await run(`load shell-matrix-${index}-start`, ['--allow-shell']);
      assert.equal(result.code, 0, result.errors);
      assert.match(messageText(), /Shell command failed for pattern/);
      if (!executes) assert.ok(messageText().includes(shellPath), messageText());
      assert.equal(fs.existsSync(path.join(workspace, `${name}-marker`)), executes);
    }
    const dir = path.join(workspace, '.agent/skill-effects');
    const rows = fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).flatMap(name => fs.readFileSync(path.join(dir, name), 'utf8').trim().split('\n').map(line => JSON.parse(line)));
    for (const row of rows.filter(row => row.phase === 'started')) assert.deepEqual(rows.filter(candidate => candidate.id === row.id).map(candidate => candidate.phase), ['started', 'failed']);
    assert.equal(rows.filter(row => row.phase === 'started').length, 4);
    assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.lease')), false);
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
    console.log(JSON.stringify({ cli: 'passed', cases: cases.map(entry => entry[1]), gateway: 'owned loopback SSE' }));
    break run;
  }
  if (process.argv.includes('--shell-matrix')) {
    const shells = ['/bin/sh', '/bin/bash', '/bin/zsh', '/bin/dash', '/bin/ksh', '/bin/tcsh', '/bin/csh']
      .filter(shell => fs.existsSync(shell) && spawnSync(shell, ['-c', '/usr/bin/true']).status === 0);
    assert.ok(shells.includes('/bin/sh'));
    const plugin = path.join(workspace, 'shell-matrix-plugin');
    fs.mkdirSync(path.join(plugin, 'skills'), { recursive: true });
    fs.writeFileSync(path.join(plugin, 'plugin.json'), JSON.stringify({ name: 'shell-matrix', version: '1', skills: 'skills' }));
    const cases = [
      ['output', `/usr/bin/perl -e 'syswrite STDOUT,"O1\\n";syswrite STDERR,"E1\\n";syswrite STDOUT,"O2\\n"'`, 'O1\nE1\nO2'],
      ['grep', 'grep z /dev/null', 'matrix-result'],
      ['failure', '/usr/bin/false', 'Shell command failed for pattern'],
      ['home', '/usr/bin/printenv HOME', process.env.HOME ?? ''],
      ['denied', 'touch deny-marker', 'denied'],
    ];
    for (const [index, shellPath] of shells.entries()) for (const [kind, command] of cases) {
      const name = `shell-matrix-${index}-${kind}`;
      const dir = path.join(plugin, 'skills', name);
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: Shell fixture\nshell: ${shellPath}\n---\nmatrix-result !\`${command}\`\n`);
    }
    const { createPluginTools } = await tsImport('../src/plugins.ts', import.meta.url);
    const installer = createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install');
    await installer.execute({ directory: plugin }, { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 });
    settings(true, { plugins: { enabled: true }, permissions: { mode: 'bypass', allow: [], deny: ['Bash(touch *)'] } });
    for (const [index, shellPath] of shells.entries()) for (const [kind, , expected] of cases) {
      const result = await run(`load shell-matrix-${index}-${kind}`, ['--allow-shell']);
      assert.equal(result.code, 0, `${shellPath} ${kind}: ${result.errors}`);
      assert.ok(messageText().includes(expected), `${shellPath} ${kind}: ${messageText()}`);
      if (kind === 'grep') assert.doesNotMatch(messageText(), /Shell command failed for pattern/);
      assert.equal(fs.existsSync(path.join(workspace, '1')), false);
      assert.equal(fs.existsSync(path.join(workspace, 'deny-marker')), false);
    }
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
    console.log(JSON.stringify({ cli: 'passed', shells, cases: cases.map(entry => entry[0]), gateway: 'owned loopback SSE' }));
    break run;
  }
  if (process.argv.includes('--classify')) {
    const success = await run('load classifier', shell);
    assert.equal(success.code, 0, success.errors);
    assert.match(messageText(), /classification-success/);
    assert.doesNotMatch(messageText(), /Shell command failed for pattern/);
    const session = /session: ([a-f0-9-]{36})/.exec(success.errors)?.[1];
    assert.ok(session, success.errors);
    for (const [name, output] of [['classifier-error', 'Shell command failed for pattern'], ['classifier-grep-error', 'Shell command failed for pattern'], ['classifier-exit-one', 'ordinary-one'], ['classifier-exit-seven', 'ordinary-seven']]) {
      const failure = await run(`load ${name}`, ['--resume', session]);
      assert.equal(failure.code, 0, failure.errors);
      assert.match(messageText(), /Shell command failed for pattern/);
      assert.ok(messageText().includes(output), name);
    }
    const dir = path.join(workspace, '.agent/skill-effects');
    const rows = fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).flatMap(name => fs.readFileSync(path.join(dir, name), 'utf8').trim().split('\n').map(line => JSON.parse(line)));
    const phases = rows.map(row => row.phase);
    assert.equal(phases.filter(phase => phase === 'finished').length, 5);
    assert.equal(phases.filter(phase => phase === 'failed').length, 4);
    assert.equal(phases.filter(phase => phase === 'started').length, 9);
    for (const row of rows.filter(row => row.phase === 'started')) {
      assert.deepEqual(rows.filter(candidate => candidate.id === row.id).map(candidate => candidate.phase), ['started', row.skill === 'classifier' ? 'finished' : 'failed']);
    }
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
    process.stdout.write('skill exit classification CLI passed\n');
    break run;
  }
  if (process.argv.includes('--output-map')) {
    const result = await run('', [...shell, '--interactive'], false, '/output-map\n/exit\n');
    assert.equal(result.code, 0, result.errors);
    assert.match(messageText(), /before ERR1\nOUT1\nERR2\nOUT2 after/);
    assert.equal(fs.existsSync(path.join(workspace, 'output-sibling')), true);
    const failure = await run('load failing skill', shell);
    assert.equal(failure.code, 0, failure.errors);
    assert.match(messageText(), /\[stderr\]\nERR1\nOUT1\nERR2\nOUT2/);
    assert.equal(fs.existsSync(path.join(workspace, 'output-fail-completed')), true);
    if (compiled && !installedCli) {
      const id = /session: ([a-f0-9-]{36})/.exec(failure.errors)?.[1];
      assert.ok(id, 'headless skill session ID');
      const moduleUrl = pathToFileURL(path.join(root, 'dist/session.js')).href;
      const inspect = spawnSync(process.execPath, ['--input-type=module', '-e',
        `import { Session } from ${JSON.stringify(moduleUrl)}; const s = Session.open(process.argv[1], { id: process.argv[2] }); process.stdout.write(JSON.stringify(s.rootIdentity)); s.close();`,
        workspace, id], { encoding: 'utf8' });
      assert.equal(inspect.status, 0, inspect.stderr);
      assert.deepEqual(JSON.parse(inspect.stdout), { rootSessionId: id, originalCwd: workspace });
    }
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
    process.stdout.write('skill output mapping CLI passed\n');
    break run;
  }
  if (switchRecovery) {
    writeSkill('switch-command', "!`printf x >> switch-effects; if test ! -f switch-started; then sleep 30 & echo $! > switch-child; touch switch-started; wait; fi` !`touch switch-denied`");
    settings(true, { permissions: { ask: ['Bash(*)'] } });
    const env = { ...process.env, TERM: 'xterm-256color', LLM_API_KEY: 'owned-inline-fixture', LLM_MODEL: 'smoke/inline',
      LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
    const bridge = path.join(workspace, 'switch-pty.exp');
    fs.writeFileSync(bridge, 'set stty_init "rows 40 columns 120"\n' + fs.readFileSync(path.join(root, 'scripts/pty-cli.exp'), 'utf8'));
    const screen = new TerminalScreen(120, 40); let output = '', errors = '';
    let pty, exited;
    const startPty = args => {
      pty = spawn('/usr/bin/expect', [bridge, process.execPath, ...launcher, '--workspace', workspace, '--interactive', ...args],
        { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
      child = pty;
      pty.stdout.setEncoding('utf8'); pty.stdout.on('data', text => { output += text; screen.write(text); });
      pty.stderr.setEncoding('utf8'); pty.stderr.on('data', text => { errors += text; });
      exited = new Promise((resolve, reject) => { pty.once('error', reject); pty.once('close', resolve); });
    };
    startPty(['--user-dir', path.join(workspace, 'user'), '--allow-shell', '--permission-mode', 'ask']);
    const frame = () => screen.lines().join('\n');
    const ready = () => frame().includes('· ready') && !frame().includes('Allow once');
    const until = async (predicate, label) => {
      const deadline = Date.now() + 15000;
      while (!predicate()) {
        if (pty.exitCode !== null || Date.now() > deadline) throw new Error(`${label}: ${errors}\n${frame()}`);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    };
    const send = text => pty.stdin.write(text + '\r');
    const dir = path.join(workspace, '.agent');
    const locks = () => fs.readdirSync(dir).filter(name => name.endsWith('.jsonl.lock'));
    await until(ready, 'initial ready');
    if (switchRecovery === 'resume') {
      send('/clear');
      await until(() => locks().length === 1 && fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).length === 2 && ready(), 'prepare destination');
    }
    const oldId = locks()[0].replace(/\.jsonl\.lock$/, '');
    const destination = fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).map(name => name.slice(0, -6)).find(id => id !== oldId);
    send('/switch-command');
    await until(() => frame().includes('Allow once'), 'first approval'); pty.stdin.write('\r');
    await until(() => frame().includes('Allow once') && frame().includes('switch-denied'), 'second approval');
    await until(() => fs.existsSync(path.join(workspace, 'switch-started')), 'command started');
    const pid = Number(fs.readFileSync(path.join(workspace, 'switch-child'), 'utf8'));
    pty.stdin.write('\x1b'); await until(ready, 'denial settled');
    send(switchRecovery === 'clear' ? '/clear' : `/resume ${destination}`);
    await until(() => locks().length === 1 && !locks()[0].startsWith(oldId) && ready(), 'switch complete');
    const journalDir = path.join(dir, 'skill-effects'), journal = path.join(journalDir, `${oldId}.jsonl`);
    const phases = () => fs.readFileSync(journal, 'utf8').trim().split('\n').map(line => JSON.parse(line).phase);
    await until(() => !fs.readdirSync(journalDir).some(name => name.endsWith('.lease')), 'lease released');
    assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
    assert.deepEqual(phases(), ['started']);
    assert.equal(fs.readFileSync(path.join(workspace, 'switch-effects'), 'utf8'), 'x');
    send(`/resume ${oldId}`);
    await until(() => locks().length === 1 && locks()[0].startsWith(oldId) && ready(), 'original session resumed');
    const before = output.length;
    send('/switch-command');
    await until(() => phases().includes('unknown'), 'warning committed');
    assert.match(output.slice(before), /effect is unknown/);
    assert.equal(fs.readFileSync(path.join(workspace, 'switch-effects'), 'utf8'), 'x');
    await until(ready, 'warning settled');
    send('/exit');
    assert.equal(await Promise.race([exited, new Promise(resolve => setTimeout(() => resolve('timeout'), 10000))]), 0);
    assert.equal(locks().length, 0);
    assert.deepEqual(phases(), ['started', 'unknown']);
    screen.write('\x1bc');
    startPty(['--resume', oldId]);
    await until(ready, 'committed session reopened');
    assert.deepEqual(phases(), ['started', 'unknown']);
    send('/switch-command');
    await until(() => frame().includes('Allow once'), 'retry approval'); pty.stdin.write('\r');
    await until(() => frame().includes('Allow once') && frame().includes('switch-denied'), 'retry second approval'); pty.stdin.write('\x1b');
    await until(() => fs.readFileSync(path.join(workspace, 'switch-effects'), 'utf8') === 'xx', 'retry effect');
    await until(() => !fs.readdirSync(journalDir).some(name => name.endsWith('.lease')) && ready(), 'retry settled');
    assert.deepEqual(phases(), ['started', 'unknown', 'started', 'finished']);
    assert.equal(fs.existsSync(path.join(workspace, 'switch-denied')), false);
    send('/exit');
    assert.equal(await Promise.race([exited, new Promise(resolve => setTimeout(() => resolve('timeout'), 10000))]), 0);
    child = undefined;
    assert.equal(locks().length, 0);
    console.log(JSON.stringify({ switchRecovery, effects: 2, phases: phases(), childExited: true, leaseReleased: true, lockReleased: true }));
    break run;
  } else if (fenced) {
    const env = { ...process.env, LLM_API_KEY: "owned-inline-fixture", LLM_MODEL: "smoke/inline",
      LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" };
    child = spawn(process.execPath, [...launcher, "--workspace", workspace, "--user-dir", path.join(workspace, "user"), ...shell, "/release-command"],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"], env });
    let releaseErrors = ""; child.stderr.on("data", chunk => { releaseErrors += chunk; }); child.stdout.resume();
    const releaseExit = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    const ready = path.join(workspace, "release-ready");
    const releaseDeadline = Date.now() + 10000;
    while (!fs.existsSync(ready)) {
      if (child.exitCode !== null || Date.now() > releaseDeadline) throw new Error(`release fixture did not start: ${releaseErrors}`);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const descendant = Number(fs.readFileSync(path.join(workspace, "release-child"), "utf8"));
    child.kill("SIGTERM");
    const releaseTimer = setTimeout(() => child?.kill("SIGKILL"), 10000);
    const releaseCode = await releaseExit; clearTimeout(releaseTimer); child = undefined;
    assert.equal(releaseCode, 130, releaseErrors);
    assert.throws(() => process.kill(descendant, 0));
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
    const releaseId = /session: ([a-f0-9-]{36})/.exec(releaseErrors)?.[1];
    assert.ok(releaseId, releaseErrors);
    const releaseJournal = path.join(workspace, ".agent/skill-effects", `${releaseId}.jsonl`);
    assert.deepEqual(fs.readFileSync(releaseJournal, "utf8").trim().split("\n").map(line => JSON.parse(line).phase), ["started"]);
    assert.equal(fs.readdirSync(path.dirname(releaseJournal)).some(name => name.endsWith(".lease")), false);
    child = spawn(process.execPath, [...launcher, '--workspace', workspace, '--resume', releaseId, '--output-format', 'stream-json', '/release-command'],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env });
    child.stdout.destroy(); child.stderr.resume();
    const failedOutput = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    child = undefined;
    assert.notEqual(failedOutput, 0);
    assert.deepEqual(fs.readFileSync(releaseJournal, 'utf8').trim().split('\n').map(line => JSON.parse(line).phase), ['started']);
    const headlessWarning = await run('/release-command', ['--resume', releaseId]);
    assert.match(headlessWarning.errors, /effect is unknown/);
    assert.equal(fs.existsSync(path.join(workspace, 'release-retried')), false);
    assert.deepEqual(fs.readFileSync(releaseJournal, 'utf8').trim().split('\n').map(line => JSON.parse(line).phase), ['started', 'unknown']);
    const headlessRetry = await run('/release-command', ['--resume', releaseId]);
    assert.equal(headlessRetry.code, 0, headlessRetry.errors);
    assert.equal(fs.existsSync(path.join(workspace, 'release-retried')), true);
    fs.unlinkSync(path.join(workspace, 'release-retried'));
    const { SkillEffectJournal } = installedCli
      ? await import(new URL('../dist/skill-effects.js', pathToFileURL(fs.realpathSync(installedCli))))
      : await tsImport(path.join(root, 'src/skill-effects.ts'), import.meta.url);
    const fixtureJournal = new SkillEffectJournal(workspace, releaseId);
    const fixtureEffect = fixtureJournal.start('release-command', 0, 'fixture interrupted effect');
    fixtureJournal.abandon(fixtureEffect);
    const resumedRelease = await run("load release skill", ["--resume", releaseId]);
    assert.equal(resumedRelease.code, 0, resumedRelease.errors);
    assert.match(messageText(), /effect is unknown/);
    assert.equal(fs.existsSync(path.join(workspace, 'release-retried')), false);
    const retriedRelease = await run('', ['--resume', releaseId, '--interactive'], false, '/release-command\n/exit\n');
    assert.equal(retriedRelease.code, 0, retriedRelease.errors);
    assert.equal(fs.existsSync(path.join(workspace, 'release-retried')), true);
    assert.deepEqual(fs.readFileSync(releaseJournal, "utf8").trim().split("\n").map(line => JSON.parse(line).phase), ["started", "unknown", "started", "finished", "started", "unknown", "started", "finished"]);
    if (compiled) {
      const effects = [0, 1].map(i => fixtureJournal.start('release-command', i, `interrupted fixture ${i}`));
      for (const effect of effects) fixtureJournal.abandon(effect);
      fs.unlinkSync(path.join(workspace, 'release-retried'));
      const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
      const command = `stty rows 10 cols 40; exec ${quote(process.execPath)} ${quote(launcher[0])} --workspace ${quote(workspace)} --resume ${quote(releaseId)} --interactive`;
      const pty = spawn('/bin/sh', ['-c', `cat | script -q /dev/null /bin/sh -c ${quote(command)}`],
        { cwd: root, detached: true, env: { ...env, TERM: 'xterm-256color' } });
      const screen = new TerminalScreen(40, 10); let output = '', errors = '';
      pty.stdout.setEncoding('utf8'); pty.stdout.on('data', text => { output += text; screen.write(text); });
      pty.stderr.setEncoding('utf8'); pty.stderr.on('data', text => { errors += text; });
      const exited = new Promise((resolve, reject) => { pty.once('error', reject); pty.once('close', resolve); });
      const until = async predicate => {
        const deadline = Date.now() + 15000;
        while (!predicate()) {
          if (pty.exitCode !== null || Date.now() > deadline) throw new Error(`PTY timeout: ${errors}\n${screen.lines().join('\n')}`);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };
      try {
        await until(() => screen.lines().join('\n').includes('ctrl+o'));
        pty.stdin.write('/release-command\r');
        await until(() => fs.readFileSync(releaseJournal, 'utf8').includes('unknown_batch'));
        assert.match(output, /command #0 in "release-command"/);
        assert.match(output, /command #1 in "release-command"/);
        assert.equal(fs.existsSync(path.join(workspace, 'release-retried')), false);
        const frames = [];
        for (let page = 0; page < 8; page++) {
          frames.push(screen.lines().join('\n'));
          pty.stdin.write('\x1b[5~');
          await new Promise(resolve => setTimeout(resolve, 70));
        }
        frames.push(screen.lines().join('\n'));
        assert.ok(frames.some(frame => /command\s+#0/.test(frame)), frames.join('\n---\n'));
        assert.ok(frames.some(frame => /command\s+#1/.test(frame)), frames.join('\n---\n'));
        pty.stdin.write('\x1b[6~'.repeat(8));
        pty.stdin.write('/release-command\r');
        await until(() => fs.existsSync(path.join(workspace, 'release-retried')));
        pty.stdin.write('/exit\r'); pty.stdin.end();
        assert.equal(await exited, 0, errors);
      } finally {
        if (pty.exitCode === null) try { process.kill(-pty.pid, 'SIGKILL'); } catch {}
        screen.close();
      }
      // This preload is authored inside the owned fixture and only loaded by
      // the selected CLI subprocess. It intercepts the complete notice write.
      const preload = path.join(workspace, 'notice-fixture.cjs');
      fs.writeFileSync(preload, `const fs = require('node:fs');
const original = process.stdout.write.bind(process.stdout);
process.stdout.write = function(chunk, encoding, callback) {
  const done = typeof encoding === 'function' ? encoding : callback;
  if (typeof done !== 'function' || !String(chunk).includes('[skill effect recovery:'))
    return original(chunk, encoding, callback);
  const marker = process.env.NOTICE_FIXTURE_MARKER;
  if (process.env.NOTICE_FIXTURE_MODE === 'fail') {
    fs.writeFileSync(marker, String(process.pid));
    queueMicrotask(() => { done(new Error('fixture output failure')); setImmediate(() => fs.writeFileSync(marker + '.failed', 'handled')); });
    return true;
  }
  return original(chunk, error => {
    if (error) return done(error);
    fs.writeFileSync(marker, String(process.pid));
    const timer = setInterval(() => {
      if (fs.existsSync(marker + '.release')) { clearInterval(timer); done(); setImmediate(() => fs.writeFileSync(marker + '.returned', 'handled')); }
    }, 10);
  });
};\n`);
      const phases = () => fs.readFileSync(releaseJournal, 'utf8').trim().split('\n').map(line => JSON.parse(line));
      const runPtyNotice = async (mode, marker, action, sessionId = releaseId) => {
        const screen = new TerminalScreen(40, 10); let output = '', errors = '';
        const envExtra = mode ? { NODE_OPTIONS: `--require=${preload}`, NOTICE_FIXTURE_MODE: mode, NOTICE_FIXTURE_MARKER: marker } : {};
        const resumeCommand = command.replace(quote(releaseId), quote(sessionId));
        const proc = spawn('/bin/sh', ['-c', `cat | script -q /dev/null /bin/sh -c ${quote(`${resumeCommand} --recover-lock`)}`],
          { cwd: root, detached: true, env: { ...env, TERM: 'xterm-256color', ...envExtra } });
        proc.stdout.setEncoding('utf8'); proc.stdout.on('data', text => { output += text; screen.write(text); });
        proc.stderr.setEncoding('utf8'); proc.stderr.on('data', text => { errors += text; });
        const closed = new Promise((resolve, reject) => { proc.once('error', reject); proc.once('close', resolve); });
        const until = async predicate => {
          const deadline = Date.now() + 15000;
          while (!predicate()) {
            if (proc.exitCode !== null || Date.now() > deadline) throw new Error(`fixture PTY timeout: ${errors}\n${screen.lines().join('\n')}`);
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        };
        try {
          await until(() => screen.lines().join('\n').includes('ctrl+o'));
          proc.stdin.write('/release-command\r');
          await action({ until, proc, closed, output: () => output, screen });
        } finally {
          if (proc.exitCode === null) try { process.kill(-proc.pid, 'SIGKILL'); } catch {}
          proc.stdin.destroy(); await closed; screen.close();
        }
      };
      for (const mode of ['fail', 'hold']) {
        const effect = fixtureJournal.start('release-command', 0, `pty ${mode} interrupted`);
        fixtureJournal.abandon(effect);
        const marker = path.join(workspace, `notice-${mode}`);
        await runPtyNotice(mode, marker, async ({ until, proc, closed, output, screen }) => {
          await until(() => fs.existsSync(marker));
          if (mode === 'hold') await until(() => output().includes('effect is unknown'));
          else await until(() => fs.existsSync(marker + '.failed'));
          assert.equal(phases().some(record => record.id === effect.id && record.phase === 'unknown'), false);
          if (mode === 'hold') process.kill(Number(fs.readFileSync(marker, 'utf8')), 'SIGKILL');
          else { proc.stdin.end('/exit\r'); await closed; }
        });
        assert.equal(phases().some(record => record.id === effect.id && record.phase === 'unknown'), false);
        await runPtyNotice('', '', async ({ until, proc, closed, output }) => {
          await until(() => phases().some(record => record.id === effect.id && record.phase === 'unknown') && output().includes('effect is unknown'));
          assert.match(output(), /effect is unknown/);
          proc.stdin.end('/exit\r');
          await closed;
        });
      }
      const second = await run('/release-command', shell);
      assert.equal(second.code, 0, second.errors);
      const secondId = /session: ([a-f0-9-]{36})/.exec(second.errors)?.[1];
      assert.ok(secondId, second.errors);
      const secondJournal = path.join(workspace, '.agent/skill-effects', `${secondId}.jsonl`);
      fs.rmSync(secondJournal, { force: true });
      fs.rmSync(`${secondJournal}.lock`, { force: true });
      fs.symlinkSync(releaseJournal, secondJournal);
      fs.symlinkSync(`${releaseJournal}.lock`, `${secondJournal}.lock`);
      const concurrent = fixtureJournal.start('release-command', 0, 'concurrent pty interrupted');
      fixtureJournal.abandon(concurrent);
      const marks = ['a', 'b'].map(name => path.join(workspace, `notice-concurrent-${name}`));
      const deliver = (marker, sessionId) => runPtyNotice('hold', marker, async ({ until, proc, closed, output }) => {
        await until(() => marks.every(name => fs.existsSync(name)) && output().includes('effect is unknown'));
        assert.equal(phases().some(record => record.id === concurrent.id && record.phase === 'unknown'), false);
        fs.writeFileSync(`${marker}.ready`, 'ready');
        await until(() => marks.every(name => fs.existsSync(`${name}.ready`)));
        fs.writeFileSync(`${marker}.release`, 'release');
        await until(() => marks.every(name => fs.existsSync(`${name}.returned`)) && phases().some(record => record.id === concurrent.id && record.phase === 'unknown'));
        proc.stdin.end('/exit\r'); await closed;
      }, sessionId);
      await Promise.all([deliver(marks[0], releaseId), deliver(marks[1], secondId)]);
      assert.equal(phases().filter(record => record.id === concurrent.id && record.phase === 'unknown').length, 1);
    }
    const empty = await run('/empty-command', shell);
    assert.equal(empty.code, 0, empty.errors);
    assert.ok(messageText().includes('empty !`   `\n```!\n   \n```\nexample `sample !`touch code-marker``\nmidword=!`touch midword-marker`\nvalid EMPTY_OK'));
    assert.equal(fs.existsSync(path.join(workspace, 'code-marker')), false);
    assert.equal(fs.existsSync(path.join(workspace, 'midword-marker')), false);
  }
  let result = await run(quoted ? "/inline \"alpha beta\"" : "/inline alpha");
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes(`value= ${quoted ? "alpha beta" : "alpha"} missing=$ARGUMENTS[12]`));
  if (extended) assert.ok(messageText().includes("escaped=$ARGUMENTS"));
  if (named) assert.ok(messageText().includes("escaped=$target"));
  const id = /session: ([a-f0-9-]{36})/.exec(result.errors)[1];
  const original = fs.readFileSync(path.join(workspace, ".agent", `${id}.jsonl`), "utf8").trim().split("\n").map(line => JSON.parse(line));
  assert.equal(original[0].config.features.skillInlineCommands, true);
  settings(false);
  result = await run("/inline beta", ["--resume", id]);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("value= beta missing=$ARGUMENTS[12]"));
  result = await run("/inline alpha", shell);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("!`printf"));
  settings(true, { allowShell: false });
  const before = requests.length;
  result = await run("/inline alpha");
  assert.equal(result.code, 2, result.errors);
  assert.match(result.errors, /Skill shell access is disabled/);
  assert.equal(requests.length, before);
  settings(true, { permissions: { mode: "bypass", allow: [], deny: [], inputRules: [{ tool: "run_command", command: "printf denied", decision: "deny" }] } });
  result = await run("/preflight", shell);
  assert.equal(result.code, 2, result.errors);
  assert.match(result.errors, /Tool input denied/);
  assert.equal(requests.length, before);
  settings(true);
  if (hookHome) {
    result = await run("/hook-home", shell);
    assert.equal(result.code, 0, result.errors);
    assert.equal(fs.readFileSync(path.join(workspace, "hook-home-result"), "utf8"), process.env.HOME ?? "");
    assert.equal(fs.readFileSync(path.join(workspace, "hook-home-async"), "utf8"), process.env.HOME ?? "");
  }
  result = await run("load inline skill", shell);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("value= alpha missing=$ARGUMENTS[12]"));
  result = await run("/literal !`touch_argument-marker`", shell);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("args=!`touch_argument-marker` output= !`touch_argument-marker`"));
  assert.equal(fs.existsSync(path.join(workspace, "touch_argument-marker")), false);
  result = await run("", [...shell, "--interactive"]);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("value= interactive missing=$ARGUMENTS[12]"));
  if (aliases) assert.ok(result.output.includes("aliases: fixture:inline"));
  if (fallback) {
    result = await run("/fallback ; touch fallback-marker", shell);
    assert.equal(result.code, 0, result.errors);
    assert.ok(messageText().includes("output= fixture\n\n\nARGUMENTS: ; touch fallback-marker"));
    assert.equal(fs.existsSync(path.join(workspace, "fallback-marker")), false);
  }
  if (fenced) {
    settings(true);
    const beforeFenced = requests.length;
    result = await run("/fenced", shell);
    assert.equal(result.code, 0, result.errors);
    assert.ok(messageText().includes("before\nFENCED\nafter"));
    assert.equal(fs.existsSync(path.join(workspace, "overlap-marker")), true);
    assert.ok(!messageText().includes("!`touch overlap-marker`"));
    assert.equal(requests.length, beforeFenced + 1);
    for (const [name, pattern, deadline] of [['overflow', /output byte limit/, 15000], ['timeout', /timed out/, 40000]]) {
      const stopped = await run(`/${name}-command`, shell, false, undefined, deadline);
      assert.equal(stopped.code, 2, stopped.errors);
      assert.match(stopped.errors, pattern);
      assert.equal(fs.existsSync(path.join(workspace, `${name}-effect`)), true);
      const id = /session: ([a-f0-9-]{36})/.exec(stopped.errors)?.[1];
      assert.ok(id, stopped.errors);
      const journalDir = path.join(workspace, '.agent/skill-effects');
      const phases = fs.readFileSync(path.join(journalDir, `${id}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line).phase);
      assert.deepEqual(phases, ['started']);
      assert.equal(fs.readdirSync(journalDir).some(file => file.endsWith('.lease')), false);
      assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(file => file.endsWith('.lock')), false);
    }
    const failed = await run("/failed-command", shell);
    assert.equal(failed.code, 2, failed.errors);
    assert.match(failed.errors, /\[stderr\]\nFAILED_OUTPUT/);
    assert.equal(fs.existsSync(path.join(workspace, "after-failure-marker")), true);
    const failedId = /session: ([a-f0-9-]{36})/.exec(failed.errors)?.[1];
    assert.ok(failedId, failed.errors);
    const effects = fs.readFileSync(path.join(workspace, ".agent/skill-effects", `${failedId}.jsonl`), "utf8")
      .trim().split("\n").map(line => JSON.parse(line));
    const failedRows = effects.filter(row => row.index === 0);
    assert.deepEqual(failedRows.map(row => row.phase), ['started', 'failed']);
    assert.equal(failedRows[0].id, failedRows[1].id);
    const siblingRows = effects.filter(row => row.index === 1);
    assert.equal(siblingRows[0].phase, 'started');
    if (siblingRows.length === 2) {
      assert.equal(siblingRows[1].phase, 'finished');
      assert.equal(siblingRows[0].id, siblingRows[1].id);
    }
    assert.equal(requests.length, beforeFenced + 1);
    fs.rmSync(path.join(workspace, 'after-failure-marker'), { force: true });
    const agentFailure = await run('load failing skill', shell);
    assert.equal(agentFailure.code, 0, agentFailure.errors);
    assert.match(messageText(), /\[stderr\]\nFAILED_OUTPUT/);
    const agentId = /session: ([a-f0-9-]{36})/.exec(agentFailure.errors)?.[1];
    assert.ok(agentId, agentFailure.errors);
    const agentEffects = fs.readFileSync(path.join(workspace, '.agent/skill-effects', `${agentId}.jsonl`), 'utf8')
      .trim().split('\n').map(line => JSON.parse(line));
    const agentFailedRows = agentEffects.filter(row => row.index === 0);
    assert.deepEqual(agentFailedRows.map(row => row.phase), ['started', 'failed']);
    assert.equal(agentFailedRows[0].id, agentFailedRows[1].id);
    const agentSiblingRows = agentEffects.filter(row => row.index === 1);
    assert.equal(agentSiblingRows[0].phase, 'started');
    if (agentSiblingRows.length === 2) {
      assert.equal(agentSiblingRows[1].phase, 'finished');
      assert.equal(agentSiblingRows[0].id, agentSiblingRows[1].id);
    }
  }
  const policy = path.join(workspace, "policy.json");
  fs.writeFileSync(policy, JSON.stringify({ features: { skillInlineCommands: false } }));
  result = await run("/inline alpha", [...shell, "--managed-settings", policy]);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("!`printf"));
  assert.equal(requests.length, (fallback ? 9 : 8) + (fenced ? 8 : 0) + (fenced && compiled ? 2 : 0) + (hookHome ? 1 : 0));
  if (sourceArguments) {
    writeSkill('source-args', '$target|$0|$1|$2|RAW=$ARGUMENTS');
    const sourceFile = path.join(workspace, '.harness/skills/source-args/SKILL.md');
    fs.writeFileSync(sourceFile, fs.readFileSync(sourceFile, 'utf8').replace('description: Owned inline fixture', 'description: Owned inline fixture\narguments: target'));
    fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ features: { skillInlineCommands: true } }));
    const firstSource = await run('/source-args A=1 alpha "beta gamma"; touch source-argument-marker');
    assert.equal(firstSource.code, 0, firstSource.errors);
    assert.ok(messageText().includes('alpha|alpha|beta gamma|$2|RAW=A=1 alpha "beta gamma"; touch source-argument-marker'));
    assert.equal(fs.existsSync(path.join(workspace, 'source-argument-marker')), false);
    const sourceId = /session: ([a-f0-9-]{36})/.exec(firstSource.errors)[1];
    const sourceJournal = path.join(workspace, '.agent', `${sourceId}.jsonl`);
    const sourceMetadata = fs.readFileSync(sourceJournal, 'utf8').split('\n')[0];
    assert.equal(JSON.parse(sourceMetadata).config.features.skillSourceArguments, true);
    settings(false);
    const resumed = await run('/source-args alpha beta # ignored', ['--resume', sourceId]);
    assert.equal(resumed.code, 0, resumed.errors);
    assert.ok(messageText().includes('alpha|alpha|beta|$2|RAW=alpha beta # ignored'));
    assert.equal(fs.readFileSync(sourceJournal, 'utf8').split('\n')[0], sourceMetadata);
    fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ features: { skillSourceArguments: true, skillInlineCommands: true } }));
    const literalSource = await run('/source-args alpha $(touch source-substitution-marker) trailing');
    assert.equal(literalSource.code, 0, literalSource.errors);
    assert.ok(messageText().includes('alpha|alpha|$1|$2|RAW=alpha $(touch source-substitution-marker) trailing'));
    assert.equal(fs.existsSync(path.join(workspace, 'source-substitution-marker')), false);
    const modelSource = await run('load source skill');
    assert.equal(modelSource.code, 0, modelSource.errors);
    assert.ok(messageText().includes('alpha|alpha|beta|$2|RAW=A=1 alpha beta; touch source-model-marker'));
    assert.equal(fs.existsSync(path.join(workspace, 'source-model-marker')), false);
    const inlineSource = await run('/inline A=1 alpha beta; touch source-inline-marker', shell);
    assert.equal(inlineSource.code, 0, inlineSource.errors);
    assert.ok(messageText().includes('value=alpha missing=$ARGUMENTS[12]'));
    assert.equal(fs.existsSync(path.join(workspace, 'source-inline-marker')), false);
    assert.equal(requests.length, (fallback ? 9 : 8) + (fenced ? 1 : 0) + (fenced && compiled ? 2 : 0) + 6);
    const { createPluginTools } = await tsImport('../src/plugins.ts', import.meta.url);
    const pluginSource = path.join(workspace, 'preload-source');
    fs.mkdirSync(path.join(pluginSource, 'skills/source-preload'), { recursive: true });
    fs.mkdirSync(path.join(pluginSource, 'agents'));
    fs.writeFileSync(path.join(pluginSource, 'plugin.json'), JSON.stringify({ name: 'preload', version: '1', skills: 'skills', agents: 'agents' }));
    fs.writeFileSync(path.join(pluginSource, 'skills/source-preload/SKILL.md'), '---\nname: source-preload\narguments: target\n---\nNAMED=$target|PRELOAD=$1|$ARGUMENTS|\\$1');
    fs.writeFileSync(path.join(pluginSource, 'agents/source-helper.md'),
      '---\nname: source-helper\ndescription: Owned source preload\nskills: [source-preload]\ntools: [read_file]\n---\nPRELOAD_HELPER');
    const installer = createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install');
    await installer.execute({ directory: pluginSource }, { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 });
    for (const sourceMode of [true, false]) {
      for (const messaging of [true, false]) {
        fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ plugins: { enabled: true },
          features: { skillSourceArguments: sourceMode, agentMessaging: messaging, agentTypes: true } }));
        const offset = requests.length;
        const preloadSource = await run('launch source preload');
        assert.equal(preloadSource.code, 0, preloadSource.errors);
        const loaded = requests.slice(offset).find(request => request.system.includes('PRELOAD_HELPER'));
        assert.ok(loaded, JSON.stringify(requests.slice(offset).map(request => ({ system: request.system, messages: request.messages }))));
        assert.ok(JSON.stringify(loaded.messages).includes(sourceMode ? 'NAMED=|PRELOAD=$1||$1' : 'NAMED=$target|PRELOAD=||\\\\'));
        assert.equal(requests.length, offset + 3);
      }
    }
  }
  let customShellHome = false;
  if (hookHome && fs.existsSync('/bin/zsh')) {
    const { createPluginTools } = await tsImport('../src/plugins.ts', import.meta.url);
    const plugin = path.join(workspace, 'shell-home-plugin');
    fs.mkdirSync(path.join(plugin, 'skills/shell-home'), { recursive: true });
    fs.writeFileSync(path.join(plugin, 'plugin.json'), JSON.stringify({ name: 'shell-home', version: '1', skills: 'skills' }));
    fs.writeFileSync(path.join(plugin, 'skills/shell-home/SKILL.md'),
      '---\nname: shell-home\ndescription: Owned custom-shell fixture\nshell: /bin/zsh\n---\n!`X=old; X=new export Y; printf "$HOME" > shell-home-marker`');
    const installer = createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install');
    await installer.execute({ directory: plugin }, { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 });
    settings(true, { plugins: { enabled: true }, permissions: { mode: 'bypass', allow: [], deny: [`Bash(printf ${os.userInfo().homedir})`] } });
    const beforeCustom = requests.length;
    result = await run('/shell-home', shell, true);
    assert.equal(result.code, 2, result.errors);
    assert.match(result.errors, /denied/i);
    assert.equal(fs.existsSync(path.join(workspace, 'shell-home-marker')), false);
    assert.equal(requests.length, beforeCustom);
    customShellHome = true;
  }
  if (compiled) { settings(true); await checkHeadlessSkillResults(); }
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  console.log(JSON.stringify({ cli: "passed", inlineWithoutMetadata: true, modelSkillCall: true, pinnedResume: true,
    disabledLiteral: true, shellGate: true, deniedCommand: true, injectedDirectivesLiteral: true, managedOverride: true, interactive: true,
    ...(hookHome ? { skillHookHome: true } : {}), ...(customShellHome ? { customShellHome: true } : {}), locksReleased: true, ...(sourceArguments ? { sourceArguments: true, sourceDefault: true, sourcePinnedResume: true, sourceSubstitutionInert: true } : {}), ...(aliases ? { interactiveAlias: true, visibleAliases: true } : {}), ...(named ? { namedInlineArguments: true } : {}), ...(extended ? { extendedInlineArguments: true } : {}), ...(fallback ? { argumentFallbackOutsideShell: true } : {}), ...(fenced ? { fencedBlock: true } : {}), ...(quoted ? { quotedInlineArguments: true } : {}), ...(compiled ? { compiledCLI: true } : {}), modelRequests: requests.length, gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
