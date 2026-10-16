B = '/Users/mant1ssa/Projects/cc-base-2188/'
P = 'screens/REPL.tsx'


def rd():
    return open(B + P, encoding='utf-8').read()


def wr(t):
    open(B + P, 'w', encoding='utf-8').write(t)


t = rd()
old = """    workerSandboxPermissions.queue.length > 0

  // Initialize IDE integration
"""
assert t.count(old) == 1, t.count(old)
new = """    workerSandboxPermissions.queue.length > 0

  const skillImprovementSurvey = useSkillImprovementSurvey(setMessages)

  const showIssueFlagBanner = useIssueFlagBanner(messages, submitCount)

  // Initialize IDE integration
"""
wr(t.replace(old, new))
print('d4c ok')
