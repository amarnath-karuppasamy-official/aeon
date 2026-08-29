import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signal, hydrateComponent } from '@aeon-framework/core';
import { renderToString } from '../src/index.js';

// renderToString() installs its own Happy DOM window on first use and keeps
// it for the process (see src/index.js) — that same `document` global is
// what hydrateComponent() below runs against too, matching real usage where
// hydration happens against the DOM the browser already parsed from the
// server's HTML.

test('renderToString() runs the real client renderer and serializes real HTML', async () => {
  const { html } = await import('@aeon-framework/core');
  function Greeting({ name }) {
    return html`<section class="greet"><h1>Hello, ${() => name}!</h1><p id="static">static text</p></section>`;
  }
  const out = renderToString(Greeting, { name: 'Ada' });
  assert.match(out, /<section class="greet">/);
  assert.match(out, /<h1>Hello, Ada/);
  assert.match(out, /!<\/h1>/);
  assert.match(out, /id="static"/);
  // The node-part marker comment must survive serialization — it's what
  // hydrate() resyncs on. (Matched loosely: the marker's internal text is
  // an implementation detail of @aeon-framework/core, not part of this
  // package's contract.)
  assert.match(out, /<!--.*?aeon:\d+.*?aeon-->/);
});

test('SSR HTML hydrates without recreating nodes and stays interactive', async () => {
  const { html } = await import('@aeon-framework/core');
  function Counter() {
    const count = signal(0);
    return html`<div class="counter"><span id="value">${() => count.value}</span><button id="inc" @click=${() => count.value++}>+1</button></div>`;
  }

  const serverHtml = renderToString(Counter);
  assert.match(serverHtml, /<span id="value">0/);

  // Simulate the browser having already parsed the server response into the
  // mount-point element.
  const container = document.createElement('div');
  container.innerHTML = serverHtml;
  document.body.appendChild(container);

  const spanBefore = container.querySelector('#value');
  const buttonBefore = container.querySelector('#inc');
  assert.ok(spanBefore && buttonBefore);
  assert.equal(spanBefore.textContent, '0');

  const dispose = hydrateComponent(Counter, container);

  // Identity check: hydration adopted the existing nodes, it didn't tear
  // the container down and rebuild it.
  assert.equal(container.querySelector('#value'), spanBefore);
  assert.equal(container.querySelector('#inc'), buttonBefore);

  // Interactivity: the click listener wired up by hydrate() actually fires
  // and the signal-bound text node it drives actually updates.
  buttonBefore.click();
  assert.equal(container.querySelector('#value').textContent, '1');
  buttonBefore.click();
  assert.equal(container.querySelector('#value').textContent, '2');

  dispose();
  container.remove();
});

// Regression test for a real bug found while dogfooding this package for a
// per-request SSR server: renderToString()'s window used to default to
// Happy DOM's `about:blank`, which has a null origin. @aeon-framework/router's
// navigate() drives window.history.pushState()/replaceState() to resolve
// the route matching the incoming request URL before rendering — the
// standard "SSR this specific URL" pattern — and pushState() throws a
// SecurityError against a null-origin document. ensureDom() now installs
// the window with a real origin (http://localhost/) precisely so this works
// out of the box.
test('renderToString() + router.navigate() can server-render whatever route matches the request URL', async () => {
  const { createRouter, outlet } = await import('@aeon-framework/router');
  const { html } = await import('@aeon-framework/core');

  function Home() {
    return html`<h1>Home</h1>`;
  }
  function About() {
    return html`<h1>About</h1>`;
  }
  const router = createRouter([
    { path: '/', component: Home },
    { path: '/about', component: About },
  ]);
  function App() {
    return html`<main>${() => outlet(router)}</main>`;
  }

  // This is the part that used to throw SecurityError before the fix.
  assert.doesNotThrow(() => router.navigate('/about', { replace: true }));

  const out = renderToString(App);
  assert.match(out, /<h1>About<\/h1>/);
  assert.doesNotMatch(out, /<h1>Home<\/h1>/);
});
