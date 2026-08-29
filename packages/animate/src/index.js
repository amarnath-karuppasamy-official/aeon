// Aeon animate: enter/leave transitions driven by class toggles, with a
// deterministic timeout fallback so behavior (and tests) never depend on a
// real CSS `transitionend` firing — Happy DOM (and plenty of real browser
// edge cases: `display:none` ancestors, zero-duration transitions, reduced
// motion) don't fire it reliably. Whichever happens first — a genuine
// `transitionend` on the element, or `duration` milliseconds — resolves the
// transition. This is a documented trade-off, not a bug: it trades a small
// amount of "might resolve slightly early on a real slow transition" risk
// for "never hangs."
import { effect } from '@aeon-framework/core';

const DEFAULT_DURATION = 200;

function afterTransition(el, duration) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
      resolve();
    };
    const onEnd = (e) => {
      if (e.target === el) finish();
    };
    el.addEventListener('transitionend', onEnd);
    const timer = setTimeout(finish, duration);
  });
}

/**
 * Drive one element's enter or leave transition.
 *
 * `enter(el)`: adds `className` (the "before" state, e.g. `opacity: 0`),
 * yields a tick so a real browser can paint that state, then removes it —
 * which is what actually triggers the CSS transition to the element's
 * normal state — and resolves once that transition ends (or `duration`
 * elapses).
 *
 * `leave(el)`: adds `className` (the "leaving" state) and resolves once the
 * resulting transition ends (or `duration` elapses) — the element is left
 * in the DOM throughout; the caller removes it after the returned promise
 * resolves. This is what lets a list row visibly animate out before it's
 * actually removed.
 */
export const transition = {
  async enter(el, { className = 'aeon-enter', duration = DEFAULT_DURATION } = {}) {
    el.classList.add(className);
    await Promise.resolve(); // let a real renderer paint the "before" state first
    const done = afterTransition(el, duration);
    el.classList.remove(className);
    await done;
  },
  async leave(el, { className = 'aeon-leave', duration = DEFAULT_DURATION } = {}) {
    el.classList.add(className);
    await afterTransition(el, duration);
  },
};

/**
 * A keyed list of real DOM elements, reactive over `items()`, where a row
 * removed from `items()` is transitioned out (`transition.leave`) before it
 * is actually removed from `container`, and a newly-added row is
 * transitioned in (`transition.enter`) after being inserted.
 *
 * This manages `container`'s children directly rather than going through
 * `@aeon-framework/core`'s `list()` — `list()` removes a departing row's DOM
 * synchronously (correct for its own no-flash-elsewhere guarantees, but it
 * has no notion of "wait before removing"), so animated removal needs its
 * own small reconciler instead of trying to intercept core's.
 *
 * `render(item, index)` must return a real DOM element (build it however
 * you like — `document.createElement`, or `@aeon-framework/core`'s
 * `render()`/`mount()` into a scratch container and taking
 * `.firstElementChild`).
 *
 * Returns a stop function that ends reactivity (in-flight leave animations
 * still finish and remove their element).
 */
export function animatedList(
  container,
  { items, key, render: renderItem, enterClass = 'aeon-enter', leaveClass = 'aeon-leave', duration = DEFAULT_DURATION }
) {
  const state = new Map(); // key -> { el, item }

  const stop = effect(() => {
    const list = items();
    const keys = list.map((item, i) => (key ? key(item, i) : i));
    const keySet = new Set(keys);

    // Rows whose key disappeared: animate out, then actually remove.
    for (const [k, entry] of [...state]) {
      if (keySet.has(k)) continue;
      state.delete(k);
      transition.leave(entry.el, { className: leaveClass, duration }).then(() => {
        entry.el.remove();
      });
    }

    // Insert new rows / reposition or refresh existing ones, in order.
    let prevEl = null;
    for (let i = 0; i < list.length; i++) {
      const k = keys[i];
      const item = list[i];
      let entry = state.get(k);

      if (!entry) {
        const el = renderItem(item, i);
        entry = { el, item };
        state.set(k, entry);
        insertAfter(container, prevEl, el);
        transition.enter(el, { className: enterClass, duration });
      } else if (entry.item !== item) {
        const el = renderItem(item, i);
        container.replaceChild(el, entry.el);
        entry.el = el;
        entry.item = item;
      } else {
        const expectedNext = prevEl ? prevEl.nextSibling : container.firstChild;
        if (expectedNext !== entry.el) insertAfter(container, prevEl, entry.el);
      }
      prevEl = entry.el;
    }
  });

  return () => stop();
}

function insertAfter(container, prevEl, el) {
  const ref = prevEl ? prevEl.nextSibling : container.firstChild;
  if (ref !== el) container.insertBefore(el, ref);
}
