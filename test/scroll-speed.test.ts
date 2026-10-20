import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import type { TerminalEnvironment } from '../src/plugin-chain-terminal-environment.js';
import { SCROLL_SPEED_ENV, adjustScrollSpeed, applyStoredEnvironment, autoScrollSpeed,
  currentScrollSpeed, displayPath, platformName, saveScrollSpeedSetting, scrollSpeedAvailable,
  scrollSpeedDetail, scrollSpeedExplicit, scrollSpeedNotch, scrollSpeedReset, scrollSpeedRuler,
  scrollSpeedSaved, scrollSpeedSettingsFile, scrollSpeedStep, scrollSpeedValues, setLiveScrollSpeed,
  snapScrollSpeed, terminalDescription, terminalName } from '../src/scroll-speed.js';

const roots: string[] = [];
function temp(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccrev-scroll-speed-')));
  roots.push(dir); return dir;
}
after(() => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); });

/** The probe's own invariants: a terminal that neither floods nor reports as xterm.js keeps the
 *  fine grid, and its auto step is one line. `wtSession` is the switch that lifts both. */
function environment(overrides: Partial<TerminalEnvironment> = {}): TerminalEnvironment {
  return { useDecayCurve: false, useAdaptiveDrain: false, base: 1, xtermJs: false, wheelFlood: false,
    jediTerm: false, termProgram: 'iTerm.app', termProgramVersion: '3.5.0', xtversion: '(no reply)',
    wtSession: false, scrollSpeedEnv: 'unset', platform: 'darwin', ...overrides };
}

test('the auto step is three lines unless the terminal floods wheel events', () => {
  assert.equal(autoScrollSpeed({ xtermJs: false, wheelFlood: false, wtSession: false }), 1);
  assert.equal(autoScrollSpeed({ xtermJs: false, wheelFlood: false, wtSession: true }), 3);
  assert.equal(autoScrollSpeed({ xtermJs: true, wheelFlood: false, wtSession: false }), 3);
  assert.equal(autoScrollSpeed({ xtermJs: true, wheelFlood: true, wtSession: true }), 1);
});

test('the granularity is a quarter line without the decay curve and a whole line with it', () => {
  assert.equal(scrollSpeedStep(environment({ useDecayCurve: false })), 0.25);
  assert.equal(scrollSpeedStep(environment({ useDecayCurve: true })), 1);
});

test('a value snaps to the grid and clamps into the step and ten', () => {
  assert.equal(snapScrollSpeed(2.4, 1), 2);
  assert.equal(snapScrollSpeed(2.6, 1), 3);
  assert.equal(snapScrollSpeed(0.6, 0.25), 0.5);
  assert.equal(snapScrollSpeed(0.74, 0.25), 0.75);
  assert.equal(snapScrollSpeed(40, 0.25), 10);
  assert.equal(snapScrollSpeed(0, 0.25), 0.25);
  assert.equal(snapScrollSpeed(-3, 1), 1);
});

test('a press moves a quarter line inside the fine range and a whole line above it', () => {
  assert.equal(adjustScrollSpeed(0.25, 1, 0.25), 0.5);
  assert.equal(adjustScrollSpeed(0.75, 1, 0.25), 1);
  assert.equal(adjustScrollSpeed(1, 1, 0.25), 2);
  assert.equal(adjustScrollSpeed(1, -1, 0.25), 0.75);
  assert.equal(adjustScrollSpeed(10, 1, 0.25), undefined);
  assert.equal(adjustScrollSpeed(0.25, -1, 0.25), undefined);
});

test('the ruler is ten cells, halved below one line', () => {
  assert.equal(scrollSpeedRuler(0.25), '▪·········');
  assert.equal(scrollSpeedRuler(1), '■·········');
  assert.equal(scrollSpeedRuler(3), '■■■·······');
  assert.equal(scrollSpeedRuler(10), '■'.repeat(10));
  assert.equal(scrollSpeedRuler(0.5), '▪' + '·'.repeat(9));
});

test('a notch reads as lines, singular at one', () => {
  assert.equal(scrollSpeedNotch(1), '1 line per notch');
  assert.equal(scrollSpeedNotch(2), '2 lines per notch');
  assert.equal(scrollSpeedNotch(0.25), '0.25 lines per notch');
});

test('the offered values are the fine grid below one and whole lines above it', () => {
  assert.deepEqual(scrollSpeedValues(0.25), [0.25, 0.5, 0.75, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(scrollSpeedValues(1), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('the command is withheld only when the terminal scrolls the wheel itself', () => {
  assert.equal(scrollSpeedAvailable(environment()), true);
  assert.equal(scrollSpeedAvailable(environment({ jediTerm: true })), false);
});

test('the platform is spelled the way the row spells it', () => {
  assert.equal(platformName('darwin'), 'macOS');
  assert.equal(platformName('win32'), 'Windows');
  assert.equal(platformName('linux'), 'Linux');
  assert.equal(platformName('freebsd'), 'freebsd');
});

test('the terminal row names the program, the platform and the wheel transport', () => {
  assert.equal(terminalName(environment(), {}), 'iTerm2');
  assert.equal(terminalName(environment({ termProgram: 'unset', platform: 'win32' }), {}), 'Windows console');
  assert.equal(terminalName(environment({ termProgram: 'unset' }), {}), 'terminal');
  assert.equal(terminalName(environment({ termProgram: 'vscode', termProgramVersion: '1.99.0' }), {}), 'VS Code 1.99.0');
  assert.equal(terminalName(environment({ termProgram: 'vscode', termProgramVersion: 'unset' }), {}), 'VS Code');
  assert.equal(terminalName(environment({ termProgram: 'ghostty' }), {}), 'Ghostty');
  assert.equal(terminalName(environment(), { CURSOR_TRACE_ID: 'x' }), 'Cursor');
  assert.equal(terminalName(environment(), { VSCODE_GIT_ASKPASS_MAIN: '/cursor/askpass' }), 'Cursor (remote)');
  assert.equal(terminalName(environment(), { VSCODE_GIT_ASKPASS_MAIN: '/antigravity/askpass' }), 'Antigravity');
  // The askpass predicate also matches windsurf, and the row reports both as Devin Desktop.
  assert.equal(terminalName(environment(), { VSCODE_GIT_ASKPASS_MAIN: '/windsurf/askpass' }), 'Devin Desktop');
  assert.equal(terminalName(environment(), { VSCODE_GIT_ASKPASS_MAIN: '/devin.app/askpass' }), 'Devin Desktop');
  assert.equal(terminalDescription(environment(), {}), 'iTerm2 · macOS');
  assert.equal(terminalDescription(environment({ wheelFlood: true }), {}), 'iTerm2 · macOS · high-rate wheel events');
  assert.equal(terminalDescription(environment({ xtermJs: true }), {}), 'iTerm2 · macOS · xterm.js');
  assert.equal(terminalDescription(environment({ wtSession: true }), {}), 'iTerm2 · macOS · Windows Terminal');
});

test('the live variable is the explicit state and the write restores auto', () => {
  const variables: Record<string, string | undefined> = {};
  assert.equal(scrollSpeedExplicit(variables), false);
  setLiveScrollSpeed(2, variables);
  assert.equal(variables[SCROLL_SPEED_ENV], '2');
  assert.equal(scrollSpeedExplicit(variables), true);
  setLiveScrollSpeed(undefined, variables);
  assert.equal(SCROLL_SPEED_ENV in variables, false);
  assert.equal(scrollSpeedExplicit(variables), false);
  // A present but unparseable value is still explicit; the probe falls back to the base.
  assert.equal(scrollSpeedExplicit({ [SCROLL_SPEED_ENV]: 'not a number' }), true);
});

test('the detail names the current notch count and the auto value', () => {
  assert.equal(scrollSpeedDetail({ value: 1, explicit: false }, environment(), {}),
    '■·········\n  1 line per wheel notch (auto)\nTerminal  iTerm2 · macOS');
  assert.equal(scrollSpeedDetail({ value: 2, explicit: true }, environment(), {}),
    '■■········\n  2 lines per wheel notch · auto is 1\nTerminal  iTerm2 · macOS');
});

test('the dialog starts on the value that would apply, not the raw variable', () => {
  // An off-grid, out-of-range variable is shown snapped and clamped, which is `k(u.base, pe)`.
  assert.deepEqual(currentScrollSpeed(environment({ base: 2 }), { [SCROLL_SPEED_ENV]: '2.4' }),
    { value: 2, explicit: true });
  assert.deepEqual(currentScrollSpeed(environment({ base: 20 }), { [SCROLL_SPEED_ENV]: '99' }),
    { value: 10, explicit: true });
  assert.deepEqual(currentScrollSpeed(environment(), {}), { value: 1, explicit: false });
  assert.deepEqual(currentScrollSpeed(environment({ base: 3, useDecayCurve: true, wtSession: true }), {}),
    { value: 3, explicit: false });
});

test('a report names the settings file the way the recovered abbreviation does', () => {
  const home = os.homedir();
  assert.equal(displayPath(path.join(home, '.harness', 'settings.json')), '~/.harness/settings.json');
  assert.equal(displayPath(home), '~');
  assert.equal(displayPath('/elsewhere/settings.json'), '/elsewhere/settings.json');
});

test('the two reports use the recovered wording', () => {
  const home = path.join(os.homedir(), '.harness', 'settings.json');
  assert.equal(scrollSpeedSaved(2, home),
    'Scroll speed set to 2 lines per notch · saved to `~/.harness/settings.json`');
  assert.equal(scrollSpeedReset(environment(), home),
    'Scroll speed reset to auto (1 line per notch) · removed from `~/.harness/settings.json`');
  // The term that reports as Windows Terminal is the one that lifts the auto step to three.
  assert.equal(scrollSpeedReset(environment({ wtSession: true, useDecayCurve: true }), home),
    'Scroll speed reset to auto (3 lines per notch) · removed from `~/.harness/settings.json`');
  // A user directory outside the home directory has nothing to abbreviate.
  assert.equal(scrollSpeedSaved(2, '/elsewhere/settings.json'),
    'Scroll speed set to 2 lines per notch · saved to `/elsewhere/settings.json`');
});

test('the save writes the settings env block and keeps the rest of the file', () => {
  const dir = temp();
  const file = scrollSpeedSettingsFile(dir);
  fs.writeFileSync(file, JSON.stringify({ theme: 'dark', env: { OTHER: 'kept' } }), { mode: 0o600 });
  saveScrollSpeedSetting(2, dir);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')),
    { theme: 'dark', env: { OTHER: 'kept', [SCROLL_SPEED_ENV]: '2' } });
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  saveScrollSpeedSetting(undefined, dir);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { theme: 'dark', env: { OTHER: 'kept' } });
});

test('a fresh save creates the file and a reset keeps the emptied env block', () => {
  const dir = temp();
  const file = scrollSpeedSettingsFile(dir);
  saveScrollSpeedSetting(4, dir);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { env: { [SCROLL_SPEED_ENV]: '4' } });
  saveScrollSpeedSetting(undefined, dir);
  // The recovered customizer deletes only the leaf key, so the block it lived in stays.
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { env: {} });
  assert.throws(() => saveScrollSpeedSetting(0, dir), /positive number/);
  assert.throws(() => saveScrollSpeedSetting(Number.NaN, dir), /positive number/);
});

test('the stored env fills only the names the process does not carry', () => {
  const dir = temp();
  fs.writeFileSync(scrollSpeedSettingsFile(dir),
    JSON.stringify({ env: { [SCROLL_SPEED_ENV]: '5', OTHER: 'stored', BAD: 7 } }));
  const variables: Record<string, string | undefined> = { OTHER: 'real' };
  assert.deepEqual(applyStoredEnvironment(dir, variables).sort(), [SCROLL_SPEED_ENV].sort());
  assert.equal(variables[SCROLL_SPEED_ENV], '5');
  assert.equal(variables.OTHER, 'real');
  assert.equal('BAD' in variables, false);
});

test('a missing or malformed settings file contributes nothing', () => {
  const dir = temp();
  const variables: Record<string, string | undefined> = {};
  assert.deepEqual(applyStoredEnvironment(dir, variables), []);
  fs.writeFileSync(scrollSpeedSettingsFile(dir), '{"env": "not an object"}');
  assert.deepEqual(applyStoredEnvironment(dir, variables), []);
  fs.writeFileSync(scrollSpeedSettingsFile(dir), 'not json');
  assert.deepEqual(applyStoredEnvironment(dir, variables), []);
});
