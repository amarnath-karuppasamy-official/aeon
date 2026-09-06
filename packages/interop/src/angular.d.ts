import type { ElementRef, EnvironmentInjector, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Component, Signal, ReadonlySignal } from '@aeon-framework/core';

/** Standalone Angular directive: `<div aeonHost [component]="Counter" [props]="{...}"></div>`
 * mounts an Aeon component as a leaf inside the host element. Remounts
 * whenever `component`/`props` reference identity changes. */
export declare class AeonHostDirective implements OnInit, OnChanges, OnDestroy {
  component: Component<any>;
  props?: Record<string, unknown>;
  constructor(elementRef: ElementRef<Element>);
  ngOnInit(): void;
  ngOnChanges(changes: SimpleChanges): void;
  ngOnDestroy(): void;
}

/** Wrap an Aeon signal as an RxJS Observable. Use as
 * `mySignal$ = toObservable(sig)` then `{{ (mySignal$ | async) }}`. */
export function toObservable<T>(sig: Signal<T> | ReadonlySignal<T>): Observable<T>;

/** Mount a real Angular component as a leaf inside an Aeon `html` template.
 * Needs an explicit EnvironmentInjector — Angular has no ambient "current
 * app" the way React/Vue/Svelte don't need one. */
export function hostAngular<P extends Record<string, unknown>>(
  component: unknown,
  environmentInjector: EnvironmentInjector,
  propsFn: P | (() => P)
): { node: Node; dispose: () => void };
