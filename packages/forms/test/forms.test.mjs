import { test } from 'node:test';
import assert from 'node:assert/strict';
import { control, group, validators } from '../src/index.js';

test('control() starts with the given initial value and no touched/dirty flags', () => {
  const c = control('hi');
  assert.equal(c.value.value, 'hi');
  assert.equal(c.touched.value, false);
  assert.equal(c.dirty.value, false);
  assert.deepEqual(c.errors.value, []);
  assert.equal(c.valid.value, true);
});

test('setValue() updates the value signal and marks the control dirty (but not touched)', () => {
  const c = control('');
  c.setValue('typed');
  assert.equal(c.value.value, 'typed');
  assert.equal(c.dirty.value, true);
  assert.equal(c.touched.value, false);
});

test('markTouched() flips touched without affecting value/dirty', () => {
  const c = control('x');
  c.markTouched();
  assert.equal(c.touched.value, true);
  assert.equal(c.dirty.value, false);
  assert.equal(c.value.value, 'x');
});

test('reset() restores the initial value (or an explicit one) and clears touched/dirty', () => {
  const c = control('start');
  c.setValue('changed');
  c.markTouched();
  c.reset();
  assert.equal(c.value.value, 'start');
  assert.equal(c.dirty.value, false);
  assert.equal(c.touched.value, false);

  c.setValue('changed again');
  c.reset('explicit-reset-value');
  assert.equal(c.value.value, 'explicit-reset-value');
});

test('errors/valid recompute reactively as validators run against the current value', () => {
  const c = control('', [validators.required()]);
  assert.deepEqual(c.errors.value, ['This field is required.']);
  assert.equal(c.valid.value, false);

  c.setValue('now has a value');
  assert.deepEqual(c.errors.value, []);
  assert.equal(c.valid.value, true);
});

test('multiple validators on one control all contribute to errors, in order', () => {
  const c = control('a', [validators.required(), validators.minLength(3)]);
  assert.deepEqual(c.errors.value, ['Must be at least 3 characters.']);

  c.setValue('');
  assert.deepEqual(c.errors.value, ['This field is required.', 'Must be at least 3 characters.']);
});

test('validators.required() treats null/undefined/empty-string as missing, everything else as present', () => {
  const v = validators.required('required!');
  assert.equal(v(null), 'required!');
  assert.equal(v(undefined), 'required!');
  assert.equal(v(''), 'required!');
  assert.equal(v(0), null, '0 is a real, present value');
  assert.equal(v(false), null, 'false is a real, present value');
  assert.equal(v('x'), null);
});

test('validators.minLength() coerces to string before measuring length', () => {
  const v = validators.minLength(2);
  assert.equal(v(1), 'Must be at least 2 characters.', '"1" has length 1');
  assert.equal(v(12), null, '"12" has length 2');
  assert.equal(v(undefined), 'Must be at least 2 characters.', '"" has length 0');
});

test('validators.pattern() checks a regex against the stringified value', () => {
  const v = validators.pattern(/^\d+$/, 'digits only');
  assert.equal(v('123'), null);
  assert.equal(v('12a'), 'digits only');
});

test('validators.email() accepts a plausible address and rejects an implausible one', () => {
  const v = validators.email();
  assert.equal(v('a@b.com'), null);
  assert.equal(v('not-an-email'), 'Must be a valid email address.');
  assert.equal(v(''), 'Must be a valid email address.');
});

test('custom validator functions compose the same way as the built-in ones', () => {
  const isEven = (value) => (Number(value) % 2 === 0 ? null : 'Must be even.');
  const c = control(3, [isEven]);
  assert.deepEqual(c.errors.value, ['Must be even.']);
  c.setValue(4);
  assert.deepEqual(c.errors.value, []);
});

test('group() aggregates value/valid/touched/errors across its named controls', () => {
  const g = group({
    name: control('', [validators.required()]),
    email: control('bad-email', [validators.email()]),
  });

  assert.deepEqual(g.value.value, { name: '', email: 'bad-email' });
  assert.equal(g.valid.value, false);
  assert.equal(g.touched.value, false);
  assert.deepEqual(g.errors.value, {
    name: ['This field is required.'],
    email: ['Must be a valid email address.'],
  });

  g.controls.name.setValue('Ada');
  g.controls.email.setValue('ada@example.com');
  assert.deepEqual(g.value.value, { name: 'Ada', email: 'ada@example.com' });
  assert.equal(g.valid.value, true);
  assert.deepEqual(g.errors.value, {}, 'a control with no errors must not appear in the group errors object at all');
});

test('group.touched is true as soon as ANY control has been touched, without touching the others', () => {
  const g = group({ a: control(''), b: control('') });
  assert.equal(g.touched.value, false);
  g.controls.a.markTouched();
  assert.equal(g.touched.value, true);
  assert.equal(g.controls.b.touched.value, false);
});

test('group.reset() resets every control back to its own initial value', () => {
  const g = group({ a: control('a-start'), b: control('b-start') });
  g.controls.a.setValue('a-changed');
  g.controls.b.setValue('b-changed');
  g.controls.b.markTouched();

  g.reset();

  assert.equal(g.controls.a.value.value, 'a-start');
  assert.equal(g.controls.b.value.value, 'b-start');
  assert.equal(g.controls.b.touched.value, false);
});

test('group.markAllTouched() touches every control at once', () => {
  const g = group({ a: control(''), b: control('') });
  g.markAllTouched();
  assert.equal(g.controls.a.touched.value, true);
  assert.equal(g.controls.b.touched.value, true);
});

test('a group can nest another group as one of its controls', () => {
  const address = group({
    city: control('', [validators.required()]),
  });
  const form = group({
    name: control('Ada', [validators.required()]),
    address,
  });

  assert.equal(form.valid.value, false, 'the nested group counts toward overall validity');
  address.controls.city.setValue('London');
  assert.equal(form.valid.value, true);
  assert.deepEqual(form.value.value, { name: 'Ada', address: { city: 'London' } });
});
