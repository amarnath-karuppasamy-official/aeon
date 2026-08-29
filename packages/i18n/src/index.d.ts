// Type declarations for @aeon-framework/i18n. Hand-written to match
// src/index.js — keep in sync by hand when the JS API changes.
import type { Signal } from '@aeon-framework/core';

export interface I18nOptions {
  locale?: string;
  fallbackLocale?: string;
}

export interface I18nInstance {
  locale: Signal<string>;
  fallbackLocale: string;
  loadMessages(locale: string, messages: Record<string, string>): void;
  t(key: string, params?: Record<string, unknown> & { count?: number }): string;
}

/** Create an isolated i18n instance (its own locale signal + message store). */
export function createI18n(options?: I18nOptions): I18nInstance;

/** The default singleton instance's locale signal. */
export const locale: Signal<string>;

/** The default singleton instance's loadMessages(). */
export const loadMessages: I18nInstance['loadMessages'];

/** The default singleton instance's t(). */
export const t: I18nInstance['t'];
