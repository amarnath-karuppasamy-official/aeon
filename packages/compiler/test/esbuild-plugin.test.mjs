import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import { Window } from 'happy-dom';
import { aeonPrecompile } from '../src/esbuild-plugin.js';

// esbuild resolves the bare `@aeon-framework/core` specifier used by every
// fixture below the normal Node way (walking up from the entry file looking
// for node_modules) — but the fixtures live under os.tmpdir(), outside this
// repo, so there's no ancestor node_modules to find. `nodePaths` (esbuild's
// equivalent of the NODE_PATH env var) points it at this workspace's real,
// already-installed node_modules (where npm workspaces symlinks
// @aeon-framework/core to packages/core) instead.
const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const NODE_PATHS = [path.join(REPO_ROOT, 'node_modules')];

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aeon-precompile-'));
  const window = new Window();
  globalThis.window = window;
  globalThis.document = window.document;
  for (const key of ['Node', 'Element', 'HTMLElement', 'Event', 'CustomEvent', 'MouseEvent']) {
    if (key in window) {
      try {
        globalThis[key] = window[key];
      } catch {
        /* ignore */
      }
    }
  }
});

after(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFixture(name, source) {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, source, 'utf8');
  return file;
}

async function bundle(entry, outfile, { withPlugin }) {
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile,
    format: 'esm',
    nodePaths: NODE_PATHS,
    plugins: withPlugin ? [aeonPrecompile()] : [],
  });
  return fs.readFileSync(outfile, 'utf8');
}

const COUNTER_SOURCE = `
import { html, render, signal } from '@aeon-framework/core';

export function Counter() {
  const count = signal(0);
  return html\`<div class="counter"><p id="out">\${() => count.value}</p><button id="inc" @click=\${() => count.value++}>+1</button></div>\`;
}

export function mountApp(container) {
  return render(Counter(), container);
}
`;

test('(a)+(b) precompiled and plain bundles render and behave identically', async () => {
  const entry = writeFixture('counter.js', COUNTER_SOURCE);
  const outPre = path.join(tmpDir, 'counter.precompiled.js');
  const outPlain = path.join(tmpDir, 'counter.plain.js');

  const codePre = await bundle(entry, outPre, { withPlugin: true });
  const codePlain = await bundle(entry, outPlain, { withPlugin: false });

  // (a) the precompiled bundle's source literally carries the marker; the
  // non-precompiled one never does.
  assert.match(codePre, /__aeonPrecompiled:\s*{/);
  assert.doesNotMatch(codePlain, /__aeonPrecompiled:\s*{/);

  // (b) actually import + run both bundles and prove identical behavior —
  // this is what actually proves the optimization is behavior-preserving.
  const modPre = await import(pathToFileURL(outPre).href);
  const modPlain = await import(pathToFileURL(outPlain).href);

  const containerPre = document.createElement('div');
  const containerPlain = document.createElement('div');
  modPre.mountApp(containerPre);
  modPlain.mountApp(containerPlain);

  assert.equal(containerPre.innerHTML, containerPlain.innerHTML);
  assert.equal(containerPre.querySelector('#out').textContent, '0');

  containerPre.querySelector('#inc').click();
  containerPre.querySelector('#inc').click();
  containerPlain.querySelector('#inc').click();
  containerPlain.querySelector('#inc').click();

  assert.equal(containerPre.querySelector('#out').textContent, '2');
  assert.equal(containerPre.innerHTML, containerPlain.innerHTML);
});

test('(c) an aliased `import { html as h }` is precompiled correctly', async () => {
  const entry = writeFixture(
    'aliased.js',
    `
import { html as h, render, signal } from '@aeon-framework/core';
export function Widget() {
  const n = signal(1);
  return h\`<span id="n">\${() => n.value}</span>\`;
}
export function mountApp(container) {
  return render(Widget(), container);
}
`
  );
  const outfile = path.join(tmpDir, 'aliased.out.js');
  const code = await bundle(entry, outfile, { withPlugin: true });
  assert.match(code, /__aeonPrecompiled:\s*{/);

  const mod = await import(pathToFileURL(outfile).href);
  const container = document.createElement('div');
  mod.mountApp(container);
  assert.equal(container.querySelector('#n').textContent, '1');
});

test('(d) a file importing @aeon-framework/core but never calling html passes through inert', async () => {
  const entry = writeFixture(
    'inert.js',
    `
import { signal } from '@aeon-framework/core';
export const count = signal(42);
export function read() { return count.value; }
`
  );
  const outfile = path.join(tmpDir, 'inert.out.js');
  const code = await bundle(entry, outfile, { withPlugin: true });
  assert.doesNotMatch(code, /__aeonPrecompiled:\s*{/);

  const mod = await import(pathToFileURL(outfile).href);
  assert.equal(mod.read(), 42);
});

test('(e) a .tsx fixture with real type annotations is precompiled', async () => {
  const entry = writeFixture(
    'widget.tsx',
    `
import { html, render } from '@aeon-framework/core';

interface Props { label: string; }

export function Widget(props: Props) {
  return html\`<span id="label">\${props.label}</span>\`;
}

export function mountApp(container: HTMLElement, label: string) {
  return render(Widget({ label }), container);
}
`
  );
  const outfile = path.join(tmpDir, 'widget.out.js');
  const code = await bundle(entry, outfile, { withPlugin: true });
  assert.match(code, /__aeonPrecompiled:\s*{/);

  const mod = await import(pathToFileURL(outfile).href);
  const container = document.createElement('div');
  mod.mountApp(container, 'hello');
  assert.equal(container.querySelector('#label').textContent, 'hello');
});

test('(f) two separate html`` call sites in one file are both correctly and independently rewritten', async () => {
  const entry = writeFixture(
    'twoCalls.js',
    `
import { html, render } from '@aeon-framework/core';

export function A() {
  return html\`<div id="a">\${1 + 1}</div>\`;
}

export function B(flag) {
  return html\`<span id="b" ?hidden=\${flag}>bee</span>\`;
}

export function mountA(container) { return render(A(), container); }
export function mountB(container, flag) { return render(B(flag), container); }
`
  );
  const outfile = path.join(tmpDir, 'twoCalls.out.js');
  const code = await bundle(entry, outfile, { withPlugin: true });

  const occurrences = code.match(/__aeonPrecompiled:\s*{/g) || [];
  assert.equal(occurrences.length, 2, 'both call sites should be independently precompiled');

  const mod = await import(pathToFileURL(outfile).href);
  const containerA = document.createElement('div');
  const containerB = document.createElement('div');
  mod.mountA(containerA);
  mod.mountB(containerB, true);

  assert.equal(containerA.querySelector('#a').textContent, '2');
  assert.ok(containerB.querySelector('#b').hasAttribute('hidden'));
});
