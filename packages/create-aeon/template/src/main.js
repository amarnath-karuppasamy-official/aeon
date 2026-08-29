import { mount, html, signal } from '@aeon-framework/core';

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

// Everything else in the framework is already installed (see package.json)
// and ready to import when you need it — nothing more to add:
//   @aeon-framework/router    createRouter, outlet, link
//   @aeon-framework/forms     control, group, validators
//   @aeon-framework/di        createToken, provide, inject
//   @aeon-framework/http      http.get/post/..., resource(), mutation()
//   @aeon-framework/i18n      locale, t(), loadMessages()
//   @aeon-framework/animate   transition, animatedList()
//   @aeon-framework/devtools  attachDevtools() — press the hotkey to see live signals
//   @aeon-framework/ssr       renderToString() for a Node SSR server
// See the README at https://github.com/amarnath-karuppasamy-official/aeon
// for a working example of each.
