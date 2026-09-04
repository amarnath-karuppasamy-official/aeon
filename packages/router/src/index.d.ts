// Type declarations for @aeon-framework/router. Hand-written to match
// src/index.js — keep in sync by hand when the JS API changes.
import type { Signal, ReadonlySignal, TemplateResult, Component } from '@aeon-framework/core';

export interface RouteParams {
  [key: string]: string | undefined;
}

/**
 * `CanActivate`-style route guard. Return (or resolve to) `true` to allow
 * the navigation, `false` to block it (the router's `location`/`matched`
 * signals are left untouched), or a path string to redirect there instead
 * (the redirect target's own guard, if any, runs too). `navigate()` awaits
 * a promise-returning guard before committing anything.
 */
export type RouteGuard = (to: string, from: string) => boolean | string | Promise<boolean | string>;

export interface RouteDefinition {
  /** e.g. '/', '/users/:id', or '*' for a catch-all/not-found route. */
  path: string;
  component: Component<{ params: RouteParams }>;
  /** Optional `CanActivate`-style guard run before this route is entered. */
  guard?: RouteGuard;
}

export interface MatchedRoute {
  route: RouteDefinition;
  params: RouteParams;
}

export interface Router {
  /** Reactive: current { route, params }, or null if nothing matched and
   * there's no catch-all route. */
  readonly current: MatchedRoute | null;
  /** Reactive: the current pathname (or hash fragment in hash mode). */
  location: Signal<string>;
  /** Reactive: same as `current`, exposed as a signal for direct binding. */
  matched: Signal<MatchedRoute | null>;
  /**
   * Navigate to `path`. If the matched route (or a route it redirects to)
   * carries a `guard`, it is run (and awaited, if async) before `location`/
   * `matched` update — a `false` result leaves them untouched, a string
   * result redirects instead. Returns a Promise when a guard is async,
   * `undefined` for a synchronous/unguarded navigation.
   */
  navigate(path: string, opts?: { replace?: boolean }): void | Promise<void>;
  /** Wire up popstate/hashchange listening and do an initial sync. Returns
   * a function that removes the listener. */
  start(): () => void;
  routes: readonly (RouteDefinition & { _compiled: unknown })[];
  mode: 'history' | 'hash';
}

export function createRouter(
  routeTable: readonly RouteDefinition[],
  options?: { mode?: 'history' | 'hash' }
): Router;

/** Bind inside a template: `${() => outlet(router)}` renders the matched
 * component, or null if nothing matched. */
export function outlet(router: Router): TemplateResult | null;

/** A navigable link that uses the router instead of a full page load. */
export function link(router: Router, to: string, children?: unknown): TemplateResult;
