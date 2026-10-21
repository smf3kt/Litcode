import { strict as assert } from 'node:assert';
import test from 'node:test';
import { ModelPicker, MODEL_PICKER_TITLE, modelPickerCaption, modelPickerEffortLine,
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

test('manual effort survives focus changes, endpoint clamps and a round trip to the initial level', () => {
  const options = [{ label: 'One', value: 'one' }, { label: 'Two', value: 'two' }];
  const picker = new ModelPicker(options, { current: 'one' });
  assert.deepEqual(picker.accept(), { selected: ['one'] });
  picker.move(1);
  assert.deepEqual(picker.accept(), { selected: ['two'] });
  picker.adjust('right'); picker.adjust('left'); picker.move(-1);
  assert.deepEqual(picker.accept(), { selected: ['one'], adjusted: 'high' });
  picker.adjust('left'); picker.adjust('left'); picker.adjust('left'); picker.move(1);
  assert.deepEqual(picker.accept(true), { selected: ['two'], adjusted: 'low', key: 's' });
  const maximum = new ModelPicker(options, { current: 'one', effort: 'max' });
  maximum.adjust('right');
  assert.deepEqual(maximum.accept(false, 1), { selected: ['two'], adjusted: 'max' });
});
