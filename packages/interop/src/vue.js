import { h, defineComponent, ref as vueRef, onMounted, onUnmounted, shallowRef, render as vueRender } from 'vue';
import { effect } from '@aeon-framework/core';
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

/**
 * Mount a real Vue component as a leaf inside an Aeon `html` template, using
 * Vue's own low-level `render(vnode, container)` API (Vue's documented
 * pattern for embedding into a non-Vue app — see
 * https://vuejs.org/api/render-function.html#render — deliberately not a
 * whole `createApp()` per prop update, which would be wasteful and remount
 * the component every time). Each Aeon-effect re-run just calls `render()`
 * again with a fresh vnode; Vue patches the existing instance in place.
 * `render(null, container)` (used in dispose) is Vue's own documented way
 * to unmount.
 */
export function hostVue(Component, propsFn) {
  const node = document.createElement('div');
  const stop = effect(() => {
    const props = typeof propsFn === 'function' ? propsFn() : propsFn;
    vueRender(h(Component, props), node);
  });
  return {
    node,
    dispose: () => {
      stop();
      vueRender(null, node);
    },
  };
}
