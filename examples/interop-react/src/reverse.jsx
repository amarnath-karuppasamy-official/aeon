// Reverse direction: Aeon owns the tree, a real React component is a leaf.
import { createElement } from 'react';
import { html, signal, mount, onCleanup } from '@aeon-framework/core';
import { hostReact } from '@aeon-framework/interop/react';

// An ordinary React component — no idea it's being hosted inside Aeon.
function ReactBadge({ label, value }) {
  return createElement('span', { id: 'react-badge' }, `${label}: ${value}`);
}

const aeonCount = signal(0);

function App() {
  const { node, dispose } = hostReact(ReactBadge, () => ({ label: 'seen by React', value: aeonCount.value }));
  onCleanup(dispose);
  return html`
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 3rem auto;">
      <h1>Aeon app, with a React leaf</h1>
      <section>
        <h2>Native Aeon state</h2>
        <p id="aeon-out">Aeon count: ${() => aeonCount.value}</p>
        <button id="aeon-btn" @click=${() => aeonCount.value++}>+1 (from Aeon)</button>
      </section>
      <section>
        <h2>React component, mounted inside Aeon (hostReact)</h2>
        <div id="react-host">${node}</div>
      </section>
    </div>
  `;
}

mount(App, document.getElementById('root'));
