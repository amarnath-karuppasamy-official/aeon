import { html, onMount } from '@aeon-framework/core';
import { BASE, link } from '../router.js';
import { initTheme, toggleTheme } from '../lib/theme.js';

export default function Header() {
  onMount(initTheme);
  return html`
    <header class="site-header">
      <div class="site-header-inner">
        ${link(`${BASE}/`, html`<span class="brand">&#9889; Aeon</span>`)}
        <nav class="site-nav">
          ${link(`${BASE}/docs`, 'Docs')}
          <a href="https://github.com/amarnath-karuppasamy-official/aeon" class="site-nav-external" target="_blank" rel="noopener">GitHub</a>
          <a href="https://www.npmjs.com/package/@aeon-framework/core" class="site-nav-external" target="_blank" rel="noopener">npm</a>
          <button type="button" class="theme-toggle" aria-label="Toggle color theme" @click=${toggleTheme}>&#9788;</button>
        </nav>
      </div>
    </header>
  `;
}
