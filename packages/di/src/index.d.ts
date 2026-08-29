// Type declarations for @aeon-framework/di. Hand-written to match
// src/index.js — keep in sync by hand when the JS API changes.

/** A unique, debuggable handle for something injectable. Carrying the type
 * parameter through a Symbol lets `inject(token)` infer its return type. */
export type Token<T> = symbol & { readonly __aeonTokenType?: T };

export function createToken<T>(description: string): Token<T>;

export class Container {
  constructor(parent?: Container | null);
  parent: Container | null;

  /** Register a value, or a factory `(container) => value` (singleton by
   * default). */
  provide<T>(
    token: Token<T>,
    factoryOrValue: T | ((container: Container) => T),
    opts?: { singleton?: boolean }
  ): this;

  inject<T>(token: Token<T>): T;
  has(token: Token<unknown>): boolean;

  /** Create a scoped child container (e.g. per-route or per-test) — lookups
   * fall back to the parent when not registered locally. */
  createChild(): Container;
}

/** Register on the global root container. */
export function provide<T>(
  token: Token<T>,
  factoryOrValue: T | ((container: Container) => T),
  opts?: { singleton?: boolean }
): Container;

/** Resolve from the global root container. Throws if nothing is registered
 * for `token`. */
export function inject<T>(token: Token<T>): T;

export function createContainer(): Container;

export const rootContainer: Container;
