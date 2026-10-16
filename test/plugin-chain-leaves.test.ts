// The Client, the Markdown and the Link (W45-65). The bodies are the copy's src/plugin-chain-leaves-source.ts
// — chunk-n3ykh62m.js [235982,236808), [247312,248693) (`Lrt`, `pur`, `zto`, `Vto`) and [260226,260804)
// (`Nrt`, `sno`). Assertions are written from the measurement probes .audit/w45-65-probe{,b}.ts.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clientLeafProblem, encodeHref, LINK_HREF_LIMIT, linkLeafProblem, markdownLeafProblem,
  PRESSABLE_LINK_LIMIT, pressableLinksProblem,
} from '../src/plugin-chain-leaves.js';

/** A stamped client and a press a leaf of this chain would be handed. */
const STAMP = { plugin: 'p', handle: 1 };

const client = (props: unknown, extra: Record<string, unknown> = {}) =>
  clientLeafProblem({ props, client: STAMP, ...extra });
const markdown = (props: unknown, extra: Record<string, unknown> = {}) => markdownLeafProblem({ props, ...extra });
const link = (props: unknown, extra: Record<string, unknown> = {}) => linkLeafProblem({ props, ...extra });

test('the two limits the Link and a pressable-link list are measured against', () => {
  assert.equal(LINK_HREF_LIMIT, 2048);
  assert.equal(PRESSABLE_LINK_LIMIT, 256);
});

test('a Client is admitted with its two keys alone or with the props and sizes it admits', () => {
  assert.equal(client({ key: 'k', module: 'm' }), undefined);
  assert.equal(client({ key: 'k', module: 'm', props: { a: 1 } }), undefined);
  assert.equal(client({ key: 'k', module: 'm', width: 10, height: '50%', flexGrow: 1 }), undefined);
  assert.equal(client({ key: 'k', module: 'm', props: { a: [1, { b: 'c' }] } }), undefined,
    'and a prop bag is only refused when the budget of the value walker refuses it');
});

test('a Client names its props sentence for every wrong shape, and the keys are checked after it', () => {
  const sentence = 'Client props must be { key, module }, both non-empty strings, and any of props, ' +
    'width, height, flexGrow';
  assert.equal(client(undefined), sentence);
  assert.equal(client('x'), sentence);
  assert.equal(client({ key: 'k' }), sentence, 'a module is required');
  assert.equal(client({ module: 'm' }), sentence);
  assert.equal(client({ key: '', module: 'm' }), sentence);
  assert.equal(client({ key: 'k', module: 'm', extra: 1 }), sentence, 'a stray prop answers the props sentence');
});

test('a Client prefixes every sentence it answers with its own key', () => {
  assert.equal(client({ key: 'k', module: 'm', width: { a: 1 } }),
    'Client "k" width must be a number or a string',
    'a size that is neither a number nor a string is named by that sentence, not by the prop rules');
  assert.equal(client({ key: 'k', module: 'm', width: 10, height: 'x' }),
    'Client "k" height must be a number or a percentage', 'and a string goes on to the prop rules of its own name');
  assert.equal(client({ key: 'k', module: 'm', props: { a: undefined } }),
    'Client "k" props holds undefined (an array hole, a missing value)',
    'the prop bag is described by the value walker, and the site prefixes the walker\'s sentence');
  assert.equal(client({ key: 'k', module: 'm', props: { a: new Date(0) } }),
    'Client "k" props holds an object that is not plain (a class instance)');
});

test('a Client must be stamped by a plugin of this chain, and the stamp is checked before children', () => {
  assert.equal(clientLeafProblem({ props: { key: 'k', module: 'm' } }),
    'Client "k" is not stamped by a plugin of this chain', 'no client at all is refused');
  assert.equal(clientLeafProblem({ props: { key: 'k', module: 'm' }, client: { plugin: 'p' } }), undefined,
    'measured: a stamp is a name and nothing else — this predicate does not ask for a handle');
  assert.equal(clientLeafProblem({ props: { key: 'k', module: 'm' }, client: { plugin: '' } }),
    'Client "k" is not stamped by a plugin of this chain');
  assert.equal(clientLeafProblem({ props: { key: 'k', module: 'm' }, client: {} }),
    'Client "k" is not stamped by a plugin of this chain');
  assert.equal(clientLeafProblem({ props: { key: 'k', module: 'm' }, client: 'p' }),
    'Client "k" is not stamped by a plugin of this chain', 'a bare name is not a record');
  assert.equal(client({ key: 'k', module: 'm' }, { children: 'x' }), 'Client "k" takes no children');
  assert.equal(client({ key: 'k', module: 'm', width: 'x' }, { children: 'x' }),
    'Client "k" width must be a number or a percentage', 'a bad width beats the children sentence');
  assert.equal(client({ key: 'k', module: 'm', props: { a: 1 } }, { children: 'x' }),
    'Client "k" takes no children', 'while a sound prop bag falls through to it');
});

test('a Link is admitted with an href alone or with a label', () => {
  assert.equal(link({ href: 'https://a' }), undefined);
  assert.equal(link({ href: 'https://a', label: 'L' }), undefined);
  assert.equal(link({ href: 'x'.repeat(LINK_HREF_LIMIT) }), undefined, 'the limit itself fits as written');
});

test('a Link does not refuse an href that is not an address at all', () => {
  assert.equal(link({ href: 1 }), undefined, 'measured: the check is guarded by the non-blank-string predicate');
  assert.equal(link({ href: '' }), undefined, 'and an empty href is not an address to measure');
  assert.equal(link({}), undefined);
  assert.equal(link({ href: [] }), undefined);
});

test('a Link measures its href as written and again as encoded', () => {
  assert.equal(link({ href: 'x'.repeat(LINK_HREF_LIMIT + 1) }),
    `Link href longer than ${LINK_HREF_LIMIT} characters as written`);
  assert.equal(link({ href: 'é'.repeat(LINK_HREF_LIMIT / 2) }),
    `Link href longer than ${LINK_HREF_LIMIT} characters as written`,
    'measured: 1024 accented characters is 3072 bytes encoded, so a short-as-written href is still refused');
  assert.equal(link({ href: 'a\x1bb' }), undefined, 'the href is not scrubbed — only the label is');
});

test('a Link checks its href before its label, and its stray prop before both', () => {
  assert.equal(link({ href: 'https://a', extra: 1 }), 'Link prop "extra" is not allowed');
  assert.equal(link({ href: 'x'.repeat(LINK_HREF_LIMIT + 1), extra: 1 }), 'Link prop "extra" is not allowed');
  assert.equal(link({ href: [], label: 1 }), 'Link label must be a string',
    'an unmeasurable href falls through to the label');
  assert.equal(link({ href: 'https://a', label: 1 }), 'Link label must be a string');
  assert.equal(link({ href: 'https://a', label: '  ' }), 'Link label is blank (leave it out to draw the URL)');
  assert.equal(link({ href: 'https://a', label: '' }), 'Link label is blank (leave it out to draw the URL)');
  assert.equal(link({ href: 'https://a', label: 'a\x1bb' }),
    'Link label holds a control character (an escape sequence)');
  assert.equal(linkLeafProblem({}), 'Link props must be { href }', 'and the props themselves come first of all');
});

test('the href encoder percent-encodes everything outside printable ASCII', () => {
  assert.equal(encodeHref('a'), 'a');
  assert.equal(encodeHref(''), '');
  assert.equal(encodeHref('a b'), 'a b', 'measured: the range starts at a space, so a space is inside it');
  assert.equal(encodeHref('~'), '~', 'and ends at the tilde');
  assert.equal(encodeHref('a\nb'), 'a%0Ab', 'while a newline is outside and is escaped');
  assert.equal(encodeHref('a\tb'), 'a%09b');
  assert.equal(encodeHref('\u007f'), '%7F', 'and so is delete, at the far side of the range');
  assert.equal(encodeHref('café'), 'caf%C3%A9');
  assert.equal(encodeHref('é'), '%C3%A9');
  assert.equal(encodeHref('x😀'), 'x%F0%9F%98%80', 'a paired surrogate encodes as the character');
});

test('the href encoder repairs a lone surrogate before it encodes it', () => {
  assert.equal(encodeHref('\uD800'), '%EF%BF%BD', 'measured: the repair is U+FFFD, not a malformed escape');
  assert.equal(encodeHref('\uD800x'), '%EF%BF%BDx');
  assert.equal(encodeHref('\uDC00'), '%EF%BF%BD', 'and a lone low surrogate is repaired the same way');
});

test('a pressable-link list is optional and answers nothing when it is absent', () => {
  assert.equal(pressableLinksProblem(undefined), undefined);
  assert.equal(pressableLinksProblem([]), undefined, 'an empty list is a list');
  assert.equal(pressableLinksProblem(['https://a']), undefined);
  assert.equal(pressableLinksProblem(new Array(PRESSABLE_LINK_LIMIT).fill('a')), undefined, 'the count limit fits');
});

test('a pressable-link list names its own sentences without a site', () => {
  assert.equal(pressableLinksProblem('x'), 'pressableLinks is a string, not a list of hrefs');
  assert.equal(pressableLinksProblem({}), 'pressableLinks is an object, not a list of hrefs');
  assert.equal(pressableLinksProblem([1]), 'pressableLinks holds a number, not an href');
  assert.equal(pressableLinksProblem([null]), 'pressableLinks holds null, not an href',
    'the shape of the entry is what is named, and null is its own word');
  assert.equal(pressableLinksProblem(['a', 2]), 'pressableLinks holds a number, not an href',
    'the first bad entry is the one answered');
  assert.equal(pressableLinksProblem(['']), 'pressableLinks holds a string, not an href',
    'an empty string is not an href either, and the sentence names its type rather than its emptiness');
  assert.equal(pressableLinksProblem(new Array(PRESSABLE_LINK_LIMIT + 1).fill('a')),
    `pressableLinks names more than ${PRESSABLE_LINK_LIMIT} links`, 'the count is checked before the entries');
});

test('a pressable-link list measures an href as written and does not encode it', () => {
  assert.equal(pressableLinksProblem(['x'.repeat(LINK_HREF_LIMIT)]), undefined);
  assert.equal(pressableLinksProblem(['x'.repeat(LINK_HREF_LIMIT + 1)]),
    `pressableLinks holds an href longer than ${LINK_HREF_LIMIT} characters`);
  assert.equal(pressableLinksProblem(['é'.repeat(LINK_HREF_LIMIT / 2)]), undefined,
    'measured: unlike the Link\'s own href check, this one does not measure the encoded length');
  assert.equal(pressableLinksProblem(['a\x1bb']), 'pressableLinks holds an href with a control character');
});

test('a Markdown is admitted with a text alone or with a key and its links', () => {
  assert.equal(markdown({ text: 't' }), undefined);
  assert.equal(markdown({ key: 'k', text: 't' }), undefined);
  assert.equal(markdown({ key: 'k', text: 't', dimColor: true, pressableLinks: ['https://a'] }, { press: STAMP }),
    undefined);
});

test('a Markdown names its own site only once it has a key', () => {
  assert.equal(markdown({ key: 'k', text: 'a\x1bb' }), 'Markdown "k" text holds a control character',
    'the prefix carries the key');
  assert.equal(markdown({ key: 'k', text: 't', dimColor: 1 }), 'Markdown "k" dimColor is a boolean or absent');
  assert.equal(markdown({ text: 't', dimColor: 1 }), 'Markdown dimColor is a boolean or absent',
    'and without a key the site is named alone');
});

test('a Markdown checks its props shape, its children, then its text', () => {
  const sentence = 'Markdown props must be { text }, a string, key a string, dimColor a boolean and ' +
    'pressableLinks a list of hrefs';
  assert.equal(markdown(undefined), sentence);
  assert.equal(markdown({ text: 't', extra: 1 }), sentence, 'a stray key is what the props sentence is for');
  assert.equal(markdown({ key: 'k' }), 'Markdown text must be a string',
    'measured: a missing text is not a props problem — the props are a sound bag with no text in them');
  assert.equal(markdown({}), 'Markdown text must be a string');
  assert.equal(markdown({ text: 1 }), 'Markdown text must be a string');
  assert.equal(markdown({ text: 't' }, { children: 'x' }), 'Markdown takes no children');
  assert.equal(markdown({ key: 'k', text: 't' }, { children: 'x' }), 'Markdown takes no children',
    'measured: this one sentence carries no key even when the leaf has one');
});

test('a Markdown scrubs the key it refuses and uses it only for its own sentence', () => {
  assert.equal(markdown({ key: '', text: 't' }), 'Markdown key "" is not a usable address',
    'an empty key is refused by the hover-scope key check, with the key scrubbed into the sentence');
  assert.equal(markdown({ key: 'a\x1bb', text: 't' }), 'Markdown key "a?b" is not a usable address',
    'and a control character is replaced rather than refused by name');
  assert.equal(markdown({ key: 1, text: 't' }), 'Markdown key "1" is not a usable address',
    'a key that is not a string at all is refused the same way, scrubbed to its text');
});

test('a Markdown reads the pairing of a press and its links from either side', () => {
  assert.equal(markdown({ key: 'k', text: 't' }, { press: STAMP }), undefined);
  assert.equal(markdown({ key: 'k', text: 't', pressableLinks: ['https://a'] }, { press: STAMP }), undefined);
  assert.equal(markdown({ text: 't', pressableLinks: ['https://a'] }, { press: STAMP }),
    'Markdown answers its links (onLinkPress) but has no key, its address',
    'measured: a press needs a key whatever else the leaf carries, links or not');
  assert.equal(markdown({ text: 't', pressableLinks: ['https://a'] }),
    'Markdown names pressableLinks but answers no press (onLinkPress)',
    'links without a press are refused');
  assert.equal(markdown({ text: 't' }, { press: STAMP }),
    'Markdown answers its links (onLinkPress) but has no key, its address',
    'and so is a press without a key');
  assert.equal(markdown({ key: 'k', text: 't' }, { press: STAMP }), undefined, 'a press with a key and no links fits');
  assert.equal(markdown({ text: 't' }), undefined, 'and a leaf with neither is admitted');
});

test('a Markdown checks its links before dimColor and its press sentence after it', () => {
  assert.equal(markdown({ key: 'k', text: 1, pressableLinks: 'x' }, { press: STAMP }), 'Markdown text must be a string',
    'the text is checked first');
  assert.equal(markdown({ key: 'k', text: 't', pressableLinks: 'x' }, { press: STAMP }),
    'Markdown "k" pressableLinks is a string, not a list of hrefs');
  assert.equal(markdown({ key: 'k', text: 't', dimColor: 1, pressableLinks: 'x' }, { press: STAMP }),
    'Markdown "k" pressableLinks is a string, not a list of hrefs', 'links beat dimColor');
  assert.equal(markdown({ key: 'k', text: 't', pressableLinks: 'x' }),
    'Markdown "k" pressableLinks is a string, not a list of hrefs', 'links beat the press sentence too');
  assert.equal(markdown({ key: 'k', text: 't', pressableLinks: [1] }, { press: STAMP }),
    'Markdown "k" pressableLinks holds a number, not an href',
    'the list check\'s own sentence is prefixed by the site');
  assert.equal(markdown({ key: 'k', text: 't' }, { press: { plugin: 'p', handle: 1.5 } }),
    'Markdown "k" is not held by a plugin of this chain');
  assert.equal(markdown({ text: 't' }, { press: {} }), 'Markdown is not held by a plugin of this chain');
});
