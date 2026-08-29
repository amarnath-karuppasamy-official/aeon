import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, MARKER } from '../src/index.js';

test('no marker comment -> no-op', () => {
  const result = migrate('function Foo() { return <div/>; }');
  assert.equal(result.marker, false);
  assert.equal(result.output, null);
});

test('converts a simple useState counter', () => {
  const src = `// ${MARKER}
export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
`;
  const result = migrate(src);
  assert.equal(result.marker, true);
  assert.equal(result.components.length, 1);
  assert.equal(result.components[0].status, 'converted');
  assert.match(result.output, /signal\(0\)/);
  assert.match(result.output, /@click=\$\{/);
  assert.match(result.output, /count\.value/);
});

test('functional setState updater rewires the parameter to .value', () => {
  const src = `// ${MARKER}
export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
`;
  const result = migrate(src);
  assert.match(result.output, /count\.value = count\.value \+ 1/);
});

test('a component using useEffect is left untouched and flagged', () => {
  const src = `// ${MARKER}
export default function Clock() {
  const [t, setT] = useState(0);
  useEffect(() => {}, []);
  return <p>{t}</p>;
}
`;
  const result = migrate(src);
  assert.equal(result.components[0].status, 'unsupported');
  assert.match(result.components[0].reason, /useEffect/);
  // No convertible component -> no output file at all.
  assert.equal(result.output, null);
});

test('a component reading props is flagged, a sibling that does not is still converted', () => {
  const src = `// ${MARKER}
function WithProps({ label }) {
  return <p>{label}</p>;
}
function Plain() {
  const [n, setN] = useState(1);
  return <p>{n}</p>;
}
`;
  const result = migrate(src);
  const byName = Object.fromEntries(result.components.map((c) => [c.name, c]));
  assert.equal(byName.WithProps.status, 'unsupported');
  assert.equal(byName.Plain.status, 'converted');
  // The untouched component's original JSX survives byte-for-byte.
  assert.match(result.output, /function WithProps\(\{ label \}\) \{\n {2}return <p>\{label\}<\/p>;\n\}/);
});

test('ternary and && conditional JSX children convert to reactive branches', () => {
  const src = `// ${MARKER}
export default function Status() {
  const [ok, setOk] = useState(true);
  return <div>{ok ? <p>yes</p> : <p>no</p>}{ok && <span>!</span>}</div>;
}
`;
  const result = migrate(src);
  assert.equal(result.components[0].status, 'converted');
  assert.match(result.output, /ok\.value \? html`<p>yes<\/p>` : html`<p>no<\/p>`/);
  assert.match(result.output, /ok\.value && html`<span>!<\/span>`/);
});

test('.map() list rendering is flagged, not silently mistranslated', () => {
  const src = `// ${MARKER}
export default function List() {
  const [items, setItems] = useState([1, 2, 3]);
  return <ul>{items.map(i => <li key={i}>{i}</li>)}</ul>;
}
`;
  const result = migrate(src);
  assert.equal(result.components[0].status, 'unsupported');
  assert.match(result.components[0].reason, /\.map\(\)/);
});

test('a custom component reference in JSX is flagged, not inlined or guessed', () => {
  const src = `// ${MARKER}
export default function Wrapper() {
  const [n, setN] = useState(0);
  return <Card>{n}</Card>;
}
`;
  const result = migrate(src);
  assert.equal(result.components[0].status, 'unsupported');
  assert.match(result.components[0].reason, /Card/);
});
