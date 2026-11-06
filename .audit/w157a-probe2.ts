import { createWheelState, wheelStep } from '../src/plugin-chain-wheel-acceleration.js';
const s=createWheelState();
console.log(wheelStep(s,1,1000), s.mult);
console.log(wheelStep(s,1,1010), s.mult);
console.log(wheelStep(s,-1,1020), s.mult, s.pendingFlip);
console.log(wheelStep(s,-1,1030), s.mult, s.pendingFlip, s.wheelMode);
console.log(wheelStep(s,-1,1040), s.mult, s.wheelMode);
