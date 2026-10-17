# -*- coding: utf-8 -*-
"""Wave D step 7w cut: the background auto-update UI lane.

Deletes the four updater components, the update-notification hook and the
install-messages hook, and folds the REPL -> PromptInput -> Footer/Notifications
prop chain that fed them. The update/install commands, the autoUpdater module
and the native installer stay for the next step.
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


R = 'screens/REPL.tsx'

cut(R, "import type { AutoUpdaterResult } from '../utils/autoUpdater.js'\n")
cut(R, "import { useInstallMessages } from 'src/hooks/notifs/useInstallMessages.js'\n")
cut(R, "  useInstallMessages()\n")
cut(R, """  const [autoUpdaterResult, setAutoUpdaterResult] =
    useState<AutoUpdaterResult | null>(null)

  useEffect(() => {
    if (autoUpdaterResult?.notifications) {
      autoUpdaterResult.notifications.forEach(notification => {
        addNotification({
          key: 'auto-updater-notification',
          text: notification,
          priority: 'low',
        })
      })
    }
  }, [autoUpdaterResult, addNotification])

""")
cut(R, """                        onAutoUpdaterResult={setAutoUpdaterResult}
                        autoUpdaterResult={autoUpdaterResult}
""")

P = 'components/PromptInput/PromptInput.tsx'

cut(P, "import type { AutoUpdaterResult } from '../../utils/autoUpdater.js'\n")
cut(P, """  onAutoUpdaterResult: (result: AutoUpdaterResult) => void
  autoUpdaterResult: AutoUpdaterResult | null
""")
cut(P, """  onAutoUpdaterResult,
  autoUpdaterResult,
""")
cut(P, "  const [isAutoUpdating, setIsAutoUpdating] = useState(false)\n")
cut(P, """        mode={mode}
        autoUpdaterResult={autoUpdaterResult}
        isAutoUpdating={isAutoUpdating}
        verbose={verbose}
        onAutoUpdaterResult={onAutoUpdaterResult}
        onChangeIsUpdating={setIsAutoUpdating}
        suggestions={suggestions}
""", """        mode={mode}
        verbose={verbose}
        suggestions={suggestions}
""")
cut(P, """            apiKeyStatus={apiKeyStatus}
            autoUpdaterResult={autoUpdaterResult}
            debug={debug}
            isAutoUpdating={isAutoUpdating}
            verbose={verbose}
            messages={messages}
            onAutoUpdaterResult={onAutoUpdaterResult}
            onChangeIsUpdating={setIsAutoUpdating}
            ideSelection={ideSelection}
""", """            apiKeyStatus={apiKeyStatus}
            debug={debug}
            verbose={verbose}
            messages={messages}
            ideSelection={ideSelection}
""")

F = 'components/PromptInput/PromptInputFooter.tsx'

cut(F, "import type { AutoUpdaterResult } from '../../utils/autoUpdater.js'\n")
cut(F, """  autoUpdaterResult: AutoUpdaterResult | null
  isAutoUpdating: boolean
""")
cut(F, """  onAutoUpdaterResult: (result: AutoUpdaterResult) => void
  onChangeIsUpdating: (isUpdating: boolean) => void
""")
cut(F, """  autoUpdaterResult,
  isAutoUpdating,
""")
cut(F, """  onAutoUpdaterResult,
  onChangeIsUpdating,
""")
cut(F, """              apiKeyStatus={apiKeyStatus}
              autoUpdaterResult={autoUpdaterResult}
              debug={debug}
              isAutoUpdating={isAutoUpdating}
              verbose={verbose}
              messages={messages}
              onAutoUpdaterResult={onAutoUpdaterResult}
              onChangeIsUpdating={onChangeIsUpdating}
              ideSelection={ideSelection}
""", """              apiKeyStatus={apiKeyStatus}
              debug={debug}
              verbose={verbose}
              messages={messages}
              ideSelection={ideSelection}
""")

N = 'components/PromptInput/Notifications.tsx'

cut(N, "import { AutoUpdaterWrapper } from '../AutoUpdaterWrapper.js'\n")
cut(N, "import type { AutoUpdaterResult } from '../../utils/autoUpdater.js'\n")
cut(N, """  autoUpdaterResult: AutoUpdaterResult | null
  isAutoUpdating: boolean
  debug: boolean
""", """  debug: boolean
""")
cut(N, """  onAutoUpdaterResult: (result: AutoUpdaterResult) => void
  onChangeIsUpdating: (isUpdating: boolean) => void
""", n=2)
cut(N, """  autoUpdaterResult,
  debug,
  isAutoUpdating,
""", """  debug,
""")
cut(N, """  onAutoUpdaterResult,
  onChangeIsUpdating,
""", n=2)
cut(N, """  // Hide update installed message when showing IDE selection
  const shouldShowAutoUpdater =
    !shouldShowIdeSelection ||
    isAutoUpdating ||
    autoUpdaterResult?.status !== 'success'

""")
cut(N, """          shouldShowAutoUpdater={shouldShowAutoUpdater}
          autoUpdaterResult={autoUpdaterResult}
          isAutoUpdating={isAutoUpdating}
""")
cut(N, """          onAutoUpdaterResult={onAutoUpdaterResult}
          onChangeIsUpdating={onChangeIsUpdating}
""")
cut(N, """  shouldShowAutoUpdater: boolean
  autoUpdaterResult: AutoUpdaterResult | null
  isAutoUpdating: boolean
""")
cut(N, """  shouldShowAutoUpdater,
  autoUpdaterResult,
  isAutoUpdating,
""")
cut(N, """      {shouldShowAutoUpdater && (
        <AutoUpdaterWrapper
          verbose={verbose}
          onAutoUpdaterResult={onAutoUpdaterResult}
          autoUpdaterResult={autoUpdaterResult}
          isUpdating={isAutoUpdating}
          onChangeIsUpdating={onChangeIsUpdating}
          showSuccessMessage={!isShowingCompactMessage}
        />
      )}
""")

cut(P, """        // Box renders later in tree order so it would paint over their
        // bottom row. Keeping Notifications mounted prevents AutoUpdater's
        // initial-check effect from re-firing on every slash-completion
        // toggle (PR#22413).
""", """        // Box renders later in tree order so it would paint over their
        // bottom row.
""")

D = 'utils/debugFilter.ts'
cut(D, "  // e.g., \"AutoUpdaterWrapper: Installation type: development\"\n",
      "  // e.g., \"MCP server: transport type: stdio\"\n")

for rel in [
    'components/AutoUpdater.tsx',
    'components/AutoUpdaterWrapper.tsx',
    'components/NativeAutoUpdater.tsx',
    'components/PackageManagerAutoUpdater.tsx',
    'hooks/useUpdateNotification.ts',
    'hooks/notifs/useInstallMessages.tsx',
]:
    path = os.path.join(ROOT, rel)
    assert os.path.exists(path), rel
    os.remove(path)

print('cut ok')
