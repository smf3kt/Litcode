import { z } from 'zod';
import type { ToolContext, ToolDefinition } from './tools.js';

export const INTERACTION_LIMITS = Object.freeze({
  questions: 4, options: 4, questionChars: 2000, headerChars: 80,
  labelChars: 100, descriptionChars: 2000, previewChars: 8000, otherChars: 4000,
  planChars: 128 * 1024, findings: 100, fileChars: 4096, summaryChars: 4000,
  payloadBytes: 256 * 1024, outputBytes: 100_000,
  timeoutMs: 300_000, maxTimeoutMs: 600_000, maxPending: 16, maxPendingLimit: 64,
});

export interface QuestionOption { label: string; description: string; preview?: string }
export interface InteractionQuestion {
  question: string;
  header?: string;
  options: QuestionOption[];
  multiSelect: boolean;
}
/** Hosts render an additional Other text entry, separate from the listed options. */
export interface AskUserQuestionRequest { questions: InteractionQuestion[] }
export interface QuestionAnswer {
  questionIndex: number;
  selected: string[];
  other?: string;
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
const askShape = z.object({ questions: z.array(questionShape).min(1).max(INTERACTION_LIMITS.questions) }).strict();
const answerShape = z.object({ answers: z.array(z.object({
  questionIndex: z.number().int().min(0).max(INTERACTION_LIMITS.questions - 1),
  selected: z.array(text(INTERACTION_LIMITS.labelChars)).max(INTERACTION_LIMITS.options),
  other: text(INTERACTION_LIMITS.otherChars).optional(),
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
    throw new Error(`${tool}: invalid data at ${issue.path.join('.') || 'input'} (${issue.code})`);
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
  }
  return result;
}

const stringProperty = (maxLength: number, description?: string) => ({ type: 'string', minLength: 1, maxLength, ...(description ? { description } : {}) });
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
  const callbacks = { ask: options.ask, plan: options.plan, report: options.report };
  const previewFormat = options.previewFormat;
  const dispatch = createQueue(timeoutMs, maxPending);
  return [
    {
      readOnly: true,
      schema: {
        name: 'ask_user_question',
        description: 'Ask the user 1-4 finite preference or decision questions with 2-4 labeled options each. ' +
          'The host supplies an Other text entry. multiSelect permits multiple options and Other together. ' +
          'Optional previews show concrete layouts or examples for the focused option. ' +
          'Never request credentials, passwords, tokens, payment details or authentication codes. Requires a host ask callback.',
        input_schema: {
          type: 'object', additionalProperties: false, required: ['questions'],
          properties: { questions: {
            type: 'array', minItems: 1, maxItems: INTERACTION_LIMITS.questions,
            items: {
              type: 'object', additionalProperties: false, required: ['question', 'options', 'multiSelect'],
              properties: {
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
              },
            },
          } },
        },
      },
      async execute(input, context) {
        checkSignal(context.signal);
        const request = parse(askShape, input, 'ask_user_question');
        if (previewFormat === 'html') {
          for (const question of request.questions) for (const option of question.options) {
            const error = previewFragmentError(option.preview);
            if (error !== null) throw new Error(`ask_user_question: Option "${option.label}" in question "${question.question}": ${error}`);
          }
        }
        const ask = callbacks.ask ?? contextCallbacks(context)?.ask;
        if (typeof ask !== 'function') throw new Error('ask_user_question: host ask callback is missing');
        const expected = structuredClone(request);
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
