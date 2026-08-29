// Type declarations for @aeon-framework/forms. Hand-written to match
// src/index.js — keep in sync by hand when the JS API changes.
import type { Signal, ReadonlySignal } from '@aeon-framework/core';

/** A field validator: return an error message string, or null when valid. */
export type Validator<T = unknown> = (value: T) => string | null;

export const validators: {
  required(message?: string): Validator;
  minLength(min: number, message?: string): Validator;
  pattern(re: RegExp, message?: string): Validator;
  email(message?: string): Validator;
};

/** A single reactive form field. */
export interface FormControl<T = string> {
  value: Signal<T>;
  touched: Signal<boolean>;
  dirty: Signal<boolean>;
  errors: ReadonlySignal<string[]>;
  valid: ReadonlySignal<boolean>;
  setValue(next: T): void;
  markTouched(): void;
  reset(next?: T): void;
}

// Two overloads rather than a single `<T = string>` generic: inferring T
// straight from a string-literal default (`control('')`) can pin T to the
// literal `""` instead of widening to `string`, which then rejects any other
// string you later pass to setValue(). Fixing the common case as its own
// overload sidesteps that inference quirk entirely.
export function control(initialValue?: string, fieldValidators?: Validator<string>[]): FormControl<string>;
export function control<T>(initialValue: T, fieldValidators?: Validator<T>[]): FormControl<T>;

/** A group of named controls (or nested groups) with aggregate validity. */
export interface FormGroup<C extends Record<string, FormControl<any>>> {
  controls: C;
  value: ReadonlySignal<{ [K in keyof C]: C[K]['value'] extends Signal<infer V> ? V : never }>;
  valid: ReadonlySignal<boolean>;
  touched: ReadonlySignal<boolean>;
  errors: ReadonlySignal<{ [K in keyof C]?: string[] }>;
  reset(): void;
  markAllTouched(): void;
}

export function group<C extends Record<string, FormControl<any>>>(controls: C): FormGroup<C>;
