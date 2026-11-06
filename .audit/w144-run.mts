import { runEnginePipeline } from '../src/plugin-chain-engine-pipeline.js';
import { descriptorInput } from '../src/plugin-chain-terminal.js';

const input = { component: 'Probe', requestId: '', surface: 'terminal', props: {} };
const drawn: any = await runEnginePipeline(input);
console.log('drawn', JSON.stringify(drawn));
console.log('ref', drawn?.ref, 'same', descriptorInput(drawn, drawn?.ref) === input);
