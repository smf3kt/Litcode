import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DIGIT_CONFIRM_DEBOUNCE_MS,
  DIGIT_HINT_MAP,
  DIGIT_MOUNT_DELAY_MS,
  DUE_WINDOW_LONG_MS,
  DUE_WINDOW_MS,
  clockNow,
  digitHint,
  dueWithin,
  systemNow,
  usePromptDigitConfirm,
} from '../src/plugin-chain-above-prompt-input.js';
import { PromptClock } from '../src/plugin-chain-above-prompt-input-host.js';
import { runComponent, P, y } from '../src/plugin-chain-react-hooks.js';
import { eE, type MarkdownClock } from '../src/plugin-chain-markdown-host.js';
import { u, type KeybindingService } from '../src/plugin-chain-press-button-host.js';

interface FakeClock extends MarkdownClock {
  timers: { fn: () => void; ms: number; cancelled: boolean }[];
  nowValue: number;
}

function fakeClock(nowValue = 0): FakeClock {
  const timers: FakeClock['timers'] = [];
  return {
    timers,
    nowValue,
    now: () => nowValue,
    setTimeout: (fn, ms) => {
      const timer = { fn, ms, cancelled: false };
      timers.push(timer);
      return () => { timer.cancelled = true; };
    },
  };
}

test('the digit hints map the input method characters and normalize the rest', () => {
  assert.equal(DIGIT_HINT_MAP.get('&'), '1');
  assert.equal(DIGIT_HINT_MAP.get('\xE9'), '2');
  assert.equal(DIGIT_HINT_MAP.get('-'), '6');
  assert.equal(DIGIT_HINT_MAP.get('\xA7'), '6');
  assert.equal(DIGIT_HINT_MAP.get('\xE0'), '0');
  assert.equal(digitHint('&'), '1');
  assert.equal(digitHint('１'), '1');
  assert.equal(digitHint('ｖ'), 'v');
  assert.equal(DIGIT_CONFIRM_DEBOUNCE_MS, 400);
  assert.equal(DIGIT_MOUNT_DELAY_MS, 600);
  assert.equal(DUE_WINDOW_MS, 150);
  assert.equal(DUE_WINDOW_LONG_MS, 250);
});

test('the due window accepts recent and not-yet-reached starts', () => {
  let now = 1000;
  assert.equal(dueWithin(() => now, 900), true);
  assert.equal(dueWithin(() => now, 800), false);
  assert.equal(dueWithin(() => now, 1100), true);
  assert.equal(dueWithin(() => now, Date.now() + 100_000), false);
  const real = Date.now();
  assert.equal(dueWithin(() => real - 10, real, 150), true);
});

test('the clock function comes from the context or falls back to the system clock', () => {
  assert.equal(typeof clockNow(), 'function');
  assert.equal(systemNow() > 0, true);
  const mounted = () => 42;
  const { result } = runComponent(() => clockNow(), { contexts: new Map([[PromptClock, mounted]]) });
  assert.equal(result, mounted);
  assert.equal(result(), 42);
});

type PreDispatch = (key: string, event: Record<string, unknown>, context: unknown) => boolean | undefined;

function mountPrompt(options: {
  value: string;
  setTo?: string;
  clock?: FakeClock;
  resolveAction?: string;
  once?: boolean;
  mountDelayMs?: number;
}): {
  onDigits: string[];
  handler: () => PreDispatch;
  clock: FakeClock;
  run: ReturnType<typeof runComponent>;
} {
  const clock = options.clock ?? fakeClock(10_000);
  const onDigits: string[] = [];
  let handler: PreDispatch | undefined;
  const service = {
    registerPreDispatch: (registration: { handler: PreDispatch }) => {
      handler = registration.handler;
      return () => { handler = undefined; };
    },
    resolve: () => options.resolveAction === undefined
      ? { type: 'no-match' }
      : { type: 'match', action: options.resolveAction },
    activeContexts: [] as string[],
    bindings: [] as unknown[],
  } as unknown as KeybindingService;
  const run = runComponent(() => {
    const [value, setValue] = y(options.value);
    P(() => {
      if (value === options.value && options.setTo !== undefined) setValue(options.setTo);
    }, [value]);
    usePromptDigitConfirm({
      inputValue: value as string,
      isValidDigit: (character) => /^[0-9]$/.test(character),
      onDigit: (digit) => { onDigits.push(digit); },
      enabled: true,
      once: options.once,
      mountDelayMs: options.mountDelayMs ?? 0,
      debounceMs: 10,
    });
  }, { contexts: new Map<unknown, unknown>([[eE, clock], [u, service]]) });
  return {
    onDigits,
    clock,
    run,
    handler: () => {
      if (handler === undefined) throw new Error('no pre-dispatch handler registered');
      return handler;
    },
  };
}

test('Enter confirms a hinted digit when the key resolves to chat:submit', () => {
  const mounted = mountPrompt({ value: '', setTo: '&', resolveAction: 'chat:submit' });
  const handler = mounted.handler();
  assert.equal(handler('Return', { return: true }, {}), true);
  assert.deepEqual(mounted.onDigits, ['1']);
});

test('Enter does not confirm when the key does not resolve to chat:submit', () => {
  const mounted = mountPrompt({ value: '', setTo: '1' });
  assert.equal(mounted.handler()('Return', { return: true }, {}), undefined);
  assert.deepEqual(mounted.onDigits, []);
});

test('Enter ignores a multi-character input and a mount window still running', () => {
  const multi = mountPrompt({ value: '', setTo: '12', resolveAction: 'chat:submit' });
  assert.equal(multi.handler()('Return', { return: true }, {}), undefined);
  assert.deepEqual(multi.onDigits, []);

  const fresh = mountPrompt({ value: '', setTo: '1', mountDelayMs: 600, resolveAction: 'chat:submit', clock: fakeClock(Date.now()) });
  assert.equal(fresh.handler()('Return', { return: true }, {}), undefined);
  assert.deepEqual(fresh.onDigits, []);
});

test('once consumes the confirmation after the first digit', () => {
  const mounted = mountPrompt({ value: '', setTo: '1', once: true, resolveAction: 'chat:submit' });
  const handler = mounted.handler();
  assert.equal(handler('Return', { return: true }, {}), true);
  assert.equal(handler('Return', { return: true }, {}), undefined);
  assert.deepEqual(mounted.onDigits, ['1']);
});

test('the debounce confirms one valid digit after the input changes', () => {
  const mounted = mountPrompt({ value: '', setTo: '5' });
  assert.equal(mounted.onDigits.length, 0);
  const timer = mounted.clock.timers.find((entry) => !entry.cancelled);
  assert.notEqual(timer, undefined);
  assert.equal(timer?.ms, 10);
  timer?.fn();
  assert.deepEqual(mounted.onDigits, ['5']);
});

test('unmount cancels a pending debounce timer', () => {
  const mounted = mountPrompt({ value: '', setTo: '7' });
  const timer = mounted.clock.timers.find((entry) => !entry.cancelled);
  assert.notEqual(timer, undefined);
  mounted.run.unmount();
  assert.equal(timer?.cancelled, true);
});
