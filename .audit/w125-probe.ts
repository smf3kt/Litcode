import { parseWorkflowScript, runWorkflowScript } from '../src/workflow-script.js';

const source = `export const meta = {
  name: 'probe',
  description: 'probe workflow',
  phases: [{ title: 'Scan', detail: 'first' }, { title: 'Fix' }],
}

log('start')
phase('Scan')
const first = await agent('first', { label: 'one', model: 'test' })
const second = await agent('second')
const paired = await parallel([
  () => agent('p1'),
  async () => { throw new Error('boom') },
])
const piped = await pipeline([1, 2, 3], (item, original, index) => item + original + index, (value) => value * 2)
const failed = await pipeline([1], async () => { throw new Error('stage fail') })
return { first, second, paired, piped, failed, argValue: args.value, stamp: new Date(2020, 0, 2).getFullYear() }
`;

const parsed = parseWorkflowScript(source);
if ('error' in parsed) throw new Error(parsed.error);
const result = await runWorkflowScript(parsed, {
  args: { value: 7 },
  signal: new AbortController().signal,
  agent: async (prompt, options) => `${prompt}:${options.label ?? '-'}:${options.phase ?? '-'}`,
});
console.log(JSON.stringify(result, null, 1));

const sandbox = async (body: string) => {
  const candidate = parseWorkflowScript(`export const meta = { name: 'x', description: 'y' }\n${body}`);
  if ('error' in candidate) throw new Error(candidate.error);
  return runWorkflowScript(candidate, { signal: new AbortController().signal,
    agent: async () => 'ok' });
};
for (const [name, body] of [
  ['date', 'return Date.now()'],
  ['random', 'return Math.random()'],
  ['process', 'return typeof process'],
  ['function-ctor', 'return Function("return 1")()'],
  ['reserved', 'const __wRg$x = 1; return __wRg$x'],
  ['with', 'with ({}) { return 1 }'],
  ['import', 'return import("x")'],
] as const) {
  const out = await sandbox(body);
  console.log(name, JSON.stringify(out.error ?? out.result));
}
