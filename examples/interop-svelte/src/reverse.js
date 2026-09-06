// Reverse direction: Aeon owns the tree, a real Svelte component is a leaf.
import { html, signal, mount, onCleanup } from '@aeon-framework/core';
import { hostSvelte } from '@aeon-framework/interop/svelte';
import SvelteBadge from './SvelteBadge.svelte';

const aeonCount = signal(0);

function App() {
  const { node, dispose } = hostSvelte(SvelteBadge, () => ({ label: 'seen by Svelte', value: aeonCount.value }));
  onCleanup(dispose);
  return html`
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 3rem auto;">
      <h1>Aeon app, with a Svelte leaf</h1>
      <section>
        <h2>Native Aeon state</h2>
        <p id="aeon-out">Aeon count: ${() => aeonCount.value}</p>
        <button id="aeon-btn" @click=${() => aeonCount.value++}>+1 (from Aeon)</button>
      </section>
      <section>
        <h2>Svelte component, mounted inside Aeon (hostSvelte)</h2>
        <div id="svelte-host">${node}</div>
      </section>
    </div>
  `;
}

mount(App, document.getElementById('root'));
