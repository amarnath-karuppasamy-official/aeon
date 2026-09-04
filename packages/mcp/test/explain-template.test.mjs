import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainTemplate, parseTemplateBody } from '../src/explain-template.js';

test('parseTemplateBody splits ${N} placeholders into a real strings array', () => {
  const { strings, slotOrder } = parseTemplateBody('<div ?x=${0}>${1}</div>');
  assert.deepEqual(strings, ['<div ?x=', '>', '</div>']);
  assert.deepEqual(slotOrder, [0, 1]);
});

test('explain_template classifies attr=, .prop=, @event=, ?bool= and a node binding correctly, via the REAL compiler', async () => {
  const result = await explainTemplate({
    template: '<button ?disabled=${0} @click=${1} .value=${2} class=${3}>${4}</button>',
  });

  assert.equal(result.slotCount, 5);
  const bySlot = Object.fromEntries(result.bindings.map((b) => [b.slot, b]));

  assert.equal(bySlot[0].kind, 'boolean');
  assert.equal(bySlot[0].name, 'disabled');
  assert.equal(bySlot[0].warning, null);

  assert.equal(bySlot[1].kind, 'event');
  assert.equal(bySlot[1].name, 'click');
  assert.match(bySlot[1].note, /addEventListener/);

  assert.equal(bySlot[2].kind, 'property');
  assert.equal(bySlot[2].name, 'value');
  assert.match(bySlot[2].note, /el\[name\] = value/);

  assert.equal(bySlot[3].kind, 'attribute');
  assert.equal(bySlot[3].name, 'class');
  assert.equal(bySlot[3].warning, null);

  assert.equal(bySlot[4].kind, 'node');
  assert.equal(bySlot[4].name, null);
});

test('explain_template flags a bogus ref= binding as NOT a real Aeon binding kind', async () => {
  const result = await explainTemplate({ template: '<div ref=${0}></div>' });
  const binding = result.bindings[0];
  assert.equal(binding.kind, 'attribute'); // this is what the REAL compiler actually produces
  assert.equal(binding.name, 'ref');
  assert.ok(binding.warning, 'expected a warning for ref=');
  assert.match(binding.warning, /^NOT a real Aeon binding kind/);
  assert.match(binding.warning, /no ref= binding/);
});

test('explain_template flags a bogus key= binding and points at list()', async () => {
  const result = await explainTemplate({ template: '<li key=${0}></li>' });
  const binding = result.bindings[0];
  assert.equal(binding.kind, 'attribute');
  assert.equal(binding.name, 'key');
  assert.match(binding.warning, /^NOT a real Aeon binding kind/);
  assert.match(binding.warning, /list\(itemsFn, keyFn, renderFn\)/);
});

test('explain_template does NOT warn on legitimate plain attributes', async () => {
  const result = await explainTemplate({ template: '<a href=${0} id=${1} data-foo=${2}></a>' });
  for (const b of result.bindings) {
    assert.equal(b.kind, 'attribute');
    assert.equal(b.warning, null, `expected no warning for ${b.name}`);
  }
});

test('explain_template handles a full realistic template with a mix of all kinds plus a mistake, in one pass', async () => {
  const result = await explainTemplate({
    template:
      '<ul><li ?hidden=${0} @click=${1} .textContent=${2} title=${3} ref=${4}>${5}</li></ul>',
  });
  assert.equal(result.slotCount, 6);
  const kinds = result.bindings.map((b) => b.kind);
  assert.deepEqual(kinds, ['boolean', 'event', 'property', 'attribute', 'attribute', 'node']);
  const warnings = result.bindings.map((b) => b.warning);
  assert.deepEqual(warnings, [null, null, null, null, warnings[4], null]);
  assert.match(warnings[4], /ref=/);
});

test('explain_template rejects a missing template argument', async () => {
  await assert.rejects(() => explainTemplate({}), /template is required/);
});
