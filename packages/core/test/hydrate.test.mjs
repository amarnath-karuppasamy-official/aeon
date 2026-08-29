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

test('hydrate() falls back to a fresh client render for list()-bound regions', () => {
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
  const dispose = hydrateComponent(List, clientContainer);
  const lis = clientContainer.querySelectorAll('li');
  assert.equal(lis.length, 2);
  assert.equal(lis[0].textContent, 'a');
  assert.equal(lis[1].textContent, 'b');

  items.value = [...items.value, { id: 3, label: 'c' }];
  assert.equal(clientContainer.querySelectorAll('li').length, 3);
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
