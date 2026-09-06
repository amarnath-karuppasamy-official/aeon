import { html } from '@aeon-framework/core';
import Header from '../../components/Header.js';
import Footer from '../../components/Footer.js';
import DocsLayout from '../../components/DocsLayout.js';
import CodeBlock from '../../components/CodeBlock.js';
import { BASE, link } from '../../router.js';

const cliQuickstart = `# Angular-style: install the CLI once, reuse it everywhere
npm install -g @aeon-framework/cli
aeon new my-app
cd my-app && npm install
npx aeon dev .        # dev server with live rebuild
npx aeon build .      # production bundle to dist/

# or, zero-install:
npm create aeon@latest my-app`;

const tsFlag = `aeon new my-app --ts
npm create aeon@latest my-app -- --ts`;

const cloneQuickstart = `npm install
node packages/cli/bin/aeon.mjs new my-app
npm run demo         # aeon dev examples/demo-app`;

const counterCode = `import { html, signal, mount } from '@aeon-framework/core';

function Counter() {
  const count = signal(0);
  return html\`
    <p>Count: \${() => count.value}</p>
    <button @click=\${() => count.value++}>+1</button>
  \`;
}

mount(Counter, document.getElementById('app'));`;

export default function GettingStarted() {
  return html`
    ${Header()}
    ${DocsLayout({
      active: `${BASE}/docs/getting-started`,
      children: html`
        <h1>Getting started</h1>

        <h2>Two ways to start a new app</h2>
        <p>
          Aeon is published on npm — no cloning this repo required. Two equivalent ways to
          start a new app, same as <code>ng new</code> (global CLI) or <code>npm create vite@latest</code>
          (one-off create command):
        </p>
        ${CodeBlock({ code: cliQuickstart, lang: 'sh' })}
        <p>
          Both produce the identical starter app — <code>aeon new</code> is for people who'll
          scaffold more than one project and want the <code>aeon</code> command on their PATH;
          <code>npm create aeon</code> is for a one-off with nothing to install afterward.
        </p>

        <h2>TypeScript</h2>
        <p>Add <code>--ts</code> to either command for the TypeScript starter — same app, <code>main.ts</code> instead of <code>main.js</code>, a <code>tsconfig.json</code> included, full type-checking against every Aeon package's hand-written <code>.d.ts</code>:</p>
        ${CodeBlock({ code: tsFlag, lang: 'sh' })}

        <h2>Batteries included</h2>
        <p>
          The scaffolded <code>package.json</code> lists every published Aeon package as a
          dependency (<code>router</code>, <code>forms</code>, <code>di</code>, <code>http</code>,
          <code>i18n</code>, <code>animate</code>, <code>devtools</code>, <code>ssr</code>, plus
          <code>testing</code> as a dev dependency) — not just the two or three the starter's
          <code>main.js</code> happens to import. <code>npm install</code> gets you everything up
          front; nothing to add later just to try routing or SSR. The starter code itself stays a
          minimal counter (with a comment listing what's already installed) rather than demoing
          all nine, and esbuild still tree-shakes the production build down to only what you
          actually <code>import</code> — installing the rest costs nothing in bundle size.
        </p>

        <h2>Working from a clone of this repo</h2>
        <p>If you're contributing to Aeon itself, or running the demo app, use the CLI's local entry point:</p>
        ${CodeBlock({ code: cloneQuickstart, lang: 'sh' })}

        <h2>A component</h2>
        <p>This is Aeon's actual "hello world" — the same example used on the homepage:</p>
        ${CodeBlock({ code: counterCode, lang: 'js' })}
        <p>
          Bindings follow one rule: <strong>a function is reactive, a plain value is static.</strong>
          <code>\${() =&gt; count.value}</code> re-runs whenever <code>count</code> changes;
          <code>\${count.value}</code> (no arrow) captures the value once and never updates —
          useful for genuinely static content, a footgun if you meant it to be live. Event
          handlers (<code>@click=\${fn}</code>) are the one exception — the function itself
          <em>is</em> the value there, not a getter to call.
        </p>

        <h2>The four binding kinds</h2>
        <p>Attribute bindings support four kinds, mirroring lit-html:</p>
        <table class="docs-table">
          <thead><tr><th>Syntax</th><th>Kind</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>attr=$&#123;v&#125;</code></td><td>attribute</td><td>Plain HTML attribute (<code>el.setAttribute</code>)</td></tr>
            <tr><td><code>.prop=$&#123;v&#125;</code></td><td>property</td><td>DOM property, e.g. <code>.value</code> for inputs (<code>el[name] = v</code>)</td></tr>
            <tr><td><code>@event=$&#123;fn&#125;</code></td><td>event</td><td>Listener (<code>el.addEventListener</code>) — the function itself is the value</td></tr>
            <tr><td><code>?bool=$&#123;v&#125;</code></td><td>boolean</td><td>Toggled attribute (<code>el.toggleAttribute</code>)</td></tr>
          </tbody>
        </table>
        <p>
          There is no fifth kind — no <code>ref=</code>, no <code>key=</code>, no <code>model=</code>.
          Reach for one of those and Aeon silently treats it as a literal string attribute rather
          than erroring. Use <code>onMount()</code> for element access instead (see
          ${link(`${BASE}/docs/core-concepts`, 'Core concepts')}), and see
          ${link(`${BASE}/docs/tooling`, 'CLI, analysis & tooling')} for how <code>aeon check</code>
          and the MCP server's <code>explain_template</code> tool catch this mistake before it ships.
        </p>
      `,
    })}
    ${Footer()}
  `;
}
