import { html, signal, computed } from '@aeon/core';
import { inject } from '@aeon/di';
import { GreetingService } from '../services/greeting.js';

export default function Home() {
  const count = signal(0);
  const doubled = computed(() => count.value * 2);
  const greeting = inject(GreetingService);
  const message = signal('');

  return html`
    <section>
      <h2>Signals, live</h2>
      <p>Count: <strong>${() => count.value}</strong> — doubled: <strong>${() => doubled.value}</strong></p>
      <button @click=${() => count.value++}>+1</button>
      <button @click=${() => (count.value = 0)}>reset</button>
    </section>
    <section>
      <h2>DI, no decorators</h2>
      <button @click=${() => (message.value = greeting.greet('Amarnath'))}>Say hello</button>
      <p>${() => message.value}</p>
    </section>
  `;
}
