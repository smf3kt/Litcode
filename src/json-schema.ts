// Bounded JSON Schema validation of one declared contract.
//
// A server may declare an `outputSchema` for a tool. The recovered client compiles that schema once,
// when the tool list is cached, and then refuses on every call a successful result that carries no
// structured content, and a structured payload that does not satisfy the schema. This module is the
// validator behind that rule: a dependency-free subset of the specification, bounded in depth and in
// the text it reports.
//
// Enforced keywords: type (single or union), enum, const, allOf, anyOf, oneOf, not, $ref to a local
// JSON pointer, properties, required, additionalProperties (boolean or schema), items (schema or
// tuple), minItems, maxItems, uniqueItems, minimum, maximum, exclusiveMinimum, exclusiveMaximum,
// multipleOf, minLength, maxLength and pattern. Every other keyword is ignored, which is what the
// specification asks of a validator that does not know it, so a contract written only in those
// keywords is accepted rather than guessed at; the connection's limits state the same list.

export type JsonSchemaValidation = { valid: true } | { valid: false; errorMessage: string };

export const JSON_SCHEMA_MAX_DEPTH = 32;
export const JSON_SCHEMA_MAX_PATTERN_LENGTH = 4096;
export const JSON_SCHEMA_MAX_MESSAGE_CHARS = 512;

export const JSON_SCHEMA_LIMITS: readonly string[] = [
  `tool output schemas: enforced keywords are type, enum, const, allOf, anyOf, oneOf, not, local $ref, properties, required, additionalProperties, items, minItems, maxItems, uniqueItems, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, minLength, maxLength and pattern, checked to depth ${JSON_SCHEMA_MAX_DEPTH}; any other keyword is ignored as the specification directs, so a contract written only in the remaining keywords is accepted, not enforced`,
];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case "object": return record(value);
    case "array": return Array.isArray(value);
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
    case "boolean": return typeof value === "boolean";
    case "null": return value === null;
    default: return true; // an unknown type name constrains nothing this validator understands
  }
}

function describe(value: unknown): string {
  if (typeof value === "string") return `the string ${JSON.stringify(value.length > 32 ? `${value.slice(0, 32)}…` : value)}`;
  const type = typeOf(value);
  if (type === "number") return `the number ${String(value)}`;
  if (type === "array") return `an array of ${(value as unknown[]).length}`;
  if (type === "object") return `an object with ${Object.keys(value as object).length} member(s)`;
  return `${type === "null" ? "null" : `a ${type}`}`;
}

/** Resolve one local JSON pointer (`#/a/b`) against the root document; undefined when it does not name a value. */
function resolvePointer(root: unknown, pointer: string): unknown {
  if (pointer === "#" || pointer === "") return root;
  if (!pointer.startsWith("#/")) return undefined;
  let current: unknown = root;
  for (const raw of pointer.slice(2).split("/")) {
    const token = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(current)) {
      const index = /^(0|[1-9][0-9]*)$/.test(token) ? Number(token) : -1;
      if (index < 0 || index >= current.length) return undefined;
      current = current[index];
    } else if (record(current)) {
      if (!Object.hasOwn(current, token)) return undefined;
      current = current[token];
    } else return undefined;
  }
  return current;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left === "number" && typeof right === "number") return Object.is(left, right);
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => sameValue(item, right[index]));
  }
  if (record(left) && record(right)) {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
  }
  return false;
}

function isMultipleOf(value: number, divisor: number): boolean {
  if (divisor === 0) return false;
  const quotient = value / divisor;
  return Math.abs(quotient - Math.round(quotient)) < 1e-9;
}

type Check = { root: unknown; depth: number; pointer: string; path: string };

/** The first violation of `schema` by `value`, or undefined when the value satisfies it. */
function violation(schema: unknown, value: unknown, check: Check): string | undefined {
  if (schema === true) return undefined;
  if (schema === false) return `is not allowed by a false schema`;
  if (!record(schema)) return undefined;
  if (check.depth > JSON_SCHEMA_MAX_DEPTH) return `exceeds the ${JSON_SCHEMA_MAX_DEPTH}-level schema depth`;

  const at = check.path.length === 0 ? "the value" : `"${check.path}"`;
  const inner = { ...check, depth: check.depth + 1 };

  if (typeof schema.$ref === "string") {
    const target = resolvePointer(check.root, schema.$ref);
    if (target === undefined) return `references ${schema.$ref}, which is not a local pointer in this contract`;
    if (schema.$ref === check.pointer) return undefined; // a self-reference adds no constraint of its own
    const failure = violation(target, value, { ...inner, pointer: schema.$ref });
    if (failure !== undefined) return failure;
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const named = types.filter((entry): entry is string => typeof entry === "string");
    if (named.length > 0 && !named.some((entry) => matchesType(value, entry))) {
      return `${at} is ${describe(value)} where the contract requires ${named.join(" or ")}`;
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => sameValue(entry, value))) {
    return `${at} is ${describe(value)}, which is not one of the ${schema.enum.length} permitted value(s)`;
  }

  if (schema.const !== undefined && !sameValue(schema.const, value)) {
    return `${at} is ${describe(value)} where the contract fixes ${describe(schema.const)}`;
  }

  if (Array.isArray(schema.allOf)) {
    for (const [index, branch] of schema.allOf.entries()) {
      const failure = violation(branch, value, { ...inner, path: check.path });
      if (failure !== undefined) return `${failure} (allOf[${index}])`;
    }
  }

  if (Array.isArray(schema.anyOf)) {
    const failures = schema.anyOf.map((branch) => violation(branch, value, { ...inner, path: check.path }));
    if (schema.anyOf.length > 0 && failures.every((failure) => failure !== undefined)) {
      return `${at} satisfies none of the ${schema.anyOf.length} anyOf branch(es)`;
    }
  }

  if (Array.isArray(schema.oneOf)) {
    const passing = schema.oneOf.filter((branch) => violation(branch, value, { ...inner, path: check.path }) === undefined);
    if (schema.oneOf.length > 0 && passing.length !== 1) {
      return `${at} satisfies ${passing.length} of the ${schema.oneOf.length} oneOf branch(es) where exactly one is required`;
    }
  }

  if (schema.not !== undefined && violation(schema.not, value, { ...inner, path: check.path }) === undefined) {
    return `${at} satisfies a schema the contract excludes`;
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) return `${at} is shorter than ${schema.minLength} character(s)`;
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) return `${at} is longer than ${schema.maxLength} character(s)`;
    if (typeof schema.pattern === "string") {
      if (schema.pattern.length > JSON_SCHEMA_MAX_PATTERN_LENGTH) return `${at} is checked against a pattern longer than ${JSON_SCHEMA_MAX_PATTERN_LENGTH} characters`;
      let expression: RegExp;
      try { expression = new RegExp(schema.pattern); }
      catch { return `${at} is checked against a pattern that is not a valid regular expression`; }
      if (!expression.test(value)) return `${at} does not match the required pattern`;
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (typeof schema.minimum === "number" && value < schema.minimum) return `${at} is below the minimum ${schema.minimum}`;
    if (typeof schema.maximum === "number" && value > schema.maximum) return `${at} is above the maximum ${schema.maximum}`;
    if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) return `${at} is not above the exclusive minimum ${schema.exclusiveMinimum}`;
    if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) return `${at} is not below the exclusive maximum ${schema.exclusiveMaximum}`;
    if (typeof schema.multipleOf === "number" && !isMultipleOf(value, schema.multipleOf)) return `${at} is not a multiple of ${schema.multipleOf}`;
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) return `${at} holds fewer than ${schema.minItems} item(s)`;
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) return `${at} holds more than ${schema.maxItems} item(s)`;
    if (schema.uniqueItems === true) {
      const seen = new Set<string>();
      for (const item of value) {
        const key = JSON.stringify(item ?? null) ?? "undefined";
        if (seen.has(key)) return `${at} repeats an item where every item must be distinct`;
        seen.add(key);
      }
    }
    if (Array.isArray(schema.items)) {
      for (const [index, item] of value.entries()) {
        const branch = index < schema.items.length ? schema.items[index] : schema.additionalItems;
        if (branch === undefined) continue;
        const failure = violation(branch, item, { ...inner, path: `${check.path}/${index}` });
        if (failure !== undefined) return failure;
      }
    } else if (schema.items !== undefined) {
      for (const [index, item] of value.entries()) {
        const failure = violation(schema.items, item, { ...inner, path: `${check.path}/${index}` });
        if (failure !== undefined) return failure;
      }
    }
  }

  if (record(value)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (typeof key === "string" && !Object.hasOwn(value, key)) {
          return check.path.length === 0 ? `is missing the required member "${key}"` : `"${check.path}" is missing the required member "${key}"`;
        }
      }
    }
    const properties = record(schema.properties) ? schema.properties : undefined;
    const additional = schema.additionalProperties;
    for (const [key, member] of Object.entries(value)) {
      const declared = properties?.[key];
      const branch = declared !== undefined ? declared : additional;
      if (branch === undefined) continue;
      if (branch === false) return `"${check.path.length === 0 ? key : `${check.path}/${key}`}" is not a member the contract allows`;
      const failure = violation(branch, member, { ...inner, path: check.path.length === 0 ? key : `${check.path}/${key}` });
      if (failure !== undefined) return failure;
    }
  }

  return undefined;
}

/** Validate one value against one declared JSON Schema. */
export function validateJsonSchema(schema: unknown, value: unknown): JsonSchemaValidation {
  let failure: string | undefined;
  try {
    failure = violation(schema, value, { root: schema, depth: 0, pointer: "#", path: "" });
  } catch (error) {
    failure = `could not be checked: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (failure === undefined) return { valid: true };
  const message = failure.length > JSON_SCHEMA_MAX_MESSAGE_CHARS ? `${failure.slice(0, JSON_SCHEMA_MAX_MESSAGE_CHARS)}…` : failure;
  return { valid: false, errorMessage: message };
}
