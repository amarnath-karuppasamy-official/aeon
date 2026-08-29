// Aeon CLI generators — pure scaffolding logic, no filesystem access, so it
// can be unit tested directly (see test/generate.test.mjs) as well as
// driven from bin/aeon.mjs's `generate`/`g` subcommand.
import path from 'node:path';

function toPascalCase(name) {
  return name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toKebabCase(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

function assertValidName(name) {
  if (!name || typeof name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error(`Invalid generator name "${name}" — use letters, digits, "-", or "_", starting with a letter.`);
  }
}

/**
 * Scaffold a component: a plain function (wrapped in `defineComponent` for
 * API-stability/future compile hooks, per @aeon-framework/core's own
 * convention) that returns an `html` template — the same shape every page
 * in examples/demo-app already uses.
 */
export function generateComponent(name) {
  assertValidName(name);
  const componentName = toPascalCase(name);
  const relativePath = path.join('src', 'components', `${componentName}.js`);
  const content = `import { defineComponent, html, signal } from '@aeon-framework/core';

export default defineComponent(function ${componentName}() {
  const state = signal(null);

  return html\`
    <section class="${toKebabCase(componentName)}">
      <h2>${componentName}</h2>
    </section>
  \`;
});
`;
  return { relativePath, content, name: componentName };
}

/**
 * Scaffold a service: a DI token + factory, the same
 * createToken()/create*Service() shape as examples/demo-app/src/services/greeting.js.
 */
export function generateService(name) {
  assertValidName(name);
  const base = toPascalCase(name).replace(/Service$/, '');
  const serviceName = `${base}Service`;
  const factoryName = `create${serviceName}`;
  const relativePath = path.join('src', 'services', `${base.charAt(0).toLowerCase() + base.slice(1)}.js`);
  const content = `import { createToken } from '@aeon-framework/di';

export const ${serviceName} = createToken('${serviceName}');

export function ${factoryName}() {
  return {
    // add methods here
  };
}
`;
  return { relativePath, content, name: serviceName };
}

/**
 * Scaffold a route: a page component (same shape as generateComponent)
 * plus a `route` export in the `{ path, component }` object shape
 * @aeon-framework/router's createRouter() expects, matching
 * examples/demo-app/src/main.js's route table entries.
 */
export function generateRoute(name) {
  assertValidName(name);
  const componentName = toPascalCase(name);
  const routePath = `/${toKebabCase(componentName)}`;
  const relativePath = path.join('src', 'routes', `${componentName}.js`);
  const content = `import { html } from '@aeon-framework/core';

export default function ${componentName}() {
  return html\`
    <section class="${toKebabCase(componentName)}">
      <h2>${componentName}</h2>
    </section>
  \`;
}

/** Spread this into your route table: createRouter([...,  ${componentName}Route]) */
export const ${componentName}Route = { path: '${routePath}', component: ${componentName} };
`;
  return { relativePath, content, name: componentName, routePath };
}

export const generators = {
  component: generateComponent,
  service: generateService,
  route: generateRoute,
};
