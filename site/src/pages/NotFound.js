import { html } from '@aeon-framework/core';
import Header from '../components/Header.js';
import Footer from '../components/Footer.js';
import { BASE, link } from '../router.js';

export default function NotFound() {
  return html`
    ${Header()}
    <main class="not-found">
      <h1>404</h1>
      <p>Nothing here. ${link(`${BASE}/`, 'Back home')}.</p>
    </main>
    ${Footer()}
  `;
}
