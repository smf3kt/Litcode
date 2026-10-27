// A shell command line is not one string to the shell: quoting, escaping,
// command substitution and separators all change what actually runs. A rule that
// matches only the literal text can therefore allow a command whose real effect
// is something else entirely.
//
// The recovered client solves this by enumerating the readings of a command and
// checking every one of them, and by refusing to treat a set as complete when it
// could not enumerate them all. This module supplies the same shape over this
// runtime's own quoting and separator model rather than the recovered bash
// parser, so the invariant - every reading must be permitted, and an incomplete
// set may not be allowed on the strength of one reading - is what gets ported.

import { At, Fe, Rt, fLn, gLn, lyr, mLn, uyr, yit } from './shell-complexity-source.js';
import { statementCoverage } from './shell-coverage-source.js';
import { vS } from './bash-parser-source.js';

// Bounded like the recovered reading set: small sets are enumerated fully, and
// anything larger is a bounded sample that must be reported as incomplete.
export const SHELL_READING_LIMIT = 16;

// The recovered length bound on a line the parser will accept (`$e=1e4`,
// chunk-zjewzgfh.js offset 822).
const SHELL_ANALYSER_LIMIT = 1e4;

// The node types the recovered extractor walks (`Mt`, chunk-zjewzgfh.js offset
// 21417, which also lists `ERROR`). `Mt` mixes leaf commands with the
// containers that hold them; the walk needs the two apart. A leaf is one
// command, and a container is a statement whose children run on their own.
const LEAF_COMMANDS = new Set(['command', 'variable_assignment', 'variable_assignments', 'negated_command',
  'declaration_command', 'unset_command', 'test_command']);
const CONTAINER_NODES = new Set(['list', 'pipeline', 'redirected_statement', 'subshell', 'compound_statement',
  'if_statement', 'while_statement', 'for_statement', 'case_statement', 'function_definition']);

// A keyword or group opens an execution context, so the text walk's separators
// are not command boundaries inside it.
const COMPOUND_NODES = new Set(['subshell', 'compound_statement', 'if_statement', 'while_statement', 'for_statement',
  'case_statement', 'function_definition']);

/** True when the line holds a compound node, so its `;` does not separate commands. */
function hasCompoundNode(tree: unknown): boolean {
  const node = tree as { type?: string; children?: readonly (unknown)[] } | null | undefined;
  if (!node || typeof node.type !== 'string') return false;
  if (COMPOUND_NODES.has(node.type)) return true;
  return (node.children ?? []).some(hasCompoundNode);
}

/** One command the line can actually run, as the recovered tree reports it. */
function treeReadings(command: string): { readings: string[]; denyOnly: string[]; tree?: unknown; refused?: string } {
  if (command.length > SHELL_ANALYSER_LIMIT) return { readings: [], denyOnly: [], refused: 'Parser aborted (over-length)' };
  let tree;
  // The recovered parser's own 50 ms deadline applies when no budget is given.
  try { tree = vS().parse(command, undefined); } catch { return { readings: [], denyOnly: [], refused: 'Parser aborted' }; }
  if (tree === null) return { readings: [], denyOnly: [], refused: 'Parser aborted' };
  const coverage = statementCoverage(Buffer.from(command, 'utf8'), tree);
  if (coverage) return { readings: [], denyOnly: [], refused: coverage.reason };
  const readings: string[] = [];
  const denyOnly: string[] = [];
  let refused: string | undefined;
  const visit = (node: { type?: string; text?: string; children?: readonly (unknown)[] } | null | undefined,
    redirectText: string | undefined): void => {
    if (refused !== undefined || !node || typeof node.type !== 'string') return;
    // The recovered analyzer answers `too-complex` for an ERROR node, so a line
    // the parser could not read yields no reading set at all.
    if (node.type === 'ERROR') { refused = 'Parse error'; return; }
    // `E` records each command's own text and `Wt` keeps its redirections in a
    // separate field. The recovered `GTr` (chunk-sfn1dbxq.js [3251642,3252147))
    // reads the two apart: it matches each parsed command against deny rules
    // only, and keeps the whole line's own decision when an exact rule named the
    // whole line. A command under a redirect is therefore deny-only here.
    if (LEAF_COMMANDS.has(node.type) && typeof node.text === 'string') {
      if (redirectText !== undefined && redirectText !== node.text) {
        readings.push(redirectText);
        denyOnly.push(node.text);
      } else readings.push(node.text);
      return;
    }
    // A redirect around exactly one command belongs to that command. A redirect
    // around a pipeline or a group belongs to the body, whose own commands stay
    // readings of their own: passing the statement text down would hide them.
    const children = (node.children ?? []) as readonly ({ type?: string } | null)[];
    const wrapped = node.type === 'redirected_statement' && typeof node.text === 'string' &&
      children.filter(child => LEAF_COMMANDS.has(child?.type ?? '')).length === 1 &&
      !children.some(child => CONTAINER_NODES.has(child?.type ?? ''))
      ? node.text : undefined;
    for (const child of node.children ?? []) visit(child as never, wrapped);
  };
  visit(tree as never, undefined);
  return { readings, denyOnly, tree, ...(refused === undefined ? {} : { refused }) };
}

/**
 * The recovered analyzer's own reasons for refusing to model a line, in its
 * order (`E6`, chunk-zjewzgfh.js [7897,8796), UTF-16). A line it refuses is one
 * whose executed text cannot be enumerated, so a reading set over it is never
 * complete.
 */
export function shellComplexityReason(command: string): string | undefined {
  if (lyr.test(command)) return 'Contains lone surrogate';
  if (yit.test(command)) return 'Contains control characters';
  if (fLn.test(command)) return 'Contains Unicode whitespace';
  if (Rt.test(command)) return 'Contains backslash-escaped whitespace';
  if (mLn.test(command)) return 'Contains zsh ~[ dynamic directory syntax';
  if (gLn.test(command)) return 'Contains zsh =cmd equals expansion';
  if (uyr.test(command)) return 'Contains zsh <N-M> numeric-range glob';
  if (At.test(Fe(command))) return 'Contains brace with quote character (expansion obfuscation)';
  return undefined;
}

export type ShellReadings = {
  /** Candidate texts the shell could actually run, always including the input. */
  readings: string[];
  /**
   * Texts checked against deny rules only. A command under a redirect is one of
   * these: the recovered `GTr` reads it apart from the statement, so a denial
   * still reaches it while an exact allow on the whole line is left standing.
   */
  denyOnly: string[];
  /** True only when every reading the shell could produce is in `readings`. */
  exhaustive: boolean;
};

// Constructs whose expansion this runtime cannot compute, so the resulting text
// is unknown and no reading set can be complete: command substitution, parameter
// expansion, process substitution, locale-translated strings, a variable
// reference, a leading tilde, and a glob, which the shell replaces with names
// that are not in the command text at all.
const OPAQUE = /\$\(|\$\{|`|<\(|>\(|\$['"]|\$[({A-Za-z_0-9@*#?!-]|(?:^|[\s=])~|[*?\[]/;

// A separator splits the line into commands that run independently, so each part
// has to be permitted on its own.
const SEPARATOR = /(\|\||&&|;|\n|\|)/;

function stripQuotes(text: string): string {
  let out = '';
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (character === "'" || character === '"') continue;
    if (character === '\\' && index + 1 < text.length) { out += text[++index]!; continue; }
    out += character;
  }
  return out;
}

// Command substitution bodies are commands in their own right, so what runs
// inside a substitution is itself a reading of the outer line.
function substitutions(text: string): string[] {
  const found: string[] = [];
  for (const pattern of [/\$\(([^()]*)\)/g, /`([^`]*)`/g]) {
    for (const match of text.matchAll(pattern)) if (match[1]!.trim() !== '') found.push(match[1]!.trim());
  }
  return found;
}

function segments(text: string): string[] {
  return text.split(SEPARATOR).filter(part => part.trim() !== '' && !/^(?:\|\||&&|;|\n|\|)$/.test(part)).map(part => part.trim());
}

/**
 * Conservative readings of one command line.
 *
 * The set contains the input itself, the de-quoted, unescaped, substitution-body
 * and per-segment forms of it, and every command the recovered parser reports
 * inside the line, so a group, an `if` body or a loop body is checked as the
 * command it runs. `exhaustive` is true only when the line contains no construct
 * that expands to text this runtime cannot compute, the recovered analyzer does
 * not refuse it, and neither the text walk nor the tree walk hit their bounds.
 */
export function shellReadings(command: string): ShellReadings {
  const readings = new Set<string>([command]);
  const denyOnly = new Set<string>();
  const queue = [command];
  let truncated = false;
  const add = (candidate: string): void => {
    if (candidate === '' || readings.has(candidate) || denyOnly.has(candidate)) return;
    if (readings.size >= SHELL_READING_LIMIT) { truncated = true; return; }
    readings.add(candidate);
    queue.push(candidate);
  };
  // The text walk cannot see a group or a keyword body: `( echo hi )` is one
  // segment, so a rule on `echo hi` never met it. The recovered parser does
  // report those inner commands, and an unreadable line is refused outright.
  // The tree is read first so its commands join the same queue as the text
  // forms and get de-quoted, unescaped and split in turn; a refusal only marks
  // the set incomplete, it never discards the text readings already found.
  const tree = treeReadings(command);
  for (const reading of tree.readings) add(reading);
  for (const reading of tree.denyOnly) if (reading !== '') denyOnly.add(reading);
  // On a line with a compound node, `;` also separates a keyword from its body,
  // so no form of that line is split: the tree already reports every command in
  // it, and splitting a de-quoted copy would invent `then echo hi` and `fi`.
  const split = tree.refused !== undefined || !hasCompoundNode(tree.tree);
  while (queue.length) {
    const current = queue.shift()!;
    const parts = split ? segments(current) : [];
    for (const candidate of [stripQuotes(current), ...substitutions(current), ...parts]) add(candidate);
  }
  const exhaustive = tree.refused === undefined && !truncated && !OPAQUE.test(command) && shellComplexityReason(command) === undefined;
  return { readings: [...readings], denyOnly: [...denyOnly].filter(reading => !readings.has(reading)), exhaustive };
}

/** True when the command contains a construct that expands before it runs. */
export function hasOpaqueConstruct(command: string): boolean {
  return OPAQUE.test(command);
}
