import os
import shutil

B = '/Users/mant1ssa/Projects/cc-base-2188/'
Q = '/Users/mant1ssa/Projects/cc_reverse/.audit/w65-d4-baks/'

# d4d's own assert stopped the first attempt: components/Feedback.tsx does have
# a sibling bak, so the quarantine runs before the delete.
src = B + 'components/Feedback.tsx.w54bak'
dst = Q + 'components/Feedback.tsx.w54bak'
shutil.copy2(src, dst)
assert open(src, 'rb').read() == open(dst, 'rb').read()
os.remove(src)
print('quarantined components/Feedback.tsx.w54bak')

for rel in [
    'components/Feedback.tsx',
    'hooks/useDynamicConfig.ts',
]:
    assert not [f for f in os.listdir(os.path.dirname(B + rel))
                if f.startswith(os.path.basename(rel) + '.w')], rel
    os.remove(B + rel)
print('d4e ok')
