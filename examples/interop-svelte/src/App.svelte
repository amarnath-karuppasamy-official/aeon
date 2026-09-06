<script>
  import { aeonMount, aeonSignalStore } from '@aeon-framework/interop/svelte';
  import { AeonCounter, sharedCount } from '../../shared/aeon-counter.js';

  // A completely ordinary Svelte component — its own state, nothing
  // Aeon-aware except for the two adapters imported above.
  let svelteCount = $state(0);

  // ...reading an Aeon signal into Svelte as a real Svelte store.
  const sharedFromAeon = aeonSignalStore(sharedCount);
</script>

<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 3rem auto;">
  <h1>Svelte app, with an Aeon leaf</h1>
  <section>
    <h2>Native Svelte state</h2>
    <p id="svelte-out">Svelte count: {svelteCount}</p>
    <button id="svelte-btn" onclick={() => svelteCount++}>+1 (from Svelte)</button>
  </section>
  <section>
    <h2>Aeon component, mounted inside Svelte</h2>
    <div use:aeonMount={{ component: AeonCounter }}></div>
  </section>
  <section>
    <h2>Svelte reading the Aeon signal above</h2>
    <p id="svelte-reads-aeon">Svelte sees Aeon's count as: {$sharedFromAeon}</p>
  </section>
</div>
