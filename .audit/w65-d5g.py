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


# 1. ConfigTool.ts no longer names a feature flag at all
cut('tools/ConfigTool/ConfigTool.ts', "import { feature } from 'bun:bundle'\n")

# 2. the keybinding action, which had no handler left to run
cut('keybindings/schema.ts', """  // Voice actions
  'voice:pushToTalk',
""")
cut('keybindings/validate.ts', """    } else if (action === 'voice:pushToTalk') {
      // Hold detection needs OS auto-repeat. Bare letters print into the
      // input during warmup and the activation strip is best-effort —
      // space (default) or a modifier combo like meta+k avoid that.
      const ks = parseChord(key)[0]
      if (
        ks &&
        !ks.ctrl &&
        !ks.alt &&
        !ks.shift &&
        !ks.meta &&
        !ks.super &&
        /^[a-z]$/.test(ks.key)
      ) {
        warnings.push({
          type: 'invalid_action',
          severity: 'warning',
          message: `Binding "${key}" to voice:pushToTalk prints into the input during warmup; use space or a modifier combo like meta+k`,
          key,
          context: contextName,
          action,
        })
      }
    }
""", """    }
""")

# 3. the four config counters, whose only readers and writers were the voice
#    footer hint and the voice notice
cut('utils/config.ts', """
  // Voice mode notice tracking
  voiceNoticeSeenCount?: number // Number of times the voice-mode-available notice has been shown
  voiceLangHintShownCount?: number // Number of times the /voice dictation-language hint has been shown
  voiceLangHintLastLanguage?: string // Resolved STT language code when the hint was last shown — reset count when it changes
  voiceFooterHintSeenCount?: number // Number of sessions the "hold X to speak" footer hint has been shown
""")

# 4. hidePlaceholderText existed so the voice recording state could blank the
#    placeholder; TextInput was its only supplier and no longer passes it.
cut('hooks/renderPlaceholder.ts', """  invert?: (text: string) => string
  hidePlaceholderText?: boolean
""", """  invert?: (text: string) => string
""")
cut('hooks/renderPlaceholder.ts', """  invert = chalk.inverse,
  hidePlaceholderText = false,
""", """  invert = chalk.inverse,
""")
cut('hooks/renderPlaceholder.ts', """  if (placeholder) {
    if (hidePlaceholderText) {
      // Voice recording: show only the cursor, no placeholder text
      renderedPlaceholder =
        showCursor && focus && terminalFocus ? invert(' ') : ''
    } else {
      renderedPlaceholder = chalk.dim(placeholder)

      // Show inverse cursor only when both input and terminal are focused
      if (showCursor && focus && terminalFocus) {
        renderedPlaceholder =
          placeholder.length > 0
            ? invert(placeholder[0]!) + chalk.dim(placeholder.slice(1))
            : invert(' ')
      }
    }
  }
""", """  if (placeholder) {
    renderedPlaceholder = chalk.dim(placeholder)

    // Show inverse cursor only when both input and terminal are focused
    if (showCursor && focus && terminalFocus) {
      renderedPlaceholder =
        placeholder.length > 0
          ? invert(placeholder[0]!) + chalk.dim(placeholder.slice(1))
          : invert(' ')
    }
  }
""")
cut('components/BaseTextInput.tsx', "  hidePlaceholderText?: boolean\n")
cut('components/BaseTextInput.tsx', "  hidePlaceholderText,\n")
cut('components/BaseTextInput.tsx', "    hidePlaceholderText,\n")

# 5. the language setting's description still advertised a dictation use the
#    setting no longer has
cut('tools/ConfigTool/supportedSettings.ts',
    "'Preferred language for Claude responses and voice dictation (e.g., \"japanese\", \"spanish\")',",
    "'Preferred language for Claude responses (e.g., \"japanese\", \"spanish\")',")
cut('utils/settings/types.ts',
    "'Preferred language for Claude responses and voice dictation (e.g., \"japanese\", \"spanish\")',",
    "'Preferred language for Claude responses (e.g., \"japanese\", \"spanish\")',")

print('d5g ok')
