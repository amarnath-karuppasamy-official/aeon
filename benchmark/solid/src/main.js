// No JSX/compiler — uses Solid's own low-level keyed-list primitive
// (mapArray) directly, the same engine <For> compiles down to.
import { createSignal, mapArray, createEffect } from 'solid-js';
import { render } from 'solid-js/web';

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

render(() => {
  const [rows, setRows] = createSignal([]);

  const createBtn = document.createElement('button');
  createBtn.id = 'btn-create';
  createBtn.textContent = 'Create 1,000 rows';
  createBtn.onclick = () => timed('create', () => { const d = buildData(1000, nextId); nextId += 1000; setRows(d); });

  const updateBtn = document.createElement('button');
  updateBtn.id = 'btn-update';
  updateBtn.textContent = 'Update every 10th row';
  updateBtn.onclick = () => timed('update', () => setRows(rows().map((r, i) => (i % 10 === 0 ? { ...r, label: r.label + ' !!!' } : r))));

  const clearBtn = document.createElement('button');
  clearBtn.id = 'btn-clear';
  clearBtn.textContent = 'Clear';
  clearBtn.onclick = () => timed('clear', () => setRows([]));

  const rowCount = document.createElement('span');
  rowCount.id = 'row-count';

  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  const mappedNodes = mapArray(rows, (row) => {
    const tr = document.createElement('tr');
    const tdId = document.createElement('td');
    tdId.textContent = row.id;
    const tdLabel = document.createElement('td');
    tdLabel.className = 'lbl';
    tdLabel.textContent = row.label;
    tr.append(tdId, tdLabel);
    return tr;
  });

  createEffect(() => {
    tbody.replaceChildren(...mappedNodes());
    rowCount.textContent = String(rows().length);
  });

  const container = document.createElement('div');
  container.append(createBtn, updateBtn, clearBtn, rowCount, table);
  return container;
}, document.getElementById('app'));
