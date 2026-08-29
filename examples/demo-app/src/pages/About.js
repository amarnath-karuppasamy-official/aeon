import { html } from '@aeon/core';

export default function About() {
  return html`
    <section>
      <h2>About Aeon</h2>
      <p>
        A signal-first framework: fine-grained reactivity, direct DOM patching (no virtual DOM),
        a router, forms, and dependency injection — all built from small, plain ES modules.
      </p>
    </section>
  `;
}
