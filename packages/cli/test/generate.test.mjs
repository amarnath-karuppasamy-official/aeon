import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { generateComponent, generateService, generateRoute } from '../src/generate.mjs';

test('generateComponent() produces a syntactically valid Aeon component using defineComponent + html', () => {
  const { relativePath, content, name } = generateComponent('user-card');
  assert.equal(name, 'UserCard');
  assert.equal(relativePath, path.join('src', 'components', 'UserCard.js'));
  assert.match(content, /import \{ defineComponent, html, signal \} from '@aeon-framework\/core';/);
  assert.match(content, /export default defineComponent\(function UserCard\(\)/);
  assert.match(content, /html`/);
});

test('generateService() produces a createToken()/factory pair matching the demo app convention', () => {
  const { relativePath, content, name } = generateService('Greeting');
  assert.equal(name, 'GreetingService');
  assert.equal(relativePath, path.join('src', 'services', 'greeting.js'));
  assert.match(content, /import \{ createToken \} from '@aeon-framework\/di';/);
  assert.match(content, /export const GreetingService = createToken\('GreetingService'\);/);
  assert.match(content, /export function createGreetingService\(\)/);
});

test('generateService() does not double-suffix a name that already ends in "Service"', () => {
  const { name } = generateService('LoggerService');
  assert.equal(name, 'LoggerService');
});

test('generateRoute() produces a component plus a router-compatible route object', () => {
  const { relativePath, content, name, routePath } = generateRoute('user-profile');
  assert.equal(name, 'UserProfile');
  assert.equal(routePath, '/user-profile');
  assert.equal(relativePath, path.join('src', 'routes', 'UserProfile.js'));
  assert.match(content, /export default function UserProfile\(\)/);
  assert.match(content, /export const UserProfileRoute = \{ path: '\/user-profile', component: UserProfile \};/);
});

test('generator output is syntactically valid JS (parses/imports cleanly)', async () => {
  const os = await import('node:os');
  const fs = await import('node:fs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aeon-generate-'));
  try {
    for (const gen of [generateComponent('Widget'), generateService('Widget'), generateRoute('Widget')]) {
      const file = path.join(dir, path.basename(gen.relativePath));
      fs.writeFileSync(file, gen.content);
      // Node's own parser is the ground truth for "syntactically valid":
      // a syntax error here throws SyntaxError before any module code runs.
      await import(`file://${file}`).catch((err) => {
        // Import may fail on module resolution (no node_modules in this
        // scratch dir) — that's fine and expected; a SyntaxError is not.
        if (err instanceof SyntaxError) throw err;
      });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects an invalid name rather than generating something unusable', () => {
  assert.throws(() => generateComponent(''));
  assert.throws(() => generateComponent('123bad'));
  assert.throws(() => generateComponent('has spaces/../slash'));
});
