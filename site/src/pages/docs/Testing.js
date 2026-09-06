import { html } from '@aeon-framework/core';
import Header from '../../components/Header.js';
import Footer from '../../components/Footer.js';
import DocsLayout from '../../components/DocsLayout.js';
import CodeBlock from '../../components/CodeBlock.js';
import { BASE } from '../../router.js';

const testingCode = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, fireEvent, cleanup } from '@aeon-framework/testing';
import { Counter } from './counter.js';

test.afterEach(() => cleanup());

test('clicking +1 increments the count', async () => {
  const { find } = await render(Counter);
  fireEvent.click(find('#inc'));
  assert.equal(find('#count').textContent, '1');
});`;

export default function Testing() {
  return html`
    ${Header()}
    ${DocsLayout({
      active: `${BASE}/docs/testing`,
      children: html`
        <h1>Testing</h1>
        <p>
          <code>@aeon-framework/testing</code> mounts a component into a real document (Happy
          DOM, not a mock) and gives you Testing-Library-style helpers. Aeon's signal writes
          apply synchronously — no virtual-DOM diff to flush — so assertions run immediately
          after an interaction, no <code>await tick()</code> needed.
        </p>
        ${CodeBlock({ code: testingCode, lang: 'js' })}
        <p>
          <code>render()</code> mounts a component and returns query helpers (like
          <code>find</code>) scoped to the real DOM it produced. <code>fireEvent</code> dispatches
          a real DOM event (click, input, submit, ...) synchronously. <code>cleanup()</code> tears
          down every component mounted since the last cleanup — call it in
          <code>test.afterEach()</code> so tests don't leak DOM into one another.
        </p>
      `,
    })}
    ${Footer()}
  `;
}
