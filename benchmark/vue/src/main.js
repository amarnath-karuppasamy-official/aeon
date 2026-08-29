import { createApp, h, ref, defineComponent } from 'vue';

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

const App = defineComponent({
  setup() {
    const rows = ref([]);
    const create = () => timed('create', () => { const d = buildData(1000, nextId); nextId += 1000; rows.value = d; });
    const update = () => timed('update', () => { rows.value = rows.value.map((r, i) => (i % 10 === 0 ? { ...r, label: r.label + ' !!!' } : r)); });
    const clear = () => timed('clear', () => { rows.value = []; });

    return () =>
      h('div', null, [
        h('button', { id: 'btn-create', onClick: create }, 'Create 1,000 rows'),
        h('button', { id: 'btn-update', onClick: update }, 'Update every 10th row'),
        h('button', { id: 'btn-clear', onClick: clear }, 'Clear'),
        h('span', { id: 'row-count' }, rows.value.length),
        h('table', null, h('tbody', null, rows.value.map((r) => h('tr', { key: r.id }, [h('td', null, r.id), h('td', { class: 'lbl' }, r.label)])))),
      ]);
  },
});

createApp(App).mount('#app');
