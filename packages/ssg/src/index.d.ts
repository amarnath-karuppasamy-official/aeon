// Type declarations for @aeon-framework/ssg. Hand-written to match
// src/index.js — keep in sync by hand when the JS API changes.
import type { Router } from '@aeon-framework/router';

export interface PrerenderedPage {
  /** The URL pathname this page was rendered for, e.g. '/users/1'. */
  path: string;
  /** Absolute path of the `.html` file written to disk. */
  file: string;
  /** The raw rendered HTML fragment (before shell injection) for this path. */
  html: string;
}

export interface PrerenderOptions {
  /** An already-created @aeon-framework/router Router — its `routes` table
   * is the source of truth for what each path resolves to, and `App`
   * (below) must be the same component that closes over this instance via
   * `outlet(router)`. */
  router: Router;
  /** Root component function rendered via @aeon-framework/ssr's
   * `renderToString()` for each path, after `router.navigate(path)`. */
  App: (props?: unknown) => unknown;
  /** Directory static `.html` files are written into. */
  outDir: string;
  /** Path to an `index.html` shell file containing a `<div id="app"></div>`
   * mount point to inject rendered content into. Omit to use a minimal
   * built-in shell. */
  shellPath?: string;
  /**
   * Concrete pathnames to prerender for any DYNAMIC route (one with a
   * `:param` segment, e.g. '/users/:id') — required for every such route in
   * `router.routes`, since prerender() cannot guess route params. Also
   * accepts extra concrete paths for otherwise-static routes.
   */
  paths?: string[];
}

/**
 * Statically prerender routes to real `.html` files on disk, using the real
 * `@aeon-framework/ssr` renderer (no separate string renderer). Static
 * routes (no `:param`, not `*`) are included automatically; a dynamic
 * route throws unless `paths` supplies concrete instances of it.
 *
 * File convention (clean URLs): `/` -> `index.html`, `/about` ->
 * `about/index.html`, `/users/1` -> `users/1/index.html`.
 */
export function prerender(options: PrerenderOptions): Promise<PrerenderedPage[]>;
