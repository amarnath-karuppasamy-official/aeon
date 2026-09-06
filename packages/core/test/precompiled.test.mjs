// AOT milestone 2's runtime half: getTemplate()'s fast path in dom.js.
// This is core, so it cannot depend on @aeon-framework/compiler — instead
// this test derives its precompiled fixture from the REAL compiler itself
// (dom.js's own internal __internal_compile, deep-imported exactly like
// @aeon-framework/mcp/compiler do) rather than hand-typing a `{html, parts}`
// object that could silently drift from what compile() actually produces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { html, render, signal } from '../src/index.js';
import { __internal_compile } from '../src/dom.js';

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

test('a strings array with __aeonPrecompiled renders via the fast path, byte-for-byte like compile()', () => {
  const count = signal(0);
  const quasis = ['<div class="counter"><p id="out">', '</p><button id="inc" @click=', '>+1</button></div>'];

  // Derive the precompiled fixture from the real compiler (not hand-typed).
  const { template, partDescriptors } = __internal_compile(quasis);
  const precompiled = { html: template.innerHTML, parts: partDescriptors };

  const precompiledStrings = Object.assign([...quasis], { __aeonPrecompiled: precompiled });
  const plainStrings = [...quasis]; // identical chunks, no fast-path marker — goes through compile()

  const containerFast = document.createElement('div');
  const containerPlain = document.createElement('div');

  const disposeFast = render(html(precompiledStrings, () => count.value, () => count.value++), containerFast);
  const disposePlain = render(html(plainStrings, () => count.value, () => count.value++), containerPlain);

  // Byte-for-byte identical initial render.
  assert.equal(containerFast.innerHTML, containerPlain.innerHTML);
  assert.equal(containerFast.querySelector('#out').textContent, '0');

  // Reactivity still works through the fast path: clicking updates the signal-bound part.
  containerFast.querySelector('#inc').click();
  assert.equal(containerFast.querySelector('#out').textContent, '1');

  containerPlain.querySelector('#inc').click();
  assert.equal(containerPlain.innerHTML, containerFast.innerHTML);

  disposeFast();
  disposePlain();
});

test('__internal_compile is reachable by deep-import (tooling contract) but not re-exported from the public index', async () => {
  // Guards the documented contract in dom.js's bottom comment: it's
  // reachable by tooling via a deep import of dom.js (as this file's other
  // test proves), but the package's public "." surface (index.js) never
  // advertises it.
  const domMod = await import('../src/dom.js');
  assert.equal(typeof domMod.__internal_compile, 'function');
  const indexMod = await import('../src/index.js');
  assert.equal(indexMod.__internal_compile, undefined);
});
