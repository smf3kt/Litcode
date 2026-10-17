import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createWheelState,
  newJediTermWheelState,
  takeArrowBoost,
  wheelStep,
} from '../src/plugin-chain-wheel-acceleration.js';

function near(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);
}

test('createWheelState builds the source defaults', () => {
  const state = createWheelState();
  assert.deepEqual(state, {
    time: 0,
    mult: 1,
    dir: 0,
    useDecayCurve: false,
    frac: 0,
    base: 1,
    pendingFlip: false,
    wheelMode: false,
    burstCount: 0,
    jbBypass: false,
    jediTerm: {
      lastWheelTime: 0,
      lastWheelDownTime: 0,
      bugConfirmed: false,
      notified: false,
      trackpadGesture: false,
      pendingArrowBoost: 0,
    },
    wheelFlood: false,
    accelEnabled: true,
  });
});

test('the window curve grows the multiplier by 0.3 per event and floors the rows', () => {
  const state = createWheelState();
  assert.equal(wheelStep(state, 1, 1000), 1);
  near(state.mult, 1);
  assert.equal(wheelStep(state, 1, 1010), 1);
  near(state.mult, 1.3);
  assert.equal(wheelStep(state, 1, 1020), 1);
  assert.equal(wheelStep(state, 1, 1030), 1);
  assert.equal(wheelStep(state, 1, 1040), 2);
  near(state.mult, 2.2);
});

test('a direction reversal drops the first event and restarts at base', () => {
  const state = createWheelState();
  wheelStep(state, 1, 1000);
  wheelStep(state, 1, 1010);
  near(state.mult, 1.3);
  assert.equal(wheelStep(state, -1, 1020), 0);
  assert.equal(wheelStep(state, -1, 1030), 1);
  near(state.mult, 1);
  assert.equal(wheelStep(state, -1, 1040), 1);
  near(state.mult, 1.3);
  assert.equal(state.dir, -1);
});

test('wheel flood steps by the base times the flood factor', () => {
  const state = createWheelState({ wheelFlood: true, base: 2 });
  assert.equal(wheelStep(state, 1, 2000), 6);
  assert.equal(wheelStep(state, 1, 2050), 6);
});

test('the decay curve accelerates across events and keeps the fraction', () => {
  const state = createWheelState({ useDecayCurve: true });
  assert.equal(wheelStep(state, 1, 3000), 2);
  near(state.mult, 2);
  assert.equal(wheelStep(state, 1, 3010), 8);
  near(state.mult, 8.638732831283331);
  near(state.frac, 0.6387328312833311);
  assert.equal(wheelStep(state, 1, 3020), 15);
});

test('the JediTerm trackpad branch accumulates the 0.35 fraction and boosts the multiplier', () => {
  const state = createWheelState();
  state.jediTerm.trackpadGesture = true;
  assert.equal(wheelStep(state, 1, 5000), 0);
  near(state.frac, 0.3528);
  near(state.mult, 1.008);
  assert.equal(wheelStep(state, 1, 5001), 0);
  near(state.frac, 0.7084);
  assert.equal(wheelStep(state, 1, 5002), 1);
  near(state.frac, 0.0668);
});

test('takeArrowBoost answers the pending boost once and clears it', () => {
  const state = newJediTermWheelState();
  state.pendingArrowBoost = 5;
  assert.equal(takeArrowBoost(state), 5);
  assert.equal(takeArrowBoost(state), 0);
  assert.equal(state.pendingArrowBoost, 0);
});
