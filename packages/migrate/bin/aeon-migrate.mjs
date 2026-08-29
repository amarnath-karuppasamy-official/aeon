#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { migrate, MARKER } from '../src/index.js';

const file = process.argv[2];
if (!file) {
  console.error(`Usage: aeon-migrate <file.jsx>\n\nAdd "// ${MARKER}" as the first line of a React file, then run this on it.`);
  process.exit(1);
}

const source = fs.readFileSync(file, 'utf8');
const result = migrate(source);

if (!result.marker) {
  console.error(`No "${MARKER}" marker found in ${file} — nothing to do. Add it as the first line to opt this file in.`);
  process.exit(1);
}

console.log(`\nAeon migrate — ${file}\n`);
for (const c of result.components) {
  if (c.status === 'converted') {
    console.log(`  \x1b[32m✓ converted\x1b[0m  ${c.name}`);
  } else {
    console.log(`  \x1b[33m→ skipped\x1b[0m    ${c.name} — ${c.reason}`);
  }
}

if (!result.output) {
  console.log('\nNothing convertible found — no output file written.\n');
  process.exit(0);
}

const ext = path.extname(file);
// Skipped components are passed through byte-for-byte, JSX included — if the
// source could contain JSX, so can the output, so it keeps a JSX-aware
// extension. A fully-converted file has zero JSX left and could safely be
// .js, but keeping the family consistent means one less thing to get wrong.
const outExt = ext === '.jsx' || ext === '.tsx' ? '.aeon.jsx' : '.aeon.js';
const outFile = file.slice(0, -ext.length) + outExt;
fs.writeFileSync(outFile, result.output);
console.log(`\nWrote ${outFile} — your original file is untouched.`);
console.log('Skipped components were left byte-for-byte as-is (with a comment) — review those manually.\n');
