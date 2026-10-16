import os
import shutil

B = '/Users/mant1ssa/Projects/cc-base-2188/'
Q = '/Users/mant1ssa/Projects/cc_reverse/.audit/w65-d3-baks/'

# 先隔离 bak（这些路径下唯一的 bak 是 ManagedSettingsSecurityDialog 的 w54）
for rel in [
    'components/ManagedSettingsSecurityDialog/ManagedSettingsSecurityDialog.tsx.w54bak',
]:
    src = B + rel
    if os.path.exists(src):
        dst = Q + rel
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        assert open(src, 'rb').read() == open(dst, 'rb').read(), rel
        print('quarantined', rel)

# 零引用文件：没有任何 import / 动态 import / require 指向它们
for rel in [
    'components/Stats.tsx',
    'constants/github-app.ts',
    'components/ManagedSettingsSecurityDialog/ManagedSettingsSecurityDialog.tsx',
    'components/ManagedSettingsSecurityDialog/ManagedSettingsSecurityDialog.tsx.w54bak',
    # utils.ts is imported only by the dialog above.
    'components/ManagedSettingsSecurityDialog/utils.ts',
    'services/mcp/InProcessTransport.ts',
    'components/tasks/WorkflowDetailDialog.ts',
    'services/skillSearch/prefetch.ts',
]:
    p = B + rel
    if os.path.exists(p):
        os.remove(p)
os.rmdir(B + 'components/ManagedSettingsSecurityDialog')
print('d3b ok')
