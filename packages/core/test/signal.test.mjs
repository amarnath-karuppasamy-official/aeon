import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signal, computed, effect, batch } from '../src/signal.js';

test('signal read/write and change notification', () => {
  const count = signal(1);
  let seen = [];
  effect(() => seen.push(count.value));
  assert.deepEqual(seen, [1]);
  count.value = 2;
  assert.deepEqual(seen, [1, 2]);
  count.value = 2; // no-op, same value
  assert.deepEqual(seen, [1, 2]);
});

test('computed recomputes from dependencies', () => {
  const a = signal(2);
  const b = signal(3);
  const sum = computed(() => a.value + b.value);
  assert.equal(sum.value, 5);
  a.value = 10;
  assert.equal(sum.value, 13);
});

test('effect only reruns for signals actually read (fine-grained)', () => {
  const a = signal(1);
  const b = signal(100);
  let runs = 0;
  effect(() => {
    runs++;
    void a.value; // only depends on a
  });
  assert.equal(runs, 1);
  b.value = 200; // unrelated signal
  assert.equal(runs, 1);
  a.value = 2;
  assert.equal(runs, 2);
});

test('batch coalesces multiple writes into one effect run', () => {
  const a = signal(1);
  const b = signal(2);
  let runs = 0;
  effect(() => {
    runs++;
    void a.value;
    void b.value;
  });
  assert.equal(runs, 1);
  batch(() => {
    a.value = 10;
    b.value = 20;
  });
  assert.equal(runs, 2);
});

test('effect stop() prevents further reruns', () => {
  const a = signal(1);
  let runs = 0;
  const stop = effect(() => {
    runs++;
    void a.value;
  });
  stop();
  a.value = 2;
  assert.equal(runs, 1);
});

test('update() applies a reducer', () => {
  const count = signal(1);
  count.update((v) => v + 41);
  assert.equal(count.value, 42);
});
