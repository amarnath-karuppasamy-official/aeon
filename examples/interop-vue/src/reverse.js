// Reverse direction: Aeon owns the tree, a real Vue component is a leaf.
import { defineComponent, h } from 'vue';
import { html, signal, mount, onCleanup } from '@aeon-framework/core';
import { hostVue } from '@aeon-framework/interop/vue';

// An ordinary Vue component — no idea it's being hosted inside Aeon.
const VueBadge = defineComponent({
  props: { label: String, value: Number },
  setup(props) {
    return () => h('span', { id: 'vue-badge' }, `${props.label}: ${props.value}`);
  },
});

const aeonCount = signal(0);

function App() {
  const { node, dispose } = hostVue(VueBadge, () => ({ label: 'seen by Vue', value: aeonCount.value }));
  onCleanup(dispose);
  return html`
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 3rem auto;">
      <h1>Aeon app, with a Vue leaf</h1>
      <section>
        <h2>Native Aeon state</h2>
        <p id="aeon-out">Aeon count: ${() => aeonCount.value}</p>
        <button id="aeon-btn" @click=${() => aeonCount.value++}>+1 (from Aeon)</button>
      </section>
      <section>
        <h2>Vue component, mounted inside Aeon (hostVue)</h2>
        <div id="vue-host">${node}</div>
      </section>
    </div>
  `;
}

mount(App, document.getElementById('root'));
