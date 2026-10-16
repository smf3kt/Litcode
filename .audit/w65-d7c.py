# -*- coding: utf-8 -*-
"""Wave D step 7b cascade: the three flag-cache fields no longer have a reader.

`cachedStatsigGates` and `cachedGrowthBookFeatures` lost their last readers in
7b (the gate tails and the disk fallback). `cachedDynamicConfigs` was already
reader-less before this cut — nothing in the tree has written or read it since
the Statsig client left — and it is removed with its two siblings rather than
left as the odd one out, with that noted in the research record.
"""
B = '/Users/mant1ssa/Projects/cc-base-2188/'


def cut(p, old, new=''):
    t = open(B + p, encoding='utf-8').read()
    n = t.count(old)
    assert n == 1, (p, old[:70], n)
    open(B + p, 'w', encoding='utf-8').write(t.replace(old, new))


C = 'utils/config.ts'
cut(C, """  // Cached statsig gate values
  cachedStatsigGates: {
    [gateName: string]: boolean
  }

  // Cached statsig dynamic configs
  cachedDynamicConfigs?: { [configName: string]: unknown }

  // Cached GrowthBook feature values
  cachedGrowthBookFeatures?: { [featureName: string]: unknown }

  // Local GrowthBook overrides (ant-only, set via /config Gates tab).
  // Checked after env-var overrides but before the real resolved value.
  growthBookOverrides?: { [featureName: string]: unknown }
""", """  // Local GrowthBook overrides. Checked in services/analytics/growthbook.ts
  // after env-var overrides and before the caller's default. The /config Gates
  // panel that used to set these left in an earlier wave; the two setters in
  // that module are what remains, and an edit to this file works too.
  growthBookOverrides?: { [featureName: string]: unknown }
""")
cut(C, """    cachedStatsigGates: {},
    cachedDynamicConfigs: {},
    cachedGrowthBookFeatures: {},
""")

print('d7c ok')
