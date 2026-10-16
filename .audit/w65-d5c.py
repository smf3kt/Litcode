B = '/Users/mant1ssa/Projects/cc-base-2188/'
P = 'components/PromptInput/PromptInput.tsx'


def rd():
    return open(B + P, encoding='utf-8').read()


def wr(t):
    open(B + P, 'w', encoding='utf-8').write(t)


t = rd()

# The destructure (2-space indent) and the useMemo dep entry (4-space) are
# distinguished by a newline-anchored pattern: "\n  x" cannot match inside
# "\n    x".
old = "\n  isLocalJSXCommandActive = false,\n  voiceInterimRange,\n"
assert t.count(old) == 1, t.count(old)
t = t.replace(old, "\n  isLocalJSXCommandActive = false,\n")

old = """  // Expose an insertText function so callers (e.g. STT) can splice text at the
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
"""
assert t.count(old) == 1, t.count(old)
t = t.replace(old, "")

old = """    // Dim interim voice dictation text
    if (voiceInterimRange) {
      highlights.push({
        start: voiceInterimRange.start,
        end: voiceInterimRange.end,
        color: undefined,
        dimColor: true,
        priority: 1,
      })
    }

"""
assert t.count(old) == 1, t.count(old)
t = t.replace(old, "")

old = "\n    displayedValue,\n    voiceInterimRange,\n"
assert t.count(old) == 1, t.count(old)
t = t.replace(old, "\n    displayedValue,\n")

wr(t)
print('d5c ok')
