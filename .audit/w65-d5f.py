B = '/Users/mant1ssa/Projects/cc-base-2188/'
P = 'tools/ConfigTool/ConfigTool.ts'

lines = open(B + P, encoding='utf-8').read().split('\n')


def find(pred, start=0):
    for i in range(start, len(lines)):
        if pred(lines[i]):
            return i
    raise AssertionError('anchor not found')


def drop(start_marker, end_marker):
    """Delete lines [start_marker, end_marker)."""
    i = find(lambda l: l == start_marker)
    j = find(lambda l: l == end_marker, i + 1)
    del lines[i:j]
    return j - i


# 1. the kill-switch pre-check: it hid the key whenever GrowthBook said off.
n = drop(
    "    // Voice settings are registered at build-time (feature('VOICE_MODE')), but",
    "    if (!isSupported(setting)) {",
)
assert n == 13, n

# 2. the whole pre-flight block: auth check, stream availability, recording
#    availability, dependency check, microphone permission prompt.
n = drop(
    "    // Pre-flight checks for voice mode",
    "    const previousValue = getValue(config.source, path)",
)
assert n > 50, n

# 3. the settings-change notification the voice path needed so that
#    applySettingsChange would resync AppState.settings for useVoiceEnabled.
n = drop(
    "      // 5a. Voice needs notifyChange so applySettingsChange resyncs",
    "      // 5b. Sync to AppState if needed for immediate UI effect",
)
assert n in (10, 11), n

open(B + P, 'w', encoding='utf-8').write('\n'.join(lines))
print('d5f ok')
