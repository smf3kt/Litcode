// Probe the W45-63 bodies through the seam before any assertion is written.
import {
  checkAutoFocus, checkHoverKey, checkPress, CODE_MAX_START_LINE, codeLeafProblem, INPUT_FIELDS,
  inputLeafProblem, isNonBlankString, isPixelSide, optionProblem, SELECT_MAX_OPTIONS,
  selectLeafProblem, SVG_PIXEL_LIMIT, SVG_SOURCE_LIMIT, svgLeafProblem,
} from '../src/plugin-chain-site-leaves.js';

const show = (name: string, value: unknown) => console.log(name, '=', JSON.stringify(value));

show('constants', {
  CODE_MAX_START_LINE, SVG_PIXEL_LIMIT, SVG_SOURCE_LIMIT, SELECT_MAX_OPTIONS, INPUT_FIELDS,
});
show('checkAutoFocus', [checkAutoFocus(undefined), checkAutoFocus(true), checkAutoFocus(false), checkAutoFocus(1)]);
show('checkHoverKey', [
  checkHoverKey('k'), checkHoverKey(''), checkHoverKey(7), checkHoverKey('k'.repeat(10000)),
  checkHoverKey('k'.repeat(10001)), checkHoverKey('a\x1bb'),
]);
show('checkPress', [
  checkPress({ plugin: 'p', handle: 1 }), checkPress({ plugin: 'p', handle: 1.5 }),
  checkPress({ plugin: 'p' }), checkPress({ plugin: '' , handle: 1 }), checkPress(undefined),
]);
show('isNonBlankString', [isNonBlankString('a'), isNonBlankString('  '), isNonBlankString(' a '), isNonBlankString(1), isNonBlankString(undefined)]);
show('isPixelSide', [isPixelSide(undefined), isPixelSide(1), isPixelSide(4096), isPixelSide(4097), isPixelSide(0), isPixelSide(-1), isPixelSide(1.5), isPixelSide('1')]);

const seen = () => new Set<string>();
show('optionProblem', [
  optionProblem({ value: 'a' }, seen()),
  optionProblem({ value: 'a', label: 'A' }, seen()),
  optionProblem({ value: 1 }, seen()),
  optionProblem({ value: 'a', extra: 1 }, seen()),
  optionProblem({ value: 'a\x1bb' }, seen()),
  optionProblem('x', seen()),
]);

show('codeLeafProblem', [
  codeLeafProblem({ props: { source: 'x' } }),
  codeLeafProblem({ props: { source: 'x', language: 'ts', path: 'a.ts', startLine: 1, format: 'diff', wrap: 'wrap' } }),
  codeLeafProblem({ props: null }),
  codeLeafProblem({ props: { source: 'x', children: 1 } }),
  codeLeafProblem({ props: { source: 'x' }, children: 1 }),
  codeLeafProblem({ props: { source: 'x', hover: 1 } }),
  codeLeafProblem({ props: { source: 'x', language: 1 } }),
  codeLeafProblem({ props: { source: 'a\x1bb' } }),
  codeLeafProblem({ props: { source: 'x', startLine: 0 } }),
  codeLeafProblem({ props: { source: 'x', startLine: 1e9 + 1 } }),
  codeLeafProblem({ props: { source: 'x', format: 'other' } }),
  codeLeafProblem({ props: { source: 'x', wrap: 'other' } }),
]);

show('inputLeafProblem', [
  inputLeafProblem({ props: { key: 'k' } }),
  inputLeafProblem({ props: { key: 'k', label: 'L', placeholder: 'p', value: 'v', submitLabel: 's', autoFocus: true } }),
  inputLeafProblem({ props: { key: 'k', autoFocus: true } }),
  inputLeafProblem({ props: {} }),
  inputLeafProblem({ props: { key: '' } }),
  inputLeafProblem({ props: { key: 'k', hover: 1 } }),
  inputLeafProblem({ props: { key: 'k', label: 1 } }),
  inputLeafProblem({ props: { key: 'k', label: 1, placeholder: 2 } }),
  inputLeafProblem({ props: { key: 'k', autoFocus: false } }),
  inputLeafProblem({ props: { key: 'k' }, press: { plugin: 'p', handle: 1 } }),
  inputLeafProblem({ props: { key: 'k' }, press: { plugin: 'p' } }),
  inputLeafProblem({ props: { key: 'k' }, children: 'x' }),
  inputLeafProblem({ props: { key: 'k', label: 1 }, children: 'x' }),
]);

show('selectLeafProblem', [
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }] } }),
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }, { value: 'b' }], label: 'L', value: 'a', autoFocus: true } }),
  selectLeafProblem({ props: { key: 'k' } }),
  selectLeafProblem({ props: { key: 'k', options: [] } }),
  selectLeafProblem({ props: { key: 'k', options: new Array(65).fill({ value: 'a' }) } }),
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }, { value: 'a' }] } }),
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }, 1] } }),
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }], hover: 1 } }),
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }], label: 1 } }),
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }], value: 1 } }),
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }], autoFocus: false } }),
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }] }, press: {} }),
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }] }, children: 'x' }),
]);

show('svgLeafProblem', [
  svgLeafProblem({ props: { source: 'x', alt: 'a' } }),
  svgLeafProblem({ props: { source: 'x', alt: 'a', width: 10, height: 20, isInteractive: true } }),
  svgLeafProblem({ props: null }),
  svgLeafProblem({ props: { source: 'x', alt: 'a' }, children: 1 }),
  svgLeafProblem({ props: { source: 'x', alt: 'a', hover: 1 } }),
  svgLeafProblem({ props: { source: '', alt: 'a' } }),
  svgLeafProblem({ props: { source: 'x'.repeat(SVG_SOURCE_LIMIT + 1), alt: 'a' } }),
  svgLeafProblem({ props: { source: 'x', alt: 1 } }),
  svgLeafProblem({ props: { source: 'x', alt: 'a\x1bb' } }),
  svgLeafProblem({ props: { source: 'x', alt: 'a', width: 4097 } }),
  svgLeafProblem({ props: { source: 'x', alt: 'a', height: 0 } }),
  svgLeafProblem({ props: { source: 'x', alt: 'a', isInteractive: 'yes' } }),
]);
