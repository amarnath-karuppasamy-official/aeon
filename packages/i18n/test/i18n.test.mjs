import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effect } from '@aeon-framework/core';
import { createI18n } from '../src/index.js';

test('interpolation: {placeholder} tokens are substituted from params', () => {
  const i18n = createI18n({ locale: 'en' });
  i18n.loadMessages('en', { greeting: 'Hello, {name}!' });
  assert.equal(i18n.t('greeting', { name: 'Ada' }), 'Hello, Ada!');
});

test('pluralization: count-driven key_one / key_other convention', () => {
  const i18n = createI18n({ locale: 'en' });
  i18n.loadMessages('en', {
    apples_one: 'You have {count} apple',
    apples_other: 'You have {count} apples',
  });
  assert.equal(i18n.t('apples', { count: 1 }), 'You have 1 apple');
  assert.equal(i18n.t('apples', { count: 5 }), 'You have 5 apples');
  assert.equal(i18n.t('apples', { count: 0 }), 'You have 0 apples');
});

test('two locales: switching the locale signal changes t() output', () => {
  const i18n = createI18n({ locale: 'en' });
  i18n.loadMessages('en', { hello: 'Hello' });
  i18n.loadMessages('fr', { hello: 'Bonjour' });
  assert.equal(i18n.t('hello'), 'Hello');
  i18n.locale.value = 'fr';
  assert.equal(i18n.t('hello'), 'Bonjour');
});

test('fallback chain: missing key in current locale falls back to the fallback locale, then to the key itself', () => {
  const i18n = createI18n({ locale: 'fr', fallbackLocale: 'en' });
  i18n.loadMessages('en', { onlyInEnglish: 'Only in English', shared: 'shared (en)' });
  i18n.loadMessages('fr', { shared: 'partagé (fr)' });

  // Present in current locale: no fallback needed.
  assert.equal(i18n.t('shared'), 'partagé (fr)');
  // Missing in current locale (fr), present in fallback (en).
  assert.equal(i18n.t('onlyInEnglish'), 'Only in English');
  // Missing everywhere: falls back to the raw key.
  assert.equal(i18n.t('totallyUnknownKey'), 'totallyUnknownKey');
});

test('t() bound inside an effect re-runs reactively when the locale signal changes', () => {
  const i18n = createI18n({ locale: 'en' });
  i18n.loadMessages('en', { greeting: 'Hello, {name}!' });
  i18n.loadMessages('es', { greeting: '¡Hola, {name}!' });

  const seen = [];
  const stop = effect(() => {
    seen.push(i18n.t('greeting', { name: 'Ada' }));
  });
  assert.deepEqual(seen, ['Hello, Ada!']);

  i18n.locale.value = 'es';
  assert.deepEqual(seen, ['Hello, Ada!', '¡Hola, Ada!']);

  i18n.locale.value = 'es'; // no-op write, same value — no extra effect run
  assert.deepEqual(seen, ['Hello, Ada!', '¡Hola, Ada!']);

  stop();
});

test('default singleton instance is usable directly', async () => {
  const { locale, t, loadMessages } = await import('../src/index.js');
  loadMessages('en', { hi: 'hi there' });
  assert.equal(locale.value, 'en');
  assert.equal(t('hi'), 'hi there');
});
