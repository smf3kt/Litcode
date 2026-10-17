"""W65 wave D step 7g: the assistant-mode tool surface and the push-notification settings.

Assistant mode (feature('KAIROS')) shipped three tools — SendUserFileTool (deliver a
file as a message), PushNotificationTool (push to a phone) and SubscribePRTool
(GitHub PR webhooks) — each behind its own flag with a conditional require whose
target module is not in this build. The name constant they shared with three
readers, the push-notification settings group they configured, and the three
global-config fields behind those settings all fold away with the false flags.
"""

import os
import shutil

B = '/Users/mant1ssa/Projects/cc-base-2188/'
Q = '/Users/mant1ssa/Projects/cc_reverse/.audit/w65-d7g-baks/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new='', n=1):
    t = rd(p)
    c = t.count(old)
    assert c == n, (p, old[:70], c)
    wr(p, t.replace(old, new))


def cut_upto(p, start_sub, keep_sub, new=''):
    t = rd(p)
    assert t.count(start_sub) == 1, (p, 'start', start_sub[:70], t.count(start_sub))
    i = t.index(start_sub)
    i = t.rindex('\n', 0, i) + 1
    k = t.index(keep_sub, i)
    k = t.rindex('\n', 0, k) + 1
    removed = t[i:k]
    sep = '\n' if removed.endswith('\n\n') else ''
    wr(p, t[:i] + new + sep + t[k:])


# ---- 1. the ported prompt module; its three readers go below ---------------
for f in os.listdir(B + 'tools/SendUserFileTool'):
    if '.w' in f:
        os.makedirs(Q + 'tools/SendUserFileTool/', exist_ok=True)
        shutil.copy2(B + 'tools/SendUserFileTool/' + f, Q + 'tools/SendUserFileTool/' + f)
        assert open(B + 'tools/SendUserFileTool/' + f, 'rb').read() == open(
            Q + 'tools/SendUserFileTool/' + f, 'rb'
        ).read()
        print('quarantined', f)
os.remove(B + 'tools/SendUserFileTool/prompt.ts')
os.rmdir(B + 'tools/SendUserFileTool')

# ---- 2. tools.ts: the three conditional requires and their pool entries ----
cut(
    'tools.ts',
    """const SendUserFileTool = feature('KAIROS')
  ? require('./tools/SendUserFileTool/SendUserFileTool.js').SendUserFileTool
  : null
const PushNotificationTool =
  feature('KAIROS') || feature('KAIROS_PUSH_NOTIFICATION')
    ? require('./tools/PushNotificationTool/PushNotificationTool.js')
        .PushNotificationTool
    : null
const SubscribePRTool = feature('KAIROS_GITHUB_WEBHOOKS')
  ? require('./tools/SubscribePRTool/SubscribePRTool.js').SubscribePRTool
  : null
""",
)
cut(
    'tools.ts',
    """    ...(SendUserFileTool ? [SendUserFileTool] : []),
    ...(PushNotificationTool ? [PushNotificationTool] : []),
    ...(SubscribePRTool ? [SubscribePRTool] : []),
""",
)

# ---- 3. the three readers of the shared tool name -------------------------
cut(
    'components/Messages.tsx',
    """const SEND_USER_FILE_TOOL_NAME: string | null = feature('KAIROS')
  ? (
      require('../tools/SendUserFileTool/prompt.js') as typeof import('../tools/SendUserFileTool/prompt.js')
    ).SEND_USER_FILE_TOOL_NAME
  : null
""",
)
cut(
    'components/Messages.tsx',
    """      const briefToolNames = [BRIEF_TOOL_NAME, SEND_USER_FILE_TOOL_NAME].filter(
        (n): n is string => n !== null,
      )
      // dropTextInBriefTurns should only trigger on SendUserMessage turns —
      // SendUserFile delivers a file without replacement text, so dropping
      // assistant text for file-only turns would leave the user with no context.
""",
    """      const briefToolNames = [BRIEF_TOOL_NAME].filter(
        (n): n is string => n !== null,
      )
""",
)
cut(
    'tools/ToolSearchTool/prompt.ts',
    """const SEND_USER_FILE_TOOL_NAME: string | null = feature('KAIROS')
  ? (
      require('../SendUserFileTool/prompt.js') as typeof import('../SendUserFileTool/prompt.js')
    ).SEND_USER_FILE_TOOL_NAME
  : null
""",
)
cut(
    'tools/ToolSearchTool/prompt.ts',
    """
  // SendUserFile is a file-delivery communication channel (sibling of Brief).
  // Must be immediately available without a ToolSearch round-trip.
  if (
    feature('KAIROS') &&
    SEND_USER_FILE_TOOL_NAME &&
    tool.name === SEND_USER_FILE_TOOL_NAME &&
    isReplBridgeActive()
  ) {
    return false
  }
""",
)
cut(
    'utils/conversationRecovery.ts',
    """const SEND_USER_FILE_TOOL_NAME: string | null = feature('KAIROS')
  ? (
      require('../tools/SendUserFileTool/prompt.js') as typeof import('../tools/SendUserFileTool/prompt.js')
    ).SEND_USER_FILE_TOOL_NAME
  : null
""",
)
cut(
    'utils/conversationRecovery.ts',
    """        return (
          b.name === BRIEF_TOOL_NAME ||
          b.name === LEGACY_BRIEF_TOOL_NAME ||
          b.name === SEND_USER_FILE_TOOL_NAME
        )
""",
    """        return b.name === BRIEF_TOOL_NAME || b.name === LEGACY_BRIEF_TOOL_NAME
""",
)

# ---- 4. the push-notification settings group ------------------------------
cut(
    'components/Settings/Config.tsx',
    """      label:
        feature('KAIROS') || feature('KAIROS_PUSH_NOTIFICATION')
          ? 'Local notifications'
          : 'Notifications',
""",
    """      label: 'Notifications',
""",
)
cut(
    'components/Settings/Config.tsx',
    """    ...(feature('KAIROS') || feature('KAIROS_PUSH_NOTIFICATION')
      ? [
          {
            id: 'taskCompleteNotifEnabled',
            label: 'Push when idle',
            value: globalConfig.taskCompleteNotifEnabled ?? false,
            type: 'boolean' as const,
            onChange(taskCompleteNotifEnabled: boolean) {
              saveGlobalConfig(current => ({
                ...current,
                taskCompleteNotifEnabled,
              }))
              setGlobalConfig({
                ...getGlobalConfig(),
                taskCompleteNotifEnabled,
              })
            },
          },
          {
            id: 'inputNeededNotifEnabled',
            label: 'Push when input needed',
            value: globalConfig.inputNeededNotifEnabled ?? false,
            type: 'boolean' as const,
            onChange(inputNeededNotifEnabled: boolean) {
              saveGlobalConfig(current => ({
                ...current,
                inputNeededNotifEnabled,
              }))
              setGlobalConfig({
                ...getGlobalConfig(),
                inputNeededNotifEnabled,
              })
            },
          },
          {
            id: 'agentPushNotifEnabled',
            label: 'Push when Claude decides',
            value: globalConfig.agentPushNotifEnabled ?? false,
            type: 'boolean' as const,
            onChange(agentPushNotifEnabled: boolean) {
              saveGlobalConfig(current => ({
                ...current,
                agentPushNotifEnabled,
              }))
              setGlobalConfig({
                ...getGlobalConfig(),
                agentPushNotifEnabled,
              })
            },
          },
        ]
      : []),
""",
)
cut(
    'tools/ConfigTool/supportedSettings.ts',
    """  ...(feature('KAIROS') || feature('KAIROS_PUSH_NOTIFICATION')
    ? {
        taskCompleteNotifEnabled: {
          source: 'global' as const,
          type: 'boolean' as const,
          description:
            'Push to your mobile device when idle after Claude finishes (requires Remote Control)',
        },
        inputNeededNotifEnabled: {
          source: 'global' as const,
          type: 'boolean' as const,
          description:
            'Push to your mobile device when a permission prompt or question is waiting (requires Remote Control)',
        },
        agentPushNotifEnabled: {
          source: 'global' as const,
          type: 'boolean' as const,
          description:
            'Allow Claude to push to your mobile device when it deems it appropriate (requires Remote Control)',
        },
      }
    : {}),
""",
)
cut(
    'utils/config.ts',
    """
  // Push-notification toggles (set via /config). Default off — explicit opt-in required.
  taskCompleteNotifEnabled?: boolean
  inputNeededNotifEnabled?: boolean
  agentPushNotifEnabled?: boolean
""",
)
cut(
    'utils/config.ts',
    """  'taskCompleteNotifEnabled',
  'inputNeededNotifEnabled',
  'agentPushNotifEnabled',
""",
)

print('d7g1 ok')
