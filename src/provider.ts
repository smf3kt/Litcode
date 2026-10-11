import Anthropic from '@anthropic-ai/sdk';

// Messages is the gateway wire protocol; Magpie owns model-specific translation.
export type ModelRequest = Anthropic.MessageCreateParamsNonStreaming;
export interface ModelProvider {
  complete(request: ModelRequest, signal: AbortSignal, onText?: (text: string) => void): Promise<Anthropic.Message>;
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

  async complete(request: ModelRequest, signal: AbortSignal, onText?: (text: string) => void): Promise<Anthropic.Message> {
    signal.throwIfAborted();
    const stream = this.client.messages.stream(this.wire(request), { signal });
    if (onText) stream.on('text', onText);
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
