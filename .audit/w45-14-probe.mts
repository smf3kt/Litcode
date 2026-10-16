// W45-14 measurement: the three classic sites the source writes by hand, read through the registered
// table. Every sentence and shape the copied rules answer with is printed, so the regression asserts
// measured values rather than plausible ones.
import '../src/plugin-chain-registry.js';
import { $be } from '../src/plugin-chain-host.js';

const s = (n: string): any => ($be() as any)[n];
const show = (label: string, v: unknown) => console.log(label + ' -> ' + JSON.stringify(v));
const keys = (n: string) => console.log(n + ' keys -> ' + JSON.stringify(Object.keys(s(n)).sort()));

keys('classic.PreToolUse'); keys('tool.call'); keys('tool.check');
show('total sites', Object.keys($be() as any).length);

const pre = s('classic.PreToolUse');
show('pre ok', pre.check({ continue: true }, {}, []));
show('pre deny not string', pre.check({ permissionDecision: 'deny', allow: 'yes' }, {}, []));
show('pre allow not true', pre.check({ allow: 1 }, {}, []));
show('pre decision shape', pre.check({ permissionDecision: 'deny', decision: 5 }, {}, []));
show('pre arg same', pre.checkArgument({ tool_name: 'A' }, { tool_name: 'A' }));
show('pre arg changed', pre.checkArgument({ tool_name: 'B' }, { tool_name: 'A' }));
show('pre restore dropped', pre.restoreArgument({}, { tool_name: 'A', $shadowed: { x: 1 } }));
show('pre settle', pre.settle({ deny: 'no', ask: 'sure', allow: true, other: 1 }));

const call = s('tool.call');
show('call ok', call.check({ result: 'r' }, {}, []));
show('call deny', call.check({ deny: 'no' }, {}, []));
show('call empty', call.check({}, {}, []));
show('call bad arg', call.checkArgument({ tool: 'X' }, { tool: 'Y' }));
show('call strip read-only below', call.stripResult({ result: 'r', ref: 'x', isReadOnly: true }, [{ ref: 'x', isReadOnly: true, result: 'r' }]));
show('call strip not read-only', call.stripResult({ result: 'r', ref: 'x' }, [{ ref: 'x', isReadOnly: false, result: 'r' }]));
show('call settle', call.settle({ result: 'r', context: ['a'] }));

const chk = s('tool.check');
show('chk ok', chk.check({ decision: 'allow' }, {}, []));
show('chk bad decision', chk.check({ decision: 'maybe' }, {}, []));
show('chk empty', chk.check({}, {}, []));
show('chk arg', chk.checkArgument({ tool: 'X' }, { tool: 'Y' }));
show('chk restore result', chk.restoreResult({ decision: 'allow', ceiling: 9 }, [], { tool: 'X', ceiling: 3 }));
show('chk settle', chk.settle({ decision: 'deny', reason: 'r', rule: 'ru', hook: 'h', other: 1 }));
