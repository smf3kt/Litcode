import os
import shutil

B = '/Users/mant1ssa/Projects/cc-base-2188/'
Q = '/Users/mant1ssa/Projects/cc_reverse/.audit/w65-d5-baks/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:80], n)
    wr(p, t.replace(old, new))


# ---- 1. baks first (the wave-A slip is not repeated) ----
for rel in [
    'hooks/useVoiceIntegration.tsx.w54bak',
    'context/voice.tsx.w54bak',
    'components/PromptInput/VoiceIndicator.tsx.w54bak',
    'components/LogoV2/VoiceModeNotice.tsx.w54bak',
]:
    src = B + rel
    assert os.path.exists(src), rel
    dst = Q + rel
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    assert open(src, 'rb').read() == open(dst, 'rb').read(), rel
    print('quarantined', rel)

# ---- 2. the modules ----
shutil.rmtree(B + 'voice')
for rel in [
    'services/voiceStreamSTT.ts',
    'services/voice.ts',
    'services/voiceKeyterms.ts',
    'hooks/useVoice.ts',
    'hooks/useVoiceEnabled.ts',
    'hooks/useVoiceIntegration.tsx',
    'context/voice.tsx',
    'components/PromptInput/VoiceIndicator.tsx',
    'components/LogoV2/VoiceModeNotice.tsx',
]:
    os.remove(B + rel)

# ---- 3. AppState.tsx: the provider is a passthrough with no provider left ----
A = 'state/AppState.tsx'
cut(A, "import { feature } from 'bun:bundle'\n")
cut(A, """// DCE: voice context is ant-only. External builds get a passthrough.
/* eslint-disable @typescript-eslint/no-require-imports */
const VoiceProvider: (props: { children: React.ReactNode }) => React.ReactNode =
  feature('VOICE_MODE')
    ? require('../context/voice.js').VoiceProvider
    : ({ children }) => children

/* eslint-enable @typescript-eslint/no-require-imports */
""")
cut(A, "          <VoiceProvider>{children}</VoiceProvider>\n", "          {children}\n")

# ---- 4. defaultBindings: the push-to-talk binding ----
cut('keybindings/defaultBindings.ts', """      // Voice activation (hold-to-talk). Registered so getShortcutDisplay
      // finds it without hitting the fallback analytics log. To rebind,
      // add a voice:pushToTalk entry (last wins); to disable, use /voice
      // — null-unbinding space hits a pre-existing useKeybinding.ts trap
      // where 'unbound' swallows the event (space dead for typing).
      ...(feature('VOICE_MODE') ? { space: 'voice:pushToTalk' } : {}),
""")

# ---- 5. the setting registration in both registries ----
cut('tools/ConfigTool/supportedSettings.ts', """  ...(feature('VOICE_MODE')
    ? {
        voiceEnabled: {
          source: 'settings' as const,
          type: 'boolean' as const,
          description: 'Enable voice dictation (hold-to-talk)',
        },
      }
    : {}),
""")
cut('utils/settings/types.ts', """      ...(feature('VOICE_MODE')
        ? {
            voiceEnabled: z
              .boolean()
              .optional()
              .describe('Enable voice mode (hold-to-talk dictation)'),
          }
        : {}),
""")

# ---- 6. prompt.ts: the kill-switch filter for a key that no longer exists ----
P = 'tools/ConfigTool/prompt.ts'
cut(P, "import { feature } from 'bun:bundle'\n")
cut(P, "import { isVoiceGrowthBookEnabled } from '../../voice/voiceModeEnabled.js'\n")
cut(P, """    // Voice settings are registered at build-time but gated by GrowthBook
    // at runtime. Hide from model prompt when the kill-switch is on.
    if (
      feature('VOICE_MODE') &&
      key === 'voiceEnabled' &&
      !isVoiceGrowthBookEnabled()
    )
      continue

""")

# ---- 7. LogoV2: three render sites of a notice that is now gone ----
L = 'components/LogoV2/LogoV2.tsx'
cut(L, "import { VoiceModeNotice } from './VoiceModeNotice.js'\n")
cut(L, """// whole file. VoiceModeNotice uses the unsafe helper pattern but VOICE_MODE
// is external: true so it's moot there.
""", "// whole file.\n")
t = rd(L)
assert t.count("        <VoiceModeNotice />\n") == 2, t.count("        <VoiceModeNotice />\n")
t = t.replace("        <VoiceModeNotice />\n", "")
assert t.count("      <VoiceModeNotice />\n") == 1
wr(L, t.replace("      <VoiceModeNotice />\n", ""))

print('d5a ok')
