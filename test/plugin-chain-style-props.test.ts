// The style-prop validators and the value budget (W45-64). The bodies are the copy's
// src/plugin-chain-style-props-source.ts — chunk-nyce03br.js [2097,2198), [2208,2288), [2523,2815),
// [2815,3407), [4004,4075), [4140,4987), [5978,5990), [6016,6041), [6041,6172), [6340,6358),
// [6358,6591), [87341,87483), [87483,87576), [87576,87714), [87714,87871), [87871,88707) and
// [88772,88798). Assertions are written from the measurement probes .audit/w45-64-probe{,b,c,d,e}.ts.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PFs } from '../src/tui-border.js';
import {
  BORDER_PROPS, budgetProblem, COLOR_PROPS, freshWalkBudget, listLength, MAX_LIST_LENGTH,
  NUMBER_TOLERANCE, PROP_RULES, propProblem, scalarCost, shortDescription, SIDE_PROPS, SIZE_PROPS,
  SPACING_PROPS, TEXT_STYLE_PROPS, VALUE_CHAR_LIMIT, VALUE_DEPTH_LIMIT, VALUE_NODE_LIMIT, valueEntries,
  valueProblem, walkProblem,
} from '../src/plugin-chain-style-props.js';

/** A value nested `depth` arrays deep, so the walker reaches depth `depth` at the innermost one. */
function nest(depth: number): unknown {
  let value: unknown = 1;
  for (let index = 0; index < depth; index += 1) value = [value];
  return value;
}

test('the bounds a prop is measured against are the source\'s own numbers', () => {
  assert.equal(NUMBER_TOLERANCE, 1e4);
  assert.equal(VALUE_CHAR_LIMIT, 1e5);
  assert.equal(VALUE_DEPTH_LIMIT, 32);
  assert.equal(VALUE_NODE_LIMIT, 20000);
  assert.equal(MAX_LIST_LENGTH, 4294967295);
});

test('the six name sets hold the props the source lists, and the sizes are the four it names', () => {
  assert.deepEqual([...TEXT_STYLE_PROPS],
    ['dimColor', 'bold', 'italic', 'underline', 'strikethrough', 'inverse', 'borderDimColor']);
  assert.deepEqual([...BORDER_PROPS], [...PFs], 'the border names are the tui border table, made into a Set');
  assert.deepEqual([...COLOR_PROPS], ['color', 'backgroundColor', 'borderColor']);
  assert.deepEqual([...SIDE_PROPS], ['top', 'left', 'right', 'bottom']);
  assert.deepEqual([...SIZE_PROPS], ['width', 'height', 'minWidth', 'minHeight']);
  assert.equal(SPACING_PROPS.size, 19);
  assert.equal(SPACING_PROPS.has('marginLeft'), true);
  assert.equal(SPACING_PROPS.has('bottom'), false, 'a side is not a spacing prop even though it is a number');
});

test('the rule table is the ten enum props, and borderStyle reuses the border set itself', () => {
  assert.deepEqual(Object.keys(PROP_RULES),
    ['flexDirection', 'flexWrap', 'alignItems', 'alignSelf', 'justifyContent', 'overflow', 'display',
      'position', 'wrap', 'borderStyle']);
  assert.equal(PROP_RULES.borderStyle, BORDER_PROPS, 'the same Set, not a second copy of the names');
  assert.deepEqual([...PROP_RULES.borderStyle], [...PFs]);
});

test('an enum prop answers the whole list it is measured against', () => {
  assert.equal(propProblem('flexDirection', 'row'), undefined);
  assert.equal(propProblem('flexDirection', 'column-reverse'), undefined);
  assert.equal(propProblem('flexDirection', 'nope'), 'must be one of row, column, row-reverse, column-reverse');
  assert.equal(propProblem('flexDirection', 1), 'must be one of row, column, row-reverse, column-reverse',
    'a value that is not a string is answered with the list, not with its type');
  assert.equal(propProblem('overflow', 'hidden'), undefined);
  assert.equal(propProblem('overflow', 'nope'), 'must be one of visible, hidden');
  assert.equal(propProblem('display', 'nope'), 'must be one of flex, none');
  assert.equal(propProblem('wrap', 'wrap'), undefined);
  assert.equal(propProblem('wrap', 'end'), undefined);
  assert.equal(propProblem('borderStyle', [...PFs][0] as string), undefined, 'and a border name is a rule of its own');
});

test('a size is a finite number in range or a percentage of one to three digits', () => {
  assert.equal(propProblem('width', 10), undefined);
  assert.equal(propProblem('width', 0), undefined);
  assert.equal(propProblem('width', NUMBER_TOLERANCE), undefined, 'the tolerance itself is inside');
  assert.equal(propProblem('width', 1.5), undefined, 'a size may be a fraction');
  assert.equal(propProblem('width', -1), `must be a finite number between 0 and ${NUMBER_TOLERANCE}`,
    'and a negative size is out of range rather than a wrong type');
  assert.equal(propProblem('width', NUMBER_TOLERANCE + 1), `must be a finite number between 0 and ${NUMBER_TOLERANCE}`);
  assert.equal(propProblem('width', Infinity), `must be a finite number between 0 and ${NUMBER_TOLERANCE}`);
  assert.equal(propProblem('width', '50%'), undefined);
  assert.equal(propProblem('width', '100%'), undefined);
  assert.equal(propProblem('width', '0%'), undefined);
  assert.equal(propProblem('width', '1000%'), 'must be a number or a percentage', 'three digits is the most');
  assert.equal(propProblem('width', '50'), 'must be a number or a percentage', 'a bare number as text is not a size');
  assert.equal(propProblem('width', '%'), 'must be a number or a percentage');
  assert.equal(propProblem('minWidth', '%'), 'must be a number or a percentage');
});

test('spacing is measured as a magnitude, and a side must be whole', () => {
  assert.equal(propProblem('gap', 1), undefined);
  assert.equal(propProblem('gap', 1.5), undefined, 'a spacing may be a fraction');
  assert.equal(propProblem('gap', -1), undefined, 'and may be negative, since it is the magnitude that counts');
  assert.equal(propProblem('gap', -NUMBER_TOLERANCE), undefined);
  assert.equal(propProblem('gap', NUMBER_TOLERANCE + 1), `must be a finite number within ${NUMBER_TOLERANCE}`);
  assert.equal(propProblem('gap', -NUMBER_TOLERANCE - 1), `must be a finite number within ${NUMBER_TOLERANCE}`);
  assert.equal(propProblem('gap', '2'), `must be a finite number within ${NUMBER_TOLERANCE}`);
  assert.equal(propProblem('margin', '2'), `must be a finite number within ${NUMBER_TOLERANCE}`);
  assert.equal(propProblem('top', 1), undefined);
  assert.equal(propProblem('top', -4), undefined);
  assert.equal(propProblem('top', 1.5), `must be an integer within ${NUMBER_TOLERANCE} (character cells)`,
    'a side names cells, so it is the one numeric rule that refuses a fraction');
  assert.equal(propProblem('top', '1'), `must be an integer within ${NUMBER_TOLERANCE} (character cells)`);
});

test('a colour is a character class rather than a list, so a theme key and a hex are the same rule', () => {
  assert.equal(propProblem('color', 'red'), undefined);
  assert.equal(propProblem('color', '#fff'), undefined);
  assert.equal(propProblem('color', '#ff00ff'), undefined);
  assert.equal(propProblem('color', 'primary'), undefined);
  assert.equal(propProblem('color', 'rgb(1,2,3)'), undefined, 'parentheses and commas are inside the class');
  assert.equal(propProblem('color', 'x'.repeat(40)), undefined, 'forty characters is the most');
  assert.equal(propProblem('color', 'x'.repeat(41)), 'must be a color (a theme key, a name, or hex)');
  assert.equal(propProblem('color', 1), 'must be a color (a theme key, a name, or hex)');
  assert.equal(propProblem('color', null), 'must be a color (a theme key, a name, or hex)');
  assert.equal(propProblem('color', 'a\x1bb'), 'must be a color (a theme key, a name, or hex)',
    'a control character is outside the class');
  assert.equal(propProblem('borderColor', 1), 'must be a color (a theme key, a name, or hex)');
});

test('a style prop is a boolean, and a name with no rule says so', () => {
  assert.equal(propProblem('dimColor', true), undefined);
  assert.equal(propProblem('dimColor', false), undefined);
  assert.equal(propProblem('dimColor', 1), 'must be a boolean');
  assert.equal(propProblem('dimColor', 'true'), 'must be a boolean', 'the text of a boolean is not a boolean');
  assert.equal(propProblem('bold', 1), 'must be a boolean');
  assert.equal(propProblem('nope', 1), 'has no value rule');
  assert.equal(propProblem('key', 1), 'has no value rule', 'a prop this chain knows elsewhere is not a style prop');
  assert.equal(propProblem('options', 1), 'has no value rule');
  assert.equal(propProblem('autoFocus', true), 'has no value rule', 'and neither is a leaf\'s own field');
});

test('a value is described as the phrase a <what it is>, and null is its own word', () => {
  assert.equal(shortDescription(null), 'null');
  assert.equal(shortDescription([]), 'an array');
  assert.equal(shortDescription({}), 'an object');
  assert.equal(shortDescription('s'), 'a string');
  assert.equal(shortDescription(1), 'a number');
  assert.equal(shortDescription(true), 'a boolean');
  assert.equal(shortDescription(undefined), 'a undefined', 'the article is written out whatever follows it');
  assert.equal(shortDescription(() => {}), 'a function');
});

test('a list length is coerced, and only a claim that cannot be a length is an error', () => {
  assert.equal(listLength([1, 2, 3]), 3);
  assert.equal(listLength('abcd'), 4);
  assert.equal(listLength({ length: 2 }), 2);
  assert.equal(listLength({ length: '12' }), 12, 'a numeric string is coerced');
  assert.equal(listLength({ length: 1.5 }), 1, 'a fraction is truncated');
  assert.equal(listLength({ length: -1 }), 0, 'a negative is zero rather than an error');
  assert.equal(listLength({ length: NaN }), 0);
  assert.equal(listLength({ length: MAX_LIST_LENGTH }), MAX_LIST_LENGTH, 'the largest length itself is a length');
  assert.throws(() => listLength({ length: MAX_LIST_LENGTH + 1 }),
    /a plugin's list claims a length no list has \(got 4294967296\)/);
  assert.throws(() => listLength({ length: 10n }),
    /a plugin's list claims a length no list has \(got a bigint\)/,
    'the two types that cannot be a length are named rather than coerced');
  assert.throws(() => listLength({ length: Symbol('s') }), /got a symbol/);
});

test('the budget counts values before characters, and answers nothing while inside', () => {
  assert.equal(budgetProblem(freshWalkBudget()), undefined);
  assert.equal(budgetProblem({ ...freshWalkBudget(), nodes: VALUE_NODE_LIMIT }), undefined, 'the bound itself is inside');
  assert.equal(budgetProblem({ ...freshWalkBudget(), nodes: VALUE_NODE_LIMIT + 1 }),
    `holds more than ${VALUE_NODE_LIMIT} values`);
  assert.equal(budgetProblem({ ...freshWalkBudget(), chars: VALUE_CHAR_LIMIT }), undefined);
  assert.equal(budgetProblem({ ...freshWalkBudget(), chars: VALUE_CHAR_LIMIT + 1 }),
    `serializes to more than ${VALUE_CHAR_LIMIT} characters`);
  assert.equal(budgetProblem({ ...freshWalkBudget(), nodes: VALUE_NODE_LIMIT + 1, chars: VALUE_CHAR_LIMIT + 1 }),
    `holds more than ${VALUE_NODE_LIMIT} values`, 'a value that is both too wide and too long answers the count');
});

test('a scalar costs its own text, and anything the walker has to open costs nothing here', () => {
  assert.deepEqual([false, true, 'ab', 12345, null, [], {}, undefined].map(scalarCost),
    [5, 5, 4, 5, 5, undefined, undefined, undefined]);
  assert.equal(scalarCost('x'.repeat(10)), 12, 'a string pays for its quotes');
  assert.equal(scalarCost(1e5), 6, 'and a number pays for its digits, not its value');
  assert.equal(scalarCost(() => {}), undefined);
  assert.equal(scalarCost(1n), undefined);
});

test('a fresh budget is empty, and a walk through the copy\'s own generator names each child', () => {
  const budget = freshWalkBudget();
  assert.deepEqual(budget, { nodes: 0, chars: 0, path: new Set(), done: new Map() });
  assert.deepEqual([...valueEntries(['a', 'b'])], [[1, 'a'], [1, 'b']],
    'measured: an array element is charged one character however long its index is');
  assert.deepEqual([...valueEntries({ ab: 1 })], [[6, 1]], 'and an object member its key plus four');
});

test('a value that fits the budget is admitted, and one that does not says why', () => {
  assert.equal(valueProblem(1), undefined);
  assert.equal(valueProblem('s'), undefined);
  assert.equal(valueProblem([1]), undefined);
  assert.equal(valueProblem({ a: 1 }), undefined);
  assert.equal(valueProblem({ a: [1, { b: 'c' }], d: null }), undefined, 'nesting alone is not too deep');
  assert.equal(valueProblem(new Array(10).fill('x')), undefined);
});

test('the walker names a hole, a function, a symbol and a bigint rather than skipping them', () => {
  assert.equal(valueProblem(undefined), 'holds undefined (an array hole, a missing value)');
  assert.equal(valueProblem([1, undefined]), 'holds undefined (an array hole, a missing value)',
    'an array with a hole reads the same way, which is the sentence\'s own reason');
  assert.equal(valueProblem(() => {}), 'holds a function');
  assert.equal(valueProblem(1n), 'holds a bigint');
  assert.equal(valueProblem(Symbol('s')), 'holds a symbol');
  assert.equal(valueProblem({ a: 1n }), 'holds a bigint', 'and a nested one is found by the walk');
});

test('a number that is not finite is named before it is counted', () => {
  assert.equal(valueProblem(NaN), 'holds NaN');
  assert.equal(valueProblem(Infinity), 'holds Infinity');
  assert.equal(valueProblem(-Infinity), 'holds -Infinity');
  assert.equal(valueProblem({ k: NaN }), 'holds NaN',
    'measured: the three characters of NaN are not spent first, so the value is named');
  assert.equal(valueProblem({ deep: [[[[1]]]] }), undefined);
});

test('a cycle is refused and a value seen twice is not a cycle', () => {
  const loop: unknown[] = [];
  loop.push(loop);
  assert.equal(valueProblem(loop), 'holds a cycle');
  assert.equal(valueProblem({ a: loop }), 'holds a cycle');
  const shared = { s: 1 };
  assert.equal(valueProblem({ a: shared, b: shared }), undefined,
    'measured: a value already walked is charged its own cost again instead of being walked again');
  assert.equal(valueProblem({ a: shared, b: { c: shared } }), undefined);
});

test('an object that is not plain is refused, and a null prototype is plain', () => {
  assert.equal(valueProblem(new Date(0)), 'holds an object that is not plain (a class instance)');
  assert.equal(valueProblem(new Map()), 'holds an object that is not plain (a class instance)');
  assert.equal(valueProblem(Object.create(null)), undefined, 'measured: a null prototype is plain');
  assert.equal(valueProblem({ a: Object.create(null) }), undefined);
});

test('depth is the first thing checked, so a deep value answers depth and not its shape', () => {
  assert.equal(valueProblem(nest(30)), undefined);
  assert.equal(valueProblem(nest(VALUE_DEPTH_LIMIT - 1)), undefined, 'measured: a value nested 31 deep is inside');
  assert.equal(valueProblem(nest(VALUE_DEPTH_LIMIT)), undefined, 'and one nested 32 deep is still inside');
  assert.equal(valueProblem(nest(VALUE_DEPTH_LIMIT + 1)), `nests deeper than ${VALUE_DEPTH_LIMIT}`);
  assert.equal(valueProblem(nest(40)), `nests deeper than ${VALUE_DEPTH_LIMIT}`);
  assert.equal(valueProblem({ deep: nest(40) }), `nests deeper than ${VALUE_DEPTH_LIMIT}`,
    'a deep value inside a shallow one is the same sentence');
});

test('the character budget counts the names as well as the values', () => {
  assert.equal(valueProblem('x'.repeat(99997)), undefined);
  assert.equal(valueProblem('x'.repeat(99998)), undefined,
    'measured: 99998 characters plus the two quotes is exactly the bound');
  assert.equal(valueProblem('x'.repeat(99999)), `serializes to more than ${VALUE_CHAR_LIMIT} characters`);
  assert.equal(valueProblem({ k: 'x'.repeat(99991) }), undefined,
    'and an object member pays for its key: the object\'s two braces, the key\'s five characters and the quotes');
  assert.equal(valueProblem({ k: 'x'.repeat(99992) }), `serializes to more than ${VALUE_CHAR_LIMIT} characters`);
});

test('the count budget counts the container and every value in it', () => {
  assert.equal(valueProblem(new Array(19999).fill(0)), undefined, 'measured: the array and 19999 values is 20000');
  assert.equal(valueProblem(new Array(20000).fill(0)), `holds more than ${VALUE_NODE_LIMIT} values`);
  assert.equal(valueProblem(new Array(20001).fill(0)), `holds more than ${VALUE_NODE_LIMIT} values`);
  assert.equal(valueProblem({ a: new Array(19999).fill(0) }),
    `holds more than ${VALUE_NODE_LIMIT} values`,
    'the object holding it is one of the values counted');
});

test('one walk is one budget, so two calls do not share what the first one spent', () => {
  const value = new Array(19999).fill(0);
  assert.equal(valueProblem(value), undefined);
  assert.equal(valueProblem(value), undefined, 'the budget is built inside the call, not kept between calls');
  const budget = freshWalkBudget();
  assert.equal(walkProblem(value, 0, budget), undefined);
  assert.equal(budget.nodes, VALUE_NODE_LIMIT, 'measured: the array and its 19999 values is exactly the bound');
  assert.equal(walkProblem(value, 0, budget), `holds more than ${VALUE_NODE_LIMIT} values`,
    'and a caller that hands its own budget back in is charged the same again from the done map, so the ' +
    'second walk of one value does not fit');
});
