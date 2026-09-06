// Two directions of interop with Angular:
//   AeonHostDirective mounts an Aeon component as a leaf inside an Angular
//   tree (Aeon owns a leaf) — `<div aeonHost [component]="Counter" [props]="{...}"></div>`.
//   toObservable adapts an Aeon signal to an RxJS Observable, Angular's own
//   native reactive primitive, so `{{ (mySignal$ | async) }}` works directly.
//   hostAngular does the reverse: mount a real Angular component as a leaf
//   inside an Aeon `html` template.
//
// Angular has no ambient "current app" the way React/Vue/Svelte don't need
// one (React reads `document`, ReactDOM.createRoot just needs a node; Vue's
// render() just needs a node; Svelte's mount just needs a node+globals) —
// Angular components can only be created through an `EnvironmentInjector`,
// which only exists once some Angular application has bootstrapped. That's
// why hostAngular below takes an explicit `environmentInjector` argument
// where hostReact/hostVue/hostSvelte don't need one. This is a real,
// inherent asymmetry in Angular's architecture, not an oversight — see the
// README's Interop section for the same note.
//
// This file uses Angular's decorators (@Directive, @Input) applied as
// plain function calls — `Input()(Klass.prototype, 'name')` then
// `Directive({...})(Klass)` — instead of `@Directive()`/`@Input()` syntax,
// so this package never needs a TypeScript/Babel decorator-transform build
// step to ship this file as plain, directly-runnable ESM (this is exactly
// what TS's own `experimentalDecorators` output compiles `@Directive()
// class Foo {}` down to). Verified to behave identically to real decorator
// syntax — see packages/interop/test/angular.test.mjs.
import { Directive, ElementRef, Input, createComponent } from '@angular/core';
import { Observable } from 'rxjs';
import { effect } from '@aeon-framework/core';
import { attach } from './vanilla.js';

class AeonHostDirectiveImpl {
  component;
  props;
  el;
  _dispose = null;

  constructor(elementRef) {
    this.el = elementRef;
  }

  // Angular's JIT compiler resolves a constructor's DI tokens from
  // TypeScript's `design:paramtypes` reflect-metadata, normally emitted by
  // `tsc --emitDecoratorMetadata`. This file has no compile step, so we
  // supply the same information the way Angular's own compiler output did
  // before relying on that: a static `ctorParameters` function.
  static ctorParameters = () => [{ type: ElementRef }];

  ngOnInit() {
    this._mount();
  }

  // Angular calls ngOnChanges before ngOnInit on the very first change, so
  // the initial mount is left to ngOnInit — this only handles remounts on
  // a later `component`/`props` reference-identity change, matching
  // AeonView's contract for React/Vue/Svelte.
  ngOnChanges(changes) {
    if (!this._dispose) return; // ngOnInit will do the initial mount
    if (changes.component || changes.props) this._remount();
  }

  ngOnDestroy() {
    if (this._dispose) this._dispose();
  }

  _mount() {
    this._dispose = attach(this.el.nativeElement, this.component, this.props || {});
  }

  _remount() {
    this._dispose();
    this._mount();
  }
}

Input()(AeonHostDirectiveImpl.prototype, 'component');
Input()(AeonHostDirectiveImpl.prototype, 'props');
Directive({
  standalone: true,
  selector: '[aeonHost]',
})(AeonHostDirectiveImpl);

/** Standalone Angular directive: `<div aeonHost [component]="Counter" [props]="{...}"></div>`
 * mounts an Aeon component as a leaf inside the host element. Remounts
 * whenever `component`/`props` reference identity changes. */
export const AeonHostDirective = AeonHostDirectiveImpl;

/** Wrap an Aeon signal as an RxJS Observable — Angular's native reactive
 * primitive. Use as `mySignal$ = toObservable(sig)` then
 * `{{ (mySignal$ | async) }}` in a template. */
export function toObservable(sig) {
  return new Observable((subscriber) => {
    const stop = effect(() => {
      subscriber.next(sig.value);
    });
    return stop;
  });
}

// --- Reverse direction: embed an Angular component inside an Aeon template ---

/**
 * Mount a real Angular component as a leaf inside an Aeon `html` template.
 * Angular has no ambient "current application" — creating a component
 * requires an `EnvironmentInjector`, which only exists once some Angular
 * app has bootstrapped — so, unlike hostReact/hostVue/hostSvelte, this
 * function needs that injector passed in explicitly (e.g. from
 * `ApplicationRef.injector` after `bootstrapApplication()`, or from
 * `inject(EnvironmentInjector)` inside Angular code that already has one).
 * Returns { node, dispose }.
 */
export function hostAngular(Component, environmentInjector, propsFn) {
  const node = document.createElement('div');
  let ref = null;
  const stop = effect(() => {
    const props = typeof propsFn === 'function' ? propsFn() : propsFn;
    if (!ref) {
      ref = createComponent(Component, { environmentInjector, hostElement: node });
    }
    for (const [key, value] of Object.entries(props || {})) {
      ref.setInput(key, value);
    }
    ref.changeDetectorRef.detectChanges();
  });
  return {
    node,
    dispose: () => {
      stop();
      if (ref) ref.destroy();
    },
  };
}
