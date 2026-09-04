// Real, programmatic test of src/binding-hover.js — the vscode-API-free
// logic backing the hover provider. Runs with plain `node` (no VS Code, no
// Extension Development Host): it imports the REAL explainTemplate() from
// packages/mcp/src/explain-template.js (which runs Aeon's real compiler,
// packages/core/src/dom.js's compile()) the exact same way extension.js
// does, and asserts on what the hover logic actually produces for real
// Aeon markup, including a case pulled straight from
// examples/demo-app/src/pages/Contact.js.
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  isInsideAeonHtmlMarkup,
  findAttrTokenAt,
  explainBindingAt,
} = require('../src/binding-hover.js');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`ok:   ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL: ${name}`);
    console.error('      ' + err.message);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`ok:   ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL: ${name}`);
    console.error('      ' + err.message);
  }
}

async function main() {
  // --- isInsideAeonHtmlMarkup ------------------------------------------
  check('offset inside html`` markup body is detected', () => {
    const text = 'const v = html`<div class=${x}></div>`;';
    const offset = text.indexOf('class');
    assert.equal(isInsideAeonHtmlMarkup(text, offset), true);
  });

  check('offset inside a ${...} interpolation is NOT markup (it is JS)', () => {
    const text = 'const v = html`<div class=${x}></div>`;';
    const offset = text.indexOf('x', text.indexOf('${'));
    assert.equal(isInsideAeonHtmlMarkup(text, offset), false);
  });

  check('offset inside a PLAIN (untagged) template literal is never markup', () => {
    const text = 'const v = `<div class=${x}></div>`;';
    const offset = text.indexOf('class');
    assert.equal(isInsideAeonHtmlMarkup(text, offset), false);
  });

  check('offset before the html` open is not markup', () => {
    const text = 'const v = html`<div></div>`; const w = 1;';
    const offset = text.indexOf('w = 1');
    assert.equal(isInsideAeonHtmlMarkup(text, offset), false);
  });

  check('nested html`` template inside an interpolation: outer offset stays JS, inner offset is markup', () => {
    const text = "html`${cond ? html`<p .x=${1}></p>` : null}`";
    const innerOffset = text.indexOf('.x');
    // inner template's own body is markup...
    assert.equal(isInsideAeonHtmlMarkup(text, innerOffset), true);
    const condOffset = text.indexOf('cond');
    assert.equal(isInsideAeonHtmlMarkup(text, condOffset), false);
  });

  // --- findAttrTokenAt ---------------------------------------------------
  check('finds a .prop token by column', () => {
    const line = '  <input .value=${x} />';
    const col = line.indexOf('.value') + 2;
    const token = findAttrTokenAt(line, col);
    assert.deepEqual(token && { prefix: token.prefix, name: token.name, raw: token.raw }, {
      prefix: '.',
      name: 'value',
      raw: '.value',
    });
  });

  check('finds an @event token by column', () => {
    const line = '  <button @click=${fn}>Go</button>';
    const col = line.indexOf('@click') + 3;
    const token = findAttrTokenAt(line, col);
    assert.equal(token.raw, '@click');
  });

  check('finds a ?bool token by column', () => {
    const line = '<input ?disabled=${d} />';
    const col = line.indexOf('?disabled') + 4;
    const token = findAttrTokenAt(line, col);
    assert.equal(token.raw, '?disabled');
  });

  check('finds a plain attr token by column', () => {
    const line = '<div class=${c}></div>';
    const col = line.indexOf('class') + 1;
    const token = findAttrTokenAt(line, col);
    assert.deepEqual({ prefix: token.prefix, name: token.name }, { prefix: '', name: 'class' });
  });

  check('returns null off the end of any token', () => {
    const line = '<div class=${c}></div>';
    assert.equal(findAttrTokenAt(line, line.indexOf('</div>') + 3), null);
  });

  // --- explainBindingAt: real compiler-backed classification -------------
  // Dynamically import the REAL explainTemplate, the same way
  // src/extension.js's loadExplainTemplate() does.
  const explainTemplateModPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'packages',
    'mcp',
    'src',
    'explain-template.js'
  );
  const { explainTemplate } = await import(`file://${explainTemplateModPath}`);

  await checkAsync('hover over ".value=" in a Contact.js-shaped fragment resolves to kind "property" with the real note text', async () => {
    // Straight from examples/demo-app/src/pages/Contact.js's `field()` helper.
    const text =
      'const field = (ctrl) => html`\n' +
      '  <input\n' +
      '    type=${type}\n' +
      '    .value=${() => ctrl.value.value}\n' +
      '    @input=${(e) => ctrl.setValue(e.target.value)}\n' +
      '    @blur=${() => ctrl.markTouched()}\n' +
      '  />\n' +
      '`;';
    const lines = text.split('\n');
    const lineIndex = lines.findIndex((l) => l.includes('.value='));
    const line = lines[lineIndex];
    const col = line.indexOf('.value') + 1;
    const offset = lines.slice(0, lineIndex).join('\n').length + 1 + col;
    // Sanity-check the hand-rolled offset math actually lands inside "value"
    // before trusting explainBindingAt's result below.
    assert.equal(text.slice(offset, offset + 3), 'val');
    const result = await explainBindingAt(explainTemplate, text, offset, line, col);
    assert.ok(result, 'expected a hover result');
    assert.equal(result.binding.kind, 'property');
    assert.match(result.binding.note, /DOM PROPERTY binding/);
  });

  await checkAsync('hover over "@blur=" resolves to kind "event" with the real note text', async () => {
    const text = 'html`<button @blur=${fn}></button>`';
    const line = text;
    const col = text.indexOf('@blur') + 2;
    const offset = col;
    const result = await explainBindingAt(explainTemplate, text, offset, line, col);
    assert.ok(result);
    assert.equal(result.binding.kind, 'event');
    assert.match(result.binding.note, /addEventListener/);
  });

  await checkAsync('hover over "?disabled=" resolves to kind "boolean" with the real note text', async () => {
    const text = 'html`<input ?disabled=${d} />`';
    const col = text.indexOf('?disabled') + 3;
    const result = await explainBindingAt(explainTemplate, text, text.indexOf('?disabled'), text, col);
    assert.ok(result);
    assert.equal(result.binding.kind, 'boolean');
    assert.match(result.binding.note, /toggleAttribute/);
  });

  await checkAsync('hover over "ref=" surfaces the real footgun warning (Aeon has no ref= binding)', async () => {
    const text = 'html`<div ref=${el}></div>`';
    const col = text.indexOf('ref=') + 1;
    const result = await explainBindingAt(explainTemplate, text, text.indexOf('ref='), text, col);
    assert.ok(result);
    assert.equal(result.binding.kind, 'attribute');
    assert.match(result.binding.warning, /Aeon has no ref= binding/);
  });

  await checkAsync('hover inside a plain template literal never calls into explainTemplate / returns null', async () => {
    const text = 'const t = `<div .value=${x}></div>`;';
    const col = text.indexOf('.value') + 2;
    const result = await explainBindingAt(explainTemplate, text, text.indexOf('.value'), text, col);
    assert.equal(result, null);
  });

  console.log(`\n${failures === 0 ? 'All' : 'Some'} hover-logic checks ${failures === 0 ? 'passed' : 'FAILED'}.`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
