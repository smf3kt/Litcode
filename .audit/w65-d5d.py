B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:80], n)
    wr(p, t.replace(old, new))


# ================= Notifications.tsx =================
N = 'components/PromptInput/Notifications.tsx'
cut(N, "import { useVoiceState } from '../../context/voice.js'\n")
cut(N, "import { useVoiceEnabled } from '../../hooks/useVoiceEnabled.js'\n")
cut(N, """/* eslint-disable @typescript-eslint/no-require-imports */
const VoiceIndicator: typeof import('./VoiceIndicator.js').VoiceIndicator =
  feature('VOICE_MODE')
    ? require('./VoiceIndicator.js').VoiceIndicator
    : () => null
/* eslint-enable @typescript-eslint/no-require-imports */

""")
cut(N, """  // Voice state (VOICE_MODE builds only, runtime-gated by GrowthBook)
  const voiceState = feature('VOICE_MODE')
    ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
      useVoiceState(s => s.voiceState)
    : ('idle' as const)
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const voiceEnabled = feature('VOICE_MODE') ? useVoiceEnabled() : false
  const voiceError = feature('VOICE_MODE')
    ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
      useVoiceState(s => s.voiceError)
    : null
  const isBriefOnly =
""", """  const isBriefOnly =
""")
cut(N, """  // When voice is actively recording or processing, replace all
  // notifications with just the voice indicator.
  if (
    feature('VOICE_MODE') &&
    voiceEnabled &&
    (voiceState === 'recording' || voiceState === 'processing')
  ) {
    return <VoiceIndicator voiceState={voiceState} />
  }

""")

# ================= TextInput.tsx =================
T = 'components/TextInput.tsx'
cut(T, "import { feature } from 'bun:bundle'\n")
cut(T, "import { useVoiceState } from '../context/voice.js'\n")
cut(T, "import { hueToRgb } from './Spinner/utils.js'\n")
cut(T, """import {
  Box,
  color,
  useAnimationFrame,
  useTerminalFocus,
  useTheme,
} from '../ink.js'
""", """import { Box, color, useTerminalFocus, useTheme } from '../ink.js'
""")
cut(T, """// Block characters for waveform bars: space (silent) + 8 rising block elements.
const BARS = ' ▁▂▃▄▅▆▇█'

// Mini waveform cursor width
const CURSOR_WAVEFORM_WIDTH = 1

// Smoothing factor (0 = instant, 1 = frozen). Applied as EMA to
// smooth both rises and falls for a steady, non-jittery bar.
const SMOOTH = 0.7

// Boost factor for audio levels — computeLevel normalizes with a
// conservative divisor (rms/2000), so normal speech sits around
// 0.3-0.5. This multiplier lets the bar use the full range.
const LEVEL_BOOST = 1.8

// Raw audio level threshold (pre-boost) below which the cursor is
// grey. computeLevel returns sqrt(rms/2000), so ambient mic noise
// typically sits at 0.05-0.15. Speech starts around 0.2+.
const SILENCE_THRESHOLD = 0.15

""")
cut(T, """  const settings = useSettings()
  const reducedMotion = settings.prefersReducedMotion ?? false

  const voiceState = feature('VOICE_MODE')
    ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
      useVoiceState(s => s.voiceState)
    : ('idle' as const)
  const isVoiceRecording = voiceState === 'recording'

  const audioLevels = feature('VOICE_MODE')
    ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
      useVoiceState(s => s.voiceAudioLevels)
    : []
  const smoothedRef = useRef<number[]>(new Array(CURSOR_WAVEFORM_WIDTH).fill(0))

  const needsAnimation = isVoiceRecording && !reducedMotion
  const [animRef, animTime] = feature('VOICE_MODE')
    ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
      useAnimationFrame(needsAnimation ? 50 : null)
    : [() => {}, 0]

""", """  // The animation-frame ref stays as the source's own external-build value:
  // `[() => {}, 0]` destructured, with only the ref ever reaching the Box.
  const animRef = () => {}

""")
cut(T, """  // Cursor invert function: mini waveform during voice recording,
  // standard chalk.inverse otherwise. No warmup pulse — the ~120ms
  // warmup window is too short for a 1s-period pulse to register, and
  // driving TextInput re-renders at 50ms during warmup (while spaces
  // are simultaneously arriving every 30-80ms) causes visible stutter.
  const canShowCursor = isTerminalFocused && !accessibilityEnabled
  let invert: (text: string) => string
  if (!canShowCursor) {
    invert = (text: string) => text
  } else if (isVoiceRecording && !reducedMotion) {
    // Single-bar waveform from the latest audio level
    const smoothed = smoothedRef.current
    const raw =
      audioLevels.length > 0 ? (audioLevels[audioLevels.length - 1] ?? 0) : 0
    const target = Math.min(raw * LEVEL_BOOST, 1)
    smoothed[0] = (smoothed[0] ?? 0) * SMOOTH + target * (1 - SMOOTH)
    const displayLevel = smoothed[0] ?? 0
    const barIndex = Math.max(
      1,
      Math.min(Math.round(displayLevel * (BARS.length - 1)), BARS.length - 1),
    )
    const isSilent = raw < SILENCE_THRESHOLD
    const hue = ((animTime / 1000) * 90) % 360
    const { r, g, b } = isSilent ? { r: 128, g: 128, b: 128 } : hueToRgb(hue)
    invert = () => chalk.rgb(r, g, b)(BARS[barIndex]!)
  } else {
    invert = chalk.inverse
  }
""", """  // Cursor invert: standard chalk.inverse. The voice waveform branch that used
  // to sit here went with the VOICE_MODE cluster.
  const canShowCursor = isTerminalFocused && !accessibilityEnabled
  const invert: (text: string) => string = canShowCursor
    ? chalk.inverse
    : (text: string) => text
""")
cut(T, """        invert={invert}
        hidePlaceholderText={isVoiceRecording}
""", """        invert={invert}
""")

# ================= PromptInputFooterLeftSide.tsx =================
F = 'components/PromptInput/PromptInputFooterLeftSide.tsx'
cut(F, "import { VoiceWarmupHint } from './VoiceIndicator.js'\n")
cut(F, "import { useVoiceEnabled } from '../../hooks/useVoiceEnabled.js'\n")
cut(F, "import { useVoiceState } from '../../context/voice.js'\n")
cut(F, "const MAX_VOICE_HINT_SHOWS = 3\n")
cut(F, """  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const voiceEnabled = feature('VOICE_MODE') ? useVoiceEnabled() : false
  const voiceState = feature('VOICE_MODE')
    ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
      useVoiceState(s => s.voiceState)
    : ('idle' as const)
  const voiceWarmingUp = feature('VOICE_MODE')
    ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
      useVoiceState(s => s.voiceWarmingUp)
    : false
""")
cut(F, """  const voiceKeyShortcut = feature('VOICE_MODE')
    ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
      useShortcutDisplay('voice:pushToTalk', 'Chat', 'Space')
    : ''
  // Captured at mount so the hint doesn't flicker mid-session if another
  // CC instance increments the counter. Incremented once via useEffect the
  // first time voice is enabled in this session — approximates "hint was
  // shown" without tracking the exact render-time condition (which depends
  // on parts/hintParts computed after the early-return hooks boundary).
  const [voiceHintUnderCap] = feature('VOICE_MODE')
    ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
      useState(
        () =>
          (getGlobalConfig().voiceFooterHintSeenCount ?? 0) <
          MAX_VOICE_HINT_SHOWS,
      )
    : [false]
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const voiceHintIncrementedRef = feature('VOICE_MODE') ? useRef(false) : null
  useEffect(() => {
    if (feature('VOICE_MODE')) {
      if (!voiceEnabled || !voiceHintUnderCap) return
      if (voiceHintIncrementedRef?.current) return
      if (voiceHintIncrementedRef) voiceHintIncrementedRef.current = true
      const newCount = (getGlobalConfig().voiceFooterHintSeenCount ?? 0) + 1
      saveGlobalConfig(prev => {
        if ((prev.voiceFooterHintSeenCount ?? 0) >= newCount) return prev
        return { ...prev, voiceFooterHintSeenCount: newCount }
      })
    }
  }, [voiceEnabled, voiceHintUnderCap])
""")
cut(F, """  // Warmup hint takes priority — when the user is actively holding
  // the activation key, show feedback regardless of other hints.
  if (feature('VOICE_MODE') && voiceEnabled && voiceWarmingUp) {
    parts.push(<VoiceWarmupHint key="voice-warmup" />)
  } else if (isFullscreenEnvEnabled() && selectionHintHasContent) {
""", """  if (isFullscreenEnvEnabled() && selectionHintHasContent) {
""")
cut(F, """  } else if (
    feature('VOICE_MODE') &&
    parts.length > 0 &&
    showHint &&
    voiceEnabled &&
    voiceState === 'idle' &&
    hintParts.length === 0 &&
    voiceHintUnderCap
  ) {
    parts.push(
      <Text dimColor key="voice-hint">
        hold {voiceKeyShortcut} to speak
      </Text>,
    )
  }
""", """  }
""")

print('d5d ok')
