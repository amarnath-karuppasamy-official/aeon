import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConventionsTool, CONVENTIONS } from '../src/conventions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const domSource = fs.readFileSync(path.resolve(__dirname, '../../core/src/dom.js'), 'utf8');

test('get_conventions documents all four real binding kinds', () => {
  const { text } = getConventionsTool();
  assert.match(text, /attr=\$\{v\}/);
  assert.match(text, /\.prop=\$\{v\}/);
  assert.match(text, /@event=\$\{fn\}/);
  assert.match(text, /\?bool=\$\{v\}/);
});

test('get_conventions flags the real ref= footgun', () => {
  assert.match(CONVENTIONS, /no `ref=` binding/);
  assert.match(CONVENTIONS, /el\.setAttribute\('ref', String\(fn\)\)/);
});

test('get_conventions flags the real key= footgun and points at list()', () => {
  assert.match(CONVENTIONS, /no `key=` attribute for lists/);
  assert.match(CONVENTIONS, /list\(itemsFn, keyFn, renderFn\)/);
});

// Cross-check against the real source these claims describe, so the
// conventions text can't silently drift from dom.js's actual behavior.
test('conventions claims are consistent with the real dom.js source', () => {
  // The four (and only four) prefix characters walkForParts() recognizes.
  assert.match(domSource, /name\[0\] === '@'.*kind = 'event'/s);
  assert.match(domSource, /name\[0\] === '\.'.*kind = 'property'/s);
  assert.match(domSource, /name\[0\] === '\?'.*kind = 'boolean'/s);
  // list() really is the keyed-list mechanism, not a key= attribute.
  assert.match(domSource, /export function list\(itemsFn, keyFn, renderFn\)/);
  // no ref-handling code exists anywhere in the compiler.
  assert.doesNotMatch(domSource, /['"]ref['"]/);
});
