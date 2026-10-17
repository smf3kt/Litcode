import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import fs, { type FileHandle } from 'node:fs/promises';
import nodePath from 'node:path';
import { parse, type Node } from 'acorn';
import * as walk from 'acorn-walk';
import { compileStructuredOutputSchema, type JsonValue } from './structured-output.js';
import { normalizeBashCommandClamp, normalizeDisallowedTools } from './agent-tool-restrictions.js';

// Ported from the recovered workflow script runtime:
//   parseWorkflowScript  <- `YS` (chunk-rk6tjv7j.js offset 3670)
//   transformScript      <- `Lr` (chunk-hedqf2m1.js offset 15198)
//   compileWorkflowScript<- `qie` (chunk-hedqf2m1.js offset 16762)
//   runWorkflowScript    <- `lr`/`lXn`/`ir` (chunk-hedqf2m1.js 81000-86100;
//                           helpers in chunk-nyce03br.js)
// The run journal is `sn`/`Do`/`Hr`/`No`/`Qr` (chunk-hedqf2m1.js
// 20500-23000): a session-owned journal.jsonl whose chained keys reuse the
// unchanged prefix of agent() calls on resume. The wrapper, hardening, copy
// generator, journal and error projection keep the source semantics; the
// account/progress/remote-mirror layers of the original are not part of this
// local runtime.

export const WORKFLOW_SCRIPT_MAX_BYTES = 524_288;
export const WORKFLOW_JOURNAL_MAX_BYTES = 2 * 1024 * 1024;
const ARRAY_LENGTH_CAP = 4096;
const DEPTH_CAP = 100_000;
const SYNC_TIMEOUT_MS = 30_000;
const AGENT_CAP = 1000;
const LOG_CAP = 1000;
const MARK = '__wRg$';
const RESOLVE = `${MARK}resolve`;
const RESERVED_META_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export type WorkflowScriptPhase = { title: string; detail?: string; model?: string };
export type WorkflowScriptMeta = {
  name: string; description: string; title?: string; whenToUse?: string; phases?: WorkflowScriptPhase[];
};
export type ParsedWorkflowScript = { meta: WorkflowScriptMeta; scriptBody: string };
export type WorkflowScriptParse = ParsedWorkflowScript | { error: string };

export type WorkflowScriptAgentOptions = {
  label?: string; phase?: string; model?: string; effort?: string; isolation?: 'worktree';
  agentType?: string; schema?: unknown; disallowedTools?: string[]; bashCommandClamp?: string[][];
  stallMs?: number;
};
// A bridge returns the child summary; `null` mirrors a skipped child, and
// `{ failure }` mirrors a terminal child failure, which the script sees as
// `null` after the failure is recorded (recovered `kr` at offset 71400).
// `{ structured }` is schema mode's validated object (recovered `Ot`, returned
// to the script instead of the summary). `onStarted` reports the child session
// as soon as it exists, so the journal can record a `started` entry before the
// child finishes.
export type WorkflowAgentStructured = { structured: JsonValue };
export type WorkflowAgentBridge = (
  prompt: string, options: WorkflowScriptAgentOptions, signal: AbortSignal,
  onStarted?: (agentId: string) => void,
) => Promise<string | null | WorkflowAgentStructured | { failure: string }>;

// Journal entries and the key chain are ported from `sn`/`Do`/`Hr`/`No`/`Qr`
// (chunk-hedqf2m1.js 20500-23000). The key chains the previous key with the
// prompt and the execution options, so the longest unchanged prefix of
// agent() calls is reused and the first changed call invalidates everything
// after it.
export type WorkflowScriptJournalEntry =
  | { type: 'launched' }
  | { type: 'started'; key: string; agentId: string; label?: string; phase?: string }
  | { type: 'result'; key: string; agentId: string; result: unknown }
  | { type: 'failed'; key: string; agentId: string };
export type WorkflowScriptJournalState = {
  results: Map<string, { agentId: string; result: unknown }>;
  started: Map<string, { agentId: string }[]>;
  failed: Set<string>;
};
export type WorkflowScriptJournal = {
  directory: string; state: WorkflowScriptJournalState;
  append(entry: WorkflowScriptJournalEntry): Promise<void>;
};
export type WorkflowChildResolution = { name: string; scriptBody: string };
export type RunWorkflowScriptOptions = {
  args?: unknown; signal: AbortSignal; agent: WorkflowAgentBridge; journal?: WorkflowScriptJournal;
  maxAgents?: number; logLimit?: number; syncTimeoutMs?: number;
  // Nested `workflow()`: `kjr` [28921,29977), `Go` [31360,32556), with the
  // child context builder `Ajr` [29977,31050), the one-level rejection `Cjr`
  // [31050,31247) and the phase-name counter `Tjr` [31247,31360) from
  // chunk-hedqf2m1.js. The host resolves a name or {scriptPath} to a parsed
  // child body; the child context carries the rejection instead of a resolver.
  resolveWorkflow?: (request: unknown) => Promise<WorkflowChildResolution>;
};
const NESTED_WORKFLOW_MESSAGE = 'workflow() cannot be called from within a child workflow '
  + '— nesting is limited to one level. Inline the inner script or call its agents directly.';
export type WorkflowScriptError = { name: string; message: string; stack?: string };
export type WorkflowScriptResult = {
  result: unknown; agent_count: number; logs: string[]; failures: string[]; phases: string[];
  duration_ms: number; error?: WorkflowScriptError;
};
type VmCopy = (value: unknown) => unknown;
type VmSettle = (value: unknown) => Promise<{ v: unknown }>;
type VmCall = (fn: unknown, ...args: unknown[]) => unknown;
type VmSnapshot = (value: unknown) => unknown[];
type VmGetProp = (value: unknown, key: unknown) => unknown;
type VmString = (value: unknown) => string;

const NOW_MESSAGE = 'Date.now() / new Date() are unavailable in workflow scripts (breaks resume). '
  + 'Stamp results after the workflow returns, or pass timestamps via args.';
const RANDOM_MESSAGE = 'Math.random() is unavailable in workflow scripts (breaks resume). '
  + 'For N independent samples, include the index in the agent label or prompt.';

// `Sn` (chunk-hedqf2m1.js offset 13422): deterministic time and randomness.
const DATE_SHIM = `(() => {
  'use strict';
  const NOW_ERR = ${JSON.stringify(NOW_MESSAGE)};
  const RANDOM_ERR = ${JSON.stringify(RANDOM_MESSAGE)};
  Math.random = function random() { throw new Error(RANDOM_ERR) };
  const RealDate = Date;
  RealDate.now = function now() { throw new Error(NOW_ERR) };
  function ShimDate(...a) {
    if (!new.target) throw new Error(NOW_ERR);
    if (a.length === 0) throw new Error(NOW_ERR);
    return Reflect.construct(RealDate, a, new.target);
  }
  ShimDate.now = RealDate.now;
  ShimDate.parse = RealDate.parse;
  ShimDate.UTC = RealDate.UTC;
  ShimDate.prototype = RealDate.prototype;
  RealDate.prototype.constructor = ShimDate;
  Object.freeze(RealDate);
  globalThis.Date = ShimDate;
})()`;

// `q3e` (chunk-nyce03br.js offset 128850): remove escape hatches and freeze
// intrinsics so a script cannot reach the host through a thenable or a
// constructor walk.
const HARDEN_SOURCE = `(() => {
  Object.defineProperty(Error, 'prepareStackTrace', {
    value: (err) => { const s = err.stack; return typeof s === 'string' ? s : '' },
    writable: false, configurable: false,
  });
  for (const g of ['ShadowRealm', 'WebAssembly', 'FinalizationRegistry',
                   'WeakRef', 'Atomics', 'SharedArrayBuffer', 'queueMicrotask',
                   '$vm', 'gc', 'edenGC', 'fullGC', 'print', 'readFile', 'Loader']) {
    delete globalThis[g];
  }
  function enableOverride(proto, key) {
    const d = Object.getOwnPropertyDescriptor(proto, key);
    if (!d || 'get' in d) return;
    const v = d.value;
    Object.defineProperty(proto, key, {
      get() { return v },
      set(nv) {
        if (this === proto) return;
        Object.defineProperty(this, key, { value: nv, writable: true, enumerable: true, configurable: true });
      },
      enumerable: d.enumerable, configurable: true,
    });
  }
  const errorCtors = [Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError, AggregateError, globalThis.SuppressedError].filter(Boolean);
  const errorProtos = errorCtors.map(C => C.prototype);
  for (const [proto, keys] of [
    [Object.prototype, Object.getOwnPropertyNames(Object.prototype)],
    [Function.prototype, ['toString', 'constructor', 'name', 'length']],
    [Array.prototype, ['toString', 'constructor']],
    [Date.prototype, ['toString', 'toLocaleString', 'valueOf', 'constructor']],
    ...errorProtos.map(p => [p, ['name', 'message', 'toString', 'constructor']]),
  ]) for (const k of keys) enableOverride(proto, k);
  for (const C of [Promise, Object, Array, Function, globalThis.Iterator,
                   Map, Set, WeakMap, WeakSet,
                   String, Number, Boolean, Symbol, BigInt,
                   Date, RegExp, ArrayBuffer, DataView,
                   ...errorCtors,
                   typeof URL !== 'undefined' ? URL : undefined,
                  ].filter(Boolean)) {
    Object.freeze(C);
    Object.freeze(C.prototype);
  }
  for (const C of [Object.getPrototypeOf(Int8Array),
                   Int8Array, Uint8Array, Uint8ClampedArray,
                   Int16Array, Uint16Array, Int32Array, Uint32Array,
                   globalThis.Float16Array, Float32Array, Float64Array,
                   BigInt64Array, BigUint64Array].filter(Boolean)) {
    Object.freeze(C);
    Object.freeze(C.prototype);
  }
  for (const f of [async()=>{}, function*(){}, async function*(){}]) {
    Object.freeze(f.constructor);
    Object.freeze(f.constructor.prototype);
  }
  for (const C of [globalThis.DisposableStack, globalThis.AsyncDisposableStack,
                   globalThis.Intl].filter(Boolean)) {
    Object.freeze(C);
    if (C.prototype) Object.freeze(C.prototype);
  }
  for (const ns of [JSON, Math, Reflect, Proxy]) Object.freeze(ns);
  Object.defineProperty(globalThis, 'then', {
    value: undefined, writable: false, configurable: false,
  });
  Object.defineProperty(globalThis, 'Error', {
    value: Error, writable: false, enumerable: false, configurable: false,
  });
  if (typeof Intl !== 'undefined') {
    for (const k of Object.getOwnPropertyNames(Intl)) {
      const C = Intl[k];
      if (typeof C === 'function') {
        Object.freeze(C);
        if (C.prototype) Object.freeze(C.prototype);
      }
    }
  }
  for (const it of [
    [][Symbol.iterator](),
    ''[Symbol.iterator](),
    new Map()[Symbol.iterator](),
    new Set()[Symbol.iterator](),
    'a'.matchAll(/a/g),
    ...(typeof Iterator !== 'undefined' && Iterator.from ? [
      [].values().map(x=>x),
      Iterator.from({next:()=>({done:true})}),
    ] : []),
    (function*(){})(),
    (async function*(){})(),
    ...(typeof Intl !== 'undefined' && Intl.Segmenter ? (s => [s, s[Symbol.iterator]()])(new Intl.Segmenter().segment('a')) : []),
  ]) {
    for (let p = Object.getPrototypeOf(it); p; p = Object.getPrototypeOf(p)) {
      Object.freeze(p);
    }
  }
})()`;

// `Lx` + `$x` + `ws` (chunk-nyce03br.js offsets 142992, 143459): the copy
// routine that moves values across the VM boundary. Functions are dropped,
// `__proto__` keys are skipped, cycles are preserved, and runaway arrays,
// depth or stack lost are converted into explicit cap errors.
function copySource(listSeenFirst: boolean): string {
  const listHead = listSeenFirst ? 'const out = []; seen.set(v, out)' : '';
  const listLater = listSeenFirst ? '' : 'const out = []; seen.set(v, out)';
  return `
      const _WeakMap = WeakMap, _WeakSet = WeakSet, _isArray = Array.isArray,
            _keys = Object.keys, _defineProperty = Object.defineProperty,
            _Error = Error, _isSafeInteger = Number.isSafeInteger,
            _isError = typeof Error.isError === 'function' ? Error.isError : null,
            _ownDescriptor = Object.getOwnPropertyDescriptor
      const _capSet = new _WeakSet()
      function capErr(msg) {
        const e = new _Error(msg)
        _capSet.add(e)
        return e
      }
      function isCap(e) {
        try { return _capSet.has(e) } catch { return false }
      }
      function isStackEnd(e) {
        if (_isError === null || !_isError(e)) return false
        const said = _ownDescriptor(e, 'message')
        return said !== undefined && (said.value === 'Maximum call stack size exceeded.' || said.value === 'Maximum call stack size exceeded')
      }
      function lost(e) {
        if (isCap(e)) throw e
        if (isStackEnd(e)) throw capErr('the stack ran out while copying a value across the VM boundary')
      }
      function checkedLength(v) {
        let len
        try { len = v.length } catch (e) {
          lost(e)
          throw new _Error('unable to read array length across the workflow VM boundary')
        }
        if (typeof len !== 'number' || !_isSafeInteger(len)) {
          throw capErr('array length is not a safe integer across the workflow VM boundary')
        }
        if (len > ${ARRAY_LENGTH_CAP}) {
          throw capErr('array length ' + len + ' exceeds the maximum of ${ARRAY_LENGTH_CAP} supported across the workflow VM boundary')
        }
        return len
      }
      const copy = (rootVal) => {
        if (typeof rootVal === 'function') return undefined
        if (rootVal === null || typeof rootVal !== 'object') return rootVal
        const seen = new _WeakMap()
        let childKeys = null, childLength = 0
        function make(v, depth) {
          if (depth > ${DEPTH_CAP}) {
            throw capErr('nesting deeper than ${DEPTH_CAP} levels is not supported across the VM boundary')
          }
          if (_isArray(v)) {
            ${listHead}
            const len = checkedLength(v)
            ${listLater}
            childKeys = null; childLength = len
            return out
          }
          const out = {}; seen.set(v, out)
          childLength = 0
          let ks; try { ks = _keys(v) } catch (e) { lost(e); return out }
          childKeys = ks; childLength = ks.length
          return out
        }
        const root = make(rootVal, 1)
        let src = rootVal, out = root, keys = childKeys, len = childLength, i = 0, depth = 1
        let own = null, below = null
        for (;;) {
          if (i >= len) {
            if (below === null) return root
            own = below; below = own.below
            src = own.src; out = own.out; keys = own.keys; len = own.len; i = own.i; depth = own.depth
            continue
          }
          const at = i++
          let down = null, made
          if (keys === null) {
            try {
              const vi = src[at]
              if (vi === null || typeof vi !== 'object') { out[at] = typeof vi === 'function' ? undefined : vi; continue }
              const hit = seen.get(vi)
              if (hit !== undefined) { out[at] = hit; continue }
              made = out[at] = make(vi, depth + 1)
              down = vi
            } catch (e) { lost(e); out[at] = undefined; continue }
          } else {
            const k = keys[at]
            if (k === '__proto__') continue
            try {
              const vk = src[k]
              if (typeof vk === 'function') continue
              made = vk
              if (vk !== null && typeof vk === 'object') {
                const hit = seen.get(vk)
                if (hit !== undefined) made = hit
                else { made = make(vk, depth + 1); down = vk }
              }
              _defineProperty(out, k, { value: made, writable: true, enumerable: true, configurable: true })
            } catch (e) { lost(e); continue }
          }
          if (down === null || childLength === 0) continue
          if (own === null) own = { src, out, keys, len, i, depth, below }
          else own.i = i
          below = own; own = null
          src = down; out = made; keys = childKeys; len = childLength; i = 0; depth = depth + 1
        }
      }
      return copy`;
}

const SNAPSHOT_SOURCE = `((v) => {
  if (v === null || typeof v !== 'object') return []
  let len
  try { len = v.length } catch (e) { return [] }
  if (typeof len !== 'number' || !Number.isSafeInteger(len)) {
    throw new Error('array length is not a safe integer across the workflow VM boundary')
  }
  if (len > ${ARRAY_LENGTH_CAP}) {
    throw new Error('array length ' + len + ' exceeds the maximum of ${ARRAY_LENGTH_CAP} supported across the workflow VM boundary')
  }
  const out = []
  for (let i = 0; i < len; i++) {
    try { out[i] = v[i] } catch (e) { out[i] = undefined }
  }
  return out
})`;

type ProjectedError = { name: string; message: string; stack?: string };

function projectError(value: unknown): ProjectedError {
  let message = '<unprintable thrown value>';
  let name = 'Error';
  let stack: string | undefined;
  try {
    const m = (value as { message?: unknown } | null)?.message;
    if (typeof m === 'string') message = m;
    else if (typeof value === 'string') message = value;
  } catch { /* independent reads, as in the source */ }
  try {
    const n = (value as { name?: unknown } | null)?.name;
    if (typeof n === 'string') name = n;
  } catch { /* keep default */ }
  try {
    const s = (value as { stack?: unknown } | null)?.stack;
    if (typeof s === 'string') stack = s;
  } catch { /* keep undefined */ }
  return stack === undefined ? { name, message } : { name, message, stack };
}

type VmBoundary = {
  context: ReturnType<typeof vm.createContext>;
  clone: VmCopy; sanitize: VmCopy; settle: VmSettle; call: VmCall;
  snapshot: VmSnapshot; getProp: VmGetProp; vmString: VmString;
  vmJson: (value: unknown) => string | undefined;
};

// One hardened context per executing script (`lr`'s parent context and the
// nested `Ajr` child context both go through this shape).
function createVmBoundary(): VmBoundary {
  const context = vm.createContext(Object.create(null) as object, {
    codeGeneration: { strings: false, wasm: false },
  });
  vm.runInContext(DATE_SHIM, context);
  vm.runInContext(HARDEN_SOURCE, context);
  vm.runInContext(`Object.defineProperty(globalThis, ${JSON.stringify(RESOLVE)}, {
    value: Promise.resolve.bind(Promise),
    writable: false, enumerable: false, configurable: false,
  })`, context);
  const clone = vm.runInContext(`(() => {'use strict';\n${copySource(false)}\n})()`, context) as VmCopy;
  const sanitize = vm.runInContext(`(() => {'use strict';\n${copySource(true)}\n})()`, context) as VmCopy;
  const settle = vm.runInContext('(async v => ({__proto__: null, v: await v}))', context) as VmSettle;
  const call = vm.runInContext('((fn, ...args) => fn(...args))', context) as VmCall;
  const snapshot = vm.runInContext(SNAPSHOT_SOURCE, context) as VmSnapshot;
  const getProp = vm.runInContext('((o, k) => { try { return o == null ? undefined : o[k] } catch { return undefined } })', context) as VmGetProp;
  const vmString = vm.runInContext('((v) => { try { return String(v) } catch { return "<unprintable>" } })', context) as VmString;
  const vmJson = vm.runInContext('((v) => JSON.stringify(v))', context) as (value: unknown) => string | undefined;
  return { context, clone, sanitize, settle, call, snapshot, getProp, vmString, vmJson };
}

function vmError(value: unknown): unknown {
  const { name, message, stack } = projectError(value);
  const toString = () => `${name}: ${message}`;
  Object.setPrototypeOf(toString, null);
  Object.freeze(toString);
  return Object.freeze({ __proto__: null, name, message, stack: stack ?? `${name}: ${message}`, toString });
}

function hostSync<T extends unknown[], R>(fn: (...args: T) => R): (...args: T) => R {
  const wrapped = (...args: T): R => {
    try { return fn(...args); } catch (error) { throw vmError(error); }
  };
  Object.setPrototypeOf(wrapped, null);
  return wrapped;
}

function hostAsync<T extends unknown[], R>(fn: (...args: T) => Promise<R>): (...args: T) => Promise<R> {
  const wrapped = async (...args: T): Promise<R> => {
    try { return await fn(...args); } catch (error) { throw vmError(error); }
  };
  Object.setPrototypeOf(wrapped, null);
  return wrapped;
}

// `Y3e`: log/phase text used for values that are not strings.
function logText(value: unknown): string {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return String(value);
  return '[object]';
}

// --- Meta parser (`YS`) -----------------------------------------------------

type AcornNode = Node & Record<string, any>;

function pureLiteral(node: AcornNode): unknown {
  switch (node.type) {
    case 'Literal': return node.value;
    case 'ArrayExpression':
      return (node.elements as (AcornNode | null)[]).map(element => {
        if (element === null) throw Error('sparse arrays not allowed');
        if (element.type === 'SpreadElement') throw Error('spread not allowed in meta');
        return pureLiteral(element);
      });
    case 'ObjectExpression': return literalObject(node);
    case 'TemplateLiteral': {
      if ((node.expressions as unknown[]).length > 0) throw Error('template interpolation not allowed in meta');
      return (node.quasis as { value: { cooked?: string } }[]).map(quasi => quasi.value.cooked ?? '').join('');
    }
    case 'UnaryExpression': {
      if (node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') {
        return -node.argument.value;
      }
      throw Error('only negative-number unary allowed in meta');
    }
    default: throw Error(`non-literal node type in meta: ${node.type}`);
  }
}

function metaKey(property: AcornNode): string {
  let key: string;
  if (property.key.type === 'Identifier') key = property.key.name;
  else if (property.key.type === 'Literal') key = String(property.key.value);
  else throw Error(`unsupported key type in meta: ${property.key.type}`);
  if (RESERVED_META_KEYS.has(key)) throw Error(`reserved key name not allowed in meta: ${key}`);
  return key;
}

function literalObject(node: AcornNode): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const property of node.properties as AcornNode[]) {
    if (property.type !== 'Property') throw Error('only plain properties allowed in meta');
    if (property.computed) throw Error('computed keys not allowed in meta');
    if (property.method || property.kind !== 'init') throw Error('methods/accessors not allowed in meta');
    result[metaKey(property)] = pureLiteral(property.value);
  }
  return result;
}

function metaValue(raw: Record<string, unknown>): WorkflowScriptParse {
  const name = raw.name;
  if (typeof name !== 'string' || name.length === 0) return { error: 'meta.name must be a non-empty string' };
  const description = raw.description;
  if (typeof description !== 'string' || description.length === 0) {
    return { error: 'meta.description must be a non-empty string' };
  }
  const meta: WorkflowScriptMeta = { name, description };
  if (typeof raw.title === 'string' && raw.title.length > 0) meta.title = raw.title;
  if (typeof raw.whenToUse === 'string') meta.whenToUse = raw.whenToUse;
  if (Array.isArray(raw.phases)) {
    const phases: WorkflowScriptPhase[] = [];
    for (const entry of raw.phases) {
      if (!entry || typeof entry !== 'object' || !('title' in entry)) continue;
      const { title, detail, model } = entry as { title?: unknown; detail?: unknown; model?: unknown };
      if (typeof title !== 'string') continue;
      phases.push({ title, ...(typeof detail === 'string' ? { detail } : {}),
        ...(typeof model === 'string' ? { model } : {}) });
    }
    if (phases.length > 0) meta.phases = phases;
  }
  return { meta, scriptBody: '' };
}

const PLAIN_JS_NOTE = 'Workflow scripts must be plain JavaScript — common causes are TypeScript syntax '
  + '(type annotations, interfaces, generics) and broken string quoting or escaping.';

function formatParseError(error: unknown, source: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const location = (error as { loc?: { line?: unknown; column?: unknown } } | null)?.loc;
  if (!location || typeof location.line !== 'number' || typeof location.column !== 'number') {
    return `Script parse error: ${message}. ${PLAIN_JS_NOTE}`;
  }
  const line = source.split('\n')[location.line - 1];
  if (line === undefined) return `Script parse error: ${message}. ${PLAIN_JS_NOTE}`;
  const column = Math.max(0, Math.min(location.column, line.length));
  const start = Math.max(0, Math.min(column - 40, line.length - 80));
  const excerpt = line.slice(start, start + 80);
  const caret = ' '.repeat(Math.max(0, column - start)) + '^';
  return `Script parse error: ${message}\n\n${excerpt}\n${caret}\n\n${PLAIN_JS_NOTE}`;
}

function isMetaStatement(statement: AcornNode | undefined): statement is AcornNode {
  if (!statement || statement.type !== 'ExportNamedDeclaration') return false;
  const declaration = statement.declaration as AcornNode | undefined;
  if (!declaration || declaration.type !== 'VariableDeclaration') return false;
  if (declaration.kind !== 'const' || declaration.declarations.length !== 1) return false;
  const declarator = declaration.declarations[0] as AcornNode;
  return declarator.id.type === 'Identifier' && declarator.id.name === 'meta'
    && declarator.init?.type === 'ObjectExpression';
}

function bodyAfter(source: string, end: number): string {
  return source.slice(end).replace(/^[;\s]*\n/, '').trimStart();
}

// The recovered `YS` (chunk-rk6tjv7j.js offset 3670) takes `{validateBody: false}`
// and, on the fast path, reads only the meta literal without parsing the body.
// Discovery uses that path so a workflow with a broken body is still listed.
const META_HEAD = /^export\s+const\s+meta\s*=\s*(?=\{)/;

// Returns the index just past the meta object literal, or undefined when the
// text is not a brace-balanced literal. Template interpolation is rejected
// because `pureLiteral` rejects it anyway; comments and quoted strings are
// skipped so a brace inside either does not close the object early.
function metaLiteralEnd(source: string, start: number): number | undefined {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]!;
    if (char === '"' || char === '\'' || char === '`') {
      const quote = char;
      for (index += 1; index < source.length; index += 1) {
        if (source[index] === '\\') index += 1;
        else if (source[index] === quote) break;
        else if (quote === '`' && source[index] === '$' && source[index + 1] === '{') return undefined;
      }
      if (index >= source.length) return undefined;
      continue;
    }
    if (char === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index + 2);
      if (newline < 0) return undefined;
      index = newline;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      const close = source.indexOf('*/', index + 2);
      if (close < 0) return undefined;
      index = close + 1;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return undefined;
}

export function parseWorkflowScript(
  source: string, options: { validateBody?: boolean } = {},
): WorkflowScriptParse {
  if (source.length > WORKFLOW_SCRIPT_MAX_BYTES) return { error: `Script exceeds ${WORKFLOW_SCRIPT_MAX_BYTES} bytes` };
  if (options.validateBody === false) {
    const head = META_HEAD.exec(source);
    const end = head ? metaLiteralEnd(source, head[0].length) : undefined;
    if (end !== undefined) {
      try {
        const expression = (parse(`(${source.slice(head![0].length, end)})`, {
          ecmaVersion: 'latest', sourceType: 'module',
        }) as unknown as AcornNode).body[0] as AcornNode;
        const literal = pureLiteral((expression as AcornNode & { expression: AcornNode }).expression);
        const parsed = metaValue(literal as Record<string, unknown>);
        if ('error' in parsed) return parsed;
        return { meta: parsed.meta, scriptBody: bodyAfter(source, end) };
      } catch {
        // Fall through to the full parse, which reports the real error.
      }
    }
  }
  let program: AcornNode;
  try {
    program = parse(source, {
      ecmaVersion: 'latest', sourceType: 'module',
      allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true,
    }) as unknown as AcornNode;
  } catch (error) {
    return { error: formatParseError(error, source) };
  }
  const statement = program.body[0] as AcornNode | undefined;
  if (!isMetaStatement(statement)) {
    return { error: '`export const meta = { name, description, phases }` must be the FIRST statement in the script' };
  }
  const declaration = statement.declaration as AcornNode;
  const initializer = (declaration.declarations[0] as AcornNode).init as AcornNode;
  let literal: Record<string, unknown>;
  try {
    literal = pureLiteral(initializer) as Record<string, unknown>;
  } catch (error) {
    return { error: `meta must be a pure literal: ${error instanceof Error ? error.message : String(error)}` };
  }
  const parsed = metaValue(literal);
  if ('error' in parsed) return parsed;
  return { meta: parsed.meta, scriptBody: bodyAfter(source, statement.end) };
}

// --- Script file loading (`Chn`, chunk-hedqf2m1.js offset 19175) -------------

function scriptPathRefusal(file: string): string {
  return `scriptPath must be a script path this tool returned, or a file you can already read `
    + `(the working directory or a directory you have added): ${file}\n`
    + 'Pass the whole script inline through workflow_run\'s `script` input instead.';
}

export async function loadWorkflowScriptFile(
  file: string, workspace: string,
): Promise<{ source: string } | { error: string }> {
  const resolved = nodePath.resolve(workspace, file);
  let handle: FileHandle;
  try {
    // O_NOFOLLOW rejects a symbolic link at resolution time; all later checks
    // read the opened descriptor, not the path.
    handle = await fs.open(resolved, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { error: code === 'ENOENT' ? `Workflow script file not found: ${file}`
      : `Failed to read workflow script file ${file}` };
  }
  try {
    const stat = await handle.stat({ bigint: true });
    if (stat.ino === 0n || stat.nlink > 1n) return { error: scriptPathRefusal(file) };
    if (!stat.isFile()) return { error: `Workflow script file ${file} is not a regular file` };
    if (stat.size > BigInt(WORKFLOW_SCRIPT_MAX_BYTES)) {
      return { error: `Workflow script file ${file} exceeds ${WORKFLOW_SCRIPT_MAX_BYTES} bytes` };
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength > WORKFLOW_SCRIPT_MAX_BYTES) {
      return { error: `Workflow script file ${file} exceeds ${WORKFLOW_SCRIPT_MAX_BYTES} bytes` };
    }
    return { source: bytes.toString('utf8') };
  } catch {
    return { error: `Failed to read workflow script file ${file}` };
  } finally {
    await handle.close().catch(() => {});
  }
}

// --- Run journal (`sn`/`Do`/`Hr`/`No`/`Qr`) ---------------------------------

const JOURNAL_KEY = /^v\d+:[0-9a-f]{64}$/;
const JOURNAL_AGENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function journalPromptText(value: unknown): string {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return String(value);
  return `[${typeof value}]`;
}

// `Hr`: options are copied with sorted keys and functions dropped.
function journalOptionsValue(value: unknown): unknown {
  if (typeof value === 'function') return undefined;
  if (Array.isArray(value)) {
    const length = Number.isSafeInteger(value.length) ? value.length : 0;
    const copy: unknown[] = [];
    for (let index = 0; index < length; index++) copy[index] = journalOptionsValue(value[index]);
    return copy;
  }
  if (value !== null && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      if (key === '__proto__') continue;
      copy[key] = journalOptionsValue((value as Record<string, unknown>)[key]);
    }
    return copy;
  }
  return value;
}

/** `No`: chain the previous key, the prompt and the execution options. */
export function workflowAgentJournalKey(
  previous: string, prompt: unknown, options: WorkflowScriptAgentOptions,
): string {
  const selected: Record<string, unknown> = {};
  for (const key of ['schema', 'model', 'effort', 'isolation', 'agentType', 'disallowedTools', 'bashCommandClamp'] as const) {
    const value = options[key];
    if (value === undefined || typeof value === 'function') continue;
    selected[key] = value;
  }
  const digest = createHash('sha256')
    .update(previous).update('\0')
    .update(journalPromptText(prompt)).update('\0')
    .update(JSON.stringify(journalOptionsValue(selected) ?? {}))
    .digest('hex');
  return `v2:${digest}`;
}

function journalState(entries: WorkflowScriptJournalEntry[]): WorkflowScriptJournalState {
  const results: WorkflowScriptJournalState['results'] = new Map();
  const started: WorkflowScriptJournalState['started'] = new Map();
  const failed = new Set<string>();
  for (const entry of entries) {
    if (entry.type === 'result') results.set(entry.key, { agentId: entry.agentId, result: entry.result });
    else if (entry.type === 'started') {
      const list = started.get(entry.key);
      if (list) list.push({ agentId: entry.agentId });
      else started.set(entry.key, [{ agentId: entry.agentId }]);
    } else if (entry.type === 'failed') failed.add(entry.key);
  }
  return { results, started, failed };
}

// `Qr`: only well-formed entries participate. A failed entry written before a
// child existed carries an empty agent id and is ignored on reload, as in the
// recovered validator.
function journalEntry(value: unknown): WorkflowScriptJournalEntry | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const entry = value as Record<string, unknown>;
  if (entry.type === 'launched') return { type: 'launched' };
  if (typeof entry.key !== 'string' || !JOURNAL_KEY.test(entry.key)) return undefined;
  if (typeof entry.agentId !== 'string' || !JOURNAL_AGENT_ID.test(entry.agentId)) return undefined;
  switch (entry.type) {
    case 'started':
      return { type: 'started', key: entry.key, agentId: entry.agentId,
        ...(typeof entry.label === 'string' ? { label: entry.label } : {}),
        ...(typeof entry.phase === 'string' ? { phase: entry.phase } : {}) };
    case 'result':
      return 'result' in entry ? { type: 'result', key: entry.key, agentId: entry.agentId, result: entry.result } : undefined;
    case 'failed':
      return { type: 'failed', key: entry.key, agentId: entry.agentId };
    default:
      return undefined;
  }
}

export function emptyWorkflowScriptJournalState(): WorkflowScriptJournalState {
  return journalState([]);
}

/** Read `journal.jsonl`; an absent file means there is nothing to resume. */
export async function loadWorkflowScriptJournal(directory: string): Promise<WorkflowScriptJournalState | undefined> {
  const file = nodePath.join(directory, 'journal.jsonl');
  let handle: FileHandle;
  try {
    handle = await fs.open(file, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return undefined;
    throw error;
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error('Workflow journal must be a regular file');
    if (stat.size > WORKFLOW_JOURNAL_MAX_BYTES) {
      throw new Error(`Workflow journal exceeds ${WORKFLOW_JOURNAL_MAX_BYTES} bytes`);
    }
    const text = await handle.readFile('utf8');
    const entries: WorkflowScriptJournalEntry[] = [];
    for (const line of text.split('\n')) {
      if (line === '') continue;
      try {
        const entry = journalEntry(JSON.parse(line));
        if (entry !== undefined) entries.push(entry);
      } catch { /* unparseable lines are skipped, as the recovered loader does */ }
    }
    return journalState(entries);
  } finally {
    await handle.close().catch(() => {});
  }
}

async function appendWorkflowScriptJournal(directory: string, entry: WorkflowScriptJournalEntry): Promise<void> {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const file = nodePath.join(directory, 'journal.jsonl');
  const handle = await fs.open(file,
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_APPEND | fsConstants.O_NOFOLLOW, 0o600);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error('Workflow journal must be a regular file');
    await handle.writeFile(`${JSON.stringify(entry)}\n`, 'utf8');
  } finally {
    await handle.close().catch(() => {});
  }
}

export function openWorkflowScriptJournal(
  directory: string, state?: WorkflowScriptJournalState,
): WorkflowScriptJournal {
  return {
    directory, state: state ?? emptyWorkflowScriptJournalState(),
    append: entry => appendWorkflowScriptJournal(directory, entry),
  };
}

// --- Transform (`Lr`) -------------------------------------------------------

function enclosingFunction(ancestors: AcornNode[]): AcornNode | undefined {
  for (let index = ancestors.length - 2; index >= 0; index--) {
    const node = ancestors[index];
    if (node && (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression'
      || node.type === 'ArrowFunctionExpression')) return node;
  }
  return undefined;
}

export function transformScript(source: string): string {
  const wrapped = `(async () => {'use strict';\n${source}\n})()`;
  const program = parse(wrapped, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true }) as unknown as AcornNode;
  walk.full(program, (node: AcornNode) => {
    if (typeof node.name === 'string' && node.name.startsWith(MARK)) {
      throw SyntaxError(`Identifier '${node.name}' is reserved.`);
    }
    if (node.type === 'WithStatement') throw SyntaxError("'with' statements are not supported in workflow scripts.");
    if (node.type === 'ImportExpression') throw SyntaxError('import() is not available in workflow scripts.');
  });
  const inserts: [number, string][] = [];
  const wrapAwait = (argument: AcornNode | null | undefined) => {
    if (!argument) return;
    inserts.push([argument.start, ` ${MARK}((`], [argument.end, '))']);
  };
  walk.ancestor(program, {
    VariableDeclaration(node: AcornNode) {
      if (node.kind === 'await using') {
        throw SyntaxError("'await using' declarations are not supported in workflow scripts.");
      }
    },
    AwaitExpression(node: AcornNode) { wrapAwait(node.argument as AcornNode); },
    ArrowFunctionExpression(node: AcornNode) {
      if (node.async && node.expression) wrapAwait(node.body as AcornNode);
    },
    ForOfStatement(node: AcornNode) {
      if (node.await) {
        const right = node.right as AcornNode;
        inserts.push([right.start, ` ${MARK}a((`], [right.end, '))']);
      }
    },
    ReturnStatement(node: AcornNode, _state: unknown, ancestors: AcornNode[]) {
      const fn = enclosingFunction(ancestors);
      if (!fn?.async) return;
      const argument = node.argument as AcornNode | null;
      if (fn.generator) {
        if (argument) inserts.push([argument.start, ` await ${MARK}((`], [argument.end, '))']);
      } else wrapAwait(argument);
    },
    YieldExpression(node: AcornNode, _state: unknown, ancestors: AcornNode[]) {
      const fn = enclosingFunction(ancestors);
      if (!(fn?.async && fn.generator)) return;
      const argument = node.argument as AcornNode | null;
      if (node.delegate) {
        if (argument) inserts.push([argument.start, ` ${MARK}a((`], [argument.end, '))']);
      } else wrapAwait(argument);
    },
  } as unknown as walk.AncestorVisitors<AcornNode>);
  if (inserts.length === 0) return source;
  inserts.sort((left, right) => right[0] - left[0]);
  let output = wrapped;
  for (const [at, text] of inserts) output = output.slice(0, at) + text + output.slice(at);
  return output.slice(28, output.length - 5);
}

// --- Compile wrapper (`qie`) -------------------------------------------------

// Verbatim wrapper from `qie` with `bindWords` false and BODY substituted.
const ITERATOR_BRIDGE = `((__wRg$ => ((__wRg$a) => async () => {'use strict';
BODY
})(__wRg$it => ({[Symbol.asyncIterator](){const __wRg$ai = __wRg$it[Symbol.asyncIterator];if (__wRg$ai != null && typeof __wRg$ai !== 'function') throw new TypeError('@@asyncIterator is not a function');const __wRg$i = __wRg$ai != null ? __wRg$ai.call(__wRg$it) : __wRg$it[Symbol.iterator]();if (__wRg$i === null || (typeof __wRg$i !== 'object' && typeof __wRg$i !== 'function')) throw new TypeError('Iterator is not an object');const __wRg$nxt = __wRg$i.next;if (typeof __wRg$nxt !== 'function') throw new TypeError('Iterator.next is not a function');const __wRg$ret = __wRg$i.return;const __wRg$thr = __wRg$i.throw;const __wRg$w = s => __wRg$(s).then(s => { if (s === null || (typeof s !== 'object' && typeof s !== 'function')) throw new TypeError('Iterator result is not an object'); const done = s.done; return __wRg$(s.value).then(value => ({value, done})) });return {next:v=>__wRg$w(__wRg$nxt.call(__wRg$i,v)),return:v=>__wRg$w(typeof __wRg$ret==='function'?__wRg$ret.call(__wRg$i,v):{value:v,done:true}),throw:e=>typeof __wRg$thr==='function'?__wRg$w(__wRg$thr.call(__wRg$i,e)):__wRg$(typeof __wRg$ret==='function'?__wRg$ret.call(__wRg$i):undefined).then(()=>{throw new TypeError('The iterator does not provide a throw method')})}}})))(__wRg$resolve))()`;

export function compileWorkflowScript(body: string): { ok: true; script: vm.Script } | { ok: false; error: string } {
  try {
    // Parse the body as a function first so a syntax error is reported without
    // constructing a Script; the recovered compiler does the same check.
    new Function(`async function _check() {'use strict';\n${body}\n}`);
    const transformed = transformScript(body);
    const wrapper = ITERATOR_BRIDGE.replace('BODY', transformed);
    const script = new vm.Script(wrapper, {
      filename: 'workflow.js',
      importModuleDynamically: () => { throw new Error('import() is not available in workflow scripts.'); },
    });
    return { ok: true, script };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// --- Runtime ----------------------------------------------------------------

type RuntimeSignal = AbortSignal;

export async function runWorkflowScript(
  parsed: ParsedWorkflowScript, options: RunWorkflowScriptOptions,
): Promise<WorkflowScriptResult> {
  const started = Date.now();
  const signal = options.signal;
  const maxAgents = options.maxAgents ?? AGENT_CAP;
  const logLimit = options.logLimit ?? LOG_CAP;
  const logs: string[] = [];
  const failures: string[] = [];
  const phases: string[] = [];
  const seenPhases = new Set<string>();
  let agentCount = 0;
  // Journal cache state is per run: `journalChain` is the rolling key and
  // `journalMiss` becomes true at the first call without a cached result, so
  // only the unchanged prefix is reused.
  const journal = options.journal;
  let journalChain = '';
  let journalMiss = false;
  let currentPhase: string | undefined;
  const childPhaseCounts = new Map<string, number>();
  const recordPhase = (title: string) => {
    if (!seenPhases.has(title)) { seenPhases.add(title); phases.push(title); }
  };
  for (const phase of parsed.meta.phases ?? []) recordPhase(phase.title);
  const pushLog = (message: string) => { if (logs.length < logLimit) logs.push(message); };
  const recordFailure = (message: string, logged: boolean) => {
    failures.push(message);
    if (logged) pushLog(message);
  };

  const handles = new Set<ReturnType<typeof setTimeout>>();
  const clearTimers = () => { for (const handle of handles) clearTimeout(handle); handles.clear(); };
  const onAbort = () => clearTimers();
  signal.addEventListener('abort', onAbort, { once: true });

  const { context, clone, sanitize, settle, call, snapshot, getProp, vmString, vmJson } = createVmBoundary();

  const formatValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
      try { return JSON.stringify(value) ?? `[${typeof value}]`; } catch { return `[${typeof value}]`; }
    }
    let fallback: string;
    try {
      const text = vmJson(sanitize(value));
      if (text !== undefined && text !== '{}') return text;
      fallback = text ?? `[${typeof value}]`;
    } catch (error) {
      const message = (error as { message?: unknown } | null)?.message;
      const capped = typeof message === 'string' && message.includes('exceeds the maximum');
      return capped ? `[${typeof value}: array exceeds the ${ARRAY_LENGTH_CAP}-element logging cap]` : `[${typeof value}]`;
    }
    const text = vmString(value);
    return text === '[object Object]' || text === '<unprintable>' ? fallback : text;
  };
  const makeConsole = (scope: string) => {
    const method = (prefix: string) => hostSync((...args: unknown[]) => {
      pushLog(scope + prefix + args.map(formatValue).join(' '));
    });
    return Object.freeze({
      __proto__: null, log: method(''), info: method(''), debug: method(''),
      error: method('[error] '), warn: method('[warn] '),
    });
  };
  const consoleObject = makeConsole('');

  const budget = Object.freeze({
    __proto__: null, total: null,
    spent: hostSync(() => 0),
    remaining: hostSync(() => Infinity),
  });

  const timers = {
    setTimeout: hostSync((callback: unknown, delay: unknown) => {
      if (signal.aborted) return 0;
      const wait = typeof delay === 'number' ? delay : typeof delay === 'string' ? +delay || 0 : 0;
      const handle = setTimeout(() => {
        try { (callback as () => void)(); } catch { /* timer errors are dropped */ }
      }, wait);
      handles.add(handle);
      return Number(handle);
    }),
    clearTimeout: hostSync((handle: unknown) => {
      if (typeof handle === 'number' || typeof handle === 'string') {
        const numeric = typeof handle === 'number' ? handle : +handle;
        for (const active of handles) if (Number(active) === numeric) { handles.delete(active); clearTimeout(active); }
      }
    }),
  };

  const cloneValue = (value: unknown): unknown => clone(value);
  const readOptions = (value: unknown): Record<string, unknown> => {
    if (value === null || value === undefined) return {};
    if (typeof value !== 'object') throw new TypeError('agent() options must be an object');
    return cloneValue(value) as Record<string, unknown>;
  };
  const assertUnsupportedOptions = (opts: Record<string, unknown>) => {
    if (opts.isolation === 'remote') {
      throw new Error("agent({isolation:'remote'}) is not available in this build");
    }
    if (opts.isolation !== undefined && opts.isolation !== 'worktree') {
      throw new Error("agent({isolation}) supports only 'worktree' in this runtime");
    }
  };
  const agentOptions = (opts: Record<string, unknown>): WorkflowScriptAgentOptions => {
    const result: WorkflowScriptAgentOptions = {};
    if (opts.label !== undefined) {
      result.label = String(opts.label).replace(/\s+/g, ' ').trim().slice(0, 60);
    }
    if (opts.phase !== undefined) result.phase = String(opts.phase);
    if (opts.model !== undefined) {
      if (typeof opts.model !== 'string') throw new TypeError('agent({model}) must be a string');
      result.model = opts.model;
    }
    if (opts.effort !== undefined) {
      if (typeof opts.effort !== 'string') throw new TypeError('agent({effort}) must be a string');
      result.effort = opts.effort;
    }
    if (opts.agentType !== undefined) {
      if (typeof opts.agentType !== 'string') throw new TypeError('agent({agentType}) must be a string');
      result.agentType = opts.agentType;
    }
    if (opts.isolation === 'worktree') result.isolation = 'worktree';
    if (opts.disallowedTools !== undefined) {
      const normalized = normalizeDisallowedTools(opts.disallowedTools);
      if (normalized !== undefined) result.disallowedTools = normalized;
    }
    if (opts.bashCommandClamp !== undefined) {
      const normalized = normalizeBashCommandClamp(opts.bashCommandClamp);
      if (normalized !== undefined) result.bashCommandClamp = normalized;
    }
    if (opts.stallMs !== undefined && opts.stallMs !== null) {
      const stallMs = Number(opts.stallMs);
      if (!Number.isFinite(stallMs)) throw new TypeError('agent({stallMs}) must be a finite number');
      result.stallMs = stallMs;
    }
    if (opts.schema !== undefined) {
      try { compileStructuredOutputSchema(opts.schema); }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const root = opts.schema !== null && typeof opts.schema === 'object' && !Array.isArray(opts.schema)
          ? (opts.schema as { type?: unknown }).type : undefined;
        if (root !== 'object') {
          // `Fot`/the unusable-schema branch (chunk-hedqf2m1.js offset ~39000):
          // the spawn is refused before a child exists.
          throw new Error(`agent({schema}) received an unusable JSON Schema — the API only accepts an object-rooted `
            + `tool input schema, so every request would be rejected: ${message}. The subagent was not started `
            + `— fix the schema and call agent() again.`);
        }
        throw new Error(`agent({schema}) received an invalid JSON Schema: ${message}`);
      }
      result.schema = opts.schema;
    }
    return result;
  };

  const onAgent = async (promptValue: unknown, rawOptions: unknown): Promise<unknown> => {
    if (signal.aborted) throw new Error('Workflow aborted');
    agentCount += 1;
    if (agentCount > maxAgents) {
      throw new Error(`Workflow agent() call cap reached (${maxAgents}). This usually means a loop that never terminates.`);
    }
    if (typeof promptValue !== 'string') throw new TypeError('agent() prompt must be a string');
    const opts = readOptions(rawOptions);
    assertUnsupportedOptions(opts);
    const parsedOptions = agentOptions(opts);
    const phase = parsedOptions.phase;
    if (phase !== undefined) {
      currentPhase = phase;
      recordPhase(phase);
    } else if (currentPhase !== undefined) {
      parsedOptions.phase = currentPhase;
    }
    const label = parsedOptions.label ?? `agent ${agentCount}`;
    let key: string | undefined;
    if (journal !== undefined) {
      key = workflowAgentJournalKey(journalChain, promptValue, parsedOptions);
      journalChain = key;
      if (!journalMiss) {
        const hit = journal.state.results.get(key);
        if (hit !== undefined) return hit.result;
      }
      const started = journal.state.started.get(key);
      if (!(!journalMiss && started !== undefined && started.length > 0 && !journal.state.failed.has(key))) {
        journalMiss = true;
      }
    }
    // Appends run in order and never fail the script; the recovered runtime
    // only warns when a journal write fails.
    let writes = Promise.resolve();
    const append = (entry: WorkflowScriptJournalEntry) => {
      if (journal === undefined || key === undefined) return;
      writes = writes.then(() => journal.append(entry)).catch(() => undefined);
    };
    let agentId: string | undefined;
    let result: string | null | WorkflowAgentStructured | { failure: string };
    try {
      result = await options.agent(promptValue, parsedOptions, signal, id => {
        agentId = id;
        append({ type: 'started', key: key!, agentId: id,
          ...(parsedOptions.label !== undefined ? { label: parsedOptions.label } : {}),
          ...(parsedOptions.phase !== undefined ? { phase: parsedOptions.phase } : {}) });
      });
    } catch (error) {
      append({ type: 'failed', key: key!, agentId: agentId ?? '' });
      await writes;
      throw error;
    }
    const failure = result !== null && typeof result === 'object' && 'failure' in result && typeof result.failure === 'string'
      ? result.failure : undefined;
    if (failure !== undefined) {
      append({ type: 'failed', key: key!, agentId: agentId ?? '' });
      await writes;
      recordFailure(`[${label}] failed: ${failure}`, true);
      return null;
    }
    const visible: string | JsonValue | null = result !== null && typeof result === 'object' && 'structured' in result
      ? result.structured : result as string | null;
    if (journal !== undefined && key !== undefined) {
      append({ type: 'result', key, agentId: agentId ?? '', result: visible });
    }
    await writes;
    return visible;
  };

  const onPhase = (value: unknown) => {
    const title = logText(value);
    currentPhase = title;
    recordPhase(title);
  };
  const onLog = (value: unknown) => { pushLog(logText(value)); };

  const onParallel = async (value: unknown): Promise<unknown> => {
    if (signal.aborted) return new Promise(() => {});
    if (!Array.isArray(value)) throw new TypeError('parallel() expects an array of functions');
    const list = snapshot(value) as unknown[];
    if (list.length === 0) return clone([]);
    for (const item of list) {
      if (typeof item !== 'function') {
        throw new TypeError('parallel() expects an array of functions, not promises. Wrap each call: () => agent(...)');
      }
    }
    const results = await Promise.allSettled(list.map(item => {
      try { return settle(call(item)); } catch (error) { return Promise.reject(error); }
    }));
    let budgetDropped = 0;
    const mapped = results.map((result, index) => {
      if (result.status === 'fulfilled') return (result.value as { v: unknown }).v;
      const { name, message } = projectError(result.reason);
      if (name === 'WorkflowBudgetExceededError') { budgetDropped += 1; return null; }
      recordFailure(`parallel[${index}] failed: ${message}`, true);
      return null;
    });
    if (budgetDropped > 0) failures.push(`parallel: ${budgetDropped} slot(s) dropped — token budget exceeded`);
    return clone(mapped);
  };

  const onPipeline = async (itemsValue: unknown, ...stageValues: unknown[]): Promise<unknown> => {
    if (signal.aborted) return new Promise(() => {});
    if (!Array.isArray(itemsValue)) throw new TypeError('pipeline() expects an array as the first argument');
    const items = snapshot(itemsValue) as unknown[];
    const stages = snapshot(stageValues) as unknown[];
    if (items.length === 0) return clone([]);
    for (const stage of stages) {
      if (typeof stage !== 'function') {
        throw new TypeError('pipeline() stages must be functions: pipeline(items, item => ..., result => ...)');
      }
    }
    const results = await Promise.allSettled(items.map(async (item, index) => {
      let settled = await settle(item);
      for (const stage of stages) {
        if (settled.v === null) break;
        settled = await settle(call(stage, settled.v, item, index));
      }
      return settled;
    }));
    let budgetDropped = 0;
    const mapped = results.map((result, index) => {
      if (result.status === 'fulfilled') return (result.value as { v: unknown }).v;
      const { name, message } = projectError(result.reason);
      if (name === 'WorkflowBudgetExceededError') { budgetDropped += 1; return null; }
      recordFailure(`pipeline[${index}] failed: ${message}`, true);
      return null;
    });
    if (budgetDropped > 0) failures.push(`pipeline: ${budgetDropped} slot(s) dropped — token budget exceeded`);
    return clone(mapped);
  };

  // Nested `workflow()` runner adapted from `Go` [31360,32556) with `kjr`
  // [28921,29977) resolution, `Ajr` [29977,31050) child context, `Cjr`
  // [31050,31247) one-level rejection and `Tjr` [31247,31360) phase names
  // (chunk-hedqf2m1.js). The source's Bun child realm (`En.createContext` and
  // the cross-realm helpers) is replaced by a Node `vm` boundary; the child
  // gets this run's budget, timers, agent bridge and failure/log sinks.
  const onWorkflow = async (request: unknown, argsValue: unknown): Promise<unknown> => {
    if (options.resolveWorkflow === undefined) {
      throw new Error('workflow() is not available in this runtime');
    }
    const child = await options.resolveWorkflow(request);
    const compiled = compileWorkflowScript(child.scriptBody);
    if (!compiled.ok) throw new Error(`workflow('${child.name}'): ${compiled.error}`);
    const seen = (childPhaseCounts.get(child.name) ?? 0) + 1;
    childPhaseCounts.set(child.name, seen);
    const phase = seen > 1 ? `▸ ${child.name} #${seen}` : `▸ ${child.name}`;
    recordPhase(phase);
    pushLog(`▸ running dynamic workflow ${child.name}`);
    const childVm = createVmBoundary();
    const childAgent = hostAsync((prompt: unknown, raw: unknown) => {
      let withPhase = raw;
      if (raw !== null && raw !== undefined && typeof raw === 'object') {
        const copy = childVm.clone(raw) as Record<string, unknown>;
        copy.phase = phase;
        withPhase = copy;
      } else if (raw === undefined || raw === null) {
        withPhase = { phase };
      }
      return onAgent(prompt, withPhase);
    });
    const rejectNested = hostAsync(() => Promise.reject(new Error(NESTED_WORKFLOW_MESSAGE)));
    const childLog = hostSync((value: unknown) => { pushLog(`[${child.name}] ${logText(value)}`); });
    const childPhase = hostSync(() => {});
    for (const [name, fn] of [['agent', childAgent], ['parallel', hostAsync(onParallel)],
      ['pipeline', hostAsync(onPipeline)], ['workflow', rejectNested], ['log', childLog],
      ['phase', childPhase]] as const) {
      Object.defineProperty(childVm.context, name, {
        value: fn, writable: true, enumerable: true, configurable: true,
      });
    }
    Object.defineProperty(childVm.context, 'console', {
      value: makeConsole(`[${child.name}] `), writable: true, enumerable: true, configurable: true,
    });
    Object.defineProperty(childVm.context, 'budget', {
      value: budget, writable: true, enumerable: true, configurable: true,
    });
    Object.defineProperty(childVm.context, 'setTimeout', {
      value: timers.setTimeout, writable: true, enumerable: true, configurable: true,
    });
    Object.defineProperty(childVm.context, 'clearTimeout', {
      value: timers.clearTimeout, writable: true, enumerable: true, configurable: true,
    });
    Object.defineProperty(childVm.context, 'args', {
      value: argsValue === undefined
        ? undefined
        : vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(argsValue))})`, childVm.context),
      writable: true, enumerable: true, configurable: true,
    });
    try {
      const execution = compiled.script.runInContext(childVm.context, {
        timeout: options.syncTimeoutMs ?? SYNC_TIMEOUT_MS,
      }) as unknown;
      const raced = await Promise.race([
        childVm.settle(execution),
        new Promise<never>((_resolve, reject) => {
          const abort = () => reject(new Error('Workflow aborted'));
          if (signal.aborted) abort();
          else signal.addEventListener('abort', abort, { once: true });
        }),
      ]);
      const value = childVm.sanitize(raced.v);
      pushLog(`▸ ${child.name} done`);
      return value;
    } catch (error) {
      const projected = projectError(error);
      recordFailure(`${phase}: ${projected.message}`, false);
      pushLog(`▸ ${child.name} failed: ${projected.message}`);
      throw new Error(projected.message);
    }
  };
  for (const [name, fn] of [['agent', onAgent], ['parallel', onParallel], ['pipeline', onPipeline],
    ['workflow', onWorkflow], ['log', onLog], ['phase', onPhase]] as const) {
    Object.defineProperty(context, name, {
      value: name === 'agent' || name === 'parallel' || name === 'pipeline' || name === 'workflow'
        ? hostAsync(fn as (...args: unknown[]) => Promise<unknown>)
        : hostSync(fn as (...args: unknown[]) => unknown),
      writable: true, enumerable: true, configurable: true,
    });
  }
  Object.defineProperty(context, 'console', { value: consoleObject, writable: true, enumerable: true, configurable: true });
  Object.defineProperty(context, 'budget', { value: budget, writable: true, enumerable: true, configurable: true });
  Object.defineProperty(context, 'setTimeout', { value: timers.setTimeout, writable: true, enumerable: true, configurable: true });
  Object.defineProperty(context, 'clearTimeout', { value: timers.clearTimeout, writable: true, enumerable: true, configurable: true });
  const serializedArgs = options.args === undefined ? undefined : JSON.stringify(options.args);
  Object.defineProperty(context, 'args', {
    value: serializedArgs === undefined ? undefined : vm.runInContext(`JSON.parse(${JSON.stringify(serializedArgs)})`, context),
    writable: true, enumerable: true, configurable: true,
  });

  const finish = (result: unknown, error?: WorkflowScriptError): WorkflowScriptResult => ({
    result: error === undefined ? result : null,
    agent_count: agentCount, logs, failures, phases,
    duration_ms: Date.now() - started,
    ...(error === undefined ? {} : { error }),
  });

  try {
    if (signal.aborted) throw new Error('Workflow aborted');
    const compiled = compileWorkflowScript(parsed.scriptBody);
    if (!compiled.ok) throw new Error(compiled.error);
    const execution = compiled.script.runInContext(context, {
      timeout: options.syncTimeoutMs ?? SYNC_TIMEOUT_MS,
    }) as unknown;
    const settledPromise = settle(execution);
    const raced = await Promise.race([
      settledPromise,
      new Promise<never>((_resolve, reject) => {
        const abort = () => reject(new Error('Workflow aborted'));
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
      }),
    ]);
    const value = raced.v;
    if (typeof value === 'function') throw new Error('workflow result cannot be a function');
    let result: unknown = value;
    if (value !== null && typeof value === 'object') {
      result = sanitize(value);
      try {
        JSON.stringify(result);
      } catch {
        result = JSON.parse(JSON.stringify(value, (_key, entry) => (
          typeof entry === 'function' ? undefined : entry)) ?? 'null');
      }
      JSON.stringify(result);
    }
    return finish(result);
  } catch (error) {
    const projected = projectError(error);
    return finish(null, projected);
  } finally {
    clearTimers();
    signal.removeEventListener('abort', onAbort);
  }
}
