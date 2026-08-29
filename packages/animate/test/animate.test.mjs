import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { signal } from '@aeon-framework/core';
import { transition, animatedList } from '../src/index.js';

function installDom() {
  const window = new Window();
  globalThis.window = window;
  globalThis.document = window.document;
}
installDom();

test('transition.leave() keeps the element in the DOM during the leave window, resolves after duration', async () => {
  const el = document.createElement('div');
  document.body.appendChild(el);

  const p = transition.leave(el, { className: 'leaving', duration: 30 });
  // Class applied synchronously, element still attached — caller decides removal.
  assert.ok(el.classList.contains('leaving'));
  assert.ok(document.body.contains(el));

  // Still present shortly before the duration elapses.
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(document.body.contains(el));

  await p; // resolves via the deterministic timeout fallback (Happy DOM never fires transitionend)
  el.remove();
  assert.ok(!document.body.contains(el));
});

test('transition.enter() adds then removes the enter class, resolving after duration', async () => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const p = transition.enter(el, { className: 'entering', duration: 20 });
  // The class is applied synchronously before enter()'s first await, so it
  // must already be present the instant this call returns.
  assert.ok(el.classList.contains('entering'));
  await p;
  assert.ok(!el.classList.contains('entering'));
});

test('animatedList: a removed row stays in the DOM through its leave transition, then is removed', async () => {
  const container = document.createElement('ul');
  document.body.appendChild(container);
  const items = signal([
    { id: 1, label: 'a' },
    { id: 2, label: 'b' },
  ]);

  const stop = animatedList(container, {
    items: () => items.value,
    key: (i) => i.id,
    render: (i) => {
      const li = document.createElement('li');
      li.textContent = i.label;
      li.dataset.id = String(i.id);
      return li;
    },
    duration: 30,
  });

  assert.equal(container.querySelectorAll('li').length, 2);

  // Remove row id=1, keep the same item object for id=2 (unchanged reference).
  const kept = items.value.find((i) => i.id === 2);
  items.value = [kept];

  // Still 2 rows immediately — the departing row is mid-leave-transition, not yet removed.
  const rowsDuring = container.querySelectorAll('li');
  assert.equal(rowsDuring.length, 2);
  const leavingRow = [...rowsDuring].find((li) => li.dataset.id === '1');
  assert.ok(leavingRow, 'departing row is still in the DOM');
  assert.ok(leavingRow.classList.contains('aeon-leave'));

  await new Promise((r) => setTimeout(r, 60));

  const rowsAfter = container.querySelectorAll('li');
  assert.equal(rowsAfter.length, 1);
  assert.equal(rowsAfter[0].dataset.id, '2');

  stop();
});

test('animatedList: a newly-added row is inserted immediately and gets the enter class', async () => {
  const container = document.createElement('ul');
  document.body.appendChild(container);
  const items = signal([{ id: 1, label: 'a' }]);

  const stop = animatedList(container, {
    items: () => items.value,
    key: (i) => i.id,
    render: (i) => {
      const li = document.createElement('li');
      li.textContent = i.label;
      li.dataset.id = String(i.id);
      return li;
    },
    duration: 30,
  });

  items.value = [...items.value, { id: 2, label: 'b' }];
  const rows = container.querySelectorAll('li');
  assert.equal(rows.length, 2);
  const newRow = [...rows].find((li) => li.dataset.id === '2');
  assert.ok(newRow);
  // Enter class applied synchronously before its first-tick removal.
  assert.ok(newRow.classList.contains('aeon-enter'));

  await new Promise((r) => setTimeout(r, 60));
  assert.ok(!container.querySelector('[data-id="2"]').classList.contains('aeon-enter'));

  stop();
});
