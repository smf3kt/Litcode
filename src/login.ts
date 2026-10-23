import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { atomicWriteFile } from './atomic-write.js';
import { sameGateway } from './gateway-inherit.js';
import { GatewayProvider, type GatewayConfig, type ModelProvider, type ModelRequest } from './provider.js';

/**
 * Local sign-in for an Anthropic-compatible gateway.
 *
 * DeepSeek publishes no OAuth authorization server: its documented credential is an API key sent
 * as `x-api-key` against `https://api.deepseek.com/anthropic`. So the DeepSeek profile is the key
 * flow. The generic `oauth` profile implements the authorization-code + PKCE loopback flow for a
 * gateway that does run one; its access token is refreshed from the stored refresh token.
 *
 * A credential is written to `<userDir>/credentials.json` with mode 0600, is never placed in a
 * session journal, and is never printed: notices name the provider and the file, not the value.
 */

export const UNCONFIGURED_MODEL = 'unconfigured';
export const CREDENTIALS_FILE = 'credentials.json';
export const CREDENTIAL_FILE_BYTES = 64 * 1024;
export const OAUTH_CALLBACK_TIMEOUT_MS = 300_000;
export const TOKEN_EXCHANGE_TIMEOUT_MS = 60_000;

export interface LoginProfile {
  id: string;
  label: string;
  baseURL: string;
  auth: 'bearer' | 'api-key';
  models: readonly string[];
  defaultModel: string;
  /** Where a person creates the key; opened in the browser before the key prompt. */
  keyURL?: string;
  /** Set when this provider runs an OAuth authorization server. */
  oauth?: boolean;
}

export const LOGIN_PROFILES: Readonly<Record<string, LoginProfile>> = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/anthropic',
    auth: 'api-key',
    models: ['deepseek-flash', 'deepseek-v4-pro'],
    defaultModel: 'deepseek-flash',
    keyURL: 'https://platform.deepseek.com/api_keys',
  },
  oauth: {
    id: 'oauth',
    label: 'OAuth gateway',
    baseURL: '',
    auth: 'bearer',
    models: [],
    defaultModel: '',
    oauth: true,
  },
  custom: {
    id: 'custom',
    label: 'Custom endpoint',
    baseURL: '',
    auth: 'bearer',
    models: [],
    defaultModel: '',
  },
};

export const LOGIN_KINDS = ['deepseek', 'oauth', 'custom'] as const;
export type LoginKind = (typeof LOGIN_KINDS)[number];

const storedCredentialSchema = z.object({
  provider: z.string().min(1).max(64),
  kind: z.enum(['api-key', 'oauth']),
  baseURL: z.string().min(1).max(2048),
  auth: z.enum(['bearer', 'api-key']),
  model: z.string().min(1).max(256),
  key: z.string().min(1).max(8192),
  refreshToken: z.string().min(1).max(8192).optional(),
  expiresAt: z.number().int().positive().optional(),
  tokenURL: z.string().min(1).max(2048).optional(),
  clientId: z.string().min(1).max(512).optional(),
  scope: z.string().max(1024).optional(),
  updatedAt: z.string().min(1).max(64),
}).strict();
export type StoredCredential = z.infer<typeof storedCredentialSchema>;

const credentialFileSchema = z.object({
  version: z.literal(1),
  active: z.string().min(1).max(64).optional(),
  providers: z.record(storedCredentialSchema),
}).strict();
type CredentialFile = z.infer<typeof credentialFileSchema>;

/** A printable credential: no controls, no surrounding whitespace. */
function cleanSecret(value: unknown, max = 8192): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > max || /[\u0000-\u001f\u007f]/.test(trimmed)) return undefined;
  return trimmed;
}

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > max || /[\u0000-\u001f\u007f]/.test(trimmed)) return undefined;
  return trimmed;
}

function httpURL(value: unknown): string | undefined {
  const candidate = cleanText(value, 2048);
  if (candidate === undefined) return undefined;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') return undefined;
    return candidate.replace(/\/+$/, '');
  } catch { return undefined; }
}

export function credentialsPath(userDir: string): string {
  return path.join(path.resolve(userDir), CREDENTIALS_FILE);
}

/**
 * Read the credential file. A missing, unreadable, linked, oversized or malformed file answers an
 * empty store: a login is a convenience, and a damaged file must not stop a run.
 */
export function readCredentialFile(userDir: string): CredentialFile {
  const empty: CredentialFile = { version: 1, providers: {} };
  const file = credentialsPath(userDir);
  let fd: number | undefined;
  try {
    const stats = fs.lstatSync(file);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size > CREDENTIAL_FILE_BYTES) return empty;
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    if (!fs.fstatSync(fd).isFile()) return empty;
    const text = fs.readFileSync(fd, 'utf8');
    const parsed = credentialFileSchema.safeParse(JSON.parse(text) as unknown);
    return parsed.success ? parsed.data : empty;
  } catch { return empty; }
  finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { /* already closed */ } }
}

/** The credential new sessions use, or undefined when nothing is stored or it is unusable. */
export function readStoredCredential(userDir: string): StoredCredential | undefined {
  const file = readCredentialFile(userDir);
  const id = file.active ?? Object.keys(file.providers)[0];
  return id === undefined ? undefined : file.providers[id];
}

/**
 * Persist one credential. The file is regular, mode 0600, atomically replaced. A sign-in makes
 * the credential active; a token refresh passes `activate: false`, so it neither steals the
 * active choice from a later sign-in nor resurrects a credential the person removed.
 */
export function writeStoredCredential(userDir: string, credential: StoredCredential,
  options: { activate?: boolean } = {}): void {
  const file = credentialsPath(userDir);
  const current = readCredentialFile(userDir);
  const activate = options.activate !== false;
  if (!activate && current.providers[credential.provider] === undefined) return;
  const active = activate ? credential.provider : current.active;
  const next: CredentialFile = {
    version: 1,
    ...(active === undefined ? {} : { active }),
    providers: { ...current.providers, [credential.provider]: credential },
  };
  const content = JSON.stringify(next, null, 2) + '\n';
  if (Buffer.byteLength(content) > CREDENTIAL_FILE_BYTES) throw new Error('Credential store exceeds its byte limit');
  atomicWriteFile(file, content, { mode: 0o600, label: 'login' });
  try { fs.chmodSync(file, 0o600); } catch { /* the mode is advisory on some filesystems */ }
}

/** Remove one stored credential, or the active one. True when something was removed. */
export function removeStoredCredential(userDir: string, provider?: string): boolean {
  const file = credentialsPath(userDir);
  const current = readCredentialFile(userDir);
  const id = provider ?? current.active ?? Object.keys(current.providers)[0];
  if (id === undefined || current.providers[id] === undefined) return false;
  const providers = { ...current.providers };
  delete providers[id];
  const remaining = Object.keys(providers);
  if (remaining.length === 0) {
    try { fs.rmSync(file, { force: true }); } catch { return false; }
    return true;
  }
  const next: CredentialFile = { version: 1, active: remaining[0]!, providers };
  atomicWriteFile(file, JSON.stringify(next, null, 2) + '\n', { mode: 0o600, label: 'login' });
  return true;
}

/**
 * The stored credential when it is usable for `baseURL` (or when no endpoint is pinned yet).
 * `sameGateway` keeps a DeepSeek key from being sent to an unrelated endpoint.
 */
export function storedCredentialFor(userDir: string, baseURL?: string): StoredCredential | undefined {
  const credential = readStoredCredential(userDir);
  if (credential === undefined) return undefined;
  if (baseURL === undefined) return credential;
  return sameGateway(credential.baseURL, baseURL) ? credential : undefined;
}

export interface LoginPrompts {
  /** One choice; the value of the selected row. */
  choose(title: string, message: string, choices: readonly { label: string; value: string; description?: string }[]): Promise<string | undefined>;
  /** One free-text answer. */
  text(title: string, message: string): Promise<string | undefined>;
  notice(text: string): void;
}

export interface OAuthFlags {
  authorizeURL?: string;
  tokenURL?: string;
  clientId?: string;
  scope?: string;
}

export interface RunLoginOptions {
  kind: string;
  prompts: LoginPrompts;
  userDir: string;
  signal: AbortSignal;
  oauth?: OAuthFlags;
  /** A value already chosen on the command line wins over the prompt. */
  baseURL?: string;
  model?: string;
}

function nowISO(): string { return new Date().toISOString(); }

function base64url(bytes: Buffer): string {
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function openBrowser(url: string): void {
  // A headless host has nothing to open, and a test must not launch a browser; the URL is
  // printed either way.
  if (process.env.LITCODE_NO_BROWSER === '1' || process.env.CI === 'true') return;
  const command = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => { /* the URL is printed as well */ });
    child.unref();
  } catch { /* the URL is printed as well */ }
}

function listenLoopback(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') { reject(new Error('OAuth callback listener has no port')); return; }
      resolve(address.port);
    });
  });
}

/** Wait for the authorization redirect on the loopback listener. */
function waitForCode(server: http.Server, state: string, signal: AbortSignal, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: Error | undefined, code?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      if (error !== undefined) reject(error); else resolve(code!);
    };
    const onAbort = () => finish(new Error('OAuth login cancelled'));
    const timer = setTimeout(() => finish(new Error('OAuth login timed out')), timeoutMs);
    timer.unref();
    signal.addEventListener('abort', onAbort, { once: true });
    server.on('request', (request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') {
        response.writeHead(404, { 'content-type': 'text/plain' }); response.end('Not found'); return;
      }
      const page = (text: string) => {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(`<!doctype html><title>Login</title><p>${text}</p>`);
      };
      if (url.searchParams.has('error')) {
        page('Sign-in was not completed. You can close this window.');
        finish(new Error(`OAuth provider returned ${cleanText(url.searchParams.get('error'), 256) ?? 'an error'}`));
        return;
      }
      if (url.searchParams.get('state') !== state) {
        page('Sign-in state did not match. You can close this window.');
        finish(new Error('OAuth state did not match the request'));
        return;
      }
      const code = cleanSecret(url.searchParams.get('code'), 8192);
      if (code === undefined) {
        page('No authorization code was returned. You can close this window.');
        finish(new Error('OAuth callback carried no authorization code'));
        return;
      }
      page('Signed in. You can close this window.');
      finish(undefined, code);
    });
  });
}

/**
 * Ask the token endpoint for a token. A failure names the status and a bounded, sanitized
 * description only: a token endpoint (or a proxy in front of one) can echo the code, the refresh
 * token or the access token in its error body, and that message reaches stderr and the status row.
 */
async function exchangeToken(tokenURL: string, body: URLSearchParams, signal: AbortSignal,
  timeoutMs = TOKEN_EXCHANGE_TIMEOUT_MS): Promise<Record<string, unknown>> {
  const deadline = AbortSignal.timeout(timeoutMs);
  const response = await fetch(tokenURL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: body.toString(), signal: AbortSignal.any([signal, deadline]),
  });
  const text = (await response.text()).slice(0, 16 * 1024);
  if (!response.ok) throw new Error(`Token endpoint answered ${response.status}${tokenErrorDetail(text)}`);
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('Token endpoint did not return JSON'); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Token endpoint returned no object');
  return parsed as Record<string, unknown>;
}

/** The `error`/`error_description` fields of a failed token response, when it is a JSON object. */
function tokenErrorDetail(text: string): string {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return ''; }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return '';
  const fields = parsed as Record<string, unknown>;
  const code = cleanText(fields.error, 64);
  const description = cleanText(fields.error_description, 200);
  if (code === undefined && description === undefined) return '';
  return `: ${code ?? 'error'}${description === undefined ? '' : ` (${description})`}`;
}

async function oauthLogin(options: RunLoginOptions, prompts: LoginPrompts): Promise<StoredCredential> {
  const flags = options.oauth ?? {};
  const authorizeURL = httpURL(flags.authorizeURL) ?? httpURL(await prompts.text('Authorize URL', 'OAuth authorization endpoint URL'));
  const tokenURL = httpURL(flags.tokenURL) ?? httpURL(await prompts.text('Token URL', 'OAuth token endpoint URL'));
  const clientId = cleanText(flags.clientId, 512) ?? cleanText(await prompts.text('Client ID', 'OAuth client identifier'), 512);
  const baseURL = httpURL(options.baseURL) ?? httpURL(await prompts.text('Gateway base URL', 'Messages endpoint base the token is used against'));
  const model = cleanText(options.model, 256) ?? cleanText(await prompts.text('Model', 'Model ID to request from this gateway'), 256);
  if (authorizeURL === undefined || tokenURL === undefined || clientId === undefined || baseURL === undefined || model === undefined) {
    throw new Error('OAuth login needs an authorize URL, a token URL, a client ID, a base URL and a model');
  }
  const state = base64url(crypto.randomBytes(16));
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const server = http.createServer();
  try {
    const port = await listenLoopback(server);
    const redirectURI = `http://127.0.0.1:${port}/callback`;
    const target = new URL(authorizeURL);
    target.searchParams.set('response_type', 'code');
    target.searchParams.set('client_id', clientId);
    target.searchParams.set('redirect_uri', redirectURI);
    target.searchParams.set('state', state);
    target.searchParams.set('code_challenge', challenge);
    target.searchParams.set('code_challenge_method', 'S256');
    if (flags.scope !== undefined && flags.scope.trim() !== '') target.searchParams.set('scope', flags.scope.trim());
    prompts.notice(`Open this URL to sign in:\n${target.toString()}`);
    openBrowser(target.toString());
    const code = await waitForCode(server, state, options.signal, OAUTH_CALLBACK_TIMEOUT_MS);
    const token = await exchangeToken(tokenURL, new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: redirectURI,
      client_id: clientId, code_verifier: verifier,
    }), options.signal);
    const accessToken = cleanSecret(token.access_token);
    if (accessToken === undefined) throw new Error('Token endpoint returned no access token');
    const expiresIn = typeof token.expires_in === 'number' && Number.isFinite(token.expires_in) && token.expires_in > 0 ? token.expires_in : undefined;
    const credential: StoredCredential = {
      provider: 'oauth', kind: 'oauth', baseURL, auth: 'bearer', model, key: accessToken,
      tokenURL, clientId,
      ...(typeof token.refresh_token === 'string' && cleanSecret(token.refresh_token) !== undefined ? { refreshToken: cleanSecret(token.refresh_token)! } : {}),
      ...(expiresIn === undefined ? {} : { expiresAt: Date.now() + Math.floor(expiresIn * 1000) }),
      ...(flags.scope === undefined || flags.scope.trim() === '' ? {} : { scope: flags.scope.trim().slice(0, 1024) }),
      updatedAt: nowISO(),
    };
    writeStoredCredential(options.userDir, credential);
    return credential;
  } finally {
    server.close();
  }
}

/**
 * Run one login. The DeepSeek and custom profiles collect an API key; the OAuth profile runs the
 * loopback authorization-code flow. The credential is written before this returns.
 */
export async function runLogin(options: RunLoginOptions): Promise<StoredCredential> {
  const kind = options.kind.trim().toLowerCase();
  if (!(LOGIN_KINDS as readonly string[]).includes(kind)) {
    throw new Error(`Login provider must be one of ${LOGIN_KINDS.join(', ')}`);
  }
  const prompts = options.prompts;
  options.signal.throwIfAborted();
  if (kind === 'oauth') return oauthLogin(options, prompts);

  if (kind === 'deepseek') {
    const profile = LOGIN_PROFILES.deepseek!;
    if (profile.keyURL !== undefined) {
      prompts.notice(`Create an API key at ${profile.keyURL}`);
      openBrowser(profile.keyURL);
    }
    const key = cleanSecret(await prompts.text('DeepSeek API key', 'Paste the API key. It is stored in your harness user directory with mode 0600.'));
    if (key === undefined) throw new Error('No API key was entered');
    const picked = profile.models.length > 1
      ? await prompts.choose('DeepSeek model', 'Choose the model new sessions use',
        profile.models.map(model => ({ label: model, value: model })))
      : profile.defaultModel;
    const model = cleanText(options.model, 256) ?? cleanText(picked, 256) ?? profile.defaultModel;
    const credential: StoredCredential = {
      provider: profile.id, kind: 'api-key', baseURL: profile.baseURL, auth: profile.auth,
      model, key, updatedAt: nowISO(),
    };
    writeStoredCredential(options.userDir, credential);
    return credential;
  }

  const baseURL = httpURL(options.baseURL) ?? httpURL(await prompts.text('Gateway base URL', 'Messages endpoint base, for example https://gateway.example.test'));
  const model = cleanText(options.model, 256) ?? cleanText(await prompts.text('Model', 'Model ID to request from this gateway'), 256);
  const authChoice = await prompts.choose('Credential header', 'How this gateway expects the key',
    [{ label: 'Authorization: Bearer', value: 'bearer' }, { label: 'x-api-key', value: 'api-key' }]);
  const key = cleanSecret(await prompts.text('API key', 'Paste the key. It is stored in your harness user directory with mode 0600.'));
  if (baseURL === undefined || model === undefined || key === undefined) {
    throw new Error('Custom login needs a base URL, a model and a key');
  }
  const credential: StoredCredential = {
    provider: 'custom', kind: 'api-key', baseURL, auth: authChoice === 'api-key' ? 'api-key' : 'bearer',
    model, key, updatedAt: nowISO(),
  };
  writeStoredCredential(options.userDir, credential);
  return credential;
}

function isUnauthorized(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 401;
}

/**
 * A stored OAuth credential used against the gateway. An expired or rejected access token is
 * refreshed once from its refresh token and the refreshed value is written back to the store.
 */
class OAuthProvider implements ModelProvider {
  private inner: GatewayProvider;
  constructor(private credential: StoredCredential, private gateway: GatewayConfig,
    private userDir: string | undefined, private transport?: typeof fetch) {
    this.inner = new GatewayProvider(credential.key, gateway, transport);
  }

  private async ensureFresh(signal: AbortSignal): Promise<void> {
    if (this.credential.expiresAt === undefined || this.credential.refreshToken === undefined) return;
    if (Date.now() < this.credential.expiresAt - 60_000) return;
    await this.refresh(signal);
  }

  private async refresh(signal: AbortSignal): Promise<boolean> {
    const { refreshToken, tokenURL, clientId } = this.credential;
    if (refreshToken === undefined || tokenURL === undefined) return false;
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
    if (clientId !== undefined) body.set('client_id', clientId);
    if (this.credential.scope !== undefined) body.set('scope', this.credential.scope);
    const token = await exchangeToken(tokenURL, body, signal);
    const accessToken = cleanSecret(token.access_token);
    if (accessToken === undefined) return false;
    const expiresIn = typeof token.expires_in === 'number' && Number.isFinite(token.expires_in) && token.expires_in > 0 ? token.expires_in : undefined;
    this.credential = {
      ...this.credential,
      key: accessToken,
      ...(typeof token.refresh_token === 'string' && cleanSecret(token.refresh_token) !== undefined ? { refreshToken: cleanSecret(token.refresh_token)! } : {}),
      ...(expiresIn === undefined ? {} : { expiresAt: Date.now() + Math.floor(expiresIn * 1000) }),
      updatedAt: nowISO(),
    };
    this.inner = new GatewayProvider(accessToken, this.gateway, this.transport);
    if (this.userDir !== undefined) {
      // A refresh keeps the credential current but does not make it the default again: the
      // person's later sign-in, or another session's, owns that choice.
      try { writeStoredCredential(this.userDir, this.credential, { activate: false }); }
      catch { /* the session keeps the refreshed token */ }
    }
    return true;
  }

  async complete(request: ModelRequest, signal: AbortSignal, onText?: (text: string) => void, onThinking?: () => void) {
    await this.ensureFresh(signal);
    try { return await this.inner.complete(request, signal, onText, onThinking); }
    catch (error) {
      if (!isUnauthorized(error) || !(await this.refresh(signal))) throw error;
      return this.inner.complete(request, signal, onText, onThinking);
    }
  }

  async count(request: ModelRequest, signal: AbortSignal): Promise<number> {
    await this.ensureFresh(signal);
    try { return await this.inner.count(request, signal); }
    catch (error) {
      if (!isUnauthorized(error) || !(await this.refresh(signal))) throw error;
      return this.inner.count(request, signal);
    }
  }
}

/** Build the live provider for a stored credential. */
export function providerFromCredential(credential: StoredCredential, gateway: GatewayConfig,
  userDir?: string, transport?: typeof fetch): ModelProvider {
  return credential.kind === 'oauth'
    ? new OAuthProvider(credential, gateway, userDir, transport)
    : new GatewayProvider(credential.key, gateway, transport);
}

/**
 * A provider that starts without a credential and can adopt one later.
 *
 * The interactive loop, the runtime and the agent all hold this one object, so `/login` replaces
 * what it delegates to instead of rebuilding any of them. Until a credential is adopted, a model
 * request fails with the message that says how to sign in; the session itself starts normally.
 */
export interface ProviderSlot {
  readonly provider: ModelProvider;
  current(): ModelProvider | undefined;
  adopt(provider: ModelProvider): void;
  /** Replace the message a request fails with while nothing is adopted. */
  setMissing(message: string): void;
  adopted(): boolean;
}

export function createProviderSlot(missing: () => string): ProviderSlot {
  let current: ModelProvider | undefined;
  const fail = (): never => { throw new Error(missing()); };
  return {
    current: () => current,
    adopt(provider) { current = provider; },
    setMissing(message) { missing = () => message; },
    adopted: () => current !== undefined,
    provider: {
      count: async (request, signal) => current === undefined ? 0 : current.count(request, signal),
      complete: async (request, signal, onText, onThinking) => current === undefined
        ? fail() : current.complete(request, signal, onText, onThinking),
    },
  };
}

