import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '@aeon-framework/testing';
import { signal } from '@aeon-framework/core';
import { createRegistry, mountDevtoolsOverlay, attachDevtools } from '../src/index.js';

await setupDom();

test('mountDevtoolsOverlay() renders a tracked signal and updates in real time when it changes', async () => {
  const registry = createRegistry();
  const count = signal(0);
  registry.track('count', count);

  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = mountDevtoolsOverlay(container, registry);

  const row = container.querySelector('[data-name="count"] .aeon-devtools-value');
  assert.ok(row, 'tracked signal row is rendered');
  assert.equal(row.textContent, '0');

  count.value = 42;
  assert.equal(container.querySelector('[data-name="count"] .aeon-devtools-value').textContent, '42');

  count.value = 43;
  assert.equal(container.querySelector('[data-name="count"] .aeon-devtools-value').textContent, '43');

  dispose();
  container.remove();
});

test('mountDevtoolsOverlay() reflects tracking a second signal after mount, and untrack() removes a row', async () => {
  const registry = createRegistry();
  const a = signal('hello');
  registry.track('a', a);

  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = mountDevtoolsOverlay(container, registry);

  assert.equal(container.querySelectorAll('.aeon-devtools-row').length, 1);

  const b = signal({ nested: true });
  registry.track('b', b);
  assert.equal(container.querySelectorAll('.aeon-devtools-row').length, 2);
  assert.equal(container.querySelector('[data-name="b"] .aeon-devtools-value').textContent, JSON.stringify({ nested: true }));

  registry.untrack('a');
  assert.equal(container.querySelectorAll('.aeon-devtools-row').length, 1);
  assert.equal(container.querySelector('[data-name="a"]'), null);

  dispose();
  container.remove();
});

test('attachDevtools() mounts hidden into document.body and toggles on the configured hotkey', async () => {
  const count = signal(7);
  const attached = attachDevtools({ hotkey: 'F2' });
  attached.registry.track('count', count);

  const overlay = document.querySelector('.aeon-devtools-overlay');
  assert.ok(overlay, 'overlay is mounted into document.body');
  assert.equal(overlay.parentElement.style.display, 'none');

  window.dispatchEvent(new Event('keydown', { bubbles: true }));
  // A plain Event has no `.key`; simulate via a KeyboardEvent-shaped object instead.
  const evt = new (globalThis.KeyboardEvent || Event)('keydown');
  Object.defineProperty(evt, 'key', { value: 'F2' });
  window.dispatchEvent(evt);

  assert.equal(document.querySelector('.aeon-devtools-overlay').parentElement.style.display, 'block');
  assert.equal(document.querySelector('[data-name="count"] .aeon-devtools-value').textContent, '7');

  attached.destroy();
  assert.equal(document.querySelector('.aeon-devtools-overlay'), null);
});
