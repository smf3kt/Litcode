import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { ToolContext, ToolDefinition } from './tools.js';
import { previewSanitized, previewUnstableInput } from './preview-sanitize.js';

export const INTERACTION_LIMITS = Object.freeze({
  questions: 4, options: 4, questionChars: 2000, headerChars: 80,
  labelChars: 100, descriptionChars: 2000, previewChars: 8000, otherChars: 4000,
  annotationNotesChars: 8192,
  planChars: 128 * 1024, findings: 100, fileChars: 4096, summaryChars: 4000,
  payloadBytes: 256 * 1024, outputBytes: 100_000,
  timeoutMs: 300_000, maxTimeoutMs: 600_000, maxPending: 16, maxPendingLimit: 64,
});

export interface QuestionOption { label: string; description: string; preview?: string }
export type QuestionKind = 'choice' | 'text' | 'number';
export interface InteractionQuestion {
  question: string;
  header?: string;
  options: QuestionOption[];
  multiSelect: boolean;
  /** Extended kinds only; `choice` is filled in when the host enables extended questions. */
  kind?: QuestionKind;
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
}
/** Hosts render an additional Other text entry, separate from the listed options. */
export interface AskUserQuestionRequest { title?: string; questions: InteractionQuestion[] }
export interface QuestionAnswer {
  questionIndex: number;
  selected: string[];
  other?: string;
  /** Recovered `J`: the host may attach the selected preview and free-text notes. */
  annotations?: { preview?: string; notes?: string };
}
export interface AskUserQuestionAnswer { answers: QuestionAnswer[] }
export interface SubmitPlanRequest { plan: string }
export interface SubmitPlanResult { approved: boolean }
export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export interface InteractionFinding {
  file: string;
  line: number;
  summary: string;
  severity: FindingSeverity;
}
export interface ReportFindingsRequest { findings: InteractionFinding[] }
export interface InteractionCallbacks {
  ask?: (request: AskUserQuestionRequest, signal: AbortSignal) => Promise<AskUserQuestionAnswer>;
  /** Card host: returns the shown input plus answers/annotations/response/followUp. */
  askCard?: (request: AskUserQuestionRequest, signal: AbortSignal) => Promise<unknown>;
  plan?: (request: SubmitPlanRequest, signal: AbortSignal) => Promise<SubmitPlanResult>;
  report?: (request: ReportFindingsRequest, signal: AbortSignal) => void | Promise<void>;
}
export interface InteractionToolOptions extends InteractionCallbacks {
  /** Covers both queue waiting and host response time. */
  timeoutMs?: number;
  /** Includes the active host callback, even if it ignores cancellation. */
  maxPending?: number;
  /**
   * The host's preview format. `"html"` applies the recovered fragment rules:
   * a preview must contain markup and must not be a full document or carry
   * script/style tags. Omission leaves previews opaque text.
   */
  previewFormat?: 'html';
  /**
   * Mirrors the host's `extendedQuestionsEnabled` launch option. When set,
   * questions may declare `kind: "text"` (no options) or `kind: "number"`
   * (min..max, optional step/defaultValue/unit), an optional top-level title,
   * and the per-kind field rules from the recovered schema. Omitted kind
   * becomes `"choice"` before the host sees the request.
   */
  extendedQuestions?: boolean;
  /**
   * Uses the recovered card host contract: `askCard` returns the shown input
   * plus `answers`, `annotations`, `response` and `followUp`, which is admitted
   * by `admitCardAnswer` before it is returned. Omission keeps the indexed
   * `ask` answer contract.
   */
  cardAnswers?: boolean;
}

const text = (max: number) => z.string().min(1).max(max).refine(value => value.trim().length > 0, 'Text must be nonblank');
const optionShape = z.object({
  label: text(INTERACTION_LIMITS.labelChars), description: text(INTERACTION_LIMITS.descriptionChars),
  preview: z.string().max(INTERACTION_LIMITS.previewChars).optional(),
}).strict();
const questionShape = z.object({
  question: text(INTERACTION_LIMITS.questionChars), header: text(INTERACTION_LIMITS.headerChars).optional(),
  options: z.array(optionShape).min(2).max(INTERACTION_LIMITS.options), multiSelect: z.boolean(),
}).strict().superRefine((question, ctx) => {
  const labels = question.options.map(option => option.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) ctx.addIssue({ code: 'custom', message: 'Option labels must be unique' });
  if (labels.includes('other')) ctx.addIssue({ code: 'custom', message: 'Other is supplied by the host as a text entry' });
});
/** Recovered `me()`: extended kinds, their field applicability and number bounds. */
const extendedQuestionShape = z.object({
  question: text(INTERACTION_LIMITS.questionChars), header: text(INTERACTION_LIMITS.headerChars).optional(),
  options: z.array(optionShape).max(INTERACTION_LIMITS.options).default(() => []),
  multiSelect: z.boolean().default(false),
  kind: z.enum(['choice', 'text', 'number']).optional(),
  description: z.string().optional(), placeholder: z.string().optional(),
  min: z.number().optional(), max: z.number().optional(), step: z.number().positive().optional(),
  defaultValue: z.number().optional(), unit: z.string().optional(),
}).strict().superRefine((question, ctx) => {
  const kind = question.kind ?? 'choice';
  for (const [field, expected] of [['placeholder', 'text'], ['min', 'number'], ['max', 'number'],
    ['step', 'number'], ['defaultValue', 'number'], ['unit', 'number']] as const) {
    if (kind !== expected && question[field] !== undefined) {
      ctx.addIssue({ code: 'custom', path: [field], message: `${field} applies only to "${expected}" questions.` });
    }
  }
  if (kind === 'choice') {
    if (question.options.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'A choice question needs 2-4 options; use kind "text" for an open-ended question.' });
    }
  } else {
    if (question.options.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: `A "${kind}" question takes no options; remove them or omit kind to ask a choice question.` });
    }
    if (question.multiSelect) {
      ctx.addIssue({ code: 'custom', path: ['multiSelect'], message: `multiSelect applies only to choice questions, not "${kind}".` });
    }
  }
  if (kind === 'number') {
    const { min, max, defaultValue } = question;
    if (min === undefined || max === undefined || !(min < max)) {
      ctx.addIssue({ code: 'custom', path: ['min'], message: 'A number question needs numeric min and max with min < max.' });
      return;
    }
    if (defaultValue !== undefined && (defaultValue < min || defaultValue > max)) {
      ctx.addIssue({ code: 'custom', path: ['defaultValue'], message: 'defaultValue must lie within min..max.' });
    }
  }
  const labels = question.options.map(option => option.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) ctx.addIssue({ code: 'custom', message: 'Option labels must be unique' });
  if (labels.includes('other')) ctx.addIssue({ code: 'custom', message: 'Other is supplied by the host as a text entry' });
});
/** Recovered `Q.check`: question texts are unique across the call. */
function uniqueQuestionTexts(request: { questions: { question: string }[] }, ctx: z.RefinementCtx): void {
  const texts = request.questions.map(question => question.question);
  if (new Set(texts).size !== texts.length) {
    ctx.addIssue({ code: 'custom', path: ['questions'], message: 'Question texts must be unique, option labels must be unique within each question' });
  }
}
const askShape = z.object({ questions: z.array(questionShape).min(1).max(INTERACTION_LIMITS.questions) }).strict().superRefine(uniqueQuestionTexts);
const extendedAskShape = z.object({
  title: z.string().optional(),
  questions: z.array(extendedQuestionShape).min(1).max(INTERACTION_LIMITS.questions),
}).strict().superRefine(uniqueQuestionTexts);
const annotationShape = z.object({
  preview: z.string().optional(),
  notes: z.string().max(INTERACTION_LIMITS.annotationNotesChars).optional(),
}).strict();
const answerShape = z.object({ answers: z.array(z.object({
  questionIndex: z.number().int().min(0).max(INTERACTION_LIMITS.questions - 1),
  selected: z.array(text(INTERACTION_LIMITS.labelChars)).max(INTERACTION_LIMITS.options),
  other: text(INTERACTION_LIMITS.otherChars).optional(),
  annotations: annotationShape.optional(),
}).strict()).min(1).max(INTERACTION_LIMITS.questions) }).strict();
const planShape = z.object({ plan: text(INTERACTION_LIMITS.planChars) }).strict();
const approvalShape = z.object({ approved: z.boolean() }).strict();
const severities = ['info', 'low', 'medium', 'high', 'critical'] as const;
const findingsShape = z.object({ findings: z.array(z.object({
  file: text(INTERACTION_LIMITS.fileChars).refine(value => !/[\x00-\x1f\x7f]/.test(value), 'File must be a path'),
  line: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  summary: text(INTERACTION_LIMITS.summaryChars), severity: z.enum(severities),
}).strict()).max(INTERACTION_LIMITS.findings) }).strict();

// Check budgets before Zod walks arrays or constructs a potentially large error.
function checkData(value: unknown): void {
  let nodes = 0;
  let bytes = 0;
  const visit = (item: unknown, depth: number): void => {
    if (++nodes > 2000 || depth > 12) throw new Error('Interaction data exceeds its traversal budget');
    if (typeof item === 'string') bytes += Buffer.byteLength(item);
    else if (item === null || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))) return;
    else if (typeof item === 'object' && item !== null) {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null && !(Array.isArray(item) && prototype === Array.prototype)) {
        throw new Error('Interaction data must contain plain JSON values');
      }
      if (Array.isArray(item) && item.length > 2000) throw new Error('Interaction data exceeds its traversal budget');
      if (Array.isArray(item)) {
        for (let i = 0; i < item.length; i++) {
          if (!Object.hasOwn(item, i)) throw new Error('Interaction data must contain dense JSON arrays');
        }
      }
      const keys = Reflect.ownKeys(item);
      if (keys.length > 2000) throw new Error('Interaction data exceeds its traversal budget');
      for (const key of keys) {
        if (Array.isArray(item) && key === 'length') continue;
        const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
        if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error('Interaction data must contain plain JSON values');
        }
        bytes += Buffer.byteLength(key);
        visit(descriptor.value, depth + 1);
      }
    } else throw new Error('Interaction data must contain plain JSON values');
    if (bytes > INTERACTION_LIMITS.payloadBytes) throw new Error('Interaction data exceeds its byte budget');
  };
  visit(value, 0);
}

function parse<T>(shape: z.ZodType<T>, input: unknown, tool: string): T {
  checkData(input);
  const result = shape.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    // Recovered schema rules carry model-facing messages; keep them on custom issues.
    const detail = issue.code === 'custom' ? `: ${issue.message}` : '';
    throw new Error(`${tool}: invalid data at ${issue.path.join('.') || 'input'} (${issue.code})${detail}`);
  }
  if (Buffer.byteLength(JSON.stringify(result.data)) > INTERACTION_LIMITS.payloadBytes) {
    throw new Error(`${tool}: data exceeds its byte budget`);
  }
  return result.data;
}

/**
 * Recovered `Ae`: when the host declares HTML previews, a preview must be a
 * self-contained fragment — no full document, no script/style, and at least
 * one markup tag. `undefined` means the preview is opaque text and is not
 * checked.
 */
export function previewFragmentError(preview: string | undefined): string | null {
  if (preview === undefined) return null;
  if (/<\s*(html|body|!doctype)\b/i.test(preview)) return 'preview must be an HTML fragment, not a full document (no <html>, <body>, or <!DOCTYPE>)';
  if (/<\s*(script|style)\b/i.test(preview)) return 'preview must not contain <script> or <style> tags. Use inline styles via the style attribute if needed.';
  if (!/<[a-z][^>]*>/i.test(preview)) return 'preview must contain HTML (previewFormat is set to "html"). Wrap content in a tag like <div> or <pre>.';
  return null;
}

const CARD_LIMITS = Object.freeze({ answerChars: 8192, notesChars: 8192, textChars: 32768, combinedChars: 48000, previewChars: 2000 });

/** Recovered `pc`: fold characters the label pass rejects, then `Zs`. */
function cardPreviewNormalized(value: string): string { return previewSanitized(value); }
/** Recovered `nD`: a truncation marker or a value `xg` still changes is not stable. */
function cardPreviewUnstable(value: string): boolean { return previewUnstableInput(value); }
/** Recovered `pe`: exact shown preview first, then the normalized form within 2000 units. */
function cardPreviewAdmitted(previews: Set<string>, preview: string): boolean {
  if (previews.has(preview)) return true;
  for (const shown of previews) {
    if (shown.length <= CARD_LIMITS.previewChars && cardPreviewNormalized(shown) === preview && !cardPreviewUnstable(shown)) return true;
  }
  return false;
}

/** Recovered `I`: an own field or undefined. */
function own(record: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}
function plainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
const CARD_ANSWER_BOUNDS = Object.freeze({ values: 20000, depth: 64, chars: 1048576 });
interface CardAnswerWalk { values: number; depth: number; chars: number }
interface CardAnswerContainer { container: object; level: number }
/** Recovered `fDe`: count a value and queue object/array containers for the walk. */
function walkCardAnswer(value: unknown, keyChars: number, level: number, state: CardAnswerWalk, pending: CardAnswerContainer[]): boolean {
  state.values++;
  state.chars += keyChars + (typeof value === 'string' ? value.length : 0);
  if (typeof value === 'object' && value !== null) {
    state.depth = Math.max(state.depth, level);
    pending.push({ container: value, level });
  }
  return state.values <= CARD_ANSWER_BOUNDS.values && state.depth <= CARD_ANSWER_BOUNDS.depth && state.chars <= CARD_ANSWER_BOUNDS.chars;
}
/** Recovered `sze`: breadth-first bounds walk over the answer field. */
function cardAnswerWithinBounds(value: unknown): boolean {
  const state: CardAnswerWalk = { values: 0, depth: 0, chars: 0 };
  const pending: CardAnswerContainer[] = [];
  let within = walkCardAnswer(value, 0, 1, state, pending);
  while (within && pending.length > 0) {
    const { container, level } = pending.pop() as CardAnswerContainer;
    if (Array.isArray(container)) {
      for (let index = 0; within && index < container.length; index++) {
        within = walkCardAnswer(container[index], 0, level + 1, state, pending);
      }
      continue;
    }
    for (const key in container) {
      if (!within) break;
      if (Object.hasOwn(container, key)) {
        within = walkCardAnswer((container as Record<string, unknown>)[key], key.length, level + 1, state, pending);
      }
    }
  }
  return within;
}
function jsonRoundtrip(value: unknown): unknown {
  const text = JSON.stringify(value);
  if (text === undefined) throw new TypeError('value is not JSON-serializable');
  return JSON.parse(text);
}
/** Recovered `xHe`: the answer field must stay within bounds and match the shown field after a JSON roundtrip. */
function cardFieldUnchanged(answerValue: unknown, shownValue: unknown): boolean {
  if (!cardAnswerWithinBounds(answerValue)) return false;
  return isDeepStrictEqual(jsonRoundtrip(answerValue), jsonRoundtrip(shownValue));
}
/** Recovered `qht`: comma-join, JSON-quoting parts that hold ", " or a quote. */
function cardAnswerJoin(parts: string[]): string {
  return parts.map(part => part.includes(', ') || part.includes('"') ? JSON.stringify(part) : part).join(', ');
}
/** Recovered `de`: an answer may omit `kind: "choice"` where the shown question carries it. */
function sameQuestions(answered: unknown, shown: unknown): boolean {
  if (!Array.isArray(answered) || !Array.isArray(shown) || answered.length !== shown.length) return false;
  const normalized = shown.map((question, index) => {
    const answer = answered[index];
    if (!plainObject(question) || question.kind !== 'choice' || !plainObject(answer) || Object.hasOwn(answer, 'kind')) return question;
    const { kind: _kind, ...rest } = question;
    return rest;
  });
  return cardFieldUnchanged(answered, normalized);
}
interface CardQuestionInfo { multiSelect: boolean; optionCount: number; previews: Set<string> }
/** Recovered `ce`: the shown question map, tolerating a non-array or absent list. */
function cardQuestionMap(value: unknown): { questions: Map<string, CardQuestionInfo>; extended: boolean } {
  const questions = new Map<string, CardQuestionInfo>();
  if (!Array.isArray(value)) return { questions, extended: false };
  let extended = value.length > 0;
  for (const question of value) {
    if (!plainObject(question)) { extended = false; continue; }
    if (typeof own(question, 'kind') !== 'string') extended = false;
    const text = own(question, 'question');
    if (typeof text !== 'string') continue;
    const optionsValue = own(question, 'options');
    const options = Array.isArray(optionsValue) ? optionsValue : [];
    const previews = new Set<string>();
    for (const option of options) {
      const preview = plainObject(option) ? own(option, 'preview') : undefined;
      if (typeof preview === 'string') previews.add(preview);
    }
    questions.set(text, { multiSelect: own(question, 'multiSelect') === true, optionCount: options.length, previews });
  }
  return { questions, extended };
}
export type CardAnswerAdmission =
  | { kind: 'admitted'; input: Record<string, unknown> }
  | { kind: 'refused'; rule: string };
/**
 * Recovered card answer admission (`V`/`le`). A card host returns the shown
 * input plus `answers`, `annotations`, `response` and (for extended questions)
 * `followUp`; every shown field must be unchanged and every answer key must be
 * a question the card displayed. The default ask contract is separate.
 */
export function admitCardAnswer(shown: AskUserQuestionRequest, answer: unknown): CardAnswerAdmission {
  try {
    return admitCardAnswerUnchecked(shown, answer);
  } catch {
    return { kind: 'refused', rule: 'threw' };
  }
}
function admitCardAnswerUnchecked(shown: AskUserQuestionRequest, answer: unknown): CardAnswerAdmission {
  const refused = (rule: string): CardAnswerAdmission => ({ kind: 'refused', rule });
  if (!plainObject(answer)) return refused('not_an_object');
  const shownRecord = shown as unknown as Record<string, unknown>;
  for (const key of Object.keys(answer)) {
    if (key === 'afkTimeoutMs') return refused('host_field');
    if (key === 'answers' || key === 'annotations' || key === 'response' || key === 'followUp') {
      if (Object.hasOwn(shownRecord, key)) return refused('changed_shown_field');
      continue;
    }
    if (!Object.hasOwn(shownRecord, key)) return refused('unknown_field');
    if (!cardFieldUnchanged(answer[key], shownRecord[key]) &&
        !(key === 'questions' && !Object.hasOwn(shownRecord, 'title') && sameQuestions(answer[key], shownRecord[key]))) {
      return refused('changed_shown_field');
    }
  }
  const { questions, extended } = cardQuestionMap(own(shownRecord, 'questions'));
  const input: Record<string, unknown> = { ...shownRecord };
  let textChars = 0;
  let previewChars = 0;
  const touched = new Set<string>();

  const answers = answer.answers;
  if (answers !== undefined) {
    if (!plainObject(answers)) return refused('answers');
    const admitted: Record<string, string> = Object.create(null);
    for (const key of Object.keys(answers)) {
      const info = questions.get(key);
      if (info === undefined) return refused('answers');
      touched.add(key);
      const value = answers[key];
      if (typeof value === 'string') {
        if (value.length > CARD_LIMITS.answerChars) return refused('answers');
        textChars += value.length;
        admitted[key] = value;
        continue;
      }
      if (!info.multiSelect || !Array.isArray(value) || value.length > info.optionCount + 1) return refused('answers');
      const parts: string[] = [];
      for (const item of value) {
        if (typeof item !== 'string' || item.length > CARD_LIMITS.answerChars) return refused('answers');
        parts.push(item);
      }
      const joined = cardAnswerJoin(parts);
      textChars += joined.length;
      admitted[key] = joined;
    }
    if (!Object.hasOwn(shownRecord, 'answers')) input.answers = admitted;
  }
  const annotations = answer.annotations;
  if (annotations !== undefined) {
    if (!plainObject(annotations)) return refused('annotations');
    const admitted: Record<string, { preview?: string; notes?: string }> = Object.create(null);
    for (const key of Object.keys(annotations)) {
      const info = questions.get(key);
      const value = annotations[key];
      if (info === undefined || !plainObject(value)) return refused('annotations');
      touched.add(key);
      const entry: { preview?: string; notes?: string } = {};
      for (const field of Object.keys(value)) {
        const fieldValue = value[field];
        if (field === 'preview') {
          // Recovered `pe`: an exact shown preview, else its normalized form.
          if (typeof fieldValue !== 'string' || !cardPreviewAdmitted(info.previews, fieldValue)) return refused('annotations');
          previewChars += fieldValue.length;
          entry.preview = fieldValue;
        } else if (field === 'notes') {
          if (typeof fieldValue !== 'string' || fieldValue.length > CARD_LIMITS.notesChars) return refused('annotations');
          textChars += fieldValue.length;
          entry.notes = fieldValue;
        } else return refused('annotations');
      }
      admitted[key] = entry;
    }
    input.annotations = admitted;
  }
  const response = answer.response;
  if (response !== undefined) {
    if (typeof response !== 'string' || response.length > CARD_LIMITS.answerChars) return refused('response');
    textChars += response.length;
    input.response = response;
  }
  const followUp = answer.followUp;
  if (followUp !== undefined) {
    if (typeof followUp !== 'boolean' || !extended) return refused('follow_up');
    input.followUp = followUp;
  }
  for (const key of touched) previewChars += key.length;
  if (textChars > CARD_LIMITS.textChars || textChars + previewChars > CARD_LIMITS.combinedChars) return refused('too_large');
  return { kind: 'admitted', input };
}

function output(value: unknown, context: ToolContext, tool: string): string {
  const json = JSON.stringify(value);
  const configured = Math.floor(context.maxOutputBytes);
  const limit = Number.isFinite(configured) && configured > 0
    ? Math.min(configured, INTERACTION_LIMITS.payloadBytes) : INTERACTION_LIMITS.outputBytes;
  if (Buffer.byteLength(json) > limit) throw new Error(`${tool}: result exceeds the output byte limit`);
  return json;
}

function aborted(): Error { const error = new Error('Interaction aborted'); error.name = 'AbortError'; return error; }
function checkSignal(signal: AbortSignal): void { if (signal.aborted) throw aborted(); }

interface Job { start(): void }
function createQueue(timeoutMs: number, maxPending: number) {
  const waiting: Job[] = [];
  let active: Job | undefined;
  const pump = () => {
    if (active || waiting.length === 0) return;
    active = waiting.shift()!;
    active.start();
  };
  return <T>(signal: AbortSignal, action: (signal: AbortSignal) => Promise<T> | T): Promise<T> => {
    checkSignal(signal);
    if (waiting.length + (active ? 1 : 0) >= maxPending) throw new Error('Interaction queue is full');
    return new Promise<T>((resolve, reject) => {
      const controller = new AbortController();
      let settled = false;
      const finish = (result: { value: T } | { error: unknown }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        const at = waiting.indexOf(job);
        if (at >= 0) waiting.splice(at, 1);
        if ('error' in result) { reject(result.error); controller.abort(result.error); }
        else resolve(result.value);
      };
      const onAbort = () => finish({ error: aborted() });
      const timer = setTimeout(() => {
        const error = new Error('Interaction timed out'); error.name = 'TimeoutError';
        finish({ error });
      }, timeoutMs);
      const job: Job = {
        start() {
          // Retain the slot until the host settles so ignored aborts cannot stack forms.
          const complete = (result: { value: T } | { error: unknown }) => {
            active = undefined;
            finish(result);
            pump();
          };
          void Promise.resolve().then(() => {
            if (settled) return;
            return action(controller.signal);
          }).then(value => complete({ value: value as T }), error => complete({ error }));
        },
      };
      signal.addEventListener('abort', onAbort, { once: true });
      waiting.push(job);
      if (signal.aborted) onAbort();
      pump();
    });
  };
}

/**
 * Recovered `zet` + `P3` annotation block (chunk-24k7d6mw.js [1180104,1180182) and
 * [1178668,1178979)): annotations exist only for a single-select question that shows a
 * preview. A preview is attached when the selected option itself carries the full preview;
 * notes are the trimmed question-level notes text and need no selected option. The source
 * suppresses the annotation for screen readers; this runtime has no screen-reader mode.
 */
export function terminalAnswerAnnotation(
  question: InteractionQuestion,
  selected: readonly string[],
  notes?: string,
): { preview?: string; notes?: string } | undefined {
  if (question.multiSelect || !question.options.some(option => option.preview !== undefined)) return undefined;
  const label = selected[0];
  const option = label === undefined ? undefined : question.options.find(option => option.label === label);
  const preview = option?.preview === undefined ? undefined : { preview: option.preview };
  const trimmed = notes?.trim();
  if (preview === undefined && !trimmed) return undefined;
  return { ...preview, ...(trimmed ? { notes: trimmed } : {}) };
}

function validAnswer(input: unknown, request: AskUserQuestionRequest): AskUserQuestionAnswer {
  const result = parse(answerShape, input, 'ask_user_question host answer');
  if (result.answers.length !== request.questions.length || new Set(result.answers.map(answer => answer.questionIndex)).size !== result.answers.length) {
    throw new Error('ask_user_question: host must answer every question exactly once');
  }
  for (const answer of result.answers) {
    const question = request.questions[answer.questionIndex];
    const selections = answer.selected.length + (answer.other === undefined ? 0 : 1);
    if (!question || selections === 0 || (!question.multiSelect && selections !== 1) ||
        new Set(answer.selected).size !== answer.selected.length ||
        answer.selected.some(label => !question.options.some(option => option.label === label))) {
      throw new Error('ask_user_question: host answer does not match the question choices');
    }
    // Recovered admission (`pe`): an annotated preview must be one this question showed.
    if (answer.annotations?.preview !== undefined &&
        !question.options.some(option => option.preview === answer.annotations!.preview)) {
      throw new Error('ask_user_question: host answer annotation preview does not match a question preview');
    }
  }
  return result;
}

const stringProperty = (maxLength: number, description?: string) => ({ type: 'string', minLength: 1, maxLength, ...(description ? { description } : {}) });
/** The advertised schema matches the active question kind surface. */
function askInputSchema(extended: boolean): Record<string, unknown> {
  const properties = extended ? {
    question: stringProperty(INTERACTION_LIMITS.questionChars),
    header: stringProperty(INTERACTION_LIMITS.headerChars),
  } : {
    question: stringProperty(INTERACTION_LIMITS.questionChars), header: stringProperty(INTERACTION_LIMITS.headerChars),
    multiSelect: { type: 'boolean' },
    options: {
      type: 'array', minItems: 2, maxItems: INTERACTION_LIMITS.options,
      items: { type: 'object', additionalProperties: false, required: ['label', 'description'], properties: {
        label: stringProperty(INTERACTION_LIMITS.labelChars, 'Unique option label; Other is reserved for the host.'),
        description: stringProperty(INTERACTION_LIMITS.descriptionChars),
        preview: { type: 'string', maxLength: INTERACTION_LIMITS.previewChars,
          description: 'Optional text or Markdown example displayed when this option is focused.' },
      } },
    },
  };
  if (extended) {
    return {
      type: 'object', additionalProperties: false, required: ['questions'],
      properties: {
        title: { type: 'string', description: 'Optional single-line heading shown above the questions.' },
        questions: {
          type: 'array', minItems: 1, maxItems: INTERACTION_LIMITS.questions,
          items: { type: 'object', additionalProperties: false, required: ['question'], properties: {
            question: properties.question, header: properties.header, kind: { type: 'string', enum: ['choice', 'text', 'number'] },
            description: { type: 'string' }, placeholder: { type: 'string' },
            min: { type: 'number' }, max: { type: 'number' }, step: { type: 'number', exclusiveMinimum: 0 },
            defaultValue: { type: 'number' }, unit: { type: 'string' },
            options: {
              type: 'array', maxItems: INTERACTION_LIMITS.options, default: [],
              items: { type: 'object', additionalProperties: false, required: ['label', 'description'], properties: {
                label: stringProperty(INTERACTION_LIMITS.labelChars, 'Unique option label; Other is reserved for the host.'),
                description: stringProperty(INTERACTION_LIMITS.descriptionChars),
                preview: { type: 'string', maxLength: INTERACTION_LIMITS.previewChars,
                  description: 'Optional text or Markdown example displayed when this option is focused.' },
              } },
            },
            multiSelect: { type: 'boolean', default: false },
          } },
        },
      },
    };
  }
  return {
    type: 'object', additionalProperties: false, required: ['questions'],
    properties: { questions: {
      type: 'array', minItems: 1, maxItems: INTERACTION_LIMITS.questions,
      items: {
        type: 'object', additionalProperties: false, required: ['question', 'options', 'multiSelect'],
        properties,
      },
    } },
  };
}
function contextCallbacks(context: ToolContext): InteractionCallbacks | undefined {
  return (context as ToolContext & { interaction?: InteractionCallbacks }).interaction;
}

/** Local host interactions only; registering the tools performs no host actions. */
export function createInteractionTools(options: InteractionToolOptions = {}): ToolDefinition[] {
  const timeoutMs = options.timeoutMs ?? INTERACTION_LIMITS.timeoutMs;
  const maxPending = options.maxPending ?? INTERACTION_LIMITS.maxPending;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > INTERACTION_LIMITS.maxTimeoutMs ||
      !Number.isSafeInteger(maxPending) || maxPending < 1 || maxPending > INTERACTION_LIMITS.maxPendingLimit) {
    throw new Error('Invalid interaction timeout or queue limit');
  }
  const callbacks = { ask: options.ask, askCard: options.askCard, plan: options.plan, report: options.report };
  const previewFormat = options.previewFormat;
  const extendedQuestions = options.extendedQuestions === true;
  const cardAnswers = options.cardAnswers === true;
  const dispatch = createQueue(timeoutMs, maxPending);
  return [
    {
      readOnly: true,
      schema: {
        name: 'ask_user_question',
        description: 'Ask the user 1-4 finite preference or decision questions with 2-4 labeled options each. ' +
          'The host supplies an Other text entry. multiSelect permits multiple options and Other together. ' +
          (extendedQuestions
            ? 'Extended kinds: "text" for open-ended input with no options, "number" for a value between min and max with an optional step, defaultValue and unit; omitted kind means "choice". '
            : '') +
          'Optional previews show concrete layouts or examples for the focused option. ' +
          'Never request credentials, passwords, tokens, payment details or authentication codes. Requires a host ask callback.',
        input_schema: askInputSchema(extendedQuestions) as ToolDefinition['schema']['input_schema'],
      },
      async execute(input, context) {
        checkSignal(context.signal);
        const shape = (extendedQuestions ? extendedAskShape : askShape) as unknown as z.ZodType<AskUserQuestionRequest>;
        const request = parse(shape, input, 'ask_user_question');
        if (extendedQuestions) {
          // Recovered `K`: the host card input always carries an explicit kind.
          for (const question of request.questions) question.kind = question.kind ?? 'choice';
        }
        if (previewFormat === 'html') {
          for (const question of request.questions) for (const option of question.options) {
            const error = previewFragmentError(option.preview);
            if (error !== null) throw new Error(`ask_user_question: Option "${option.label}" in question "${question.question}": ${error}`);
          }
        }
        const ask = callbacks.ask ?? contextCallbacks(context)?.ask;
        const askCard = callbacks.askCard ?? contextCallbacks(context)?.askCard;
        const expected = structuredClone(request);
        if (cardAnswers) {
          if (typeof askCard !== 'function') throw new Error('ask_user_question: host askCard callback is missing');
          return dispatch(context.signal, async signal => {
            const admitted = admitCardAnswer(expected, await askCard(request, signal));
            checkSignal(signal);
            if (admitted.kind === 'refused') throw new Error(`ask_user_question: card answer refused (${admitted.rule})`);
            return output(admitted.input, context, 'ask_user_question');
          });
        }
        if (typeof ask !== 'function') throw new Error('ask_user_question: host ask callback is missing');
        return dispatch(context.signal, async signal => {
          const answer = await ask(request, signal);
          checkSignal(signal);
          return output(validAnswer(answer, expected), context, 'ask_user_question');
        });
      },
    },
    {
      readOnly: true,
      schema: {
        name: 'submit_plan',
        description: 'Submit the complete Markdown plan to the host for review. Preserve all sections, steps and validation details. ' +
          'Returns the host approved boolean; approval does not itself execute the plan. Requires a host plan callback.',
        input_schema: { type: 'object', additionalProperties: false, required: ['plan'], properties: {
          plan: stringProperty(INTERACTION_LIMITS.planChars, 'Complete Markdown plan sent unchanged to host review.'),
        } },
      },
      async execute(input, context) {
        checkSignal(context.signal);
        const request = parse(planShape, input, 'submit_plan');
        const plan = callbacks.plan ?? contextCallbacks(context)?.plan;
        if (typeof plan !== 'function') throw new Error('submit_plan: host plan callback is missing');
        // Check both possible outcomes before asking the host to review.
        output({ approved: false }, context, 'submit_plan');
        return dispatch(context.signal, async signal => {
          const result = await plan(request, signal);
          checkSignal(signal);
          return output(parse(approvalShape, result, 'submit_plan host result'), context, 'submit_plan');
        });
      },
    },
    {
      readOnly: true,
      schema: {
        name: 'report_findings',
        description: 'Report up to 100 typed findings with file, 1-based line, summary and severity. ' +
          'An empty findings array reports a clean review. Returns complete validated JSON and optionally notifies a host observer.',
        input_schema: { type: 'object', additionalProperties: false, required: ['findings'], properties: {
          findings: { type: 'array', minItems: 0, maxItems: INTERACTION_LIMITS.findings, items: {
            type: 'object', additionalProperties: false, required: ['file', 'line', 'summary', 'severity'],
            properties: {
              file: stringProperty(INTERACTION_LIMITS.fileChars), line: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
              summary: stringProperty(INTERACTION_LIMITS.summaryChars), severity: { type: 'string', enum: [...severities] },
            },
          } },
        } },
      },
      async execute(input, context) {
        checkSignal(context.signal);
        const request = parse(findingsShape, input, 'report_findings');
        const result = output(request, context, 'report_findings');
        const report = callbacks.report ?? contextCallbacks(context)?.report;
        if (!report) return result;
        return dispatch(context.signal, async signal => {
          await report(request, signal);
          checkSignal(signal);
          return result;
        });
      },
    },
  ];
}
