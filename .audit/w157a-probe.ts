import { createWheelState, wheelStep, newJediTermWheelState, takeArrowBoost } from '../src/plugin-chain-wheel-acceleration.js';

let s = createWheelState();
console.log('defaults', JSON.stringify(s));
for (const t of [1000, 1010, 1020, 1030, 1040, 1050]) console.log('step', t, wheelStep(s, 1, t), 'mult', s.mult, 'mode', s.wheelMode, 'pf', s.pendingFlip);
console.log('reverse', wheelStep(s, -1, 1060), 'mult', s.mult, s.dir);
console.log('reverse2', wheelStep(s, -1, 1070), wheelStep(s, -1, 1080), 'mult', s.mult);

let f = createWheelState({ wheelFlood: true, base: 2 });
console.log('flood', wheelStep(f, 1, 2000), wheelStep(f, 1, 2050));

let d = createWheelState({ useDecayCurve: true });
for (const t of [3000,3010,3020,3030,3040,3050,3060,3070,3080,3090]) console.log('decay', t, wheelStep(d, 1, t), 'mult', d.mult, 'frac', d.frac);

let j = newJediTermWheelState(); j.trackpadGesture = true; j.pendingArrowBoost = 5;
console.log('jt0', wheelStep({ ...createWheelState(), jediTerm: j }, 1, 4000), 'frac', j.pendingArrowBoost);
let js = createWheelState(); js.jediTerm.trackpadGesture = true;
for (const t of [5000,5001,5002,5003,5004,5005]) console.log('jt', t, wheelStep(js, 1, t), 'frac', js.frac, 'mult', js.mult);
console.log('vno', takeArrowBoost(js.jediTerm), takeArrowBoost(js.jediTerm));
