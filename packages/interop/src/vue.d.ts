import type { DefineComponent, Ref } from 'vue';
import type { Component, Signal, ReadonlySignal } from '@aeon-framework/core';

/** Mount an Aeon component as a leaf inside a Vue tree. Use as
 * `<AeonView :component="MyComponent" :props="{...}" />`. */
export const AeonView: DefineComponent<{ component: Component<any>; props?: Record<string, unknown> }>;

/** Read a live Aeon signal from a Vue `setup()`; returns a Vue ref kept in
 * sync via an Aeon effect, stopped automatically on unmount. */
export function useAeonSignal<T>(sig: Signal<T> | ReadonlySignal<T>): Ref<T>;
