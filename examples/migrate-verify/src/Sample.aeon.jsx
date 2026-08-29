import { signal, html } from '@aeon-framework/core';

import { useState, useEffect } from 'react';

export default function Counter() {
  const count = signal(0);
  const name = signal('world');

  const increment = () => {
  count.value = count.value + 1;
};

  return html`<div class="counter">
      <p>Hello, ${() => (name.value)}!</p>
      <p>Count: ${() => (count.value)}</p>
      <button @click=${increment}>+1</button>
      <button @click=${() => count.value = 0}>reset</button>
      ${() => (count.value > 5 ? html`<p>That's a lot!</p>` : html`<p>Keep going.</p>`)}
      ${() => (count.value === 0 && html`<p>Starting from zero.</p>`)}
    </div>`;
}

// AEON-MIGRATE: skipped "Clock" — reads props — not supported in this version
export function Clock({ label }) {
  const [time, setTime] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTime(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <p>{label}: {time}</p>;
}
