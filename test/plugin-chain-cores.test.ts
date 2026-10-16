import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ga} from '../src/plugin-chain-entry.js';
import {$be} from '../src/plugin-chain-host.js';
// The registry import registers the twelve sites and then builds their chains; importing it is what
// makes the cores below reachable through `ga`'s `yyt()` lookup.
import '../src/plugin-chain-registry.js';

// The twelve chains whose core is the source's own default answer, driven the way the source's call
// sites drive them: `ga(name, ctx)(event)`. Sources: research/ports/W45-chain-runner.md,
// research/ports/W45-chain-cores-evidence.json.

const ORIGIN = Object.freeze([Object.freeze({kind: 'composer'})]);

/** The event each chain raises, as its own arguments carry them. */
const EVENTS: ReadonlyArray<readonly [string, unknown, unknown]> = [
  ['agent.offer', {kind: 'agent', name: 'planner', description: 'plans', prompt: 'do it', source: 'builtin'}, {isOffered: true}],
  ['command.describe', {name: 'review', description: 'reviews a change', argumentHint: '[path]', isHidden: false}, {description: 'reviews a change', argumentHint: '[path]', isHidden: false}],
  ['config.describe', {key: 'theme', provider: 'settings', label: 'Theme', description: 'the colour scheme', isHidden: false}, {label: 'Theme', description: 'the colour scheme', isHidden: false}],
  ['tool.describe', {name: 'Read', description: 'reads a file', isDeferred: true}, {description: 'reads a file', isDeferred: true}],
  ['prompt.autocomplete', {text: 'rev', cursor: 3, token: 'rev', start: 0}, {suggestions: []}],
  ['telemetry.mark', {value: 7}, {value: undefined}],
  ['prompt.context', {blocks: [{name: 'claudeMd', text: 'be terse'}], instructionFiles: []}, {blocks: [{name: 'claudeMd', text: 'be terse'}], instructionFiles: []}],
  ['prompt.section', {text: 'the section body'}, {text: 'the section body'}],
  ['prompt.attachment', {text: 'the attachment body'}, {text: 'the attachment body'}],
  ['skill.prompt', {skill: 'review', text: 'review the diff'}, {text: 'review the diff'}],
  ['attribution.text', {text: 'written by a person'}, {text: 'written by a person'}],
  ['session.receive', {text: 'a received message'}, {text: 'a received message'}],
];

test('chain cores: each default chain answers with the source\'s own projection', async () => {
  for (const [name, event, expected] of EVENTS) {
    const answer = await ga(name, {origin: ORIGIN})(event);
    assert.deepEqual(answer, expected, name);
  }
});

test('chain cores: each name is paired with its copied site, not left undefined', () => {
  for (const [name] of EVENTS) {
    const site = $be()[name];
    assert.ok(site, `${name} has a registered site`);
    assert.equal((site as {event: string}).event, name);
  }
});

test('chain cores: a chain with no core still rejects with the runner\'s own sentence', async () => {
  await assert.rejects(
    () => ga('tool.call', {origin: ORIGIN})({tool: 'Read', args: {}}),
    /\$\.tool\.call: no core at the bottom of the chain/,
  );
});
