// Type declarations for @aeon-framework/testing. Hand-written to match
// src/index.js — keep in sync by hand when the JS API changes.
import type { Component } from '@aeon-framework/core';

/** Install a Happy DOM window/document as Node globals. render() calls this
 * automatically; call it yourself only if you need DOM globals before your
 * first render() (e.g. to construct fixture DOM nodes). Idempotent. */
export function setupDom(): Promise<() => void>;

export interface RenderResult {
  container: HTMLElement;
  unmount(): void;
  find(selector: string): Element | null;
  findAll(selector: string): Element[];
}

/** Mount `Component(props)` into a fresh, detached container. */
export function render<P>(Component: Component<P>, props?: P): Promise<RenderResult>;

/** Unmount everything render() has produced so far — call from an afterEach. */
export function cleanup(): void;

/** Fire a DOM event the way a user would: fireEvent.click(el),
 * fireEvent.input(el, { target: { value: 'hi' } }). */
export const fireEvent: {
  [eventType: string]: (el: Element, opts?: { target?: Record<string, unknown>; eventClass?: string } & EventInit) => void;
};
