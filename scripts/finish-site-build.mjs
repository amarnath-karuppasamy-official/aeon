// Finishing step after `aeon prerender site`.
//
// Why this exists (the GitHub Pages base-path workaround, explained in
// full): this repo is named "aeon", so GitHub Pages serves it as a PROJECT
// page at https://amarnath-karuppasamy-official.github.io/aeon/ — GitHub's
// own Pages hosting layer contributes that `/aeon/` URL prefix automatically
// for whatever we deploy; we never nest an "aeon/" folder ourselves to get
// it. But @aeon-framework/router (packages/router/src/index.js) matches
// `window.location.pathname` directly against whatever `path` strings a
// route table registers, with no "basename" concept — and once deployed,
// the REAL pathname the browser reports is already `/aeon/...`. So
// site/src/router.js bakes that same `/aeon` prefix into every route's
// `path` string, for correct client-side matching.
//
// That single choice has a side effect: @aeon-framework/ssg's prerender()
// derives each output FILE's location from that same route path string
// (see packages/ssg/src/index.js's outputFileFor()), so prerendering a
// route table whose paths all start with `/aeon` naturally writes
// site/dist/aeon/index.html, site/dist/aeon/docs/index.html, etc. — an
// "aeon/" subfolder INSIDE dist/, alongside the top-level dist/main.js
// that `aeon build` (run first, as part of `aeon prerender`) wrote at the
// outDir root, unprefixed, because esbuild's bundler output path has
// nothing to do with the app's route table.
//
// The fix is deliberately NOT to touch the framework (prerender()'s
// file-path-follows-route-path convention is a reasonable general default,
// and every other example/fixture in this repo relies on paths with no
// project-page prefix at all): this script copies the one file that
// actually needs to live alongside the prerendered pages — dist/main.js
// (+ its sourcemap) — into dist/aeon/, so dist/aeon/ is a fully
// self-contained tree. We then deploy dist/aeon/ (not dist/) as the Pages
// artifact root (see .github/workflows/deploy-pages.yml) — GitHub's own
// `/aeon/` project-page prefix lines up with our route paths with no
// double-nesting, and locally, serving `site/dist` as a plain static root
// and requesting `/aeon/...` reproduces the exact same tree GitHub Pages
// will serve (see scripts/verify-site.mjs).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'site', 'dist');
const nested = path.join(root, 'aeon');

if (!fs.existsSync(nested)) {
  console.error(`[finish-site-build] ${nested} does not exist — did \`aeon prerender site\` run first?`);
  process.exit(1);
}

for (const file of ['main.js', 'main.js.map']) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, path.join(nested, file));
  console.log(`[finish-site-build] copied ${file} -> dist/aeon/${file}`);
}

console.log(`[finish-site-build] dist/aeon/ is now a self-contained tree — deploy it (not dist/) as the Pages artifact root.`);
