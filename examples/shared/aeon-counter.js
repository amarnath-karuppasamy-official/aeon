// A plain Aeon component — no idea it's being embedded in a React or Vue app.
// That's the point: the host framework doesn't get a say in how this renders.
import { html, signal } from '@aeon/core';

export const sharedCount = signal(0);

export function AeonCounter() {
  return html`
    <div style="border:1px solid #888; padding:0.75rem; border-radius:6px;">
      <p id="aeon-out">Aeon-rendered count: ${() => sharedCount.value}</p>
      <button id="aeon-btn" @click=${() => sharedCount.value++}>+1 (from Aeon)</button>
    </div>
  `;
}
