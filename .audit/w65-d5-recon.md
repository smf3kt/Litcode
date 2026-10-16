# wave D step 5 recon — the voice cluster (VOICE_MODE, a dead feature flag)

## delete set (10 modules, ~3,300 lines)
      54 voice/voiceModeEnabled.ts
     544 services/voiceStreamSTT.ts
     525 services/voice.ts
     106 services/voiceKeyterms.ts
    1144 hooks/useVoice.ts
      25 hooks/useVoiceEnabled.ts
     723 hooks/useVoiceIntegration.tsx
      76 context/voice.tsx
      63 components/PromptInput/VoiceIndicator.tsx
      51 components/LogoV2/VoiceModeNotice.tsx
    3311 total

## baks to quarantine first (4)
hooks/useVoiceIntegration.tsx.w54bak
context/voice.tsx.w54bak
components/PromptInput/VoiceIndicator.tsx.w54bak
components/LogoV2/VoiceModeNotice.tsx.w54bak

## hosts (every voice arm is `feature(VOICE_MODE) ? X : fallback` — keep the fallback)
state/AppState.tsx:20-25 VoiceProvider conditional require
keybindings/defaultBindings.ts:96 space:voice:pushToTalk spread
tools/ConfigTool/supportedSettings.ts:144-152 voiceEnabled registration
utils/settings/types.ts:864-871 voiceEnabled zod field
tools/ConfigTool/prompt.ts:3,24-31 isVoiceGrowthBookEnabled import + skip block
components/LogoV2/LogoV2.tsx:49,154,254,372 import + three render sites
screens/REPL.tsx:187-198 two typeof-import consts, 4803-4807 voice const, 5250-5254 JSX
components/PromptInput/Notifications.tsx:10,15,41-45,240-264
components/PromptInput/PromptInputFooterLeftSide.tsx:47-49,243-300,+render sites,MAX_VOICE_HINT_SHOWS,voiceFooterHintSeenCount
components/TextInput.tsx:4,56-77
tools/ConfigTool/ConfigTool.ts:113-120,231-260,346-347

## footer voice usages still to read before cutting
47:import { VoiceWarmupHint } from './VoiceIndicator.js'
66:const MAX_VOICE_HINT_SHOWS = 3
243:  const voiceEnabled = feature('VOICE_MODE') ? useVoiceEnabled() : false
244:  const voiceState = feature('VOICE_MODE')
246:      useVoiceState(s => s.voiceState)
248:  const voiceWarmingUp = feature('VOICE_MODE')
250:      useVoiceState(s => s.voiceWarmingUp)
285:  const voiceKeyShortcut = feature('VOICE_MODE')
294:  const [voiceHintUnderCap] = feature('VOICE_MODE')
298:          (getGlobalConfig().voiceFooterHintSeenCount ?? 0) <
299:          MAX_VOICE_HINT_SHOWS,
303:  const voiceHintIncrementedRef = feature('VOICE_MODE') ? useRef(false) : null
306:      if (!voiceEnabled || !voiceHintUnderCap) return
307:      if (voiceHintIncrementedRef?.current) return
308:      if (voiceHintIncrementedRef) voiceHintIncrementedRef.current = true
309:      const newCount = (getGlobalConfig().voiceFooterHintSeenCount ?? 0) + 1
311:        if ((prev.voiceFooterHintSeenCount ?? 0) >= newCount) return prev
312:        return { ...prev, voiceFooterHintSeenCount: newCount }
315:  }, [voiceEnabled, voiceHintUnderCap])
527:  if (feature('VOICE_MODE') && voiceEnabled && voiceWarmingUp) {
528:    parts.push(<VoiceWarmupHint key="voice-warmup" />)
564:    voiceEnabled &&
565:    voiceState === 'idle' &&
567:    voiceHintUnderCap
571:        hold {voiceKeyShortcut} to speak

## TextInput voice usages
4:import { useVoiceState } from '../context/voice.js'
56:  const voiceState = feature('VOICE_MODE')
58:      useVoiceState(s => s.voiceState)
60:  const isVoiceRecording = voiceState === 'recording'
64:      useVoiceState(s => s.voiceAudioLevels)
68:  const needsAnimation = isVoiceRecording && !reducedMotion
77:  // Cursor invert function: mini waveform during voice recording,
86:  } else if (isVoiceRecording && !reducedMotion) {
143:        hidePlaceholderText={isVoiceRecording}

## ConfigTool voice usages
113:    // Voice settings are registered at build-time (feature('VOICE_MODE')), but
115:    // voiceEnabled as an unknown setting so no voice-specific strings leak.
116:    if (feature('VOICE_MODE') && setting === 'voiceEnabled') {
117:      const { isVoiceGrowthBookEnabled } = await import(
118:        '../../voice/voiceModeEnabled.js'
120:      if (!isVoiceGrowthBookEnabled()) {
231:    // Pre-flight checks for voice mode
233:      feature('VOICE_MODE') &&
234:      setting === 'voiceEnabled' &&
237:      const { isVoiceModeEnabled } = await import(
238:        '../../voice/voiceModeEnabled.js'
240:      if (!isVoiceModeEnabled()) {
246:              ? 'Voice mode requires a Claude.ai account. Please run /login to sign in.'
247:              : 'Voice mode is not available.',
251:      const { isVoiceStreamAvailable } = await import(
252:        '../../services/voiceStreamSTT.js'
256:        checkVoiceDependencies,
258:      } = await import('../../services/voice.js')
267:              'Voice mode is not available in this environment.',
271:      if (!isVoiceStreamAvailable()) {
276:              'Voice mode requires a Claude.ai account. Please run /login to sign in.',
280:      const deps = await checkVoiceDependencies()
345:      // 5a. Voice needs notifyChange so applySettingsChange resyncs
346:      // AppState.settings (useVoiceEnabled reads settings.voiceEnabled)
347:      // and the settings cache resets for the next /voice read.
348:      if (feature('VOICE_MODE') && setting === 'voiceEnabled') {

## REPL voice usages
187:const useVoiceIntegration: typeof import('../hooks/useVoiceIntegration.js').useVoiceIntegration =
188:  feature('VOICE_MODE')
189:    ? require('../hooks/useVoiceIntegration.js').useVoiceIntegration
195:const VoiceKeybindingHandler: typeof import('../hooks/useVoiceIntegration.js').VoiceKeybindingHandler =
196:  feature('VOICE_MODE')
197:    ? require('../hooks/useVoiceIntegration.js').VoiceKeybindingHandler
4803:  // Voice input integration (VOICE_MODE builds only)
4804:  const voice = feature('VOICE_MODE')
4806:      useVoiceIntegration({ setInputValueRaw, inputValueRef, insertTextRef })
5250:        {feature('VOICE_MODE') ? (
5251:          <VoiceKeybindingHandler
5252:            voiceHandleKeyEvent={voice.handleKeyEvent}
5253:            stripTrailing={voice.stripTrailing}
5254:            resetAnchor={voice.resetAnchor}
5480:      {feature('VOICE_MODE') ? (
5481:        <VoiceKeybindingHandler
5482:          voiceHandleKeyEvent={voice.handleKeyEvent}
5483:          stripTrailing={voice.stripTrailing}
5484:          resetAnchor={voice.resetAnchor}
6051:                          feature('VOICE_MODE') ? insertTextRef : undefined
6053:                        voiceInterimRange={voice.interimRange}
