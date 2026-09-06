// The dedicated prerender entry `aeon prerender` looks for — separate from
// src/main.js, which has side effects (it calls mount() against `document`
// at module scope). Re-exports the shared router + a thin App wrapper.
// No `paths` export: every route in this site's table is static (no
// ':param' segments) except the '*' catch-all, which @aeon-framework/ssg
// always skips automatically — so there's nothing dynamic to enumerate.
import { html } from '@aeon-framework/core';
import { router, outlet } from './router.js';

export { router };

export function App() {
  return html`<div class="app-root">${() => outlet(router)}</div>`;
}
