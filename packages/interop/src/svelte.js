// Two directions of interop with Svelte:
//   aeonMount is a Svelte action that mounts an Aeon component as a leaf
//   inside a Svelte tree (Aeon owns a leaf).
//   aeonSignalStore adapts an Aeon signal to Svelte's store contract, so
//   `$myStore` works directly in a .svelte template — built purely on
//   Aeon's own effect(), no import from the `svelte` package needed.
//   hostSvelte does the reverse: mount a real Svelte component as a leaf
//   inside an Aeon `html` template.
//
// This file is plain JS (no .svelte file) on purpose: the interop package
// never needs the Svelte compiler to build or ship it. `aeonMount` only
// relies on the action interface Svelte itself calls with plain objects —
// { update(newParams), destroy() } — documented at
// https://svelte.dev/docs/svelte/use (Svelte calls `update()` whenever the
// action's argument identity changes between renders, and `destroy()` when
// the element is removed).
import { effect } from '@aeon-framework/core';
import { attach } from './vanilla.js';
import { createClassComponent } from 'svelte/legacy';
// `svelte/legacy`'s createClassComponent — the same way react.js imports
// from 'react' and vue.js from 'vue'. `svelte` is an optional peer
// dependency of this package.
//
// Why svelte/legacy and not the plain Svelte 5 `mount()`: Svelte 5's
// `mount(Component, { props })` only uses `props` for the *initial* render —
// mutating that object afterwards does nothing observable (verified
// empirically against the real, installed Svelte 5.57.0 runtime while
// building this — updating a plain object passed to mount() never
// re-renders the component).
// Making an external, non-rune object drive a Svelte 5 component reactively
// needs the component's props themselves to be Svelte's own $state proxy,
// which only exists inside compiled Svelte code — this interop file is
// deliberately plain, uncompiled JS. `svelte/legacy`'s createClassComponent
// reintroduces Svelte 3/4's class-component shape (`.$set(props)`,
// `.$destroy()`) on top of the real Svelte 5 runtime, still ships with
// Svelte 5 itself (no extra dependency), and gives genuine incremental prop
// updates — no remounting — which is what makes this correct for the same
// reason Vue's `render(h(Component, props), container)` is: patch the
// existing instance's props, don't recreate it.

/**
 * Svelte action: `<div use:aeonMount={{ component, props }}></div>`.
 * Mounts an Aeon component into the element it's attached to. Re-mounts
 * on update() with a new `{ component, props }` value — simplest-correct
 * v0.1 behavior, matching AeonView's remount-on-identity-change contract
 * for React/Vue. Pass a stable object if you need to avoid remounting on
 * every reactive update.
 */
export function aeonMount(node, params) {
  let dispose = attach(node, params.component, params.props);
  return {
    update(newParams) {
      dispose && dispose();
      dispose = attach(node, newParams.component, newParams.props);
    },
    destroy() {
      dispose && dispose();
    },
  };
}

/**
 * Adapt an Aeon signal to Svelte's store contract
 * ({ subscribe(run) => unsubscribe }), so `$store` works in a .svelte
 * template once you do `const store = aeonSignalStore(sig)`. Read-only
 * mirroring — matching useAeonSignal's read-only scope in React/Vue.
 */
export function aeonSignalStore(sig) {
  return {
    subscribe(run) {
      const stop = effect(() => {
        run(sig.value);
      });
      return stop;
    },
  };
}

// --- Reverse direction: embed a Svelte component inside an Aeon template ---

/**
 * Mount a real Svelte component as a leaf inside an Aeon `html` template.
 * Returns { node, dispose } — `node` is a plain DOM node, usable directly
 * as a value inside an Aeon html`` template.
 *
 * Verified against the real, installed Svelte 5.57.0, via `svelte/legacy`'s
 * createClassComponent (see the comment above this function for why).
 * Untested against Svelte 3/4 — if you're still on one of those, `new
 * Component({ target, props })` + `.$set(props)` + `.$destroy()` is the
 * direct equivalent and this function's shape would need no change to
 * support it, only the import.
 */
export function hostSvelte(Component, propsFn) {
  const node = document.createElement('div');
  let instance = null;
  const stop = effect(() => {
    const props = typeof propsFn === 'function' ? propsFn() : propsFn;
    if (!instance) {
      instance = createClassComponent({ component: Component, target: node, props });
    } else {
      instance.$set(props);
    }
  });
  return {
    node,
    dispose: () => {
      stop();
      if (instance) instance.$destroy();
    },
  };
}
