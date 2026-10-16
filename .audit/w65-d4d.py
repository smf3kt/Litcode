import os

B = '/Users/mant1ssa/Projects/cc-base-2188/'

# Import-graph scan after the cut, not before it. Both of these were held up
# only by the deleted feedback-survey surface:
#   components/Feedback.tsx   — the /feedback screen, whose command went in
#                               package 1; it POSTs the transcript to
#                               api.anthropic.com/api/claude_cli_feedback.
#   hooks/useDynamicConfig.ts — a GrowthBook-backed hook nothing else calls.
for rel in [
    'components/Feedback.tsx',
    'hooks/useDynamicConfig.ts',
]:
    assert not [f for f in os.listdir(os.path.dirname(B + rel))
                if f.startswith(os.path.basename(rel) + '.w')], rel
    os.remove(B + rel)
print('d4d ok')
