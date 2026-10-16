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


K = 'tools/TaskOutputTool/TaskOutputTool.tsx'
cut_range(K, "  // For remote agent tasks\n", "      </Box>\n    )\n  }\n\n")

U = 'tools/AgentTool/UI.tsx'
cut(U, """import type {
  outputSchema,
  Progress,
  RemoteLaunchedOutput,
} from './AgentTool.js'
""", """import type { outputSchema, Progress } from './AgentTool.js'
""")
cut(U, """  // Remote-launched agents (ant-only) use a private output type not in the
  // public schema. Narrow via the internal discriminant.
  const internal = data as Output | RemoteLaunchedOutput
  if (internal.status === 'remote_launched') {
    return (
      <Box flexDirection="column">
        <MessageResponse height={1}>
          <Text>
            Remote agent launched{' '}
            <Text dimColor>
              · {internal.taskId} · {internal.sessionUrl}
            </Text>
          </Text>
        </MessageResponse>
      </Box>
    )
  }
""")
cut(U, "        outputStatus === 'async_launched' || outputStatus === 'remote_launched'\n",
       "        outputStatus === 'async_launched'\n")

print('e4a5 ok')
