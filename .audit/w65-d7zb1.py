# -*- coding: utf-8 -*-
"""Final analytics cleanup: the two payload-computing telemetry functions and
the analytics gate whose only readers they were."""
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


# ------------------------------------------------------------------ main.tsx
M = 'main.tsx'
cut(M, "import { isAnalyticsDisabled } from 'src/services/analytics/config.js'\n")
cut(M, """import {
  findGitRoot,
  getBranch,
  getIsGit,
  getWorktreeCount,
} from './utils/git.js'
""", """import {
  findGitRoot,
  getBranch,
} from './utils/git.js'
""")
cut(M, "import { getGhAuthStatus } from './utils/github/ghAuthStatus.js'\n")
cut(M, "import { logContextMetrics } from 'src/utils/api.js'\n")

cut_between(M, 'function getCertEnvVarTelemetry(): Record<string, boolean> {',
            '// @[MODEL LAUNCH]')

cut(M, """      // Log context metrics once at initialization
      void logContextMetrics(regularMcpConfigs, toolPermissionContext)

""")
cut(M, "        void logStartupTelemetry()\n")

# --------------------------------------------------------------- utils/api.ts
A = 'utils/api.ts'
cut(A, "import { getSystemContext, getUserContext } from 'src/context.js'\n")
cut(A, "import { isAnalyticsDisabled } from 'src/services/analytics/config.js'\n")
cut(A, "import { prefetchAllMcpResources } from 'src/services/mcp/client.js'\n")
cut(A, "import type { ScopedMcpServerConfig } from 'src/services/mcp/types.js'\n")
cut(A, "import { getTools } from 'src/tools.js'\n")
cut(A, """import {
  getFileReadIgnorePatterns,
  normalizePatternsToPath,
} from './permissions/filesystem.js'
""")
cut(A, "import { countFilesRoundedRg } from './ripgrep.js'\n")

cut_between(A, '/**\n * Log metrics about context and system prompt size\n */\nexport async function logContextMetrics(',
            '// TODO: Generalize this to all tools')

# Imports whose last reader was one of the removed functions.
cut(M, """import {
  hasNodeOption,
  isBareMode,
  isEnvTruthy,
  isInProtectedNamespace,
} from './utils/envUtils.js'
""", """import {
  isBareMode,
  isEnvTruthy,
  isInProtectedNamespace,
} from './utils/envUtils.js'
""")
cut(A, "import { roughTokenCountEstimation } from '../services/tokenEstimation.js'\n")

os.remove(os.path.join(ROOT, 'services/analytics/config.ts'))
# ghAuthStatus existed only for the startup telemetry payload and was its last
# caller's last import.
os.remove(os.path.join(ROOT, 'utils/github/ghAuthStatus.ts'))
os.rmdir(os.path.join(ROOT, 'utils/github'))

print('cut ok')
