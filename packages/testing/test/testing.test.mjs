import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signal, html } from '@aeon-framework/core';
import { render, cleanup, fireEvent } from '../src/index.js';

function Counter() {
  const count = signal(0);
  return html`
    <p id="count">${() => count.value}</p>
    <button id="inc" @click=${() => count.value++}>+1</button>
  `;
}

function NameForm() {
  const name = signal('');
  return html`
    <input id="name" @input=${(e) => { name.value = e.target.value; }} />
    <p id="greeting">${() => (name.value ? `Hello, ${name.value}` : 'Say your name')}</p>
  `;
}

test.afterEach(() => cleanup());

test('render() mounts a real component and find() queries it', async () => {
  const { find } = await render(Counter);
  assert.equal(find('#count').textContent, '0');
});

test('fireEvent.click() triggers the handler and the DOM updates synchronously', async () => {
  const { find } = await render(Counter);
  fireEvent.click(find('#inc'));
  assert.equal(find('#count').textContent, '1');
  fireEvent.click(find('#inc'));
  fireEvent.click(find('#inc'));
  assert.equal(find('#count').textContent, '3');
});

test('fireEvent.input() with a target value drives a bound input', async () => {
  const { find } = await render(NameForm);
  assert.equal(find('#greeting').textContent, 'Say your name');
  fireEvent.input(find('#name'), { target: { value: 'Ada' } });
  assert.equal(find('#greeting').textContent, 'Hello, Ada');
});

test('unmount() removes the container and stops reacting', async () => {
  const { find, container, unmount } = await render(Counter);
  assert.ok(container.isConnected);
  unmount();
  assert.equal(container.isConnected, false);
});

test('cleanup() unmounts everything rendered so far', async () => {
  const a = await render(Counter);
  const b = await render(Counter);
  assert.ok(a.container.isConnected && b.container.isConnected);
  cleanup();
  assert.equal(a.container.isConnected, false);
  assert.equal(b.container.isConnected, false);
});
