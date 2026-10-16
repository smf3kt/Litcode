import os

B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:90], n)
    wr(p, t.replace(old, new))


def cut_range(p, start, end, new=''):
    t = rd(p)
    i = t.index(start)
    j = t.index(end, i) + len(end)
    wr(p, t[:i] + new + t[j:])


# ================= components/Onboarding.tsx：SkippableStep 只剩 oauth 一个消费者 =================
O = 'components/Onboarding.tsx'
cut(O, """
export function SkippableStep({
  skip,
  onSkip,
  children,
}: {
  skip: boolean
  onSkip(): void
  children: React.ReactNode
}): React.ReactNode {
  useEffect(() => {
    if (skip) {
      onSkip()
    }
  }, [skip, onSkip])
  if (skip) {
    return null
  }
  return children
}
""")
t = rd(O)
assert 'SkippableStep' not in t and 'ConsoleOAuthFlow' not in t, 'Onboarding 残留'
wr(O, t)

# ================= cli/handlers/util.tsx =================
U = 'cli/handlers/util.tsx'
cut_range(
    U,
    "export async function setupTokenHandler(root: Root): Promise<void> {\n",
    "  root.unmount()\n  process.exit(0)\n}\n\n",
    "",
)
cut(U, "import { WelcomeV2 } from '../../components/LogoV2/WelcomeV2.js'\n")
cut(U, "import { Box, Text } from '../../ink.js'\n")
cut(U, "import { onChangeAppState } from '../../state/onChangeAppState.js'\n")
cut(U, "import { isAnthropicAuthEnabled } from '../../utils/auth.js'\n")
cut(U, " * setup-token, doctor, install\n", " * doctor, install\n")

# ================= main.tsx =================
M = 'main.tsx'
cut(M, """  // Setup token command
  program
    .command('setup-token')
    .description(
      'Set up a long-lived authentication token (requires Claude subscription)',
    )
    .action(async () => {
      const [{ setupTokenHandler }, { createRoot }] = await Promise.all([
        import('./cli/handlers/util.js'),
        import('./ink.js'),
      ])
      const root = await createRoot(getBaseRenderOptions(false))
      await setupTokenHandler(root)
    })

""")

# ================= services/analytics/firstPartyEventLoggingExporter.ts =================
E = 'services/analytics/firstPartyEventLoggingExporter.ts'
cut(E, "import { isOAuthTokenExpired } from '../oauth/client.js'\n")
t = rd(E)
anchor = "// Unique ID for this process run - used to isolate failed event files between runs"
assert t.count(anchor) == 1
t = t.replace(anchor, """// Ported from services/oauth/client.ts:344-353 — expiry with a 5-minute buffer.
// The event exporter is the last reader of this helper; it goes when the
// exporter's own account-network removal lands.
function isOAuthTokenExpired(expiresAt: number | null): boolean {
  if (expiresAt === null) {
    return false
  }

  const bufferTime = 5 * 60 * 1000
  const now = Date.now()
  const expiresWithBuffer = now + bufferTime
  return expiresWithBuffer >= expiresAt
}

""" + anchor, 1)
wr(E, t)

print('d2d ok')
