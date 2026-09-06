import { html } from '@aeon-framework/core';
import Header from '../../components/Header.js';
import Footer from '../../components/Footer.js';
import DocsLayout from '../../components/DocsLayout.js';
import { BASE, link } from '../../router.js';

export default function DocsIndex() {
  return html`
    ${Header()}
    ${DocsLayout({
      active: `${BASE}/docs`,
      children: html`
        <h1>Aeon docs</h1>
        <p class="lede">
          Aeon is a full-stack, signal-first web framework: fine-grained reactivity,
          direct DOM patching (no virtual DOM), a router, reactive forms, and
          dependency injection — all without decorators, NgModules, or a required
          compiler step.
        </p>
        <p>
          This is a working v0.1 skeleton: real reactivity, a real renderer, a real
          router/forms/DI, a CLI, and a demo app that exercises all of it. It is not a
          finished competitor to Angular — it's the foundation such a project would be
          built on.
        </p>

        <h2>Guides</h2>
        <ul class="docs-index-list">
          <li>${link(`${BASE}/docs/getting-started`, 'Getting started')} — install, scaffold, and your first component.</li>
          <li>${link(`${BASE}/docs/core-concepts`, 'Core concepts')} — signals, templates, keyed lists, lifecycle, hydration.</li>
          <li>${link(`${BASE}/docs/routing-forms-di`, 'Routing, forms & DI')} — the router, reactive forms, dependency injection.</li>
          <li>${link(`${BASE}/docs/rendering`, 'SSR, SSG & rendering')} — server rendering, static generation, compile-time optimization, animation.</li>
          <li>${link(`${BASE}/docs/tooling`, 'CLI, analysis & tooling')} — the CLI, static analysis, devtools, the MCP server, the VS Code extension.</li>
          <li>${link(`${BASE}/docs/interop`, 'Interop & migration')} — embedding Aeon in React/Vue/Svelte/Angular (and back), plus the React codemod.</li>
          <li>${link(`${BASE}/docs/testing`, 'Testing')} — mounting components into a real DOM and asserting on them.</li>
        </ul>

        <h2>What's real vs. what's next</h2>
        <p>
          This matters more here than in most frameworks' docs, so it isn't softened:
          Aeon makes a point of only claiming what's actually built and verified.
        </p>

        <h3>Built and verified</h3>
        <ul>
          <li>Fine-grained signals/computed/effect/batch with dependency tracking</li>
          <li>A cached-template DOM renderer with property/attribute/event/boolean bindings and keyed list reconciliation</li>
          <li>A hash/history router with params, <code>link()</code>, and <code>CanActivate</code>-style route guards</li>
          <li>Reactive forms with composable validators, and a minimal DI container</li>
          <li>A zero-config CLI (<code>new</code>/<code>dev</code>/<code>build</code>/<code>prerender</code>) on esbuild</li>
          <li>SSR (<code>renderToString()</code>) and hydration (<code>hydrate()</code>/<code>hydrateComponent()</code>) that adopt real server-rendered DOM, list rows included</li>
          <li>SSG (<code>prerender()</code>) — real static <code>.html</code> files per route, on top of the same SSR renderer</li>
          <li>Compile-time binding optimization (AOT milestone 2) via <code>aeonPrecompile()</code></li>
          <li>Whole-project static analysis (AOT milestone 1) via <code>aeon check</code></li>
          <li>Bidirectional interop with React, Vue, Svelte, and Angular</li>
          <li>A scoped, tested React&rarr;Aeon migration codemod that bails out (and says why) outside its subset</li>
          <li>An in-page devtools overlay, an MCP server, and a real (if unpublished) VS Code extension</li>
          <li>Hand-written <code>.d.ts</code> types for every package, verified against real <code>tsc</code> runs</li>
          <li>Demo counter: <strong>1.9 kB gzipped</strong>. Full drop-in build (core + router + forms + DI): <strong>3.7 kB gzipped</strong></li>
        </ul>

        <h3>Not yet built</h3>
        <p>The honest gap list for anything claiming to seriously compete with Angular:</p>
        <ul>
          <li>Whole-program dead-code elimination (AOT milestone 3 — milestone 2, compile-time binding optimization, is now real)</li>
          <li>A real Chrome DevTools <em>extension</em> — today's devtools is an in-page overlay only, not a browser panel</li>
          <li>A migration codemod that covers more than the current <code>useState</code>-only subset</li>
          <li>And, the actually hard part: an ecosystem and a community</li>
        </ul>
        <p>
          The architecture here — signals, no vdom, plain functions over decorators — is a
          defensible bet on where frameworks are heading. The distance to "overtake Angular"
          is mostly about time, adoption, and the unglamorous 90% still on the list above.
        </p>
      `,
    })}
    ${Footer()}
  `;
}
