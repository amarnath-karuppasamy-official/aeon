import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// `aeon check` never bundles/imports the target project's own code (see
// @aeon-framework/compiler's README section) — it only text-scans it — so,
// unlike dev/build/prerender's fixtures, these don't need to live inside the
// repo for esbuild's module resolution to find the workspace's hoisted
// node_modules; a plain os.tmpdir() fixture is fine.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliBin = path.join(__dirname, '..', 'bin', 'aeon.mjs');

function mkFixture(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  return dir;
}

function runCli(args, cwd) {
  return execFileSync(process.execPath, [cliBin, ...args], { cwd, encoding: 'utf8' });
}

test('aeon check exits non-zero and prints the real finding for a project with a ref= footgun', () => {
  const dir = mkFixture('aeon-cli-check-bad-');
  try {
    fs.writeFileSync(
      path.join(dir, 'src', 'Widget.js'),
      [
        "import { html } from '@aeon-framework/core';",
        '',
        'export function Widget() {',
        '  return html`<div ref=${(el) => {}}>hi</div>`;',
        '}',
        '',
      ].join('\n')
    );
    assert.throws(
      () => runCli(['check', dir], dir),
      (err) => {
        assert.notEqual(err.status, 0);
        const out = err.stdout.toString();
        assert.match(out, /binding-footgun/);
        assert.match(out, /ref=/);
        assert.match(out, /Widget\.js:4/);
        return true;
      }
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('aeon check exits 0 with "no findings" on a clean project', () => {
  const dir = mkFixture('aeon-cli-check-clean-');
  try {
    fs.writeFileSync(
      path.join(dir, 'src', 'main.js'),
      [
        "import { html, signal } from '@aeon-framework/core';",
        '',
        'const count = signal(0);',
        'function Home() {',
        '  return html`<div .value=${count}>${() => count.value}</div>`;',
        '}',
        '',
      ].join('\n')
    );
    const out = runCli(['check', dir], dir);
    assert.match(out, /check passed: no findings/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
