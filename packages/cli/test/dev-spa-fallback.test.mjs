import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Regression test for a real bug: esbuild's own dev server (what `aeon dev`
// wraps) only serves files that exist under `servedir` — it has no notion
// of client-side routing. Without a fallback, a hard refresh on any
// history-mode route other than "/" (e.g. /todo-item, matched entirely
// client-side by @aeon-framework/router) got esbuild's plain 404 instead of
// the app shell, even though the router would happily render that route
// once main.js loaded. `aeon dev` now proxies esbuild's server and serves
// index.html for any *navigation* request (no file extension) that esbuild
// 404s on — this test hits a real running dev server over real HTTP and
// checks both that the fallback kicks in for a route, and that it does NOT
// mask a genuinely missing asset (which must still 404).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliBin = path.join(__dirname, '..', 'bin', 'aeon.mjs');

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function attempt() {
      get(url).then(
        (res) => {
          // esbuild's server can answer with a transient 503 while its
          // initial build is still in flight — keep polling until it's
          // actually ready to serve real content.
          if (res.status === 200) resolve(res);
          else if (Date.now() - start > timeoutMs) reject(new Error(`dev server never became ready (last status ${res.status})`));
          else setTimeout(attempt, 200);
        },
        () => {
          if (Date.now() - start > timeoutMs) reject(new Error('dev server never came up'));
          else setTimeout(attempt, 200);
        }
      );
    })();
  });
}

test('aeon dev serves the app shell (SPA fallback) for a client-side route on hard refresh, but still 404s a real missing asset', async () => {
  // A fixture nested INSIDE the repo (not os.tmpdir(), which is outside it)
  // so Node/esbuild's module resolution walks up and finds the workspace
  // root's hoisted node_modules — the real, current @aeon-framework/core
  // and @aeon-framework/router, no separate install step, no risk of
  // testing against a stale published version.
  const fixturesRoot = path.join(__dirname, '.tmp-fixtures');
  fs.mkdirSync(fixturesRoot, { recursive: true });
  const dir = fs.mkdtempSync(path.join(fixturesRoot, 'dev-spa-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<!doctype html><html><body><div id="app"></div><script type="module" src="/.aeon/dev/main.js"></script></body></html>\n'
  );
  fs.writeFileSync(
    path.join(dir, 'src', 'main.js'),
    `
    import { mount, html } from '@aeon-framework/core';
    import { createRouter, outlet } from '@aeon-framework/router';
    const router = createRouter([
      { path: '/', component: () => html\`<h1>Home</h1>\` },
      { path: '/todo-item', component: () => html\`<h1>Todo Page</h1>\` },
    ]);
    router.start();
    function App() { return html\`<main>\${() => outlet(router)}</main>\`; }
    mount(App, document.getElementById('app'));
    `
  );

  const child = spawn(process.execPath, [cliBin, 'dev', dir], { stdio: 'ignore' });
  try {
    await waitForServer('http://localhost:5173/');

    const home = await get('http://localhost:5173/');
    assert.equal(home.status, 200);

    const refreshed = await get('http://localhost:5173/todo-item');
    assert.equal(refreshed.status, 200, 'hard refresh on a client-side route must not 404');
    assert.match(refreshed.body, /<div id="app">/, 'fallback must serve the real app shell, not a generic page');

    const bundle = await get('http://localhost:5173/.aeon/dev/main.js');
    assert.equal(bundle.status, 200, 'the actual built bundle must still be served normally');

    const missing = await get('http://localhost:5173/does-not-exist.png');
    assert.equal(missing.status, 404, 'a genuinely missing asset must still 404, not be masked by the fallback');
  } finally {
    child.kill('SIGKILL');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
