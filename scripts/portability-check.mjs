// Proves the reactive core has zero DOM/browser dependency: no `window`,
// no `document` in this process at all, yet signals/computed/effect/batch
// all work — usable in a CLI tool, a server, a test runner, anywhere JS runs.
import assert from 'node:assert/strict';
import { signal, computed, effect, batch } from '../packages/core/src/signal.js';

assert.equal(typeof globalThis.window, 'undefined', 'expected no window in this runtime');
assert.equal(typeof globalThis.document, 'undefined', 'expected no document in this runtime');

const count = signal(1);
const doubled = computed(() => count.value * 2);
let seen = [];
effect(() => seen.push(doubled.value));
count.value = 5;
batch(() => { count.value = 10; count.value = 20; });

assert.deepEqual(seen, [2, 10, 40]);

console.log(`OK on ${typeof Bun !== 'undefined' ? 'Bun ' + Bun.version : 'Node ' + process.version} — no window/document present, signals still work. seen=${JSON.stringify(seen)}`);
