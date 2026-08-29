import { signal, html, list, mount } from '@aeon/core';

const ADJECTIVES = ['pretty', 'large', 'big', 'small', 'tall', 'short', 'long', 'handsome', 'plain', 'quaint', 'clean', 'elegant', 'easy', 'angry', 'crazy', 'helpful', 'mushy', 'odd', 'unsightly', 'adorable', 'important', 'inexpensive', 'cheap', 'expensive', 'fancy'];
const COLOURS = ['red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'brown', 'white', 'black', 'orange'];
const NOUNS = ['table', 'chair', 'house', 'bbq', 'desk', 'car', 'pony', 'cookie', 'sandwich', 'burger', 'pizza', 'mouse', 'keyboard'];

function buildData(count, startId) {
  const data = [];
  for (let i = 0; i < count; i++) {
    data.push({ id: startId + i, label: `${ADJECTIVES[i % ADJECTIVES.length]} ${COLOURS[(i * 7) % COLOURS.length]} ${NOUNS[(i * 13) % NOUNS.length]}` });
  }
  return data;
}

let nextId = 1;
const rows = signal([]);

function create(n) {
  rows.value = buildData(n, nextId);
  nextId += n;
}
function updateEvery10th() {
  rows.value = rows.value.map((r, i) => (i % 10 === 0 ? { ...r, label: r.label + ' !!!' } : r));
}
function clear() {
  rows.value = [];
}

window.__timings = [];
function timed(op, fn) {
  return () => {
    const t0 = performance.now();
    fn();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.__timings.push({ op, ms: performance.now() - t0 });
      });
    });
  };
}

function App() {
  return html`
    <div>
      <button id="btn-create" @click=${timed('create', () => create(1000))}>Create 1,000 rows</button>
      <button id="btn-update" @click=${timed('update', updateEvery10th)}>Update every 10th row</button>
      <button id="btn-clear" @click=${timed('clear', clear)}>Clear</button>
      <span id="row-count">${() => rows.value.length}</span>
      <table>
        <tbody>
          ${() => list(() => rows.value, (r) => r.id, (r) => html`<tr><td>${r.id}</td><td class="lbl">${r.label}</td></tr>`)}
        </tbody>
      </table>
    </div>
  `;
}

mount(App, document.getElementById('app'));
