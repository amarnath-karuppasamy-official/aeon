// Single source of truth for this site's routes — imported by both
// src/main.js (the client entry) and src/ssg.js (the prerender entry), so
// the two never drift.
//
// GitHub Pages base-path note: this deploys as a PROJECT page at
// https://amarnath-karuppasamy-official.github.io/aeon/, so every real URL
// lives under /aeon/. @aeon-framework/router (packages/router/src/index.js)
// matches `window.location.pathname` directly against whatever `path`
// strings a route table registers — it has no "basename" concept (yet).
// The honest, non-framework-changing fix for *this app* is to bake the
// `/aeon` prefix directly into every route's path here, and to route every
// internal link through this module's `link()` (a thin wrapper around
// @aeon-framework/router's own `link()`) so every `<a href>` and every
// `router.navigate()` call agrees with it. index.html's own asset paths
// (`<script src="/aeon/main.js">`) are prefixed the same way.
import { createRouter, outlet, link as routerLink } from '@aeon-framework/router';
import Home from './pages/Home.js';
import DocsIndex from './pages/docs/Index.js';
import GettingStarted from './pages/docs/GettingStarted.js';
import CoreConcepts from './pages/docs/CoreConcepts.js';
import RoutingFormsDi from './pages/docs/RoutingFormsDi.js';
import Rendering from './pages/docs/Rendering.js';
import Tooling from './pages/docs/Tooling.js';
import Interop from './pages/docs/Interop.js';
import Testing from './pages/docs/Testing.js';
import NotFound from './pages/NotFound.js';

export const BASE = '/aeon';

// The docs sidebar's nav order + labels — shared by DocsLayout so every
// docs page renders the identical sidebar.
export const DOCS_NAV = [
  { path: `${BASE}/docs`, label: 'Overview' },
  { path: `${BASE}/docs/getting-started`, label: 'Getting started' },
  { path: `${BASE}/docs/core-concepts`, label: 'Core concepts' },
  { path: `${BASE}/docs/routing-forms-di`, label: 'Routing, forms & DI' },
  { path: `${BASE}/docs/rendering`, label: 'SSR, SSG & rendering' },
  { path: `${BASE}/docs/tooling`, label: 'CLI, analysis & tooling' },
  { path: `${BASE}/docs/interop`, label: 'Interop & migration' },
  { path: `${BASE}/docs/testing`, label: 'Testing' },
];

export const router = createRouter(
  [
    { path: `${BASE}/`, component: Home },
    { path: `${BASE}/docs`, component: DocsIndex },
    { path: `${BASE}/docs/getting-started`, component: GettingStarted },
    { path: `${BASE}/docs/core-concepts`, component: CoreConcepts },
    { path: `${BASE}/docs/routing-forms-di`, component: RoutingFormsDi },
    { path: `${BASE}/docs/rendering`, component: Rendering },
    { path: `${BASE}/docs/tooling`, component: Tooling },
    { path: `${BASE}/docs/interop`, component: Interop },
    { path: `${BASE}/docs/testing`, component: Testing },
    { path: '*', component: NotFound },
  ],
  { mode: 'history' }
);

export { outlet };

/** This site's internal-navigation helper — always goes through the router. */
export function link(to, children) {
  return routerLink(router, to, children);
}
