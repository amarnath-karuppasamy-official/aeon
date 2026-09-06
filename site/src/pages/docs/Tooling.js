import { html } from '@aeon-framework/core';
import Header from '../../components/Header.js';
import Footer from '../../components/Footer.js';
import DocsLayout from '../../components/DocsLayout.js';
import CodeBlock from '../../components/CodeBlock.js';
import { BASE, link } from '../../router.js';

const cliCommandsCode = `aeon new <name> [--ts]           Scaffold a new Aeon app
aeon dev [dir]                   Start the dev server
aeon build [dir]                 Production build to dist/
aeon prerender [dir]             Static-render every route to dist/*.html
aeon migrate <file>               Best-effort React -> Aeon codemod
aeon generate component <Name>   Scaffold src/components/<Name>.js (alias: aeon g)
aeon generate service <Name>     Scaffold src/services/<name>.js
aeon generate route <Name>       Scaffold src/routes/<Name>.js
aeon check [dir]                  Static analysis — exits non-zero on any error finding`;

const checkOutputCode = `error  src/components/UserForm.js:12  [binding-footgun]  \`ref=\`: NOT a real Aeon binding kind: ...
warning  src/routes/index.js:8  [unreachable-route]  Route \`/about\` is unreachable — the catch-all route \`path: '*'\` on line 6 comes before it and matches every path first.
[aeon] check found 1 error(s), 1 warning(s).`;

const devtoolsCode = `import { attachDevtools } from '@aeon-framework/devtools';

const devtools = attachDevtools({ hotkey: 'F2' }); // mounted hidden into document.body
devtools.registry.track('todoCount', todoCount);   // any Aeon signal
// press F2 in the running app to toggle the panel`;

const mcpConfigCode = `{
  "mcpServers": {
    "aeon": {
      "command": "npx",
      "args": ["-y", "@aeon-framework/mcp"]
    }
  }
}`;

const explainTemplateCode = `explain_template({ template: '<div ref=\${0} @click=\${1}></div>' })

// {
//   "bindings": [
//     { "slot": 0, "kind": "attribute", "name": "ref",
//       "warning": "NOT a real Aeon binding kind: Aeon has no ref= binding..." },
//     { "slot": 1, "kind": "event", "name": "click", "note": "Real event binding (@event=) ..." }
//   ]
// }`;

export default function Tooling() {
  return html`
    ${Header()}
    ${DocsLayout({
      active: `${BASE}/docs/tooling`,
      children: html`
        <h1>CLI, analysis &amp; tooling</h1>

        <h2>CLI commands</h2>
        <p>Zero-config, esbuild-powered:</p>
        ${CodeBlock({ code: cliCommandsCode, lang: 'sh' })}

        <h2>Static analysis (<code>aeon check</code>, AOT milestone 1)</h2>
        <p>
          Backed by <code>@aeon-framework/compiler</code>'s <code>analyzeProject()</code>, this is
          <strong>the first real milestone toward an Aeon AOT compiler — not the whole thing</strong>.
          It scans every source file under <code>src/</code> (never <code>eval()</code>s or
          <code>import()</code>s the project's own code) and reports three kinds of real,
          provable problems:
        </p>
        <table class="docs-table">
          <thead><tr><th>Check</th><th>Severity</th><th>What it catches</th></tr></thead>
          <tbody>
            <tr><td>Binding-kind footguns</td><td>error</td><td>Every real <code>html\`...\`</code> template, run through Aeon's actual compiler — flags <code>ref=</code>/<code>key=</code>/<code>model=</code> and anything else the real compiler silently mis-treats.</td></tr>
            <tr><td>Unreachable routes</td><td>error / warning</td><td>Two routes with the same literal <code>path</code>, and a catch-all (<code>path: '*'</code>) that isn't the last entry.</td></tr>
            <tr><td>Unused imports</td><td>warning</td><td>A named import from any <code>@aeon-framework/*</code> package never referenced again in the file.</td></tr>
          </tbody>
        </table>
        ${CodeBlock({ code: checkOutputCode, lang: 'sh', title: 'aeon check .' })}
        <p>
          Exits non-zero when any error-severity finding exists, so it's CI-friendly as a build
          gate. See ${link(`${BASE}/docs/rendering`, 'SSR, SSG & rendering')} for milestone 2,
          compile-time binding optimization.
        </p>

        <h2>Devtools</h2>
        <p>
          <code>@aeon-framework/devtools</code> is an <strong>in-page debug overlay</strong> — a
          small, fixed-position panel you mount into your own app's DOM during development. It is
          <strong>not a browser extension</strong>. Aeon signals carry no name/introspection
          metadata of their own, so a component author opts a signal into visibility explicitly:
        </p>
        ${CodeBlock({ code: devtoolsCode, lang: 'js' })}

        <h2>The MCP server</h2>
        <p>
          <code>@aeon-framework/mcp</code> is an <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener">MCP</a>
          server — Aeon's answer to Angular CLI's <code>ng mcp</code> — that gives an AI coding
          assistant real tools for working with an Aeon codebase, over the standard stdio
          transport:
        </p>
        ${CodeBlock({ code: mcpConfigCode, lang: 'js', title: 'MCP config' })}
        <table class="docs-table">
          <thead><tr><th>Tool</th><th>What it does</th></tr></thead>
          <tbody>
            <tr><td><code>generate_component</code> / <code>generate_service</code> / <code>generate_route</code></td><td>Scaffold a real file using the exact same generator <code>aeon generate</code> uses.</td></tr>
            <tr><td><code>search_docs</code></td><td>Lightweight (no embeddings) case-insensitive search over the real README and every package's <code>.d.ts</code>.</td></tr>
            <tr><td><code>get_conventions</code></td><td>Aeon's curated idioms and real footguns an AI trained on React/lit-html is likely to hit.</td></tr>
            <tr><td><code>inspect_project</code></td><td>Reads a real project on disk (never evaluates its code) and summarizes its dependencies, routes, components, services.</td></tr>
            <tr><td><code>explain_template</code></td><td><strong>The unique one</strong> — see below.</td></tr>
          </tbody>
        </table>

        <h3><code>explain_template</code> — a tool no other framework's MCP server has</h3>
        <p>
          Feed it the body of an <code>html\`...\`</code> template and it tells you exactly what
          Aeon's real compiler decides each binding is — because it actually calls that compiler,
          not a lookalike regex. It catches the single most common mistake an AI assistant trained
          on React/lit-html/Vue makes against Aeon: reaching for a <code>ref=</code> binding that
          looks like it should exist, but doesn't.
        </p>
        ${CodeBlock({ code: explainTemplateCode, lang: 'js' })}

        <h2>VS Code extension</h2>
        <p>
          <code>tools/vscode-aeon/</code> is a real, working VS Code extension for Aeon's
          <code>html\`...\`</code> templates — <strong>not published</strong> to the Marketplace or
          Open VSX (no publisher credentials in the build environment), but installable locally
          today. It gives syntax highlighting for all four real binding kinds inside an
          <code>html</code> template, and a hover provider that dynamically calls the real
          <code>explainTemplate()</code> so the hover text can never drift from what Aeon's
          renderer actually does.
        </p>
      `,
    })}
    ${Footer()}
  `;
}
