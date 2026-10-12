// Trusted runtime callbacks only. Remote values stay bounded, inert JSON.
export type McpJson = null | boolean | number | string | McpJson[] | { [key: string]: McpJson };
type MaybePromise<T> = T | Promise<T>;
export type McpRoot = { uri: string; name?: string };
export type McpClientRequestContext = { serverName: string; requestId: string | number; _meta?: { [key: string]: McpJson } };
export type McpElicitationParams = { message: string; mode?: "form"; requestedSchema: { type: "object"; properties: { [key: string]: McpJson }; required?: string[] }; _meta?: { [key: string]: McpJson } };
export type McpElicitationResult = { action: "accept" | "decline" | "cancel"; content?: { [key: string]: string | number | boolean } };
export type McpSamplingContent = { type: "text"; text: string } | { type: "image" | "audio"; data: string; mimeType: string };
export type McpSamplingParams = {
  messages: { role: "user" | "assistant"; content: McpSamplingContent | McpSamplingContent[] }[];
  maxTokens: number;
  modelPreferences?: { hints?: { name?: string }[]; costPriority?: number; speedPriority?: number; intelligencePriority?: number };
  systemPrompt?: string;
  includeContext?: "none" | "thisServer" | "allServers";
  temperature?: number;
  stopSequences?: string[];
  metadata?: { [key: string]: McpJson };
  _meta?: { [key: string]: McpJson };
};
export type McpSamplingResult = { role: "user" | "assistant"; content: McpSamplingContent; model: string; stopReason?: string };
/** Callbacks are explicitly supplied by the host, never restored from server config. */
export type McpClientRequests = {
  roots?: (context: McpClientRequestContext, signal?: AbortSignal) => MaybePromise<McpRoot[]>;
  elicitation?: (params: McpElicitationParams, signal: AbortSignal, context: McpClientRequestContext) => MaybePromise<McpElicitationResult>;
  sampling?: (params: McpSamplingParams, signal: AbortSignal, context: McpClientRequestContext) => MaybePromise<McpSamplingResult>;
  timeoutMs?: number;
};
export const MCP_CLIENT_REQUEST_MAX_INPUT_BYTES = 32 * 1024;
export const MCP_SAMPLING_MAX_BLOCKS = 128;
export const MCP_CLIENT_REQUEST_MAX_RESULT_BYTES = 1024 * 1024;
export const MCP_CLIENT_REQUEST_MAX_PENDING = 16;
export const MCP_CLIENT_REQUEST_CLEANUP_MS = 1000;
export const MCP_CLIENT_REQUEST_LIMITS: readonly string[] = [
  "client requests: explicit trusted runtime callbacks for roots/list, form elicitation/create and base sampling/createMessage; no URL elicitation, OAuth, model SDK calls, sampling tools, tasks or subscriptions",
  "client request lifetime: independent AbortSignal and deadline; notifications/cancelled and connection close abort callbacks; late callback completion is ignored",
  "client request bounds: 32 KiB input, 1 MiB result/frame, 16 live RPC/host callbacks per connection; expired callback slots and ids stay reserved until host work settles; inert JSON only; callback errors use fixed messages",
  "client request protocol: stdio keeps its 2024-11-05 handshake; explicitly configured form elicitation is an opt-in extension; HTTP keeps its negotiated versions",
  "client callbacks: JavaScript hosts own approval, workspace/model policy and cooperative side-effect cancellation; connection close bounds waiting but does not terminate host callback code",
];

type Reply = (message: unknown) => void | Promise<void>;
type Pending = { controller: AbortController; timer: NodeJS.Timeout; cancel: () => void; done: Promise<void> };
const own = (value: object, key: string) => Object.hasOwn(value, key);
function record(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function validId(value: unknown): value is string | number {
  return (typeof value === "string" && value.length > 0 && Buffer.byteLength(value) <= 256) || (typeof value === "number" && Number.isSafeInteger(value));
}
function requireShape(value: unknown, keys: string[], required: string[] = []): asserts value is Record<string, any> {
  if (!record(value) || Object.keys(value).some((key) => !keys.includes(key)) || required.some((key) => !own(value, key))) throw new Error("shape");
}
function text(value: unknown, nonempty = false): asserts value is string {
  if (typeof value !== "string" || (nonempty && value.length === 0)) throw new Error("text");
}
function finite(value: unknown): asserts value is number { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("number"); }

// Descriptor inspection avoids invoking result getters or toJSON supplied by a callback.
function inert(value: unknown, cap: number): any {
  let nodes = 0;
  let bytes = 0;
  const charge = (size: number) => { bytes += size; if (bytes > cap) throw new Error("size"); };
  const visit = (item: unknown, depth: number): any => {
    if (++nodes > 100_000 || depth > 32) throw new Error("complexity");
    if (item === null || typeof item === "boolean") { charge(5); return item; }
    if (typeof item === "number") { finite(item); charge(24); return item; }
    if (typeof item === "string") { charge(Buffer.byteLength(item) + 2); return item; }
    if (typeof item !== "object" || item === null) throw new Error("json");
    const array = Array.isArray(item);
    if (!array && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw new Error("prototype");
    const descriptors = Object.getOwnPropertyDescriptors(item);
    if (Object.getOwnPropertySymbols(item).length) throw new Error("symbol");
    const copy: any = array ? [] : Object.create(null);
    charge(2);
    for (const key of Object.keys(descriptors)) {
      if (array && key === "length") continue;
      const descriptor = descriptors[key]!;
      if (!descriptor.enumerable || !own(descriptor, "value") || (array && !/^(0|[1-9][0-9]*)$/.test(key))) throw new Error("descriptor");
      charge(Buffer.byteLength(key) + 4);
      Object.defineProperty(copy, key, { value: visit(descriptor.value, depth + 1), enumerable: true, configurable: false, writable: false });
    }
    if (array && Object.keys(copy).length !== (item as unknown[]).length) throw new Error("array");
    return Object.freeze(copy);
  };
  const copy = visit(value, 0);
  if (Buffer.byteLength(JSON.stringify(copy)) > cap) throw new Error("size");
  return copy;
}
function meta(params: Record<string, any>): void {
  if (params._meta !== undefined && !record(params._meta)) throw new Error("meta");
}
function rootsResult(value: unknown): { roots: McpRoot[] } {
  if (!Array.isArray(value)) throw new Error("roots");
  const roots = value.map((root): McpRoot => {
    requireShape(root, ["uri", "name"], ["uri"]);
    text(root.uri, true);
    const url = new URL(root.uri);
    if (url.protocol !== "file:" || url.username || url.password || url.host || url.search || url.hash || !url.pathname.startsWith("/") || /[\x00-\x1f\x7f]/.test(root.uri) || /%(?:00|0[ad])/i.test(root.uri)) throw new Error("uri");
    if (root.name !== undefined) { text(root.name, true); if (Buffer.byteLength(root.name) > 1024 || /[\x00-\x1f\x7f]/.test(root.name)) throw new Error("name"); }
    return { uri: root.uri, ...(root.name === undefined ? {} : { name: root.name }) };
  });
  return { roots };
}
function formParams(params: Record<string, any>): McpElicitationParams {
  requireShape(params, ["mode", "message", "requestedSchema", "_meta"], ["message", "requestedSchema"]);
  text(params.message);
  if (params.mode !== undefined && params.mode !== "form") throw new Error("mode");
  const schema = params.requestedSchema;
  requireShape(schema, ["type", "properties", "required"], ["type", "properties"]);
  if (schema.type !== "object" || !record(schema.properties)) throw new Error("schema");
  for (const property of Object.values(schema.properties)) {
    requireShape(property, ["type", "title", "description", "default", "enum", "enumNames", "minLength", "maxLength", "format", "minimum", "maximum"] , ["type"]);
    if (!["string", "number", "integer", "boolean"].includes(property.type)) throw new Error("type");
    for (const key of ["title", "description"]) if (property[key] !== undefined) text(property[key]);
    if (property.enum !== undefined && (property.type !== "string" || !Array.isArray(property.enum) || !property.enum.length || property.enum.some((v: unknown) => typeof v !== "string"))) throw new Error("enum");
    if (property.enumNames !== undefined && (!Array.isArray(property.enumNames) || !property.enum || property.enumNames.length !== property.enum.length || property.enumNames.some((v: unknown) => typeof v !== "string"))) throw new Error("enumNames");
    for (const key of ["minLength", "maxLength"]) if (property[key] !== undefined && (property.type !== "string" || !Number.isSafeInteger(property[key]) || property[key] < 0)) throw new Error("length");
    for (const key of ["minimum", "maximum"]) if (property[key] !== undefined) { finite(property[key]); if (!["number", "integer"].includes(property.type)) throw new Error("range"); }
    if (property.minimum !== undefined && property.maximum !== undefined && property.minimum > property.maximum) throw new Error("range");
    if (property.minLength !== undefined && property.maxLength !== undefined && property.minLength > property.maxLength) throw new Error("length");
    if (property.format !== undefined && (property.type !== "string" || !["email", "uri", "date", "date-time"].includes(property.format))) throw new Error("format");
    if (property.default !== undefined) formValue(property.default, property);
  }
  if (schema.required !== undefined && (!Array.isArray(schema.required) || schema.required.some((key: unknown) => typeof key !== "string" || !own(schema.properties, key)) || new Set(schema.required).size !== schema.required.length)) throw new Error("required");
  return params as McpElicitationParams;
}
function formValue(value: unknown, schema: Record<string, any>): void {
  if (schema.type === "integer") { if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error("integer"); }
  else if (typeof value !== schema.type) throw new Error("type");
  if (typeof value === "number") { finite(value); if ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)) throw new Error("range"); }
  if (typeof value === "string") {
    const length = [...value].length;
    if ((schema.enum && !schema.enum.includes(value)) || (schema.minLength !== undefined && length < schema.minLength) || (schema.maxLength !== undefined && length > schema.maxLength)) throw new Error("string");
    if (schema.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("email");
    if (schema.format === "uri") new URL(value);
    if ((schema.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) || (schema.format === "date-time" && !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) || (["date", "date-time"].includes(schema.format) && !Number.isFinite(Date.parse(value)))) throw new Error("date");
  }
}
export function validateElicitationResult(value: unknown, params: McpElicitationParams): McpElicitationResult {
  requireShape(value, ["action", "content"], ["action"]);
  if (!["accept", "decline", "cancel"].includes(value.action)) throw new Error("action");
  if (value.content !== undefined) {
    if (value.action !== "accept" || !record(value.content)) throw new Error("content");
    for (const [key, item] of Object.entries(value.content)) {
      if (!own(params.requestedSchema.properties, key)) throw new Error("property");
      formValue(item, params.requestedSchema.properties[key] as Record<string, any>);
    }
  }
  if (value.action === "accept" && params.requestedSchema.required?.some((key) => !value.content || !own(value.content, key))) throw new Error("required");
  return value as McpElicitationResult;
}
function samplingContent(value: unknown): void {
  if (!record(value)) throw new Error("content");
  if (value.type === "text") { requireShape(value, ["type", "text"], ["type", "text"]); text(value.text); }
  else if (value.type === "image" || value.type === "audio") {
    requireShape(value, ["type", "data", "mimeType"], ["type", "data", "mimeType"]);
    text(value.data); text(value.mimeType, true);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value.data) || value.data.length % 4 !== 0 || !/^[\w.+-]+\/[\w.+-]+$/.test(value.mimeType)) throw new Error("media");
  } else throw new Error("content");
}
function samplingParams(params: Record<string, any>): McpSamplingParams {
  requireShape(params, ["messages", "maxTokens", "modelPreferences", "systemPrompt", "includeContext", "temperature", "stopSequences", "metadata", "_meta"], ["messages", "maxTokens"]);
  if (!Array.isArray(params.messages) || !params.messages.length || !Number.isSafeInteger(params.maxTokens) || params.maxTokens < 1) throw new Error("sampling");
  let blocks = 0;
  for (const message of params.messages) {
    requireShape(message, ["role", "content"], ["role", "content"]);
    if (!["user", "assistant"].includes(message.role)) throw new Error("role");
    const content = Array.isArray(message.content) ? message.content : [message.content];
    if (!content.length || (blocks += content.length) > MCP_SAMPLING_MAX_BLOCKS) throw new Error("blocks");
    for (const block of content) samplingContent(block);
  }
  if (params.systemPrompt !== undefined) text(params.systemPrompt);
  if (params.includeContext !== undefined && !["none", "thisServer", "allServers"].includes(params.includeContext)) throw new Error("context");
  if (params.temperature !== undefined) { finite(params.temperature); if (params.temperature < 0) throw new Error("temperature"); }
  if (params.stopSequences !== undefined && (!Array.isArray(params.stopSequences) || params.stopSequences.some((v: unknown) => typeof v !== "string"))) throw new Error("stop");
  if (params.metadata !== undefined && !record(params.metadata)) throw new Error("metadata");
  if (params.modelPreferences !== undefined) {
    requireShape(params.modelPreferences, ["hints", "costPriority", "speedPriority", "intelligencePriority"]);
    if (params.modelPreferences.hints !== undefined) {
      if (!Array.isArray(params.modelPreferences.hints)) throw new Error("hints");
      for (const hint of params.modelPreferences.hints) { requireShape(hint, ["name"]); if (hint.name !== undefined) text(hint.name); }
    }
    for (const key of ["costPriority", "speedPriority", "intelligencePriority"]) if (params.modelPreferences[key] !== undefined) { finite(params.modelPreferences[key]); if (params.modelPreferences[key] < 0 || params.modelPreferences[key] > 1) throw new Error("priority"); }
  }
  return params as McpSamplingParams;
}
function samplingResult(value: unknown): McpSamplingResult {
  requireShape(value, ["role", "content", "model", "stopReason"], ["role", "content", "model"]);
  if (!["user", "assistant"].includes(value.role)) throw new Error("role");
  samplingContent(value.content); text(value.model, true);
  if (value.stopReason !== undefined) text(value.stopReason);
  return value as McpSamplingResult;
}

export class McpClientRequestHandler {
  private readonly callbacks: McpClientRequests;
  private readonly pending = new Map<string | number, Pending>();
  // A timed-out host promise still occupies a slot until it actually settles.
  private readonly activeWork = new Set<string | number>();
  private closed = false;
  private taskInputId = 0;
  private readonly timeoutMs: number;
  readonly capabilities: Record<string, unknown> = {};
  constructor(private readonly serverName: string, callbacks: McpClientRequests = {}) {
    this.callbacks = { ...callbacks };
    this.timeoutMs = typeof callbacks.timeoutMs === "number" && Number.isFinite(callbacks.timeoutMs) && callbacks.timeoutMs >= 1 ? Math.min(Math.floor(callbacks.timeoutMs), 300_000) : 30_000;
    if (typeof callbacks.roots === "function") this.capabilities.roots = { listChanged: false };
    if (typeof callbacks.elicitation === "function") this.capabilities.elicitation = { form: {} };
    if (typeof callbacks.sampling === "function") this.capabilities.sampling = {};
  }
  supports(method: unknown): boolean {
    return typeof (method === "roots/list" ? this.callbacks.roots : method === "elicitation/create" ? this.callbacks.elicitation : method === "sampling/createMessage" ? this.callbacks.sampling : undefined) === "function";
  }
  cancelled(params: unknown): void {
    if (record(params) && validId(params.requestId)) this.pending.get(params.requestId)?.cancel();
  }
  async handle(message: Record<string, unknown>, reply: Reply): Promise<void> {
    if (this.closed) return;
    const id = validId(message.id) ? message.id : null;
    const error = async (code: number, text: string) => { if (!this.closed) await reply({ jsonrpc: "2.0", id, error: { code, message: text } }); };
    if (id === null) return error(-32602, "Invalid client request id");
    if (this.pending.has(id) || this.activeWork.has(id)) return error(-32602, "Duplicate pending client request id");
    const method = message.method;
    const callback = method === "roots/list" ? this.callbacks.roots : method === "elicitation/create" ? this.callbacks.elicitation : method === "sampling/createMessage" ? this.callbacks.sampling : undefined;
    if (typeof callback !== "function") return error(-32601, "Method not supported by this client");
    if (new Set([...this.pending.keys(), ...this.activeWork]).size >= MCP_CLIENT_REQUEST_MAX_PENDING) return error(-32603, "Client request concurrency limit exceeded");
    let params: Record<string, any>;
    try {
      inert(message, MCP_CLIENT_REQUEST_MAX_INPUT_BYTES);
      requireShape(message, ["jsonrpc", "id", "method", "params"], ["jsonrpc", "id", "method"]);
      if (message.jsonrpc !== "2.0") throw new Error("request");
      params = inert(message.params === undefined ? {} : message.params, MCP_CLIENT_REQUEST_MAX_INPUT_BYTES);
      if (!record(params)) throw new Error("request");
      meta(params);
      if (method === "roots/list") requireShape(params, ["_meta"]);
      else if (method === "elicitation/create") formParams(params);
      else samplingParams(params);
    } catch { return error(-32602, "Invalid client request parameters"); }
    const controller = new AbortController();
    let interrupt!: (reason: "cancelled" | "deadline" | "closed") => void;
    const interrupted = new Promise<{ reason: string }>((resolve) => { interrupt = (reason) => { resolve({ reason }); controller.abort(); }; });
    const context = Object.freeze({ serverName: this.serverName, requestId: id, ...(params._meta === undefined ? {} : { _meta: params._meta }) });
    let finish!: () => void;
    const pending: Pending = { controller, timer: setTimeout(() => interrupt("deadline"), this.timeoutMs), cancel: () => interrupt("cancelled"), done: new Promise<void>((resolve) => { finish = resolve; }) };
    this.pending.set(id, pending);
    this.activeWork.add(id);
    try {
      // Convert both rejection and noncooperative late completion into inert outcomes.
      const work = Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error("aborted");
        if (method === "roots/list") return this.callbacks.roots!(context, controller.signal);
        if (method === "elicitation/create") return this.callbacks.elicitation!(params as McpElicitationParams, controller.signal, context);
        return this.callbacks.sampling!(params as McpSamplingParams, controller.signal, context);
      }).then((value) => { this.activeWork.delete(id); return { value }; }, () => { this.activeWork.delete(id); return { failure: true }; });
      const outcome = await Promise.race([work, interrupted]);
      if (this.closed) return;
      if ("reason" in outcome) return await error(-32603, outcome.reason === "deadline" ? "Client request deadline exceeded" : "Client request cancelled");
      if ("failure" in outcome) return await error(-32603, "Client callback failed");
      let result: unknown;
      try {
        const value = inert(outcome.value, MCP_CLIENT_REQUEST_MAX_RESULT_BYTES);
        result = method === "roots/list" ? rootsResult(value) : method === "elicitation/create" ? validateElicitationResult(value, params as McpElicitationParams) : samplingResult(value);
        inert({ jsonrpc: "2.0", id, result }, MCP_CLIENT_REQUEST_MAX_RESULT_BYTES);
      } catch { return await error(-32603, "Invalid client callback result"); }
      await reply({ jsonrpc: "2.0", id, result });
    } finally { clearTimeout(pending.timer); this.pending.delete(id); finish(); }
  }
  async resolveTaskInput(key: string, request: { method: string; params?: unknown }, signal: AbortSignal): Promise<unknown> {
    signal.throwIfAborted();
    if (this.closed) throw new Error('MCP client request handler closed');
    if (!['roots/list', 'elicitation/create'].includes(request.method) || !this.supports(request.method)) return undefined;
    const id = `task-input-${++this.taskInputId}`;
    let response: any;
    const cancel = () => this.cancelled({ requestId: id });
    const pending = this.handle({ jsonrpc: '2.0', id, method: request.method, params: request.params ?? {} },
      value => { response = value; });
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    try {
      await pending; signal.throwIfAborted();
      if (!response || response.error) throw new Error('MCP task input request failed');
      return response.result;
    } finally { signal.removeEventListener('abort', cancel); }
  }
  async close(): Promise<void> {
    this.closed = true;
    const pending = [...this.pending.values()];
    for (const item of pending) { clearTimeout(item.timer); item.cancel(); }
    let timer: NodeJS.Timeout | undefined;
    try { await Promise.race([Promise.allSettled(pending.map((item) => item.done)), new Promise<void>((resolve) => { timer = setTimeout(resolve, MCP_CLIENT_REQUEST_CLEANUP_MS); })]); }
    finally { if (timer) clearTimeout(timer); this.pending.clear(); }
  }
}
