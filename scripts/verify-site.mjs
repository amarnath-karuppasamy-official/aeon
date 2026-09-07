// Verifies the real prerendered output of site/ end to end against a real
// headless Chromium, the same pattern scripts/verify-interop-*.mjs use.
//
// The static file server below serves `site/dist` (the parent of
// `site/dist/aeon/`, which `npm run site:prerender` leaves as a
// self-contained tree — see scripts/finish-site-build.mjs for why) at its
// root, so a request for `/aeon/...` resolves through the on-disk `aeon/`
// subfolder exactly the way GitHub Pages will resolve
// `https://amarnath-karuppasamy-official.github.io/aeon/...` once deployed
// (GitHub's Pages hosting contributes that `/aeon/` prefix for this
// project page; we deploy `site/dist/aeon` — see
// .github/workflows/deploy-pages.yml). This is the most faithful local
// simulation available without actually deploying.
//
// Checks:
//   1. Home page loads with the real hero heading.
//   2. Two docs pages load DIRECTLY (simulating a hard refresh / someone
//      pasting the URL) with the real, already-prerendered <h1> content —
//      not a 404, not a blank shell waiting on client JS.
//   3. Client-side navigation via a sidebar link updates the page (title +
//      URL) WITHOUT a full page reload.
//   4. The shipped main.js really carries `__aeonPrecompiled` (AOT
//      milestone 2 actually wired into this build), and no console/page
//      errors occurred anywhere above.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { chromiumLaunchOptions } from './lib/launch-browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', 'site', 'dist');
const PORT = 8912;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

// A plain static file server with the one behavior every real static host
// (GitHub Pages included) provides for "clean URLs": a directory request
// resolves to that directory's index.html.
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, urlPath);
  if (urlPath.endsWith('/') || !path.extname(urlPath)) {
    filePath = path.join(filePath, 'index.html');
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 not found: ' + urlPath);
      return;
    }
    serveFile(res, filePath);
  });
});

await new Promise((resolve) => server.listen(PORT, resolve));
console.log(`static server for site/dist running at http://localhost:${PORT}`);

const results = {};
const errors = [];
let pass = true;
function check(name, condition, detail) {
  results[name] = condition ? 'PASS' : 'FAIL';
  if (!condition) {
    pass = false;
    console.error(`FAIL: ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    console.log(`PASS: ${name}`);
  }
}

const browser = await chromium.launch(chromiumLaunchOptions());
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || String(e))));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console.error: ' + m.text());
});

try {
  // 1. Home page
  await page.goto(`http://localhost:${PORT}/aeon/`, { waitUntil: 'load' });
  const heroHeading = await page.textContent('h1.hero-title').catch(() => null);
  check('home page loads with the real hero heading', heroHeading && heroHeading.includes('signal-first'), `got: ${heroHeading}`);

  // 2a. Direct-load a docs page (simulates a hard refresh on a deep URL —
  // GitHub Pages has no server-side router, so this must be a real,
  // already-prerendered file, not a client-side-only route).
  await page.goto(`http://localhost:${PORT}/aeon/docs/routing-forms-di`, { waitUntil: 'load' });
  const routingH1 = await page.textContent('h1').catch(() => null);
  check('direct-load /aeon/docs/routing-forms-di serves real prerendered content', routingH1 === 'Routing, forms & DI', `got: ${routingH1}`);
  const activeLink = await page.getAttribute('.docs-nav-link.active', 'href').catch(() => null);
  check('docs sidebar marks the current page active on direct load', activeLink === '/aeon/docs/routing-forms-di', `got: ${activeLink}`);

  // 2b. Another docs page, direct load.
  await page.goto(`http://localhost:${PORT}/aeon/docs/testing`, { waitUntil: 'load' });
  const testingH1 = await page.textContent('h1').catch(() => null);
  check('direct-load /aeon/docs/testing serves real prerendered content', testingH1 === 'Testing', `got: ${testingH1}`);

  // 2c. The docs overview page too, since it anchors the honest
  // "what's real vs. what's next" section.
  await page.goto(`http://localhost:${PORT}/aeon/docs`, { waitUntil: 'load' });
  const overviewHasHonesty = await page.textContent('body').then((t) => t.includes("What's real vs. what's next"));
  check('docs overview includes the honest "what\'s real vs. what\'s next" section', overviewHasHonesty);

  // 3. Client-side navigation: from the docs overview, click a sidebar link
  // and confirm the page updates WITHOUT a full reload (a global marker
  // survives only if the document was never torn down).
  await page.evaluate(() => {
    window.__noReloadMarker = true;
  });
  await page.click('a.docs-nav-link:has-text("Getting started")');
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Getting started');
  const markerSurvived = await page.evaluate(() => window.__noReloadMarker === true);
  const urlAfterClick = await page.evaluate(() => location.pathname);
  check('sidebar client-side navigation updates the page without a full reload', markerSurvived, 'window marker was lost — a full navigation occurred');
  check('sidebar client-side navigation updates the URL via the router', urlAfterClick === '/aeon/docs/getting-started', `got: ${urlAfterClick}`);

  // 4. AOT precompile really shipped in the bundle.
  const mainJs = fs.readFileSync(path.join(ROOT, 'aeon', 'main.js'), 'utf8');
  check('shipped main.js carries __aeonPrecompiled (AOT milestone 2 active)', mainJs.includes('__aeonPrecompiled'));

  // 5. No console/page errors accumulated across any of the above.
  check('no console or page errors across the whole run', errors.length === 0, JSON.stringify(errors));
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== verify-site results ===');
console.log(JSON.stringify(results, null, 2));
if (errors.length) console.log('errors:', errors);
console.log(pass ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(pass ? 0 : 1);
