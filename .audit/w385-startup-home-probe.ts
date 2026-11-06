import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultConfig } from '../src/agent.js';
import { executeSkill } from '../src/skill-runtime.js';
import { createTools } from '../src/tools.js';

const keys = ['HOME', 'BASH_ENV', 'ZDOTDIR'] as const;
const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w385-startup-'));
try {
  const root = fs.realpathSync(tempRoot);
  const tools = createTools();
  const provider = { count: async () => 0, complete: async () => { throw new Error('unexpected provider call'); } };
  const modes = ['present', 'added', 'replace-content', 'replace-link'] as const;
  for (const shell of ['/bin/bash', '/bin/zsh']) {
    if (!fs.existsSync(shell)) { console.log(JSON.stringify({ shell, skipped: 'missing executable' })); continue; }
    for (const mode of modes) {
      const dir = fs.mkdtempSync(path.join(root, 'case-'));
      const approved = path.join(dir, 'approved');
      const changed = path.join(dir, 'changed');
      const marker = path.join(dir, 'startup-marker');
      const output = path.join(dir, 'output');
      const active = path.join(dir, 'active');
      const old = path.join(dir, 'old');
      const replacement = path.join(dir, 'replacement');
      for (const item of [approved, changed, old, replacement]) fs.mkdirSync(item);
      const isBash = shell.endsWith('bash');
      const scriptName = isBash ? 'env' : '.zshenv';
      const startup = `export HOME='${changed}'\nprintf '%s\\n' startup >> '${marker}'\n`;
      fs.writeFileSync(path.join(old, scriptName), mode === 'replace-content' ? '# initial empty startup\n' : startup);
      fs.writeFileSync(path.join(replacement, scriptName), startup);
      fs.symlinkSync(old, active);
      process.env.HOME = approved;
      delete process.env.BASH_ENV;
      delete process.env.ZDOTDIR;
      const install = () => { if (isBash) process.env.BASH_ENV = path.join(active, scriptName); else process.env.ZDOTDIR = active; };
      if (mode !== 'added') install();
      const config = defaultConfig(dir, tools);
      config.allowShell = true;
      config.permissions = { mode: 'default', allow: [], deny: [`Bash(printf ${changed})`], ask: ['Bash(*)'] };
      const spans: { command: string; initial: string; response: string; startupEffects: number }[] = [];
      const firstCommand = `X=old; X=new export Y; printf "$HOME" > '${output}'`;
      const body = `!\`${firstCommand}\` !\`true\``;
      const countEffects = () => fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim().split('\n').length : 0;
      let error: string | null = null;
      try {
        await executeSkill({ name: 'fixture', path: path.join(dir, 'SKILL.md'), description: 'fixture', body, shell, userInvocable: true, disableModelInvocation: false }, '', {
          config, provider, tools, signal: new AbortController().signal, source: 'user',
          requestPermission: async (_tool, input, decision) => {
            const command = (input as { command: string }).command;
            spans.push({ command, initial: decision.decision, response: 'allow', startupEffects: countEffects() });
            if (command === 'true') {
              if (mode === 'added') install();
              if (mode === 'replace-content') fs.writeFileSync(path.join(old, scriptName), startup);
              if (mode === 'replace-link') { fs.unlinkSync(active); fs.symlinkSync(replacement, active); }
            }
            return { decision: 'allow' };
          },
        });
      } catch (caught) { error = String(caught); }
      const actual = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : null;
      const effects = countEffects();
      console.log(JSON.stringify({ shell, mode, spans, actualHOME: actual === changed ? 'changed' : actual === approved ? 'approved' : actual, startupEffects: effects, outputExists: fs.existsSync(output), error }));
      assert.equal(error, null);
      assert.deepEqual(spans, [
        { command: firstCommand, initial: 'ask', response: 'allow', startupEffects: 0 },
        { command: 'true', initial: 'ask', response: 'allow', startupEffects: 0 },
      ]);
      assert.equal(actual, changed);
      assert.equal(effects, 2);
    }
  }
} finally {
  try {
    for (const key of keys) { const value = saved[key]; if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
