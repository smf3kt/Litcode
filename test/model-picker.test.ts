import { strict as assert } from 'node:assert';
import test from 'node:test';
import { MODEL_PICKER_TITLE, modelPickerCaption, modelPickerEffortFor, modelPickerEffortLine,
  modelPickerEffortStep, modelPickerGuide, modelPickerRowDescription } from '../src/model-picker.js';

test('the picker takes the recovered title, caption and guide', () => {
  assert.equal(MODEL_PICKER_TITLE, 'Select model');
  assert.equal(modelPickerCaption(), 'Switch between models. Your pick becomes the default for new sessions. ' +
    'For other/previous model names, specify with --model.');
  assert.equal(modelPickerGuide(), 'Enter set as default / s use this session only / Esc cancel');
});

test('the effort axis steps by one level and clamps at both ends', () => {
  assert.equal(modelPickerEffortStep('low', 'right'), 'medium');
  assert.equal(modelPickerEffortStep('medium', 'left'), 'low');
  assert.equal(modelPickerEffortStep('low', 'left'), 'low');
  assert.equal(modelPickerEffortStep('max', 'right'), 'max');
  assert.equal(modelPickerEffortStep('xhigh', 'right'), 'max');
  assert.equal(modelPickerEffortStep('max', 'left'), 'xhigh');
});

test('the effort line carries the glyph, the level and the default mark', () => {
  assert.equal(modelPickerEffortLine('high'), '● high effort (default)');
  assert.equal(modelPickerEffortLine('low'), '○ low effort');
  assert.equal(modelPickerEffortLine('max'), '◈ max effort');
  // The recovered line spells xhigh out as xHigh and nothing else.
  assert.equal(modelPickerEffortLine('xhigh'), '◉ xHigh effort');
  assert.equal(modelPickerEffortLine('xhigh', 'xhigh'), '◉ xHigh effort (default)');
  assert.equal(modelPickerEffortLine('medium', 'low'), '◐ medium effort');
});

test('only the row already in use carries a synthesized description', () => {
  assert.equal(modelPickerRowDescription('gateway/model-a', 'gateway/model-a'), 'Current model');
  assert.equal(modelPickerRowDescription('gateway/model-b', 'gateway/model-a'), undefined);
});

test('the effort is passed only when the axis moved onto a level', () => {
  assert.equal(modelPickerEffortFor('high', undefined), undefined);
  assert.equal(modelPickerEffortFor('high', 'high'), undefined);
  assert.equal(modelPickerEffortFor('high', 'low'), 'low');
  assert.equal(modelPickerEffortFor('medium', 'max'), 'max');
  assert.equal(modelPickerEffortFor('high', 'extreme'), undefined);
});
