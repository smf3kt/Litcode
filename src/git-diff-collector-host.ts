import { AsyncLocalStorage } from 'node:async_hooks';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { GIT_DIFF_BASE_ARGS, gitDiffEnvironment } from './git-diff-status.js';
export { Pcr } from './git-diff-status-source.js';

interface CollectionOwner { cwd: string; sessionStart: number }
interface GitOptions { cwd?: string; abortSignal?: AbortSignal; timeout?: number }
interface GitResult { code: number; exitCode: number; stdout: string }
const owners = new AsyncLocalStorage<CollectionOwner>();
const owner = (): CollectionOwner => {
  const value = owners.getStore();
  if (!value) throw new Error('Git diff collection has no session owner');
  return value;
};
export const withDiffCollection = <T>(value: CollectionOwner, run: () => T): T => owners.run(value, run);
export const F = 50, L = 500, Nt = 500, tDe = 5000;
export const dxn = GIT_DIFF_BASE_ARGS;
export const U3t = (): string => owner().cwd;
export const jnt = U3t;
export const R1e = (): number => owner().sessionStart;
export const Rcr = (): boolean => true;
/** ze/hcr, chunk-j8hqhz0c.js [34177,34308)/[5686,5768) UTF-16. */
export const ze = (cwd: string): string | null | undefined => {
  const parse = (text: string | undefined): Map<string, string> => {
    try {
      const value: unknown = JSON.parse(text ?? '{}');
      return value && typeof value === 'object'
        ? new Map(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : new Map();
    } catch { return new Map(); }
  };
  const checkouts = process.env.LITCODE_REPO_CHECKOUTS
    ? parse(process.env.LITCODE_REPO_CHECKOUTS) : new Map([['', owner().cwd]]);
  const checkout = [...checkouts].find(([, root]) => cwd === root || cwd.startsWith(root + path.sep))?.[0];
  const value = (checkout === undefined ? undefined : parse(process.env.LITCODE_BASE_REFS).get(checkout)) || process.env.LITCODE_BASE_REF;
  if (!value) return undefined;
  return value.startsWith('-') ? null : value;
};
export const Ot = (): string => 'git';
export const N = (): Record<string, never> => ({});
export const f = (): void => {};
export const g = (): void => {};
export const c = (): void => {};
export const d = (value: unknown): unknown => value;
export const Vt = { of: () => ({ baseResolveSadLogged: true, baseResolveOkLogged: true }) };

export function st(_executable: string, args: readonly string[], options: GitOptions = {}): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    execFile('git', [...args], {
      cwd: options.cwd ?? owner().cwd, env: gitDiffEnvironment(), signal: options.abortSignal,
      timeout: options.timeout ?? tDe, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8', windowsHide: true,
    }, (error, stdout) => {
      if (!error) { resolve({ code: 0, exitCode: 0, stdout }); return; }
      const code = (error as NodeJS.ErrnoException).code;
      if (typeof code === 'number') resolve({ code, exitCode: code, stdout });
      else reject(error);
    });
  });
}
export function j(args: readonly string[], signal?: AbortSignal, cwd?: string): Promise<GitResult> {
  return st('git', [...GIT_DIFF_BASE_ARGS, ...args], { cwd, abortSignal: signal });
}
export async function t4(cwd: string): Promise<string | null> {
  const result = await st('git', ['--no-optional-locks', 'rev-parse', '--git-dir'], { cwd });
  return result.code === 0 ? path.resolve(cwd, result.stdout.trim()) : null;
}

/** Hd/FR/sRr source branch discovery, with the local process boundary substituted. */
export async function Hd(cwd: string, options: GitOptions): Promise<string> {
  const result = await st('git', ['--no-optional-locks', 'rev-parse', '--abbrev-ref', 'HEAD'], { ...options, cwd });
  return result.code === 0 ? result.stdout.trim() || 'HEAD' : 'HEAD';
}
export async function FR(cwd: string, options: GitOptions): Promise<string> {
  const result = await st('git', ['--no-optional-locks', 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { ...options, cwd });
  if (result.code === 0) {
    const name = result.stdout.trim().replace(/^origin\//, '');
    if (name && (await st('git', ['--no-optional-locks', 'show-ref', '--verify', '--quiet', `refs/remotes/origin/${name}`], { ...options, cwd })).code === 0) return name;
  }
  for (const name of ['main', 'master']) {
    if ((await st('git', ['--no-optional-locks', 'show-ref', '--verify', '--quiet', `refs/remotes/origin/${name}`], { ...options, cwd })).code === 0) return name;
  }
  return 'main';
}
