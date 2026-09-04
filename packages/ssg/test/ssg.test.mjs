import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { html } from '@aeon-framework/core';
import { createRouter, outlet } from '@aeon-framework/router';
import { prerender } from '../src/index.js';

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aeon-ssg-'));
}

function Home() {
  return html`<h1>Home</h1>`;
}
function About() {
  return html`<h1>About</h1>`;
}
function UserDetail({ params }) {
  return html`<h1>User ${params.id}</h1>`;
}

function buildApp(router) {
  return function App() {
    return html`<main>${() => outlet(router)}</main>`;
  };
}

test('prerender() writes real index.html for "/" with the real SSR-rendered content', async () => {
  const router = createRouter([
    { path: '/', component: Home },
    { path: '/about', component: About },
  ]);
  const App = buildApp(router);
  const outDir = mktemp();
  try {
    const written = await prerender({ router, App, outDir });
    assert.equal(written.length, 2);

    const indexFile = path.join(outDir, 'index.html');
    assert.ok(fs.existsSync(indexFile));
    const indexContent = fs.readFileSync(indexFile, 'utf8');
    assert.match(indexContent, /<h1>Home<\/h1>/);
    assert.doesNotMatch(indexContent, /<h1>About<\/h1>/);
    assert.match(indexContent, /data-ssr="1"/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('prerender() writes /about as about/index.html (clean-URL convention) with genuinely different content than "/"', async () => {
  const router = createRouter([
    { path: '/', component: Home },
    { path: '/about', component: About },
  ]);
  const App = buildApp(router);
  const outDir = mktemp();
  try {
    await prerender({ router, App, outDir });
    const aboutFile = path.join(outDir, 'about', 'index.html');
    assert.ok(fs.existsSync(aboutFile));
    const aboutContent = fs.readFileSync(aboutFile, 'utf8');
    assert.match(aboutContent, /<h1>About<\/h1>/);
    assert.doesNotMatch(aboutContent, /<h1>Home<\/h1>/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('prerender() throws a clear error when a dynamic route has no concrete paths provided', async () => {
  const router = createRouter([
    { path: '/', component: Home },
    { path: '/users/:id', component: UserDetail },
  ]);
  const App = buildApp(router);
  const outDir = mktemp();
  try {
    await assert.rejects(
      () => prerender({ router, App, outDir }),
      (err) => {
        assert.match(err.message, /\/users\/:id/);
        assert.match(err.message, /paths/);
        return true;
      }
    );
    // Nothing should have been written for the unresolved dynamic route.
    assert.equal(fs.existsSync(path.join(outDir, 'users')), false);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('prerender() with explicit concrete paths for a dynamic route writes real, genuinely different HTML per instance', async () => {
  const router = createRouter([
    { path: '/', component: Home },
    { path: '/about', component: About },
    { path: '/users/:id', component: UserDetail },
  ]);
  const App = buildApp(router);
  const outDir = mktemp();
  try {
    const written = await prerender({ router, App, outDir, paths: ['/users/1', '/users/2'] });
    assert.equal(written.length, 4); // '/', '/about', '/users/1', '/users/2'

    const user1 = fs.readFileSync(path.join(outDir, 'users', '1', 'index.html'), 'utf8');
    const user2 = fs.readFileSync(path.join(outDir, 'users', '2', 'index.html'), 'utf8');
    assert.match(user1, /<h1>User 1/);
    assert.match(user2, /<h1>User 2/);
    assert.notEqual(user1, user2);

    const home = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    const about = fs.readFileSync(path.join(outDir, 'about', 'index.html'), 'utf8');
    assert.match(home, /<h1>Home<\/h1>/);
    assert.match(about, /<h1>About<\/h1>/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('prerender() injects into a real provided shell file (index.html template)', async () => {
  const router = createRouter([{ path: '/', component: Home }]);
  const App = buildApp(router);
  const outDir = mktemp();
  const shellDir = mktemp();
  const shellPath = path.join(shellDir, 'index.html');
  fs.writeFileSync(
    shellPath,
    '<!doctype html><html><head><title>My App</title></head><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>\n'
  );
  try {
    await prerender({ router, App, outDir, shellPath });
    const content = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    assert.match(content, /<title>My App<\/title>/);
    assert.match(content, /<div id="app" data-ssr="1"><main><h1>Home<\/h1>/);
    assert.match(content, /src="\/main\.js"/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(shellDir, { recursive: true, force: true });
  }
});
