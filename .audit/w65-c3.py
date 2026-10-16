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


def cut_all(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n >= 1, (p, old[:90], n)
    wr(p, t.replace(old, new))


# ---------- components/Message.tsx ----------
M = 'components/Message.tsx'
cut_all(M, "  onOpenRateLimitOptions?: () => void\n")
cut_all(M, "  onOpenRateLimitOptions,\n")
cut(M, "              onOpenRateLimitOptions={onOpenRateLimitOptions}\n")
cut_all(M, "          onOpenRateLimitOptions={onOpenRateLimitOptions}\n")

# ---------- components/Settings/Settings.tsx ----------
S = 'components/Settings/Settings.tsx'
cut(S, "import { Usage } from './Usage.js'\n")
cut(S, "  defaultTab: 'Status' | 'Config' | 'Usage' | 'Gates'\n",
    "  defaultTab: 'Status' | 'Config' | 'Gates'\n")
cut(S, """    <Tab key="usage" title="Usage">
      <Usage />
    </Tab>,
""")

# ---------- delete files ----------
for p in ['components/Settings/Usage.tsx', 'services/api/usage.ts']:
    os.remove(B + p)

print('c3 ok')
