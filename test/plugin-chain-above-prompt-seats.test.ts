import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  promptKeyHandlers,
  seatKey,
  useSeatChangeWatch,
  useSeatFocusIndex,
  useSeatRegistry,
  type FocusableSeat,
} from '../src/plugin-chain-above-prompt-seats.js';
import { runComponent, P, y } from '../src/plugin-chain-react-hooks.js';

test('the seat key joins plugin and element with a NUL', () => {
  assert.equal(seatKey('p', 'e'), 'p\u0000e');
  assert.notEqual(seatKey('p', 'a'), seatKey('p', 'b'));
});

test('the key handlers wrap next and previous and press the focused seat', () => {
  const seats: FocusableSeat[] = [
    { tag: 'Button', plugin: 'a', element: '1' },
    { tag: 'Input', plugin: 'b', element: '2' },
  ];
  const moves: number[] = [];
  const submitted: FocusableSeat[] = [];
  let index: number | null = 0;
  const handlers = promptKeyHandlers({
    focusables: seats,
    focusIndexNow: () => index,
    focusByPerson: (next) => { moves.push(next); },
    submit: (seat) => { submitted.push(seat); },
  });

  handlers['abovePrompt:next']();
  assert.deepEqual(moves, [1]);
  index = 1;
  handlers['abovePrompt:next']();
  assert.deepEqual(moves, [1, 0]);
  handlers['abovePrompt:previous']();
  assert.deepEqual(moves, [1, 0, 0]);
  index = 0;
  handlers['abovePrompt:previous']();
  assert.deepEqual(moves, [1, 0, 0, 1]);

  index = 1;
  handlers['abovePrompt:press']();
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0], seats[1]);

  index = null;
  handlers['abovePrompt:press']();
  assert.equal(submitted.length, 1);
});

test('the seat index callback reports a matching plugin and handle', () => {
  const seats: FocusableSeat[] = [
    { plugin: 'a', element: 'x' },
    { plugin: 'b', element: 'y' },
  ];
  const reported: number[] = [];
  let callback: ((seat: FocusableSeat) => void) | undefined;
  runComponent(() => {
    callback = useSeatFocusIndex(seats, (index) => { reported.push(index); });
  });
  assert.notEqual(callback, undefined);
  callback?.({ plugin: 'a', element: 'x' });
  callback?.({ plugin: 'b', element: 'y' });
  callback?.({ plugin: 'c', element: 'z' });
  assert.deepEqual(reported, [0, 1]);
});

test('the seat registry groups seats per plugin and unbinds one seat', () => {
  const { result } = runComponent(() => useSeatRegistry());
  const first = () => {};
  const second = () => {};
  const unbindFirst = result.reportSeat('a', first);
  result.reportSeat('a', second);
  result.reportSeat('b', first);
  assert.deepEqual([...(result.seatsOf('a') ?? [])], [first, second]);
  assert.deepEqual([...(result.seatsOf('b') ?? [])], [first]);
  unbindFirst();
  assert.deepEqual([...(result.seatsOf('a') ?? [])], [second]);
  assert.equal(result.seatsOf('missing'), undefined);
});

test('the seat change watch reports a value changed under the same key and tag', () => {
  const initial: FocusableSeat[] = [
    { tag: 'Select', plugin: 'a', element: 'x', value: 1 },
    { tag: 'Button', plugin: 'a', element: 'y', value: 1 },
  ];
  const next: FocusableSeat[] = [
    { tag: 'Select', plugin: 'a', element: 'x', value: 2 },
    { tag: 'Button', plugin: 'a', element: 'y', value: 2 },
  ];
  const reports: string[][] = [];
  runComponent(() => {
    const [seats, setSeats] = y(initial);
    P(() => {
      if (seats === initial) setSeats(next);
    }, [seats]);
    useSeatChangeWatch(seats, 'Select', (keys) => { reports.push(keys); });
  });
  assert.deepEqual(reports, [[seatKey('a', 'x')]]);
});

test('the change watch stays quiet when values are unchanged', () => {
  const initial: FocusableSeat[] = [{ tag: 'Select', plugin: 'a', element: 'x', value: 1 }];
  const next: FocusableSeat[] = [{ tag: 'Select', plugin: 'a', element: 'x', value: 1 }];
  const reports: string[][] = [];
  runComponent(() => {
    const [seats, setSeats] = y(initial);
    P(() => {
      if (seats === initial) setSeats(next);
    }, [seats]);
    useSeatChangeWatch(seats, 'Select', (keys) => { reports.push(keys); });
  });
  assert.deepEqual(reports, []);
});
