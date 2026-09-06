import { html } from '@aeon-framework/core';
import Header from '../../components/Header.js';
import Footer from '../../components/Footer.js';
import DocsLayout from '../../components/DocsLayout.js';
import CodeBlock from '../../components/CodeBlock.js';
import { BASE, link } from '../../router.js';

const signalsCode = `import { signal, computed, effect, batch } from '@aeon-framework/core';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log('count is now', count.value);
});

batch(() => {
  count.value = 1;
  count.value = 2; // effect above runs once, not twice
});`;

const listCode = `import { html, list } from '@aeon-framework/core';

// list(itemsFn, keyFn, renderFn) — reactive when itemsFn reads a signal.
function TodoList({ todos }) {
  return html\`
    <ul>
      \${() => list(
        () => todos.value,
        (todo) => todo.id,
        (todo) => html\`<li>\${todo.text}</li>\`
      )}
    </ul>
  \`;
}`;

const lifecycleCode = `import { html, onMount, onCleanup } from '@aeon-framework/core';

function Clock() {
  const time = signal(new Date());
  onMount(() => {
    const id = setInterval(() => (time.value = new Date()), 1000);
    onCleanup(() => clearInterval(id));
  });
  return html\`<p>\${() => time.value.toLocaleTimeString()}</p>\`;
}`;

const hydrateCode = `import { renderToString } from '@aeon-framework/ssr';
import { hydrateComponent } from '@aeon-framework/core';

// on the server:
const html = renderToString(Counter);

// on the client, once the browser has parsed that HTML into the DOM:
hydrateComponent(Counter, document.getElementById('app'));`;

export default function CoreConcepts() {
  return html`
    ${Header()}
    ${DocsLayout({
      active: `${BASE}/docs/core-concepts`,
      children: html`
        <h1>Core concepts</h1>

        <h2>Signals</h2>
        <p>
          State is a signal, not a subscription you manage. <code>signal(0)</code> gives you
          <code>.value</code> get/set; any template expression that reads it re-renders only
          that binding when it changes — no <code>ChangeDetectorRef</code>, no zone patching.
          <code>computed()</code> derives a value that recalculates when its dependencies
          change; <code>effect()</code> runs a side effect on every dependency change;
          <code>batch()</code> coalesces multiple writes into one notification.
        </p>
        ${CodeBlock({ code: signalsCode, lang: 'js' })}

        <h2>Templates: the <code>html</code> tag</h2>
        <p>
          Templates compile once (cached per call site) into a real <code>&lt;template&gt;</code>;
          each reactive value gets a direct binding to the exact DOM node or attribute it
          controls. See ${link(`${BASE}/docs/getting-started`, 'Getting started')} for the
          four binding kinds (<code>attr=</code>, <code>.prop=</code>, <code>@event=</code>,
          <code>?bool=</code>) and the "function = reactive, plain value = static" rule.
        </p>

        <h2><code>list()</code>: keyed rendering</h2>
        <p>
          A keyed list reuses and repositions existing DOM/effects instead of rebuilding the
          list on every update — a row is repositioned only when its item is reference-identical
          to last render (true for every untouched row after an <code>array.map(...)</code>-style
          update), and only a row whose item reference actually changed is remounted.
        </p>
        ${CodeBlock({ code: listCode, lang: 'js' })}

        <h2><code>onMount</code> / <code>onCleanup</code></h2>
        <p>
          <code>onMount(fn)</code> runs once after the component's DOM has actually been
          attached. <code>onCleanup(fn)</code> registers a callback that runs when the nearest
          enclosing <code>mount()</code> is disposed — the standard place to tear down a timer,
          subscription, or event listener.
        </p>
        ${CodeBlock({ code: lifecycleCode, lang: 'js' })}

        <h2>Hydration, briefly</h2>
        <p>
          <code>hydrate()</code>/<code>hydrateComponent()</code> <strong>adopt</strong> existing
          (e.g. server-rendered) DOM instead of clearing the container and re-rendering it —
          attribute/property/boolean bindings are (re-)applied in place, event listeners are
          attached, and node-part content is adopted by reference, list rows included. See
          ${link(`${BASE}/docs/rendering`, 'SSR, SSG & rendering')} for the full story —
          this site itself ships prerendered HTML that hydrates on load.
        </p>
        ${CodeBlock({ code: hydrateCode, lang: 'js' })}
      `,
    })}
    ${Footer()}
  `;
}
