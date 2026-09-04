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
 *
 * A route may carry a `guard: (to, from) => boolean | string | Promise<boolean | string>`
 * (Angular calls this `CanActivate`). Returning/resolving `true` allows the
 * navigation; `false` blocks it (the `location`/`matched` signals are left
 * untouched — navigation silently stays put); a path string redirects there
 * instead (the redirect target's own guard, if any, is evaluated too, up to
 * a bounded chain length). `to`/`from` are the raw pathnames involved.
 * `navigate()` genuinely awaits an async guard before committing anything —
 * the signals never update mid-flight, only once the guard has resolved.
 */
export function createRouter(routeTable, { mode = 'history' } = {}) {
  const routes = routeTable.map((r) => ({ ...r, _compiled: compilePath(r.path === '*' ? '/*' : r.path) }));
  const notFound = routes.find((r) => r.path === '*');

  const location = signal(typeof window !== 'undefined' ? currentPath(mode) : '/');
  const matched = signal(null);
  // Populated synchronously below when the starting route carries no guard
  // (matching the pre-guard behavior: `matched` usable immediately, before
  // start() is ever called). A guarded starting route instead waits for
  // start()'s initial sync (or an explicit navigate()) to resolve it — see
  // "confirm router.start()'s initial sync also respects a guard" in the
  // package's test suite.

  function currentPath(m) {
    if (m === 'hash') return window.location.hash.slice(1) || '/';
    return window.location.pathname || '/';
  }

  function match(pathname) {
    return matchRoute(routes, pathname) || (notFound ? { route: notFound, params: {} } : null);
  }

  function commit(path) {
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

  /**
   * Resolve `path` through its route's guard (if any), then either commit it
   * (`applyUrl(path)` is called first so the browser URL matches) or, for a
   * redirect/block result, do the right thing instead. Returns a Promise
   * when a guard is async, undefined otherwise (so a synchronous/no-guard
   * navigation stays fully synchronous, same as before guards existed).
   */
  function resolve(path, applyUrl, depth = 0) {
    if (depth > 20) {
      // Runaway redirect chain (a guard cycle) — commit where we are rather
      // than looping forever.
      applyUrl(path);
      commit(path);
      return;
    }
    const next = match(path);
    const guard = next && next.route.guard;
    if (!guard) {
      applyUrl(path);
      commit(path);
      return;
    }
    const from = location.peek();
    const result = guard(path, from);
    if (result && typeof result.then === 'function') {
      return result.then((r) => settle(r, path, applyUrl, depth));
    }
    return settle(result, path, applyUrl, depth);
  }

  function settle(result, path, applyUrl, depth) {
    if (result === false) return; // blocked: signals + URL stay exactly as they were
    if (typeof result === 'string') return resolve(result, applyUrl, depth + 1);
    applyUrl(path);
    commit(path);
  }

  function sync() {
    // Called after the browser URL has already changed (popstate/hashchange,
    // or start()'s initial call). Normally there's nothing left to *apply*
    // to the URL — it already matches. The exception is a guard that
    // redirects: the address bar should end up reflecting the redirect
    // target too, so it's corrected in place (replaceState / hash-set)
    // rather than left showing the originally-requested URL.
    const requested = currentPath(mode);
    return resolve(requested, (finalPath) => {
      if (finalPath === requested) return;
      if (mode === 'hash') {
        window.location.hash = finalPath;
        return;
      }
      window.history.replaceState({}, '', finalPath);
    });
  }

  function navigate(path, { replace = false } = {}) {
    if (typeof window === 'undefined') return;
    return resolve(path, (finalPath) => {
      if (mode === 'hash') {
        // Matches pre-guard behavior: hash-mode navigation always sets
        // `location.hash` (the `replace` flag only affects history mode).
        window.location.hash = finalPath;
        return;
      }
      if (replace) window.history.replaceState({}, '', finalPath);
      else window.history.pushState({}, '', finalPath);
    });
  }

  function start() {
    if (typeof window === 'undefined') return () => {};
    const evt = mode === 'hash' ? 'hashchange' : 'popstate';
    window.addEventListener(evt, sync);
    sync();
    return () => window.removeEventListener(evt, sync);
  }

  // Establish an initial `matched` value synchronously when possible (no
  // guard on the starting route) so `router.matched`/`router.current` are
  // usable immediately, without requiring start() first — same as before
  // guards existed. A guarded starting route is intentionally left
  // unresolved until start() (or navigate()) runs its guard for real.
  {
    const startPath = location.peek();
    const startMatch = match(startPath);
    if (!startMatch || !startMatch.route.guard) matched.value = startMatch;
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
