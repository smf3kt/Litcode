import os

B = '/Users/mant1ssa/Projects/cc-base-2188/'

# The Stats.tsx cascade, one level deeper than d3b reached:
#   Stats.tsx -> utils/screenshotClipboard.ts -> utils/ansiToPng.ts -> utils/ansiToSvg.ts
# d3b removed the first two and re-ran the scan, which named ansiToPng; reading
# ansiToPng then showed ansiToSvg as its only importer. No file in this chain
# has a *.w*bak sibling (checked with a sibling glob before removing).
for rel in [
    'utils/ansiToPng.ts',
    'utils/ansiToSvg.ts',
]:
    assert not [f for f in os.listdir(os.path.dirname(B + rel))
                if f.startswith(os.path.basename(rel) + '.w')], rel
    os.remove(B + rel)
print('d3c ok')
