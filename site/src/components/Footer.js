import { html } from '@aeon-framework/core';

export default function Footer() {
  return html`
    <footer class="site-footer">
      <div class="site-footer-inner">
        <div class="site-footer-links">
          <a href="https://github.com/amarnath-karuppasamy-official/aeon" target="_blank" rel="noopener">GitHub</a>
          <a href="https://www.npmjs.com/package/@aeon-framework/core" target="_blank" rel="noopener">npm</a>
        </div>
        <p class="site-footer-honest">
          This is a working v0.1 skeleton — real reactivity, a real renderer, a real
          router/forms/DI, a CLI, and a demo app that exercises all of it. It is not
          a finished competitor to Angular; it's the foundation such a project would
          be built on.
        </p>
      </div>
    </footer>
  `;
}
