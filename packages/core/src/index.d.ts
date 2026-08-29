// Type declarations for @aeon-framework/core.
// Hand-written to match src/*.js exactly — there is no compile step that
// generates these, so keep them in sync by hand when the JS API changes.

/** A writable reactive cell. Reading `.value` inside an effect/template
 * binding subscribes to it; writing re-runs every subscriber. */
export class Signal<T> {
  constructor(value: T);
  get value(): T;
  set value(next: T);
  /** Update via a reducer function: count.update(v => v + 1) */
  update(fn: (current: T) => T): void;
  /** Read without subscribing the current effect. */
  peek(): T;
}

/** A read-only derived value. */
export interface ReadonlySignal<T> {
  readonly value: T;
  peek(): T;
}

/** Create a writable reactive signal. */
export function signal<T>(initial: T): Signal<T>;

/** Run `fn` immediately and re-run whenever any signal it reads changes.
 * Returns a stop function. `fn` may return a cleanup callback, run before
 * each re-run and on stop. */
export function effect(fn: () => void | (() => void)): () => void;

/** Derive a read-only signal from other signals. Recomputes eagerly when
 * any dependency changes. */
export function computed<T>(fn: () => T): ReadonlySignal<T>;

/** Coalesce multiple signal writes inside `fn` into a single effect flush. */
export function batch(fn: () => void): void;

/** True if `v` looks like an Aeon signal (writable or computed). */
export function isSignal(v: unknown): v is Signal<unknown> | ReadonlySignal<unknown>;

/** A value inside a template binding: a plain value is static, a function
 * is re-evaluated reactively (tracking whatever signals it reads). Event
 * handlers (`@click=${fn}`) are the one exception — the function itself is
 * the value there, not a getter. */
export type Bindable<T> = T | (() => T);

/** The result of tagging a template literal with `html`. Opaque — pass it to
 * `mount`/`render`, or return it from a component. */
export interface TemplateResult {
  readonly __aeonTemplate: true;
  readonly strings: TemplateStringsArray;
  readonly values: readonly unknown[];
}

/** Tag a template literal as reactive markup. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult;

/** A component is a plain function that returns a template. */
export type Component<P = {}> = (props: P) => TemplateResult | null;

/** Render a template result into a container element. Returns a dispose
 * function that stops all bindings and clears the container. */
export function render(result: TemplateResult, container: Element): () => void;

/** The special value returned by `list()` — pass it inside a `${...}`
 * binding, wrapped in a function so it re-runs on change:
 *   ${() => list(() => items.value, i => i.id, i => html`<li>${i.text}</li>`)}
 */
export interface ListResult<T> {
  readonly __aeonList: true;
}

/** Keyed reactive list. Existing rows are repositioned, not rebuilt, when
 * order changes; a row is only remounted when the item at its key actually
 * changed (compared by reference). */
export function list<T>(
  itemsFn: () => readonly T[],
  keyFn: ((item: T, index: number) => unknown) | null,
  renderFn: (item: T, index: number) => TemplateResult
): ListResult<T>;

/** Instantiate a component function into `container`. Returns a dispose
 * function that runs registered cleanups and unmounts the DOM. */
export function mount<P>(componentFn: Component<P>, container: Element, props?: P): () => void;

/** Identity wrapper kept for API stability and future compile-time hooks. */
export function defineComponent<P>(setupFn: Component<P>): Component<P>;

/** Register a cleanup callback tied to the nearest enclosing `mount()`. */
export function onCleanup(fn: () => void): void;

/** Run `fn` once after the component's DOM has been attached to `mount()`'s
 * container. Outside of a mount, runs on the next microtask instead. */
export function onMount(fn: () => void): void;
