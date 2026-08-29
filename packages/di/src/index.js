// Aeon DI: plain tokens + a container. No decorators, no reflect-metadata,
// no class magic — services are just functions or objects.

/** A unique, debuggable handle for something injectable. */
export function createToken(description) {
  return Symbol(description);
}

export class Container {
  constructor(parent = null) {
    this.parent = parent;
    this.factories = new Map(); // token -> { factory, singleton }
    this.instances = new Map(); // token -> resolved value
  }

  /** Register a value, or a factory `(container) => value` (singleton by default). */
  provide(token, factoryOrValue, { singleton = true } = {}) {
    const factory = typeof factoryOrValue === 'function' ? factoryOrValue : () => factoryOrValue;
    this.factories.set(token, { factory, singleton });
    this.instances.delete(token);
    return this;
  }

  inject(token) {
    if (this.instances.has(token)) return this.instances.get(token);
    const entry = this.factories.get(token);
    if (!entry) {
      if (this.parent) return this.parent.inject(token);
      throw new Error(`Aeon DI: no provider registered for ${String(token)}`);
    }
    const value = entry.factory(this);
    if (entry.singleton) this.instances.set(token, value);
    return value;
  }

  has(token) {
    return this.factories.has(token) || (this.parent ? this.parent.has(token) : false);
  }

  /** Create a scoped child container (e.g. per-route or per-test). */
  createChild() {
    return new Container(this);
  }
}

const root = new Container();

/** Register on the global root container. */
export function provide(token, factoryOrValue, opts) {
  return root.provide(token, factoryOrValue, opts);
}

/** Resolve from the global root container. */
export function inject(token) {
  return root.inject(token);
}

export function createContainer() {
  return new Container();
}

export { root as rootContainer };
