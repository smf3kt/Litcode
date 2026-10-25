// Where a `/fork` copy runs, and the briefing it carries about the original checkout.
//
// Source: `gft` (chunk-24k7d6mw.js offset 38766, sha256
// `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`) with
// `keepParent:!0`, the `/fork` path `Ue` opens. Three values are computed before the child is
// spawned:
//
//   po  - the relocation target: the origin recorded when this session entered a worktree, else
//         the canonical root of the linked worktree this session was launched inside, else null.
//   xo  - `editsIn`, which decides whether the copy may edit this checkout at all.
//   Fo  - the briefing text handed to the copy.
//
// The recovered body reads those facts through `ur` (nearest ancestor holding `.git`), `gt`
// (follow a `.git` gitdir pointer to the main root) and `tG` (`ur` found a root that is not its
// own canonical root). This port asks Git for the same three facts - `--show-toplevel`,
// `--absolute-git-dir`, `--git-common-dir` - instead of re-implementing `gt`'s path parsing; the
// derived values are identical for a normal repository and for a linked worktree.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** `$M` (chunk-4ga3d1qe.js): the tool the briefing tells the copy to use. The recovered value is
 *  `EnterWorktree`; this build's equivalent tool is `worktree_create`. */
export const FORK_WORKTREE_TOOL = 'worktree_create';

/** `xo`: `this-tree` means the copy would edit the same checkout the original is working in. */
export type ForkEditsIn = 'this-tree' | 'own-worktree';

export type ForkRelocation = {
  /** `po.to`: the directory the copy runs in, when it is relocated away from this checkout. */
  readonly relocatedTo?: string;
  readonly editsIn?: ForkEditsIn;
  /** `Fo`: the briefing appended to the copy's system prompt. */
  readonly briefing?: string;
};

export type ForkRelocationInput = {
  /** `Ee()`: the checkout this session is working in. */
  readonly workspace: string;
  /** `dd().originalCwd`: set when `/worktree` relocated this session into an owned checkout. */
  readonly worktreeReturn?: string;
  /** `no.worktreePath`: the entered checkout's own path; defaults to `workspace`. */
  readonly worktreePath?: string;
  /** `no.worktreeBranch`: the branch `/worktree` recorded for this session. */
  readonly worktreeBranch?: string;
  /** `ft().worktree?.bgIsolation === "none"`. This build has no such setting, so absent is false,
   *  which is also the source's value when the setting is absent. */
  readonly isolationNone?: boolean;
};

/** `gft`'s `Fo` for an entered worktree, or for a session launched inside a linked worktree. */
export function forkBriefing(input: {
  workspace: string;
  /** `po.to`: present whenever the copy is relocated, which selects the first arm. */
  to?: string;
  /** `no.worktreePath`; absent for the launched case, where the text falls back to `Ee()`. */
  worktreePath?: string;
  /** `no.worktreeBranch`; absent when the session did not enter the worktree through `/worktree`. */
  branch?: string;
  editsIn?: ForkEditsIn;
  isolationNone?: boolean;
}): string | undefined {
  const tool = FORK_WORKTREE_TOOL;
  if (input.to !== undefined) {
    const branch = input.branch;
    const path_ = input.worktreePath ?? input.workspace;
    // The recovered template keeps `—` literal and drops each branch clause when the branch
    // is unknown, including the trailing "of the original's." sentence.
    const origin = `This conversation was forked out of ${path_}` +
      `${branch ? ` (branch ${branch})` : ''}, a linked worktree the original session is still working in — ` +
      `never edit files, run commands, or enter that worktree with ${tool}. You are in ${input.to}`;
    const own = input.isolationNone === true ? ''
      : `; before making code changes, create a new worktree of your own with ${tool} instead of reusing the original's` +
        (branch ? `, and if the task builds on the original's work, base your new branch on ${branch} rather than ` +
          `checking that branch out (it stays checked out in the original's worktree)` : '');
    return `${origin}${own}.`;
  }
  if (input.editsIn === 'own-worktree') {
    return `This conversation was forked from a session that is still working in this checkout ` +
      `(${input.workspace}). Before making code changes, create a new worktree of your own with ${tool} ` +
      `so your edits don't land where the original session is editing.`;
  }
  return undefined;
}

type GitResult = { code: number | null; stdout: string };

/** The same hardened invocation `WorktreeManager` uses: no inherited `GIT_*` routing, no hooks,
 *  no fsmonitor, no lazy fetch, and no optional locks. */
function git(cwd: string, args: readonly string[]): Promise<GitResult> {
  return new Promise(resolve => {
    const env: NodeJS.ProcessEnv = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
    Object.assign(env, { LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_OPTIONAL_LOCKS: '0',
      GIT_NO_LAZY_FETCH: '1' });
    let settled = false;
    const finish = (result: GitResult) => { if (!settled) { settled = true; resolve(result); } };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn('git', ['--no-pager', '--no-optional-locks', '-c', 'core.hooksPath=/dev/null',
        '-c', 'core.fsmonitor=false', '-c', 'maintenance.auto=false', ...args],
      { cwd, env, shell: false, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch { finish({ code: null, stdout: '' }); return; }
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* already exited */ } }, 5_000);
    let stdout = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', chunk => { stdout += String(chunk); });
    child.on('error', () => { clearTimeout(timer); finish({ code: null, stdout: '' }); });
    child.on('close', code => { clearTimeout(timer); finish({ code, stdout }); });
  });
}

/**
 * `po` and `xo` from `gft`. A checkout outside a repository, or any Git failure, yields no
 * relocation and no briefing, which is the source's `ur(...)===null` path.
 */
export async function forkRelocation(input: ForkRelocationInput, signal?: AbortSignal): Promise<ForkRelocation> {
  if (signal?.aborted) return {};
  const workspace = path.resolve(input.workspace);
  const entered = input.worktreeReturn === undefined ? undefined : path.resolve(input.worktreeReturn);
  if (entered !== undefined) {
    // `no.worktreeBranch` is recorded by the entry, not read back from HEAD; when the caller did
    // not record one, the briefing drops its branch clauses, which is the source's `undefined`.
    const branch = input.worktreeBranch;
    return { relocatedTo: entered, briefing: forkBriefing({ workspace, to: entered,
      ...(input.worktreePath === undefined ? {} : { worktreePath: input.worktreePath }),
      ...(branch === undefined || branch === '' ? {} : { branch }),
      ...(input.isolationNone === true ? { isolationNone: true } : {}) }) };
  }
  const top = await git(workspace, ['rev-parse', '--show-toplevel']);
  if (top.code !== 0 || top.stdout.trim() === '') return {};
  let root: string;
  try { root = fs.realpathSync(top.stdout.trim()); } catch { return {}; }
  const gitDir = await git(root, ['rev-parse', '--absolute-git-dir']);
  const commonDir = await git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  let canonical = root;
  if (gitDir.code === 0 && commonDir.code === 0) {
    const absoluteGitDir = path.resolve(gitDir.stdout.trim());
    const common = path.resolve(commonDir.stdout.trim());
    // `gt`: the `.git` entry points into `<common>/worktrees/<name>`, so the working-tree root is
    // a linked worktree and its canonical root is the directory that owns `common`.
    if (path.dirname(absoluteGitDir) === path.join(common, 'worktrees')) canonical = path.dirname(common);
  }
  if (canonical !== root) {
    // `po`'s second arm relocates only when the canonical root is itself a checkout
    // (`ur(Bn)===Bn`); otherwise `po` stays null and `xo` reports `this-tree`, because `tG` still
    // sees a root that is not its own canonical root.
    if (!fs.existsSync(path.join(canonical, '.git'))) return { editsIn: 'this-tree' };
    // The briefing's branch clause comes from `no.worktreeBranch`, the branch `/worktree` recorded
    // when this session entered the checkout. A session launched inside a linked worktree has no
    // such record (`no === null`), so its copy gets no branch clause even though the checkout is
    // on a branch; this port reads the current branch only when the caller supplied an origin.
    return { relocatedTo: canonical, briefing: forkBriefing({ workspace, to: canonical,
      ...(input.isolationNone === true ? { isolationNone: true } : {}) }) };
  }
  const editsIn: ForkEditsIn = input.isolationNone === true ? 'this-tree' : 'own-worktree';
  return { editsIn, ...(input.isolationNone === true ? {} : { briefing: forkBriefing({ workspace, editsIn }) }) };
}
