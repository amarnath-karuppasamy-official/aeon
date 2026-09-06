import { html } from '@aeon-framework/core';
import Header from '../../components/Header.js';
import Footer from '../../components/Footer.js';
import DocsLayout from '../../components/DocsLayout.js';
import CodeBlock from '../../components/CodeBlock.js';
import { BASE } from '../../router.js';

const reactCode = `import { AeonView, useAeonSignal } from '@aeon-framework/interop/react';
import { sharedCount } from './aeon-counter.js';

function Page() {
  const count = useAeonSignal(sharedCount); // React re-renders when the Aeon signal changes
  return (
    <div>
      <p>React sees: {count}</p>
      <AeonView component={AeonCounter} />
    </div>
  );
}`;

const svelteCode = `<script>
  import { aeonMount, aeonSignalStore } from '@aeon-framework/interop/svelte';
  import { AeonCounter, sharedCount } from './aeon-counter.js';
  const count = aeonSignalStore(sharedCount); // a real Svelte store
</script>

<p>Svelte sees: {$count}</p>
<div use:aeonMount={{ component: AeonCounter }}></div>`;

const angularCode = `import { AeonHostDirective, toObservable } from '@aeon-framework/interop/angular';
import { sharedCount } from './aeon-counter.js';

@Component({
  standalone: true,
  imports: [AeonHostDirective, AsyncPipe],
  template: \`
    <p>Angular sees: {{ (count$ | async) }}</p>
    <div aeonHost [component]="AeonCounter"></div>
  \`,
})
class Page {
  AeonCounter = AeonCounter;
  count$ = toObservable(sharedCount);
}`;

const hostReactCode = `import { onCleanup } from '@aeon-framework/core';
import { hostReact } from '@aeon-framework/interop/react';

function MyAeonComponent() {
  const { node, dispose } = hostReact(ReactCounter, () => ({ count: count.value }));
  onCleanup(dispose);
  return html\`<div>\${node}</div>\`;
}`;

const migrateCode = `npx aeon migrate src/Counter.jsx    # writes src/Counter.aeon.jsx — never touches the original`;

export default function Interop() {
  return html`
    ${Header()}
    ${DocsLayout({
      active: `${BASE}/docs/interop`,
      children: html`
        <h1>Interop &amp; migration</h1>
        <p>
          Aeon owns a real DOM node, not a virtual one, so embedding it inside another framework
          is just "call <code>mount()</code> when the host mounts, call <code>dispose()</code>
          when the host unmounts" — no reconciliation conflict is possible because Aeon never
          touches nodes it wasn't given. <code>@aeon-framework/interop</code> covers this in both
          directions, for React, Vue, Svelte, and Angular.
        </p>

        <h2>Aeon inside a host framework</h2>
        <p><strong>React</strong> — <code>AeonView</code> mounts an Aeon component as a leaf; <code>useAeonSignal</code> mirrors an Aeon signal into React's own re-render mechanism:</p>
        ${CodeBlock({ code: reactCode, lang: 'js', title: 'React' })}
        <p><strong>Vue</strong> works the same way (<code>@aeon-framework/interop/vue</code>): a <code>defineComponent</code> wrapper plus a <code>useAeonSignal</code> composable built on <code>shallowRef</code>.</p>
        <p><strong>Svelte</strong> (<code>@aeon-framework/interop/svelte</code>) ships a Svelte action — no <code>.svelte</code> file, so this package never needs the Svelte compiler to build or ship — plus a store adapter built purely on Aeon's own <code>effect()</code>:</p>
        ${CodeBlock({ code: svelteCode, lang: 'js', title: 'Svelte' })}
        <p><strong>Angular</strong> (<code>@aeon-framework/interop/angular</code>) ships a standalone <code>AeonHostDirective</code> and a <code>toObservable()</code> adapter onto RxJS:</p>
        ${CodeBlock({ code: angularCode, lang: 'js', title: 'Angular' })}
        <p>A <strong>vanilla</strong> entry point (<code>@aeon-framework/interop/vanilla</code>) covers any framework without a dedicated adapter: <code>attach(container, Component, props)</code> returns a dispose function.</p>

        <h2>A host framework's component inside Aeon</h2>
        <p>
          The reverse direction: <code>host&lt;Framework&gt;(Component, propsFn)</code> mounts a
          real React/Vue/Svelte/Angular component and hands back <code>{ node, dispose }</code> —
          <code>node</code> is a plain DOM <code>Node</code>, usable directly as a value inside an
          Aeon <code>html</code> template. <code>propsFn</code> is read inside an Aeon
          <code>effect()</code>, so any Aeon signal it reads keeps the hosted component's props
          live, with no remounting.
        </p>
        ${CodeBlock({ code: hostReactCode, lang: 'js' })}
        <p>
          <code>hostVue</code> and <code>hostSvelte</code> follow the identical two-line shape.
          <code>hostAngular</code> is the one exception, and it's a real, inherent asymmetry
          rather than an oversight: Angular has no ambient "current application" the way React
          just needs <code>document</code> — an Angular component can only be created through an
          <code>EnvironmentInjector</code>, so <code>hostAngular(Component, environmentInjector, propsFn)</code>
          takes that injector explicitly.
        </p>

        <h2>Migrating from React</h2>
        <p>
          The honest version of "automatic migration": there is no tool, for any framework, that
          can take arbitrary code and rewrite it into a different framework with a guarantee of
          zero breakage. What's built instead is a codemod with a clearly defined, honest scope:
        </p>
        ${CodeBlock({ code: migrateCode, lang: 'sh' })}
        <p>Add <code>// @aeon-migrate</code> above a component to opt it in. The codemod (built on Babel's parser/traverse/generator) converts:</p>
        <ul>
          <li><code>useState</code> &rarr; <code>signal()</code>, including the functional-updater form (<code>setX(c =&gt; c + 1)</code> &rarr; <code>x.value = x.value + 1</code>)</li>
          <li>plain-DOM-tag JSX &rarr; Aeon <code>html</code> templates</li>
          <li>ternary and <code>&amp;&amp;</code> conditional JSX children</li>
        </ul>
        <p>
          Anything outside that — other hooks (<code>useEffect</code>, <code>useContext</code>, ...),
          props, JSX fragments, spread attributes, <code>.map()</code>-based list rendering,
          references to other custom components — is <strong>left completely untouched</strong> in
          the output file, with a <code>// AEON-MIGRATE: skipped "Name" — reason</code> comment
          explaining why, rather than guessed at or silently broken. The original source file is
          never modified.
        </p>
      `,
    })}
    ${Footer()}
  `;
}
