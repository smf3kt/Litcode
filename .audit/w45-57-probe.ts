// Measurement probe for W45-57. Prints what the ported ui.notify floor really answers; the suite's
// assertions are written from this output, not from expectation.
import { bindPluginSession, raiseUiCall, uiCallTable } from '../src/plugin-chain-ui.js';
import { Dzo, Fzo, Nzo, wn } from '../src/plugin-chain-ui-source.js';

const show = (label: string, value: unknown): void => console.log(label, JSON.stringify(value));
const attempt = (label: string, run: () => unknown): void => {
  try { show(label, run()); } catch (error) { show(label, { threw: (error as Error).constructor.name, message: (error as Error).message }); }
};

show('table.keys', Object.keys(uiCallTable()));
const entry = uiCallTable()['ui.notify'];
show('entry.fields', Object.keys(entry));
show('wn.initial', wn());

// The check: only title and text are read.
show('check.empty', Dzo({}));
show('check.text', Dzo({ text: 'hi' }));
show('check.title', Dzo({ text: 'hi', title: 'T' }));
show('check.titleUndefined', Dzo({ text: 'hi', title: void 0 }));
show('check.titleNumber', Dzo({ text: 'hi', title: 7 }));
attempt('check.textNumber', () => Dzo({ text: 7 }));
attempt('check.noArgs', () => Dzo());

// The stamp: an absent title is filled with the plugin name; a present one is kept.
show('stamp.absent', Fzo({ text: 'hi' }, { plugin: 'tips' }));
show('stamp.present', Fzo({ text: 'hi', title: 'T' }, { plugin: 'tips' }));
show('stamp.extraKept', Fzo({ text: 'hi', extra: 1 }, { plugin: 'tips' }));

// The run, over one channel answer at a time.
const caller = { plugin: 'tips', origin: [] };
const withSession = (notify: unknown): (() => void) =>
  bindPluginSession({ status: () => void 0, toast: () => void 0, notify } as never);
const attemptAsync = async (label: string, run: () => Promise<unknown>): Promise<void> => {
  try { show(label, await run()); } catch (error) { show(label, { threw: (error as Error).constructor.name, message: (error as Error).message }); }
};
const run = (args: unknown) => Nzo(args as never, caller as never);

await attemptAsync('run.noSession', () => run({ text: 'hi' }));
for (const channel of ['iterm2', 'iterm2_with_bell', 'kitty', 'ghostty', 'terminal_bell', 'disabled', 'none', 'no_method_available', 'error', 'weird']) {
  const unbind = withSession(async () => channel);
  await attemptAsync(`run.channel.${channel}`, () => run({ text: 'hi' }));
  unbind();
}
{
  const unbind = withSession(async () => void 0);
  await attemptAsync('run.sessionUndefined', () => run({ text: 'hi' }));
  unbind();
}
{
  let calls = 0;
  const unbind = withSession(async () => (calls++, 'kitty'));
  await attemptAsync('run.counted', () => run({ text: 'hi' }));
  show('run.sessionCalls', calls);
  unbind();
}
{
  const seen: unknown[] = [];
  const unbind = withSession(async (request: unknown, origin: unknown) => (seen.push({ request, origin }), 'kitty'));
  await attemptAsync('run.requestAbsentTitle', () => run({ text: 'hi' }));
  await attemptAsync('run.requestWithStamp', async () => {
    const stamped = Fzo({ text: 'hi' }, caller);
    return run(stamped);
  });
  show('run.seen', seen);
  unbind();
}
{
  const unbind = withSession(async () => 'ghostty');
  await attemptAsync('raise.noTitle', () => raiseUiCall({ event: 'ui.notify', args: { text: 'hi' }, caller: caller as never }));
  await attemptAsync('raise.badTitle', () => raiseUiCall({ event: 'ui.notify', args: { text: 'hi', title: 7 }, caller: caller as never }));
  unbind();
}
