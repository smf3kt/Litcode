import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {ga} from '../src/plugin-chain-entry.js';
import {Ka, jo, pwr, qi, ze} from '../src/plugin-chain-source.js';
import {promptEditChain} from '../src/plugin-chain-registry.js';
import {Wde, chainRecords, classicHookEvents, clearChainRecords, eventCatalog, glt, installChainModule, it} from '../src/plugin-chain-host.js';
import {HOOK_EVENTS} from '../src/hooks.js';
import type {ChainHandler, ChainModule} from '../src/plugin-chain-types.js';

// The runner is copied verbatim from the recovered CLI; these tests drive it the way the recovered
// call sites do — through `ga(name, ctx)(event)` with a site, an installed core and handlers that
// were installed as modules. Sources: research/ports/W45-chain-runner.md.

const ORIGIN = Object.freeze([Object.freeze({kind: 'composer'})]);

/** A prompt.edit event as the composer raises it: a draft, the span a rewrite replaces, its text. */
function draftEvent(over: Record<string, unknown> = {}) {
  const text = String(over.text ?? 'hello world');
  return {
    text,
    cursor: text.length,
    start: 6,
    end: 11,
    inputText: 'there',
    origin: ORIGIN,
    key: 'draft-1',
    ...over,
  };
}

/** One handler installed as a module, so `P0`/`jDe` collect it the way they collect a plugin. */
function moduleWith(handler: ChainHandler): ChainModule {
  return {
    name: handler.name,
    // A module answers at the tier its record declares; `Ee` falls back to `user` when it does not.
    tier: handler.tier,
    hooks: (event: string) => event === 'prompt.edit',
    record: () => handler,
  };
}

function core(): ChainHandler {
  return promptEditChain.core as ChainHandler;
}

test('chain runner: handlers run in install order above the core, and the trail reads back frozen', async () => {
  const calls: string[] = [];
  const first: ChainHandler = {
    name: 'first',
    tier: 'user',
    run: async (e: unknown, next: any) => {
      calls.push('first');
      return {...(await next(e)), tag: 'first'};
    },
  };
  const second: ChainHandler = {
    name: 'second',
    tier: 'user',
    run: async (e: unknown, next: any) => {
      calls.push('second');
      return {...(await next(e)), tag: 'second'};
    },
  };
  const remove = [installChainModule(moduleWith(first)), installChainModule(moduleWith(second))];
  clearChainRecords();
  let trail: readonly any[] = [];
  try {
    const answer: any = await ga('prompt.edit', {
      core: {'prompt.edit': core()},
      trace: (t: readonly any[]) => (trail = t),
    })(draftEvent());
    assert.deepEqual(calls, ['first', 'second']);
    // The core is `cze`: the raised inputText spliced over [start,end), the cursor after it.
    assert.equal(answer.text, 'hello there');
    assert.equal(answer.cursor, 11);
    // Each handler above it kept its own tag, so the answer came back up the whole chain.
    assert.equal(answer.tag, 'first');
    assert.deepEqual(
      trail.map((t) => [t.index, t.plugin, t.tier, t.outcome]),
      [
        [0, 'first', 'user', 'returned'],
        [1, 'second', 'user', 'returned'],
        [2, 'engine', 'core', 'returned'],
      ],
    );
    assert.ok(Object.isFrozen(trail), 'the trail is frozen when it is read back');
    assert.equal(trail[2]!.returned.text, 'hello there');
  } finally {
    for (const off of remove) off();
  }
});

test('chain runner: next.to("core") from a prepend handler skips the tiers below it', async () => {
  const calls: string[] = [];
  const skipper: ChainHandler = {
    name: 'skipper',
    tier: 'prepend',
    run: async (e: unknown, next: any) => {
      calls.push('skipper');
      return next.to(e, ['core']);
    },
  };
  const skipped: ChainHandler = {
    name: 'skipped',
    tier: 'user',
    run: async (e: unknown, next: any) => {
      calls.push('skipped');
      return next(e);
    },
  };
  const remove = [installChainModule(moduleWith(skipper)), installChainModule(moduleWith(skipped))];
  clearChainRecords();
  let trail: readonly any[] = [];
  try {
    const answer: any = await ga('prompt.edit', {
      core: {'prompt.edit': core()},
      trace: (t: readonly any[]) => (trail = t),
    })(draftEvent());
    assert.deepEqual(calls, ['skipper'], 'the user-tier handler never ran');
    assert.equal(answer.text, 'hello there');
    const entry = trail.find((t) => t.plugin === 'skipped');
    assert.equal(entry.outcome, 'skipped');
    assert.equal(entry.reason, 'bypassed by skipper');
    assert.equal(entry.ms, 0);
    const logged = chainRecords().map((r: any) => r.message);
    assert.ok(
      logged.includes('skipped: prompt.edit bypassed by skipper (tier user); beneath runs'),
      `bypass is reported: ${JSON.stringify(logged)}`,
    );
  } finally {
    for (const off of remove) off();
  }
});

test('chain runner: a handler that overruns its budget is skipped and the answer comes from below', async () => {
  const slow: ChainHandler = {
    name: 'slow',
    tier: 'user',
    budgetMs: 10,
    run: async (e: unknown, next: any) => {
      await delay(60);
      return {...(await next(e)), tag: 'slow'};
    },
  };
  const remove = [installChainModule(moduleWith(slow))];
  clearChainRecords();
  try {
    const answer: any = await ga('prompt.edit', {core: {'prompt.edit': core()}})(draftEvent());
    assert.equal(answer.tag, undefined, 'the slow answer did not stand');
    assert.equal(answer.text, 'hello there', 'what ran beneath it stands');
    const records = chainRecords() as any[];
    assert.ok(
      records.some((r) => r.skip?.why === 'ran past its 10ms budget' && r.skip?.kind === 'budget'),
      `budget cause is reported: ${JSON.stringify(records.map((r) => r.skip ?? r.message ?? r.reason))}`,
    );
    assert.ok(
      records.some((r) => r.effect === 'skipped; what is below it ran in its place'),
      'the hook failure is reported as skipped',
    );
  } finally {
    for (const off of remove) off();
  }
});

test('chain runner: aborting the call rejects without reporting a hook failure', async () => {
  const controller = new AbortController();
  const waiting: ChainHandler = {
    name: 'waiting',
    tier: 'user',
    run: async (e: unknown, next: any) => {
      // Waits on the signal the runner hands it, so the abort reaches this handler the way it
      // reaches a plugin that respects the budget it was given.
      await delay(500, undefined, {signal: next.signal});
      return next(e);
    },
  };
  const remove = [installChainModule(moduleWith(waiting))];
  clearChainRecords();
  try {
    const called = ga('prompt.edit', {core: {'prompt.edit': core()}, signal: controller.signal})(draftEvent());
    setTimeout(() => controller.abort(new Error('the person pressed stop')), 5);
    await assert.rejects(called);
    const failed = (chainRecords() as any[]).filter((r) => typeof r.message === 'string' && r.message.includes('hooks chain failed'));
    assert.deepEqual(failed, [], 'an aborted chain is not logged as a failure');
  } finally {
    for (const off of remove) off();
  }
});

test('chain runner: a name with no core rejects with the source message', async () => {
  await assert.rejects(
    ga('session.end', {})({text: 'x'}),
    (error: any) => {
      assert.equal(error.name, 'HooksError');
      assert.equal(
        error.message,
        '$.session.end: no core at the bottom of the chain (the site did not install one and the call supplied none)',
      );
      return true;
    },
  );
});

test('chain runner: the copied pieces keep their own contracts', async () => {
  // `Wde` matches an event against the pattern forms the source accepts.
  assert.equal(Wde('prompt.edit', 'prompt.edit'), true);
  assert.equal(Wde('prompt.*', 'prompt.edit'), true);
  assert.equal(Wde('prompt.*', 'promptedit'), false);
  assert.equal(Wde('!prompt.edit', 'prompt.edit'), false);
  assert.equal(Wde('!prompt.edit', 'tool.call'), true);
  assert.equal(Wde('*', 'anything.at.all'), true);
  assert.throws(() => Wde('!*', 'prompt.edit'), /"!\*" is not a pattern: it selects no event/);

  // `ze` describes an error by kind and length, and `He` keeps its thrown name.
  class Custom extends Error {
    override name = 'CustomFailure';
  }
  assert.equal(ze(new Custom('boom')), 'errorKind=CustomFailure errorChars=4');
  assert.equal(ze('not an error'), 'errorKind=unknown errorChars=12');

  // `jo` hands back the frozen empty trail when nothing was recorded.
  assert.deepEqual(jo({}), []);
  assert.ok(Object.isFrozen(jo({})));

  // `pwr` reads the reason off the signal and `Ka` races a promise against it, throwing whatever
  // the factory makes. Both are copied bodies (chunk-nyce03br.js, chunk-yjc18bey.js).
  const aborted = new AbortController();
  const stopping = new Error('the person pressed stop');
  aborted.abort(stopping);
  assert.equal(pwr(aborted.signal), stopping, 'an aborted signal keeps the reason it was given');
  assert.equal((pwr(AbortSignal.timeout(50)) as Error).name, 'HooksError', 'a signal with no error reason reads as the hooks error');
  await Ka(Promise.resolve('answered'), aborted.signal, () => 'from the factory').then(
    () => assert.fail('the race must reject once the signal is aborted'),
    (thrown: unknown) => assert.equal(thrown, 'from the factory'),
  );
});

test('chain registry: prompt.edit is wired to the copied site and core', () => {
  assert.equal(promptEditChain.site, qi, 'the chain site is the copied prompt.edit site');
  assert.equal((promptEditChain.site as any).event, 'prompt.edit');
  assert.equal((promptEditChain.site as any).budgetMs, 50);
  assert.equal((promptEditChain.core as any).name, 'core');
  assert.equal((promptEditChain.core as any).isCore, true);
  assert.equal((promptEditChain.core as any).budgetMs, 0);
});

test('chain collection: the copied `only` filter decides which modules answer', async () => {
  const calls: string[] = [];
  const one = moduleWith({
    name: 'one',
    tier: 'user',
    run: async (e: unknown, next: any) => {
      calls.push('one');
      return next(e);
    },
  });
  const two = moduleWith({
    name: 'two',
    tier: 'append',
    run: async (e: unknown, next: any) => {
      calls.push('two');
      return next(e);
    },
  });
  const remove = [installChainModule(one), installChainModule(two)];
  try {
    clearChainRecords();
    await ga('prompt.edit', {core: {'prompt.edit': core()}, only: 'two'})(draftEvent());
    assert.deepEqual(calls, ['two'], '`only` collects one module by name');

    calls.length = 0;
    await ga('prompt.edit', {core: {'prompt.edit': core()}})(draftEvent());
    assert.deepEqual(calls, ['one', 'two'], 'without `only` every installed module is collected in install order');
    const logged = chainRecords().map((r: any) => r.message).filter(Boolean);
    assert.ok(
      logged.some((m: string) => m.startsWith('hooks module one prompt.edit settled in')),
      `the record runner reports the hop it came from: ${JSON.stringify(logged)}`,
    );
  } finally {
    for (const off of remove) off();
  }
});

test('chain collection: a module with no tier answers at the user seat', async () => {
  const seats: string[] = [];
  const remove = installChainModule({
    name: 'seatless',
    hooks: (event: string) => event === 'prompt.edit',
    record: () =>
      ({
        name: 'seatless',
        budgetMs: 0,
        run: async (e: unknown, next: any) => {
          seats.push('ran');
          return next(e);
        },
      }) as ChainHandler,
  });
  try {
    clearChainRecords();
    const answer: any = await ga('prompt.edit', {core: {'prompt.edit': core()}})(draftEvent());
    assert.equal(answer.text, 'hello there');
    assert.deepEqual(seats, ['ran'], 'the seatless module was collected and ran');
  } finally {
    remove();
  }
});

// The hook surface a declared pattern list answers with is the source's own `wGt` (chunk-sfn1dbxq.js
// [1829052,1829624)), and the install check over those declarations is `iWt`'s second half
// (chunk-sfn1dbxq.js [1684913,1685296)) over the copied catalog. Both arrived with W45-4.

test('declared patterns: a module answers exactly the events its patterns select', async () => {
  const ran: string[] = [];
  const remove = installChainModule({
    name: 'patterns',
    tier: 'user',
    patterns: [{pattern: 'prompt.*'}, {pattern: '!prompt.submit'}],
    hooks: (event: string) => event === 'prompt.edit',
    record: () =>
      ({
        name: 'patterns',
        budgetMs: 0,
        run: async (e: unknown, next: any) => {
          ran.push('ran');
          return next(e);
        },
      }) as ChainHandler,
  });
  try {
    clearChainRecords();
    // `prompt.*` selects prompt.edit, so the module answers for it.
    const edit: any = await ga('prompt.edit', {core: {'prompt.edit': core()}})(draftEvent());
    assert.equal(edit.text, 'hello there');
    assert.deepEqual(ran, ['ran'], 'the wildcard pattern selected prompt.edit');
  } finally {
    remove();
  }
});

test('declared patterns: a negated pattern keeps the module off that event', async () => {
  const ran: string[] = [];
  const remove = installChainModule({
    name: 'negative',
    tier: 'user',
    patterns: [{pattern: '!prompt.edit'}, {pattern: 'tool.call'}],
    hooks: (event: string) => event === 'prompt.edit',
    record: () =>
      ({
        name: 'negative',
        budgetMs: 0,
        run: async (e: unknown, next: any) => {
          ran.push('ran');
          return next(e);
        },
      }) as ChainHandler,
  });
  try {
    clearChainRecords();
    const edit: any = await ga('prompt.edit', {core: {'prompt.edit': core()}})(draftEvent());
    assert.equal(edit.text, 'hello there', 'the core answered');
    assert.deepEqual(ran, [], 'the negated pattern kept the module out of this event');
  } finally {
    remove();
  }
});

test('declared patterns: the catalog decides whether a registered event exists', () => {
  // `iWt`'s message, verbatim: the event is not one the catalog knows, and `Z$n` cannot rescue it.
  assert.throws(
    () => installChainModule({
      name: 'typo',
      patterns: [{pattern: 'prompt.edti'}],
      hooks: () => true,
      record: () => ({name: 'typo', budgetMs: 0, run: async (e: unknown, next: any) => next(e)}) as ChainHandler,
    }),
    (error: Error) => error.message === 'typo: registered "prompt.edti", which is not an event',
  );
  // `Awr`'s message, verbatim: the string is not an event name or a pattern at all.
  assert.throws(
    () => installChainModule({
      name: 'broken',
      patterns: [{pattern: '!!prompt.edit'}],
      hooks: () => true,
      record: () => ({name: 'broken', budgetMs: 0, run: async (e: unknown, next: any) => next(e)}) as ChainHandler,
    }),
    (error: Error) => error.message === 'broken: registered "!!prompt.edit" is not a pattern: "!" negates once',
  );
});

test('declared patterns: a classic hook name is an event, and the patterns list is deduped', () => {
  const remove = installChainModule({
    name: 'classic',
    patterns: [{pattern: 'classic.PreToolUse'}, {pattern: 'classic.PreToolUse'}],
    hooks: () => true,
    record: () => ({name: 'classic', budgetMs: 0, run: async (e: unknown, next: any) => next(e)}) as ChainHandler,
  });
  try {
    const {loadedModules} = it();
    const record = loadedModules.find((entry) => entry.name === 'classic');
    assert.deepEqual(record?.patterns, ['classic.PreToolUse'], 'the declaration list comes back deduped');
    assert.equal(record?.hooks('classic.PreToolUse'), true);
    assert.equal(record?.hooks('classic.PostToolUse'), false, 'and it selects only what it names');
  } finally {
    remove();
  }
});

test('declared patterns: a matcher on a pattern comes back through the records matcherFor', () => {
  const matcher = {mode: 'args'};
  const remove = installChainModule({
    name: 'matched',
    patterns: [{pattern: 'tool.call', matcher}],
    hooks: () => true,
    record: () => ({name: 'matched', budgetMs: 0, run: async (e: unknown, next: any) => next(e)}) as ChainHandler,
  });
  try {
    const {loadedModules} = it();
    const record = loadedModules.find((entry) => entry.name === 'matched');
    assert.deepEqual(record?.matcherFor('tool.call'), matcher, 'the matcher the declaration carried');
    // `registrationsFor` is `wGt`'s `s`: the indices of the declarations that select the event.
    assert.deepEqual(record?.registrationsFor('tool.call'), [0]);
  } finally {
    remove();
  }
});

test('event catalog: the copied classic roster is the product hook inventory, event for event', () => {
  // The catalog's classic half is `xp` from chunk-3cynezh1.js; `src/hooks.ts` keeps the product's own
  // inventory of the same lifecycle events. The two are independent records of one roster, so a
  // divergence means a stale copy or a product event the source's catalog does not carry.
  const catalog = new Set(classicHookEvents);
  const product = new Set<string>(HOOK_EVENTS);
  assert.deepEqual(
    [...product].filter((event) => !catalog.has(event)), [],
    'every product hook event is in the copied catalog',
  );
  assert.deepEqual(
    [...catalog].filter((event) => !product.has(event)), [],
    'the copied classic roster carries no event the product does not know',
  );
  assert.equal(catalog.size, 33);
  // And the catalog's `classic.` entries are exactly that roster.
  assert.deepEqual(
    new Set(eventCatalog.filter((e) => e.startsWith('classic.')).map((e) => e.slice('classic.'.length))),
    catalog,
  );
});

test('tier order: the copied table is the source order, and an unknown tier is outside it', () => {
  // `glt` is `ry.indexOf(tier)` over the copied `ry` (chunk-m4qpskd4.js [48162,48272)). The chain
  // reads it for continuations and floors, so the order is load-bearing: prepend is the outermost
  // seat and core the innermost, and a name the table does not carry answers -1 rather than a seat.
  assert.deepEqual(
    ['prepend', 'user', 'append', 'builtin', 'core'].map(glt),
    [0, 1, 2, 3, 4],
  );
  assert.equal(glt('nonsense'), -1);
});
