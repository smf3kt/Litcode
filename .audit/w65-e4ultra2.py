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


E = 'components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx'
cut(E, """      buildPlanApprovalOptions({
        showClearContext,
        showUltraplan,
        usedPercent:""", """      buildPlanApprovalOptions({
        showClearContext,
        usedPercent:""")
cut(E, """      showClearContext,
      showUltraplan,
      usage,""", """      showClearContext,
      usage,""")
cut(E, """export function buildPlanApprovalOptions({
  showClearContext,
  showUltraplan,
  usedPercent,
  isAutoModeAvailable,
  isBypassPermissionsModeAvailable,
  onFeedbackChange,
}: {
  showClearContext: boolean
  showUltraplan: boolean
  usedPercent: number | null
""", """export function buildPlanApprovalOptions({
  showClearContext,
  usedPercent,
  isAutoModeAvailable,
  isBypassPermissionsModeAvailable,
  onFeedbackChange,
}: {
  showClearContext: boolean
  usedPercent: number | null
""")
cut(E, """  if (showUltraplan) {
    options.push({
      label: 'No, refine with Ultraplan on Claude Code on the web',
      value: 'ultraplan',
    })
  }

""")
print('e4 ultra2 ok')
