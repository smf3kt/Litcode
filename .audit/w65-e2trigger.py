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


# ---------- tools.ts ----------
T = 'tools.ts'
cut(T, """const RemoteTriggerTool = feature('AGENT_TRIGGERS_REMOTE')
  ? require('./tools/RemoteTriggerTool/RemoteTriggerTool.js').RemoteTriggerTool
  : null
""")
cut(T, "    ...(RemoteTriggerTool ? [RemoteTriggerTool] : []),\n")

# ---------- skills/bundled/index.ts ----------
I = 'skills/bundled/index.ts'
cut(I, """  if (feature('AGENT_TRIGGERS_REMOTE')) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const {
      registerScheduleRemoteAgentsSkill,
    } = require('./scheduleRemoteAgents.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    registerScheduleRemoteAgentsSkill()
  }
""")

# ---------- screens/REPL.tsx ----------
R = 'screens/REPL.tsx'
cut(R, "import { RemoteCallout } from '../components/RemoteCallout.js'\n")
cut(R, "  const showRemoteCallout = useAppState(s => s.showRemoteCallout)\n")
cut(R, """    // Remote callout (shown once before first bridge enable)
    if (allowDialogsWithAnimation && showRemoteCallout) return 'remote-callout'

""")
cut(R, """                {focusedInputDialog === 'remote-callout' && (
                  <RemoteCallout
                    onDone={selection => {
                      setAppState(prev => {
                        if (!prev.showRemoteCallout) return prev
                        return {
                          ...prev,
                          showRemoteCallout: false,
                          ...(selection === 'enable' && {
                            replBridgeEnabled: true,
                            replBridgeExplicit: true,
                            replBridgeOutboundOnly: false,
                          }),
                        }
                      })
                    }}
                  />
                )}

""")

# ---------- state/AppStateStore.ts ----------
S = 'state/AppStateStore.ts'
cut(S, """  // Always-on bridge: first-time remote dialog pending (set by /remote-control command)
  showRemoteCallout: boolean
""")
cut(S, "    showRemoteCallout: false,\n")

# ---------- main.tsx ----------
M = 'main.tsx'
cut(M, "        showRemoteCallout: false,\n")

# ---------- delete ----------
for p in [
    'tools/RemoteTriggerTool/RemoteTriggerTool.ts',
    'tools/RemoteTriggerTool/prompt.ts',
    'tools/RemoteTriggerTool/UI.tsx',
    'skills/bundled/scheduleRemoteAgents.ts',
    'components/RemoteCallout.tsx',
]:
    os.remove(B + p)
os.rmdir(B + 'tools/RemoteTriggerTool')
print('e2 trigger ok')
