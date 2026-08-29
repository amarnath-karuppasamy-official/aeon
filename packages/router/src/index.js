// Aeon router: a signal *is* the current route. Navigation writes to it,
// every subscriber (the outlet, nav-highlighting, guards) updates in lockstep
// with the rest of the reactive graph — no separate router-state system.
import { signal, html } from '@aeon-framework/core';

function compilePath(path) {
  const keys = [];
  const pattern = path
    .replace(/\/*$/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      if (segment === '*') {
        keys.push('wildcard');
        return '(.*)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^/${pattern}/?$`), keys };
}

function matchRoute(routes, pathname) {
  for (const route of routes) {
    const { regex, keys } = route._compiled;
    const m = regex.exec(pathname || '/');
    if (m) {
      const params = {};
      keys.forEach((key, i) => (params[key] = m[i + 1]));
      return { route, params };
    }
  }
  return null;
}

/**
 * Create a router from a route table:
 *   createRouter([{ path: '/', component: Home }, { path: '/users/:id', component: User }])
 */
export function createRouter(routeTable, { mode = 'history' } = {}) {
  const routes = routeTable.map((r) => ({ ...r, _compiled: compilePath(r.path === '*' ? '/*' : r.path) }));
  const notFound = routes.find((r) => r.path === '*');

  const location = signal(typeof window !== 'undefined' ? currentPath(mode) : '/');
  const matched = signal(match(location.peek()));

  function currentPath(m) {
    if (m === 'hash') return window.location.hash.slice(1) || '/';
    return window.location.pathname || '/';
  }

  function match(pathname) {
    return matchRoute(routes, pathname) || (notFound ? { route: notFound, params: {} } : null);
  }

  function sync() {
    const path = currentPath(mode);
    location.value = path;
    const next = match(path);
    // Avoid forcing a remount when the route hasn't actually changed: a fresh
    // object from match() is never Object.is-equal to the previous one, so we
    // compare shape instead of letting object identity thrash every subscriber.
    const prev = matched.peek();
    const same =
      prev &&
      next &&
      prev.route === next.route &&
      JSON.stringify(prev.params) === JSON.stringify(next.params);
    if (!same) matched.value = next;
  }

  function navigate(path, { replace = false } = {}) {
    if (typeof window === 'undefined') return;
    if (mode === 'hash') {
      window.location.hash = path;
      return; // hashchange listener will sync()
    }
    if (replace) window.history.replaceState({}, '', path);
    else window.history.pushState({}, '', path);
    sync();
  }

  function start() {
    if (typeof window === 'undefined') return () => {};
    const evt = mode === 'hash' ? 'hashchange' : 'popstate';
    window.addEventListener(evt, sync);
    sync();
    return () => window.removeEventListener(evt, sync);
  }

  return {
    /** Reactive: { route, params } for whatever currently matches. */
    get current() {
      return matched.value;
    },
    location,
    matched,
    navigate,
    start,
    routes,
    mode,
  };
}

/** Bind inside a template: `${() => outlet(router)}` renders the matched component. */
export function outlet(router) {
  const current = router.matched.value;
  if (!current) return null;
  return current.route.component({ params: current.params });
}

/** A navigable link that uses the router instead of a full page load. */
export function link(router, to, children) {
  const href = router.mode === 'hash' ? `#${to}` : to;
  return html`<a
    href=${href}
    @click=${(e) => {
      e.preventDefault();
      router.navigate(to);
    }}
    >${children}</a
  >`;
}
