import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createRouter, outlet } from '../src/index.js';

function installWindow(url = 'http://localhost/') {
  const window = new Window({ url });
  globalThis.window = window;
  globalThis.document = window.document;
  for (const key of ['Node', 'Element', 'HTMLElement', 'Event', 'CustomEvent', 'MouseEvent']) {
    if (key in window) {
      try {
        globalThis[key] = window[key];
      } catch {
        /* ignore */
      }
    }
  }
  return window;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('navigate() to an unguarded route commits synchronously', () => {
  installWindow();
  const router = createRouter([
    { path: '/', component: () => 'home' },
    { path: '/about', component: () => 'about' },
  ]);
  router.navigate('/about');
  assert.equal(router.location.value, '/about');
  assert.equal(router.matched.value.route.path, '/about');
});

test('a guard returning false blocks navigation: matched stays on the previous route', () => {
  installWindow();
  const router = createRouter([
    { path: '/', component: () => 'home' },
    { path: '/admin', component: () => 'admin', guard: () => false },
  ]);
  router.navigate('/');
  assert.equal(router.matched.value.route.path, '/');

  const result = router.navigate('/admin');
  // Synchronous guard -> navigate() itself doesn't return a pending promise
  // that needs awaiting for the block to take effect.
  assert.equal(router.location.value, '/');
  assert.equal(router.matched.value.route.path, '/');
  assert.equal(result, undefined);
});

test('a guard returning a path string redirects there instead of the requested route', () => {
  installWindow();
  const router = createRouter([
    { path: '/', component: () => 'home' },
    { path: '/admin', component: () => 'admin', guard: () => '/login' },
    { path: '/login', component: () => 'login' },
  ]);
  router.navigate('/admin');
  assert.equal(router.location.value, '/login');
  assert.equal(router.matched.value.route.path, '/login');
});

test('an async guard is genuinely awaited by navigate() before the signals update (no race)', async () => {
  installWindow();
  let resolveGuard;
  const guardPromise = new Promise((resolve) => {
    resolveGuard = resolve;
  });
  const router = createRouter([
    { path: '/', component: () => 'home' },
    {
      path: '/reports',
      component: () => 'reports',
      guard: () =>
        guardPromise.then(() => {
          return true;
        }),
    },
  ]);
  router.navigate('/');

  const navigatePromise = router.navigate('/reports');
  // Guard hasn't resolved yet — must not have committed.
  await sleep(20);
  assert.equal(router.location.value, '/', 'still on the previous route while the guard is pending');

  // Resolve the guard asynchronously (via setTimeout) — proves navigate()
  // really awaits it rather than racing ahead.
  setTimeout(() => resolveGuard(), 20);
  await navigatePromise;

  assert.equal(router.location.value, '/reports');
  assert.equal(router.matched.value.route.path, '/reports');
});

test('an async guard that redirects is awaited too, and the router ends up on the redirect target', async () => {
  installWindow();
  const router = createRouter([
    { path: '/', component: () => 'home' },
    {
      path: '/admin',
      component: () => 'admin',
      guard: () => new Promise((resolve) => setTimeout(() => resolve('/login'), 10)),
    },
    { path: '/login', component: () => 'login' },
  ]);
  await router.navigate('/admin');
  assert.equal(router.location.value, '/login');
  assert.equal(router.matched.value.route.path, '/login');
});

test("router.start()'s initial sync respects a guard on the starting URL: a blocking guard leaves matched unresolved", () => {
  installWindow('http://localhost/admin');
  const router = createRouter([
    { path: '/', component: () => 'home' },
    { path: '/admin', component: () => 'admin', guard: () => false },
  ]);
  // Guarded starting route: unlike the unguarded case, `matched` is not
  // populated until start() actually runs (and resolves) the guard.
  assert.equal(router.matched.value, null);
  router.start();
  assert.equal(router.matched.value, null, 'blocked: never activated');
});

test("router.start()'s initial sync respects a guard on the starting URL: a redirecting guard lands on the redirect target and fixes the address bar", () => {
  installWindow('http://localhost/admin');
  const router = createRouter([
    { path: '/', component: () => 'home' },
    { path: '/admin', component: () => 'admin', guard: () => '/login' },
    { path: '/login', component: () => 'login' },
  ]);
  router.start();
  assert.equal(router.matched.value.route.path, '/login');
  assert.equal(window.location.pathname, '/login');
});

test("router.start()'s initial sync respects an unguarded starting route immediately (no start() needed)", () => {
  installWindow('http://localhost/about');
  const router = createRouter([
    { path: '/', component: () => 'home' },
    { path: '/about', component: () => 'about' },
  ]);
  assert.equal(router.matched.value.route.path, '/about');
});

test('outlet() renders nothing for a blocked route (no component from the blocked route ever runs)', () => {
  installWindow();
  let adminRendered = 0;
  const router = createRouter([
    { path: '/', component: () => 'home' },
    {
      path: '/admin',
      component: () => {
        adminRendered++;
        return 'admin';
      },
      guard: () => false,
    },
  ]);
  router.navigate('/');
  router.navigate('/admin');
  const out = outlet(router);
  assert.equal(out, 'home');
  assert.equal(adminRendered, 0);
});
