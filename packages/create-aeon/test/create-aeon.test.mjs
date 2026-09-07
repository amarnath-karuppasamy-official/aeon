// Real end-to-end tests: actually runs the published bin script as a child
// process against a real temp directory, the same way `npm create
// aeon@latest my-app` would, rather than unit-testing its internals in
// isolation — the whole point of this package is "the CLI produces a
// working directory," so that's what's worth asserting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(__dirname, '..', 'bin', 'create-aeon.mjs');

function run(args, cwd) {
  return execFileSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'create-aeon-test-'));
}

test('with no name argument, prints usage and exits non-zero', () => {
  const cwd = mkTmpDir();
  assert.throws(() => run([], cwd), (err) => {
    assert.equal(err.status, 1);
    assert.match(err.stdout.toString(), /Usage:/);
    return true;
  });
});

test('scaffolds the JS template into a new directory named after the given app name', () => {
  const cwd = mkTmpDir();
  const output = run(['my-app'], cwd);

  const dest = path.join(cwd, 'my-app');
  assert.ok(fs.existsSync(dest), 'the destination directory must be created');
  assert.ok(fs.existsSync(path.join(dest, 'index.html')), 'the JS template ships an index.html');
  assert.ok(fs.existsSync(path.join(dest, 'package.json')), 'the JS template ships a package.json');
  assert.match(output, /created new Aeon app/);
  assert.doesNotMatch(output, /TypeScript/, 'the plain JS template must not be reported as TypeScript');

  const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'my-app', "the scaffolded package.json's name must be rewritten to the app's actual folder name, not the template placeholder");
});

test('--ts scaffolds the TypeScript template instead, and reports it as such', () => {
  const cwd = mkTmpDir();
  const output = run(['my-ts-app', '--ts'], cwd);

  const dest = path.join(cwd, 'my-ts-app');
  assert.ok(fs.existsSync(path.join(dest, 'tsconfig.json')), 'only the TS template ships a tsconfig.json');
  assert.match(output, /\(TypeScript\)/);

  const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'my-ts-app');
});

test('refuses to overwrite an existing directory', () => {
  const cwd = mkTmpDir();
  fs.mkdirSync(path.join(cwd, 'taken'));

  assert.throws(() => run(['taken'], cwd), (err) => {
    assert.equal(err.status, 1);
    assert.match(err.stderr.toString(), /already exists/);
    return true;
  });
});

test('copies the template recursively, preserving subdirectory structure', () => {
  const cwd = mkTmpDir();
  run(['nested-app'], cwd);

  const templateDir = path.join(__dirname, '..', 'template');
  const dest = path.join(cwd, 'nested-app');

  function listFilesRelative(dir, base = dir) {
    let out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out = out.concat(listFilesRelative(full, base));
      else out.push(path.relative(base, full));
    }
    return out.sort();
  }

  assert.deepEqual(
    listFilesRelative(dest),
    listFilesRelative(templateDir),
    'every file in the template (at every depth) must be present, at the same relative path, in the scaffolded app'
  );
});
