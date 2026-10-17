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

/** The gateway address Magpie uses when neither its environment nor its UI names one. */
export const MAGPIE_ENDPOINT_DEFAULT = 'http://127.0.0.1:3425';

export const MAGPIE_WIRING_LIMITS = {
  fileBytes: 1024 * 1024,
  entries: 4096,
} as const;

export type MagpieEndpointSource = 'explicit' | 'LLM_BASE_URL' | 'MAGPIE_ADDR' | 'magpie-wiring' | 'default';

export interface MagpieEndpoint {
  baseURL: string;
  source: MagpieEndpointSource;
  /** The file or variable the address came from; never a credential. */
  detail?: string;
}

export interface MagpieEndpointOptions {
  env?: NodeJS.ProcessEnv;
  home?: string;
  /** A value the caller already chose (for example `--base-url` or a pinned resume). */
  explicit?: string;
}

/** A printable HTTP(S) endpoint; a bare `host:port` is read as HTTP. */
function endpointURL(value: unknown): string | undefined {
  const candidate = text(value, GATEWAY_INHERIT_LIMITS.urlChars);
  if (candidate === undefined) return undefined;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) ? candidate : `http://${candidate}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') return undefined;
    return candidate.includes('://') ? candidate : `http://${candidate}`;
  } catch { return undefined; }
}

function loopbackEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  } catch { return false; }
}

/**
 * Read Magpie's own wiring record: the endpoint it last wrote into a client.
 * The application keeps it in `stash.json` under `<client>.wired_at`; only a
 * bounded regular file and a loopback HTTP value are accepted. A malformed,
 * oversized, linked or absent record contributes nothing.
 */
function readMagpieWiring(home: string): { baseURL: string; file: string } | undefined {
  const file = path.join(home, '.config', 'magpie', 'stash.json');
  let fd: number | undefined;
  try {
    const stats = fs.lstatSync(file);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAGPIE_WIRING_LIMITS.fileBytes) return undefined;
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    if (!fs.fstatSync(fd).isFile()) return undefined;
    const document: unknown = JSON.parse(fs.readFileSync(fd, 'utf8'));
    if (typeof document !== 'object' || document === null || Array.isArray(document)) return undefined;
    const entries = Object.entries(document as Record<string, unknown>).slice(0, MAGPIE_WIRING_LIMITS.entries);
    const wired = entries
      .filter(([key, value]) => /^[A-Za-z0-9_.-]{1,64}\.wired_at$/.test(key) && typeof value === 'string')
      .map(([key, value]) => ({ key, baseURL: endpointURL(value) }))
      .filter((entry): entry is { key: string; baseURL: string } => entry.baseURL !== undefined && loopbackEndpoint(entry.baseURL))
      .sort((left, right) => left.key === 'claude.wired_at' ? -1 : right.key === 'claude.wired_at' ? 1
        : left.key.localeCompare(right.key));
    const chosen = wired[0];
    return chosen === undefined ? undefined : { baseURL: chosen.baseURL, file };
  } catch { return undefined; }
  finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { /* already closed */ } }
}

/**
 * Resolve the Magpie endpoint without contacting it: an explicit value wins,
 * then the harness environment, then Magpie's own configured address, then the
 * endpoint Magpie last wired into a client, then the application default.
 */
export function resolveMagpieEndpoint(options: MagpieEndpointOptions = {}): MagpieEndpoint {
  if (options.explicit !== undefined) return { baseURL: options.explicit, source: 'explicit' };
  const env = options.env ?? process.env;
  const fromEnvironment = endpointURL(env.LLM_BASE_URL);
  if (fromEnvironment !== undefined) return { baseURL: fromEnvironment, source: 'LLM_BASE_URL', detail: 'LLM_BASE_URL' };
  const configured = endpointURL(env.MAGPIE_ADDR);
  if (configured !== undefined && loopbackEndpoint(configured)) return { baseURL: configured, source: 'MAGPIE_ADDR', detail: 'MAGPIE_ADDR' };
  const wiring = readMagpieWiring(options.home ?? os.homedir());
  if (wiring !== undefined) return { baseURL: wiring.baseURL, source: 'magpie-wiring', detail: wiring.file };
  return { baseURL: MAGPIE_ENDPOINT_DEFAULT, source: 'default' };
}

export const MAGPIE_CALLER_KEY_PREFIX = 'sk-magpie-key-';
export const MAGPIE_REVOKED_KEY_PREFIX = 'sk-magpie-revoked-';

/** A revoked caller key carries the application's revoked marker. */
export function isRevokedMagpieCredential(credential: Pick<InheritedCredential, 'value'>): boolean {
  return credential.value.startsWith(MAGPIE_REVOKED_KEY_PREFIX);
}

export interface MagpieCredentialSelection {
  credential?: InheritedCredential;
  /** Variables whose value is a revoked caller key; no value is included. */
  revokedSources: string[];
  /** A revoked inherited value was re-read and replaced by a current one. */
  rotationRecovered: boolean;
}

/**
 * Choose a usable credential from ordered candidates. A revoked caller key is
 * never forwarded; the next source is tried instead. When every candidate is
 * revoked, an inherited value is re-read once so a rotation that landed after
 * the first read can still be picked up.
 */
export function selectMagpieCredential(
  candidates: ReadonlyArray<InheritedCredential | undefined>,
  reload?: () => InheritedCredential | undefined,
): MagpieCredentialSelection {
  const available = candidates.filter((candidate): candidate is InheritedCredential => candidate !== undefined);
  const revokedSources = available.filter(isRevokedMagpieCredential).map(candidate => candidate.variable);
  const current = available.find(candidate => !isRevokedMagpieCredential(candidate));
  if (current !== undefined) return { credential: current, revokedSources, rotationRecovered: false };
  if (revokedSources.length > 0 && reload !== undefined) {
    const fresh = reload();
    if (fresh !== undefined && !isRevokedMagpieCredential(fresh)
      && !available.some(candidate => candidate.value === fresh.value)) {
      return { credential: fresh, revokedSources, rotationRecovered: true };
    }
  }
  return { credential: undefined, revokedSources, rotationRecovered: false };
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
