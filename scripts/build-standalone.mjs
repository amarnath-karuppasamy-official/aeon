// Builds drop-in, zero-dependency <script> bundles: no npm install, no bundler,
// no module system required on the consuming page. Two sizes so a page that
// only needs reactivity+rendering isn't forced to pay for router/forms/DI.
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const outDir = path.join(root, 'dist-standalone');
fs.mkdirSync(outDir, { recursive: true });

const builds = [
  {
    name: 'aeon.core.global.js',
    entry: path.join(root, 'packages/core/src/index.js'),
  },
  {
    name: 'aeon.global.js',
    entry: path.join(root, 'scripts/standalone-full-entry.js'),
  },
];

function report(file) {
  const bytes = fs.statSync(file).size;
  const gz = zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
  console.log(`${path.basename(file)}: ${(bytes / 1024).toFixed(1)} kB min, ${(gz / 1024).toFixed(1)} kB gzip`);
}

for (const b of builds) {
  const outfile = path.join(outDir, b.name);
  await esbuild.build({
    entryPoints: [b.entry],
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'Aeon',
    outfile,
  });
  report(outfile);
}
