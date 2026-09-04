import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Fixtures live INSIDE the repo (packages/cli/test/.tmp-fixtures), not
// os.tmpdir() — same reasoning as dev-spa-fallback.test.mjs: Node/esbuild's
// module resolution walks up from here and finds the workspace root's
// hoisted node_modules, so the fixture app resolves the real, current
// @aeon-framework/core, @aeon-framework/router, @aeon-framework/ssr and
// @aeon-framework/ssg with no separate install step.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliBin = path.join(__dirname, '..', 'bin', 'aeon.mjs');
const fixturesRoot = path.join(__dirname, '.tmp-fixtures');

function runCli(args, cwd) {
  return execFileSync(process.execPath, [cliBin, ...args], { cwd, encoding: 'utf8' });
}

function mktemp(prefix) {
  fs.mkdirSync(fixturesRoot, { recursive: true });
  return fs.mkdtempSync(path.join(fixturesRoot, prefix));
}

function writeFixtureApp(dir, { withDynamicRoute = false } = {}) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<!doctype html><html><head><title>Fixture App</title></head><body><div id="app"></div><script type="module" src="/.aeon/dev/main.js"></script></body></html>\n'
  );
  fs.writeFileSync(
    path.join(dir, 'src', 'main.js'),
    [
      "import { mount } from '@aeon-framework/core';",
      "import { router, App } from './ssg.js';",
      'router.start();',
      "mount(App, document.getElementById('app'));",
      '',
    ].join('\n')
  );

  const ssgLines = [
    "import { html } from '@aeon-framework/core';",
    "import { createRouter, outlet } from '@aeon-framework/router';",
    '',
    "function Home() { return html`<h1>Home Page</h1>`; }",
    "function About() { return html`<h1>About Page</h1>`; }",
  ];
  if (withDynamicRoute) {
    ssgLines.push('function UserDetail({ params }) { return html`<h1>User ' + '${params.id}' + '</h1>`; }');
  }
  ssgLines.push(
    '',
    'export const router = createRouter([',
    "  { path: '/', component: Home },",
    "  { path: '/about', component: About },"
  );
  if (withDynamicRoute) ssgLines.push("  { path: '/users/:id', component: UserDetail },");
  ssgLines.push(
    ']);',
    '',
    'export function App() {',
    '  return html`<main>' + '${() => outlet(router)}' + '</main>`;',
    '}',
    ''
  );
  if (withDynamicRoute) ssgLines.push("export const paths = ['/users/1', '/users/2'];", '');

  fs.writeFileSync(path.join(dir, 'src', 'ssg.js'), ssgLines.join('\n'));
}

test('aeon prerender writes real, per-route static HTML files to dist/ using the real SSR renderer', () => {
  const dir = mktemp('prerender-');
  try {
    writeFixtureApp(dir);
    const out = runCli(['prerender', dir], dir);
    assert.match(out, /prerender complete: 2 page\(s\)/);

    const indexFile = path.join(dir, 'dist', 'index.html');
    const aboutFile = path.join(dir, 'dist', 'about', 'index.html');
    assert.ok(fs.existsSync(indexFile), 'dist/index.html exists');
    assert.ok(fs.existsSync(aboutFile), 'dist/about/index.html exists');

    const indexContent = fs.readFileSync(indexFile, 'utf8');
    const aboutContent = fs.readFileSync(aboutFile, 'utf8');
    assert.match(indexContent, /<h1>Home Page<\/h1>/);
    assert.doesNotMatch(indexContent, /<h1>About Page<\/h1>/);
    assert.match(aboutContent, /<h1>About Page<\/h1>/);
    assert.doesNotMatch(aboutContent, /<h1>Home Page<\/h1>/);
    assert.match(indexContent, /<title>Fixture App<\/title>/);
    // The client bundle was built too (same as `aeon build`), so the
    // prerendered page can hydrate.
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'main.js')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('aeon prerender handles a dynamic route via an exported `paths` list, writing genuinely different HTML per instance', () => {
  const dir = mktemp('prerender-dyn-');
  try {
    writeFixtureApp(dir, { withDynamicRoute: true });
    const out = runCli(['prerender', dir], dir);
    assert.match(out, /prerender complete: 4 page\(s\)/);

    const user1 = fs.readFileSync(path.join(dir, 'dist', 'users', '1', 'index.html'), 'utf8');
    const user2 = fs.readFileSync(path.join(dir, 'dist', 'users', '2', 'index.html'), 'utf8');
    assert.match(user1, /<h1>User 1/);
    assert.match(user2, /<h1>User 2/);
    assert.notEqual(user1, user2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('aeon prerender fails clearly when the app has no src/ssg.js entry', () => {
  const dir = mktemp('prerender-missing-');
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'main.js'), `import { mount, html } from '@aeon-framework/core';\nmount(() => html\`<p>hi</p>\`, document.getElementById('app'));\n`);
    assert.throws(() => runCli(['prerender', dir], dir), (err) => {
      assert.match(err.stderr.toString(), /src\/ssg/);
      return true;
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
