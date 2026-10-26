import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { defaultConfig, Agent, assertPaired } from '../src/agent.js';
import { createInteractionTools } from '../src/interaction-tools.js';
import { sourceFindingsResult, type SourceFindingsRequest } from '../src/source-findings.js';
import { createRuntime, parseSettings, pinToolSchemas } from '../src/runtime.js';
import { reloadConfig } from '../src/reload.js';
import { Session, managedPolicySchema } from '../src/session.js';
import { agentTranscriptEntries } from '../src/agent-transcript.js';
import { TuiDocumentRenderer } from '../src/tui-document-renderer.js';
import { FindingsRows } from '../src/tui-findings.js';
import { jsx } from '../src/tui-jsx.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolContext } from '../src/tools.js';

const request: SourceFindingsRequest = { level: 'high', findings: [
  { file: 'one.ts', line: 8, summary: 'Keep the result', failure_scenario: 'Cancel after completion loses the result.', category: 'correctness', verdict: 'CONFIRMED' },
  { file: 'two.ts', summary: 'Restore the state', failure_scenario: 'Restart drops state.', outcome: 'fixed' },
  { file: 'one.ts', line: 101, summary: 'Retain the mode', failure_scenario: 'Reload drops the original mode.', verdict: 'PLAUSIBLE', outcome: 'skipped' },
] };
const context = (workspace = '/unused'): ToolContext => ({ workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 });
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'source-findings-test-')));
const tool = (sourceFindings?: boolean) => {
  const result = createInteractionTools({ sourceFindings }).find(tool => tool.schema.name === 'report_findings'); assert.ok(result); return result;
};

test('source findings retain complete host data and compact output while legacy and boundary failures keep their contracts', async () => {
  const report = tool(true), host: unknown[] = [];
  assert.equal(await report.execute(request, { ...context(), hostResult: result => host.push(result) }), '3 findings reported.');
  assert.deepEqual([...host], [sourceFindingsResult(request)]);
  assert.equal(await report.execute({ findings: [] }, context()), 'No findings reported.');
  assert.equal(await report.execute({ findings: [{ file: '', summary: '', failure_scenario: '', line: -2 }] }, context()), '1 finding reported.');
  assert.deepEqual(report.schema.input_schema.required, ['findings']);
  const properties = report.schema.input_schema.properties;
  assert.ok(properties !== null && typeof properties === 'object');
  assert.equal('level' in properties, true);
  if ('level' in properties) assert.deepEqual(properties.level, { type: 'string', enum: ['low', 'medium', 'high', 'xhigh', 'max'] });
  for (const input of [
    { findings: [{ file: 'x', summary: 's' }] },
    { findings: [{ file: 'x', summary: 's', failure_scenario: 'f', verdict: 'UNKNOWN' }] },
    { findings: [{ file: 'x', summary: 's', failure_scenario: 'f', short_summary: 'x'.repeat(61) }] },
    { findings: [{ file: 'x', summary: 's', failure_scenario: 'f', category: 'x'.repeat(41) }] },
    { findings: Array.from({ length: 33 }, () => ({ file: 'x', summary: 's', failure_scenario: 'f' })) },
    { findings: [], level: 'ultra' },
  ]) await assert.rejects(report.execute(input, context()));
  const legacy = { findings: [{ file: 'x', line: 1, summary: 'old', severity: 'info' }] };
  for (const version of [undefined, false]) {
    assert.deepEqual(JSON.parse(await tool(version).execute(legacy, context())), legacy);
    await assert.rejects(tool(version).execute(request, context()));
  }
  let called = 0;
  const observed = createInteractionTools({ sourceFindings: true, sourceReport: () => { called++; } }).find(tool => tool.schema.name === 'report_findings'); assert.ok(observed);
  await assert.rejects(observed.execute(request, { ...context(), maxOutputBytes: 1, hostResult: result => host.push(result) }), /output byte limit/);
  assert.equal(called, 0); assert.equal(host.length, 1);
  const controller = new AbortController();
  const cancelled = createInteractionTools({ sourceFindings: true, sourceReport: async (_request, signal) => {
    await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
  } }).find(tool => tool.schema.name === 'report_findings'); assert.ok(cancelled);
  const pending = cancelled.execute(request, { ...context(), signal: controller.signal, hostResult: result => host.push(result) });
  const rejection = assert.rejects(pending, { name: 'AbortError' });
  await new Promise<void>(resolve => setImmediate(resolve)); controller.abort(); await rejection;
  assert.equal(host.length, 1);
});

test('source native findings group files, preserve width transitions and show failure scenarios only in verbose views', () => {
  const renderer = new TuiDocumentRenderer();
  try {
    const render = (columns: number, verbose = false) => renderer.renderElement(jsx(FindingsRows, { findings: request.findings, verbose }, undefined), columns, { theme: 'light-ansi' });
    const wide = render(120), text = wide.map(row => row.text).join('\n');
    assert.equal(text.split('one.ts').length - 1, 1); assert.ok(text.indexOf('Retain the mode') < text.indexOf('two.ts'));
    assert.match(text, /✓ +Restore the state/); assert.match(text, /\[skipped\]/);
    assert.equal(text.includes(request.findings[0]!.failure_scenario), false);
    const verbose = render(120, true).map(row => row.text).join('\n');
    for (const finding of request.findings) assert.ok(verbose.includes(finding.failure_scenario));
    const narrow = render(36).map(row => row.text).join('\n').replace(/\s+/g, ' ');
    assert.ok(narrow.includes('Keep the result')); assert.ok(narrow.includes('[correctness]'));
    assert.deepEqual(render(120), wide);
    assert.deepEqual(renderer.renderElement(jsx(FindingsRows, { findings: [], verbose: true }, undefined), 80), []);
  } finally { renderer.close(); }
  assert.equal(renderer.liveNodes, 0);
});

test('source findings pin Runtime schemas across original resume and persist typed Agent results for child transcript replay', async () => {
  const workspace = temporary(), userDir = path.join(workspace, 'user'); fs.mkdirSync(userDir);
  const settingsFile = path.join(userDir, 'settings.json'), managedSettingsFile = path.join(workspace, 'managed.json');
  fs.writeFileSync(managedSettingsFile, '{}');
  const inert: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('No model call expected'); } };
  try {
    assert.equal(parseSettings({ features: { sourceFindings: false } }).features?.sourceFindings, false);
    assert.throws(() => parseSettings({ features: { sourceFindings: 'true' } }));
    assert.equal(managedPolicySchema.parse({ features: { sourceFindings: false } }).features?.sourceFindings, false);
    for (const selected of [undefined, false, true]) {
      const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir, managedSettingsFile },
        features: { tasks: false, subagents: false, interaction: true, ...(selected === undefined ? {} : { sourceFindings: selected }) } };
      let runtime = await createRuntime(config, inert, new AbortController().signal);
      config.tools = pinToolSchemas(runtime.tools);
      let session = Session.open(workspace, { config });
      try {
        await runtime.bindSession!(session); const original = fs.readFileSync(session.file), id = session.id;
        await runtime.close(); session.close(); fs.writeFileSync(settingsFile, JSON.stringify({ features: { sourceFindings: true } }));
        session = Session.open(workspace, { id }); runtime = await createRuntime(session.config, inert, new AbortController().signal); await runtime.bindSession!(session);
        const report = runtime.buildTools(session.config, session.id).find(tool => tool.schema.name === 'report_findings'); assert.ok(report);
        if (selected === true) assert.equal(await report.execute(request, context(workspace)), '3 findings reported.');
        else await assert.rejects(report.execute(request, context(workspace)));
        assert.deepEqual(fs.readFileSync(session.file), original);
        assert.equal(reloadConfig(session.config).features?.sourceFindings, true);
        fs.writeFileSync(managedSettingsFile, JSON.stringify({ features: { sourceFindings: false } }));
        assert.equal(reloadConfig(session.config).features?.sourceFindings, false);
        fs.writeFileSync(managedSettingsFile, '{}');
      } finally { await runtime.close(); session.close(); }
    }
    const tools = createInteractionTools({ sourceFindings: true });
    const config = { ...defaultConfig(workspace, tools), model: 'fixture', features: { tasks: false, subagents: false, sourceFindings: true } };
    let session = Session.open(workspace, { config }), turns = 0;
    const model: ModelProvider = { count: async () => 0, complete: async input => {
      turns++;
      const content = turns === 1 ? [{ type: 'tool_use', id: 'review', name: 'report_findings', input: request }]
        : [{ type: 'text', text: 'done' }];
      if (turns === 2) {
        const last = input.messages.at(-1)?.content; assert.ok(Array.isArray(last));
        assert.equal(last[0]?.type, 'tool_result');
        if (last[0]?.type === 'tool_result') assert.equal(last[0].content, '3 findings reported.');
      }
      return { id: 'review', model: 'fixture', type: 'message', role: 'assistant', content,
        stop_reason: turns === 1 ? 'tool_use' : 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Awaited<ReturnType<ModelProvider['complete']>>;
    } };
    try {
      await new Agent(session, model, tools).run('Review this fixture'); assertPaired(session.messages);
      const event = session.events.find(item => item.kind === 'tool_result'); assert.ok(event?.kind === 'tool_result');
      assert.deepEqual(event.host, sourceFindingsResult(request));
      const id = session.id; session.close(); session = Session.open(workspace, { id });
      const records = session.events.filter((event): event is Extract<typeof event, { kind: 'message' | 'tool_start' | 'tool_result' | 'turn_end' | 'compact' }> =>
        ['message', 'tool_start', 'tool_result', 'turn_end', 'compact'].includes(event.kind));
      const entries = agentTranscriptEntries({ id, name: 'fixture', status: 'completed', model: 'fixture', records, inProgressToolUseIDs: [] });
      assert.deepEqual(entries.find(entry => entry.tool?.id === 'review')?.tool?.host, sourceFindingsResult(request));
      assert.equal(turns, 2);
    } finally { session.close(); }
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
