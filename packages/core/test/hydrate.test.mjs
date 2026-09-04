import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { html, render, hydrate, mount, hydrateComponent, signal, list } from '../src/index.js';

function installWindow() {
  const window = new Window();
  globalThis.window = window;
  globalThis.document = window.document;
  for (const key of ['Node', 'Element', 'HTMLElement', 'Event', 'CustomEvent', 'MouseEvent']) {
    if (key in window) {
      try {
        globalThis[key] = window[key];
      } catch {
        /* ignore */
      }
    }
  }
}

installWindow();

test('hydrate() adopts existing text/attribute DOM without recreating nodes', () => {
  function Counter() {
    const count = signal(0);
    return html`<div class="counter"><p id="out">${() => count.value}</p><button id="inc" @click=${() => count.value++}>+1</button></div>`;
  }

  // Server-side render into container A.
  const serverContainer = document.createElement('div');
  const serverDispose = mount(Counter, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  // Simulate a browser that already parsed the server HTML.
  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const pBefore = clientContainer.querySelector('#out');
  const buttonBefore = clientContainer.querySelector('#inc');
  assert.ok(pBefore && buttonBefore);
  assert.equal(pBefore.textContent, '0');

  const dispose = hydrateComponent(Counter, clientContainer);

  const pAfter = clientContainer.querySelector('#out');
  const buttonAfter = clientContainer.querySelector('#inc');
  // Identity check: hydration must not have destroyed/recreated these nodes.
  assert.equal(pAfter, pBefore);
  assert.equal(buttonAfter, buttonBefore);

  // Interactivity: the event listener attached by hydrate() actually fires.
  buttonAfter.click();
  assert.equal(clientContainer.querySelector('#out').textContent, '1');
  assert.equal(clientContainer.querySelector('#out'), pBefore); // still the same node

  dispose();
});

test('hydrate() adopts server-rendered list() rows without recreating their DOM nodes', () => {
  const items = signal([{ id: 1, label: 'a' }, { id: 2, label: 'b' }, { id: 3, label: 'c' }]);
  function List() {
    return html`<ul>${() => list(() => items.value, (i) => i.id, (i) => html`<li>${i.label}</li>`)}</ul>`;
  }
  const serverContainer = document.createElement('div');
  const serverDispose = mount(List, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const lisBefore = [...clientContainer.querySelectorAll('li')];
  assert.equal(lisBefore.length, 3);
  assert.deepEqual(lisBefore.map((li) => li.textContent), ['a', 'b', 'c']);

  const dispose = hydrateComponent(List, clientContainer);

  const lisAfter = [...clientContainer.querySelectorAll('li')];
  assert.equal(lisAfter.length, 3);
  // Node-identity check, same pattern as the non-list hydration test above:
  // hydration must have adopted these exact <li> elements, not torn them
  // down and re-rendered a fresh set.
  assert.equal(lisAfter[0], lisBefore[0]);
  assert.equal(lisAfter[1], lisBefore[1]);
  assert.equal(lisAfter[2], lisBefore[2]);

  dispose();
});

test('hydrate() + list(): adding an item after hydration appends a new row without disturbing the adopted rows', () => {
  const items = signal([{ id: 1, label: 'a' }, { id: 2, label: 'b' }]);
  function List() {
    return html`<ul>${() => list(() => items.value, (i) => i.id, (i) => html`<li>${i.label}</li>`)}</ul>`;
  }
  const serverContainer = document.createElement('div');
  const serverDispose = mount(List, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const adopted = [...clientContainer.querySelectorAll('li')];
  const dispose = hydrateComponent(List, clientContainer);

  items.value = [...items.value, { id: 3, label: 'c' }];

  const lis = [...clientContainer.querySelectorAll('li')];
  assert.equal(lis.length, 3);
  assert.deepEqual(lis.map((li) => li.textContent), ['a', 'b', 'c']);
  // The two original (server-rendered, hydration-adopted) rows are still
  // the exact same nodes — only the new row is actually new.
  assert.equal(lis[0], adopted[0]);
  assert.equal(lis[1], adopted[1]);

  dispose();
});

test('hydrate() + list(): removing an item after hydration removes only that row', () => {
  const items = signal([{ id: 1, label: 'a' }, { id: 2, label: 'b' }, { id: 3, label: 'c' }]);
  function List() {
    return html`<ul>${() => list(() => items.value, (i) => i.id, (i) => html`<li>${i.label}</li>`)}</ul>`;
  }
  const serverContainer = document.createElement('div');
  const serverDispose = mount(List, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const adopted = [...clientContainer.querySelectorAll('li')];
  const dispose = hydrateComponent(List, clientContainer);

  items.value = items.value.filter((i) => i.id !== 2);

  const lis = [...clientContainer.querySelectorAll('li')];
  assert.equal(lis.length, 2);
  assert.deepEqual(lis.map((li) => li.textContent), ['a', 'c']);
  assert.equal(lis[0], adopted[0]);
  assert.equal(lis[1], adopted[2]);
  // The removed row's node is actually gone from the document, not just
  // unlinked from the list's own bookkeeping.
  assert.equal(clientContainer.contains(adopted[1]), false);

  dispose();
});

test('hydrate() + list(): full round trip — SSR three items, hydrate, click-remove the middle one', () => {
  const items = signal([{ id: 1, label: 'a' }, { id: 2, label: 'b' }, { id: 3, label: 'c' }]);
  function remove(id) {
    items.value = items.value.filter((i) => i.id !== id);
  }
  function List() {
    return html`<ul>${() =>
      list(
        () => items.value,
        (i) => i.id,
        (i) => html`<li>${i.label}<button class="rm" @click=${() => remove(i.id)}>x</button></li>`
      )}</ul>`;
  }
  const serverContainer = document.createElement('div');
  const serverDispose = mount(List, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const adopted = [...clientContainer.querySelectorAll('li')];
  assert.equal(adopted.length, 3);

  const dispose = hydrateComponent(List, clientContainer);

  // The remove button hydration attached a real listener to the SAME
  // server-rendered <li> — clicking it must actually work.
  const middleButton = clientContainer.querySelectorAll('li')[1].querySelector('.rm');
  middleButton.click();

  const lis = [...clientContainer.querySelectorAll('li')];
  assert.equal(lis.length, 2);
  assert.deepEqual(lis.map((li) => li.firstChild.textContent), ['a', 'c']);
  // Items 1 and 3 are still the original server-rendered nodes.
  assert.equal(lis[0], adopted[0]);
  assert.equal(lis[1], adopted[2]);

  dispose();
});

test('hydrate() adopts a nested-template node-part and wires its own event listener', () => {
  const show = signal(true);
  const clicked = signal(0);
  function Toggle() {
    return html`<div>${() =>
      show.value
        ? html`<button id="a" @click=${() => clicked.value++}>A</button>`
        : html`<span id="b">B</span>`}</div>`;
  }
  const serverContainer = document.createElement('div');
  const serverDispose = mount(Toggle, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const buttonBefore = clientContainer.querySelector('#a');
  assert.ok(buttonBefore);

  const dispose = hydrateComponent(Toggle, clientContainer);
  const buttonAfter = clientContainer.querySelector('#a');
  assert.equal(buttonAfter, buttonBefore);
  buttonAfter.click();
  assert.equal(clicked.value, 1);
  dispose();
});
