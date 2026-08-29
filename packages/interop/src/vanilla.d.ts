import type { Component } from '@aeon-framework/core';

/** Attach an Aeon component to a container element you already control.
 * Call the returned function when the host framework is about to remove or
 * replace that element (componentWillUnmount, onUnmounted, ngOnDestroy, …). */
export function attach<P>(container: Element, ComponentFn: Component<P>, props?: P): () => void;
