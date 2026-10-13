/**
 * Declarative keybinding registry for the full-screen interaction layer.
 *
 * The binding tables are a copy of the recovered interactive application's
 * registry (`chunk-6ccen3s8.js` [1964,6000), SHA-256
 * 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d, zero-based
 * UTF-16 coordinates). Every chord and action string below is transcribed from
 * that table; the resolver and the sequence expansion are adaptations, because
 * the recovered registry resolves actions through React components that call
 * `us(chord, context, action)` / `Ze(action, handler, {context})` inside a
 * mounted tree, and this product registers handlers imperatively.
 *
 * Not carried over, with the reason: bindings the recovered table computes at
 * runtime (`...{[le]:"chat:cycleMode"}`, `...{[Me]:"chat:imagePaste"}`,
 * `...L==="wsl"&&{"ctrl+v":"chat:imagePaste"}`) depend on a mode key and on the
 * host platform, and its always-empty spreads (`...{}`, `...[]`) contribute
 * nothing. The context list is transcribed as far as `AbovePrompt`; the table
 * continues past that point and is recorded as a bounded search boundary.
 */

export const TUI_CONTEXTS = ['Global', 'DiffPanel', 'FeedbackSurvey', 'Chat', 'Autocomplete',
  'Settings', 'Confirmation', 'Tabs', 'Transcript', 'HistorySearch', 'Task', 'ThemePicker',
  'Scroll', 'Help', 'Attachments', 'Footer', 'AbovePrompt'] as const;
export type TuiContext = (typeof TUI_CONTEXTS)[number];

/**
 * Chord -> action. A chord with a space is a sequence: every key in it is
 * pressed in order.
 */
export const KEY_BINDINGS: Readonly<Record<TuiContext, Readonly<Record<string, string>>>> = {
  Global: {
    'ctrl+c': 'app:interrupt',
    'ctrl+d': 'app:exit',
    'ctrl+t': 'app:toggleTodos',
    'ctrl+o': 'app:toggleTranscript',
    'ctrl+shift+b': 'app:toggleBrief',
    'ctrl+r': 'history:search',
    'ctrl+up': 'app:diffFileListUp',
    'ctrl+down': 'app:diffFileListDown',
    'meta+up': 'app:diffFileListUp',
    'meta+down': 'app:diffFileListDown',
    'ctrl+]': 'app:openArtifact',
  },
  DiffPanel: { 'ctrl+x b': 'app:cycleDiffBase' },
  FeedbackSurvey: { 'ctrl+x 1': 'feedbackSurvey:bad', 'ctrl+x 2': 'feedbackSurvey:fine', 'ctrl+x 3': 'feedbackSurvey:good' },
  Chat: {
    escape: 'chat:cancel',
    'ctrl+l': 'chat:clearInput',
    'cmd+k': 'chat:clearScreen',
    'ctrl+x ctrl+k': 'chat:killAgents',
    'meta+p': 'chat:modelPicker',
    'meta+o': 'chat:fastMode',
    'ctrl+y': 'chat:defaultToNewerModel',
    'meta+t': 'chat:thinkingToggle',
    'meta+w': 'chat:workflowKeywordToggle',
    enter: 'chat:submit',
    'ctrl+x enter': 'chat:queueSubmit',
    'ctrl+x ctrl+s': 'chat:sendNow',
    'ctrl+enter': 'chat:sendNow',
    'ctrl+j': 'chat:newline',
    up: 'history:previous',
    down: 'history:next',
    'ctrl+_': 'chat:undo',
    'ctrl+-': 'chat:undo',
    'ctrl+shift+-': 'chat:undo',
    'ctrl+shift+_': 'chat:undo',
    'ctrl+x ctrl+e': 'chat:externalEditor',
    'ctrl+x ctrl+a': 'abovePrompt:toggle',
    'ctrl+x tab': 'abovePrompt:focus',
    'ctrl+g': 'chat:externalEditor',
    'ctrl+s': 'chat:stash',
    space: 'voice:pushToTalk',
  },
  Autocomplete: { tab: 'autocomplete:accept', escape: 'autocomplete:dismiss', up: 'autocomplete:previous', down: 'autocomplete:next' },
  Settings: {
    escape: 'confirm:no',
    up: 'select:previous', down: 'select:next', k: 'select:previous', j: 'select:next',
    'ctrl+p': 'select:previous', 'ctrl+n': 'select:next',
    home: 'select:first', end: 'select:last', pageup: 'select:pageUp', pagedown: 'select:pageDown',
    space: 'select:accept', enter: 'select:accept',
    '/': 'settings:search', r: 'settings:retry', d: 'settings:periodDay', w: 'settings:periodWeek',
    t: 'settings:sortByTokens', 'ctrl+u': 'scroll:halfPageUp', 'ctrl+d': 'scroll:halfPageDown',
  },
  Confirmation: {
    enter: 'confirm:yes', escape: 'confirm:no', up: 'confirm:previous', down: 'confirm:next',
    tab: 'confirm:nextField', space: 'confirm:toggle',
  },
  Tabs: { tab: 'tabs:next', 'shift+tab': 'tabs:previous', right: 'tabs:next', left: 'tabs:previous' },
  Transcript: {
    'ctrl+e': 'transcript:toggleShowAll',
    'ctrl+c': 'transcript:exit', escape: 'transcript:exit', q: 'transcript:exit',
    'ctrl+u': 'scroll:halfPageUp', 'ctrl+d': 'scroll:halfPageDown',
    'ctrl+b': 'scroll:fullPageUp', 'ctrl+f': 'scroll:fullPageDown',
    'ctrl+n': 'scroll:lineDown', 'ctrl+p': 'scroll:lineUp',
    g: 'scroll:top', 'shift+g': 'scroll:bottom',
    j: 'scroll:lineDown', k: 'scroll:lineUp',
    space: 'scroll:fullPageDown', b: 'scroll:fullPageUp',
    up: 'scroll:lineUp', down: 'scroll:lineDown', home: 'scroll:top', end: 'scroll:bottom',
  },
  HistorySearch: {
    'ctrl+r': 'historySearch:next', escape: 'historySearch:accept', tab: 'historySearch:accept',
    'ctrl+c': 'historySearch:cancel', enter: 'historySearch:execute', 'ctrl+s': 'historySearch:cycleScope',
  },
  Task: { 'ctrl+x ctrl+b': 'task:background', 'ctrl+b': 'task:background' },
  ThemePicker: { 'ctrl+t': 'theme:toggleSyntaxHighlighting', 'ctrl+e': 'theme:editCustom' },
  Scroll: {
    pageup: 'scroll:pageUp', pagedown: 'scroll:pageDown',
    wheelup: 'scroll:lineUp', wheeldown: 'scroll:lineDown',
    'ctrl+home': 'scroll:top', 'ctrl+end': 'scroll:bottom',
    'ctrl+shift+c': 'selection:copy', 'cmd+c': 'selection:copy',
    'shift+left': 'selection:extendLeft', 'shift+right': 'selection:extendRight',
    'shift+up': 'selection:extendUp', 'shift+down': 'selection:extendDown',
    'shift+home': 'selection:extendLineStart', 'shift+end': 'selection:extendLineEnd',
  },
  Help: { escape: 'help:dismiss' },
  Attachments: {
    right: 'attachments:next', left: 'attachments:previous', backspace: 'attachments:remove',
    delete: 'attachments:remove', down: 'attachments:exit', escape: 'attachments:exit',
  },
  Footer: {
    up: 'footer:up', 'ctrl+p': 'footer:up', down: 'footer:down', 'ctrl+n': 'footer:down',
    right: 'footer:next', left: 'footer:previous', enter: 'footer:openSelected',
    escape: 'footer:clearSelection', x: 'footer:close',
  },
  AbovePrompt: {
    tab: 'abovePrompt:next', right: 'abovePrompt:next', 'shift+tab': 'abovePrompt:previous',
    left: 'abovePrompt:previous', enter: 'abovePrompt:press', space: 'abovePrompt:press',
    escape: 'abovePrompt:leave', up: 'pane:scrollUp', down: 'pane:scrollDown',
    pageup: 'pane:pageUp', pagedown: 'pane:pageDown',
  },
};

/** Raw sequences for the key names the registry uses, in the decoded-input domain. */
const CONTROL: Record<string, string> = {
  'ctrl+@': '\u0000', 'ctrl+a': '\u0001', 'ctrl+b': '\u0002', 'ctrl+c': '\u0003', 'ctrl+d': '\u0004',
  'ctrl+e': '\u0005', 'ctrl+f': '\u0006', 'ctrl+g': '\u0007', 'ctrl+h': '\b', 'ctrl+i': '\t',
  'ctrl+j': '\n', 'ctrl+k': '\u000b', 'ctrl+l': '\u000c', 'ctrl+n': '\u000e', 'ctrl+o': '\u000f',
  'ctrl+p': '\u0010', 'ctrl+q': '\u0011', 'ctrl+r': '\u0012', 'ctrl+s': '\u0013', 'ctrl+t': '\u0014',
  'ctrl+u': '\u0015', 'ctrl+v': '\u0016', 'ctrl+w': '\u0017', 'ctrl+x': '\u0018', 'ctrl+y': '\u0019',
  'ctrl+z': '\u001a', 'ctrl+[': '\u001b', 'ctrl+\\': '\u001c', 'ctrl+]': '\u001d', 'ctrl+^': '\u001e',
  'ctrl+_': '\u001f', 'ctrl+ ': '\u0000', 'ctrl+-': '\u001f',
};
const NAMED: Record<string, string[]> = {
  escape: ['\x1b'], enter: ['\r', '\n'], tab: ['\t'], 'shift+tab': ['\x1b[Z'],
  backspace: ['\x7f', '\b'], delete: ['\x1b[3~'], space: [' '],
  up: ['\x1b[A', '\x1bOA'], down: ['\x1b[B', '\x1bOB'],
  right: ['\x1b[C', '\x1bOC'], left: ['\x1b[D', '\x1bOD'],
  home: ['\x1b[H', '\x1bOH', '\x1b[1~', '\x1b[7~'], end: ['\x1b[F', '\x1bOF', '\x1b[4~', '\x1b[8~'],
  pageup: ['\x1b[5~'], pagedown: ['\x1b[6~'],
  'ctrl+shift+c': ['\x1b[99;6u', '\x1b[67;6u'],
  wheelup: ['wheelup'], wheeldown: ['wheeldown'],
  'ctrl+up': ['\x1b[1;5A'], 'ctrl+down': ['\x1b[1;5B'], 'ctrl+right': ['\x1b[1;5C'], 'ctrl+left': ['\x1b[1;5D'],
  'meta+up': ['\x1b[1;3A'], 'meta+down': ['\x1b[1;3B'],
  'shift+left': ['\x1b[1;2D'], 'shift+right': ['\x1b[1;2C'], 'shift+up': ['\x1b[1;2A'], 'shift+down': ['\x1b[1;2B'],
  'shift+home': ['\x1b[1;2H'], 'shift+end': ['\x1b[1;2F'],
  'ctrl+home': ['\x1b[1;5H'], 'ctrl+end': ['\x1b[1;5F'],
  'ctrl+enter': ['\x1b[13;5u'], 'f11': ['\x1b[23~'], 'f12': ['\x1b[24~'],
};

/** The inverse of `sequencesFor` for the names this product can spell back. */
const NAMES = new Map<string, string>();
for (const [name, sequence] of Object.entries(CONTROL)) if (!NAMES.has(sequence)) NAMES.set(sequence, name);
for (const [name, sequences] of Object.entries(NAMED)) {
  for (const sequence of sequences) if (!NAMES.has(sequence)) NAMES.set(sequence, name);
}
for (let code = 0x61; code <= 0x7a; code++) {
  const letter = String.fromCodePoint(code);
  if (!NAMES.has(letter)) NAMES.set(letter, letter);
  const upper = letter.toUpperCase();
  if (!NAMES.has(upper)) NAMES.set(upper, `shift+${letter}`);
  const meta = `\x1b${letter}`;
  if (!NAMES.has(meta)) NAMES.set(meta, `meta+${letter}`);
}

/** The registry spelling of a raw sequence, or the sequence itself when unknown. */
export function keyName(sequence: string): string {
  return NAMES.get(sequence) ?? sequence;
}

/** Every raw sequence that can stand for one registry key name. */
export function sequencesFor(chordKey: string): string[] {
  const control = CONTROL[chordKey];
  if (control) return [control];
  const named = NAMED[chordKey];
  if (named) return named;
  const meta = /^meta\+(.)$/.exec(chordKey);
  if (meta) return [`\x1b${meta[1]}`];
  const shifted = /^shift\+([a-z])$/.exec(chordKey);
  if (shifted) return [shifted[1]!.toUpperCase()];
  // A bare printable key is itself.
  if (chordKey.length === 1) return [chordKey];
  return [];
}

/** Expand one registry chord into the ordered raw-key alternatives it accepts. */
export function expandChord(chord: string): string[][] {
  const parts = chord.trim().split(/\s+/);
  const expanded = parts.map(part => sequencesFor(part.replace(/^cmd\+/, 'meta+')));
  if (expanded.some(options => options.length === 0)) return [];
  // Cartesian product across the keys of a multi-key chord.
  return expanded.reduce<string[][]>((rows, options) =>
    rows.flatMap(row => options.map(option => [...row, option])), [[]]);
}

export interface ChordMatch {
  context: TuiContext;
  action: string;
  chord: string;
  /** Raw sequences consumed, in order. */
  consumed: string[];
}

interface CompiledBinding { context: TuiContext; action: string; chord: string; keys: string[] }

/**
 * Resolves raw key sequences against a context stack. The topmost context that
 * binds a chord wins, which is how the recovered application layers a modal
 * context over `Global`.
 */
export class Keymap {
  private readonly compiled = new Map<string, CompiledBinding[]>();
  private pending: string[] = [];
  private pendingRaw = '';

  constructor(bindings: Readonly<Record<TuiContext, Readonly<Record<string, string>>>> = KEY_BINDINGS) {
    for (const [context, table] of Object.entries(bindings) as [TuiContext, Record<string, string>][]) {
      for (const [chord, action] of Object.entries(table)) {
        for (const keys of expandChord(chord)) {
          const list = this.compiled.get(keys[0]!) ?? [];
          list.push({ context, action, chord, keys });
          this.compiled.set(keys[0]!, list);
        }
      }
    }
  }

  /** The half-typed chord in registry spelling, for a status row. */
  get pendingChord(): string { return this.pending.map(keyName).join(' '); }

  /** Drop a partially typed chord, for example after its timeout elapses. */
  reset(): void { this.pending = []; this.pendingRaw = ''; }

  /**
   * Feed one raw sequence. A completed chord is dispatched; a longer chord that
   * may still complete leaves the input pending; anything else is not a chord,
   * and `replay` carries back any half-typed chord's bytes so the caller can
   * hand them to the text editor instead of dropping them.
   */
  push(sequence: string, contexts: readonly TuiContext[]):
  { kind: 'match'; match: ChordMatch } | { kind: 'pending' } | { kind: 'none'; replay: string } {
    const candidate = [...this.pending, sequence];
    const matches = (this.compiled.get(candidate[0]!) ?? [])
      .filter(binding => contexts.includes(binding.context));
    const exact = matches.filter(binding => binding.keys.length === candidate.length
      && binding.keys.every((key, index) => key === candidate[index]));
    if (exact.length) {
      this.reset();
      const ordered = [...exact].sort((a, b) =>
        contexts.indexOf(a.context) - contexts.indexOf(b.context));
      const winner = ordered[0]!;
      return { kind: 'match', match: { context: winner.context, action: winner.action,
        chord: winner.chord, consumed: candidate } };
    }
    const prefix = matches.some(binding => binding.keys.length > candidate.length
      && candidate.every((key, index) => binding.keys[index] === key));
    if (prefix) {
      this.pending = candidate;
      this.pendingRaw += sequence;
      return { kind: 'pending' };
    }
    const replay = this.pendingRaw;
    this.reset();
    return { kind: 'none', replay };
  }

  /** Actions bound in a context, for help rendering. */
  actionsFor(context: TuiContext): string[] {
    const table = KEY_BINDINGS[context];
    return [...new Set(Object.values(table))].sort();
  }
}

/**
 * Contexts that apply to a given screen mode, ordered by precedence: the
 * recovered application pushes modal contexts on top of `Global`.
 */
export function contextStack(input: { screen: 'chat' | 'transcript' | 'search' | 'dialog';
  dialog?: 'confirmation' | 'settings' | 'autocomplete' }): TuiContext[] {
  switch (input.screen) {
    case 'transcript': return ['Transcript', 'Scroll', 'Global'];
    case 'search': return ['HistorySearch', 'Global'];
    case 'dialog':
      if (input.dialog === 'confirmation') return ['Confirmation', 'Global'];
      if (input.dialog === 'settings') return ['Settings', 'Global'];
      if (input.dialog === 'autocomplete') return ['Autocomplete', 'Chat', 'Global'];
      return ['Chat', 'Global'];
    default: return ['Chat', 'Global'];
  }
}
