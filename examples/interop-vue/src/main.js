import { createApp, h, ref, defineComponent } from 'vue';
import { AeonView, useAeonSignal } from '@aeon-framework/interop/vue';
import { AeonCounter, sharedCount } from '../../shared/aeon-counter.js';

const App = defineComponent({
  setup() {
    const vueCount = ref(0);
    const sharedFromAeon = useAeonSignal(sharedCount);
    return () =>
      h('div', { style: 'font-family: system-ui, sans-serif; max-width: 480px; margin: 3rem auto;' }, [
        h('h1', null, 'Vue app, with an Aeon leaf'),
        h('section', null, [
          h('h2', null, 'Native Vue state'),
          h('p', { id: 'vue-out' }, `Vue count: ${vueCount.value}`),
          h('button', { id: 'vue-btn', onClick: () => vueCount.value++ }, '+1 (from Vue)'),
        ]),
        h('section', null, [
          h('h2', null, 'Aeon component, mounted inside Vue'),
          h(AeonView, { component: AeonCounter }),
        ]),
        h('section', null, [
          h('h2', null, "Vue reading the Aeon signal above"),
          h('p', { id: 'vue-reads-aeon' }, `Vue sees Aeon's count as: ${sharedFromAeon.value}`),
        ]),
      ]);
  },
});

createApp(App).mount('#root');
