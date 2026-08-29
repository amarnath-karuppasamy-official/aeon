import { h, defineComponent, ref as vueRef, onMounted, onUnmounted, shallowRef } from 'vue';
import { effect } from '@aeon/core';
import { attach } from './vanilla.js';

/** Mount an Aeon component as a leaf inside a Vue tree. */
export const AeonView = defineComponent({
  props: {
    component: { type: Function, required: true },
    props: { type: Object, default: () => ({}) },
  },
  setup(props) {
    const el = vueRef(null);
    let dispose = null;
    onMounted(() => {
      dispose = attach(el.value, props.component, props.props);
    });
    onUnmounted(() => dispose && dispose());
    return () => h('div', { ref: el });
  },
});

/** Read a live Aeon signal from a Vue `setup()`; returns a Vue ref kept in sync. */
export function useAeonSignal(sig) {
  const state = shallowRef(sig.peek());
  const stop = effect(() => {
    state.value = sig.value;
  });
  onUnmounted(stop);
  return state;
}
