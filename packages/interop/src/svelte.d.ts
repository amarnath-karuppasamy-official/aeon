import type { Component } from '@aeon-framework/core';
import type { Signal, ReadonlySignal } from '@aeon-framework/core';

export interface SvelteActionReturn {
  update(newParams: { component: Component<any>; props?: Record<string, unknown> }): void;
  destroy(): void;
}

/** Svelte action: `<div use:aeonMount={{ component, props }}></div>` mounts
 * an Aeon component into the element. Remounts on update() with a new
 * `{ component, props }` value — pass a stable object to avoid remounting
 * on every reactive update. */
export function aeonMount(
  node: Element,
  params: { component: Component<any>; props?: Record<string, unknown> }
): SvelteActionReturn;

export interface SvelteStore<T> {
  subscribe(run: (value: T) => void): () => void;
}

/** Adapt an Aeon signal to Svelte's store contract, so `$store` works
 * directly in a .svelte template. Read-only mirroring. */
export function aeonSignalStore<T>(sig: Signal<T> | ReadonlySignal<T>): SvelteStore<T>;

/** Mount a real Svelte component as a leaf inside an Aeon `html` template.
 * Verified against Svelte 5 via svelte/legacy's createClassComponent. */
export function hostSvelte<P extends Record<string, unknown>>(
  component: unknown,
  propsFn: P | (() => P)
): { node: Node; dispose: () => void };
