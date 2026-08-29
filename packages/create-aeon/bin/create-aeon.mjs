#!/usr/bin/env node
// The zero-install entry point: `npm create aeon@latest my-app` (or
// `npx create-aeon my-app`) resolves straight to this package from the npm
// registry — no global install, no cloning the Aeon repo. It scaffolds the
// exact same starter template `aeon new` does; the two commands exist for
// two different habits (Angular-style global CLI vs. Vite/Vue-style one-off
// create command), not two different starters.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];

function log(msg) {
  console.log(`\x1b[36m[create-aeon]\x1b[0m ${msg}`);
}

if (!name) {
  console.log(`Usage:
  npm create aeon@latest <name>
  npx create-aeon <name>
`);
  process.exit(1);
}

const dest = path.resolve(process.cwd(), name);
const templateDir = path.join(__dirname, '..', 'template');

if (fs.existsSync(dest)) {
  console.error(`${dest} already exists.`);
  process.exit(1);
}

function copyRecursive(src, dst) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

fs.mkdirSync(dest, { recursive: true });
copyRecursive(templateDir, dest);

// `create-aeon`'s template package.json is shared with `@aeon-framework/cli`'s; give
// the new project the actual folder name instead of the generic placeholder.
const pkgPath = path.join(dest, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = name;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

log(`created new Aeon app at ${dest}`);
log(`next: cd ${name} && npm install && npx aeon dev .`);
