// Tiny dev server shared by every scripts/verify-interop-*.mjs script.
// Bundles an example app's entry file(s) under src/ with esbuild and serves
// the example's directory (so index.html + the bundled output are both
// reachable), matching the same esbuild bundling approach
// packages/cli/bin/aeon.mjs's `dev` command uses for real Aeon apps.
//
// Usage: node scripts/serve-interop.mjs <exampleDir> <port> [entryFile ...]
// With no entryFile arguments, every main*.{js,jsx,ts,tsx} file directly
// under <exampleDir>/src is bundled (each to .aeon/dev/<same-basename>.js),
// so one example directory can hold more than one HTML page — e.g.
// main.jsx (Aeon-inside-React) and reverse.jsx (React-inside-Aeon) — served
// off the same dev server.
import path from 'node:path';
import fs from 'node:fs';
import esbuild from 'esbuild';
import esbuildSvelte from 'esbuild-svelte';

const [, , dir, portArg, ...entryNames] = process.argv;
if (!dir || !portArg) {
  console.error('usage: node scripts/serve-interop.mjs <exampleDir> <port> [entryFile ...]');
  process.exit(1);
}
const port = Number(portArg);
const root = path.resolve(dir);
const srcDir = path.join(root, 'src');

let entries;
if (entryNames.length) {
  entries = entryNames.map((f) => path.join(srcDir, f));
} else {
  entries = fs
    .readdirSync(srcDir)
    .filter((f) => /^main.*\.(jsx?|tsx?|svelte\.js)$/.test(f))
    .map((f) => path.join(srcDir, f));
}
if (!entries.length) {
  console.error(`no entry found under ${srcDir}`);
  process.exit(1);
}

const ctx = await esbuild.context({
  entryPoints: entries,
  bundle: true,
  outdir: path.join(root, '.aeon', 'dev'),
  entryNames: '[name]',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  // Always available — a plugin for .svelte files that simply never
  // matches in a non-Svelte example is free.
  plugins: [esbuildSvelte()],
});
await ctx.watch();
await ctx.serve({ servedir: root, port });
console.log(`serving ${root} on http://localhost:${port} (entries: ${entries.map((e) => path.basename(e)).join(', ')})`);
