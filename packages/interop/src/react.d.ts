import type { ReactElement } from 'react';
import type { Component } from '@aeon-framework/core';
import type { Signal, ReadonlySignal } from '@aeon-framework/core';

/** Mount an Aeon component as a leaf inside a React tree. Remounts whenever
 * `component` or `props`'s object identity changes — pass a stable props
 * object if you need to avoid remounting on every React render. */
export function AeonView<P>(args: { component: Component<P>; props?: P }): ReactElement;

/** Read a live Aeon signal from React code; re-renders the component on
 * change via useSyncExternalStore. */
export function useAeonSignal<T>(sig: Signal<T> | ReadonlySignal<T>): T;
