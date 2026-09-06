import { html } from '@aeon-framework/core';
import { DOCS_NAV, router } from '../router.js';

/**
 * Shared docs shell: a left sidebar nav + a content column. Every page under
 * /docs/* renders through this one real, reusable component instead of
 * copy-pasting the sidebar markup per page.
 */
export default function DocsLayout({ active, children }) {
  return html`
    <div class="docs-shell">
      <input type="checkbox" id="docs-nav-toggle" class="docs-nav-toggle" />
      <label for="docs-nav-toggle" class="docs-nav-toggle-label">
        <span>Menu</span>
        <span class="docs-nav-toggle-icon">&#9776;</span>
      </label>
      <aside class="docs-sidebar">
        <nav>
          ${DOCS_NAV.map(
            (item) => html`<a
              class=${item.path === active ? 'docs-nav-link active' : 'docs-nav-link'}
              href=${item.path}
              @click=${(e) => {
                e.preventDefault();
                router.navigate(item.path);
              }}
              >${item.label}</a
            >`
          )}
        </nav>
      </aside>
      <article class="docs-content">${children}</article>
    </div>
  `;
}
