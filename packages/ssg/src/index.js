// Aeon SSG: build-time static prerendering, on top of the real
// @aeon-framework/ssr renderer — no separate/parallel string renderer here
// either. For each concrete path it drives the SAME per-request SSR pattern
// documented in @aeon-framework/ssr's README section (`router.navigate(path)`
// then `renderToString(App)`), then writes the result to a real file on
// disk, wrapped in the app's own `index.html` shell.
import fs from 'node:fs';
import path from 'node:path';
import { renderToString } from '@aeon-framework/ssr';

const DEFAULT_SHELL = '<!doctype html>\n<html>\n<head><meta charset="utf-8"></head>\n<body>\n<div id="app"></div>\n</body>\n</html>\n';

function isDynamic(routePath) {
  return routePath === '*' || routePath.split('/').some((seg) => seg.startsWith(':'));
}

/**
 * Turn a URL pathname into the on-disk file real static hosts (Netlify,
 * Vercel, GitHub Pages, nginx with `try_files`, ...) expect for a "clean
 * URL" (no trailing `.html` in the address bar): `/` -> `index.html`,
 * `/about` -> `about/index.html`, `/users/1` -> `users/1/index.html`. This
 * is the convention `prerender()` writes with; it is a deliberate choice,
 * not the only valid one (a flat `about.html` would also work with a host
 * configured for it) — documented in this package's README/CLI help.
 */
function outputFileFor(pathname) {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  if (!trimmed) return 'index.html';
  return path.join(...trimmed.split('/'), 'index.html');
}

function injectIntoShell(shellHtml, bodyHtml) {
  const marker = '<div id="app"></div>';
  if (!shellHtml.includes(marker)) {
    throw new Error(
      `prerender(): shell HTML must contain a mount point (\`${marker}\`) to inject rendered content into — none found.`
    );
  }
  return shellHtml.replace(marker, `<div id="app" data-ssr="1">${bodyHtml}</div>`);
}

/**
 * Statically prerender a set of routes to real `.html` files on disk.
 *
 * `router` must be an already-created `@aeon-framework/router` Router (the
 * same instance `App` closes over via `outlet(router)`), so its route table
 * (`router.routes`) is the single source of truth for what a path resolves
 * to. Every STATIC route (no `:param` segment, and not the `*` catch-all)
 * is prerendered automatically. A DYNAMIC route (`/users/:id`) is never
 * guessed at — prerender() has no way to know which ids exist — so it is
 * skipped from the automatic set; pass its concrete instances explicitly
 * via `paths` (e.g. `paths: ['/users/1', '/users/2']`) or prerender()
 * throws, naming exactly which dynamic route was left unprovided, rather
 * than silently skipping it.
 *
 * Returns the list of `{ path, file, html }` actually written.
 */
export async function prerender({ router, App, outDir, shellPath, paths = [] }) {
  if (!router) throw new Error('prerender(): `router` is required.');
  if (!App) throw new Error('prerender(): `App` is required.');
  if (!outDir) throw new Error('prerender(): `outDir` is required.');

  const routes = router.routes;
  const staticPaths = routes.filter((r) => !isDynamic(r.path)).map((r) => r.path);
  const explicitPaths = [...new Set(paths)];

  // Every dynamic (non-catch-all) route must have at least one concrete
  // path supplied for it in `paths` — otherwise it would be silently
  // skipped, which this package refuses to do.
  for (const route of routes) {
    if (route.path === '*' || !isDynamic(route.path)) continue;
    const covered = explicitPaths.some((p) => route._compiled.regex.test(p));
    if (!covered) {
      throw new Error(
        `prerender(): dynamic route '${route.path}' has no concrete paths to prerender. ` +
          `Pass them via \`paths\`, e.g. paths: ['/users/1', '/users/2'] — prerender() cannot guess route params.`
      );
    }
  }

  const allPaths = [...new Set([...staticPaths, ...explicitPaths])];

  const shellHtml = shellPath ? fs.readFileSync(shellPath, 'utf8') : DEFAULT_SHELL;

  fs.mkdirSync(outDir, { recursive: true });

  const written = [];
  for (const p of allPaths) {
    await router.navigate(p, { replace: true });
    const html = renderToString(App);
    const page = injectIntoShell(shellHtml, html);
    const relFile = outputFileFor(p);
    const absFile = path.join(outDir, relFile);
    fs.mkdirSync(path.dirname(absFile), { recursive: true });
    fs.writeFileSync(absFile, page);
    written.push({ path: p, file: absFile, html });
  }

  return written;
}

export { outputFileFor as __internal_outputFileFor };
