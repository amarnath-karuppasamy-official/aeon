// Aeon forms: a control's value is a signal, so a template that reads
// control.value is already live — no separate "form state" to sync.
import { signal, computed } from '@aeon-framework/core';

export const validators = {
  required: (message = 'This field is required.') => (value) =>
    value === null || value === undefined || value === '' ? message : null,
  minLength: (min, message = `Must be at least ${min} characters.`) => (value) =>
    String(value ?? '').length < min ? message : null,
  pattern: (re, message = 'Invalid format.') => (value) => (re.test(String(value ?? '')) ? null : message),
  email: (message = 'Must be a valid email address.') => (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '')) ? null : message,
};

/** A single reactive form field. */
export function control(initialValue = '', fieldValidators = []) {
  const value = signal(initialValue);
  const touched = signal(false);
  const dirty = signal(false);
  const errors = computed(() => fieldValidators.map((v) => v(value.value)).filter(Boolean));
  const valid = computed(() => errors.value.length === 0);

  return {
    value,
    touched,
    dirty,
    errors,
    valid,
    setValue(next) {
      value.value = next;
      dirty.value = true;
    },
    markTouched() {
      touched.value = true;
    },
    reset(next = initialValue) {
      value.value = next;
      touched.value = false;
      dirty.value = false;
    },
  };
}

/** A group of named controls (or nested groups) with aggregate validity. */
export function group(controls) {
  const entries = Object.entries(controls);

  const value = computed(() =>
    Object.fromEntries(entries.map(([key, ctrl]) => [key, ctrl.value.value]))
  );
  const valid = computed(() => entries.every(([, ctrl]) => ctrl.valid.value));
  const touched = computed(() => entries.some(([, ctrl]) => ctrl.touched.value));
  const errors = computed(() =>
    Object.fromEntries(entries.map(([key, ctrl]) => [key, ctrl.errors.value])).valueOf() &&
    Object.fromEntries(entries.filter(([, ctrl]) => ctrl.errors.value.length).map(([key, ctrl]) => [key, ctrl.errors.value]))
  );

  return {
    controls,
    value,
    valid,
    touched,
    errors,
    reset() {
      for (const [, ctrl] of entries) ctrl.reset();
    },
    markAllTouched() {
      for (const [, ctrl] of entries) ctrl.markTouched();
    },
  };
}
