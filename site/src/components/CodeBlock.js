import { html } from '@aeon-framework/core';
import { highlight } from '../lib/highlight.js';

/**
 * A static (non-reactive) code sample block. `code` is trimmed and
 * dedented-by-caller; this component only tokenizes + highlights it once at
 * render/prerender time — the highlighted markup is a plain string, so it's
 * a *static* `.innerHTML=` binding (a plain value, not a function), per
 * Aeon's own "function = reactive, plain value = static" rule.
 */
export default function CodeBlock({ code, lang = 'js', title }) {
  const trimmed = code.replace(/^\n/, '').replace(/\s+$/, '');
  return html`
    <div class="code-block">
      ${title ? html`<div class="code-block-title">${title}</div>` : ''}
      <pre class=${`lang-${lang}`}><code .innerHTML=${highlight(trimmed)}></code></pre>
    </div>
  `;
}
