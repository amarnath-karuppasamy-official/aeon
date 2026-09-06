// Two directions of interop with React:
//   <AeonView> mounts an Aeon component inside a React tree (Aeon owns a leaf).
//   useAeonSignal reads an Aeon signal from a React component (React owns the tree,
//   Aeon just supplies reactive data — useful if you're migrating incrementally
//   and want a shared store both sides can read).
// A third direction lives here too: hostReact mounts a real React component
// as a leaf inside an Aeon `html` template (Aeon owns the tree, React owns
// a node inside it) — the mirror image of AeonView.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { effect } from '@aeon-framework/core';
import { attach } from './vanilla.js';

/** Mount an Aeon component as a leaf inside a React tree. */
export function AeonView({ component, props }) {
  const ref = useRef(null);
  useEffect(() => {
    const dispose = attach(ref.current, component, props);
    return dispose;
    // Re-mount whenever the component or its props object identity changes —
    // simplest-correct v0.1 behavior. Pass a stable props object if you need
    // to avoid remounting on every React render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [component, props]);
  return createElement('div', { ref });
}

/** Read a live Aeon signal from React code; re-renders the component on change. */
export function useAeonSignal(sig) {
  return useSyncExternalStore(
    (onStoreChange) => effect(() => { void sig.value; onStoreChange(); }),
    () => sig.peek()
  );
}

/**
 * Mount a real React component as a leaf inside an Aeon `html` template.
 * `propsFn` is read inside an Aeon effect, so any Aeon signal it reads
 * re-renders the React component with fresh props — no remounting, just
 * React's own `root.render()` reconciling against the same root each time.
 * Returns { node, dispose }; `node` is a plain DOM node, usable directly as
 * a value inside an Aeon html`` template.
 */
export function hostReact(Component, propsFn) {
  const node = document.createElement('div');
  let root = null;
  const stop = effect(() => {
    const props = typeof propsFn === 'function' ? propsFn() : propsFn;
    if (!root) root = createRoot(node);
    root.render(createElement(Component, props));
  });
  return {
    node,
    dispose: () => {
      stop();
      if (root) root.unmount();
    },
  };
}
