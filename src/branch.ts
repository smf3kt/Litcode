/**
 * `/branch`. Recovered from `chunk-8a6bg1at.js`, sha256
 * `e34c7cbe744b07bcb28040e5434e9bd785af93f7a157e9ac60f904a2413e96df`: the registration `CTo` in
 * `chunk-sfn1dbxq.js` 1638151 (`local-jsx`, `Create a branch of the current conversation at this
 * point`, argument hint `[name]`), the prompt deriver `te` at 14328, the storage branch `se` at
 * 17210, the title allocator `re` at 19834, the command body `oe` at 20188 and the local
 * `call` `_e` at 21599. The first-prompt reader `d8e` is `chunk-nkvcn1t9.js` 824, sha256
 * `f0c22846a7a6e8758dc7a99291d9aabe69e2e64df7befc70aefb93c3d4f51941`; the pasted-content reader
 * `gwe`/`$Mt` is `chunk-sahdsq7n.js` 1822, sha256
 * `f8807529cfba1dc0bc35ef9b17d6d39ccf35bba8f66e3e0e6c6ed07c1d43eda0`; the grapheme cut `ne` and
 * the escape `gl` are `chunk-ax7r0qj7.js` 1128 and 677, sha256
 * `8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e`. Offsets are zero-based
 * UTF-16 code units.
 */

export const BRANCH_COMMAND = 'branch';
export const BRANCH_ARGUMENT_HINT = '[name]';
export const BRANCH_FALLBACK_TITLE = 'Branched conversation';

/** Source `ne` (`chunk-ax7r0qj7.js` 1128): cut to `n` UTF-16 units without splitting a surrogate pair. */
export function cutGraphemes(text: string, limit: number): string {
  if (limit <= 0) return '';
  if (text.length <= limit) return text;
  const head = text.slice(0, limit);
  const last = head.charCodeAt(limit - 1);
  return last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head;
}

/**
 * Source `gwe` (`chunk-sahdsq7n.js` 1822): a pasted-content block keeps only its body when the
 * text is read for display. The block is `<pasted_content id="xxxx">` … `</pasted_content id="xxxx">`;
 * an id is four lowercase hex digits and a block without its closing tag is left as text.
 */
export function unwrapPastedContent(text: string): string {
  const open = /<pasted_content id="([0-9a-f]{4})">\n/g;
  const blocks: { kind: 'text' | 'block'; text: string }[] = [];
  let index = 0;
  scan: for (;;) {
    open.lastIndex = index;
    const match = open.exec(text);
    if (match === null) break;
    const id = match[1]!;
    const bodyStart = match.index + match[0].length;
    const close = `</pasted_content id="${id}">\n`;
    const bodyEnd = text.indexOf(close, bodyStart);
    // Source `$Mt`: an unclosed block stops the scan, so the rest stays ordinary text.
    if (bodyEnd < 0) break scan;
    if (match.index > index) blocks.push({ kind: 'text', text: text.slice(index, match.index) });
    blocks.push({ kind: 'block', text: text.slice(bodyStart, bodyEnd) });
    index = bodyEnd + close.length;
  }
  if (index < text.length) blocks.push({ kind: 'text', text: text.slice(index) });
  return blocks.map(block => block.text).join('');
}

/** Source `d8e`'s command-name tag: `<command-name>…</command-name>`. */const COMMAND_NAME = /<command-name>(.*?)<\/command-name>/;
const BASH_INPUT = /<bash-input>([\s\S]*?)<\/bash-input>/;
const NOT_A_PROMPT = /^(?:\s*<[a-z][\w-]*[\s>]|\[Request interrupted by user[^\]]*\])/;

export interface BranchPromptSources {
  /** The message's text blocks, in order. `d8e` reads each block on its own. */
  readonly texts: readonly string[];
  /** Source `isMeta`: a host-authored row never names the branch. */
  readonly meta: boolean;
  /** Source `isCompactSummary`: a summary row never names the branch either. */
  readonly compactSummary?: boolean;
  /** Source `t.type === "tool_result"`: a result row yields no prompt at all. */
  readonly toolResult?: boolean;
}

/**
 * Source `te` + `d8e`: the first user prompt that reads as typed text. A tool-result-only or
 * interrupted row is skipped, a slash command contributes its `<command-name>` only when no plain
 * prompt follows, and the whole result is whitespace-collapsed and cut to 100 units. The fallback
 * is `Branched conversation`.
 */
export function deriveFirstPrompt(messages: readonly BranchPromptSources[]): string {
  let commandFallback = '';
  let found: string | undefined;
  scan: for (const message of messages) {
    if (message.meta || message.compactSummary === true) continue;
    // `d8e` returns at the first tool_result block, so a result row never names the branch.
    if (message.toolResult === true) continue;
    for (const block of message.texts) {
      const text = unwrapPastedContent(block).replaceAll('\n', ' ').trim();
      if (text === '') continue;
      const command = COMMAND_NAME.exec(text);
      if (command) {
        if (commandFallback === '') commandFallback = command[1]!;
        continue;
      }
      const bash = BASH_INPUT.exec(text);
      if (bash) { found = `! ${bash[1]!.trim()}`; break scan; }
      if (NOT_A_PROMPT.test(text)) continue;
      found = text.length > 200 ? cutGraphemes(text, 200).trim() + '…' : text;
      break scan;
    }
  }
  // `te` normalizes whatever `d8e` returned, including the command fallback.
  const chosen = found ?? commandFallback;
  return chosen.replace(/\s+/g, ' ').trim().slice(0, 100).trimEnd() || BRANCH_FALLBACK_TITLE;
}

/** Source `gl`: escape a string for a regular expression. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Source `re`: the branch title. The base is `<title> (Branch)`; an existing exact title moves to
 * `<title> (Branch 2)` and the lowest unused ordinal wins, so a second branch of the same source
 * never overwrites the first.
 */
export function branchTitle(base: string, existing: readonly string[]): string {
  const first = `${base} (Branch)`;
  if (!existing.includes(first)) return first;
  const used = new Set<number>([1]);
  const pattern = new RegExp(`^${escapeRegExp(base)} \\(Branch(?: (\\d+))?\\)$`);
  for (const title of existing) {
    const match = pattern.exec(title);
    if (match === null) continue;
    used.add(match[1] === undefined ? 1 : parseInt(match[1], 10));
  }
  let next = 2;
  while (used.has(next)) next++;
  return `${base} (Branch ${next})`;
}

/** Source `oe`'s success line. Only a custom title is quoted; an auto-derived title is not named. */
export function branchMessage(options: { customTitle?: string; sessionId: string; originalSessionId: string;
  originalTitle?: string; resumed?: boolean }): string {
  const named = options.customTitle === undefined ? '' : ` "${options.customTitle}"`;
  const original = options.originalTitle === undefined ? '' : ` ("${options.originalTitle}")`;
  return options.resumed === true
    ? `Branched conversation${named}. You are now in the new branch (session ${options.sessionId}). `
      + `Use /resume ${options.originalSessionId}${original} to return to the original, `
      + `or run \`claude -r ${options.originalSessionId}\` in a new terminal.`
    : `Branched conversation${named}. Resume with: /resume ${options.sessionId}`;
}

/** Source `oe`'s stored title: a custom name is collapsed and trimmed, never suffixed. */
export function customBranchTitle(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/** Source `oe`'s failure line. */
export function branchFailure(message: string): string {
  return `Failed to branch conversation: ${message}`;
}

/**
 * Source `se`'s guards, in the order the storage branch raises them. A source with no journal
 * row, or one whose rows cannot be read, has nothing to branch.
 */
export function branchFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  return branchFailure(message);
}
