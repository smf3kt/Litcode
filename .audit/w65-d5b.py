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


def cut_all(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n >= 1, (p, old[:80], n)
    wr(p, t.replace(old, new))
    return n


R = 'screens/REPL.tsx'

# 1. the two conditional requires. The eslint-disable above them stays: the
#    consts that follow (ant-only org warning, org callout) still use require().
cut(R, """const useVoiceIntegration: typeof import('../hooks/useVoiceIntegration.js').useVoiceIntegration =
  feature('VOICE_MODE')
    ? require('../hooks/useVoiceIntegration.js').useVoiceIntegration
    : () => ({
        stripTrailing: () => 0,
        handleKeyEvent: () => {},
        resetAnchor: () => {},
      })
const VoiceKeybindingHandler: typeof import('../hooks/useVoiceIntegration.js').VoiceKeybindingHandler =
  feature('VOICE_MODE')
    ? require('../hooks/useVoiceIntegration.js').VoiceKeybindingHandler
    : () => null
""")

# 2. the hook call
cut(R, """  // Voice input integration (VOICE_MODE builds only)
  const voice = feature('VOICE_MODE')
    ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
      useVoiceIntegration({ setInputValueRaw, inputValueRef, insertTextRef })
    : {
        stripTrailing: () => 0,
        handleKeyEvent: () => {},
        resetAnchor: () => {},
        interimRange: null,
      }
""")

# 3. the two keybinding-handler mounts
n = cut_all(R, """        {feature('VOICE_MODE') ? (
          <VoiceKeybindingHandler
            voiceHandleKeyEvent={voice.handleKeyEvent}
            stripTrailing={voice.stripTrailing}
            resetAnchor={voice.resetAnchor}
            isActive={!toolJSX?.isLocalJSXCommand}
          />
        ) : null}
""")
assert n == 1, n
n = cut_all(R, """      {feature('VOICE_MODE') ? (
        <VoiceKeybindingHandler
          voiceHandleKeyEvent={voice.handleKeyEvent}
          stripTrailing={voice.stripTrailing}
          resetAnchor={voice.resetAnchor}
          isActive={!toolJSX?.isLocalJSXCommand}
        />
      ) : null}
""")
assert n == 1, n

# 4. the two PromptInput props only voice ever supplied
cut(R, """                        insertTextRef={
                          feature('VOICE_MODE') ? insertTextRef : undefined
                        }
                        voiceInterimRange={voice.interimRange}
""")
cut(R, """  const insertTextRef = useRef<{
    insert: (text: string) => void
    setInputWithCursor: (value: string, cursor: number) => void
    cursorOffset: number
  } | null>(null)

""")

# 5. PromptInput's side of those two props
P = 'components/PromptInput/PromptInput.tsx'
cut(P, """  insertTextRef?: React.MutableRefObject<{
    insert: (text: string) => void
    setInputWithCursor: (value: string, cursor: number) => void
    cursorOffset: number
  } | null>
  voiceInterimRange?: { start: number; end: number } | null
""")
cut(P, """  insertTextRef,
""")
cut(P, """  voiceInterimRange,
""")
cut(P, """  // Expose an insertText function so callers (e.g. STT) can splice text at the
  // current cursor position instead of replacing the entire input.
  if (insertTextRef) {
    insertTextRef.current = {
      cursorOffset,
      insert: (text: string) => {
        const needsSpace =
          cursorOffset === input.length &&
          input.length > 0 &&
          !/\\s$/.test(input)
        const insertText = needsSpace ? ' ' + text : text
        const newValue =
          input.slice(0, cursorOffset) + insertText + input.slice(cursorOffset)
        lastInternalInputRef.current = newValue
        onInputChange(newValue)
        setCursorOffset(cursorOffset + insertText.length)
      },
      setInputWithCursor: (value: string, cursor: number) => {
        lastInternalInputRef.current = value
        onInputChange(value)
        setCursorOffset(cursor)
      },
    }
  }
""")
cut(P, """    // Dim interim voice dictation text
    if (voiceInterimRange) {
      highlights.push({
        start: voiceInterimRange.start,
        end: voiceInterimRange.end,
        color: undefined,
        dimColor: true,
        priority: 1,
      })
    }

""")
cut(P, """    displayedValue,
    voiceInterimRange,
""", """    displayedValue,
""")

print('d5b ok')
