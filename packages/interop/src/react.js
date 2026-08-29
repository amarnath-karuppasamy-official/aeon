// Two directions of interop with React:
//   <AeonView> mounts an Aeon component inside a React tree (Aeon owns a leaf).
//   useAeonSignal reads an Aeon signal from a React component (React owns the tree,
//   Aeon just supplies reactive data — useful if you're migrating incrementally
//   and want a shared store both sides can read).
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createElement } from 'react';
import { effect } from '@aeon/core';
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
