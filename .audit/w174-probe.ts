import { scrubSubagentOutput } from '../src/subagent-output-scrub.js';

for (const text of [
  '[design system not attached]',
  '[design systems not listed]',
  '[artifact 12345678-1234-1234-1234-123456789abc]',
  '[this version has some published files]',
  'plain [bracket] lead',
]) {
  console.log(JSON.stringify(text), '->', JSON.stringify(scrubSubagentOutput({ text }).value.text),
    JSON.stringify(scrubSubagentOutput({ text }).findings.map(f => f.pattern)));
}
