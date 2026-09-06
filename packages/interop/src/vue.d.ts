import type { DefineComponent, Ref } from 'vue';
import type { Component, Signal, ReadonlySignal } from '@aeon-framework/core';

/** Mount an Aeon component as a leaf inside a Vue tree. Use as
 * `<AeonView :component="MyComponent" :props="{...}" />`. */
export const AeonView: DefineComponent<{ component: Component<any>; props?: Record<string, unknown> }>;

/** Read a live Aeon signal from a Vue `setup()`; returns a Vue ref kept in
 * sync via an Aeon effect, stopped automatically on unmount. */
export function useAeonSignal<T>(sig: Signal<T> | ReadonlySignal<T>): Ref<T>;

/** Mount a real Vue component as a leaf inside an Aeon `html` template using
 * Vue's own `render(vnode, container)` — patches in place, never remounts
 * on a prop update. */
export function hostVue<P extends Record<string, unknown>>(
  component: DefineComponent<P> | ((props: P) => unknown),
  propsFn: P | (() => P)
): { node: Node; dispose: () => void };
