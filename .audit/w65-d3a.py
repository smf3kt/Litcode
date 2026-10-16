import os

B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:90], n)
    wr(p, t.replace(old, new))


def cut_range(p, start, end, new=''):
    t = rd(p)
    i = t.index(start)
    j = t.index(end, i) + len(end)
    wr(p, t[:i] + new + t[j:])


# ================= utils/telemetry/bigqueryExporter.ts =================
os.remove(B + 'utils/telemetry/bigqueryExporter.ts')

# ================= utils/telemetry/instrumentation.ts =================
I = 'utils/telemetry/instrumentation.ts'
cut(I, "import { BigQueryMetricsExporter } from './bigqueryExporter.js'\n")
cut(I, """import {
  getOtelHeadersFromHelper,
  getSubscriptionType,
  is1PApiCustomer,
  isClaudeAISubscriber,
} from 'src/utils/auth.js'
""", """import { getOtelHeadersFromHelper } from 'src/utils/auth.js'
""")
cut_range(
    I,
    "function getBigQueryExportingReader() {\n",
    "  return is1PApiCustomer() || isC4EOrTeamUser\n}\n\n",
    "",
)
cut(I, """  // Add BigQuery exporter (for API customers, C4E users, and internal users)
  if (isBigQueryMetricsEnabled()) {
    readers.push(getBigQueryExportingReader())
  }

""")

t = rd(I)
for bad in ['BigQueryMetricsExporter', 'isBigQueryMetricsEnabled', 'is1PApiCustomer',
            'isClaudeAISubscriber', 'getSubscriptionType', 'bigqueryExporter']:
    assert bad not in t, (bad, 'instrumentation.ts 残留')
wr(I, t)
print('d3a ok')
