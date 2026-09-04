import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { searchDocs, collectDocSources, findRepoRoot } from '../src/docs-tools.js';

test('findRepoRoot locates the real Aeon monorepo root from this package', () => {
  const root = findRepoRoot();
  assert.ok(root, 'expected to find the monorepo root');
  // Functional check, not a check on the checkout directory's name (a clone
  // can legitimately live at any path, e.g. /tmp/aeon-clone3) — the real
  // requirement is that it's the actual monorepo root: README.md and
  // packages/core/package.json must exist directly under it.
  assert.ok(fs.existsSync(path.join(root, 'README.md')), `expected ${root}/README.md to exist`);
  assert.ok(
    fs.existsSync(path.join(root, 'packages', 'core', 'package.json')),
    `expected ${root}/packages/core/package.json to exist`
  );
});

test('collectDocSources finds README.md and multiple real package .d.ts files', () => {
  const sources = collectDocSources();
  const files = sources.map((s) => s.file);
  assert.ok(files.includes('README.md'));
  assert.ok(files.includes('packages/core/src/index.d.ts'));
  assert.ok(files.includes('packages/router/src/index.d.ts'));
  // real content, not a mock
  const core = sources.find((s) => s.file === 'packages/core/src/index.d.ts');
  assert.match(core.content, /export function signal/);
});

test('search_docs("signal") surfaces real content from core\'s docs', () => {
  const { results } = searchDocs({ query: 'signal' });
  const coreResult = results.find((r) => r.file === 'packages/core/src/index.d.ts');
  assert.ok(coreResult, 'expected a match in core/src/index.d.ts');
  assert.ok(coreResult.matchCount > 0);
  const joined = coreResult.matches.map((m) => m.excerpt).join('\n');
  assert.match(joined, /signal/i);
});

test('search_docs("createRouter") surfaces the router\'s real exported signature', () => {
  const { results } = searchDocs({ query: 'createRouter' });
  const routerResult = results.find((r) => r.file === 'packages/router/src/index.d.ts');
  assert.ok(routerResult, 'expected a match in router/src/index.d.ts');
  const joined = routerResult.matches.map((m) => m.excerpt).join('\n');
  // the real signature from packages/router/src/index.d.ts
  assert.match(joined, /export function createRouter\(/);
  assert.match(joined, /routeTable: readonly RouteDefinition\[\]/);
});

test('search_docs returns nothing found for pure nonsense, not a crash', () => {
  const { results } = searchDocs({ query: 'xyzzy-not-a-real-aeon-term-qqq' });
  assert.deepEqual(results, []);
});

test('search_docs requires a non-empty query', () => {
  assert.throws(() => searchDocs({ query: '' }), /query is required/);
});
