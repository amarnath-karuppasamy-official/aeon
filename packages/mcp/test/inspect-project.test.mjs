import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectProject } from '../src/inspect-project.js';

function makeFixtureProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aeon-mcp-inspect-'));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture-app',
        dependencies: { '@aeon-framework/core': '^0.1.3', '@aeon-framework/router': '^0.1.0' },
        devDependencies: { '@aeon-framework/cli': '^0.1.4' },
      },
      null,
      2
    )
  );
  fs.mkdirSync(path.join(dir, 'src', 'routes'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'components'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'services'), { recursive: true });

  fs.writeFileSync(
    path.join(dir, 'src', 'routes', 'Home.js'),
    `import { html } from '@aeon-framework/core';
export default function Home() { return html\`<section>Home</section>\`; }
export const HomeRoute = { path: '/', component: Home };
`
  );
  fs.writeFileSync(
    path.join(dir, 'src', 'routes', 'About.js'),
    `import { html } from '@aeon-framework/core';
export default function About() { return html\`<section>About</section>\`; }
export const AboutRoute = { path: '/about', component: About };
`
  );
  fs.writeFileSync(
    path.join(dir, 'src', 'components', 'Header.js'),
    `export default function Header() {}\n`
  );
  fs.writeFileSync(
    path.join(dir, 'src', 'services', 'greeting.js'),
    `export const GreetingService = 1;\n`
  );

  return dir;
}

test('inspect_project reports real @aeon-framework/* deps from a real package.json', () => {
  const dir = makeFixtureProject();
  const result = inspectProject({ projectDir: dir });

  assert.equal(result.projectName, 'fixture-app');
  const names = result.aeonPackages.map((p) => p.name);
  assert.deepEqual(names.sort(), ['@aeon-framework/cli', '@aeon-framework/core', '@aeon-framework/router']);
  const core = result.aeonPackages.find((p) => p.name === '@aeon-framework/core');
  assert.equal(core.version, '^0.1.3');
  assert.equal(core.via, 'dependencies');
});

test('inspect_project finds real route files and scrapes their real path/export', () => {
  const dir = makeFixtureProject();
  const result = inspectProject({ projectDir: dir });

  assert.deepEqual(
    result.routes.sort((a, b) => a.file.localeCompare(b.file)),
    [
      { file: 'About.js', routePath: '/about', exportName: 'AboutRoute' },
      { file: 'Home.js', routePath: '/', exportName: 'HomeRoute' },
    ]
  );
});

test('inspect_project lists real component and service files', () => {
  const dir = makeFixtureProject();
  const result = inspectProject({ projectDir: dir });

  assert.deepEqual(result.components, ['Header.js']);
  assert.deepEqual(result.services, ['greeting.js']);
});

test('inspect_project handles a project with no routes/components/services directories', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aeon-mcp-inspect-empty-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'bare' }));
  const result = inspectProject({ projectDir: dir });
  assert.deepEqual(result.routes, []);
  assert.deepEqual(result.components, []);
  assert.deepEqual(result.services, []);
  assert.deepEqual(result.aeonPackages, []);
});

test('inspect_project requires projectDir to exist', () => {
  assert.throws(() => inspectProject({ projectDir: '/definitely/not/a/real/path/aeon-xyz' }), /does not exist/);
});
