import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';

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
window.__timings = [];
function timed(op, fn) {
  const t0 = performance.now();
  fn();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__timings.push({ op, ms: performance.now() - t0 });
    });
  });
}

function App() {
  const [rows, setRows] = useState([]);

  const create = () => timed('create', () => { const d = buildData(1000, nextId); nextId += 1000; setRows(d); });
  const update = () => timed('update', () => setRows((rs) => rs.map((r, i) => (i % 10 === 0 ? { ...r, label: r.label + ' !!!' } : r))));
  const clear = () => timed('clear', () => setRows([]));

  return createElement(
    'div',
    null,
    createElement('button', { id: 'btn-create', onClick: create }, 'Create 1,000 rows'),
    createElement('button', { id: 'btn-update', onClick: update }, 'Update every 10th row'),
    createElement('button', { id: 'btn-clear', onClick: clear }, 'Clear'),
    createElement('span', { id: 'row-count' }, rows.length),
    createElement(
      'table',
      null,
      createElement(
        'tbody',
        null,
        rows.map((r) => createElement('tr', { key: r.id }, createElement('td', null, r.id), createElement('td', { className: 'lbl' }, r.label)))
      )
    )
  );
}

createRoot(document.getElementById('app')).render(createElement(App));
