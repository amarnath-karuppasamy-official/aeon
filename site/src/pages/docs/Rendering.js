import { html } from '@aeon-framework/core';
import Header from '../../components/Header.js';
import Footer from '../../components/Footer.js';
import DocsLayout from '../../components/DocsLayout.js';
import CodeBlock from '../../components/CodeBlock.js';
import { BASE, link } from '../../router.js';

const ssrCode = `import { renderToString } from '@aeon-framework/ssr';
import { hydrateComponent } from '@aeon-framework/core';

// on the server:
const html = renderToString(Counter); // put this inside your response's mount-point element

// on the client, once the browser has parsed that HTML into the DOM:
hydrateComponent(Counter, document.getElementById('app'));`;

const ssgCode = `// src/ssg.js — a dedicated entry, separate from src/main.js (main.js has
// side effects: it calls mount() against \`document\` at module scope, which
// prerender() must not trigger when it imports this file for the router
// table + App component).
import { html } from '@aeon-framework/core';
import { createRouter, outlet } from '@aeon-framework/router';
import Home from './pages/Home.js';
import About from './pages/About.js';
import UserDetail from './pages/UserDetail.js';

export const router = createRouter([
  { path: '/', component: Home },
  { path: '/about', component: About },
  { path: '/users/:id', component: UserDetail },
]);

export function App() {
  return html\`<main>\${() => outlet(router)}</main>\`;
}

// Required for every DYNAMIC route (':param') — prerender() can't guess
// route params, so it throws a clear error naming the route if this is missing.
export const paths = ['/users/1', '/users/2'];`;

const prerenderCliCode = `npx aeon prerender .    # builds dist/main.js (same as \`aeon build\`), then
                         # writes dist/index.html, dist/about/index.html,
                         # dist/users/1/index.html, dist/users/2/index.html`;

const aotCode = `html(Object.assign(["<div>", "</div>"], { __aeonPrecompiled: { html: "...", parts: [...] } }), x)`;

const animateCode = `import { transition, animatedList } from '@aeon-framework/animate';

// one element:
await transition.leave(rowEl, { className: 'row-leave', duration: 200 });
rowEl.remove(); // only after the transition (or the timeout) resolves

// a whole keyed list of real DOM rows, reactive over a signal:
const stop = animatedList(listContainer, {
  items: () => todos.value,
  key: (t) => t.id,
  render: (t) => buildRowElement(t), // any real Element
});`;

export default function Rendering() {
  return html`
    ${Header()}
    ${DocsLayout({
      active: `${BASE}/docs/rendering`,
      children: html`
        <h1>SSR, SSG &amp; rendering</h1>

        <h2>SSR + hydration</h2>
        <p>
          <code>@aeon-framework/ssr</code>'s <code>renderToString()</code> does not hand-roll a
          second, parallel string renderer — it runs the exact same <code>mount()</code>/<code>render()</code>
          code from <code>@aeon-framework/core</code> against a headless Happy DOM document and
          serializes the result. Server output and client output come from the same code path by
          construction; they can't drift apart.
        </p>
        ${CodeBlock({ code: ssrCode, lang: 'js' })}
        <p>
          <code>hydrate()</code>/<code>hydrateComponent()</code> <strong>adopt</strong> the
          existing server-rendered DOM instead of clearing the container and re-rendering —
          attribute/property/boolean bindings are (re-)applied in place, event listeners are
          attached, and node-part text/element content is adopted by reference. A keyed
          <code>list()</code>-bound region hydrates incrementally too, row by row, with no
          clear-and-rebuild flash.
        </p>

        <h2>SSG</h2>
        <p>
          <code>@aeon-framework/ssg</code>'s <code>prerender()</code> does build-time static site
          generation on top of <code>@aeon-framework/ssr</code> — it drives the exact same
          per-request pattern (<code>router.navigate(path)</code> then <code>renderToString(App)</code>)
          once per route and writes the result to a real <code>.html</code> file on disk. This
          site is itself built with it — every page you're reading is a real, prerendered static
          file, not server-rendered on demand.
        </p>
        <p>The convention is a dedicated <code>src/ssg.js</code> entry, separate from <code>src/main.js</code>:</p>
        ${CodeBlock({ code: ssgCode, lang: 'js', title: 'src/ssg.js' })}
        ${CodeBlock({ code: prerenderCliCode, lang: 'sh' })}
        <p>
          File convention (clean URLs): <code>/</code> &rarr; <code>index.html</code>,
          <code>/about</code> &rarr; <code>about/index.html</code>, <code>/users/1</code> &rarr;
          <code>users/1/index.html</code>. Each file is the app's <code>index.html</code> shell
          with <code>&lt;div id="app"&gt;&lt;/div&gt;</code> replaced by
          <code>&lt;div id="app" data-ssr="1"&gt;...&lt;/div&gt;</code> around the real rendered
          HTML, so the shipped <code>main.js</code> bundle can <code>hydrateComponent()</code>
          straight into it with no flash.
        </p>

        <h2>Compile-time optimization (AOT milestone 2)</h2>
        <p>
          <code>aeon build</code> (production builds only — never <code>aeon dev</code>) runs an
          esbuild plugin, <code>aeonPrecompile()</code>, over the app's own source. For every
          <code>html\`...\`</code> call site it can find and safely handle, it runs Aeon's real
          template compiler once, at build time, and attaches the result to the call site:
        </p>
        ${CodeBlock({ code: aotCode, lang: 'js' })}
        <p>
          <code>getTemplate()</code> checks for <code>strings.__aeonPrecompiled</code> first and,
          when present, builds the template straight from the precomputed data instead of
          walking the whole tree to find bindings.
        </p>
        <p>
          <strong>What this actually buys you:</strong> the tree-walk already ran only once per
          unique template shape per process, even without this plugin. The honest win is that the
          one tree-walk that used to happen now runs on your build machine instead of in every
          user's browser on first render — faster cold start, nothing more.
        </p>
        <p>
          <strong>What it explicitly does not do:</strong> it does not eliminate
          <code>&lt;template&gt;</code> parsing or per-render cloning — that's real DOM work every
          render still pays for. It is not whole-program dead-code elimination (that remains
          unbuilt — see ${link(`${BASE}/docs`, 'the docs overview')}). It never touches
          <code>aeon dev</code>. And it's fully backward compatible: anything it can't safely
          precompile falls straight through to the exact, unchanged runtime path.
        </p>

        <h2>Animate</h2>
        <p>
          <code>@aeon-framework/animate</code> drives enter/leave transitions with a class toggle
          plus a deterministic timeout fallback — it never depends on a real CSS
          <code>transitionend</code> actually firing.
        </p>
        ${CodeBlock({ code: animateCode, lang: 'js' })}
      `,
    })}
    ${Footer()}
  `;
}
