// Readable seam over the recovered per-turn diff history. The pure helpers are copied verbatim in
// ./diff-turn-source.ts; `ne`, a React-style memo hook, is adapted to an incremental accumulator.
//
// Source: chunk-twzxjzbk.js (sha256 84e9dd9e0d193d0d9e64cfdf3534a0f0c2f2b42cee51236346b5eef34b7dd35b),
// zero-based UTF-16 half-open ranges. `Rt` [17903,18122)
// recognizes a diff tool result, `St` [18122,18194) the create/update types, `Mt` [18194,18338)
// counts hunk lines, `Ct` [18338,18487) builds the 30-character prompt preview, `we`
// [18487,18642) settles turn stats, `ri` [22140,22184) wraps a turn as a source entry and `Ie`
// [22184,22672) converts a turn to the dialog diff data shape. `ne` [18642,20073) walks messages
// into completed turns.
import { Rt, St, Mt, Ct, we, ri, Ie } from './diff-turn-source.js';

export interface TurnDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface TurnDiffFile {
  filePath: string;
  hunks: TurnDiffHunk[];
  isNewFile: boolean;
  linesAdded: number;
  linesRemoved: number;
}

export interface TurnDiffStats {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
}

export interface TurnDiff {
  turnIndex: number;
  userPromptPreview: string;
  timestamp?: string | number;
  files: Map<string, TurnDiffFile>;
  stats: TurnDiffStats;
}

export interface TurnDiffMessage {
  type?: string;
  message?: { content?: string | Array<{ type?: string }> };
  toolUseResult?: unknown;
  isMeta?: boolean;
  timestamp?: string | number;
}

export interface TurnDiffData {
  stats: { filesCount: number; linesAdded: number; linesRemoved: number };
  files: Array<{
    path: string; linesAdded: number; linesRemoved: number;
    isBinary: boolean; isLargeFile: boolean; isTruncated: boolean; isNewFile: boolean;
  }>;
  hunks: Map<string, TurnDiffHunk[]>;
  loading: false;
  source: { kind: 'working-tree' };
  baseMode: 'auto';
}

/** Source `Rt`: a tool result carries a file path plus a structured patch or created content. */
export const isTurnDiffResult = Rt as (value: unknown) => boolean;
/** Source `St`: the create/update result types. */
export const isCreatedOrUpdatedResult = St as (value: unknown) => boolean;
/** Source `Mt`: count added and removed lines across hunks. */
export const countTurnHunkLines = Mt as (hunks: readonly TurnDiffHunk[]) => { added: number; removed: number };
/** Source `Ct`: the user prompt preview. */
export const turnPromptPreview = Ct as (message: TurnDiffMessage) => string;
/** Source `we`: settle a turn's stats from its file rows. */
export const settleTurnStats = we as (turn: TurnDiff) => void;
/** Source `ri`: wrap a completed turn as a dialog turn source. */
export const turnSource = ri as (turn: TurnDiff) => { type: 'turn'; turn: TurnDiff };
/** Source `Ie`: turn files and hunks to the dialog diff data shape. */
export const turnToDiffData = Ie as (turn: TurnDiff) => TurnDiffData;

/**
 * Source `ne` adapted from a memo hook to an incremental accumulator. It walks only messages added
 * since the previous call, starts a turn on each non-meta user message without a tool result,
 * folds diff tool results into the open turn, and returns completed turns newest first. A message
 * list that shrinks resets the walk, as the source ref does.
 */
export class TurnDiffAccumulator {
  #completedTurns: TurnDiff[] = [];
  #currentTurn: TurnDiff | null = null;
  #lastProcessedIndex = 0;
  #lastTurnIndex = 0;

  update(messages: readonly TurnDiffMessage[]): TurnDiff[] {
    if (messages.length < this.#lastProcessedIndex) {
      this.#completedTurns = [];
      this.#currentTurn = null;
      this.#lastProcessedIndex = 0;
      this.#lastTurnIndex = 0;
    }
    for (let index = this.#lastProcessedIndex; index < messages.length; index++) {
      const message = messages[index];
      if (!message || message.type !== 'user') continue;
      const content = message.message?.content;
      const toolResult = message.toolUseResult;
      const isToolResultMessage = Boolean(toolResult)
        || (Array.isArray(content) && content[0]?.type === 'tool_result');
      if (!isToolResultMessage && !message.isMeta) {
        if (this.#currentTurn !== null && this.#currentTurn.files.size > 0) {
          settleTurnStats(this.#currentTurn);
          this.#completedTurns.push(this.#currentTurn);
        }
        this.#lastTurnIndex++;
        this.#currentTurn = {
          turnIndex: this.#lastTurnIndex,
          userPromptPreview: turnPromptPreview(message),
          timestamp: message.timestamp,
          files: new Map(),
          stats: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 },
        };
      } else if (this.#currentTurn !== null && toolResult) {
        this.#foldToolResult(this.#currentTurn, toolResult);
      }
    }
    this.#lastProcessedIndex = messages.length;
    const turns = [...this.#completedTurns];
    if (this.#currentTurn !== null && this.#currentTurn.files.size > 0) {
      settleTurnStats(this.#currentTurn);
      turns.push(this.#currentTurn);
    }
    return turns.reverse();
  }

  #foldToolResult(turn: TurnDiff, result: unknown): void {
    if (!isTurnDiffResult(result)) return;
    const payload = result as {
      filePath: string;
      structuredPatch?: TurnDiffHunk[];
      type?: string;
      content?: string;
    };
    const patch = payload.structuredPatch ?? [];
    const isCreate = payload.type === 'create';
    let file = turn.files.get(payload.filePath);
    if (file === undefined) {
      file = { filePath: payload.filePath, hunks: [], isNewFile: isCreate, linesAdded: 0, linesRemoved: 0 };
      turn.files.set(payload.filePath, file);
    }
    if (isCreate && patch.length === 0 && isCreatedOrUpdatedResult(payload)) {
      const lines = (payload.content ?? '').split('\n');
      file.hunks.push({ oldStart: 0, oldLines: 0, newStart: 1, newLines: lines.length, lines: lines.map((line) => `+${line}`) });
      file.linesAdded += lines.length;
    } else {
      file.hunks.push(...patch);
      const { added, removed } = countTurnHunkLines(patch);
      file.linesAdded += added;
      file.linesRemoved += removed;
    }
    if (isCreate) file.isNewFile = true;
  }
}
