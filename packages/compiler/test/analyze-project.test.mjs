import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeProject } from '../src/index.js';

function mkFixture(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  return dir;
}

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

test('analyzeProject requires projectDir', async () => {
  await assert.rejects(() => analyzeProject({}), /projectDir is required/);
});

test('analyzeProject requires projectDir to exist', async () => {
  await assert.rejects(
    () => analyzeProject({ projectDir: '/definitely/not/a/real/path/aeon-compiler-xyz' }),
    /does not exist/
  );
});

test('flags a real ref= binding footgun with the correct file and line', async () => {
  const dir = mkFixture('aeon-compiler-ref-');
  writeFile(
    dir,
    'src/Widget.js',
    [
      "import { html } from '@aeon-framework/core';",
      '',
      'export function Widget() {',
      '  return html`<div ref=${(el) => {}}>hi</div>`;',
      '}',
      '',
    ].join('\n')
  );
  const findings = await analyzeProject({ projectDir: dir });
  const refFinding = findings.find((f) => f.rule === 'binding-footgun');
  assert.ok(refFinding, 'expected a binding-footgun finding');
  assert.equal(refFinding.severity, 'error');
  assert.equal(refFinding.file, path.join('src', 'Widget.js'));
  assert.equal(refFinding.line, 4);
  assert.match(refFinding.message, /ref=/);
});

test('flags a real unused @aeon-framework/core import', async () => {
  const dir = mkFixture('aeon-compiler-unused-');
  writeFile(
    dir,
    'src/service.js',
    [
      "import { signal, effect } from '@aeon-framework/core';",
      '',
      'export const count = signal(0);',
      '',
    ].join('\n')
  );
  const findings = await analyzeProject({ projectDir: dir });
  const unusedFinding = findings.find((f) => f.rule === 'unused-import');
  assert.ok(unusedFinding, 'expected an unused-import finding');
  assert.equal(unusedFinding.severity, 'warning');
  assert.equal(unusedFinding.file, path.join('src', 'service.js'));
  assert.equal(unusedFinding.line, 1);
  assert.match(unusedFinding.message, /`effect`/);
});

test('does NOT flag a correctly-used import (no false positive)', async () => {
  const dir = mkFixture('aeon-compiler-used-');
  writeFile(
    dir,
    'src/service.js',
    [
      "import { signal, effect } from '@aeon-framework/core';",
      '',
      'export const count = signal(0);',
      'effect(() => console.log(count.value));',
      '',
    ].join('\n')
  );
  const findings = await analyzeProject({ projectDir: dir });
  assert.deepEqual(
    findings.filter((f) => f.rule === 'unused-import'),
    []
  );
});

test('flags routes after a non-last catch-all as unreachable', async () => {
  const dir = mkFixture('aeon-compiler-catchall-');
  writeFile(
    dir,
    'src/router.js',
    [
      "import { createRouter } from '@aeon-framework/router';",
      '',
      'function Home() {}',
      'function About() {}',
      'function NotFound() {}',
      '',
      'export const router = createRouter([',
      "  { path: '*', component: NotFound },",
      "  { path: '/', component: Home },",
      "  { path: '/about', component: About },",
      ']);',
      '',
    ].join('\n')
  );
  const findings = await analyzeProject({ projectDir: dir });
  const unreachable = findings.filter((f) => f.rule === 'unreachable-route');
  assert.equal(unreachable.length, 2);
  assert.equal(unreachable[0].severity, 'warning');
  assert.equal(unreachable[0].line, 9); // { path: '/', ... }
  assert.equal(unreachable[1].line, 10); // { path: '/about', ... }
});

test('does NOT flag a catch-all that legitimately comes last', async () => {
  const dir = mkFixture('aeon-compiler-catchall-ok-');
  writeFile(
    dir,
    'src/router.js',
    [
      "import { createRouter } from '@aeon-framework/router';",
      '',
      'function Home() {}',
      'function NotFound() {}',
      '',
      'export const router = createRouter([',
      "  { path: '/', component: Home },",
      "  { path: '*', component: NotFound },",
      ']);',
      '',
    ].join('\n')
  );
  const findings = await analyzeProject({ projectDir: dir });
  assert.deepEqual(
    findings.filter((f) => f.rule === 'unreachable-route'),
    []
  );
});

test('flags two routes sharing the same literal path as a collision', async () => {
  const dir = mkFixture('aeon-compiler-dup-');
  writeFile(
    dir,
    'src/router.js',
    [
      "import { createRouter } from '@aeon-framework/router';",
      '',
      'function Foo() {}',
      'function FooAgain() {}',
      '',
      'export const router = createRouter([',
      "  { path: '/foo', component: Foo },",
      "  { path: '/foo', component: FooAgain },",
      ']);',
      '',
    ].join('\n')
  );
  const findings = await analyzeProject({ projectDir: dir });
  const collisions = findings.filter((f) => f.rule === 'route-collision');
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].severity, 'error');
  assert.equal(collisions[0].line, 8);
  assert.match(collisions[0].message, /already defined on line 7/);
});

test('a fully clean project produces zero findings (no false positives)', async () => {
  const dir = mkFixture('aeon-compiler-clean-');
  writeFile(
    dir,
    'src/main.js',
    [
      "import { html, signal, effect } from '@aeon-framework/core';",
      "import { createRouter, outlet } from '@aeon-framework/router';",
      '',
      'const count = signal(0);',
      'effect(() => console.log(count.value));',
      '',
      'function Home() {',
      '  return html`<div .value=${count} @click=${() => count.value++}>${() => count.value}</div>`;',
      '}',
      'function About() {',
      '  return html`<p>about</p>`;',
      '}',
      'function NotFound() {',
      '  return html`<p>not found</p>`;',
      '}',
      '',
      'export const router = createRouter([',
      "  { path: '/', component: Home },",
      "  { path: '/about', component: About },",
      "  { path: '*', component: NotFound },",
      ']);',
      '',
      'export function App() {',
      '  return html`<main>${() => outlet(router)}</main>`;',
      '}',
      '',
    ].join('\n')
  );
  const findings = await analyzeProject({ projectDir: dir });
  assert.deepEqual(findings, []);
});
