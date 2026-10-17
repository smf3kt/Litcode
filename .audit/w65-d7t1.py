# -*- coding: utf-8 -*-
"""Wave D step 7t cut: the stranded in-place CLI blocks.

Removes the empty registration shells and comment stubs the recovered base
left in main.tsx, entrypoints/cli.tsx and setup.ts for subcommands and flags
whose implementations are absent, plus the main.tsx import whose only call
site was one of those shells. The live `claude update`/`claude install`
commands stay with the auto-updater surface, which is software distribution
rather than an account/subscription network function.
"""
import os

ROOT = '/Users/mant1ssa/Projects/cc-base-2188'


def rd(rel):
    return open(os.path.join(ROOT, rel), encoding='utf-8').read()


def wr(rel, text):
    open(os.path.join(ROOT, rel), 'w', encoding='utf-8').write(text)


def cut(rel, old, new='', n=1):
    text = rd(rel)
    count = text.count(old)
    assert count == n, (rel, 'found', count, 'expected', n, old[:120])
    wr(rel, text.replace(old, new))


def cut_between(rel, start, end, new=''):
    text = rd(rel)
    assert text.count(start) == 1, (rel, 'start', text.count(start), start[:120])
    assert text.count(end) >= 1, (rel, 'end', text.count(end), end[:120])
    i = text.index(start)
    j = text.index(end, i + len(start))
    wr(rel, text[:i] + new + text[j:])


M = 'main.tsx'

# The only call site of the recorder installer was elided in the base dump;
# the import had no reader left.
cut(M, "import { installAsciicastRecorder } from './utils/asciicast.js'\n")

# Empty statement shells left where the dump elided a body.
cut(M, """      resetAutoModeOptInForDefaultOffer()
    }
    {}
""", """      resetAutoModeOptInForDefaultOffer()
    }
""")
cut(M, """  // Event loop stall detector — logs when the main thread is blocked >500ms
  {}
""")
cut(M, """          : DEFAULT_TASKS_MODE_TASK_LIST_ID
        : undefined
      {}
""", """          : DEFAULT_TASKS_MODE_TASK_LIST_ID
        : undefined
""")
cut(M, """      // Handle overly broad shell allow rules for ant users (Bash(*), PowerShell(*))
      {}
""")
# The removed shell sat between two blank lines; keep one.
cut(M, """      const { warnings, dangerousPermissions, overlyBroadBashPermissions } =
        initResult


      if (feature('TRANSCRIPT_CLASSIFIER')""", """      const { warnings, dangerousPermissions, overlyBroadBashPermissions } =
        initResult

      if (feature('TRANSCRIPT_CLASSIFIER')""")
cut(M, """  if (!isBareMode()) {
    void skillChangeDetector.initialize()
  }

}
""", """  if (!isBareMode()) {
    void skillChangeDetector.initialize()
  }
}
""")
cut(M, """      const explicitModel = options.model || process.env.ANTHROPIC_MODEL
      {}
""", """      const explicitModel = options.model || process.env.ANTHROPIC_MODEL
""")
cut(M, """        // Install asciicast recorder before Ink mounts (ant-only, opt-in via CLAUDE_CODE_TERMINAL_RECORDING=1)
        {}
""")
cut(M, """            m.startBackgroundHousekeeping(),
          )
          {}
""", """            m.startBackgroundHousekeeping(),
          )
""")
cut(M, """      ).hideHelp(),
    )
  }

  {}

  if (feature('TRANSCRIPT_CLASSIFIER')) {
""", """      ).hideHelp(),
    )
  }

  if (feature('TRANSCRIPT_CLASSIFIER')) {
""")

# Registration stubs for subcommands whose modules are absent. Anchored on the
# surrounding live code so the whitespace-only lines the dump left behind go too.
cut_between(M, '  // claude server\n',
            '  /**\n   * Helper function to handle marketplace command errors consistently.')
cut_between(M, '  // claude up — run the project\'s CLAUDE.md "# claude up" setup instructions.\n',
            '  // claude install\n')
cut_between(M, '  // ant-only commands\n',
            "  profileCheckpoint('run_before_parse')")

# ---------------------------------------------------------- entrypoints
E = 'entrypoints/cli.tsx'
cut_between(E, '  // Fast-path for `--daemon-worker=<kind>` (internal — supervisor spawns this).',
            '  // Fast-path for --worktree --tmux: exec into tmux before loading full CLI')

# ---------------------------------------------------------------- setup
S = 'setup.ts'
cut(S, "import { feature } from 'bun:bundle'\n")
cut(S, """    if (feature('COMMIT_ATTRIBUTION')) {
      // Dynamic import to enable dead code elimination (module contains excluded strings).
      // Defer to next tick so the git subprocess spawn runs after first render
      // rather than during the setup() microtask window.
      setImmediate(() => {
      })
    }
""")

print('cut ok')
