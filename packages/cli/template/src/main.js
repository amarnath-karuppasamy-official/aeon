import { mount, html, signal } from '@aeon/core';

// A signal is the whole story: writing to `count.value` re-renders only the
// two spots below that actually depend on it — nothing else re-runs.
function App() {
  const count = signal(0);

  return html`
    <h1>Welcome to Aeon</h1>
    <p>Count: <strong>${() => count.value}</strong></p>
    <button @click=${() => count.value++}>+1</button>
  `;
}

mount(App, document.getElementById('app'));
