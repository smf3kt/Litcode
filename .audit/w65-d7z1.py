# -*- coding: utf-8 -*-
"""Dependency-pruning pass: drop the zero-importer packages and the dead
theme helper that is the last mention of one of them."""
import json
import os

ROOT = '/Users/mant1ssa/Projects/cc-base-2188'
DROP = ['@growthbook/growthbook', '@opentelemetry/core', 'asciichart', 'qrcode']


def rd(rel):
    return open(os.path.join(ROOT, rel), encoding='utf-8').read()


def wr(rel, text):
    open(os.path.join(ROOT, rel), 'w', encoding='utf-8').write(text)


# ------------------------------------------------------------ package.json
pkg = json.loads(rd('package.json'))
for name in DROP:
    assert name in pkg['dependencies'], name
    del pkg['dependencies'][name]
wr('package.json', json.dumps(pkg, indent=2) + '\n')

# ------------------------------------------------------- package-lock.json
lock = json.loads(rd('package-lock.json'))
packages = lock['packages']
root = packages['']
for name in DROP:
    assert name in root['dependencies'], name
    del root['dependencies'][name]

# Node resolution over the lock graph: from a requester directory, look for
# `<dir>/node_modules/<name>`, then strip one `node_modules/<pkg>` segment and
# retry, ending at the root level.
def resolve(requester, name):
    base = requester
    while True:
        cand = (base + '/' if base else '') + 'node_modules/' + name
        if cand in packages:
            return cand
        marker = base.rfind('/node_modules/')
        if marker == -1:
            base = ''
            cand = 'node_modules/' + name
            if cand in packages:
                return cand
            return None
        base = base[:marker]


reachable = set()
queue = []
for section in ('dependencies', 'devDependencies', 'optionalDependencies'):
    for name in root.get(section, {}):
        hit = resolve('', name)
        if hit:
            queue.append(hit)
while queue:
    key = queue.pop()
    if key in reachable:
        continue
    reachable.add(key)
    entry = packages[key]
    for section in ('dependencies', 'optionalDependencies'):
        for name in entry.get(section, {}):
            hit = resolve(key, name)
            if hit:
                queue.append(hit)

unreachable = [k for k in packages if k != '' and k not in reachable]
for key in unreachable:
    del packages[key]
lock['packages'] = packages
wr('package-lock.json', json.dumps(lock, indent=2) + '\n')

# ------------------------------------------------------------- utils/theme.ts
T = 'utils/theme.ts'
text = rd(T)
old_import = "import chalk, { Chalk } from 'chalk'\n"
assert text.count(old_import) == 1
text = text.replace(old_import, "import chalk from 'chalk'\n")
start = text.index('// Create a chalk instance with 256-color level for Apple Terminal')
end = text.index('\n}', text.index('export function themeColorToAnsi')) + len('\n}\n')
# Keep the blank line separation the surrounding module uses.
while text[end:end + 1] == '\n':
    end += 1
text = (text[:start] + text[end:]).rstrip('\n') + '\n'
wr(T, text)

print('cut ok; dropped', len(DROP), 'direct deps and', len(unreachable), 'unreachable lock entries')
