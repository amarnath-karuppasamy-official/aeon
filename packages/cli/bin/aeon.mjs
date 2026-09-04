#!/usr/bin/env node
// Aeon CLI — no config file needed for a basic app. Just enough tooling to
// scaffold, run, and build; the framework itself stays a set of small
// dependency-free ES modules.
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import esbuild from 'esbuild';
import { generators } from '../src/generate.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const target = args[1] || '.';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function log(msg) {
  console.log(`\x1b[36m[aeon]\x1b[0m ${msg}`);
}

function resolveApp(dir) {
  const root = path.resolve(process.cwd(), dir);
  // .tsx/.jsx first so an app embedding React (see examples/interop-react)
  // or written in TypeScript gets the right transform; plain Aeon apps
  // never need either and just use main.js. esbuild picks the loader from
  // the extension automatically — no separate "TS mode" to configure.
  const candidates = ['main.tsx', 'main.ts', 'main.jsx', 'main.js'].map((f) => path.join(root, 'src', f));
  const entry = candidates.find((f) => fs.existsSync(f));
  const html = path.join(root, 'index.html');
  if (!entry) {
    console.error(`Cannot find src/main.{ts,tsx,js,jsx} under ${root}.`);
    process.exit(1);
  }
  return { root, entry, html };
}

// esbuild's own dev server only serves files that exist under `servedir` —
// it has no notion of client-side routing. Without a fallback, a hard
// refresh on any route other than "/" (e.g. /todo-item with
// @aeon-framework/router in history mode) hits esbuild's server for a path
// that isn't a real file and gets a plain 404, even though the app's own
// router would happily render that route once main.js loads. Fixed with
// esbuild's documented recipe (https://esbuild.github.io/api/#serve-proxy):
// esbuild's server binds to an internal port only, and a small proxy in
// front of it serves index.html for any *navigation* request (no file
// extension) that esbuild 404s on, so the client-side router gets a chance
// to take over — matching how a production SPA host (Netlify, Vercel, etc.)
// would be configured. Real asset requests (main.js, main.js.map, css,
// images — anything with an extension) still 404 normally if truly missing.
async function dev(dir) {
  const { root, entry } = resolveApp(dir);
  const outdir = path.join(root, '.aeon', 'dev');
  const ctx = await esbuild.context({
    entryPoints: [entry],
    bundle: true,
    outfile: path.join(outdir, 'main.js'),
    sourcemap: true,
    format: 'esm',
    logLevel: 'info',
  });
  await ctx.watch();
  const { host: esbuildHost, port: esbuildPort } = await ctx.serve({ servedir: root, port: 0 });

  const PORT = 5173;
  const proxy = http.createServer((req, res) => {
    const options = {
      hostname: esbuildHost,
      port: esbuildPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };
    const proxyReq = http.request(options, (proxyRes) => {
      const isNavigationRequest = proxyRes.statusCode === 404 && path.extname(req.url.split('?')[0]) === '';
      if (isNavigationRequest) {
        // Re-request "/" from esbuild and serve that instead — lets the
        // client-side router resolve the actual route once it boots.
        http
          .request(
            { hostname: esbuildHost, port: esbuildPort, path: '/', method: 'GET', headers: { accept: 'text/html' } },
            (indexRes) => {
              res.writeHead(200, { ...indexRes.headers });
              indexRes.pipe(res, { end: true });
            }
          )
          .end();
        return;
      }
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    req.pipe(proxyReq, { end: true });
  });
  proxy.listen(PORT, () => {
    log(`dev server running at http://localhost:${PORT}`);
    log('watching for changes...');
  });
}

async function build(dir) {
  const { root, entry } = resolveApp(dir);
  const outdir = path.join(root, 'dist');
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile: path.join(outdir, 'main.js'),
    minify: true,
    sourcemap: true,
    format: 'esm',
    metafile: true,
    // Matters for apps embedding React/Vue via @aeon-framework/interop — without this,
    // those packages bundle their (much larger) development builds.
    define: { 'process.env.NODE_ENV': '"production"' },
    conditions: ['production'],
  });
  const html = path.join(root, 'index.html');
  if (fs.existsSync(html)) {
    const contents = fs.readFileSync(html, 'utf8').replace('/.aeon/dev/main.js', './main.js');
    fs.writeFileSync(path.join(outdir, 'index.html'), contents);
  }
  const bytes = fs.statSync(path.join(outdir, 'main.js')).size;
  log(`build complete: ${outdir} (main.js: ${(bytes / 1024).toFixed(1)} kB)`);
  return result;
}

/**
 * `aeon prerender [dir]` — static site generation, on top of the same
 * esbuild build() step as `aeon build`, plus @aeon-framework/ssg's real
 * SSR-backed prerender(). Convention: the app has a dedicated
 * `src/ssg.{ts,tsx,js,jsx}` entry (separate from `src/main.js`, which has
 * side effects — it calls mount() against `document` at module scope) that
 * exports:
 *   - `router`  — the app's already-created @aeon-framework/router Router
 *   - `App`     — the root component `router` closes over
 *   - `paths`   — (optional) string[] of concrete paths for any dynamic
 *                 (':param') route, same as @aeon-framework/ssg's `paths`
 * Bundled with esbuild (so TS/JSX and workspace-relative imports all work
 * exactly like `main.js` does), then imported for real and run through
 * @aeon-framework/ssg's prerender() — no separate/parallel implementation.
 */
function resolveSsgEntry(root) {
  const candidates = ['ssg.tsx', 'ssg.ts', 'ssg.jsx', 'ssg.js'].map((f) => path.join(root, 'src', f));
  return candidates.find((f) => fs.existsSync(f));
}

async function prerenderApp(dir) {
  const { root } = resolveApp(dir);
  const ssgEntry = resolveSsgEntry(root);
  if (!ssgEntry) {
    console.error(
      `Cannot find src/ssg.{ts,tsx,js,jsx} under ${root}.\n` +
        `aeon prerender needs a dedicated entry (separate from main.js) that exports ` +
        `{ router, App, paths? } — see the "SSG" section of the Aeon README.`
    );
    process.exit(1);
  }

  // Build the normal client bundle first, same as `aeon build` — the
  // prerendered HTML files still load this to hydrate on the client.
  await build(dir);

  const outdir = path.join(root, 'dist');
  const bundledEntry = path.join(root, '.aeon', 'ssg', 'entry.mjs');
  await esbuild.build({
    entryPoints: [ssgEntry],
    bundle: true,
    outfile: bundledEntry,
    platform: 'node',
    format: 'esm',
    define: { 'process.env.NODE_ENV': '"production"' },
    conditions: ['production'],
  });

  const mod = await import(`${pathToFileURL(bundledEntry).href}?t=${Date.now()}`);
  const { router, App, paths } = mod;
  if (!router || !App) {
    console.error(`${ssgEntry} must export both \`router\` and \`App\`.`);
    process.exit(1);
  }

  const { prerender } = await import('@aeon-framework/ssg');
  // Use the just-built dist/index.html as the shell (it already has main.js
  // pointed at the production bundle, not the dev-server path) rather than
  // the source index.html template build() started from.
  const shellCandidate = path.join(outdir, 'index.html');
  const shellPath = fs.existsSync(shellCandidate) ? shellCandidate : undefined;
  const written = await prerender({ router, App, outDir: outdir, shellPath, paths: paths || [] });
  for (const page of written) log(`prerendered ${page.path} -> ${path.relative(root, page.file)}`);
  log(`prerender complete: ${written.length} page(s) written to ${outdir}`);
}

function scaffold(name, { ts = false } = {}) {
  const dest = path.resolve(process.cwd(), name);
  const templateDir = path.join(__dirname, '..', ts ? 'template-ts' : 'template');
  if (fs.existsSync(dest)) {
    console.error(`${dest} already exists.`);
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });
  copyRecursive(templateDir, dest);
  log(`created new Aeon app at ${dest}${ts ? ' (TypeScript)' : ''}`);
  log(`next: cd ${name} && npm install && npx aeon dev .`);
}

function copyRecursive(src, dest) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

async function migrateFile(file) {
  const { migrate, MARKER } = await import('@aeon-framework/migrate');
  if (!file) {
    console.error(`Usage: aeon migrate <file.jsx>\n\nAdd "// ${MARKER}" as the first line of a React file, then run this on it.`);
    process.exit(1);
  }
  const source = fs.readFileSync(file, 'utf8');
  const result = migrate(source);
  if (!result.marker) {
    console.error(`No "${MARKER}" marker found in ${file} — nothing to do.`);
    process.exit(1);
  }
  log(`migrate — ${file}`);
  for (const c of result.components) {
    console.log(c.status === 'converted' ? `  \x1b[32m✓ converted\x1b[0m  ${c.name}` : `  \x1b[33m→ skipped\x1b[0m    ${c.name} — ${c.reason}`);
  }
  if (!result.output) {
    console.log('Nothing convertible found — no output file written.');
    return;
  }
  const ext = path.extname(file);
  const outExt = ext === '.jsx' || ext === '.tsx' ? '.aeon.jsx' : '.aeon.js';
  const outFile = file.slice(0, -ext.length) + outExt;
  fs.writeFileSync(outFile, result.output);
  log(`wrote ${outFile} — your original file is untouched.`);
}

/**
 * `aeon generate <kind> <Name>` / `aeon g <kind> <Name>` — scaffold a real
 * file into the conventional location (src/components, src/services,
 * src/routes) using generate.mjs's pure generator functions. Refuses to
 * overwrite an existing file, same as `aeon new`.
 */
function generate(kind, name, cwd = '.') {
  const generator = generators[kind];
  if (!generator || !name) {
    console.error(`Usage: aeon generate <component|service|route> <Name>\n  (alias: aeon g <component|service|route> <Name>)`);
    process.exit(1);
  }
  const root = path.resolve(process.cwd(), cwd);
  const { relativePath, content, name: generatedName } = generator(name);
  const dest = path.join(root, relativePath);
  if (fs.existsSync(dest)) {
    console.error(`${dest} already exists.`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  log(`generated ${kind} ${generatedName} -> ${path.relative(root, dest)}`);
  return dest;
}

/**
 * `aeon check [dir]` — static analysis (the first real milestone toward an
 * AOT compiler; see @aeon-framework/compiler's README section). Runs the
 * real analyzeProject() against `dir`'s src/ and prints every finding.
 * Exits non-zero when any `error`-severity finding exists — `warning`
 * findings are printed but don't fail the run.
 */
async function check(dir) {
  const root = path.resolve(process.cwd(), dir);
  const { analyzeProject } = await import('@aeon-framework/compiler');
  const findings = await analyzeProject({ projectDir: root });

  if (findings.length === 0) {
    log('check passed: no findings.');
    return;
  }

  for (const f of findings) {
    const tag = f.severity === 'error' ? '\x1b[31merror\x1b[0m' : '\x1b[33mwarning\x1b[0m';
    console.log(`${tag}  ${f.file}:${f.line}  [${f.rule}]  ${f.message}`);
  }

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.length - errorCount;
  log(`check found ${errorCount} error(s), ${warningCount} warning(s).`);
  if (errorCount > 0) process.exit(1);
}

function help() {
  console.log(`Aeon CLI

Usage:
  aeon new <name> [--ts]           Scaffold a new Aeon app (add --ts for the TypeScript starter)
  aeon dev [dir]                   Start the dev server (default: current directory)
  aeon build [dir]                 Production build to dist/
  aeon prerender [dir]              Static-render every route to dist/*.html (needs @aeon-framework/ssg
                                    installed + a src/ssg.js entry exporting { router, App }; see README's "SSG" section)
  aeon migrate <file>               Best-effort React -> Aeon codemod (needs @aeon-framework/migrate installed)
  aeon generate component <Name>   Scaffold src/components/<Name>.js (alias: aeon g component <Name>)
  aeon generate service <Name>     Scaffold src/services/<name>.js (alias: aeon g service <Name>)
  aeon generate route <Name>       Scaffold src/routes/<Name>.js (alias: aeon g route <Name>)
  aeon check [dir]                  Static analysis: real binding-kind footguns, unused imports,
                                    unreachable routes (see README's "Static analysis" section).
                                    Exits non-zero on any error-severity finding.
`);
}

switch (cmd) {
  case 'new':
    if (!args[1]) { help(); process.exit(1); }
    scaffold(args[1], { ts: args.includes('--ts') });
    break;
  case 'dev':
    await dev(target);
    break;
  case 'build':
    await build(target);
    break;
  case 'prerender':
    await prerenderApp(target);
    break;
  case 'migrate':
    await migrateFile(args[1]);
    break;
  case 'generate':
  case 'g':
    generate(args[1], args[2]);
    break;
  case 'check':
    await check(target);
    break;
  default:
    help();
}
