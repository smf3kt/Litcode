// W45-24 against the built artifact: the `$` table's ui.status and ui.log floors from dist — the
// session gate's drop line, the status write and its cleared state, both ui.log routes, the length
// notice with its dedupe, and the two `check` refusals behind a handler that opens the floor.
// W45-26 extends it to dist's ui.toast floor and the admission policy the entry sits on.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  bindPluginDataDir, ensureStoreDir, storeDataDir, storeFileName, storeFilePath, touchStoreFile,
} from '../dist/plugin-chain-store-path.js';
import {
  acquirePluginStoreLock, checkPluginStoreLock, releasePluginStoreLock,
} from '../dist/plugin-chain-lockfile.js';
import {
  writeFileAtomically, writeFileWithAtomicOptions,
} from '../dist/plugin-chain-atomic.js';
import {
  bindStoreCarryPlatformIdTable, builtinTwinIds, carryStoreFile, readStoreCandidate, readStoreFile,
} from '../dist/plugin-chain-store-carry.js';
import {
  checkStoreSet, raiseStoreCall, setStoreBackend, storeBackend, storeCallTable, storeEntry,
} from '../dist/plugin-chain-store.js';
import {
  bindSettingsStore, checkSettingsRead, copySettingsValue, raiseSettingsRead, readSettings, SETTINGS_SOURCES,
} from '../dist/plugin-chain-settings.js';
import {
  bindHostPlatform, bindNetworkLocationRefusal, O,
} from '../dist/plugin-chain-fs-boundaries.js';
import {
  canonicalRootOwnedByUser, claudeDirectory, localSettingsPath, localSettingsRoot, managedSettingsDir,
  managedSettingsDropInDir, managedSettingsPath, NoProjectDirectoryError, normalizedRealHomeDir,
  resetManagedSettingsCache, SETTINGS_FILE_NAMES, settingsFilePath, settingsFileName,
  settingsSourceDirectory, settingsSourceRelativePath, sourceCwd, sourceFs,
} from '../dist/plugin-chain-settings-source.js';
import {
  mergeSettings, normalizeModelPicker, settingsMergeCustomizer, shallowSettingsOverride,
} from '../dist/plugin-chain-settings-merge.js';
import { bindLocalStore, Ht } from '../dist/plugin-chain-local-store.js';
import {
  changedSourceKeys, isPolicyPinned, ji, localStore, normalizeEmptySettings, setPolicyPin,
  wrapSourceSnapshot,
} from '../dist/plugin-chain-local-store.js';
import { Dzo, Fzo, Ia as notifyCommitted, Nzo, wn as notifyIsCommitted } from '../dist/plugin-chain-ui-source.js';
import { fsCallTable, raiseFsCall } from '../dist/plugin-chain-fs.js';
import { chainRecords, clearChainRecords, installChainModule, it, setChainModuleSeat, zd } from '../dist/plugin-chain-host.js';
import {
  createPluginRegistryState, createPluginStateStore, createToastClock,
} from '../dist/plugin-chain-registry-state.js';
import '../dist/plugin-chain-registry.js';
import {
  bindPluginSession, currentPluginSession, onPluginUiLog, raiseUiCall, uiCallTable,
  splitToastQueue, toastAdmission, toastKey, pluginOfToastKey, reportToastGiveWay,
  DEFAULT_TOAST_TIMEOUT_MS, TOAST_PRIORITY, TOAST_TIMEOUT_MAX_MS, TOASTS_PER_PLUGIN,
  BLITS_PER_SECOND, decodeBlitCells, mountedImageSites, mountedRasterSites, validateImageSource,
} from '../dist/plugin-chain-ui.js';
import { BAR_STATE_PLUGIN, barStateKey, bindPluginState, emptyLedger, nextTickDelayMs, parseStoredLedger, readStoredLedger, reportLostTime, tickLedger } from '../dist/plugin-chain-notify.js';
import {
  mountImage, mountRaster, registerSiteMount, withSwap,
} from '../dist/plugin-chain-raster-mount.js';
import {
  admitRasterFrame, backgroundHalf, CELL_WORDS, DEFAULT_CHANNEL, DEFAULT_RASTER_COLUMNS,
  DEFAULT_RASTER_ROWS, encodeCell, foregroundHalf, freshRasterAdmission, RASTER_ADMISSION_CAPACITY,
  rasterAdmission, validateDefaultRasterSize, validateRasterSize,
} from '../dist/plugin-chain-raster-cells.js';
import {
  BELL, createRasterSurface, CSI, csi, EVALUATION_BUDGET, freshSurfaceState, nearestSlot,
  packColourPair, REUSE_COST, renderRows, resetSgr, SLOT_CAPACITY, toPackedColour,
} from '../dist/plugin-chain-raster-surface.js';
import {
  allowedKeys, checkString, firstFieldProblem, imageLeafProblem, imageSizeProblem,
  IMAGE_COLUMNS, isChainStamped, KEY_LABEL_LIMIT, labelOf, pickRasterProps, rasterLeafProblem,
  RASTER_SITE_FIELDS,
} from '../dist/plugin-chain-raster-sites.js';
import {
  checkAutoFocus, checkHoverKey, checkPress, CODE_MAX_START_LINE, codeLeafProblem, INPUT_FIELDS,
  inputLeafProblem, isNonBlankString, isPixelSide, optionProblem, SELECT_MAX_OPTIONS,
  selectLeafProblem, SVG_PIXEL_LIMIT, SVG_SOURCE_LIMIT, svgLeafProblem,
} from '../dist/plugin-chain-site-leaves.js';
import {
  BORDER_PROPS, budgetProblem, COLOR_PROPS, freshWalkBudget, listLength, MAX_LIST_LENGTH,
  NUMBER_TOLERANCE, PROP_RULES, propProblem, scalarCost, shortDescription, SIDE_PROPS, SIZE_PROPS,
  SPACING_PROPS, TEXT_STYLE_PROPS, VALUE_CHAR_LIMIT, VALUE_DEPTH_LIMIT, VALUE_NODE_LIMIT, valueEntries,
  valueProblem, walkProblem,
} from '../dist/plugin-chain-style-props.js';
import {
  clientLeafProblem, encodeHref, LINK_HREF_LIMIT, linkLeafProblem, markdownLeafProblem,
  PRESSABLE_LINK_LIMIT, pressableLinksProblem,
} from '../dist/plugin-chain-leaves.js';
import {
  DEFAULT_BINDINGS, engineOnlyAction, KEY_PLATFORM, knownAction, KNOWN_ACTIONS, normalizeKey,
  RESERVED_KEYS,
} from '../dist/plugin-chain-keys.js';
import { buttonLeafProblem } from '../dist/plugin-chain-button.js';
import {
  blockPassesRuntimeSchema, documentPassesRuntimeSchema, isActionOrCommand, isKnownContext, isLegacyAction,
  keyBindingBlockSchema, keyBindingsFileSchema, KEY_CONTEXTS, LAZY, LEGACY_ACTION_READ_AS, parseKeyBinding,
  reservedKeysForPlatform, runtimeKeyBindingBlockSchema, SCHEMA_REGISTRY, splitChord,
} from '../dist/plugin-chain-keys-editor.js';
import {
  bindingRows, MAP_VALUES_ALIAS, mapValuesForRows, rewriteLegacyBindings, SOURCE_BODIES,
} from '../dist/plugin-chain-keys-rows.js';
import {
  diffHunks, diffReadFor, duplicateLeafKey, emittedLines, expandLeadingTabs, flattenLeafText,
  countOccurrences, hunkGutterWidth, LEAF_LINE_CAP, LEAF_TABLE, LEAF_WRAP_WIDTH, leafHeight, leafText,
  parseUnifiedDiff, sanitizeLeafText, textWidthWithin,
} from '../dist/plugin-chain-leaf-walkers.js';
import {
  DROPPED_CALLS, ENV_CALLS, STATE_CALLS, admittedCall, callSpelling, copyCallArgs, dispatchCall,
  firstSegment, isDroppableCall, plainOrJsonName, removedByPlugin, scanAllowsCall, scanAllowsEnv,
  stateReference, withheldSentence,
} from '../dist/plugin-chain-call-dispatch.js';
import {
  FOCUS_ENTRY, SCROLL_ENTRY, focusCall, focusSiteFor, focusSites, otherHolderHasKeyboard, scrollCall,
  scrollCallIsForeign, scrollSiteFor, scrollSites, siteKey,
} from '../dist/plugin-chain-scroll-focus.js';
import { FOCUS_SITE, SCROLL_SITE } from '../dist/plugin-chain-scroll-focus-sites.js';
import {
  STATE_VALUE_MAX_CHARS, appendStoredToast, isManagedPlugin, notifyStateReaders, pluginSeat, setStoredState, writeStoredLedger,
} from '../dist/plugin-chain-notify-write.js';
import {
  FOLD_INTERVAL_MS, READER_THROTTLE_MS, RENDER_VERSION_SUFFIX, abovePromptFlag, abovePromptReaderIsLive,
  bindPanes, bindRenderVersions, bumpRenderVersions, isReaderThrottled, readerPace, renderVersionKey,
  runArmedFold, scheduleReaderFolds, throttleReaders,
} from '../dist/plugin-chain-notify-fold.js';
import {
  TOAST_FALLBACK_TIMEOUT_MS, isBarHidden, runClockTick,
} from '../dist/plugin-chain-notify-clock.js';
import {
  barClockDriverChanged, barNotificationKeys, createBarClockDriver, holdPaneToasts, mountBarClockDriver,
  readPaneHold, storedToastKeys,
} from '../dist/plugin-chain-bar-mount.js';
import {
  NOTIFICATION_DEFAULT_TIMEOUT_MS, createNotificationQueue, notificationQueueSuppressed,
} from '../dist/plugin-chain-notify-queue.js';
import {
  pluginLoadCacheOnly, registeredAgentExists, resetAgents, resetCommands, resetOutputStyles,
  resetSkills, resetWorkflows,
} from '../dist/plugin-chain-registry-reset.js';
import {
  createSourcesRegistry, memoizeOrBuild, nullableKey, xr,
} from '../dist/plugin-chain-sources-registry.js';
import {
  clearHookRegistration, invalidateAgentSources, invalidateOutputStyleSources, invalidateSkillSources,
} from '../dist/plugin-chain-invalidate.js';
import {
  attachPluginDrawingClient, bindPluginSessionRecord, detachPluginDrawingClient, drawingSurfaces,
  isPluginDrawingSilent, markPluginDrawingHeard, markPluginDrawingMissed, onPluginDrawingDetach,
  pluginDrawingSurfaceNames, raiseSessionCall, sessionRecord,
} from '../dist/plugin-chain-session.js';
import { bindPluginProcessIdentity } from '../dist/plugin-chain-host.js';
import {
  clockCallTable, envCallTable, raiseClockCall, raiseEnvCall, readProcessEnv, sleep,
} from '../dist/plugin-chain-clock-env.js';
import {
  EMPTY_TOAST_STACK, TOAST_HOLD_REBASE_MS, TOAST_LEAVING_MS, TOAST_STACK_KEY,
  armToastTimer, bindToastClock, drawnToastIds, foldToastStack, hostToast, listEquals, pluginLabel,
  readToastStack, reportUndrawnToast, toastStackStateKey, trimToastStack, writeToastStack,
} from '../dist/plugin-chain-notify-stack.js';
import {
  dismissToast, expireToasts, holdToast, pauseToasts,
} from '../dist/plugin-chain-notify-verbs.js';
import { Epe, gCo, ht, mCo, mt, yt } from '../dist/plugin-chain-normalize-source.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = (plugin = 'fixture-ui') => ({ plugin, origin: ORIGIN });
const logs = () => chainRecords().filter((r) => r.kind === 'log').map((r) => r.message);
const passthrough = (name, event) => ({
  name,
  tier: 'user',
  hooks: (e) => e === event,
  record: () => ({ name, tier: 'user', run: async (args, next) => ({ value: await next(args) }) }),
});

clearChainRecords();
const writes = [];
const session = { status: (plugin, text) => { writes.push([plugin, text]); } };

await raiseUiCall({ event: 'ui.status', args: { text: 'hello' }, caller: caller() });
assert.deepEqual(writes, []);
assert.deepEqual(logs(), ['$.ui.status (fixture-ui): no session bound; dropped: hello']);

const unbind = bindPluginSession(session);
clearChainRecords();
await raiseUiCall({ event: 'ui.status', args: { text: 'hello' }, caller: caller() });
assert.deepEqual(writes, [['fixture-ui', 'hello']]);
await raiseUiCall({ event: 'ui.status', args: {}, caller: caller() });
assert.deepEqual(writes.at(-1), ['fixture-ui', undefined]);
assert.equal(currentPluginSession(), session);
unbind();

const seen = [];
const off = onPluginUiLog((record) => { seen.push(record); });
clearChainRecords();
await raiseUiCall({ event: 'ui.log', args: { text: 'hi' }, caller: caller() });
assert.deepEqual(logs(), ['[fixture-ui] $.ui.log: hi']);
assert.deepEqual(seen, [{ plugin: 'fixture-ui', text: 'hi' }]);
clearChainRecords();
await raiseUiCall({ event: 'ui.log', args: { text: 'dbg', to: 'debug' }, caller: caller() });
assert.deepEqual(logs(), ['[fixture-ui] $.ui.log (to debug): dbg']);
assert.equal(seen.length, 1);
off();

const gate = installChainModule(passthrough('fixture-notice', 'ui.log'));
try {
  clearChainRecords();
  await raiseUiCall({ event: 'ui.log', args: { text: 'x'.repeat(2001) }, caller: caller() });
  const notice = '$.ui.log: a text (2001 characters) is drawn up to its first 2000 on the terminal, its first 10000 on a remote surface';
  assert.deepEqual(logs().filter((l) => l.includes(notice)), ['fixture-ui: ' + notice, '[fixture-ui] $.ui.log: ' + notice]);
  clearChainRecords();
  await raiseUiCall({ event: 'ui.log', args: { text: 'y'.repeat(2001) }, caller: caller() });
  assert.deepEqual(logs().filter((l) => l.includes('[fixture-ui] $.ui.log: $.ui.log')), []);
  clearChainRecords();
  await raiseUiCall({ event: 'ui.log', args: { text: 'x'.repeat(2001), to: 'debug' }, caller: caller() });
  assert.deepEqual(logs().filter((l) => l.includes('drawn up to')), []);

  await assert.rejects(
    () => raiseUiCall({ event: 'ui.log', args: { text: 1 }, caller: caller() }),
    /HooksError: ui\.log: takes a string text \(host check\)/,
  );
  await assert.rejects(
    () => raiseUiCall({ event: 'ui.log', args: { text: 'ok', to: 'bogus' }, caller: caller() }),
    /HooksError: ui\.log: to is "transcript" or "debug" \(got "bogus"\) \(host check\)/,
  );
} finally {
  gate();
}
const gateStatus = installChainModule(passthrough('fixture-notice-status', 'ui.status'));
try {
  await assert.rejects(
    () => raiseUiCall({ event: 'ui.status', args: { text: 1 }, caller: caller() }),
    /HooksError: ui\.status: takes a string text \(host check\)/,
  );
} finally {
  gateStatus();
}

console.log('W45UiFloorCompiled.v1');

// W45-26: the ui.toast floor and the admission policy, from the same build.
const toastWrites = [];
const toastSession = { status: () => {}, toast: (plugin, text, timeoutMs) => { toastWrites.push([plugin, text, timeoutMs]); } };
clearChainRecords();
await raiseUiCall({ event: 'ui.toast', args: { text: 'hello' }, caller: caller('fixture-toast') });
assert.deepEqual(toastWrites, []);
assert.deepEqual(logs(), ['$.ui.toast (fixture-toast): no session bound; dropped: hello']);

const unbindToast = bindPluginSession(toastSession);
clearChainRecords();
await raiseUiCall({ event: 'ui.toast', args: { text: 'hello' }, caller: caller('fixture-toast') });
assert.deepEqual(toastWrites, [['fixture-toast', 'hello', undefined]]);
await raiseUiCall({ event: 'ui.toast', args: { text: 'timed', timeoutMs: TOAST_TIMEOUT_MAX_MS }, caller: caller('fixture-toast') });
assert.deepEqual(toastWrites.at(-1), ['fixture-toast', 'timed', TOAST_TIMEOUT_MAX_MS]);
await raiseUiCall({ event: 'ui.toast', args: { text: 'z'.repeat(10001) }, caller: caller('fixture-toast') });
assert.equal(toastWrites.at(-1)[1].length, 10001);
assert.equal(toastWrites.at(-1)[1].endsWith('…'), true);

const gateToast = installChainModule(passthrough('fixture-open-toast', 'ui.toast'));
try {
  await assert.rejects(
    () => raiseUiCall({ event: 'ui.toast', args: { text: 1 }, caller: caller('fixture-toast') }),
    /HooksError: ui\.toast: takes a string text \(host check\)/,
  );
  for (const timeoutMs of [0, TOAST_TIMEOUT_MAX_MS + 1, 1.5]) {
    await assert.rejects(
      () => raiseUiCall({ event: 'ui.toast', args: { text: 'ok', timeoutMs }, caller: caller('fixture-toast') }),
      /HooksError: ui\.toast: timeoutMs is a whole number of ms, 1 to 60000 \(host check\)/,
    );
  }
} finally {
  gateToast();
}
unbindToast();

assert.equal(TOASTS_PER_PLUGIN, 50);
assert.equal(DEFAULT_TOAST_TIMEOUT_MS, 4000);
assert.equal(TOAST_PRIORITY, 'immediate');
assert.equal(toastKey('fixture-p', '3'), 'plugin-toast-3:fixture-p');
assert.equal(pluginOfToastKey('plugin-toast-3:fixture-p'), 'fixture-p');
const mine = (id) => ({ key: toastKey('fixture-p', id), timeoutMs: DEFAULT_TOAST_TIMEOUT_MS });
assert.deepEqual(toastAdmission({ isHeld: false, current: mine('1'), queue: [] }, 'fixture-p'),
  { isWaiting: false, givesWay: 'plugin-toast-1:fixture-p', isCutShort: true });
assert.deepEqual(toastAdmission({ isHeld: false, current: { key: 'app-note' }, queue: [] }, 'fixture-p'),
  { isWaiting: false, givesWay: undefined, isCutShort: false });
const capped = { isHeld: true, current: null, queue: Array.from({ length: 50 }, (_, i) => mine(String(i))) };
assert.deepEqual(toastAdmission(capped, 'fixture-p'),
  { isWaiting: false, givesWay: 'plugin-toast-0:fixture-p', isCutShort: false });
assert.deepEqual(splitToastQueue(capped, true, DEFAULT_TOAST_TIMEOUT_MS).waiting.length, 50);

clearChainRecords();
reportToastGiveWay({ key: toastKey('fixture-cut', '1'), plugin: 'fixture-cut', isCutShort: true });
assert.deepEqual(logs(), ['$.ui.toast (fixture-cut): plugin-toast-1:fixture-cut gave way, cut short']);
// Lines written before a sink existed wait for one; drain them so this collector sees only the
// notice below.
onPluginUiLog(() => {})();
const held = [];
const offToast = onPluginUiLog((record) => { held.push(record); });
const gateNotice = installChainModule(passthrough('fixture-notice-toast', 'ui.toast'));
try {
  clearChainRecords();
  reportToastGiveWay({ key: toastKey('fixture-unseen', '1'), plugin: 'fixture-unseen', isCutShort: false });
  assert.deepEqual(held, [{ plugin: 'fixture-unseen', text: "$.ui.toast: a toast that waits to be shown gives way to the plugin's newer ones, unseen" }]);
} finally {
  gateNotice();
  offToast();
}
console.log('W45ToastFloorCompiled.v1');

// W45-27: the notification bar's ledger tick, from the same build.
const barKey = 'plugin-toast-1:fixture-bar';
const barToast = { key: barKey, plugin: 'fixture-bar', text: barKey, isManaged: false, leftMs: 4000, wasShown: false, lentMs: 0, untoldMs: 0 };
const barSplit = splitToastQueue({ current: { key: barKey, timeoutMs: DEFAULT_TOAST_TIMEOUT_MS }, queue: [] }, false, DEFAULT_TOAST_TIMEOUT_MS);
const barTick = tickLedger(emptyLedger(), { toasts: [barToast], at: 0, slot: void 0 }, barSplit, 0);
assert.deepEqual(barTick.ledger.toasts, [{ ...barToast, wasShown: true }]);
assert.deepEqual(barTick.ledger.slot, { key: barKey, endsAt: DEFAULT_TOAST_TIMEOUT_MS, shown: barKey });
assert.equal(nextTickDelayMs(barTick.ledger), undefined);
clearChainRecords();
reportLostTime({ key: barKey, plugin: 'fixture-bar', leftMs: 7 });
assert.deepEqual(logs(), ['$.ui.toast (fixture-bar): ' + barKey + ' lost 7 ms of its time, the notification bar having no toast time left for it']);
console.log('W45NotifyLedgerCompiled.v1');

// W45-28: the bar's stored state, from the same build — the key, the schema's parse and the read's
// fallback to the empty ledger.
assert.equal(BAR_STATE_PLUGIN, 'engine');
assert.equal(barStateKey(), 'engine\u0000bar-toasts');
const storedLedger = { toasts: [barToast], at: 0, slot: { key: barKey, endsAt: DEFAULT_TOAST_TIMEOUT_MS, shown: barKey } };
assert.deepEqual(parseStoredLedger(storedLedger), storedLedger);
assert.equal(parseStoredLedger({ toasts: [{ key: barKey }], at: 0 }), undefined);
const storeOff = bindPluginState({
  values: {
    getState: () => ({ get: (key) => (key === barStateKey() ? { value: { toasts: 'nope' }, version: 1 } : undefined) }),
    setState: () => {},
  },
});
assert.equal(readStoredLedger(), emptyLedger());
storeOff();
console.log('W45NotifyStoreCompiled.v1');

// W45-29: the bar's write half, from the same build — the append path's seat flag and the stored
// version, the skip rule, the frozen value, the two refusals and the reader gate.
const writeStore = (() => {
  let state = new Map();
  let writes = 0;
  const value = {
    values: {
      getState: () => ({ get: (key) => state.get(key) }),
      setState: (update) => { writes += 1; state = update(new Map(state)); },
    },
    versionFloor: 0,
    readersOf: new Map(),
  };
  return { value, writes: () => writes, state: () => state };
})();
const writeOff = bindPluginState(writeStore.value);
installChainModule(passthrough('fixture-write-plain', 'ui.log'));
setChainModuleSeat('fixture-write-managed', 'prepend');
assert.equal(pluginSeat('fixture-write-plain'), 'user');
assert.equal(pluginSeat('fixture-write-managed'), 'prepend');
assert.equal(isManagedPlugin('fixture-write-plain'), false);
assert.equal(isManagedPlugin('fixture-write-managed'), true);
clearChainRecords();
appendStoredToast({ key: toastKey('fixture-write-plain', '1'), plugin: 'fixture-write-plain', text: 'hello', ms: DEFAULT_TOAST_TIMEOUT_MS });
assert.deepEqual(readStoredLedger(), {
  toasts: [{
    key: toastKey('fixture-write-plain', '1'), plugin: 'fixture-write-plain', text: 'hello',
    isManaged: false, leftMs: DEFAULT_TOAST_TIMEOUT_MS, wasShown: false, lentMs: 0, untoldMs: 0,
  }],
  at: 0,
});
assert.equal(writeStore.state().get(BAR_STATE_PLUGIN + '\u0000bar-toasts').version, 1);
assert.equal(Object.isFrozen(writeStore.state().get(BAR_STATE_PLUGIN + '\u0000bar-toasts').value), true);
appendStoredToast({ key: toastKey('fixture-write-managed', '1'), plugin: 'fixture-write-managed', text: 'm', ms: DEFAULT_TOAST_TIMEOUT_MS });
assert.deepEqual(readStoredLedger().toasts.map((t) => t.isManaged), [false, true]);
assert.equal(writeStore.state().get(BAR_STATE_PLUGIN + '\u0000bar-toasts').version, 2);

const writesBefore = writeStore.writes();
writeStoredLedger(emptyLedger());
assert.equal(writeStore.writes() - writesBefore, 1, 'an empty ledger over a stored one is written');
assert.equal(STATE_VALUE_MAX_CHARS, 4194304);
assert.equal(setStoredState('probe', { a: 1 }), 1);
writeStore.value.versionFloor = 7;
assert.equal(setStoredState('probe', 2), 8, 'the floor wins over the stored version');
assert.equal(setStoredState('probe', 3), 9);
assert.throws(() => setStoredState('big', 'x'.repeat(STATE_VALUE_MAX_CHARS + 1)),
  /a value of state is JSON data of at most 4194304 characters/);
writeOff();

const freshStore = (() => {
  let state = new Map();
  let writes = 0;
  const value = {
    values: {
      getState: () => ({ get: (key) => state.get(key) }),
      setState: (update) => { writes += 1; state = update(new Map(state)); },
    },
    versionFloor: 0,
    readersOf: new Map(),
    readers: new Map(),
    folds: {
      steady: { stale: new Set(), pending: undefined, lastAt: 999000 },
      live: { stale: new Set(), pending: undefined, lastAt: 999000 },
    },
    staleListeners: new Set(),
    bumps: 0,
  };
  return { value, writes: () => writes };
})();
const freshOff = bindPluginState(freshStore.value);
writeStoredLedger(emptyLedger());
assert.equal(freshStore.writes(), 0, 'nothing to write and nothing stored: no write');
clearChainRecords();
const circularWrite = {};
circularWrite.self = circularWrite;
writeStoredLedger({ toasts: [{ key: 'k', plugin: 'p', text: circularWrite, isManaged: false, leftMs: 1, wasShown: false, lentMs: 0, untoldMs: 0 }], at: 0 });
assert.equal(freshStore.writes(), 0, 'the store is untouched by a failed write');
assert.match(logs().find((l) => l.startsWith("$.ui.toast: the bar's toasts were not kept:")), /Converting circular structure to JSON/);
const writeTailVersions = new Map();
const writeTailOffVersions = bindRenderVersions({
  getState: () => writeTailVersions,
  setState: (update) => { for (const [key, version] of update(new Map(writeTailVersions))) writeTailVersions.set(key, version); },
});
notifyStateReaders('unwatched');
assert.equal(freshStore.value.folds.steady.lastAt, 999000, 'no reader for the key: no fold');
freshStore.value.readersOf.set('watched', new Set(['reader-1']));
freshStore.value.readers.set('reader-1', { plugins: [], instance: { surface: 'remote', component: 'Status' } });
notifyStateReaders('watched');
assert.ok(freshStore.value.folds.steady.lastAt > 999000, 'with a reader the fold ran (W45-30)');
assert.equal(freshStore.value.bumps, 1);
writeTailOffVersions();
freshOff();
console.log('W45NotifyWriteCompiled.v1');

// W45-30: the fold scheduler, from the same build — the paces, the pace classifier, the run-now and
// armed paths, the throttle window and the render-version bump.
const foldVersions = new Map();
const foldPanes = { shownId: 'r1' };
const foldOffVersions = bindRenderVersions({
  getState: () => foldVersions,
  setState: (update) => { for (const [key, version] of update(new Map(foldVersions))) foldVersions.set(key, version); },
});
const foldOffPanes = bindPanes({ getState: () => foldPanes, setState: () => {} });
assert.deepEqual(FOLD_INTERVAL_MS, { steady: 100, live: 34 });
assert.equal(READER_THROTTLE_MS, 1000);
assert.equal(RENDER_VERSION_SUFFIX, '\u0000state');
assert.equal(renderVersionKey('k'), 'k\u0000state');
assert.equal(readerPace({ surface: 'terminal', component: 'Pane', requestId: 'r1' }), 'live');
assert.equal(readerPace({ surface: 'terminal', component: 'Pane', requestId: 'r2' }), 'steady');
assert.equal(readerPace({ surface: 'remote', component: 'PromptHint', requestId: 'r1' }), 'steady');
abovePromptFlag.set(true);
assert.equal(abovePromptReaderIsLive(), false);
abovePromptFlag.set(void 0);
assert.equal(abovePromptReaderIsLive(), true);

const foldStore = (() => {
  const seen = [];
  const value = {
    values: { getState: () => ({ get: () => undefined }), setState: () => {} },
    versionFloor: 0,
    readersOf: new Map(),
    readers: new Map([['reader-1', { plugins: ['fixture-p'], instance: { surface: 'terminal', component: 'PromptHint', requestId: 'r1' } }]]),
    folds: {
      steady: { stale: new Set(), pending: undefined, lastAt: 999000 },
      live: { stale: new Set(), pending: undefined, lastAt: 999000 },
    },
    staleListeners: new Set([(instances) => { seen.push(instances); }]),
    bumps: 0,
  };
  return { value, seen };
})();
const foldOff = bindPluginState(foldStore.value);
scheduleReaderFolds(['reader-1'], () => 1000000);
assert.equal(foldStore.value.folds.live.lastAt, 1000000, 'the live fold ran at once');
assert.deepEqual([...foldVersions], [['reader-1\u0000state', 1]]);
assert.deepEqual(foldStore.seen, [[{ surface: 'terminal', component: 'PromptHint', requestId: 'r1' }]]);

foldVersions.clear();
foldStore.value.folds.live.lastAt = 999990;
scheduleReaderFolds(['reader-1'], () => 1000000);
assert.deepEqual([...foldStore.value.folds.live.stale], ['reader-1'], 'the timer is armed and the reader waits');
assert.equal(foldStore.value.folds.live.pending !== undefined, true);
runArmedFold('live', () => 1000034);
assert.deepEqual([...foldStore.value.folds.live.stale], []);
// The bump counter is the store's own running number, so the second fold writes 2.
assert.deepEqual([...foldVersions], [['reader-1\u0000state', 2]]);

throttleReaders(['fixture-p'], 1000000);
assert.equal(isReaderThrottled('fixture-p', 1000999), true);
assert.equal(isReaderThrottled('fixture-p', 1001000), false);
foldStore.value.folds.steady.lastAt = 999000;
foldStore.value.folds.live.lastAt = 999000;
scheduleReaderFolds(['reader-1'], () => 1000000);
assert.equal(foldStore.value.folds.steady.lastAt, 1000000, 'a throttled reader folds steady');
assert.equal(foldStore.value.folds.live.lastAt, 999000);
foldStore.value.bumps = 0;
bumpRenderVersions(['x'], foldStore.value);
bumpRenderVersions(['y'], foldStore.value);
assert.deepEqual([...foldVersions].slice(-2), [['x\u0000state', 1], ['y\u0000state', 2]]);
assert.equal(foldStore.value.bumps, 2);
foldOff(); foldOffPanes(); foldOffVersions();
console.log('W45NotifyFoldCompiled.v1');

// W45-31: the bar's clock driver, from the same build — one tick's ledger, its armed delay, the cancel
// at the next tick, and a bar with nothing to show.
assert.equal(TOAST_FALLBACK_TIMEOUT_MS, 4000);
assert.equal(isBarHidden({ notifications: { current: null, queue: [] }, diffPanelVisible: true }), true);
assert.equal(isBarHidden({ notifications: { current: null, queue: [] }, paneHoldsToasts: true }), true);
// The body is `o.diffPanelVisible || o.paneHoldsToasts` with no coercion: two absent flags give
// undefined, not false.
assert.equal(isBarHidden({ notifications: { current: null, queue: [] } }), undefined);

const clockStored = new Map();
const clockOff = bindPluginState({
  values: {
    getState: () => ({ get: (key) => clockStored.get(key) }),
    setState: (update) => { for (const [key, value] of update(new Map(clockStored))) clockStored.set(key, value); },
  },
  versionFloor: 0,
  readersOf: new Map(),
});
const clockArmed = [], clockCancelled = [];
let clockNow = 1000000;
const clock = {
  now: () => clockNow,
  setTimeout: (fn, ms) => { clockArmed.push({ ms, fire: fn }); return () => { clockCancelled.push(ms); }; },
};
const clockToast = { key: 'plugin-toast-1:fixture-p', plugin: 'fixture-p', text: 'hello', timeoutMs: 4000 };
let barState = { notifications: { current: clockToast, queue: [] }, diffPanelVisible: false, paneHoldsToasts: false };
const barWrites = [];
const barStore = {
  getState: () => barState,
  setState: (update) => { const next = update(barState); barWrites.push(next === barState ? 'same' : 'changed'); barState = next; },
};
appendStoredToast({ key: clockToast.key, plugin: 'fixture-p', text: 'hello', ms: 1500 });
const barPending = {}, barLast = { current: emptyLedger() };
runClockTick({ clock, store: barStore, pending: barPending, last: barLast });
assert.deepEqual(barLast.current.toasts.map((t) => [t.key, t.leftMs, t.wasShown]), [['plugin-toast-1:fixture-p', 1500, true]]);
assert.deepEqual(barLast.current.slot, { key: 'plugin-toast-1:fixture-p', endsAt: 1004000, shown: 'plugin-toast-1:fixture-p' });
assert.deepEqual(readStoredLedger(), barLast.current);
assert.deepEqual(barWrites, ['same']);
assert.deepEqual(clockArmed.map((entry) => entry.ms), [1500]);
assert.equal(barPending.current !== undefined, true);
clockNow += 1000;
clockArmed[0].fire();
assert.deepEqual(clockCancelled, [1500]);
assert.deepEqual(clockArmed.map((entry) => entry.ms), [1500, 500]);
assert.deepEqual(barLast.current.toasts.map((t) => t.leftMs), [500]);
assert.equal(barLast.current.at, 1001000);

const idleArmed = [];
const idleClock = { now: () => 1000000, setTimeout: (fn, ms) => { idleArmed.push(ms); return () => {}; } };
const idleLast = { current: emptyLedger() };
const idlePending = {};
runClockTick({ clock: idleClock, store: { getState: () => ({ notifications: { current: null, queue: [] } }), setState: () => {} }, pending: idlePending, last: idleLast });
assert.deepEqual(idleArmed, []);
assert.equal(idlePending.current, undefined);
assert.deepEqual(idleLast.current, { toasts: [], at: 1000000, slot: undefined });
clockOff();
console.log('W45NotifyClockCompiled.v1');

// W45-32: the host toast stack, from the same build — the read, the cap, the fold, the write with its
// armed deadline, the timer, the undrawn report, and the label boundary this package leaves.
assert.equal(TOAST_LEAVING_MS, 240);
assert.equal(TOAST_HOLD_REBASE_MS, 30000);
assert.deepEqual(TOAST_STACK_KEY, { plugin: 'engine', key: 'toasts' });
assert.equal(toastStackStateKey(), 'engine\u0000toasts');
assert.equal(listEquals([1, 2], [1, 2]), true);
assert.equal(listEquals([1, 2], [2, 1]), false);
assert.equal(listEquals(undefined, undefined), true);

const stackStored = new Map();
const stackOff = bindPluginState({
  values: {
    getState: () => ({ get: (key) => stackStored.get(key) }),
    setState: (update) => { for (const [key, value] of update(new Map(stackStored))) stackStored.set(key, value); },
  },
  versionFloor: 0,
  readersOf: new Map(),
});
const stackEntry = (over) => ({
  id: 'a', owner: 'plugin-a', plugin: 'plugin-a', isManaged: false, text: 'hello',
  shownAt: 1000000, leavesAt: 1004000, phase: 'shown', ...over,
});
assert.equal(readToastStack(), EMPTY_TOAST_STACK);

// 26 entries for "big" against 25 for "small": the largest group loses its oldest member, and a
// managed last entry makes the filter keep every seat, so the recursion takes one more.
const stackOverCap = Array.from({ length: 51 }, (_, i) =>
  stackEntry({ id: `t${i}`, owner: i % 2 === 0 ? 'big' : 'small', leavesAt: 1000000 + i }));
const stackCapped = trimToastStack(stackOverCap);
assert.equal(stackCapped.length, 50);
assert.deepEqual(stackOverCap.map((t) => t.id).filter((id) => !stackCapped.some((t) => t.id === id)), ['t0']);
const stackManagedLast = [...stackOverCap, stackEntry({ id: 't51', owner: 'big', leavesAt: 1000051, isManaged: true })];
assert.deepEqual(stackManagedLast.map((t) => t.id).filter((id) => !trimToastStack(stackManagedLast).some((t) => t.id === id)), ['t0', 't2']);

const stackFolded = foldToastStack([
  stackEntry({ id: 'fresh', leavesAt: 1001000 }),
  stackEntry({ id: 'spent', leavesAt: 999999 }),
  stackEntry({ id: 'leaving', leavesAt: 1000000 - TOAST_LEAVING_MS - 1, phase: 'leaving' }),
  stackEntry({ id: 'held', heldAt: 1000000 - TOAST_HOLD_REBASE_MS - 500, leavesAt: 1000100, phase: 'leaving' }),
], 1000000);
assert.deepEqual(stackFolded.map((t) => [t.id, t.phase, t.leavesAt]),
  [['fresh', 'shown', 1001000], ['spent', 'leaving', 1000240], ['held', 'leaving', 1030600]]);

const stackArmed = [];
let stackUnrefs = 0;
const realStackSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((_, ms) => {
  stackArmed.push(ms);
  return { unref: () => { stackUnrefs += 1; } };
});
const stackClock = {};
bindToastClock(stackClock);
clearChainRecords();
writeToastStack([stackEntry({ id: 'one', leavesAt: 1000250 })], () => 1000000);
assert.deepEqual(stackStored.get(toastStackStateKey())?.value,
  [stackEntry({ id: 'one', leavesAt: 1000250 })]);
assert.deepEqual(stackArmed, [250]);
assert.equal(stackClock.pending !== undefined, true);
assert.equal(stackUnrefs, 1);
const stackBefore = JSON.stringify(stackStored.get(toastStackStateKey())?.value);
stackArmed.length = 0;
writeToastStack([stackEntry({ id: 'one', leavesAt: 1000250 })], () => 1000000);
assert.equal(JSON.stringify(stackStored.get(toastStackStateKey())?.value), stackBefore);
assert.deepEqual(stackArmed, [250], 'the same stack is not written, but the fold still arms');
clearChainRecords();
writeToastStack([], () => 1000000);
assert.deepEqual(logs().filter((line) => line.includes('never drawn')),
  ['$.ui.toast (plugin-a): one left the stack, never drawn']);
drawnToastIds().add('two');
stackStored.set(toastStackStateKey(), { value: [stackEntry({ id: 'two' })], version: 9 });
clearChainRecords();
writeToastStack([], () => 1000000);
assert.deepEqual(logs().filter((line) => line.includes('never drawn')), [], 'a drawn toast is not reported');
assert.equal(drawnToastIds().has('two'), false);

stackArmed.length = 0;
stackStored.delete(toastStackStateKey());
armToastTimer(() => 1000000, () => {});
assert.deepEqual(stackArmed, []);
stackStored.set(toastStackStateKey(), {
  value: [stackEntry({ id: 'a', leavesAt: 1000400 }), stackEntry({ id: 'b', leavesAt: 1000100 })], version: 10,
});
stackClock.pausedAt = 1000000;
armToastTimer(() => 1000000, () => {});
assert.deepEqual(stackArmed, [], 'a paused bar arms nothing');
stackClock.pausedAt = undefined;
armToastTimer(() => 1000000, () => {});
assert.deepEqual(stackArmed, [100]);
globalThis.setTimeout = realStackSetTimeout;

clearChainRecords();
reportUndrawnToast(stackEntry({ id: 'gone' }));
assert.deepEqual(logs().filter((line) => line.includes('never drawn')),
  ['$.ui.toast (plugin-a): gone left the stack, never drawn']);

// The label sanitiser is ported (W45-36) and so is the tab and ESC-sequence expander under it
// (W45-37), which drives the ESC tokenizer this product already carried.
assert.equal(pluginLabel('engine'), 'engine');
assert.equal(pluginLabel('my plugin'), 'my plugin');
assert.equal(pluginLabel(42), 'unnamed');
assert.equal(pluginLabel('a\tb'), 'a       b', 'a tab is expanded to the next eight-column stop');
bindToastClock(null);
stackOff();
console.log('W45NotifyStackCompiled.v1');

// W45-36: the label sanitiser, from the same build. The push path that the boundary blocked now
// stacks a real label, and the sanitiser's own policy is what the entry shows.
const labelStored = new Map();
const labelOff = bindPluginState({
  values: {
    getState: () => ({ get: (key) => labelStored.get(key) }),
    setState: (update) => { for (const [key, value] of update(new Map(labelStored))) labelStored.set(key, value); },
  },
  versionFloor: 0,
  readersOf: new Map(),
});
bindToastClock({});
hostToast({ plugin: 'engine', text: 'hi', timeoutMs: 4000 });
const labelPushed = labelStored.get(toastStackStateKey()).value;
assert.equal(labelPushed.length, 1, 'the toast is stacked now that the label resolves');
assert.equal(labelPushed[0].plugin, 'engine', 'the entry carries the sanitised label');
assert.equal(labelPushed[0].owner, 'engine');
assert.equal(labelPushed[0].text, 'hi');
assert.equal(labelPushed[0].phase, 'shown');
assert.equal(labelPushed[0].leavesAt - labelPushed[0].shownAt, 4000);
bindToastClock(null);
labelOff();
assert.equal(pluginLabel('a\nb'), 'a…', 'a multi-line label keeps its first line, elided');
assert.equal(pluginLabel('word '.repeat(12)), 'word word word word wor…', 'the first line is clamped to 24 columns');
assert.equal(pluginLabel('  padded  '), '  padded  ', 'the cap does not trim');
assert.equal(pluginLabel('end…'), 'unnamed', 'a label that is already elided is refused');
assert.equal(pluginLabel('   '), 'unnamed');
assert.equal(pluginLabel('​​'), '��', 'invisible characters become replacement characters');
assert.equal(pluginLabel('\u001b[31mred'), '�[31mred', 'the fold eats the escape before the boundary can see it');
assert.equal(pluginLabel('\u{1F469}‍\u{1F469}‍\u{1F467}'), '\u{1F469}‍\u{1F469}‍\u{1F467}',
  'a zero-width joiner survives between two emoji');
console.log('W45LabelTextCompiled.v1');

// W45-37: the tab and ESC-sequence expander, from the same build. A tab becomes the spaces up to
// the next eight-column stop with the column tracked per line, the pass runs only when tokenizing
// the text would change it, and the tokenizer it drives is the ESC machine this product already
// carried (src/tui-ansi-tokenizer.ts, byte-identical to chunk-yn0pfn70.js [3260,3602) and
// [3672,6275) — .audit/w45-37-tokenizer-identity.mjs recomputes that).
assert.equal(Epe('engine'), 'engine', 'text without a tab or an ESC-class byte is handed back');
assert.equal(Epe('a\tb'), 'a       b');
assert.equal(mCo(['abcdefg\th']).join(''), 'abcdefg h', 'the stop is measured from the running column');
assert.equal(mCo(['a\tb\nc\td']).join(''), 'a       b\nc       d', 'a line feed resets the column');
assert.equal(Epe('a\u0090b'), 'a�b', 'a C1 control is rewritten');
assert.equal(gCo(['\u001b[31m']), false, 'a bare escape is left alone');
assert.equal(gCo(['a\u0090b']), true, 'a C1 control is what the pass rewrites');
assert.deepEqual(ht('\u001b[31mred', true), [{ type: 'sequence', value: '\u001b[31m' }, { type: 'text', value: 'red' }]);
assert.equal(yt({ type: 'sequence', value: '\u001b[31m' }), undefined, 'a sequence token has no text');
assert.equal(yt({ type: 'text', value: 'a\u009bb' }), 'a\u0018b');
assert.equal(mt('a\u0090b'), 'a�b');
assert.equal(pluginLabel('abcdefg\th'), 'abcdefg h', 'the whole label path goes through it');
assert.equal(pluginLabel('a\tb\nc\td'), 'a       b…');
assert.equal(pluginLabel('\t\t'), 'unnamed', 'a label that is nothing but tabs has nothing to draw');
console.log('W45TabExpanderCompiled.v1');

// W45-33: the toast module's remaining verbs, from the same build — dismiss with its `cI` flag, an
// expire that folds, a hold that stamps and releases, and a pause that shifts every deadline.
const verbStored = new Map();
const verbOff = bindPluginState({
  values: {
    getState: () => ({ get: (key) => verbStored.get(key) }),
    setState: (update) => { for (const [key, value] of update(new Map(verbStored))) verbStored.set(key, value); },
  },
  versionFloor: 0,
  readersOf: new Map(),
});
const verbClock = {};
bindToastClock(verbClock);
const verbArmed = [];
const realVerbSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((_, ms) => {
  verbArmed.push(ms);
  return { unref: () => {} };
});
const verbEntry = (over) => ({
  id: 'a', owner: 'plugin-a', plugin: 'plugin-a', isManaged: false, text: 'hello',
  shownAt: 1000000, leavesAt: 1004000, phase: 'shown', ...over,
});
const verbStack = () => verbStored.get(toastStackStateKey())?.value;
drawnToastIds().clear();
verbStored.set(toastStackStateKey(), { value: [verbEntry({ id: 'a' }), verbEntry({ id: 'b' })], version: 1 });
clearChainRecords();
dismissToast('a', () => 1000000);
assert.deepEqual(verbStack().map((t) => t.id), ['b']);
assert.deepEqual([...drawnToastIds()], [], 'the flag the dismiss set is consumed by its own write');
assert.deepEqual(logs().filter((line) => line.includes('never drawn')), []);
assert.deepEqual(verbArmed, [4000]);
verbArmed.length = 0;
dismissToast('missing', () => 1000000);
assert.deepEqual(verbArmed, [], 'an id the stack does not hold writes nothing');

verbStored.set(toastStackStateKey(), { value: [verbEntry({ id: 'a', leavesAt: 999999 }), verbEntry({ id: 'b', leavesAt: 1000500 })], version: 2 });
expireToasts(() => 1000000);
assert.deepEqual(verbStack().map((t) => [t.id, t.phase, t.leavesAt]), [['a', 'leaving', 1000240], ['b', 'shown', 1000500]]);
assert.deepEqual(verbArmed, [240]);

verbStored.set(toastStackStateKey(), { value: [verbEntry({ id: 'a' })], version: 3 });
verbArmed.length = 0;
holdToast({ id: 'a', isHeld: true }, () => 1000000);
assert.deepEqual(verbStack(), [verbEntry({ id: 'a', heldAt: 1000000 })]);
assert.deepEqual(verbArmed, [30000]);
verbArmed.length = 0;
holdToast({ id: 'a', isHeld: false }, () => 1003000);
assert.deepEqual(verbStack(), [verbEntry({ id: 'a', leavesAt: 1007000 })]);

verbStored.set(toastStackStateKey(), {
  value: [verbEntry({ id: 'a' }), verbEntry({ id: 'b', leavesAt: 1009000, heldAt: 1000000 })], version: 4,
});
verbArmed.length = 0;
pauseToasts({ isPaused: true }, () => 1000000);
assert.equal(verbClock.pausedAt, 1000000);
assert.deepEqual(verbArmed, []);
pauseToasts({ isPaused: true }, () => 1001000);
assert.equal(verbClock.pausedAt, 1000000, 'the same pause state is not a change');
pauseToasts({ isPaused: false }, () => 1005000);
assert.equal(verbClock.pausedAt, undefined);
assert.deepEqual(verbStack().map((t) => [t.leavesAt, t.heldAt]), [[1009000, undefined], [1014000, 1005000]]);
assert.deepEqual(verbArmed, [4000]);
globalThis.setTimeout = realVerbSetTimeout;
bindToastClock(null);
verbOff();
console.log('W45NotifyVerbsCompiled.v1');
// W45-35: the registry is the source's own literal, built by the source's own factory. The exact
// defaults are asserted on a fresh registry; the registry the seam hands back is read for shape only,
// because the blocks above bind and release stores over it.
const regState = createPluginRegistryState();
assert.equal(Object.keys(regState).length, 89, 'the literal carries every field the source writes');
assert.equal('marketplaces' in regState && 'hiddenRegistryEntries' in regState, true);
assert.deepEqual(Object.entries(regState).filter(([, value]) => value && typeof value.setState === 'function')
  .map(([key]) => key).sort(), ['hoverGroups', 'notices', 'panes', 'renderVersions']);
assert.deepEqual(Object.entries(regState).filter(([, value]) => value && typeof value.emit === 'function')
  .map(([key]) => key).sort(), ['commandProducerDirsChanged', 'focusSiteDraws', 'hooksLeftOutByNameChanged']);
assert.equal(Object.isFrozen(regState.panes.getState()), true);
assert.deepEqual(regState.panes.getState(), {
  open: [], unplaced: [], asked: [], shownId: null, focusedId: null, focusRequest: null, placements: 0, closing: [],
});
assert.deepEqual(regState.renderVersions.getState(), new Map());
assert.notEqual(regState, createPluginRegistryState(), 'each factory call builds its own');

const regStore = createPluginStateStore();
assert.deepEqual(Object.keys(regStore).sort(),
  ['bumps', 'faultRuns', 'folds', 'mounted', 'readers', 'readersOf', 'staleListeners', 'values', 'versionFloor']);
assert.deepEqual(regStore.values.getState(), new Map());
assert.equal(regStore.values.getSnapshot, regStore.values.getState);
assert.equal(regStore.folds.steady.lastAt, Number.NEGATIVE_INFINITY);
assert.deepEqual(regStore.folds.live.stale.size, 0);
assert.equal(regStore.bumps, 0);
assert.deepEqual(Object.keys(createToastClock()), ['pending', 'pausedAt'], 'both fields are written, not left off');

const seamRegistry = it();
assert.equal(it(), seamRegistry, 'one registry object, built on the first call');
assert.equal(typeof seamRegistry.pluginState.values.getState, 'function', 'a store is always installed');
assert.equal(seamRegistry.pluginState.values.getState() instanceof Map, true);
assert.equal(seamRegistry.hooksRespawns instanceof Set, true,
  'the source\'s Set is the field, which is what the ported N5t reads .size on');
assert.equal(seamRegistry.hooksRespawns.size, 0);
assert.equal(Object.isFrozen(seamRegistry.panes.getState()), true);
assert.equal(seamRegistry.renderVersions.getState() instanceof Map, true);
assert.equal(seamRegistry.uiLogSink, null, 'no block bound a sink, so the field is the null the source writes');
assert.equal(Array.isArray(seamRegistry.pendingUiLog), true,
  'the literal array is the field; the ui blocks above left undrawn reports in it, so only its shape is asserted here');
assert.deepEqual(regState.pendingUiLog, [], 'a fresh registry starts with none');

const regWrites = [];
const stopRegWrites = regState.renderVersions.subscribe(() => regWrites.push('subscriber'));
regState.renderVersions.setState((current) => current);
assert.deepEqual(regWrites, [], 'the same value is a no-op');
regState.renderVersions.setState((current) => new Map(current).set('k', 1));
assert.deepEqual(regWrites, ['subscriber']);
stopRegWrites();
regState.renderVersions.setState(() => new Map());
assert.deepEqual(regWrites, ['subscriber'], 'the unsubscribed listener is not called again');

const regSignal = regState.hooksLeftOutByNameChanged;
const regSignalHeard = [];
regSignal.subscribe((...args) => regSignalHeard.push(args));
regSignal.subscribe(() => { throw new Error('second'); });
regSignal.subscribe(() => { throw new RangeError('third'); });
assert.throws(() => regSignal.emit('event'), (error) => {
  assert.equal(error.constructor, AggregateError);
  assert.equal(error.message, 'Signal listener(s) threw');
  assert.deepEqual(error.errors.map((each) => each.constructor), [Error, RangeError]);
  return true;
});
assert.deepEqual(regSignalHeard, [['event']], 'every listener runs before the throws are re-raised');
const regLoneSignal = createPluginRegistryState().hooksLeftOutByNameChanged;
regLoneSignal.subscribe(() => { throw new TypeError('only'); });
assert.throws(() => regLoneSignal.emit(), { name: 'TypeError', message: 'only' });
regLoneSignal.clear();
regLoneSignal.emit();
console.log('W45RegistryStateCompiled.v1');

// W45-38: the bar's mount layer, from the same build — the effect `JFe` mounts over the tick ported in
// W45-31, the five members its dependency array watches, and the pane hold `XFe` keeps. `gro`/`YAt`
// behind `readPaneHold` are the copied bodies (research/ports/W45-bar-mount-blocks.plan.json).
const mountStored = new Map();
const mountOff = bindPluginState({
  values: {
    getState: () => ({ get: (key) => mountStored.get(key) }),
    setState: (update) => { for (const [key, value] of update(new Map(mountStored))) mountStored.set(key, value); },
  },
  versionFloor: 0,
  readersOf: new Map(),
});
const mountToast = { key: 'plugin-toast-1:fixture-mount', plugin: 'fixture-mount', text: 'hello', timeoutMs: 4000 };
let mountState = { notifications: { current: mountToast, queue: [] }, diffPanelVisible: false, paneHoldsToasts: false };
const mountUpdaters = [];
const mountStore = {
  getState: () => mountState,
  setState: (update) => { mountUpdaters.push(update); mountState = update(mountState); },
};
const mountNow = { at: 2000000 };
const mountArmed = [];
const mountCancelled = [];
const mountClock = {
  now: () => mountNow.at,
  setTimeout: (fn, ms) => { mountArmed.push({ ms, fire: fn }); return () => { mountCancelled.push(ms); }; },
};
appendStoredToast({ key: mountToast.key, plugin: 'fixture-mount', text: 'hello', ms: 1500 });

assert.equal(barNotificationKeys(mountState), 'plugin-toast-1:fixture-mount');
assert.equal(barNotificationKeys({ notifications: { current: null, queue: [{ key: 'a' }] } }), ' a');
assert.equal(barNotificationKeys({ notifications: { current: null, queue: [] } }), '');
assert.equal(storedToastKeys({ get: (key) => mountStored.get(key) }), 'plugin-toast-1:fixture-mount');

const mountDeps = { clock: mountClock, store: mountStore, notificationKeys: 'a', hidden: false, storedToastKeys: 'a' };
assert.equal(barClockDriverChanged(null, mountDeps), true, 'the mount always runs the effect');
assert.equal(barClockDriverChanged(mountDeps, { ...mountDeps }), false);
assert.equal(barClockDriverChanged(mountDeps, { ...mountDeps, notificationKeys: 'b' }), true);
assert.equal(barClockDriverChanged(mountDeps, { ...mountDeps, hidden: undefined }), true);

const mountDriver = createBarClockDriver();
const mountCleanup = mountBarClockDriver(mountDriver, mountClock, mountStore);
assert.deepEqual(mountArmed.map((entry) => entry.ms), [1500], 'the mounted tick armed the ledger\'s delay');
assert.deepEqual(readStoredLedger(), mountDriver.last.current, 'and wrote the ledger it laid out');
assert.equal(mountCancelled.length, 0, 'nothing cancelled before the cleanup');
mountCleanup();
assert.deepEqual(mountCancelled, [1500], 'the cleanup is `() => M.current?.()`');
const mountRerun = mountBarClockDriver(mountDriver, mountClock, mountStore);
assert.equal(mountDriver.last.current.at, mountNow.at, 'the re-run ages the ledger the driver kept');
mountRerun();

assert.equal(readPaneHold({ placements: 2, open: [{ id: 'a', holdToasts: true }], shownId: 'a' }), true);
assert.equal(readPaneHold({ placements: 0, open: [{ id: 'a', holdToasts: true }], shownId: 'a' }), false);
assert.equal(readPaneHold({ placements: 1, open: [{ id: 'a' }, { id: 'b', holdToasts: true }], shownId: 'a' }), false);
assert.equal(readPaneHold({ placements: 1, open: [{ id: 'a' }], shownId: 'b' }), false);

let mountDrained = 0;
const mountRelease = holdPaneToasts({ holds: true, store: mountStore, drain: () => { mountDrained += 1; } });
assert.equal(mountState.paneHoldsToasts, true);
assert.equal(isBarHidden(mountState), true, 'a held pane makes the bar count as hidden, which is `he`');
mountRelease();
assert.equal(mountState.paneHoldsToasts, false);
assert.equal(mountDrained, 1);
assert.equal(holdPaneToasts({ holds: false, store: mountStore, drain: () => { mountDrained += 1; } })(), undefined);
assert.equal(mountDrained, 1, 'no hold, no write and no drain');
mountOff();
console.log('W45BarMountCompiled.v1');

// W45-39: the notification queue owner, from the same build — the drain, the four push branches, the
// remove, and the mount effect, with the copied gate in front of them.
assert.equal(NOTIFICATION_DEFAULT_TIMEOUT_MS, 8000);
assert.equal(notificationQueueSuppressed({ presentationContext: 'fullscreen', isScreenReaderEnabled: false }), false,
  'the gate is false in this build: the capability probe answers !1');
const queueStored = [];
const queueClockArmed = [];
const queueClockCancelled = [];
let queueState = { notifications: { current: null, queue: [], pinned: [] } };
const queueWrites = [];
const queueStore = {
  getState: () => queueState,
  setState: (update) => { const next = update(queueState); queueWrites.push(next === queueState ? 'same' : 'changed'); queueState = next; },
};
const queueClock = {
  setTimeout: (fn, ms) => { queueClockArmed.push({ ms, fire: fn }); return () => { queueClockCancelled.push(ms); }; },
};
const queueKeys = () => [queueState.notifications.current?.key ?? '-', ...queueState.notifications.queue.map((n) => n.key)];
const queue = createNotificationQueue({ store: queueStore, clock: queueClock });
queueState = { ...queueState, notifications: { ...queueState.notifications, queue: [{ key: 'a', priority: 'low', timeoutMs: 111 }, { key: 'b', priority: 'high', timeoutMs: 222 }] } };
queue.processQueue();
assert.deepEqual(queueKeys(), ['b', 'a'], 'the highest-priority entry takes the free slot');
assert.deepEqual(queueClockArmed.map((entry) => entry.ms), [222]);
const queueMark = queueWrites.length;
queue.processQueue();
assert.deepEqual(queueWrites.slice(queueMark), ['same'], 'an occupied slot stops the drain');
queue.addNotification({ key: 'pinned', pinned: true });
assert.deepEqual(queueState.notifications.pinned.map((n) => n.key), ['pinned']);
queue.addNotification({ key: 'imm', priority: 'immediate', timeoutMs: 2000 });
assert.deepEqual(queueKeys(), ['imm', 'b', 'a'], 'immediate takes the slot and requeues the holder');
assert.deepEqual(queueClockArmed.map((entry) => entry.ms), [222, 2000]);
queue.addNotification({ key: 'imm', priority: 'immediate' });
assert.equal(queueWrites.at(-1), 'changed', 'a duplicate immediate re-takes the slot; the branch returns before the drain');
queueState = { ...queueState, diffPanelVisible: true };
queue.addNotification({ key: 'held', priority: 'immediate', timeoutMs: 3000 });
assert.deepEqual(queueState.notifications.queue.find((n) => n.key === 'held')?.heldDuringDiffPanel, true,
  'an immediate notification behind a diff panel is held in the queue');
const queueBefore = queueClockArmed.length;
queue.processQueue();
assert.equal(queueClockArmed.length, queueBefore, 'and the drain refuses it while the panel is up');
queueState = { ...queueState, diffPanelVisible: false };
queue.removeNotification('pinned');
assert.equal(queueState.notifications.pinned.length, 0);
queue.removeNotification('imm');
assert.equal(queueKeys()[0], 'held', 'removing the slot holder lets the drain promote the held entry (immediate, panel gone)');
const queueUnmount = queue.mount();
assert.equal(queue.mountCount.current, 1, 'the mount effect counts the surfaces');
const queueUnmount2 = queue.mount();
queueUnmount();
assert.equal(queue.mountCount.current, 1);
queueUnmount2();
assert.equal(queue.mountCount.current, 0);
assert.equal(queueClockCancelled.length > 0, true, 'the last unmount cancels the pending timer');
console.log('W45NotifyQueueCompiled.v1');

// W45-40: the registry's invalidation surface against the same registry the driver already read. The
// resets are driven in the four compositions the source's call sites build (bM, zLr, _7, bCn).
const resetTargets = ['commands', 'skills', 'skillsV5', 'agents', 'outputStyles', 'workflows', 'pluginLoadCacheOnly'];
const resetMarkers = ['pluginLoad', 'handedIn', 'hookRegistrationEpoch'];
const resetSeed = () => {
  seamRegistry.commands = ['c'];
  seamRegistry.skills = ['s'];
  seamRegistry.skillsV5 = ['s5'];
  seamRegistry.agents = ['a'];
  seamRegistry.outputStyles = ['o'];
  seamRegistry.workflows = ['w'];
  seamRegistry.pluginLoadCacheOnly = true;
  seamRegistry.pluginLoad = 'marker';
  seamRegistry.handedIn = 'marker';
  seamRegistry.hookRegistrationEpoch = 7;
  return Object.fromEntries([...resetTargets, ...resetMarkers].map((key) => [key, seamRegistry[key]]));
};
const resetChanged = (before) => [...resetTargets, ...resetMarkers]
  .filter((key) => !Object.is(before[key], seamRegistry[key])).sort();
const resetSnapshot = () => Object.fromEntries([...resetTargets, ...resetMarkers].map((key) => [key, seamRegistry[key]]));
const resetCases = [
  ['Nhr', resetCommands, ['commands']],
  ['Fhr', resetSkills, ['skills', 'skillsV5']],
  ['$hr', resetAgents, ['agents']],
  ['Uhr', resetOutputStyles, ['outputStyles']],
  ['UDn', resetWorkflows, ['workflows']],
  ['bM', () => { resetCommands(); resetSkills(); }, ['commands', 'skills', 'skillsV5']],
  ['zLr', () => { resetCommands(); resetAgents(); resetOutputStyles(); resetWorkflows(); },
    ['agents', 'commands', 'outputStyles', 'workflows']],
];
for (const [name, run, cleared] of resetCases) {
  const before = resetSeed();
  run();
  assert.deepEqual(resetChanged(before), cleared, `the compiled ${name} clears ${cleared.join(',')} only`);
}
const regAgents = seamRegistry.registeredAgents;
regAgents.clear();
regAgents.set('alpha', { id: 'alpha' });
assert.equal(registeredAgentExists('alpha'), true);
assert.equal(registeredAgentExists('beta'), false);
seamRegistry.pluginLoadCacheOnly = false;
assert.equal(pluginLoadCacheOnly(), false, 'the read returns the slot itself, false included');
resetSeed();
resetCommands();
const resetCleared = resetSnapshot();
resetCommands();
assert.deepEqual(resetChanged(resetCleared), [], 'a second reset over a cleared slot is a no-op');
console.log('W45RegistryResetCompiled.v1');

// W45-41: the source registry the five clears reach. Driven through dist, on fresh stores, so the
// tables each method empties and the ones it leaves alone are read from the compiled copy.
const sources = createSourcesRegistry();
assert.equal(sources.dynamicSkillStateKey(), 'cli');
assert.equal(sources.refusedReservedSkillNames().length, 0);
assert.ok(sources.reservedSpellingsByLoadedResult instanceof WeakMap, 'the weak container stays weak');
assert.ok(sources.loadedResultsMissingTrustedNames instanceof WeakSet);
const sourceMaps = ['loadedCommands', 'skillToolCommands', 'slashCommandToolSkills', 'skillIndex', 'skillDirCommands',
  'markdownFiles', 'agentDefinitions', 'outputStyleDirStyles', 'allOutputStyles', 'routines', 'routineCronTasks',
  'allWorkflows'];
assert.deepEqual(sourceMaps.map((key) => sources[key].size), sourceMaps.map(() => 0));
for (const key of sourceMaps) sources[key].set('k', 'v');
sources.builtinCommandTable = { table: 1 };
sources.dynamicSkillStates.set('cli', {
  refusedReservedNames: new Map([['x', 1]]),
  conditionalSkills: new Map([['c', 1]]),
  activatedConditionalSkillNames: new Set(['c']),
});
sources.invalidateCommands();
assert.equal(sources.builtinCommandTable, undefined);
assert.deepEqual(['loadedCommands', 'skillToolCommands', 'slashCommandToolSkills', 'skillIndex'].map((key) => sources[key].size), [0, 0, 0, 0]);
assert.equal(sources.markdownFiles.size, 1, 'invalidateCommands leaves the load caches alone');
sources.invalidateSkillDirs();
assert.equal(sources.skillDirCommands.size, 0);
assert.equal(sources.dynamicSkillStates.get('cli').conditionalSkills.size, 0);
for (const key of sourceMaps) if (sources[key].size === 0) sources[key].set('k', 'v');
sources.clearLoadCaches();
assert.deepEqual(sourceMaps.map((key) => sources[key].size), sourceMaps.map(() => 0));
assert.deepEqual(sources.refusedReservedSkillNames(), [1]);
const loadedResult = { name: 'loaded' };
let builds = 0;
const spelling = sources.reservedSpellingsFor(loadedResult, () => { builds += 1; return ['a']; });
assert.equal(sources.reservedSpellingsFor(loadedResult, () => { builds += 1; return ['b']; }), spelling);
assert.equal(builds, 1, 'the reserved spellings are memoised per loaded result');
sources.markLoadedResultMissingTrustedNames(loadedResult);
assert.equal(sources.loadedResultIsMissingTrustedNames(loadedResult), true);
sources.dynamicSkillStates.set('p1', { refusedReservedNames: new Map(), conditionalSkills: new Map(), activatedConditionalSkillNames: new Set() });
sources.skillDirCommands.set('p1:one', 1);
sources.skillDirCommands.set('p1x:one', 1);
sources.evictDynamicSkillState('p1');
assert.deepEqual([...sources.skillDirCommands.keys()], ['p1x:one'], 'only the `p1:` prefix goes');
const memoTable = new Map();
assert.equal(memoizeOrBuild(memoTable, 'k', () => ['v']), memoizeOrBuild(memoTable, 'k', () => ['other']));
assert.equal(nullableKey(null), '\u0000');
assert.equal(nullableKey('a'), 'a');
assert.equal(xr(), xr(), 'one store per process');
assert.notEqual(createSourcesRegistry(), xr());
console.log('W45SourcesRegistryCompiled.v1');

// W45-42: the invalidation calls, driven against the same two registries the driver already holds.
const invalidateTables = ['skillDirCommands', 'markdownFiles', 'agentDefinitions', 'outputStyleDirStyles',
  'allOutputStyles', 'routines', 'routineCronTasks', 'allWorkflows', 'builtinCommandTable'];
const invalidateSlots = ['agents', 'outputStyles', 'commands', 'skills', 'skillsV5', 'workflows', 'hookRegistration'];
// The source tables live on the source registry `xr()`; the slots live on the plugin registry, which is
// the `it()` the W45-40 block above already holds as `seamRegistry`.
const invalidateStore = xr();
const invalidateSeed = () => {
  for (const key of invalidateTables) {
    const value = invalidateStore[key];
    if (value instanceof Map) value.set('k', 'v');
    else invalidateStore[key] = 'marker';
  }
  for (const key of invalidateSlots) seamRegistry[key] = 'marker';
};
const invalidateCleared = () => [
  ...invalidateTables.filter((key) => invalidateStore[key] instanceof Map && invalidateStore[key].size === 0),
  ...invalidateSlots.filter((key) => seamRegistry[key] === undefined).map((key) => `plugin.${key}`),
].sort();
const invalidateCases = [
  [invalidateSkillSources, ['markdownFiles', 'skillDirCommands']],
  [clearHookRegistration, ['plugin.hookRegistration']],
  [invalidateAgentSources, ['agentDefinitions', 'markdownFiles', 'plugin.agents']],
  [invalidateOutputStyleSources, ['markdownFiles', 'outputStyleDirStyles', 'plugin.outputStyles']],
];
for (const [call, expected] of invalidateCases) {
  invalidateSeed();
  call();
  assert.deepEqual(invalidateCleared(), expected, `${call.name} clears ${expected.join(',')} only`);
  const once = invalidateCleared();
  call();
  assert.deepEqual(invalidateCleared(), once, `${call.name} twice changes nothing more`);
}
invalidateSeed();
invalidateSkillSources();
assert.equal(invalidateStore.builtinCommandTable, 'marker', 'the command table belongs to the unported `VT`');
console.log('W45InvalidateCompiled.v1');

// W45-44: the `$` session read floor from dist — the process fallbacks and their two log lines, the
// bound session's model, the turn count, the drawing-surface list, and the registry's own marks.
clearChainRecords();
const sessionUnbind = bindPluginProcessIdentity({ id: 'pid-1', cwd: '/proc/cwd', root: '/proc/root', model: 'proc-model' });
assert.deepEqual(await sessionRecord('fixture-session'),
  { id: 'pid-1', cwd: '/proc/cwd', root: '/proc/root', model: 'proc-model' });
assert.ok(logs().some((l) => l.includes('$.session (fixture-session): no session bound; id, cwd and model answered from the process')));

const sessionBound = bindPluginSessionRecord({
  status: () => {}, toast: () => {}, model: () => 'bound-model',
  messages: () => [
    { type: 'user', message: { content: 'first' } },
    { type: 'user', message: { content: [{ type: 'tool_result' }] } },
    { type: 'user', isMeta: true, message: { content: 'meta' } },
    { type: 'assistant', message: { content: 'nope' } },
  ],
  surface: 'terminal',
});
assert.equal(await raiseSessionCall({ event: 'session.model', args: {}, caller: caller('fixture-session') }), 'bound-model');
assert.equal(await raiseSessionCall({ event: 'session.cwd', args: {}, caller: { ...caller('fixture-session'), cwd: '/caller/cwd' } }), '/caller/cwd');
assert.equal(await raiseSessionCall({ event: 'session.id', args: {}, caller: caller('fixture-session') }), 'pid-1');
assert.equal(await raiseSessionCall({ event: 'session.turns', args: {}, caller: caller('fixture-session') }), 1);
assert.deepEqual(await raiseSessionCall({ event: 'session.surfaces', args: {}, caller: caller('fixture-session') }), ['terminal']);
assert.equal(await raiseSessionCall({ event: 'session.surface', args: {}, caller: caller('fixture-session') }), 'terminal');

assert.equal(attachPluginDrawingClient({ clientId: 'd1', surface: 'sidebar', viewport: { width: 10 } }), true);
assert.equal(attachPluginDrawingClient({ clientId: 'd1', surface: 'sidebar', viewport: { height: 4 } }), false);
const detaches = [];
const offDetach = onPluginDrawingDetach((clientId) => detaches.push(clientId));
markPluginDrawingMissed('d1');
assert.equal(isPluginDrawingSilent('d1'), true);
markPluginDrawingHeard('d1');
assert.equal(isPluginDrawingSilent('d1'), false);
assert.deepEqual(drawingSurfaces(), ['terminal', 'sidebar']);
assert.deepEqual(await raiseSessionCall({ event: 'session.surfaces', args: {}, caller: caller('fixture-session') }), ['terminal', 'sidebar']);
assert.equal(detachPluginDrawingClient('d1')?.clientId, 'd1');
assert.deepEqual(detaches, ['d1']);
offDetach();
assert.deepEqual(pluginDrawingSurfaceNames(), []);
sessionBound();
sessionUnbind();
clearChainRecords();

const sessionNext = installChainModule({
  name: 'fixture-session-next',
  tier: 'user',
  hooks: (e) => e === 'session.cwd',
  record: () => ({ name: 'fixture-session-next', tier: 'user', run: async (args, next) => await next(args) }),
});
try {
  assert.equal(await raiseSessionCall({ event: 'session.cwd', args: {}, caller: caller('fixture-session') }), process.cwd());
} finally {
  sessionNext();
}
console.log('W45SessionFloorCompiled.v1');

// W45-45: the `$` clock and env floors from dist — the process clock, the shared wait behind three
// names, the abort reason, the two checks and the USER_TYPE override.
clearChainRecords();
{
  const before = Date.now();
  const now = await raiseClockCall({ event: 'clock.now', args: {}, caller: caller('fixture-clock') });
  assert.ok(now >= before && now <= Date.now(), 'clock.now answers the process clock');

  const midAbort = new AbortController();
  const waiting = sleep(5000, midAbort.signal);
  midAbort.abort(new Error('the fixture stopped waiting'));
  await assert.rejects(() => waiting, /the fixture stopped waiting/);
  await sleep(5);

  const refuses = installChainModule({
    name: 'fixture-clock-check',
    tier: 'user',
    hooks: (e) => e === 'clock.sleep',
    record: () => ({ name: 'fixture-clock-check', tier: 'user', run: async (args, next) => await next(args) }),
  });
  try {
    await assert.rejects(
      () => raiseClockCall({ event: 'clock.sleep', args: { ms: 'soon' }, caller: caller('fixture-clock') }),
      /HooksError: clock\.sleep: takes \{ ms \}, a non-negative number of milliseconds \(got soon\) \(host check\)/,
    );
  } finally {
    refuses();
  }

  process.env.CC_REVERSE_FIXTURE_COMPILED = 'from the process';
  process.env.USER_TYPE = 'hidden';
  try {
    assert.equal(await raiseEnvCall({ event: 'env.get', args: { name: 'CC_REVERSE_FIXTURE_COMPILED' }, caller: caller('fixture-clock') }), 'from the process');
    assert.equal(await readProcessEnv('USER_TYPE'), 'external');
    await raiseEnvCall({ event: 'env.set', args: { name: 'CC_REVERSE_FIXTURE_COMPILED', value: undefined }, caller: caller('fixture-clock') });
    assert.equal(Object.hasOwn(process.env, 'CC_REVERSE_FIXTURE_COMPILED'), false, 'no value unsets the variable');
  } finally {
    delete process.env.CC_REVERSE_FIXTURE_COMPILED;
    delete process.env.USER_TYPE;
  }
  assert.equal(Object.keys(clockCallTable()).sort().join(','),
    'clock.after,clock.every,clock.now,clock.sleep');
  assert.equal(Object.keys(envCallTable()).sort().join(','), 'env.get,env.set');
}
console.log('W45ClockEnvCompiled.v1');

// W45-46: the `$` filesystem floor from dist — the read with its byte limit and its base64 form, the
// write and its log line, the existence probe, the link-following stat, the sorted list, and both host
// boundaries: the location policy that refuses the call and the platform the read picks its mode by.
const fsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-fs-compiled-'));
try {
  const fsFile = path.join(fsRoot, 'file.txt');
  fs.writeFileSync(fsFile, 'compiled fs', 'utf8');
  clearChainRecords();
  assert.equal(await raiseFsCall({ event: 'fs.read', args: { path: fsFile }, caller: caller('fixture-fs') }), 'compiled fs');
  assert.deepEqual(await raiseFsCall({ event: 'fs.read', args: { path: fsFile, as: 'bytes' }, caller: caller('fixture-fs') }),
    { base64: Buffer.from('compiled fs').toString('base64') });

  await raiseFsCall({ event: 'fs.write', args: { path: path.join(fsRoot, 'made', 'deep.txt'), text: 'written' }, caller: caller('fixture-fs') });
  assert.equal(fs.readFileSync(path.join(fsRoot, 'made', 'deep.txt'), 'utf8'), 'written');
  assert.ok(logs().some((line) => line.includes('$.fs.write (fixture-fs):')), `log lines: ${JSON.stringify(logs())}`);

  const fsLink = path.join(fsRoot, 'link.txt');
  fs.symlinkSync(fsFile, fsLink);
  const stat = await raiseFsCall({ event: 'fs.stat', args: { path: fsLink, resolve: true }, caller: caller('fixture-fs') });
  assert.equal(stat.isLink, true);
  assert.equal(stat.kind, 'file');
  assert.equal(stat.size, 11);
  assert.equal(stat.realPath, fs.realpathSync(fsFile));

  const listed = await raiseFsCall({ event: 'fs.list', args: { path: fsRoot }, caller: caller('fixture-fs') });
  assert.deepEqual(listed.map((entry) => entry.name), ['file.txt', 'link.txt', 'made'], 'the sorted list holds the file the write made');
  assert.equal(listed.find((entry) => entry.name === 'link.txt').isLink, true);
  assert.equal(await raiseFsCall({ event: 'fs.exists', args: { path: fsFile }, caller: caller('fixture-fs') }), true);
  assert.equal(await raiseFsCall({ event: 'fs.exists', args: { path: path.join(fsRoot, 'absent') }, caller: caller('fixture-fs') }), false);

  bindNetworkLocationRefusal((file) => file.includes('network'));
  try {
    await assert.rejects(
      () => raiseFsCall({ event: 'fs.read', args: { path: '/network/share/x' }, caller: caller('fixture-fs') }),
      /refused: a network location is not reached from here/,
    );
  } finally {
    bindNetworkLocationRefusal(undefined);
  }

  let platformAsked = 0;
  bindHostPlatform(() => { platformAsked += 1; return 'windows'; });
  try {
    assert.equal(await raiseFsCall({ event: 'fs.read', args: { path: fsFile }, caller: caller('fixture-fs') }), 'compiled fs');
    assert.equal(platformAsked, 1, 'the read asks the platform once');
  } finally {
    bindHostPlatform(undefined);
  }
  assert.equal(O(), process.platform);
  assert.equal(Object.keys(fsCallTable()).sort().join(','), 'fs.exists,fs.list,fs.read,fs.stat,fs.write');
} finally {
  fs.rmSync(fsRoot, { recursive: true, force: true });
}
console.log('W45FsCompiled.v1');

// W45-47: the `$` ui.selection floor from dist — the selection the bound context holds, read through
// its own accessor, and undefined with nothing bound (the entry carries no check, so no argument is
// ever refused).
const selectionUnbind = bindPluginSession({
  status: () => {}, toast: () => {},
  selection: { read: () => ({ text: 'compiled selection', surface: 'terminal' }) },
});
try {
  assert.deepEqual(await raiseUiCall({ event: 'ui.selection', args: {}, caller: caller('fixture-ui') }),
    { text: 'compiled selection', surface: 'terminal' });
  assert.equal(await raiseUiCall({ event: 'ui.selection', args: 7, caller: caller('fixture-ui') }) instanceof Object, true,
    'an argument no check reads still reaches the floor');
} finally {
  selectionUnbind();
}
assert.equal(await raiseUiCall({ event: 'ui.selection', args: {}, caller: caller('fixture-ui') }), undefined);
// W45-57 added `ui.notify` to the same slice.
assert.equal(Object.keys(uiCallTable()).sort().join(','), 'ui.blit,ui.log,ui.notify,ui.selection,ui.status,ui.toast');
console.log('W45UiSelectionCompiled.v1');

// W45-48: the `$` store's file layer from dist — the naming rule (verbatim, sanitized-and-hashed,
// device names), the path under the bound data directory, the directory made, and the logged touch.
const storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-store-compiled-'));
try {
  const storeHash = (id) => crypto.createHash('sha256').update(id).digest('hex').slice(0, 12);
  bindPluginDataDir(() => storeRoot);
  assert.equal(storeFileName('hook_agent'), 'hook_agent.json');
  assert.equal(storeFileName('My Plugin!'), `My_Plugin_-${storeHash('My Plugin!')}.json`);
  assert.equal(storeFileName('con'), `con-${storeHash('con')}.json`);
  assert.equal(storeFileName('.'), `_-${storeHash('.')}.json`);
  assert.equal(storeFileName(''), `plugin-${storeHash('')}.json`);
  assert.equal(storeFilePath('hook_agent'), path.join(storeRoot, 'store', 'hook_agent.json'));
  const storeFile = await ensureStoreDir('hook_agent');
  assert.equal(fs.statSync(path.join(storeRoot, 'store')).isDirectory(), true);
  fs.writeFileSync(storeFile, '{}', 'utf8');
  clearChainRecords();
  await touchStoreFile('hook_agent', storeFile);
  assert.deepEqual(logs(), [], 'a touch that worked says nothing');
  await touchStoreFile('hook_agent', path.join(storeRoot, 'absent', 'x.json'));
  assert.equal(logs().length, 1);
  assert.match(logs()[0], /^\$\.store \(hook_agent\): could not touch .*absent\/x\.json: /);
  bindPluginDataDir(undefined);
  assert.throws(() => storeDataDir(), /the plugin data directory is not bound/);
} finally {
  fs.rmSync(storeRoot, { recursive: true, force: true });
}
console.log('W45StorePathCompiled.v1');

// W45-49: the lockfile library from dist — a real acquisition on a real file (the lock is a directory
// beside it), the handle's own release and its `Symbol.asyncDispose`, the refusal a live holder gets,
// the stale takeover, and the warned release of a lock that is already gone.
const lockRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-lock-compiled-'));
try {
  const lockFile = path.join(lockRoot, 'store.json');
  fs.writeFileSync(lockFile, '{}', 'utf8');
  assert.equal(fs.existsSync(`${lockFile}.lock`), false);
  const lockHandle = await acquirePluginStoreLock(lockFile);
  assert.equal(typeof lockHandle, 'function');
  assert.equal(lockHandle[Symbol.asyncDispose], lockHandle);
  assert.equal(fs.statSync(`${lockFile}.lock`).isDirectory(), true);
  assert.equal(await checkPluginStoreLock(lockFile), true);
  await assert.rejects(acquirePluginStoreLock(lockFile), (error) => error.code === 'ELOCKED');
  assert.equal(await lockHandle(), undefined);
  assert.equal(await checkPluginStoreLock(lockFile), false, 'the handle released the lock it held');

  const staleFile = path.join(lockRoot, 'stale.json');
  fs.writeFileSync(staleFile, '{}', 'utf8');
  // The holder is given a stale window far longer than the run, and back-dated past it, because the
  // library keeps its locks in one process-global map keyed by path: a takeover overwrites the slot, so
  // releasing the displaced holder cannot clear the timer its own acquisition armed. That orphan fires
  // minutes later, finds the path gone and calls onCompromised, which the source's own default throws —
  // so the window is moved out of the run rather than left to kill it. Measured in .audit/w45-65-lockprobe2.mjs.
  const staleHolder = await acquirePluginStoreLock(staleFile, { stale: 120_000, update: 60_000 });
  const stalePast = new Date(Date.now() - 120_000);
  fs.utimesSync(`${staleFile}.lock`, stalePast, stalePast);
  const staleTaker = await acquirePluginStoreLock(staleFile, { stale: 2000 });
  assert.equal(await checkPluginStoreLock(staleFile), true, 'a lock whose mtime stopped moving is taken over');
  clearChainRecords();
  await releasePluginStoreLock(staleHolder, 'displaced');
  assert.deepEqual(logs(), [], 'the displaced holder releases without a word');
  await releasePluginStoreLock(staleTaker, 'taker');

  clearChainRecords();
  await releasePluginStoreLock(undefined, 'store');
  assert.deepEqual(logs(), []);
  await releasePluginStoreLock(lockHandle, 'store');
  assert.deepEqual(logs(), [
    'store: lock was no longer held at release (ERELEASED); the locked section may have run without exclusivity',
  ]);
} finally {
  fs.rmSync(lockRoot, { recursive: true, force: true });
}
console.log('W45LockfileCompiled.v1');

// W45-50: the atomic writer from dist — the store's own call shape, the temp file cleaned up, the
// refused publish that raises the source's error with nothing left behind, the cross-device rename
// that falls back to the in-place arm, and the in-place arm a refused staging write is allowed into.
const atomicRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-atomic-compiled-'));
try {
  const atomicFile = path.join(atomicRoot, 'store.json');
  await writeFileAtomically(atomicFile, '{"a":1}\n', 0o600);
  assert.equal(fs.readFileSync(atomicFile, 'utf8'), '{"a":1}\n');
  assert.equal(fs.statSync(atomicFile).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(atomicRoot), ['store.json'], 'the staged file went with the publish');
  await writeFileAtomically(atomicFile, '{"a":2}\n', 0o600);
  assert.equal(fs.readFileSync(atomicFile, 'utf8'), '{"a":2}\n');

  const refusedFile = path.join(atomicRoot, 'refused.json');
  await assert.rejects(writeFileWithAtomicOptions(refusedFile, 'x\n', { beforePublish: () => false }),
    (error) => error.name === 'PublishRefusedError' && error.message === 'beforePublish refused the write; nothing was published');
  assert.equal(fs.existsSync(refusedFile), false);

  const inPlaceFile = path.join(atomicRoot, 'in-place.json');
  fs.writeFileSync(inPlaceFile, 'before\n');
  await writeFileWithAtomicOptions(inPlaceFile, 'after\n', {
    renameFn: async () => { throw Object.assign(new Error('cross-device'), { code: 'EXDEV' }); },
  });
  assert.equal(fs.readFileSync(inPlaceFile, 'utf8'), 'after\n');

  const lockedDir = path.join(atomicRoot, 'read-only');
  fs.mkdirSync(lockedDir);
  const lockedFile = path.join(lockedDir, 'inside.json');
  fs.writeFileSync(lockedFile, 'before\n');
  fs.chmodSync(lockedDir, 0o500);
  try {
    await assert.rejects(writeFileAtomically(lockedFile, 'after\n'), (error) => error.code === 'EACCES');
    await writeFileWithAtomicOptions(lockedFile, 'in-place\n', { inPlaceOnTempCreateRefused: true });
    assert.equal(fs.readFileSync(lockedFile, 'utf8'), 'in-place\n');
  } finally {
    fs.chmodSync(lockedDir, 0o700);
  }
} finally {
  fs.rmSync(atomicRoot, { recursive: true, force: true });
}
console.log('W45AtomicCompiled.v1');

// W45-51: the store's read and carry layer from dist — the candidate list (and both branches of the
// platform-id hook it canonicalizes the id's second half through), the carry of a missing store from
// the plugin's built-in twin with the staged carry file removed, the concurrent carry reported at
// debug, and the failed carry reported at warn with nothing published.
const carryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-store-carry-compiled-'));
bindPluginDataDir(() => carryRoot);
const carryStore = path.join(carryRoot, 'store');
const carryLogs = (id) => chainRecords()
  .filter((record) => record.kind === 'log' && record.message?.includes(`(${id})`))
  .map((record) => `${record.level}: ${record.message}`);
try {
  fs.mkdirSync(carryStore, { recursive: true });
  assert.deepEqual(builtinTwinIds('cc-plugin-tips@builtin'), ['tips@builtin']);
  assert.deepEqual(builtinTwinIds('tips@builtin'), [], 'the twin has no twin of its own');
  assert.deepEqual(builtinTwinIds('cc-plugin-tips@BUILTIN'), [], 'unbound, the hook answers its negative branch');
  bindStoreCarryPlatformIdTable((id) => id === 'builtin');
  assert.deepEqual(builtinTwinIds('cc-plugin-tips@BUILTIN'), ['tips@builtin'], 'bound, the half canonicalizes');
  bindStoreCarryPlatformIdTable(undefined);

  const twin = storeFilePath('tips@builtin');
  const target = storeFilePath('cc-plugin-tips@builtin');
  fs.writeFileSync(twin, '{"carried":true}', 'utf8');
  clearChainRecords();
  assert.equal(await readStoreFile('cc-plugin-tips@builtin', target), '{"carried":true}');
  assert.equal(fs.readFileSync(target, 'utf8'), '{"carried":true}');
  assert.deepEqual(carryLogs('cc-plugin-tips@builtin'), [], 'a quiet carry logs nothing');
  assert.deepEqual(fs.readdirSync(carryStore).filter((name) => name.includes('.carry-')), []);

  clearChainRecords();
  assert.equal(await carryStoreFile('cc-plugin-tips@builtin'), true);
  assert.deepEqual(carryLogs('cc-plugin-tips@builtin'), [
    "debug: $.store (cc-plugin-tips@builtin): tips@builtin's store was carried by another session",
  ]);
  assert.equal(fs.readFileSync(target, 'utf8'), '{"carried":true}', 'the earlier carry is left alone');

  const diffTwin = storeFilePath('diff@builtin');
  const diffTarget = storeFilePath('cc-plugin-diff@builtin');
  fs.writeFileSync(diffTwin, '{not json', 'utf8');
  clearChainRecords();
  assert.equal(await readStoreFile('cc-plugin-diff@builtin', diffTarget), undefined);
  assert.equal(fs.existsSync(diffTarget), false, 'a failed carry publishes nothing');
  assert.equal(carryLogs('cc-plugin-diff@builtin').length, 1);
  assert.equal(carryLogs('cc-plugin-diff@builtin')[0].startsWith('warn: $.store (cc-plugin-diff@builtin): could not carry diff@builtin\'s store: '), true);

  fs.writeFileSync(diffTwin, '{"shape":"array"}', 'utf8');
  assert.equal(await readStoreCandidate('diff@builtin').then((entry) => entry?.[0]), 'diff@builtin');
  assert.equal(await readStoreFile('cc-plugin-diff@builtin', diffTarget), '{"shape":"array"}');
} finally {
  fs.rmSync(carryRoot, { recursive: true, force: true });
}
console.log('W45StoreCarryCompiled.v1');

// W45-52: the store entry and dispatcher from dist — the four table names, a set/get/keys/delete
// round-trip through the store file with its mode and shape, the own-key read, the key limit, the
// check a chain with a handler reaches, the per-id queue, and the backend slot replacing the store.
const entryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-store-entry-compiled-'));
bindPluginDataDir(() => entryRoot);
fs.mkdirSync(path.join(entryRoot, 'store'), { recursive: true });
const entryCaller = { plugin: 'tips', origin: [] };
const entryCall = (event, args, plugin = 'tips') => raiseStoreCall({ event, args, caller: { ...entryCaller, plugin } });
try {
  assert.deepEqual(Object.keys(storeCallTable()), ['store.get', 'store.set', 'store.delete', 'store.keys']);
  assert.equal(checkStoreSet({ key: 'a' }), 'value is not JSON data: undefined');

  assert.deepEqual(await entryCall('store.keys', {}), []);
  await entryCall('store.set', { key: 'a', value: 'first' });
  assert.equal(await entryCall('store.get', { key: 'a' }), 'first');
  assert.deepEqual(await entryCall('store.keys', {}), ['a']);
  assert.equal(await entryCall('store.get', { key: 'toString' }), undefined);
  const entryFile = storeFilePath('tips');
  assert.equal(fs.readFileSync(entryFile, 'utf8'), '{\n  "a": "first"\n}\n');
  assert.equal(fs.statSync(entryFile).mode & 0o777, 0o600);
  await entryCall('store.delete', { key: 'a' });
  assert.equal(fs.readFileSync(entryFile, 'utf8'), '{}\n');

  await assert.rejects(() => entryCall('store.get', { key: 'x'.repeat(257) }),
    /HooksError: tips: \$\.store\.get: the key is 257 characters, over the 256 limit/);

  const entryRemovers = ['store.get', 'store.set', 'store.delete'].map((event) => installChainModule({
    name: `fixture-entry-${event}`,
    tier: 'user',
    hooks: (e) => e === event,
    record: () => ({ name: `fixture-entry-${event}`, tier: 'user', run: async (args, next) => ({ value: await next(args) }) }),
  }));
  try {
    await assert.rejects(() => entryCall('store.get', {}), /HooksError: store\.get: takes a key \(host check\)/);
  } finally {
    for (const remove of entryRemovers) remove();
  }

  await Promise.all([
    entryCall('store.set', { key: 'r1', value: 'one' }, 'mermaid'),
    entryCall('store.set', { key: 'r2', value: 'two' }, 'mermaid'),
  ]);
  assert.deepEqual((await entryCall('store.keys', {}, 'mermaid')).sort(), ['r1', 'r2'], 'both queued writes landed');

  const entryFake = { read: async () => ({ slot: true }), write: async () => {}, lock: async () => undefined };
  setStoreBackend(entryFake);
  try {
    assert.equal(storeBackend(), entryFake);
    assert.equal(await entryCall('store.get', { key: 'slot' }), true, 'the slot holds {slot:true}');
    assert.deepEqual(await storeEntry.read('tips'), {}, 'the store entry still reads the real store (its only key was deleted)');
  } finally {
    setStoreBackend(undefined);
  }
  assert.equal(storeBackend(), storeEntry);
} finally {
  fs.rmSync(entryRoot, { recursive: true, force: true });
}
console.log('W45StoreEntryCompiled.v1');

// W45-53: `settings.read` from dist — the five source names, the check's refusals, the JSON copy the
// body answers with, the file name the store is asked for, and the refusal the seam owns while the
// settings store is unported.
const settingsSeen = [];
bindSettingsStore({
  all: () => ({ theme: 'dark' }),
  one: (source) => { settingsSeen.push(source); return source === 'flagSettings' ? null : { from: source }; },
});
try {
  assert.deepEqual(SETTINGS_SOURCES, {
    user: 'userSettings', project: 'projectSettings', local: 'localSettings',
    flag: 'flagSettings', policy: 'policySettings',
  });
  assert.equal(checkSettingsRead({}), undefined);
  assert.equal(checkSettingsRead({ source: 'bogus' }),
    'takes { source } naming one of user, project, local, flag, policy (got bogus)');
  assert.equal(checkSettingsRead({ source: 1 }),
    'takes { source } naming one of user, project, local, flag, policy (got number)');
  assert.equal(copySettingsValue(undefined), undefined);

  const merged = await readSettings({});
  assert.deepEqual(merged, { theme: 'dark' });
  merged.theme = 'mutated';
  assert.equal((await readSettings({})).theme, 'dark', 'the answer is a copy');
  assert.deepEqual(await readSettings({ source: 'project' }), { from: 'projectSettings' });
  assert.deepEqual(await readSettings({ source: 'flag' }), {}, 'a source the store answers null for is {}');
  assert.deepEqual(settingsSeen, ['projectSettings', 'flagSettings']);
  assert.deepEqual(await raiseSettingsRead({ args: {}, caller: { plugin: 'tips', origin: [] } }), { theme: 'dark' });
} finally {
  bindSettingsStore(undefined);
}
await assert.rejects(async () => readSettings({}), /the settings store is not bound; bindSettingsStore\(\) installs one/);
console.log('W45SettingsReadCompiled.v1');

// W45-54: the settings source → file layer from dist — the file each source resolves to, the
// directory behind it, the names, the managed-settings cache, the ownership gate with its own warn
// text, and the store handle the probes are read through.
const sourceCwdFixture = '/tmp/w45-54-compiled';
assert.deepEqual(SETTINGS_FILE_NAMES, { default: 'settings.json', cowork: 'cowork_settings.json' });
assert.equal(settingsFileName({ cwd: null }), 'settings.json');
assert.equal(settingsFileName({ cwd: null, coworkPlugins: true }), 'cowork_settings.json');
assert.equal(settingsSourceRelativePath('localSettings'), '.claude/settings.local.json');
assert.equal(settingsFilePath('userSettings', { cwd: sourceCwdFixture }),
  path.join(claudeDirectory(), 'settings.json'));
assert.equal(settingsFilePath('projectSettings', { cwd: sourceCwdFixture }),
  path.join(sourceCwdFixture, '.claude/settings.json'));
assert.equal(settingsFilePath('policySettings', { cwd: sourceCwdFixture }), managedSettingsPath());
assert.equal(settingsFilePath('flagSettings', { cwd: sourceCwdFixture }), undefined);
assert.equal(settingsFilePath('projectSettings', { cwd: null }), undefined);
assert.equal(settingsSourceDirectory('policySettings', { cwd: sourceCwdFixture }), sourceCwdFixture);
assert.equal(sourceCwd({ cwd: sourceCwdFixture }), sourceCwdFixture);
assert.throws(() => settingsSourceDirectory('projectSettings', { cwd: null }),
  (error) => error instanceof NoProjectDirectoryError);
resetManagedSettingsCache();
assert.equal(managedSettingsDropInDir(), path.join(managedSettingsDir(), 'managed-settings.d'));
assert.equal(normalizedRealHomeDir(), fs.realpathSync.native(os.homedir()));
assert.equal(typeof sourceFs().lstatSync, 'function');

const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-54-compiled-'));
fs.mkdirSync(path.join(sourceRoot, '.git'));
fs.mkdirSync(path.join(sourceRoot, '.claude'));
try {
  clearChainRecords();
  assert.equal(canonicalRootOwnedByUser(sourceRoot), true);
  assert.deepEqual(chainRecords().filter((record) => record.kind === 'log' && record.level === 'warn'), []);
  assert.equal(localSettingsRoot(sourceCwdFixture, () => sourceRoot), sourceRoot);
  const withoutGit = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-54-compiled-nogit-'));
  try {
    assert.equal(canonicalRootOwnedByUser(withoutGit), false);
    assert.match(
      String(chainRecords().filter((record) => record.kind === 'log' && record.level === 'warn').at(-1)?.message),
      /its ownership could not be verified \(ENOENT: no such file or directory, lstat '/,
    );
  } finally {
    fs.rmSync(withoutGit, { recursive: true, force: true });
  }
  clearChainRecords();
  const probes = new Ht();
  probes.canonicalRootOwnerUids = (() => ({ rootUid: 1, gitEntryUid: 1, claudeEntryUid: 2 }));
  bindLocalStore({ localStoreProbes: probes });
  try {
    assert.equal(canonicalRootOwnedByUser(sourceRoot), false, 'the bound handle answers instead');
    assert.match(
      String(chainRecords().filter((record) => record.kind === 'log' && record.level === 'warn').at(-1)?.message),
      /it \(uid 1\), its \.git entry \(uid 1\), or its \.claude entry \(uid 2\) is not owned by the current user/,
    );
  } finally {
    bindLocalStore(undefined);
  }
  assert.equal(canonicalRootOwnedByUser(sourceRoot), true, 'unbinding restores the source own probe cache');
} finally {
  clearChainRecords();
  fs.rmSync(sourceRoot, { recursive: true, force: true });
}
console.log('W45SettingsSourceCompiled.v1');

// W45-55 in dist: the merge every settings read folds its sources with. The nested-object case is
// the one that matters most — `baseMerge` builds a `new k1e` stack and reads it back with
// `stack.get`/`stack.set`, so a constructor copied without its prototype methods passes nothing
// here.
assert.deepEqual(mergeSettings({ a: { x: 1 }, keep: 1 }, { a: { y: 2 } }), { a: { x: 1, y: 2 }, keep: 1 });
const mergeTarget = { keep: 1 };
assert.equal(mergeSettings(mergeTarget, { added: 2 }), mergeTarget, 'the merge accumulates into the target');
assert.deepEqual(mergeTarget, { keep: 1, added: 2 });
const mergeCyclic = { name: 'root' };
mergeCyclic.self = mergeCyclic;
assert.equal(mergeSettings({}, mergeCyclic).name, 'root', 'a cyclic source terminates');
assert.deepEqual(mergeSettings({ permissions: ['a', 'b'] }, { permissions: ['b', 'c'] }), { permissions: ['a', 'b', 'c'] });
assert.deepEqual(mergeSettings({ fallbackModel: ['a'] }, { fallbackModel: ['b'] }), { fallbackModel: ['b'] });
assert.deepEqual(mergeSettings({ modelPicker: { options: [{ id: 1 }], gone: true } }, { modelPicker: { options: [{ id: 2 }] } }),
  { modelPicker: { options: [{ id: 2 }] } });
assert.deepEqual(mergeSettings({ extraKnownMarketplaces: { m: { a: 1 }, n: { c: 1 } } }, { extraKnownMarketplaces: { m: { b: 2 } } }),
  { extraKnownMarketplaces: { m: { b: 2 }, n: { c: 1 } } });
assert.deepEqual(mergeSettings({}, { a: 1 }, { b: 2 }), { a: 1, b: 2 }, 'several sources, customizer last');
assert.equal(settingsMergeCustomizer('x', 'y', 'permissions'), undefined);
assert.deepEqual(settingsMergeCustomizer(['a'], ['b'], 'fallbackModel'), ['b']);
assert.deepEqual(normalizeModelPicker({ options: [{ a: 1 }, 7] }), { options: [{ a: 1 }, 7] });
const mergeOverride = shallowSettingsOverride({ m: { a: 1, b: 1 } }, { m: { b: 2 } });
assert.deepEqual(mergeOverride, { m: { b: 2 } });
const mergeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-55-compiled-'));
fs.mkdirSync(path.join(mergeRoot, '.git'));
fs.mkdirSync(path.join(mergeRoot, '.claude'));
try {
  assert.equal(localSettingsPath({ cwd: sourceCwdFixture, canonicalGitRoot: () => mergeRoot }),
    path.join(sourceCwdFixture, '.claude/settings.local.json'));
  assert.equal(localSettingsPath({ cwd: sourceCwdFixture }), undefined, 'an unmoved store is not consulted');
} finally {
  fs.rmSync(mergeRoot, { recursive: true, force: true });
}
console.log('W45SettingsMergeCompiled.v1');

// W45-56 in dist: the local settings store the settings readers mutate. The store itself, the
// per-host instance cache, the source diff, and the install verdicts. The pin is asserted last: it is
// write-once per process, so every unpinned arm has to be read before it is set.
assert.equal(normalizeEmptySettings({}), null, 'an empty settings object is null');
assert.equal(normalizeEmptySettings(null), null);
assert.deepEqual(normalizeEmptySettings({ a: 1 }), { a: 1 });
assert.deepEqual(wrapSourceSnapshot({ settings: { a: 1 }, unfiltered: { b: 2 } }), { settings: { a: 1 }, unfiltered: { b: 2 } });
const sourceEntry = (settings) => ({ settings, unfiltered: settings });
assert.deepEqual(
  changedSourceKeys(new Map([['user', sourceEntry({ a: 1 })], ['gone', sourceEntry({ c: 1 })]]),
    new Map([['user', sourceEntry({ a: 1 })], ['added', sourceEntry({ d: 1 })]])),
  ['gone', 'added']);
const storeHostA = { store: 'a' };
const storeHostB = { store: 'b' };
assert.equal(localStore(storeHostA), localStore(storeHostA), 'one store per host');
assert.notEqual(localStore(storeHostA), localStore(storeHostB));
assert.equal(localStore(storeHostA).mergedSettings, null);
assert.ok(localStore(storeHostA).localStoreProbes instanceof Ht, 'the store owns the probe cache the ownership gate reads');
assert.ok(ji() instanceof Object, 'ji answers a store handle');
const storeVerdict = localStore({ store: 'verdict' });
const storeFile = '/tmp/w45-56-compiled.json';
assert.equal(storeVerdict.policyInstallVerdict(storeFile, { a: 1 }, 3), 'install', 'nothing parsed yet');
assert.equal(storeVerdict.seedParsedFile(storeFile, 'userSettings', { a: 1 }, storeVerdict.epoch), true);
assert.equal(storeVerdict.policyInstallVerdict(storeFile, { a: 1 }, 3), 'install');
assert.equal(storeVerdict.policyInstallVerdict(storeFile, { a: 2 }, 3), 'install', 'a change with no walk yet');
assert.equal(storeVerdict.folderListingForPolicyWalk('/tmp/w45-56-console'), undefined);
assert.equal(storeVerdict.policyWalkCount, 0, 'the pin is off, so the walk was not counted');
assert.equal(storeVerdict.primedFolderListing('/tmp/w45-56-console'), undefined, 'and the listing cache is not readable');
const storeUndo = storeVerdict.retainLayer('userSettings', { a: 1 });
assert.equal(storeVerdict.retained.size, 1);
storeUndo();
assert.equal(storeVerdict.retained.size, 0);
assert.equal(isPolicyPinned(), false);
assert.equal(setPolicyPin(true), 'pinned');
assert.equal(setPolicyPin(true), 'unchanged');
assert.equal(setPolicyPin(false), 'conflict');
assert.equal(isPolicyPinned(), true, 'a conflict leaves the pin set');
assert.equal(storeVerdict.folderListingForPolicyWalk('/tmp/w45-56-console'), undefined);
assert.equal(storeVerdict.policyWalkCount, 1, 'pinned, the walk is counted');
assert.equal(storeVerdict.policyInstallVerdict(storeFile, { a: 2 }, -1), 'raced');
console.log('W45LocalStoreCompiled.v1');

// W45-57 in dist: the `$` table's ui.notify entry. The floor is the copied trio from the ui copy, so
// this reads it out of the built files the way the dispatcher would: the check, the stamp, the run over
// the four channel answers, and the committed gate that answers no-surface without asking the session.
assert.ok(Object.keys(uiCallTable()).includes('ui.notify'), 'the table binds the notify name');
assert.equal(Object.keys(uiCallTable()['ui.notify']).sort().join(','), 'check,run,stamp');
assert.equal(Dzo({ text: 'hi' }), undefined);
assert.equal(Dzo({ text: 'hi', title: 7 }), 'title is a string, when given');
assert.equal(Dzo({}), 'takes a string text');
const notifyCaller = caller('fixture-notify');
assert.deepEqual(Fzo({ text: 'hi' }, notifyCaller), { text: 'hi', title: 'fixture-notify' });
{
  const unbind = bindPluginSession({ status: () => void 0, toast: () => void 0, notify: async () => 'kitty' });
  try {
    assert.deepEqual(await Nzo({ text: 'hi' }, notifyCaller), { isSent: true, channel: 'kitty' });
    assert.deepEqual(await raiseUiCall({ event: 'ui.notify', args: { text: 'hi' }, caller: notifyCaller }),
      { isSent: true, channel: 'kitty' }, 'the seam raises the entry');
  } finally { unbind(); }
  const disabled = bindPluginSession({ status: () => void 0, toast: () => void 0, notify: async () => 'disabled' });
  try { assert.deepEqual(await Nzo({ text: 'hi' }, notifyCaller), { isSent: false, reason: 'disabled' }); }
  finally { disabled(); }
  const broken = bindPluginSession({ status: () => void 0, toast: () => void 0, notify: async () => 'error' });
  try {
    await assert.rejects(() => Nzo({ text: 'hi' }, notifyCaller), (error) => {
      assert.equal(error.message, 'fixture-notify: $.ui.notify: the channel\'s write failed');
      return true;
    });
  } finally { broken(); }
}
assert.deepEqual(await Nzo({ text: 'hi' }, notifyCaller), { isSent: false, reason: 'no-surface' }, 'unbound');
let notifyCalls = 0;
{
  const unbind = bindPluginSession({ status: () => void 0, toast: () => void 0, notify: async () => (notifyCalls++, 'kitty') });
  try {
    notifyCommitted.committed = true;
    assert.equal(notifyIsCommitted(), true);
    assert.deepEqual(await Nzo({ text: 'hi' }, notifyCaller), { isSent: false, reason: 'no-surface' });
    assert.equal(notifyCalls, 0, 'the committed surface is never asked');
  } finally { notifyCommitted.committed = false; unbind(); }
}
console.log('W45UiNotifyCompiled.v1');

// W45-58 in dist: the `$` table's ui.blit entry. The two runs read the host registries, so this drives
// them the way the site mount does — a row keyed by the NUL-joined site key, one raster or image under
// it — and reads back the paint, the swap, the denial texts and the per-second window.
assert.equal(Object.keys(uiCallTable()).sort().join(','),
  'ui.blit,ui.log,ui.notify,ui.selection,ui.status,ui.toast', 'the table binds all six ui names');
assert.equal(Object.keys(uiCallTable()['ui.blit']).sort().join(','), 'check,run', 'no stamp on this entry');
{
  const siteKey = (plugin, requestId, key) => [plugin, requestId, key].join(String.fromCharCode(0));
  const cells = Buffer.alloc(12);
  cells.writeUInt32LE(65, 0);
  const oneCell = cells.toString('base64');
  assert.deepEqual(decodeBlitCells(oneCell, 1, 1).words.join(','), '65,0,0', 'the decoder reads the three words of a cell');
  assert.equal(decodeBlitCells(oneCell, 1, 1).problem, undefined);
  assert.equal(decodeBlitCells('AA', 1, 1).problem, 'cells must be the base64 of 1 cells of 12 bytes (16 characters for 1x1)');
  const painted = [];
  const rows = mountedRasterSites();
  rows.set(siteKey('fixture-blit', 'req', 'raster'), {
    rasters: new Set([{ requestId: 'req', key: 'raster', plugin: 'fixture-blit', columns: 1, rows: 1, paint: (words) => painted.push([...words]) }]),
    windowStart: Date.now(),
    blits: 0,
  });
  const blitCaller = caller('fixture-blit');
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'req', key: 'raster', cells: oneCell }, caller: blitCaller }), {});
  assert.deepEqual(painted, [[65, 0, 0]], 'the blit painted the mounted raster');
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'req', key: 'gone', cells: oneCell }, caller: blitCaller }),
    { deny: 'no Raster of its own is mounted under key "gone" in req' });
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'req', key: 'raster', cells: oneCell, columns: 2, rows: 2 }, caller: blitCaller }),
    { deny: 'the mounted Raster is 1x1, not 2x2; a resize is a redraw (ui.invalidate)' });
  const blitRow = rows.get(siteKey('fixture-blit', 'req', 'raster'));
  blitRow.blits = BLITS_PER_SECOND;
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'req', key: 'raster', cells: oneCell }, caller: blitCaller }),
    { deny: `more than ${BLITS_PER_SECOND} blits a second; the surface paints at its frame rate, so one blit a frame is all that shows` },
    'the per-second window refuses the 121st blit');
  const swapSource = { png: 'AA' };
  assert.equal(validateImageSource(swapSource), 'source.png must be standard padded base64');
  let swapped = null;
  const images = mountedImageSites();
  images.set(siteKey('fixture-blit', 'req', 'image'), {
    images: new Set([{ requestId: 'req', key: 'image', plugin: 'fixture-blit', columns: 1, rows: 1, swap: (source) => (swapped = source, void 0) }]),
    windowStart: Date.now(),
    blits: 0,
  });
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'req', key: 'image', source: { shm: '/fixture', format: 'rgb', width: 1, height: 1 } }, caller: blitCaller }), {});
  assert.deepEqual(swapped, { shm: '/fixture', format: 'rgb', width: 1, height: 1 }, 'the Image path swapped the source it was handed');
  images.clear();
  rows.clear();
}
console.log('W45UiBlitCompiled.v1');

// W45-59: the mount side — the register helper and the two writers that fill the registries the ui.blit
// entry reads, driven through the product seam a site calls.
{
  const siteKey = (plugin, requestId, key) => [plugin, requestId, key].join(String.fromCharCode(0));
  const mountCells = Buffer.alloc(12);
  mountCells.writeUInt32LE(65, 0);
  const mountCell = mountCells.toString('base64');
  const sites = new Map();
  let built = 0;
  const mountsOf = (row) => row.mounts;
  const register = (mount, key) => registerSiteMount({ sites, siteKey: key, mount, mountsOf, freshSite: () => (built += 1, { mounts: new Set(), windowStart: 0, blits: 0 }) });
  const first = { id: 'first' };
  const second = { id: 'second' };
  const offFirst = register(first, 'mount-key');
  const row = sites.get('mount-key');
  assert.deepEqual([...row.mounts], [first], 'the first mount created the row');
  const offSecond = register(second, 'mount-key');
  assert.equal(sites.get('mount-key'), row, 'the second mount reused the row object');
  assert.equal(built, 1, 'freshSite ran once for that key');
  offFirst();
  assert.deepEqual([...sites.keys()], ['mount-key'], 'the key stays while a mount is left');
  offSecond();
  assert.deepEqual([...sites.keys()], [], 'the last unregister took the key');
  const offGuard = register(first, 'guard-key');
  sites.set('guard-key', { mounts: new Set(['someone else']), windowStart: 0, blits: 0 });
  offGuard();
  assert.deepEqual([...sites.get('guard-key').mounts], ['someone else'], 'a row the map no longer holds survived');

  const mountRows = mountedRasterSites();
  const mountImageRows = mountedImageSites();
  const mountPainted = [];
  const mountElement = { requestId: 'mreq', key: 'mkey', plugin: 'fixture-mount', columns: 1, rows: 1, paint: (words) => mountPainted.push([...words]) };
  const offMount = mountRaster(mountElement);
  const mountRow = mountRows.get(siteKey('fixture-mount', 'mreq', 'mkey'));
  assert.equal([...mountRow.rasters][0], mountElement, 'the raster row holds the very element');
  assert.equal(mountRow.windowStart, 0);
  assert.equal(mountRow.blits, 0);
  const mountCaller = caller('fixture-mount');
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'mreq', key: 'mkey', cells: mountCell }, caller: mountCaller }), {},
    'the mounted raster is what the blit entry paints');
  assert.deepEqual(mountPainted, [[65, 0, 0]]);
  assert.equal(mountRow.blits, 1);
  offMount();
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'mreq', key: 'mkey', cells: mountCell }, caller: mountCaller }),
    { deny: 'no Raster of its own is mounted under key "mkey" in mreq' }, 'unmounting ended the blit');
  assert.equal(mountRows.has(siteKey('fixture-mount', 'mreq', 'mkey')), false, 'the unregister took the key with it');

  const mountSwap = () => void 0;
  const builtImage = withSwap({ requestId: 'mreq', key: 'ikey', plugin: 'fixture-mount', columns: 2, rows: 2 }, { columns: 4 }, mountSwap);
  assert.equal(builtImage.columns, 4, 'the props won over the element they spread');
  assert.equal(builtImage.rows, 2, 'the element fields the props did not name survived');
  assert.equal(builtImage.swap, mountSwap);
  let mountSwapped = null;
  const offImage = mountImage({ requestId: 'mreq', key: 'ikey', plugin: 'fixture-mount', columns: 1, rows: 1, swap: (source) => (mountSwapped = source, void 0) });
  const imageMountRow = mountImageRows.get(siteKey('fixture-mount', 'mreq', 'ikey'));
  assert.deepEqual([...imageMountRow.images].map((element) => element.key), ['ikey']);
  assert.equal(imageMountRow.windowStart, 0);
  const mountSource = { shm: '/fixture-mount', format: 'rgb', width: 1, height: 1 };
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'mreq', key: 'ikey', source: mountSource }, caller: mountCaller }), {});
  assert.deepEqual(mountSwapped, mountSource, 'the mounted Image swapped the source it was handed');
  offImage();
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'mreq', key: 'ikey', source: mountSource }, caller: mountCaller }),
    { deny: 'no Image of its own is mounted under key "ikey" in mreq' });
}
console.log('W45RasterMountCompiled.v1');

// W45-60: the raster cell encoder and the admission bucket a surface paints its frames through.
{
  assert.deepEqual(freshRasterAdmission(), { tokens: RASTER_ADMISSION_CAPACITY, refilledAt: 0 });
  it().rasterAdmission = undefined;
  const admission = rasterAdmission();
  assert.equal(it().rasterAdmission, admission, 'the accessor wrote the row into the registry');
  assert.equal(rasterAdmission(), admission);
  assert.equal(DEFAULT_RASTER_COLUMNS, 512);
  assert.equal(DEFAULT_RASTER_ROWS, 256);
  assert.equal(DEFAULT_CHANNEL, 32768);
  assert.equal(CELL_WORDS.width, 8);

  const spent = { tokens: RASTER_ADMISSION_CAPACITY, refilledAt: 0 };
  assert.equal(admitRasterFrame(spent, 0, 0), true);
  assert.equal(spent.tokens, RASTER_ADMISSION_CAPACITY - 1, 'one token per admitted frame');
  const reserved = { tokens: RASTER_ADMISSION_CAPACITY, refilledAt: 0 };
  assert.equal(admitRasterFrame(reserved, 0, 1024), true, 'a cost below the tokens is admitted');
  assert.equal(reserved.tokens, RASTER_ADMISSION_CAPACITY - 1, 'and still costs one token, not the cost');
  const exact = { tokens: RASTER_ADMISSION_CAPACITY, refilledAt: 0 };
  assert.equal(admitRasterFrame(exact, 0, RASTER_ADMISSION_CAPACITY), false, 'a reserve that empties the row is refused');
  assert.equal(exact.tokens, RASTER_ADMISSION_CAPACITY, 'a refused frame spends nothing');
  const refilled = { tokens: 0, refilledAt: 0 };
  assert.equal(admitRasterFrame(refilled, 1000, 0), true, 'a second refills the row at the rate');
  assert.equal(refilled.tokens, 159);

  const encoded = new Uint32Array(CELL_WORDS.width);
  encodeCell(encoded, 0, 0x1234 | (0xabcd << 16));
  assert.deepEqual([...encoded], [0, 2, 3, 4, 0, 11, 12, 13], 'the cell is the two packed halves');
  assert.equal(foregroundHalf(0x1234 | (0xabcd << 16)), 0x1234);
  assert.equal(backgroundHalf(0x1234 | (0xabcd << 16)), 0xabcd);
  const marked = new Uint32Array(CELL_WORDS.width);
  encodeCell(marked, 0, DEFAULT_CHANNEL);
  assert.equal(marked[CELL_WORDS.foregroundDefault], 1, 'the sentinel marks the foreground default');

  assert.equal(validateDefaultRasterSize(512, 256), undefined);
  assert.equal(validateDefaultRasterSize(513, 256), 'columns must be a whole number from 1 to 512');
  assert.equal(validateDefaultRasterSize(512, 257), 'rows must be a whole number from 1 to 256');
  assert.equal(validateRasterSize(0, 0, { columns: 512, rows: 256 }), 'columns must be a whole number from 1 to 512',
    'the first bad field is the one reported');
}
console.log('W45RasterCellsCompiled.v1');

// W45-61: the surface engine — the pass that admits a frame's colours and answers their escapes.
{
  assert.equal(CSI, '\u001b[');
  assert.equal(BELL, '\u0007');
  assert.equal(csi(), '\u001b[');
  assert.equal(csi(38, 2, 255, 0, 0, 'm'), '\u001b[38;2;255;0;0m');
  assert.equal(csi(1, 2, 3), '\u001b[1;23', 'the last argument is appended as it stands');
  assert.equal(toPackedColour(0xff0000), 3840);
  assert.equal(toPackedColour(0x1000000), 32768, 'the sentinel is the default marker');
  assert.equal(packColourPair(0xff0000, 0x0000ff), 986880);
  assert.equal(packColourPair(0x1000000, 0x1000000), -2147450880, 'two markers pack to a negative int32');
  assert.equal(resetSgr(), '\u001b[39m\u001b[49m');
  assert.equal(SLOT_CAPACITY, 1024);
  assert.equal(REUSE_COST, 1024);
  assert.equal(EVALUATION_BUDGET, 131072);
  const state = freshSurfaceState();
  assert.equal(state.table.length, SLOT_CAPACITY * CELL_WORDS.width);
  assert.equal(state.lastSgr, resetSgr());
  encodeCell(state.table, 1, packColourPair(0x00ff00, 0x000000));
  encodeCell(state.probe, 0, packColourPair(0x00ff00, 0x000000));
  assert.equal(nearestSlot(state.table, 3, state.probe), 1, 'the matcher answered the green slot');

  const redOnBlack = packColourPair(0xff0000, 0x000000);
  const greenOnBlack = packColourPair(0x00ff00, 0x000000);
  it().rasterAdmission = undefined;
  const surface = createRasterSurface(() => 0, rasterAdmission());
  assert.deepEqual([surface.size(), surface.standing()], [0, 'complete']);
  surface.beginPaint(new Set([redOnBlack, greenOnBlack]));
  assert.deepEqual([surface.size(), surface.standing()], [2, 'complete']);
  surface.beginPaint(new Set([redOnBlack, greenOnBlack]));
  assert.equal(surface.size(), 2, 'a colour the surface holds is not admitted twice');
  assert.equal(surface.sgrOf(redOnBlack), '\u001b[38;2;255;0;0m\u001b[48;2;0;0;0m');
  assert.equal(surface.sgrOf(greenOnBlack), '\u001b[38;2;0;255;0m\u001b[48;2;0;0;0m', 'a held colour answers its own escape');
  assert.equal(surface.sgrOf(packColourPair(0x0000ff, 0x000000)), '\u001b[38;2;255;0;0m\u001b[48;2;0;0;0m',
    'a colour the surface does not hold takes the escape of the slot it matched, and the tie goes to the first');
  assert.equal(renderRows([65, 0xff0000, 0x0000ff, 66, 0xff0000, 0x0000ff], { columns: 2, rows: 1 }, surface),
    '\u001b[38;2;255;0;0m\u001b[48;2;0;0;255mAB', 'one run of two cells takes one escape');

  it().rasterAdmission = { tokens: 0, refilledAt: 0 };
  const starved = createRasterSurface(() => 0, rasterAdmission());
  starved.beginPaint(new Set([redOnBlack]));
  assert.deepEqual([starved.size(), starved.standing()], [0, 'waiting'], 'a starved paint places nothing');

  it().rasterAdmission = undefined;
  const budgeted = createRasterSurface(() => 0, rasterAdmission());
  budgeted.beginPaint(new Set([redOnBlack]));
  let flipped = -1;
  for (let index = 0; index <= EVALUATION_BUDGET; index += 1) {
    budgeted.sgrOf(0x1000 + index);
    if (budgeted.standing() !== 'complete') { flipped = index; break; }
  }
  assert.equal(flipped, EVALUATION_BUDGET, 'the matcher stops at the evaluation budget and the paint reports it');
  it().rasterAdmission = undefined;
}
console.log('W45RasterSurfaceCompiled.v1');

// W45-62: the raster leaf problems — the two checks a Raster or an Image site is admitted by, and the
// string, size and stamp checks they share.
{
  assert.equal(KEY_LABEL_LIMIT, 40);
  assert.deepEqual(RASTER_SITE_FIELDS, ['key', 'columns', 'rows', 'cells']);
  assert.equal(labelOf('k'.repeat(41)), `${'k'.repeat(40)}...`, 'a label is cut past the limit');
  assert.equal(labelOf('a\tb'), 'a?b', 'what the scrubber matches becomes a question mark');
  assert.equal(allowedKeys({ key: 'k' }, ['key']), true);
  assert.equal(allowedKeys({ key: 'k', hover: 1 }, ['key']), false);
  assert.equal(isChainStamped({ plugin: 'p' }), true);
  assert.equal(isChainStamped({ plugin: '' }), false);
  assert.equal(checkString('key', 'a\x1bb'), 'key holds a control character');
  assert.equal(checkString('key', 'a\tb'), undefined, 'the pattern is the test, not the sentence it answers with');
  assert.equal(checkString('key', 'k'.repeat(10000)), undefined, 'the cap itself is admitted');
  assert.equal(checkString('key', 'k'.repeat(10001)), 'key longer than 10000 characters');
  assert.equal(firstFieldProblem(['a', 'b'], { a: 1, b: 2 }), 'a must be a string', 'the list order decides');
  assert.equal(imageSizeProblem(255, 255), undefined);
  assert.equal(imageSizeProblem(256, 1), `columns must be a whole number from 1 to ${IMAGE_COLUMNS}`);

  const cell = (codePoint) => {
    const bytes = Buffer.alloc(12);
    bytes.writeUInt32LE(codePoint, 0);
    bytes.writeUInt32LE(32768, 4);
    bytes.writeUInt32LE(32768, 8);
    return bytes.toString('base64');
  };
  const be = (value) => [value >>> 24 & 255, value >>> 16 & 255, value >>> 8 & 255, value & 255];
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...be(13), ...[...'IHDR'].map((character) => character.charCodeAt(0)), ...be(1), ...be(1), 8, 6, 0, 0, 0, 0, 0, 0, 0,
  ]).toString('base64');

  assert.deepEqual(pickRasterProps({ key: 'k', columns: 1, rows: 1, cells: 'x' }), { key: 'k', columns: 1, rows: 1, cells: 'x' });
  assert.equal(pickRasterProps({ key: 'k', hover: 1 }), undefined, 'a stray field is not picked');
  const frame = { key: 'k', columns: 1, rows: 1, cells: cell(0x41) };
  assert.equal(rasterLeafProblem({ props: frame, raster: { plugin: 'p' } }), undefined, 'a Raster is admitted');
  assert.equal(rasterLeafProblem({ props: { ...frame, hover: 1 }, raster: { plugin: 'p' } }),
    'Raster props must be { key, columns, rows, cells }, key a non-empty string, and nothing else (no hover or onPress yet)');
  assert.equal(rasterLeafProblem({ props: frame, children: 'x', raster: { plugin: 'p' } }), 'Raster takes no children');
  assert.equal(rasterLeafProblem({ props: frame, raster: {} }), 'Raster "k" is not stamped by a plugin of this chain');

  const imageProps = { source: { png }, alt: 'a', columns: 1, rows: 1, key: 'k' };
  assert.equal(imageLeafProblem({ props: imageProps, image: { plugin: 'p' } }), undefined, 'an Image is admitted');
  assert.equal(imageLeafProblem({ props: { ...imageProps, hover: 1 }, image: { plugin: 'p' } }),
    'Image prop "hover" is not allowed (no hover or onPress; a press goes on an enclosing Button)',
    'an Image names the leftover field it found');
  assert.equal(imageLeafProblem({ props: { ...imageProps, columns: 300 }, image: { plugin: 'p' } }),
    `Image "k" columns must be a whole number from 1 to ${IMAGE_COLUMNS}`,
    'the leaf names itself by its key from the alt check onward');
  assert.equal(imageLeafProblem({ props: { ...imageProps, alt: 1 }, image: { plugin: 'p' } }),
    'Image alt must be a string', 'and the four type sentences before that are bare');
}
console.log('W45RasterSitesCompiled.v1');

// W45-63: the site leaves whose checks need nothing but what is already carried — Code, Input, Select
// with its option check, and Svg — and the predicates and limits they share.
{
  assert.equal(CODE_MAX_START_LINE, 1e9);
  assert.equal(SVG_PIXEL_LIMIT, 4096);
  assert.equal(SVG_SOURCE_LIMIT, 131072);
  assert.equal(SELECT_MAX_OPTIONS, 64);
  assert.deepEqual(INPUT_FIELDS, ['label', 'placeholder', 'value', 'submitLabel']);
  assert.equal(checkAutoFocus(true), undefined);
  assert.equal(checkAutoFocus(false), 'autoFocus is true or absent', 'a false is answered, not ignored');
  assert.equal(checkHoverKey('a\x1bb'), 'Box "a?b" key holds a control character; it is dropped and names no hover scope');
  assert.equal(checkPress({ plugin: 'p', handle: 1 }), undefined);
  assert.equal(checkPress({ plugin: 'p', handle: 1.5 }), 'is not held by a plugin of this chain');
  assert.equal(isNonBlankString('  '), false);
  assert.equal(isPixelSide(undefined), true, 'a side that is not given is left to the default');
  assert.equal(isPixelSide(1.5), true, 'the check wants finite and positive, not whole');
  assert.equal(isPixelSide(4097), false);

  const seen = new Set();
  assert.equal(optionProblem({ value: 'a' }, seen), undefined);
  assert.equal(optionProblem({ value: 'a' }, seen), 'option "a" is listed twice; values are unique');

  const press = { plugin: 'p', handle: 1 };
  assert.equal(codeLeafProblem({ props: { source: 'x', language: 'ts', startLine: 1, format: 'diff', wrap: 'wrap' } }), undefined);
  assert.equal(codeLeafProblem({ props: { source: 'x', hover: 1 } }), 'Code prop "hover" is not allowed', 'a Code block names the stray prop');
  assert.equal(codeLeafProblem({ props: { source: 'x', startLine: CODE_MAX_START_LINE + 1 } }),
    `Code startLine is at most ${CODE_MAX_START_LINE}`);

  assert.equal(inputLeafProblem({ props: { key: 'k', label: 'L', autoFocus: true }, press }), undefined);
  assert.equal(inputLeafProblem({ props: { key: 'k', hover: 1 } }),
    'Input props must be { key } and any of label, placeholder, value, submitLabel, autoFocus',
    'the Input sweeps its own key list and names no field');
  assert.equal(inputLeafProblem({ props: { key: 'k' }, press, children: 'x' }), 'Input "k" takes no children');

  assert.equal(selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }, { value: 'b' }] }, press }), undefined);
  assert.equal(selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }, { value: 'a' }] }, press }),
    'Select "k" option "a" is listed twice; values are unique', 'the Set is threaded through the options');

  assert.equal(svgLeafProblem({ props: { source: 'x', alt: 'a', width: 10, height: 20 } }), undefined);
  assert.equal(svgLeafProblem({ props: { source: 'x', alt: 'a', hover: 1 } }), 'Svg prop "hover" is not allowed');
  assert.equal(svgLeafProblem({ props: { source: 'x', alt: 'a', height: 0 } }),
    `Svg width and height are pixels, at most ${SVG_PIXEL_LIMIT}`);
}
console.log('W45SiteLeavesCompiled.v1');

// W45-64: the style-prop validators a plugin's props are measured against, and the value budget the
// describer walks a prop value with.
{
  assert.equal(NUMBER_TOLERANCE, 1e4);
  assert.equal(VALUE_CHAR_LIMIT, 1e5);
  assert.equal(VALUE_DEPTH_LIMIT, 32);
  assert.equal(VALUE_NODE_LIMIT, 20000);
  assert.equal(MAX_LIST_LENGTH, 4294967295);
  assert.equal(TEXT_STYLE_PROPS.size, 7);
  assert.equal(COLOR_PROPS.size, 3);
  assert.equal(SPACING_PROPS.size, 19);
  assert.deepEqual([...SIDE_PROPS], ['top', 'left', 'right', 'bottom']);
  assert.deepEqual([...SIZE_PROPS], ['width', 'height', 'minWidth', 'minHeight']);
  assert.equal(PROP_RULES.borderStyle, BORDER_PROPS, 'borderStyle is the border names themselves');
  assert.equal(Object.keys(PROP_RULES).length, 10);

  assert.equal(propProblem('flexDirection', 'row'), undefined);
  assert.equal(propProblem('flexDirection', 'nope'), 'must be one of row, column, row-reverse, column-reverse');
  assert.equal(propProblem('width', '50%'), undefined);
  assert.equal(propProblem('width', '1000%'), 'must be a number or a percentage');
  assert.equal(propProblem('width', -1), `must be a finite number between 0 and ${NUMBER_TOLERANCE}`);
  assert.equal(propProblem('gap', -1), undefined);
  assert.equal(propProblem('top', 1.5), `must be an integer within ${NUMBER_TOLERANCE} (character cells)`);
  assert.equal(propProblem('color', '#ff00ff'), undefined);
  assert.equal(propProblem('borderColor', 1), 'must be a color (a theme key, a name, or hex)');
  assert.equal(propProblem('bold', 1), 'must be a boolean');
  assert.equal(propProblem('key', 1), 'has no value rule', 'a prop with no style rule says so');

  assert.equal(shortDescription(null), 'null');
  assert.equal(shortDescription([]), 'an array');
  assert.equal(shortDescription(undefined), 'a undefined');
  assert.equal(listLength({ length: '12' }), 12);
  assert.equal(listLength({ length: -1 }), 0);
  assert.throws(() => listLength({ length: MAX_LIST_LENGTH + 1 }), /got 4294967296/);
  assert.throws(() => listLength({ length: 10n }), /got a bigint/);

  assert.equal(budgetProblem(freshWalkBudget()), undefined);
  assert.equal(budgetProblem({ ...freshWalkBudget(), nodes: VALUE_NODE_LIMIT + 1 }), `holds more than ${VALUE_NODE_LIMIT} values`);
  assert.deepEqual([false, 'ab', null, []].map(scalarCost), [5, 4, 5, undefined]);
  assert.deepEqual([...valueEntries({ ab: 1 })], [[6, 1]]);

  assert.equal(valueProblem({ a: [1, { b: 'c' }], d: null }), undefined);
  assert.equal(valueProblem(undefined), 'holds undefined (an array hole, a missing value)');
  assert.equal(valueProblem(() => {}), 'holds a function');
  assert.equal(valueProblem(NaN), 'holds NaN');
  assert.equal(valueProblem(new Date(0)), 'holds an object that is not plain (a class instance)');
  assert.equal(valueProblem(Object.create(null)), undefined, 'a null prototype is plain');
  assert.equal(valueProblem('x'.repeat(99999)), `serializes to more than ${VALUE_CHAR_LIMIT} characters`);
  assert.equal(valueProblem(new Array(20000).fill(0)), `holds more than ${VALUE_NODE_LIMIT} values`);
  const loop = [];
  loop.push(loop);
  assert.equal(valueProblem(loop), 'holds a cycle');
  assert.equal(valueProblem({ a: { s: 1 }, b: { s: 1 } }), undefined);
  let deep = 1;
  for (let index = 0; index <= VALUE_DEPTH_LIMIT; index += 1) deep = [deep];
  assert.equal(valueProblem(deep), `nests deeper than ${VALUE_DEPTH_LIMIT}`);
  const budget = freshWalkBudget();
  assert.equal(walkProblem([1], 0, budget), undefined);
  assert.equal(budget.nodes, 2);
}
console.log('W45StylePropsCompiled.v1');

// W45-65: the last three site leaves whose dependencies are all inside the product — the Client, the
// Markdown with its pressable-link list, and the Link with the href encoder beside it.
{
  assert.equal(LINK_HREF_LIMIT, 2048);
  assert.equal(PRESSABLE_LINK_LIMIT, 256);
  const stamp = { plugin: 'p', handle: 1 };

  assert.equal(clientLeafProblem({ props: { key: 'k', module: 'm' }, client: stamp }), undefined);
  assert.equal(clientLeafProblem({ props: { key: 'k', module: 'm' }, client: { plugin: 'p' } }), undefined,
    'a stamp is a name and nothing else');
  assert.equal(clientLeafProblem({ props: { key: 'k', module: 'm' } }),
    'Client "k" is not stamped by a plugin of this chain');
  assert.equal(clientLeafProblem({ props: { key: 'k', module: 'm', width: 'x' }, client: stamp }),
    'Client "k" width must be a number or a percentage');
  assert.equal(clientLeafProblem({ props: { key: 'k', module: 'm', props: { a: undefined } }, client: stamp }),
    'Client "k" props holds undefined (an array hole, a missing value)');
  assert.equal(clientLeafProblem({ props: { key: 'k', module: 'm' }, client: stamp, children: 'x' }),
    'Client "k" takes no children');
  assert.equal(clientLeafProblem({ props: { key: 'k' } }),
    'Client props must be { key, module }, both non-empty strings, and any of props, width, height, flexGrow');

  assert.equal(linkLeafProblem({ props: { href: 'x'.repeat(LINK_HREF_LIMIT) } }), undefined);
  assert.equal(linkLeafProblem({ props: { href: 'x'.repeat(LINK_HREF_LIMIT + 1) } }),
    `Link href longer than ${LINK_HREF_LIMIT} characters as written`);
  assert.equal(linkLeafProblem({ props: { href: 'é'.repeat(LINK_HREF_LIMIT / 2) } }),
    `Link href longer than ${LINK_HREF_LIMIT} characters as written`, 'the encoded length is measured too');
  assert.equal(linkLeafProblem({ props: { href: 1 } }), undefined, 'an href that is not a string is not refused here');
  assert.equal(linkLeafProblem({ props: { href: 'https://a', label: '  ' } }),
    'Link label is blank (leave it out to draw the URL)');
  assert.equal(linkLeafProblem({ props: { href: 'https://a', extra: 1 } }), 'Link prop "extra" is not allowed');
  assert.equal(encodeHref('a b'), 'a b', 'the range starts at a space');
  assert.equal(encodeHref('a\nb'), 'a%0Ab');
  assert.equal(encodeHref('\uD800'), '%EF%BF%BD', 'a lone surrogate is repaired before it is encoded');

  assert.equal(pressableLinksProblem(undefined), undefined);
  assert.equal(pressableLinksProblem('x'), 'pressableLinks is a string, not a list of hrefs');
  assert.equal(pressableLinksProblem(['é'.repeat(LINK_HREF_LIMIT / 2)]), undefined,
    'measured: this list measures an href as written only, unlike the Link\'s own check');
  assert.equal(pressableLinksProblem(new Array(PRESSABLE_LINK_LIMIT + 1).fill('a')),
    `pressableLinks names more than ${PRESSABLE_LINK_LIMIT} links`);

  assert.equal(markdownLeafProblem({ props: { key: 'k', text: 't' }, press: stamp }), undefined);
  assert.equal(markdownLeafProblem({ props: { key: 'k', text: 't', pressableLinks: ['https://a'] }, press: stamp }),
    undefined);
  assert.equal(markdownLeafProblem({ props: { text: 't' }, press: stamp }),
    'Markdown answers its links (onLinkPress) but has no key, its address', 'a press needs a key');
  assert.equal(markdownLeafProblem({ props: { text: 't', pressableLinks: ['https://a'] } }),
    'Markdown names pressableLinks but answers no press (onLinkPress)');
  assert.equal(markdownLeafProblem({ props: { key: 'k', text: 't', pressableLinks: [1] }, press: stamp }),
    'Markdown "k" pressableLinks holds a number, not an href');
  assert.equal(markdownLeafProblem({ props: { key: 'k', text: 't' }, children: 'x' }), 'Markdown takes no children');
  assert.equal(markdownLeafProblem({ props: { key: 1, text: 't' } }), 'Markdown key "1" is not a usable address');
}
console.log('W45ClientMarkdownLinkCompiled.v1');

// W45-66: the Button — the last leaf of the site table — and the keybinding tables its two action
// checks read: the default binding sets, the 174 action names, the seven reserved keys, and the
// normaliser that decides what a key even is.
{
  const platform = String(KEY_PLATFORM);
  assert.ok(platform === process.platform, `the defaults were computed for this platform: ${platform}`);
  assert.equal(KNOWN_ACTIONS.size, 174, 'every action name the engine knows');
  assert.equal(DEFAULT_BINDINGS.length, 27, 'the contexts it starts from');
  assert.equal(DEFAULT_BINDINGS[0].context, 'Global');
  assert.equal(RESERVED_KEYS.length, 7, 'the keys that cannot be rebound');
  assert.deepEqual(RESERVED_KEYS.map((entry) => entry.key),
    ['ctrl+c', 'ctrl+d', 'ctrl+m', 'ctrl+[', 'ctrl+i', 'ctrl+h', 'capslock']);

  assert.equal(knownAction('app:cycleDiffBase'), true);
  assert.equal(knownAction('plugin:toggle'), true);
  assert.equal(knownAction('nope'), false);
  assert.equal(knownAction(1), false);
  assert.equal(engineOnlyAction('app:interrupt'), true);
  assert.equal(engineOnlyAction('app:exit'), true);
  assert.equal(engineOnlyAction('app:cycleDiffBase'), false, 'a reboundable action is not engine-only');
  assert.equal(engineOnlyAction('nope'), false);
  assert.equal(normalizeKey(' '), 'space');
  assert.equal(normalizeKey('Ctrl+Shift+B'), 'ctrl+shift+b');
  assert.equal(normalizeKey('shift+ctrl+b'), 'ctrl+shift+b', 'the modifiers are sorted');
  assert.equal(normalizeKey('meta+up'), 'alt+up', 'the spellings of alt fold together');
  assert.equal(normalizeKey('caps-lock'), 'capslock');

  const press = { plugin: 'p', handle: 1 };
  const button = (props, extra = {}) => buttonLeafProblem({ props, press, ...extra });
  assert.equal(button({ key: 'k', label: 'L' }), undefined);
  assert.equal(button({ key: 'k', label: 'L', action: 'app:cycleDiffBase', hotkey: 'a' }), undefined);
  assert.equal(buttonLeafProblem({ props: { key: 'k', label: 'L' } }),
    'Button "k" is not held by a plugin of this chain', 'a Button must be held by a plugin');
  assert.equal(button({ key: 'k' }), 'Button props must be { key, label }, both strings, hotkey a digit or a ' +
    'letter, action a keybinding action, dimColor a boolean, variant "primary" or "secondary", role ' +
    '"dismiss" and autoFocus true');
  assert.equal(button({ key: 'k', label: 'L', variant: 'tertiary' }),
    'Button "k" variant is "primary", "secondary" or absent');
  assert.equal(button({ key: 'k', label: 'L', autoFocus: 'x' }), 'Button "k" autoFocus is true or absent');
  assert.equal(button({ key: 'k', label: 'L', hotkey: 'A' }),
    'Button "k" hotkey must be one digit 0-9 or one lowercase letter a-z');
  assert.equal(button({ key: 'k', label: 'L', action: 'app:nope' }),
    'Button "k" action "app:nope" is not one of the engine\'s keybinding actions ' +
    '(app:cycleDiffBase, app:diffFileListDown)');
  assert.equal(button({ key: 'k', label: 'L', action: 'app:interrupt' }),
    'Button "k" action "app:interrupt" is the engine\'s alone: its key cannot be rebound (ctrl+c, ctrl+d)');
  assert.equal(button({ key: 'k', label: 'a\x1bb' }), 'Button "k" label holds a control character');
  assert.equal(button({ key: 'k', label: 'L' }, { children: [] }), undefined);
  assert.equal(button({ key: 'k', label: 'L' }, { children: 'x' }), 'Button "k" children is a string');
  assert.equal(button({ key: 'k', label: 'L', plain: false, autoFocus: 'x' }),
    'Button "k" plain is true or absent', 'plain is read before autoFocus');
}
console.log('W45ButtonKeysCompiled.v1');

// W45-67: the keybinding editor — the other half of the keybinding module: the key parser, the
// legacy action names, the context list and its check, the action-or-command check, the reserved keys
// for this platform, and the two schemas a keybindings file is read through.
{
  assert.deepEqual(parseKeyBinding('Ctrl+Shift+B'), parseKeyBinding('shift+ctrl+b'));
  assert.equal(parseKeyBinding('esc').key, 'escape');
  assert.equal(parseKeyBinding('space').key, ' ');
  assert.equal(parseKeyBinding('↑').key, 'up');
  assert.equal(parseKeyBinding('cmd+p').super, true);
  assert.equal(parseKeyBinding('meta+x').meta, true);
  assert.equal(parseKeyBinding('meta+x').alt, false, 'the parser does not fold meta into alt');
  assert.equal(normalizeKey('meta+x'), 'alt+x', 'while the comparison normaliser does');
  assert.equal(parseKeyBinding('ctrl+x b').key, 'x b');
  assert.equal(KEY_CONTEXTS.length, 29);
  assert.equal(isKnownContext('MessageSelector'), true, 'the list keeps the contexts the defaults no longer bind');
  assert.equal(isKnownContext('Nope'), false);
  assert.equal(isActionOrCommand('app:interrupt'), true);
  assert.equal(isActionOrCommand('command:help'), true);
  assert.equal(isActionOrCommand('command:'), true);
  assert.equal(isActionOrCommand('nope'), false);
  assert.deepEqual(reservedKeysForPlatform().map((entry) => entry.key),
    ['ctrl+c', 'ctrl+d', 'ctrl+m', 'ctrl+[', 'ctrl+i', 'ctrl+h', 'capslock', 'ctrl+z', 'ctrl+\\']);
  assert.equal(LEGACY_ACTION_READ_AS['messageSelector:up'], 'select:previous');
  assert.equal(LEGACY_ACTION_READ_AS['diff:viewDetails'], 'select:accept');
  assert.equal(isLegacyAction('messageSelector:up'), true);
  assert.equal(isLegacyAction('select:previous'), false, 'the name it is read as is not a legacy name');
  assert.equal(isLegacyAction(1), false, 'measured: this one compares, so a non-string answers instead of throwing');
  const chord = splitChord('ctrl+x shift+y');
  assert.equal(chord.length, 2);
  assert.deepEqual(chord[0], parseKeyBinding('ctrl+x'));
  assert.deepEqual(splitChord(' '), [parseKeyBinding('space')], 'the space key is written as a word');
  assert.equal(splitChord('  ')[0].key, '', 'measured: two spaces are not that word');
  assert.equal(splitChord('')[0].key, '', 'and an empty chord is one empty key');

  const file = keyBindingsFileSchema();
  const block = { context: 'Global', bindings: { 'ctrl+k': 'app:interrupt' } };
  assert.deepEqual(file.parse({ bindings: [block] }), { bindings: [block] });
  assert.doesNotThrow(() => file.parse({ bindings: [{ context: 'Global', bindings: { 'ctrl+h': 'command:help' } }] }));
  assert.doesNotThrow(() => file.parse({ bindings: [{ context: 'Global', bindings: { 'ctrl+k': null } }] }));
  assert.throws(() => file.parse({ bindings: [{ context: 'Nope', bindings: {} }] }), 'the context is an enum');
  assert.throws(() => file.parse({ bindings: [{ context: 'Global', bindings: { 'ctrl+k': 'nope' } }] }),
    'the action is a value the schema knows');
  assert.equal(keyBindingBlockSchema().description, 'A block of keybindings for a specific context');
  const runtime = runtimeKeyBindingBlockSchema();
  assert.doesNotThrow(() => runtime.parse({ context: 'Nope', bindings: { 'ctrl+k': 'nope' } }),
    'measured: the runtime schema holds the shapes only, the values were checked once already');
  assert.throws(() => runtime.parse({ context: 'Global', bindings: { 'ctrl+k': 1 } }));
  const before = SCHEMA_REGISTRY.builtCount();
  const once = LAZY(() => ({ built: true }));
  assert.deepEqual(once(), once());
  assert.equal(SCHEMA_REGISTRY.builtCount(), before + 1, 'a builder runs once');
  assert.equal(blockPassesRuntimeSchema(block), true);
  assert.equal(blockPassesRuntimeSchema({ bindings: {} }), false, 'the context is required');
  assert.equal(blockPassesRuntimeSchema({ context: 'Global', bindings: { 'ctrl+k': 1 } }), false, 'the action is a string');
  assert.equal(blockPassesRuntimeSchema({ context: 'Nope', bindings: { 'ctrl+k': 'nope' } }), true,
    'measured: the runtime check asks the weaker schema, so a value the file parser refused is not its business');
  assert.equal(documentPassesRuntimeSchema([block]), true);
  assert.equal(documentPassesRuntimeSchema([]), true, 'every block of none passes');
  assert.equal(documentPassesRuntimeSchema([block, { context: 1, bindings: {} }]), false);
  assert.equal(documentPassesRuntimeSchema(block), false, 'the document is an array of blocks');
  assert.equal(SCHEMA_REGISTRY.builtCount(), before + 1, 'and asking the runtime check did not build a second schema');
}
console.log('W45KeybindingEditorCompiled.v1');

// W45-68: the keybinding module's row reader — the rows a table is drawn from, the legacy names
// rewritten as a file is read back, and this chunk's own lodash `mapValues` under them.
{
  const rows = bindingRows(DEFAULT_BINDINGS);
  assert.equal(rows.length, 226, 'measured: the product defaults hold 226 bindings');
  assert.deepEqual(rows[0], {
    chord: [{ key: 'c', ctrl: true, alt: false, shift: false, meta: false, super: false }],
    action: 'app:interrupt',
    context: 'Global',
  });
  assert.equal(new Set(rows.map((row) => row.context)).size, 27);
  assert.deepEqual(bindingRows([]), []);
  const chorded = bindingRows([{ context: 'Chat', bindings: { 'ctrl+x shift+y': 'app:interrupt', g: null } }]);
  assert.equal(chorded[0].chord.length, 2, 'a chord of two keys is two key records');
  assert.equal(chorded[1].action, null, 'an unbound default is a row like any other');
  const blocks = [{ context: 'Global', bindings: { 'ctrl+k': 'messageSelector:up', 'ctrl+j': null, 'ctrl+l': 'app:interrupt' } }];
  assert.deepEqual(rewriteLegacyBindings(blocks), [{ context: 'Global', bindings: {
    'ctrl+k': 'select:previous', 'ctrl+j': null, 'ctrl+l': 'app:interrupt',
  } }]);
  assert.equal(blocks[0].bindings['ctrl+k'], 'messageSelector:up', 'the argument is not rewritten in place');
  assert.equal(MAP_VALUES_ALIAS, SOURCE_BODIES.Di, 'the mapper reaches the same map-values');
  assert.deepEqual(mapValuesForRows({ a: 1, b: 2 }, (value) => value + 1), { a: 2, b: 3 });
  const prototype = Object.create({ inherited: 9 });
  prototype.a = 1;
  assert.deepEqual(mapValuesForRows(prototype, (value) => value), { a: 1 }, 'only own keys are mapped');
  assert.deepEqual(mapValuesForRows(null, (value) => value), {}, 'measured: a null object maps to nothing');
  // The reader reads the whole editor's tables through the rows, so a row's action is a name the engine
  // knows or null, and this is that check over every row the product's own defaults produce.
  assert.equal(rows.every((row) => row.action === null || knownAction(row.action)), true);
}
console.log('W45KeybindingRowsCompiled.v1');
// W45-69: the leaf table and the walkers that read it — the table's dispatch over the nine checks the
// site packages ported, the text and height a leaf contributes, the diff reader the Code leaf's height
// needs, and the four one-statement helpers under them.
{
  assert.deepEqual(Object.keys(LEAF_TABLE).sort(),
    ['Button', 'Client', 'Code', 'Image', 'Input', 'Markdown', 'Raster', 'Select', 'Svg']);
  assert.equal(LEAF_TABLE.Code({ type: 'Code', props: {} }), 'Code source must be a string');
  assert.equal(LEAF_TABLE.Svg({ type: 'Svg', props: {} }), 'Svg source must be a non-empty string');
  assert.deepEqual(leafText({ type: 'Svg', props: { alt: 'A' } }), ['A']);
  assert.deepEqual(leafText({ type: 'Input', props: {} }), ['']);
  assert.deepEqual(flattenLeafText(['a', { children: ['b', { children: ['c'] }] }]), ['a', 'b', 'c']);
  assert.equal(leafHeight({ type: 'Raster', props: { rows: 7 } }), 7);
  assert.equal(leafHeight({ type: 'Markdown', props: { text: 'a\nb\nc' } }), 3);
  const diff = ['--- a/x', '+++ b/x', '@@ -1,2 +1,3 @@', ' a', '-b', '+c', '+d', '\\ No newline at end of file'].join('\n');
  assert.equal(leafHeight({ type: 'Code', props: { source: diff, format: 'diff' } }), 9);
  assert.equal(leafHeight({ type: 'Code', props: { source: diff, format: 'diff', wrap: 'truncate-end' } }), 8);
  assert.equal(diffReadFor(diff, 'source'), undefined);
  assert.deepEqual(diffHunks(diff), { kind: 'hunks', hunks: [
    { oldStart: 1, oldLines: 2, newStart: 1, newLines: 3, lines: [' a', '-b', '+c', '+d'] },
  ] });
  assert.deepEqual(diffHunks('not a diff'), { kind: 'refused', problem: 'no @@ hunk header found' });
  assert.throws(() => parseUnifiedDiff('@@ -1,1 +1,5 @@\n a'), /Added line count did not match/);
  const seen = new Set();
  assert.equal(duplicateLeafKey({ type: 'Input', props: { key: 'k' } }, seen), undefined);
  assert.equal(duplicateLeafKey({ type: 'Input', props: { key: 'k' } }, seen),
    'Input "k" is drawn twice; each takes its own key');
  assert.equal(LEAF_WRAP_WIDTH, 40);
  assert.equal(LEAF_LINE_CAP, 12);
  assert.equal(emittedLines('a\nb\nc', 40), 2);
  assert.equal(textWidthWithin('ab\tcd\nef', 2), 4);
  assert.equal(countOccurrences('a\nb\nc', '\n'), 2);
  assert.equal(hunkGutterWidth({ oldStart: 1, oldLines: 3, newStart: 1, newLines: 4, lines: [] }), 4);
  assert.equal(expandLeadingTabs('\tb'), '  b');
  assert.equal(sanitizeLeafText('a‮b'), 'a�b');
}
console.log('W45LeafWalkersCompiled.v1');
// W45-70: the `$` call dispatcher — the gate a plugin call passes, the withholding and scan rules it
// is held to, and the raise/stamp/run chain the call ends in.
{
  const scan = {
    calls: ['state.get', 'env.get', 'test.op', 'ui.log', 'interface.call'],
    state: { reads: [{ plugin: 'p', key: 'k' }], writes: [{ plugin: 'p', key: 'k' }] },
    env: { reads: ['HOME'], writes: ['PATH'] },
  };
  const state = {
    knownArgs: new Map([['p', { pluginName: 'p', pluginStorageId: 's@1', scan }]]),
    refusalsLogged: new Set(),
    crashedWithholders: new Map(),
    building: [],
    withheld: { refuser: () => undefined },
    unadmitted: new Set(),
  };
  const caller = { plugin: 'p', origin: {}, environmentId: 'env-1' };
  assert.deepEqual(ENV_CALLS, ['env.get', 'env.set']);
  assert.deepEqual(STATE_CALLS, ['state.get', 'state.set']);
  assert.equal(DROPPED_CALLS.length, 5);
  assert.equal(isDroppableCall('ui.log'), true);
  assert.equal(firstSegment('ui.log'), 'ui');
  assert.equal(callSpelling('interface.call', { name: 'srv', method: 'm' }), 'srv.m');
  assert.equal(plainOrJsonName('a b'), '"a b"');
  assert.equal(stateReference({ plugin: 'a b', key: 'k' }), '"a b".k');
  assert.equal(removedByPlugin('ui.log', 'p'), '$.ui.log: removed by plugin `p`');
  assert.equal(scanAllowsCall({ calls: ['ui.toast'] }, 'ui.log'),
    'its hooks module does not call it (host rule; the scan lists $.ui.toast)');
  assert.equal(scanAllowsEnv(scan, 'env.get', { name: 'PATH' }),
    'its hooks module does not name PATH in a $.env.get("<name>") call (host rule; the scan lists reads of HOME)');
  assert.equal(withheldSentence({ ...state, refusalsLogged: new Set() }, { plugin: 'p', spelling: 'ui.log', by: 'p0' }),
    '$.ui.log: removed by plugin `p0`');
  assert.throws(() => admittedCall({ ...state, knownArgs: new Map() }, { spelling: 'ui.log', caller, isClock: false }),
    { message: 'p: $.ui.log refused: no hooks module of that name is loaded, so there is no scan to allow it (host rule)' });
  const args = { plugin: 'p', key: 'k' };
  assert.notEqual(copyCallArgs(args), args);
  const order = [];
  const ops = {
    'test.op': {
      check: () => undefined,
      raise: () => { order.push('raise'); return undefined; },
      stamp: (a) => { order.push('stamp'); return a; },
      run: (a) => { order.push('run'); return a; },
    },
  };
  assert.deepEqual(await dispatchCall({ ops, state }, { op: 'test.op', args, caller }), args);
  assert.deepEqual(order, ['raise', 'stamp', 'run']);
  await assert.rejects(dispatchCall({ ops: { 'ui.log': { check: () => 'nope', run: () => undefined } }, state },
    { op: 'ui.log', args: {}, caller }), { message: 'p: ui.log: nope (host check)' });
}
console.log('W45CallDispatchCompiled.v1');
// W45-71: the `ui.scroll` and `ui.focus` call entries — the two site registries, the key, the ownership
// checks and the commit roads each call takes.
{
  const registry = (await import('../dist/plugin-chain-host.js')).it();
  registry.scrollSites = new Map();
  registry.focusSites = new Map();
  assert.equal(scrollSites(), registry.scrollSites);
  assert.equal(focusSites(), registry.focusSites);
  assert.equal(siteKey('button', 'r1'), 'button:r1');
  assert.equal(scrollSiteFor({ component: 'x', requestId: 'y' }), undefined);
  assert.equal(focusSiteFor({ component: 'x', requestId: 'y' }), undefined);
  const plugin = (name) => ({ kind: 'plugin', name });
  const scroll = { owner: 'p1', commit: (offset) => offset === 3 };
  registry.scrollSites.set(siteKey('button', 'r1'), scroll);
  assert.equal(scrollSiteFor({ component: 'button', requestId: 'r1' }), scroll);
  assert.deepEqual(scrollCall({ component: 'button', requestId: 'r1', offset: 3, origin: plugin('p1') }), {});
  assert.deepEqual(scrollCall({ component: 'button', requestId: 'r1', offset: 9, origin: plugin('p1') }),
    { deny: 'the window moved meanwhile' });
  assert.deepEqual(scrollCall({ component: 'button', requestId: 'r2', offset: 3, origin: plugin('p1') }),
    { deny: 'no such site' });
  registry.scrollSites.set(siteKey('button', 'r2'), { owner: 'owner', commit: () => true });
  assert.deepEqual(scrollCall({ component: 'button', requestId: 'r2', offset: 3, origin: plugin('p1') }),
    { deny: "not this plugin's site" });
  assert.equal(scrollCallIsForeign({ owner: 'p1', commit: () => true }, plugin('p2')), true);
  const focus = { owner: 'p1', commit: () => undefined, isHeldNow: () => true, holderNow: () => undefined };
  registry.focusSites.set(siteKey('input', 'r1'), focus);
  assert.deepEqual(focusCall({ component: 'input', requestId: 'r1', plugin: 'p1', origin: plugin('p1') }), {});
  registry.focusSites.set(siteKey('input', 'r2'), { owner: 'p1', commit: () => undefined, isHeldNow: () => false, holderNow: () => undefined });
  assert.deepEqual(focusCall({ component: 'input', requestId: 'r2', plugin: 'p1', origin: plugin('p1') }),
    { deny: 'that site does not hold the keyboard' });
  registry.focusSites.set(siteKey('input', 'r3'), { owner: 'p1', commit: () => undefined, isHeldNow: () => true, holderNow: () => 'p2' });
  assert.deepEqual(focusCall({ component: 'input', requestId: 'r3', plugin: 'p1', origin: plugin('p1') }),
    { deny: "another plugin's element holds the keyboard" });
  assert.equal(otherHolderHasKeyboard({ holderNow: () => 'p2' }, plugin('p1')), true);
  assert.equal(SCROLL_ENTRY.site, zd['ui.scroll']);
  assert.equal(FOCUS_ENTRY.site, zd['ui.focus']);
  assert.equal(zd['ui.scroll'].event, 'ui.scroll');
  assert.equal(zd['ui.focus'].event, 'ui.focus');
  const focusArgs = { component: 'input', requestId: 'r1', plugin: 'p1', origin: plugin('p1'), element: 'el' };
  assert.equal(FOCUS_SITE.checkArgument(focusArgs, focusArgs), undefined);
  assert.equal(FOCUS_SITE.checkArgument({ ...focusArgs, element: 5 }, focusArgs), 'an element that is not a non-empty string');
  assert.equal(FOCUS_SITE.checkArgument({ ...focusArgs, plugin: 'other' }, focusArgs),
    "a changed plugin (the envelope is the engine's; a rewrite keeps component, requestId, plugin, origin)");
  const scrollArgs = { component: 'button', requestId: 'r1', by: 3, origin: plugin('p1'), offset: 2 };
  assert.equal(SCROLL_SITE.checkArgument(scrollArgs, scrollArgs), undefined);
  assert.equal(SCROLL_SITE.checkArgument({ ...scrollArgs, offset: 1.5 }, scrollArgs),
    'an offset that is not a whole row number (0 or more)');
  assert.equal(SCROLL_SITE.check({ deny: '' }, scrollArgs, []), 'a deny that is not a non-empty string');
  assert.equal(SCROLL_SITE.check(undefined, scrollArgs, []), 'something that is not a result object');
  assert.deepEqual(await SCROLL_ENTRY.core.run({ component: 'button', requestId: 'r1', offset: 3, origin: plugin('p1') }), {});
  assert.deepEqual(await FOCUS_ENTRY.core.run({ component: 'input', requestId: 'r1', plugin: 'p1', origin: plugin('p1') }), {});
}
console.log('W45ScrollFocusCompiled.v1');
