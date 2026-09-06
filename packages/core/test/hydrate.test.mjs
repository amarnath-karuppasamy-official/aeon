import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { html, render, hydrate, mount, hydrateComponent, signal, list } from '../src/index.js';

function installWindow() {
  const window = new Window();
  globalThis.window = window;
  globalThis.document = window.document;
  for (const key of ['Node', 'Element', 'HTMLElement', 'Event', 'CustomEvent', 'MouseEvent']) {
    if (key in window) {
      try {
        globalThis[key] = window[key];
      } catch {
        /* ignore */
      }
    }
  }
}

installWindow();

test('hydrate() adopts existing text/attribute DOM without recreating nodes', () => {
  function Counter() {
    const count = signal(0);
    return html`<div class="counter"><p id="out">${() => count.value}</p><button id="inc" @click=${() => count.value++}>+1</button></div>`;
  }

  // Server-side render into container A.
  const serverContainer = document.createElement('div');
  const serverDispose = mount(Counter, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  // Simulate a browser that already parsed the server HTML.
  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const pBefore = clientContainer.querySelector('#out');
  const buttonBefore = clientContainer.querySelector('#inc');
  assert.ok(pBefore && buttonBefore);
  assert.equal(pBefore.textContent, '0');

  const dispose = hydrateComponent(Counter, clientContainer);

  const pAfter = clientContainer.querySelector('#out');
  const buttonAfter = clientContainer.querySelector('#inc');
  // Identity check: hydration must not have destroyed/recreated these nodes.
  assert.equal(pAfter, pBefore);
  assert.equal(buttonAfter, buttonBefore);

  // Interactivity: the event listener attached by hydrate() actually fires.
  buttonAfter.click();
  assert.equal(clientContainer.querySelector('#out').textContent, '1');
  assert.equal(clientContainer.querySelector('#out'), pBefore); // still the same node

  dispose();
});

test('hydrate() adopts server-rendered list() rows without recreating their DOM nodes', () => {
  const items = signal([{ id: 1, label: 'a' }, { id: 2, label: 'b' }, { id: 3, label: 'c' }]);
  function List() {
    return html`<ul>${() => list(() => items.value, (i) => i.id, (i) => html`<li>${i.label}</li>`)}</ul>`;
  }
  const serverContainer = document.createElement('div');
  const serverDispose = mount(List, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const lisBefore = [...clientContainer.querySelectorAll('li')];
  assert.equal(lisBefore.length, 3);
  assert.deepEqual(lisBefore.map((li) => li.textContent), ['a', 'b', 'c']);

  const dispose = hydrateComponent(List, clientContainer);

  const lisAfter = [...clientContainer.querySelectorAll('li')];
  assert.equal(lisAfter.length, 3);
  // Node-identity check, same pattern as the non-list hydration test above:
  // hydration must have adopted these exact <li> elements, not torn them
  // down and re-rendered a fresh set.
  assert.equal(lisAfter[0], lisBefore[0]);
  assert.equal(lisAfter[1], lisBefore[1]);
  assert.equal(lisAfter[2], lisBefore[2]);

  dispose();
});

test('hydrate() + list(): adding an item after hydration appends a new row without disturbing the adopted rows', () => {
  const items = signal([{ id: 1, label: 'a' }, { id: 2, label: 'b' }]);
  function List() {
    return html`<ul>${() => list(() => items.value, (i) => i.id, (i) => html`<li>${i.label}</li>`)}</ul>`;
  }
  const serverContainer = document.createElement('div');
  const serverDispose = mount(List, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const adopted = [...clientContainer.querySelectorAll('li')];
  const dispose = hydrateComponent(List, clientContainer);

  items.value = [...items.value, { id: 3, label: 'c' }];

  const lis = [...clientContainer.querySelectorAll('li')];
  assert.equal(lis.length, 3);
  assert.deepEqual(lis.map((li) => li.textContent), ['a', 'b', 'c']);
  // The two original (server-rendered, hydration-adopted) rows are still
  // the exact same nodes — only the new row is actually new.
  assert.equal(lis[0], adopted[0]);
  assert.equal(lis[1], adopted[1]);

  dispose();
});

test('hydrate() + list(): removing an item after hydration removes only that row', () => {
  const items = signal([{ id: 1, label: 'a' }, { id: 2, label: 'b' }, { id: 3, label: 'c' }]);
  function List() {
    return html`<ul>${() => list(() => items.value, (i) => i.id, (i) => html`<li>${i.label}</li>`)}</ul>`;
  }
  const serverContainer = document.createElement('div');
  const serverDispose = mount(List, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const adopted = [...clientContainer.querySelectorAll('li')];
  const dispose = hydrateComponent(List, clientContainer);

  items.value = items.value.filter((i) => i.id !== 2);

  const lis = [...clientContainer.querySelectorAll('li')];
  assert.equal(lis.length, 2);
  assert.deepEqual(lis.map((li) => li.textContent), ['a', 'c']);
  assert.equal(lis[0], adopted[0]);
  assert.equal(lis[1], adopted[2]);
  // The removed row's node is actually gone from the document, not just
  // unlinked from the list's own bookkeeping.
  assert.equal(clientContainer.contains(adopted[1]), false);

  dispose();
});

test('hydrate() + list(): full round trip — SSR three items, hydrate, click-remove the middle one', () => {
  const items = signal([{ id: 1, label: 'a' }, { id: 2, label: 'b' }, { id: 3, label: 'c' }]);
  function remove(id) {
    items.value = items.value.filter((i) => i.id !== id);
  }
  function List() {
    return html`<ul>${() =>
      list(
        () => items.value,
        (i) => i.id,
        (i) => html`<li>${i.label}<button class="rm" @click=${() => remove(i.id)}>x</button></li>`
      )}</ul>`;
  }
  const serverContainer = document.createElement('div');
  const serverDispose = mount(List, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const adopted = [...clientContainer.querySelectorAll('li')];
  assert.equal(adopted.length, 3);

  const dispose = hydrateComponent(List, clientContainer);

  // The remove button hydration attached a real listener to the SAME
  // server-rendered <li> — clicking it must actually work.
  const middleButton = clientContainer.querySelectorAll('li')[1].querySelector('.rm');
  middleButton.click();

  const lis = [...clientContainer.querySelectorAll('li')];
  assert.equal(lis.length, 2);
  assert.deepEqual(lis.map((li) => li.firstChild.textContent), ['a', 'c']);
  // Items 1 and 3 are still the original server-rendered nodes.
  assert.equal(lis[0], adopted[0]);
  assert.equal(lis[1], adopted[2]);

  dispose();
});

test('hydrate() adopts a nested-template node-part and wires its own event listener', () => {
  const show = signal(true);
  const clicked = signal(0);
  function Toggle() {
    return html`<div>${() =>
      show.value
        ? html`<button id="a" @click=${() => clicked.value++}>A</button>`
        : html`<span id="b">B</span>`}</div>`;
  }
  const serverContainer = document.createElement('div');
  const serverDispose = mount(Toggle, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const buttonBefore = clientContainer.querySelector('#a');
  assert.ok(buttonBefore);

  const dispose = hydrateComponent(Toggle, clientContainer);
  const buttonAfter = clientContainer.querySelector('#a');
  assert.equal(buttonAfter, buttonBefore);
  buttonAfter.click();
  assert.equal(clicked.value, 1);
  dispose();
});

test('hydrate() correctly wires listeners when a reactive binding\'s value is a nested template made of several sibling sub-templates (regression: marker-index collision)', () => {
  // Reproduces a real bug: an outer template with ONE reactive node-part
  // (e.g. `${() => outlet(router)}`, a common app-shell shape) whose current
  // value is itself a template built from several sibling sub-component
  // calls — each contributing ITS OWN node-part markers, independently
  // numbered from 0. Before the fix, hydration matched live marker comments
  // by TEXT ALONE, so the outer binding's own index-0 marker could collide
  // with an inner sibling's unrelated index-0 marker and stop scanning
  // there — truncating the outer binding's content and losing every
  // downstream listener, while the page still LOOKED fully rendered.
  let clicks = 0;
  function Header() {
    // Two of Header's own bindings — indices 0 and 1, same as the outer
    // App's own single binding would be numbered (index 0) if the two
    // templates' marker namespaces were not kept distinct.
    return html`<header><a id="h-link" href="/x" @click=${(e) => { e.preventDefault(); clicks++; }}>Home</a><span>${() => 'ok'}</span></header>`;
  }
  function Main() {
    return html`<main id="main-el">content</main>`;
  }
  function Footer() {
    return html`<footer id="footer-el">footer</footer>`;
  }
  function Page() {
    return html`${Header()}${Main()}${Footer()}`;
  }
  function App() {
    const show = signal(true);
    return html`<div class="app-root">${() => (show.value ? Page() : null)}</div>`;
  }

  const serverContainer = document.createElement('div');
  const serverDispose = mount(App, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const linkBefore = clientContainer.querySelector('#h-link');
  const mainBefore = clientContainer.querySelector('#main-el');
  const footerBefore = clientContainer.querySelector('#footer-el');
  assert.ok(linkBefore && mainBefore && footerBefore, 'server HTML has all three sub-components present');

  const dispose = hydrateComponent(App, clientContainer);

  // Every sub-component's real DOM node must have been adopted (not
  // recreated) all the way through the outer reactive binding.
  assert.equal(clientContainer.querySelector('#h-link'), linkBefore);
  assert.equal(clientContainer.querySelector('#main-el'), mainBefore);
  assert.equal(clientContainer.querySelector('#footer-el'), footerBefore);

  // And the listener nested three levels deep (App -> Page -> Header) must
  // actually be attached and fire — this is what silently failed before
  // the templateSalt() fix.
  linkBefore.click();
  assert.equal(clicks, 1, 'the nested Header link\'s @click listener must fire after hydration');

  dispose();
});

test('hydrate() correctly wires a sibling component whose template\'s own leading text node merges with the enclosing template\'s text at parse time (regression: text-merge resync)', () => {
  // Reproduces a real bug found against a real SSG-prerendered page: when a
  // node-part's value is a nested template (a component call, not wrapped
  // in a reactive function) whose OWN first/last child is a plain static
  // text node (e.g. leading whitespace from a multi-line `html` literal),
  // and that text node sits directly against the enclosing template's own
  // adjacent static text with no element/comment between them, the HTML
  // parser coalesces the two into ONE live text node when the server HTML
  // is reparsed. hydrateChildren's outer walk consumes that merged node as
  // its OWN static text before ever reaching the node-part boundary, so the
  // nested recursion is handed one fewer live node than its compiled
  // template expects — desyncing every sibling after the first missing text
  // node and losing the recursion's own bindings/listeners entirely, while
  // the page still rendered correctly (SSR content is unaffected either
  // way).
  let clicksA = 0;
  let clicksB = 0;
  function Item({ label, withHeading }) {
    // Each instance shares the SAME compiled template (same call site) and
    // its own leading/trailing text sits flush against a sibling instance's
    // text in the enclosing template below, so their whitespace merges when
    // the server HTML is reparsed on the client.
    return html`
      <div class="item">
        ${withHeading ? html`<h4>${label}</h4>` : ''}
        <button id=${`btn-${label}`} @click=${() => (label === 'first' ? clicksA++ : clicksB++)}>go</button>
      </div>
    `;
  }
  function List() {
    // The whitespace right before each interpolation (this template's own
    // static text, immediately preceding where that value's content is
    // inserted) is what merges with the nested Item template's own leading
    // text node once the server HTML is reparsed — an inline
    // `${Item(...)}${Item(...)}` with no static text at all in between would
    // not reproduce it.
    return html`<div class="list">
      ${Item({ label: 'first', withHeading: true })}
      ${Item({ label: 'second', withHeading: false })}
    </div>`;
  }

  const serverContainer = document.createElement('div');
  const serverDispose = mount(List, serverContainer);
  const serverHtml = serverContainer.innerHTML;
  serverDispose();

  const clientContainer = document.createElement('div');
  clientContainer.innerHTML = serverHtml;
  const btnABefore = clientContainer.querySelector('#btn-first');
  const btnBBefore = clientContainer.querySelector('#btn-second');
  assert.ok(btnABefore && btnBBefore, 'server HTML has both buttons present');

  const dispose = hydrateComponent(List, clientContainer);

  // Both buttons must have been adopted (not recreated)...
  assert.equal(clientContainer.querySelector('#btn-first'), btnABefore);
  assert.equal(clientContainer.querySelector('#btn-second'), btnBBefore);

  // ...and both listeners must actually be wired, including the second
  // instance's — the one whose leading text has nothing (an empty `''`
  // value, no `<h4>`) to keep it from merging with the first instance's
  // trailing text across the node-part boundary.
  btnABefore.click();
  btnBBefore.click();
  assert.equal(clicksA, 1, 'first item\'s @click listener must fire after hydration');
  assert.equal(clicksB, 1, 'second item\'s @click listener must fire after hydration');

  dispose();
});

test('a case-sensitive property binding (`.innerHTML=`) sets the real property, not a lowercased no-op', () => {
  // HTML attribute names are parse-case-insensitive: `template.innerHTML =
  // htmlString` (used internally by compile() to build the clonable
  // <template>) lowercases every attribute name, including bind-marker
  // attributes like `.innerHTML="aeon:salt:0aeon"`. If the part-descriptor
  // walk ever reads the binding's name back off the parsed attribute
  // instead of the original (pre-parse) template string, `.innerHTML`
  // becomes `.innerhtml` and `el.innerhtml = value` is a silent no-op —
  // the element renders with no children at all instead of the intended
  // markup. This regression shipped on the real docs/landing site: every
  // <code> sample rendered as an empty `<code></code>`.
  function Highlighted({ markup }) {
    return html`<pre><code .innerHTML=${markup}></code></pre>`;
  }

  const container = document.createElement('div');
  const dispose = mount(() => Highlighted({ markup: '<span class="tok-kw">const</span> x' }), container);

  const code = container.querySelector('code');
  assert.ok(code, 'the <code> element must exist');
  assert.equal(code.innerHTML, '<span class="tok-kw">const</span> x');
  assert.equal(code.querySelector('span.tok-kw')?.textContent, 'const');

  dispose();
});
