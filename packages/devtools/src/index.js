// Aeon devtools: an in-page debug overlay, not a browser extension. Aeon
// signals carry no name/introspection metadata of their own — there is
// nothing to auto-discover — so a component author opts a signal into
// visibility explicitly via `registry.track(name, signal)`. The overlay
// itself is a completely ordinary Aeon component (built with `html`/`list`/
// `mount`, the same renderer as everything else) that re-renders each
// tracked value's row through a plain `effect()` binding, so it updates in
// real time with zero polling.
import { signal, html, list, mount } from '@aeon-framework/core';

function safeStringify(value) {
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return '[function]';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Create an independent registry of tracked signals. `track(name, sig)`
 * opts a signal into visibility (or replaces an existing entry under the
 * same name); `untrack(name)` removes it. `entries` is itself a signal —
 * bind to it directly if you want to build your own panel instead of
 * `mountDevtoolsOverlay`.
 */
export function createRegistry() {
  const entries = signal([]); // [{ name, signal }]

  function track(name, sig) {
    const current = entries.value;
    const idx = current.findIndex((e) => e.name === name);
    if (idx === -1) {
      entries.value = [...current, { name, signal: sig }];
    } else {
      const next = [...current];
      next[idx] = { name, signal: sig };
      entries.value = next;
    }
  }

  function untrack(name) {
    entries.value = entries.value.filter((e) => e.name !== name);
  }

  return { entries, track, untrack };
}

function OverlayPanel(registry) {
  return html`
    <div
      class="aeon-devtools-overlay"
      style="position:fixed;bottom:8px;right:8px;z-index:2147483647;background:#111827;color:#4ade80;font:12px/1.4 ui-monospace,monospace;padding:10px 12px;border-radius:8px;max-width:300px;max-height:340px;overflow:auto;box-shadow:0 4px 16px rgba(0,0,0,.4);"
    >
      <div style="font-weight:600;color:#e5e7eb;margin-bottom:6px;">Aeon Devtools</div>
      <div class="aeon-devtools-rows">
        ${() =>
          list(
            () => registry.entries.value,
            (e) => e.name,
            (e) => html`
              <div class="aeon-devtools-row" data-name="${e.name}">
                <span class="aeon-devtools-name">${e.name}</span>:
                <span class="aeon-devtools-value">${() => safeStringify(e.signal.value)}</span>
              </div>
            `
          )}
      </div>
    </div>
  `;
}

/**
 * Mount the overlay into `container` (any detached or attached element you
 * own). Returns a dispose function, same contract as `@aeon-framework/core`'s
 * `mount()` — because that's literally what this calls.
 */
export function mountDevtoolsOverlay(container, registry = createRegistry()) {
  function Overlay() {
    return OverlayPanel(registry);
  }
  const dispose = mount(Overlay, container);
  return Object.assign(dispose, { registry });
}

/**
 * Convenience one-liner for a real app: creates a registry, mounts the
 * overlay hidden into `document.body`, and toggles visibility on `hotkey`
 * (default `F2`). Returns `{ registry, toggle, destroy }` — call `destroy()`
 * to remove the overlay and stop listening entirely.
 */
export function attachDevtools({ hotkey = 'F2', registry = createRegistry() } = {}) {
  const container = document.createElement('div');
  container.style.display = 'none';
  document.body.appendChild(container);
  const dispose = mountDevtoolsOverlay(container, registry);

  function setVisible(visible) {
    container.style.display = visible ? 'block' : 'none';
  }
  function toggle() {
    setVisible(container.style.display === 'none');
  }
  function onKeydown(e) {
    if (e.key === hotkey) toggle();
  }
  window.addEventListener('keydown', onKeydown);

  return {
    registry,
    toggle,
    destroy() {
      window.removeEventListener('keydown', onKeydown);
      dispose();
      container.remove();
    },
  };
}
