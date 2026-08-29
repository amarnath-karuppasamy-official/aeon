// Aeon reactivity core: fine-grained signals, effects, computed values.
// No virtual DOM. No scheduler magic. Synchronous by default, batchable on demand.

let activeEffect = null;
let batchDepth = 0;
const pendingEffects = new Set();

class Effect {
  constructor(fn) {
    this.fn = fn;
    this.deps = new Set();
    this.active = true;
    this._cleanupFn = null;
    this.run();
  }

  cleanup() {
    for (const dep of this.deps) dep.delete(this);
    this.deps.clear();
  }

  run() {
    if (!this.active) return;
    this.cleanup();
    const prevEffect = activeEffect;
    activeEffect = this;
    try {
      if (typeof this._cleanupFn === 'function') this._cleanupFn();
      this._cleanupFn = this.fn();
    } finally {
      activeEffect = prevEffect;
    }
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.cleanup();
    if (typeof this._cleanupFn === 'function') this._cleanupFn();
    this._cleanupFn = null;
  }
}

export class Signal {
  #value;
  #subscribers = new Set();

  constructor(value) {
    this.#value = value;
  }

  get value() {
    if (activeEffect) {
      this.#subscribers.add(activeEffect);
      activeEffect.deps.add(this.#subscribers);
    }
    return this.#value;
  }

  set value(next) {
    if (Object.is(next, this.#value)) return;
    this.#value = next;
    this.#notify();
  }

  /** Update via a reducer function: count.update(v => v + 1) */
  update(fn) {
    this.value = fn(this.#value);
  }

  /** Read without subscribing the current effect. */
  peek() {
    return this.#value;
  }

  #notify() {
    const subs = [...this.#subscribers];
    for (const eff of subs) {
      if (batchDepth > 0) pendingEffects.add(eff);
      else eff.run();
    }
  }
}

/** Create a writable reactive signal. */
export function signal(initial) {
  return new Signal(initial);
}

/** Run `fn` immediately and re-run whenever any signal it reads changes. Returns a stop function. */
export function effect(fn) {
  const e = new Effect(fn);
  return () => e.stop();
}

/** Derive a read-only signal from other signals. Recomputes eagerly when deps change. */
export function computed(fn) {
  const result = new Signal(undefined);
  effect(() => {
    result.value = fn();
  });
  return {
    get value() {
      return result.value;
    },
    peek() {
      return result.peek();
    },
  };
}

/** Coalesce multiple signal writes into a single effect flush. */
export function batch(fn) {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0 && pendingEffects.size > 0) {
      const effs = [...pendingEffects];
      pendingEffects.clear();
      for (const e of effs) e.run();
    }
  }
}

/** True if `v` looks like an Aeon signal (writable or computed). */
export function isSignal(v) {
  return !!v && typeof v === 'object' && 'value' in v && typeof v.peek === 'function';
}
