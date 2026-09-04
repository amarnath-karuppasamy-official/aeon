import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractHtmlTemplates } from '../src/scan-templates.js';

test('extracts a single-line html`` template with correct body and slot line', () => {
  const source = `import { html } from '@aeon-framework/core';\nfunction A() { return html\`<div ref=\${fn}></div>\`; }\n`;
  const templates = extractHtmlTemplates(source);
  assert.equal(templates.length, 1);
  assert.equal(templates[0].body, '<div ref=${0}></div>');
  assert.deepEqual(templates[0].slotLines, [2]);
});

test('ignores non-html tagged template literals', () => {
  const source = "const s = css`color: ${red};`;\n";
  const templates = extractHtmlTemplates(source);
  assert.equal(templates.length, 0);
});

test('ignores plain (untagged) template literals', () => {
  const source = 'const s = `hello ${name}`;\n';
  const templates = extractHtmlTemplates(source);
  assert.equal(templates.length, 0);
});

test('handles a multi-line html`` template, reporting the real line of each interpolation', () => {
  const source = [
    "import { html } from '@aeon-framework/core';",
    'function A() {',
    '  return html`',
    '    <div',
    '      .value=${count}',
    '      @click=${onClick}',
    '    >${text}</div>',
    '  `;',
    '}',
    '',
  ].join('\n');
  const templates = extractHtmlTemplates(source);
  assert.equal(templates.length, 1);
  assert.deepEqual(templates[0].slotLines, [5, 6, 7]);
  assert.match(templates[0].body, /\.value=\$\{0\}/);
  assert.match(templates[0].body, /@click=\$\{1\}/);
  assert.match(templates[0].body, />\$\{2\}<\/div>/);
});

test('recurses into a nested html`` template inside an interpolation, extracting both', () => {
  const source =
    "function A() { return html`<div>${() => cond() ? html`<b .x=${1}>` : html`<i>${2}</i>`}</div>`; }\n";
  const templates = extractHtmlTemplates(source);
  // Each nested html`` template closes (and is recorded) before the outer
  // one does, so they appear first, in the order their closing backtick was
  // reached; the outer template (one slot for the whole conditional) is
  // recorded last.
  assert.equal(templates.length, 3);
  const bodies = templates.map((t) => t.body);
  assert.ok(bodies.some((b) => /\.x=\$\{0\}/.test(b)), 'nested <b .x=...> template captured');
  assert.ok(bodies.some((b) => b === '<i>${0}</i>'), 'nested <i> template captured');
  assert.ok(bodies.includes('<div>${0}</div>'), 'outer <div> template captured');
});

test('does not get confused by a backtick or brace inside an unrelated string literal', () => {
  const source =
    "const msg = 'it costs `10 {not a template}`';\nfunction A() { return html`<div>hi</div>`; }\n";
  const templates = extractHtmlTemplates(source);
  assert.equal(templates.length, 1);
  assert.equal(templates[0].body, '<div>hi</div>');
});

test('skips backticks/braces inside comments', () => {
  const source =
    '// a comment with a `backtick` and { brace }\nfunction A() { return html`<div>${1}</div>`; }\n';
  const templates = extractHtmlTemplates(source);
  assert.equal(templates.length, 1);
  assert.equal(templates[0].body, '<div>${0}</div>');
});
