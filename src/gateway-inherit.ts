import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Borrow the gateway settings of a compatible client configuration.
 *
 * A person who already runs another Messages-protocol client on this machine has
 * already named a gateway, a credential and a model there. Reading those is what
 * lets `litcode` start from a plain terminal without exporting anything first.
 *
 * Only the client settings file's `env` block and its top-level `model` are read.
 * No other file, no stored browser session and no authorization flow is involved,
 * the credential is never written into a session or an Evidence record, and only
 * the variable name and file path are ever reported - never a value.
 *
 * Inheritance never outranks a value that was given to this harness: an explicit
 * flag, an `LLM_*` variable or this harness's own settings file all win.
 */
export const GATEWAY_INHERIT_LIMITS = {
  /** A client settings file larger than this is not read at all. */
  fileBytes: 1024 * 1024,
  credentialChars: 8192,
  urlChars: 2048,
  modelChars: 256,
  /** Entries examined in the `env` block before the file is left alone. */
  envEntries: 4096,
} as const;

/** The variables a compatible client names in its settings and in the environment. */
export const CLIENT_GATEWAY_VARIABLES = {
  authToken: 'ANTHROPIC_AUTH_TOKEN',
  apiKey: 'ANTHROPIC_API_KEY',
  baseURL: 'ANTHROPIC_BASE_URL',
  model: 'ANTHROPIC_MODEL',
} as const;

export interface InheritedCredential {
  value: string;
  /** The header this variable carries: a token is a bearer credential, a key is not. */
  auth: 'bearer' | 'api-key';
  /** The variable name, for reporting where it came from. */
  variable: string;
}

export type InheritedField = 'baseURL' | 'model' | 'credential';

export interface InheritedGateway {
  baseURL?: string;
  model?: string;
  credential?: InheritedCredential;
  /** Where each borrowed field came from, for one non-secret notice line. */
  sources: { field: InheritedField; source: string }[];
  /** The directory the settings file was read from, whether or not it existed. */
  directory: string;
}

export interface InheritOptions {
  enabled: boolean;
  env?: NodeJS.ProcessEnv;
  home?: string;
  /** Overrides the directory search, for a caller that already knows where to look. */
  directory?: string;
}

/**
 * Locate the compatible client's configuration directory. An explicit choice for
 * this harness wins, then the other client's own override, then the usual home.
 */
export function clientGatewayDirectory(env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string {
  const explicit = nonEmpty(env.LLM_INHERIT_DIR);
  if (explicit !== undefined) return path.resolve(explicit);
  const own = nonEmpty(env.CLAUDE_CONFIG_DIR);
  if (own !== undefined) return path.resolve(own);
  return path.join(home, '.claude');
}

/** True when both strings name the same endpoint, ignoring a trailing slash. */
export function sameGateway(left: string, right: string): boolean {
  const normalize = (value: string): string | undefined => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
      return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    } catch { return undefined; }
  };
  const a = normalize(left);
  return a !== undefined && a === normalize(right);
}

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.trim() !== '' ? value.trim() : undefined;
}

/** A bounded printable string, or undefined when the source value cannot be one. */
function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  // A credential or endpoint carrying a control character is not something to pass on.
  if (trimmed === '' || trimmed.length > max || /[\u0000-\u001f\u007f]/.test(trimmed)) return undefined;
  return trimmed;
}

function httpURL(value: unknown): string | undefined {
  const candidate = text(value, GATEWAY_INHERIT_LIMITS.urlChars);
  if (candidate === undefined) return undefined;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return candidate;
  } catch { return undefined; }
}

/**
 * Read the client settings file's `env` block. A file that is absent, unreadable,
 * a directory, over the size bound, or not a JSON object contributes nothing;
 * inheritance is a convenience and must never turn into a startup failure.
 */
function readClientEnv(directory: string): { env: Record<string, unknown>; file?: string; model?: string } {
  const file = path.join(directory, 'settings.json');
  try {
    const stats = fs.statSync(file);
    if (!stats.isFile() || stats.size > GATEWAY_INHERIT_LIMITS.fileBytes) return { env: {} };
    const document: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof document !== 'object' || document === null || Array.isArray(document)) return { env: {} };
    const record = document as Record<string, unknown>;
    const raw = record.env;
    const env: Record<string, unknown> = {};
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      const entries = Object.entries(raw as Record<string, unknown>);
      for (const [key, value] of entries.slice(0, GATEWAY_INHERIT_LIMITS.envEntries)) env[key] = value;
    }
    return { env, file, model: text(record.model, GATEWAY_INHERIT_LIMITS.modelChars) };
  } catch { return { env: {} }; }
}

/**
 * Resolve what the client configuration offers. Every field is independent: a file
 * that names only a gateway still contributes that gateway.
 */
export function resolveInheritedGateway(options: InheritOptions): InheritedGateway | undefined {
  if (!options.enabled) return undefined;
  const env = options.env ?? process.env;
  const directory = options.directory ?? clientGatewayDirectory(env, options.home ?? os.homedir());
  const file = readClientEnv(directory);
  const sources: InheritedGateway['sources'] = [];
  const label = (variable: string): string => file.file !== undefined && text(file.env[variable], GATEWAY_INHERIT_LIMITS.credentialChars) !== undefined
    ? `${variable} in ${file.file}`
    : variable;

  const baseURL = httpURL(file.env[CLIENT_GATEWAY_VARIABLES.baseURL]) ?? httpURL(env[CLIENT_GATEWAY_VARIABLES.baseURL]);
  if (baseURL !== undefined) {
    sources.push({ field: 'baseURL', source: file.file !== undefined && httpURL(file.env[CLIENT_GATEWAY_VARIABLES.baseURL]) !== undefined
      ? `${CLIENT_GATEWAY_VARIABLES.baseURL} in ${file.file}` : CLIENT_GATEWAY_VARIABLES.baseURL });
  }
  const model = text(file.env[CLIENT_GATEWAY_VARIABLES.model], GATEWAY_INHERIT_LIMITS.modelChars)
    ?? file.model
    ?? text(env[CLIENT_GATEWAY_VARIABLES.model], GATEWAY_INHERIT_LIMITS.modelChars);
  if (model !== undefined) {
    const fromFileEnv = text(file.env[CLIENT_GATEWAY_VARIABLES.model], GATEWAY_INHERIT_LIMITS.modelChars) !== undefined;
    const fromFileModel = !fromFileEnv && file.model !== undefined;
    sources.push({ field: 'model', source: fromFileEnv ? `${CLIENT_GATEWAY_VARIABLES.model} in ${file.file}`
      : fromFileModel ? `model in ${file.file}` : CLIENT_GATEWAY_VARIABLES.model });
  }

  // A gateway deployment carries its credential in the token variable; the key
  // variable is the first-party path. The token wins when a source sets both.
  const token = text(file.env[CLIENT_GATEWAY_VARIABLES.authToken], GATEWAY_INHERIT_LIMITS.credentialChars)
    ?? text(env[CLIENT_GATEWAY_VARIABLES.authToken], GATEWAY_INHERIT_LIMITS.credentialChars);
  const key = text(file.env[CLIENT_GATEWAY_VARIABLES.apiKey], GATEWAY_INHERIT_LIMITS.credentialChars)
    ?? text(env[CLIENT_GATEWAY_VARIABLES.apiKey], GATEWAY_INHERIT_LIMITS.credentialChars);
  const credential: InheritedCredential | undefined = token !== undefined
    ? { value: token, auth: 'bearer', variable: CLIENT_GATEWAY_VARIABLES.authToken }
    : key !== undefined ? { value: key, auth: 'api-key', variable: CLIENT_GATEWAY_VARIABLES.apiKey } : undefined;
  if (credential !== undefined) sources.push({ field: 'credential', source: label(credential.variable) });

  if (baseURL === undefined && model === undefined && credential === undefined) return undefined;
  return {
    ...(baseURL === undefined ? {} : { baseURL }),
    ...(model === undefined ? {} : { model }),
    ...(credential === undefined ? {} : { credential }),
    sources,
    directory,
  };
}
