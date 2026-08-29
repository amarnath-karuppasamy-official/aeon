#!/usr/bin/env node
// Aeon CLI — no config file needed for a basic app. Just enough tooling to
// scaffold, run, and build; the framework itself stays a set of small
// dependency-free ES modules.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import esbuild from 'esbuild';

const args = process.argv.slice(2);
const cmd = args[0];
const target = args[1] || '.';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function log(msg) {
  console.log(`\x1b[36m[aeon]\x1b[0m ${msg}`);
}

function resolveApp(dir) {
  const root = path.resolve(process.cwd(), dir);
  // .jsx first so an app embedding React (see examples/interop-react) gets
  // JSX transformed; plain Aeon apps never need it and just use main.js.
  const candidates = ['main.jsx', 'main.js'].map((f) => path.join(root, 'src', f));
  const entry = candidates.find((f) => fs.existsSync(f));
  const html = path.join(root, 'index.html');
  if (!entry) {
    console.error(`Cannot find src/main.js or src/main.jsx under ${root}.`);
    process.exit(1);
  }
  return { root, entry, html };
}

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
  const { host, port } = await ctx.serve({ servedir: root, port: 5173 });
  log(`dev server running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  log('watching for changes...');
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

function scaffold(name) {
  const dest = path.resolve(process.cwd(), name);
  const templateDir = path.join(__dirname, '..', 'template');
  if (fs.existsSync(dest)) {
    console.error(`${dest} already exists.`);
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });
  copyRecursive(templateDir, dest);
  log(`created new Aeon app at ${dest}`);
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

function help() {
  console.log(`Aeon CLI

Usage:
  aeon new <name>       Scaffold a new Aeon app
  aeon dev [dir]         Start the dev server (default: current directory)
  aeon build [dir]       Production build to dist/
  aeon migrate <file>    Best-effort React -> Aeon codemod (needs @aeon-framework/migrate installed)
`);
}

switch (cmd) {
  case 'new':
    if (!args[1]) { help(); process.exit(1); }
    scaffold(args[1]);
    break;
  case 'dev':
    await dev(target);
    break;
  case 'build':
    await build(target);
    break;
  case 'migrate':
    await migrateFile(args[1]);
    break;
  default:
    help();
}
