import Anthropic from '@anthropic-ai/sdk';
type Middleware = NonNullable<NonNullable<Parameters<Anthropic['messages']['stream']>[1]>['middleware']>[number];

// Messages is the gateway wire protocol; Magpie owns model-specific translation.
export type ModelRequest = Anthropic.MessageCreateParamsNonStreaming;
export interface ModelRetry { retryAttempt: number; maxRetries: number; retryInMs?: number; status?: number }
export type ModelRetryObserver = (retry: ModelRetry | null) => void;
export interface ModelProvider {
  complete(request: ModelRequest, signal: AbortSignal, onText?: (text: string) => void, onThinking?: () => void,
    onRetry?: ModelRetryObserver): Promise<Anthropic.Message>;
  count(request: ModelRequest, signal: AbortSignal): Promise<number>;
}
export type GatewayConfig = {
  baseURL: string;
  auth: 'bearer' | 'api-key';
  tokenCounting: 'estimate' | 'api';
  promptCaching: boolean;
  eagerToolInput: boolean;
};
export const DEFAULT_GATEWAY: GatewayConfig = {
  baseURL: 'http://127.0.0.1:3425', auth: 'bearer', tokenCounting: 'estimate',
  promptCaching: false, eagerToolInput: false,
};

// kmt.onRetry, d3s5r8h5 [1698,4364), UTF-16; SDK0.133.0 client.ts [58933,62650) owns retry policy and sleep.
function retryProgress(signal: AbortSignal, maxRetries: number, report: ModelRetryObserver): Middleware {
  return async (request, next) => {
    if (!signal.aborted) report(null);
    const attempted = Number(request.headers.get('x-stainless-retry-count') ?? 0);
    const publish = (status?: number, headers?: Headers) => {
      if (signal.aborted || attempted >= maxRetries) return;
      let retryInMs: number | undefined;
      const millis = headers?.get('retry-after-ms');
      if (millis) { const parsed = parseFloat(millis); if (!Number.isNaN(parsed)) retryInMs = parsed; }
      const seconds = headers?.get('retry-after');
      if (seconds && !retryInMs) {
        const parsed = parseFloat(seconds);
        retryInMs = Number.isNaN(parsed) ? Date.parse(seconds) - Date.now() : parsed * 1000;
      }
      if (retryInMs === undefined || !(retryInMs > 0 && retryInMs <= 2 ** 31 - 1)) retryInMs = undefined;
      report({ retryAttempt: attempted + 1, maxRetries, ...(status === undefined ? {} : { status }),
        ...(retryInMs === undefined ? {} : { retryInMs }) });
    };
    let response: Response;
    try { response = await next(request); }
    catch (error) { publish(); throw error; }
    const retry = response.headers.get('x-should-retry');
    if (retry !== 'false' && !response.ok && (retry === 'true' || [408, 409, 429].includes(response.status) || response.status >= 500))
      publish(response.status, response.headers);
    return response;
  };
}

class GatewayClient extends Anthropic {
  constructor(options: ConstructorParameters<typeof Anthropic>[0]) {
    super(options);
    // SDK 0.133.0 merges environment headers after auth; isolate each client.
    this._options.defaultHeaders = undefined;
  }
}

export class GatewayProvider implements ModelProvider {
  private client: Anthropic;

  constructor(apiKey: string, private config: GatewayConfig, transport?: typeof fetch) {
    // Explicit nulls prevent the SDK from reading vendor credentials from env.
    this.client = new GatewayClient({
      apiKey: config.auth === 'api-key' ? apiKey : null,
      authToken: config.auth === 'bearer' ? apiKey : null,
      baseURL: config.baseURL, maxRetries: 2, timeout: 180_000,
      ...(transport ? { fetch: transport } : {}),
    });
  }

  private wire(request: ModelRequest): ModelRequest {
    const wire = structuredClone(request);
    if (wire.thinking?.type === 'disabled') delete wire.thinking;
    if (!this.config.promptCaching) delete wire.cache_control;
    if (wire.tools) wire.tools = wire.tools.map(tool => {
      const clean = { ...tool };
      if (!this.config.eagerToolInput && 'eager_input_streaming' in clean) delete clean.eager_input_streaming;
      return clean;
    });
    return wire;
  }

  async complete(request: ModelRequest, signal: AbortSignal, onText?: (text: string) => void, onThinking?: () => void,
    onRetry?: ModelRetryObserver): Promise<Anthropic.Message> {
    signal.throwIfAborted();
    const stream = this.client.messages.stream(this.wire(request), { signal,
      ...(onRetry ? { middleware: [retryProgress(signal, this.client.maxRetries, onRetry)] } : {}) });
    if (onText) stream.on('text', onText);
    if (onThinking) stream.on('thinking', () => onThinking());
    return stream.finalMessage();
  }

  async count(request: ModelRequest, signal: AbortSignal): Promise<number> {
    signal.throwIfAborted();
    const { model, messages, system, tools, thinking } = this.wire(request);
    if (this.config.tokenCounting === 'estimate') {
      // Deliberately conservative UTF-8 byte budget, not a model tokenizer.
      return Buffer.byteLength(JSON.stringify({ model, messages, system, tools, thinking }), 'utf8') + 1024;
    }
    const result = await this.client.messages.countTokens({ model, messages, system, tools, thinking }, { signal });
    return result.input_tokens;
  }
}
