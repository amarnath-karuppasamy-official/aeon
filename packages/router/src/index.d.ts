// Type declarations for @aeon-framework/router. Hand-written to match
// src/index.js — keep in sync by hand when the JS API changes.
import type { Signal, ReadonlySignal, TemplateResult, Component } from '@aeon-framework/core';

export interface RouteParams {
  [key: string]: string | undefined;
}

export interface RouteDefinition {
  /** e.g. '/', '/users/:id', or '*' for a catch-all/not-found route. */
  path: string;
  component: Component<{ params: RouteParams }>;
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
  navigate(path: string, opts?: { replace?: boolean }): void;
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
