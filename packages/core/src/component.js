// Aeon component model: plain functions that return templates, with lifecycle
// hooks scoped via an owner stack (no classes, no decorators required).
import { effect } from './signal.js';
import { render } from './dom.js';

let ownerStack = [];

function currentOwner() {
  return ownerStack[ownerStack.length - 1] || null;
}

/** Register a cleanup callback tied to the nearest enclosing mount(). */
export function onCleanup(fn) {
  const owner = currentOwner();
  if (owner) owner.cleanups.push(fn);
}

/** Run `fn` once after the component's DOM has been attached. */
export function onMount(fn) {
  const owner = currentOwner();
  if (owner) owner.mounts.push(fn);
  else queueMicrotask(fn);
}

/**
 * Instantiate a component function into `container`.
 * componentFn(props) must return an Aeon template (`html\`...\``).
 * Returns a dispose function that runs cleanups and unmounts the DOM.
 */
export function mount(componentFn, container, props = {}) {
  const owner = { cleanups: [], mounts: [] };
  ownerStack.push(owner);
  let template;
  try {
    template = componentFn(props);
  } finally {
    ownerStack.pop();
  }
  const disposeDom = render(template, container);
  for (const m of owner.mounts) m();
  return () => {
    for (const c of owner.cleanups) c();
    disposeDom();
  };
}

/** Define a component. Currently a thin identity wrapper kept for API stability
 *  and future compile-time optimization hooks. */
export function defineComponent(setupFn) {
  return setupFn;
}
