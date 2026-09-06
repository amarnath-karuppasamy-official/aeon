import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { precompileTemplate } from '../src/precompile.js';

// compile() needs a real `document` (it does
// `document.createElement('template')` + `.innerHTML` parsing). Install the
// same throwaway happy-dom window precompile.js itself installs, so calling
// the real compile() directly here (for cross-checking, below) works
// regardless of call order relative to precompileTemplate().
const _window = new Window({ url: 'http://localhost/' });
globalThis.window = _window;
globalThis.document = _window.document;

// Cross-check every fixture against the REAL runtime compile() (the exact
// same deep-import trick precompile.js itself uses) — the point of this
// test file is proving precompileTemplate() produces exactly what the
// actual renderer would have computed at runtime, not a hand-typed
// "expected" object that could silently drift from dom.js's real rules.
async function loadRealCompile() {
  const mod = await import('../../core/src/dom.js');
  return mod.__internal_compile;
}

const FIXTURES = {
  plainText: ['<div>', '</div>'],
  nodeInterpolation: ['<div>', '</div>'],
  attribute: ['<div class=', '></div>'],
  property: ['<input .value=', ' />'],
  event: ['<button @click=', '>go</button>'],
  boolean: ['<input ?disabled=', ' />'],
  nested: ['<ul><li>', '</li><li class=', '></li></ul>'],
  multiple: ['<div id=', ' .value=', ' @click=', '>', '</div>'],
};

for (const [name, quasis] of Object.entries(FIXTURES)) {
  test(`precompileTemplate matches the real compile() for: ${name}`, async () => {
    const compile = await loadRealCompile();
    const real = compile(quasis);
    const got = await precompileTemplate(quasis);

    assert.deepEqual(got.parts, real.partDescriptors);
    assert.equal(got.html, real.template.innerHTML);
  });
}

test('precompileTemplate throws a clear error for an empty quasis array', async () => {
  await assert.rejects(() => precompileTemplate([]), /non-empty array/);
});

test('precompileTemplate is stable across repeated calls (happy-dom install happens once)', async () => {
  const quasis = ['<div @click=', '>', '</div>'];
  const first = await precompileTemplate(quasis);
  const second = await precompileTemplate(quasis);
  assert.deepEqual(first, second);
});
