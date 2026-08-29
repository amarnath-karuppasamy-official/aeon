// Aeon i18n: locale is a signal, so switching it re-runs any `effect()` (and
// therefore any template binding — `${() => t('greeting')}` is just an
// effect under the hood, same as every other Aeon binding) that reads a
// `t()` result. No separate "i18n context" or re-render mechanism needed.
import { signal } from '@aeon-framework/core';

function interpolate(message, params) {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (whole, name) => (name in params ? String(params[name]) : whole));
}

/** `count`-driven pluralization, kept deliberately simple: `key_one` when
 * `params.count === 1`, `key_other` otherwise. Only kicks in when `params`
 * carries a numeric `count` — plain keys are untouched. */
function pluralKey(key, params) {
  if (!params || typeof params.count !== 'number') return key;
  return `${key}_${params.count === 1 ? 'one' : 'other'}`;
}

/**
 * Create an isolated i18n instance: its own `locale` signal, its own
 * message store, its own fallback chain. Most apps just use the default
 * singleton exported below; `createI18n()` exists for tests and for apps
 * that genuinely need more than one independent instance.
 */
export function createI18n({ locale: initialLocale = 'en', fallbackLocale = 'en' } = {}) {
  const locale = signal(initialLocale);
  const store = new Map(); // locale -> flat { key: message }

  /** Load (or replace) the message table for one locale. Merges with
   * whatever was previously loaded for that locale rather than clobbering it. */
  function loadMessages(loc, messages) {
    const existing = store.get(loc) || {};
    store.set(loc, { ...existing, ...messages });
  }

  function lookup(loc, key) {
    const messages = store.get(loc);
    return messages ? messages[key] : undefined;
  }

  /**
   * Translate `key`, interpolating `{placeholder}` tokens from `params` and
   * picking a `_one`/`_other` variant when `params.count` is a number.
   * Fallback chain: current locale -> `fallbackLocale` -> the raw key
   * itself (so a missing translation is visibly a missing translation, not
   * a blank string or a thrown error).
   */
  function t(key, params) {
    const resolvedKey = pluralKey(key, params);
    const current = locale.value; // read for reactivity: subscribes any enclosing effect
    let message = lookup(current, resolvedKey);
    if (message === undefined && resolvedKey !== key) message = lookup(current, key); // plural variant missing, try the bare key
    if (message === undefined && current !== fallbackLocale) {
      message = lookup(fallbackLocale, resolvedKey);
      if (message === undefined && resolvedKey !== key) message = lookup(fallbackLocale, key);
    }
    if (message === undefined) return key;
    return interpolate(message, params);
  }

  return { locale, loadMessages, t, fallbackLocale };
}

// A default, ready-to-use instance — the common case (one app, one i18n
// store). `import { locale, t, loadMessages } from '@aeon-framework/i18n'`.
const defaultInstance = createI18n();
export const locale = defaultInstance.locale;
export const loadMessages = defaultInstance.loadMessages;
export const t = defaultInstance.t;
