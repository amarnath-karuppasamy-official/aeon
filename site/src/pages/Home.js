import { html } from '@aeon-framework/core';
import Header from '../components/Header.js';
import Footer from '../components/Footer.js';
import CodeBlock from '../components/CodeBlock.js';
import { BASE, link } from '../router.js';

const counterCode = `import { html, signal, mount } from '@aeon-framework/core';

function Counter() {
  const count = signal(0);
  return html\`
    <p>Count: \${() => count.value}</p>
    <button @click=\${() => count.value++}>+1</button>
  \`;
}

mount(Counter, document.getElementById('app'));`;

const quickstartCode = `npm create aeon@latest my-app`;

const FEATURES = [
  {
    title: 'No virtual DOM',
    body: 'Templates compile once into a real <template>, then every signal gets a direct binding to the exact DOM node or attribute it controls. Updates touch only what changed — no diffing.',
  },
  {
    title: 'No decorators, no DI ceremony',
    body: '`createToken()` + `provide()` + `inject()` are plain functions. Components are plain functions that return a template. No NgModules, no reflect-metadata.',
  },
  {
    title: 'No required build step',
    body: '`@aeon-framework/core` is dependency-free ES modules — import it straight in a browser with a plain <script type="module">, no bundler required. The CLI exists for convenience, not necessity.',
  },
  {
    title: 'Genuinely lightweight',
    body: 'The demo counter is 1.9 kB gzipped, including the framework — smaller than every framework measured (Solid: 2.8 kB, Preact: 5.4 kB). The full drop-in build (core + router + forms + DI) is 3.7 kB gzipped, still smaller than a bare React counter alone (60 kB).',
  },
  {
    title: 'SSR, hydration & SSG',
    body: '`renderToString()` runs the real client renderer against a headless DOM — no parallel string renderer. `hydrate()` adopts server-rendered DOM in place, and `prerender()` writes real static .html files per route (this site is built with it).',
  },
  {
    title: 'Compile-time optimization',
    body: '`aeon build` now runs the real template compiler at build time via an esbuild plugin, so the shipped bundle skips a tree-walk on first render. AOT milestone 2 — real, scoped, and honestly documented.',
  },
  {
    title: 'Two-way framework interop',
    body: 'Embed Aeon inside React, Vue, Svelte, or Angular — or embed any of those inside Aeon — with `@aeon-framework/interop`. Verified end to end in real headless-Chromium tests, both directions.',
  },
  {
    title: 'An MCP server for AI assistants',
    body: '`@aeon-framework/mcp` gives Claude Code (or anything speaking MCP) code generation, docs search, and `explain_template` — a tool that runs Aeon’s real compiler on your template and catches framework-shaped mistakes before they run. No other framework’s MCP server has this.',
  },
];

export default function Home() {
  return html`
    ${Header()}
    <main>
      <section class="hero">
        <div class="hero-inner">
          <h1 class="hero-title">The signal-first framework that skips the ceremony</h1>
          <p class="hero-pitch">
            Aeon keeps the batteries — router, forms, dependency injection — that a
            full-stack framework needs, and drops the ceremony that usually comes with
            them: no NgModules, no decorators and reflect-metadata, no zone.js change
            detection, no virtual DOM. State is a signal, not a subscription you manage;
            templates compile once and every reactive value binds directly to the DOM
            node it controls.
          </p>
          <div class="hero-actions">
            ${link(`${BASE}/docs/getting-started`, 'Get Started')}
            <a class="btn btn-secondary" href="https://github.com/amarnath-karuppasamy-official/aeon" target="_blank" rel="noopener">View on GitHub</a>
          </div>
        </div>
        <div class="hero-code">
          ${CodeBlock({ code: counterCode, lang: 'js', title: 'A component' })}
        </div>
      </section>

      <section class="section features">
        <h2 class="section-title">A full-stack framework, without the weight</h2>
        <div class="features-grid">
          ${FEATURES.map(
            (f) => html`
              <div class="feature-card">
                <h3>${f.title}</h3>
                <p>${f.body}</p>
              </div>
            `
          )}
        </div>
      </section>

      <section class="section quickstart">
        <h2 class="section-title">Zero-install quickstart</h2>
        <p class="section-sub">Aeon is published on npm — no cloning this repo required.</p>
        ${CodeBlock({ code: quickstartCode, lang: 'sh' })}
        <p class="section-sub">
          Or install the CLI once and reuse it everywhere: <code>npm install -g @aeon-framework/cli &amp;&amp; aeon new my-app</code>.
          Add <code>--ts</code> to either for the TypeScript starter. See the
          ${link(`${BASE}/docs/getting-started`, 'Getting Started')} guide for the full walkthrough.
        </p>
      </section>
    </main>
    ${Footer()}
  `;
}
