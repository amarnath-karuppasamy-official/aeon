// The interop story in one fact: Aeon renders into a real DOM node that it
// fully owns — it never virtual-diffs against a parent's tree. That means
// embedding it inside ANY host framework reduces to "call mount() when my
// container exists, call the returned dispose() when it goes away." Every
// framework-specific adapter in this package (react.js, vue.js, …) is a thin
// wrapper around exactly this function; use it directly for a framework that
// doesn't have one yet (Angular, Svelte, plain Web Components, …).
import { mount } from '@aeon-framework/core';

/**
 * Attach an Aeon component to a container element you already control.
 * Call the returned function when the host framework is about to remove
 * or replace that element (componentWillUnmount, onUnmounted, ngOnDestroy, …).
 */
export function attach(container, ComponentFn, props = {}) {
  return mount(ComponentFn, container, props);
}
