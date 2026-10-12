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

// Bounded like the recovered reading set: small sets are enumerated fully, and
// anything larger is a bounded sample that must be reported as incomplete.
export const SHELL_READING_LIMIT = 16;

export type ShellReadings = {
  /** Candidate texts the shell could actually run, always including the input. */
  readings: string[];
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
 * The set always contains the input itself, plus the de-quoted, unescaped,
 * substitution-body and per-segment forms of it and of those forms one level
 * further. `exhaustive` is true only when the line contains no construct that
 * expands to text this runtime cannot compute and the set did not hit its bound.
 */
export function shellReadings(command: string): ShellReadings {
  const readings = new Set<string>([command]);
  const queue = [command];
  let truncated = false;
  while (queue.length) {
    const current = queue.shift()!;
    const candidates = [stripQuotes(current), ...substitutions(current), ...segments(current)];
    for (const candidate of candidates) {
      if (candidate === '' || readings.has(candidate)) continue;
      if (readings.size >= SHELL_READING_LIMIT) { truncated = true; continue; }
      readings.add(candidate);
      queue.push(candidate);
    }
  }
  const exhaustive = !truncated && !OPAQUE.test(command);
  return { readings: [...readings], exhaustive };
}

/** True when the command contains a construct that expands before it runs. */
export function hasOpaqueConstruct(command: string): boolean {
  return OPAQUE.test(command);
}
