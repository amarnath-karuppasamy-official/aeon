// Type declarations for @aeon-framework/ssr. Hand-written to match
// src/index.js — keep in sync by hand when the JS API changes.
import type { Component, TemplateResult } from '@aeon-framework/core';

/** Render a component function or an already-evaluated template result to
 * an HTML string, by actually running @aeon-framework/core's real
 * mount()/render() against a headless Happy DOM document — not a separate
 * string renderer. The result is the innerHTML for whatever element you'll
 * later call hydrate()/hydrateComponent() on. */
export function renderToString<P>(vnodeOrComponentFn: Component<P> | TemplateResult, props?: P): string;
