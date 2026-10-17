import { z } from 'zod';
import type { ModelProvider } from './provider.js';

export type OutputFormat = 'text' | 'json' | 'stream-json';
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export const STRUCTURED_OUTPUT_LIMITS = Object.freeze({
  schemaBytes: 256 * 1024,
  schemaNodes: 2000,
  depth: 64,
  outputBytes: 4 * 1024 * 1024,
  valueNodes: 100_000,
  issues: 20,
  validationSteps: 200_000,
});
export const JSON_SCHEMA_LIMITS: readonly string[] = [
  'JSON Schema subset: type (including type arrays), properties, required, boolean/schema additionalProperties, single-schema items, enum, anyOf, minLength/maxLength, minItems/maxItems, minimum/maximum and exclusiveMinimum/exclusiveMaximum',
  'Schema annotations: title, description and $schema are inert; all other keywords, references, formats, regexes, conditionals and tuple schemas are rejected explicitly',
  'String lengths count Unicode codepoints; enum equality compares JSON structurally; JSON must be a complete value without code fences or trailing text',
  'Validation has schema/output byte, depth, node, issue and traversal budgets; bounded failures are explicit schema errors',
];

// Recovered workflow schema-mode surface (chunk-5wc3wh5m.js `Ea`/`me`,
// chunk-hedqf2m1.js offsets 38678-39487): the tool name, its model-facing
// prompt (sent as the API tool description by `Kro`, chunk-sfn1dbxq.js offset
// 823307), the success payload, the retry cap (`xhn` in chunk-4t0s8gye.js) and
// the system note appended for a custom agent type (`bs`).
export const STRUCTURED_OUTPUT_TOOL_NAME = 'StructuredOutput';
export const STRUCTURED_OUTPUT_TOOL_PROMPT = 'Use this tool to return your final response in the requested structured format. You MUST call this tool exactly once at the end of your response to provide the structured output.';
export const STRUCTURED_OUTPUT_SUCCESS = 'Structured output provided successfully';
export const STRUCTURED_OUTPUT_RETRY_LIMIT = 5;
export const STRUCTURED_OUTPUT_NUDGE = '[structured-output-enforce]';
export const STRUCTURED_OUTPUT_SYSTEM_NOTE = `

---

NOTE: You are running inside a workflow script. You MUST return your final answer by calling the ${STRUCTURED_OUTPUT_TOOL_NAME} tool exactly once — the tool's input schema defines the required shape. Do your work, then call ${STRUCTURED_OUTPUT_TOOL_NAME}; do NOT put your answer in a text response (the script reads ONLY the tool call). If validation fails, read the error and call ${STRUCTURED_OUTPUT_TOOL_NAME} again with a corrected shape.`;

export type SchemaIssue = { path: string; keyword: string; message: string };
export type SchemaValidation = { valid: true; value: JsonValue } | { valid: false; issues: SchemaIssue[] };
export type FinalSchemaError = { code: 'invalid_json' | 'schema_validation' | 'output_limit'; message: string; issues: SchemaIssue[] };
export type TextValidation = { valid: true; value: JsonValue } | { valid: false; error: FinalSchemaError };
export interface CompiledJsonSchema {
  validate(value: unknown): SchemaValidation;
  validateText(text: string): TextValidation;
}

type JsonType = 'null' | 'boolean' | 'number' | 'integer' | 'string' | 'array' | 'object';
type Schema = {
  type?: JsonType | JsonType[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  items?: Schema;
  enum?: JsonValue[];
  anyOf?: Schema[];
  minLength?: number; maxLength?: number; minItems?: number; maxItems?: number;
  minimum?: number; maximum?: number; exclusiveMinimum?: number; exclusiveMaximum?: number;
};
const types = z.enum(['null', 'boolean', 'number', 'integer', 'string', 'array', 'object']);
const nonnegative = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const nodeShape = z.object({
  type: z.union([types, z.array(types).nonempty()]).optional(),
  properties: z.record(z.unknown()).optional(), required: z.array(z.string()).optional(),
  additionalProperties: z.union([z.boolean(), z.record(z.unknown())]).optional(),
  items: z.record(z.unknown()).optional(), enum: z.array(z.unknown()).nonempty().optional(),
  anyOf: z.array(z.record(z.unknown())).nonempty().optional(),
  minLength: nonnegative.optional(), maxLength: nonnegative.optional(),
  minItems: nonnegative.optional(), maxItems: nonnegative.optional(),
  minimum: z.number().finite().optional(), maximum: z.number().finite().optional(),
  exclusiveMinimum: z.number().finite().optional(), exclusiveMaximum: z.number().finite().optional(),
  title: z.string().optional(), description: z.string().optional(), $schema: z.string().optional(),
}).strict();

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function pointer(parent: string, key: string | number): string {
  return `${parent}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
}
function inspectJson(value: unknown, limits: { nodes: number; depth: number; bytes: number }): string | undefined {
  let nodes = 0;
  const ancestors = new Set<object>();
  const visit = (item: unknown, depth: number): boolean => {
    if (++nodes > limits.nodes || depth > limits.depth) return false;
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return true;
    if (typeof item === 'number') return Number.isFinite(item);
    if (typeof item !== 'object') return false;
    if (ancestors.has(item)) return false;
    ancestors.add(item);
    let valid = true;
    if (Array.isArray(item)) {
      // Cross-realm arrays (a workflow script's JSON.parse and its `args` live in
      // the VM realm) are plain arrays; only own indices may exist.
      if (Reflect.ownKeys(item).some((key) => key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key)))) valid = false;
      else for (let i = 0; i < item.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(i));
        if (!descriptor || !('value' in descriptor) || !visit(descriptor.value, depth + 1)) { valid = false; break; }
      }
    } else {
      const prototype = Object.getPrototypeOf(item);
      // A plain record's prototype is Object.prototype in its own realm, and a
      // cross-realm Object.prototype terminates in null just as the host's does.
      // Class instances (a further prototype above the immediate prototype) are
      // still rejected; only own enumerable data properties are read below.
      if (prototype !== Object.prototype && prototype !== null && Object.getPrototypeOf(prototype) !== null) valid = false;
      else for (const key of Reflect.ownKeys(item)) {
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        // Data only: even non-enumerable toJSON/accessors must never execute.
        if (typeof key !== 'string' || !descriptor || !descriptor.enumerable || !('value' in descriptor) || !visit(descriptor.value, depth + 1)) { valid = false; break; }
      }
    }
    ancestors.delete(item);
    return valid;
  };
  if (!visit(value, 0)) return 'Value is not finite JSON data or exceeds its depth/node budget';
  if (Buffer.byteLength(JSON.stringify(value)) > limits.bytes) return 'Value exceeds its JSON byte budget';
  return undefined;
}
function jsonEqual(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
  if (record(a) && record(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && jsonEqual(a[key] as JsonValue, b[key] as JsonValue));
  }
  return false;
}
function hasType(value: JsonValue, type: JsonType): boolean {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return record(value);
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  return typeof value === type;
}

/**
 * Compile a workflow agent's structured-output schema. The API accepts only an
 * object-rooted tool input schema, which is the recovered root check
 * (`ie`/`$ot` in chunk-5wc3wh5m.js).
 */
export function compileStructuredOutputSchema(schema: unknown): CompiledJsonSchema {
  if (!record(schema) || schema.type !== 'object') {
    throw new Error("the root schema must declare type: 'object' (the API rejects any other root type for a tool input schema); wrap arrays or primitives in an object property");
  }
  return compileJsonSchema(schema);
}

/** `Ze` (chunk-5wc3wh5m.js offset ~4700): `${instancePath || 'root'}: ${message}`. */
export function formatSchemaIssues(issues: readonly SchemaIssue[]): string {
  return issues.map(issue => `${issue.path || 'root'}: ${issue.message}`).join(', ');
}

export function compileJsonSchema(schema: unknown): CompiledJsonSchema {
  const invalid = inspectJson(schema, { nodes: STRUCTURED_OUTPUT_LIMITS.schemaNodes * 10, depth: STRUCTURED_OUTPUT_LIMITS.depth, bytes: STRUCTURED_OUTPUT_LIMITS.schemaBytes });
  if (invalid) throw new Error(`Invalid final-output schema: ${invalid}`);
  // Clone JSON into inert objects before Zod or the validator traverses it.
  const copy = JSON.parse(JSON.stringify(schema)) as unknown;
  let count = 0;
  const compile = (raw: unknown, path: string): Schema => {
    if (++count > STRUCTURED_OUTPUT_LIMITS.schemaNodes) throw new Error('Final-output schema exceeds node budget');
    const parsed = nodeShape.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(`Unsupported or invalid final-output schema at ${path || '/'}: ${issue.code}${issue.path.length ? ` (${issue.path.join('.')})` : ''}`);
    }
    const node = parsed.data;
    if (node.required && new Set(node.required).size !== node.required.length) throw new Error(`Duplicate required field at ${path || '/'}`);
    if (Array.isArray(node.type) && new Set(node.type).size !== node.type.length) throw new Error(`Duplicate type at ${path || '/'}`);
    for (const [min, max] of [[node.minLength, node.maxLength], [node.minItems, node.maxItems], [node.minimum, node.maximum]]) {
      if (min !== undefined && max !== undefined && min > max) throw new Error(`Inverted schema bounds at ${path || '/'}`);
    }
    const result: Schema = { ...node } as Schema;
    delete result.properties;
    if (record(raw) && record(raw.properties)) {
      const properties: Record<string, Schema> = Object.create(null);
      for (const [key, child] of Object.entries(raw.properties)) properties[key] = compile(child, pointer(pointer(path, 'properties'), key));
      result.properties = properties;
    }
    if (record(node.additionalProperties)) result.additionalProperties = compile(node.additionalProperties, pointer(path, 'additionalProperties'));
    if (node.items) result.items = compile(node.items, pointer(path, 'items'));
    if (node.anyOf) result.anyOf = node.anyOf.map((child, i) => compile(child, pointer(pointer(path, 'anyOf'), i)));
    if (node.enum) result.enum = node.enum as JsonValue[];
    return result;
  };
  const root = compile(copy, '');
  const validate = (value: unknown): SchemaValidation => {
    const invalidValue = inspectJson(value, { nodes: STRUCTURED_OUTPUT_LIMITS.valueNodes, depth: STRUCTURED_OUTPUT_LIMITS.depth, bytes: STRUCTURED_OUTPUT_LIMITS.outputBytes });
    if (invalidValue) return { valid: false, issues: [{ path: '', keyword: 'json', message: invalidValue }] };
    const clean = JSON.parse(JSON.stringify(value)) as JsonValue;
    let steps = 0;
    const check = (node: Schema, data: JsonValue, path: string): SchemaIssue[] => {
      if (++steps > STRUCTURED_OUTPUT_LIMITS.validationSteps) throw new Error('Final-output validation exceeds traversal budget');
      const issues: SchemaIssue[] = [];
      const issue = (keyword: string, message: string, at = path) => { if (issues.length < STRUCTURED_OUTPUT_LIMITS.issues) issues.push({ path: at, keyword, message }); };
      const merge = (items: SchemaIssue[]) => { issues.push(...items.slice(0, STRUCTURED_OUTPUT_LIMITS.issues - issues.length)); };
      if (node.type && !(Array.isArray(node.type) ? node.type : [node.type]).some((type) => hasType(data, type))) {
        issue('type', `Expected ${Array.isArray(node.type) ? node.type.join(' or ') : node.type}`); return issues;
      }
      if (node.enum && !node.enum.some((item) => jsonEqual(item, data))) issue('enum', 'Value does not match an enum member');
      if (node.anyOf && !node.anyOf.some((child) => check(child, data, path).length === 0)) issue('anyOf', 'Value does not match any allowed schema');
      if (typeof data === 'string') {
        const length = [...data].length;
        if (node.minLength !== undefined && length < node.minLength) issue('minLength', `Requires at least ${node.minLength} codepoints`);
        if (node.maxLength !== undefined && length > node.maxLength) issue('maxLength', `Requires at most ${node.maxLength} codepoints`);
      }
      if (typeof data === 'number') {
        if (node.minimum !== undefined && data < node.minimum) issue('minimum', `Requires a value >= ${node.minimum}`);
        if (node.maximum !== undefined && data > node.maximum) issue('maximum', `Requires a value <= ${node.maximum}`);
        if (node.exclusiveMinimum !== undefined && data <= node.exclusiveMinimum) issue('exclusiveMinimum', `Requires a value > ${node.exclusiveMinimum}`);
        if (node.exclusiveMaximum !== undefined && data >= node.exclusiveMaximum) issue('exclusiveMaximum', `Requires a value < ${node.exclusiveMaximum}`);
      }
      if (Array.isArray(data)) {
        if (node.minItems !== undefined && data.length < node.minItems) issue('minItems', `Requires at least ${node.minItems} items`);
        if (node.maxItems !== undefined && data.length > node.maxItems) issue('maxItems', `Requires at most ${node.maxItems} items`);
        if (node.items) for (let i = 0; i < data.length && issues.length < STRUCTURED_OUTPUT_LIMITS.issues; i++) merge(check(node.items, data[i], pointer(path, i)));
      } else if (record(data)) {
        for (const key of node.required ?? []) if (!Object.hasOwn(data, key)) issue('required', 'Required property is missing', pointer(path, key));
        for (const [key, child] of Object.entries(data)) {
          if (issues.length >= STRUCTURED_OUTPUT_LIMITS.issues) break;
          if (node.properties && Object.hasOwn(node.properties, key)) merge(check(node.properties[key], child as JsonValue, pointer(path, key)));
          else if (node.additionalProperties === false) issue('additionalProperties', 'Additional property is disallowed', pointer(path, key));
          else if (record(node.additionalProperties)) merge(check(node.additionalProperties as Schema, child as JsonValue, pointer(path, key)));
        }
      }
      return issues;
    };
    let issues: SchemaIssue[];
    try { issues = check(root, clean, ''); }
    catch { issues = [{ path: '', keyword: 'limit', message: 'Final-output validation exceeds traversal budget' }]; }
    return issues.length ? { valid: false, issues } : { valid: true, value: clean };
  };
  return {
    validate,
    validateText(text): TextValidation {
      if (Buffer.byteLength(text) > STRUCTURED_OUTPUT_LIMITS.outputBytes) return { valid: false, error: { code: 'output_limit', message: 'Final output exceeds JSON byte budget', issues: [] } };
      let value: unknown;
      try { value = JSON.parse(text); }
      catch { return { valid: false, error: { code: 'invalid_json', message: 'Final text is not a complete JSON value', issues: [] } }; }
      const result = validate(value);
      return result.valid ? result : { valid: false, error: { code: 'schema_validation', message: 'Final JSON does not match the requested schema', issues: result.issues } };
    },
  };
}

export type TokenUsage = { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
export type HeadlessResultInput = { reason: string; text: string; modelCalls: number; usage?: TokenUsage | null };
export type HeadlessResult = { session_id: string; reason: string; text: string; model_calls: number; usage: TokenUsage | null; structured_output?: JsonValue; error?: FinalSchemaError };
export type HeadlessEvent =
  | { type: 'text'; text: string }
  | { type: 'status'; message: string }
  | { type: 'tool_start'; id: string; name: string }
  | { type: 'tool_result'; id: string; name?: string; is_error: boolean; content: JsonValue }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'error'; code: string; message: string };
export type HeadlessLineEvent = (HeadlessEvent | { type: 'result'; result: HeadlessResult }) & { sequence: number; session_id: string };
export type HeadlessOutputOptions = { format: OutputFormat; sessionId: string; write: (text: string) => void; writeError?: (text: string) => void; schema?: unknown };
export interface HeadlessOutput {
  text(delta: string): void;
  status(message: string): void;
  event(event: HeadlessEvent): void;
  finish(result: HeadlessResultInput): HeadlessResult;
}
const usageShape = z.object({ input_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), output_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), cache_creation_input_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(), cache_read_input_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional() }).strict();
function validUsage(value: TokenUsage): TokenUsage { return usageShape.parse(value); }

export function createHeadlessOutput(options: HeadlessOutputOptions): HeadlessOutput {
  if (!['text', 'json', 'stream-json'].includes(options.format)) throw new Error('Invalid headless output format');
  if (!options.sessionId || /[\x00-\x1f]/.test(options.sessionId)) throw new Error('Invalid headless session id');
  const schema = options.schema === undefined ? undefined : compileJsonSchema(options.schema);
  let finished: HeadlessResult | undefined;
  let sequence = 0;
  let hasText = false;
  let lastText = '';
  const assertOpen = () => { if (finished) throw new Error('Headless output already finished'); };
  const line = (event: HeadlessEvent | { type: 'result'; result: HeadlessResult }) => {
    const fields: Record<string, unknown> = event.type === 'text' ? { type: event.type, text: event.text }
      : event.type === 'status' ? { type: event.type, message: event.message }
      : event.type === 'tool_start' ? { type: event.type, id: event.id, name: event.name }
      : event.type === 'tool_result' ? { type: event.type, id: event.id, ...(event.name === undefined ? {} : { name: event.name }), is_error: event.is_error, content: event.content }
      : event.type === 'usage' ? { type: event.type, usage: event.usage }
      : event.type === 'error' ? { type: event.type, code: event.code, message: event.message }
      : { type: event.type, result: event.result };
    const envelope = { ...fields, sequence: ++sequence, session_id: options.sessionId };
    options.write(JSON.stringify(envelope) + '\n');
  };
  const adapter: HeadlessOutput = {
    text(delta) {
      assertOpen();
      if (!delta) return;
      if (options.format === 'stream-json') line({ type: 'text', text: delta });
      else if (options.format === 'text' && !schema) { options.write(delta); hasText = true; lastText = delta; }
    },
    status(message) {
      assertOpen();
      if (options.format === 'stream-json') line({ type: 'status', message });
      else options.writeError?.(message + '\n');
    },
    event(event) {
      assertOpen();
      if (event.type === 'text') { adapter.text(event.text); return; }
      if (event.type === 'status') { adapter.status(event.message); return; }
      if (event.type === 'usage') event = { type: 'usage', usage: validUsage(event.usage) };
      if (event.type === 'tool_result' && inspectJson(event.content, { nodes: STRUCTURED_OUTPUT_LIMITS.valueNodes, depth: STRUCTURED_OUTPUT_LIMITS.depth, bytes: STRUCTURED_OUTPUT_LIMITS.outputBytes })) throw new Error('Tool event content must be bounded JSON data');
      if (options.format === 'stream-json') line(event);
      else if (event.type === 'error') options.writeError?.(`${event.code}: ${event.message}\n`);
    },
    finish(input) {
      if (finished) return finished;
      if (!Number.isSafeInteger(input.modelCalls) || input.modelCalls < 0) throw new Error('Invalid model call count');
      const result: HeadlessResult = { session_id: options.sessionId, reason: input.reason, text: input.text, model_calls: input.modelCalls, usage: input.usage == null ? null : validUsage(input.usage) };
      if (schema && (input.reason === 'end_turn' || input.reason === 'stop_sequence')) {
        const validation = schema.validateText(input.text);
        if (validation.valid) result.structured_output = validation.value;
        else { result.error = validation.error; result.reason = 'schema_error'; }
      }
      finished = result;
      if (options.format === 'json') options.write(JSON.stringify(result) + '\n');
      else if (options.format === 'stream-json') line({ type: 'result', result });
      else if (result.error) options.writeError?.(`schema_error: ${JSON.stringify(result.error)}\n`);
      else if (schema || !hasText) options.write(result.text + (result.text.endsWith('\n') || !result.text ? '' : '\n'));
      else if (!lastText.endsWith('\n')) options.write('\n');
      return result;
    },
  };
  return adapter;
}

export const USAGE_BUDGET_LIMITS: readonly string[] = [
  'Call reservations are synchronous and shared across every completion using the wrapped provider, including hooks, child agents and compaction; token-count requests delegate without consuming completion calls',
  'Token limits use actual response usage including cache input tokens; an in-flight response may exceed its budget, is counted in full and throws UsageBudgetExceeded before returning to Agent',
  'Concurrent calls admitted before token usage arrives may overshoot token limits; maxCalls is enforced before each completion, and failed completion attempts still consume a call',
  'No dollar rates, inferred costs, provider internal retries or unseen external calls are counted; usage counters describe only completions routed through this wrapper',
];
export type UsageBudgetLimits = { maxCalls?: number; maxInputTokens?: number; maxOutputTokens?: number; maxTotalTokens?: number };
export type UsageBudgetSnapshot = { model_calls: number; usage: TokenUsage; exhausted: boolean; exceeded: (keyof UsageBudgetLimits)[] };
export class UsageBudgetExceeded extends Error {
  readonly code = 'usage_budget_exceeded';
  constructor(readonly dimensions: (keyof UsageBudgetLimits)[]) { super(`Usage budget exhausted: ${dimensions.join(', ')}`); this.name = 'UsageBudgetExceeded'; }
}
export class UsageBudget {
  private calls = 0;
  private usage: TokenUsage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
  private readonly limits: UsageBudgetLimits;
  constructor(limits: UsageBudgetLimits = {}) {
    for (const [key, value] of Object.entries(limits)) if (!['maxCalls', 'maxInputTokens', 'maxOutputTokens', 'maxTotalTokens'].includes(key) || !Number.isSafeInteger(value) || value < 0) throw new Error('Usage budgets must contain nonnegative integer limits');
    this.limits = { ...limits };
  }
  private dimensions(inclusive: boolean): (keyof UsageBudgetLimits)[] {
    const input = this.usage.input_tokens + (this.usage.cache_creation_input_tokens ?? 0) + (this.usage.cache_read_input_tokens ?? 0);
    const values: Record<keyof UsageBudgetLimits, number> = { maxCalls: this.calls, maxInputTokens: input, maxOutputTokens: this.usage.output_tokens, maxTotalTokens: input + this.usage.output_tokens };
    return (Object.keys(this.limits) as (keyof UsageBudgetLimits)[]).filter((key) => inclusive ? values[key] >= this.limits[key]! : values[key] > this.limits[key]!);
  }
  /** Reserve before dispatch. Failed model requests still consume a call. */
  beginCall(): void {
    const dimensions = this.dimensions(true);
    if (dimensions.length) throw new UsageBudgetExceeded(dimensions);
    if (!Number.isSafeInteger(this.calls + 1)) throw new Error('Usage call counter overflow');
    this.calls++;
  }
  /** Record actual server-reported usage, including cache input tokens, once per response. */
  recordUsage(value: TokenUsage): void {
    const usage = validUsage(value);
    const next = { ...this.usage };
    for (const key of Object.keys(next) as (keyof TokenUsage)[]) {
      const total = (next[key] ?? 0) + (usage[key] ?? 0);
      if (!Number.isSafeInteger(total)) throw new Error('Usage token counter overflow');
      next[key] = total;
    }
    if (!Number.isSafeInteger(next.input_tokens + (next.cache_creation_input_tokens ?? 0) + (next.cache_read_input_tokens ?? 0) + next.output_tokens)) throw new Error('Usage total token counter overflow');
    this.usage = next;
    const dimensions = this.dimensions(false);
    if (dimensions.length) throw new UsageBudgetExceeded(dimensions);
  }
  snapshot(): UsageBudgetSnapshot { return { model_calls: this.calls, usage: { ...this.usage }, exhausted: this.dimensions(true).length > 0, exceeded: this.dimensions(false) }; }
}

/** Wrap once before sharing the provider with Agent, hooks and compaction. */
export function withUsageBudget(provider: ModelProvider, budget: UsageBudget, onUsage?: (usage: TokenUsage) => void): ModelProvider {
  return {
    async complete(request, signal, onText) {
      signal.throwIfAborted();
      budget.beginCall();
      const response = await provider.complete(request, signal, onText);
      const usage = validUsage({
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      });
      try { budget.recordUsage(usage); }
      catch (error) {
        if (error instanceof UsageBudgetExceeded) {
          // Emit counted usage even when the reply crosses its token budget.
          // A reporting callback must preserve the original budget error.
          try { onUsage?.(usage); } catch { /* preserve budget outcome */ }
        }
        throw error;
      }
      onUsage?.(usage);
      return response;
    },
    count(request, signal) { return provider.count(request, signal); },
  };
}
