// Aeon testing utilities: render a component into a real (Happy DOM)
// document, query/interact with it, and clean up between tests. Aeon's
// signal writes take effect synchronously — no virtual-DOM diff to flush —
// so assertions can run immediately after a state change with no `await
// tick()` dance; the only place you need `await` is a genuinely async
// callback (e.g. one built on @aeon-framework/http's resource()/mutation()).
import { mount } from '@aeon-framework/core';

let mountedContainers = [];
let installedWindow = null;

/**
 * Install a Happy DOM `window`/`document` as Node globals for the duration
 * of a test file. Call once, typically in a setup file your test runner
 * loads before any test — render() calls this automatically if you haven't.
 * Returns a function that restores the previous globals (rarely needed;
 * most suites just install once and let the process exit).
 */
export async function setupDom() {
  if (installedWindow) return () => {};
  const { Window } = await import('happy-dom');
  const window = new Window();
  installedWindow = window;
  const prev = { document: globalThis.document, window: globalThis.window };
  globalThis.window = window;
  globalThis.document = window.document;
  // A minimal set most component code touches; extend here if a real app
  // needs more of the Happy DOM window surface globally. `navigator` is
  // deliberately excluded — Node already defines it as a read-only global
  // (since Node 21), and overwriting it throws.
  for (const key of ['Node', 'Element', 'HTMLElement', 'Event', 'CustomEvent', 'MouseEvent']) {
    if (key in window) {
      try {
        globalThis[key] = window[key];
      } catch {
        // some global is non-configurable in this Node version — leave it,
        // Aeon components rarely reference these constructors by name.
      }
    }
  }
  return () => {
    globalThis.document = prev.document;
    globalThis.window = prev.window;
    installedWindow = null;
  };
}

/**
 * Mount `Component(props)` into a fresh, detached container and return it
 * plus helpers. Call `unmount()` yourself, or `cleanup()` in an afterEach to
 * unmount everything rendered so far in one call.
 */
export async function render(Component, props) {
  await setupDom();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = mount(Component, container, props);
  const unmount = () => {
    dispose();
    container.remove();
    mountedContainers = mountedContainers.filter((c) => c.container !== container);
  };
  const entry = { container, unmount };
  mountedContainers.push(entry);
  return {
    container,
    unmount,
    /** container.querySelector, for convenience. */
    find: (selector) => container.querySelector(selector),
    /** container.querySelectorAll, for convenience. */
    findAll: (selector) => Array.from(container.querySelectorAll(selector)),
  };
}

/** Unmount everything render() has produced so far. Call from an afterEach
 * so one test's DOM never bleeds into the next. */
export function cleanup() {
  for (const { unmount } of [...mountedContainers]) unmount();
  mountedContainers = [];
}

function dispatch(el, type, opts) {
  const EventCtor = globalThis[opts?.eventClass || 'Event'] || Event;
  const event = new EventCtor(type, { bubbles: true, cancelable: true, ...opts });
  if (opts?.target) Object.assign(el, opts.target);
  el.dispatchEvent(event);
}

/** Fire DOM events the way a user would, Testing-Library style:
 *   fireEvent.click(button)
 *   fireEvent.input(input, { target: { value: 'hi' } })
 * Aeon applies the resulting signal write synchronously, so the DOM is
 * already updated by the time dispatch() returns — no need to await. */
export const fireEvent = new Proxy(
  {},
  {
    get(_target, type) {
      return (el, opts) => dispatch(el, type, opts);
    },
  }
);
