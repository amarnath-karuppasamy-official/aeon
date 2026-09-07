// Verifies BOTH Svelte interop directions in a real headless Chromium:
//   forward: aeonMount (a Svelte action) + aeonSignalStore, exercised via
//     examples/interop-svelte/index.html
//   reverse: hostSvelte, exercised via examples/interop-svelte/reverse.html,
//     proving a real Aeon-signal-driven prop reaches a real Svelte component
//     without remounting it.
import { chromium } from 'playwright-core';
import { chromiumLaunchOptions } from './lib/launch-browser.mjs';

const browser = await chromium.launch(chromiumLaunchOptions());
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// --- forward direction ---
await page.goto('http://localhost:8430/index.html');
await page.waitForSelector('#aeon-out');

const results = {};
results.initial = {
  svelte: await page.textContent('#svelte-out'),
  aeon: await page.textContent('#aeon-out'),
  svelteReadsAeon: await page.textContent('#svelte-reads-aeon'),
};

await page.click('#svelte-btn');
await page.click('#svelte-btn');
results.afterSvelteClicks = {
  svelte: await page.textContent('#svelte-out'),
  aeon: await page.textContent('#aeon-out'),
};

await page.click('#aeon-btn');
await page.click('#aeon-btn');
await page.click('#aeon-btn');
await page.waitForTimeout(50);
results.afterAeonClicks = {
  aeon: await page.textContent('#aeon-out'),
  svelteReadsAeon: await page.textContent('#svelte-reads-aeon'),
};

// --- reverse direction ---
await page.goto('http://localhost:8430/reverse.html');
await page.waitForSelector('#svelte-badge');

results.reverseInitial = {
  aeon: await page.textContent('#aeon-out'),
  svelteBadge: await page.textContent('#svelte-badge'),
};
await page.click('#aeon-btn');
await page.click('#aeon-btn');
await page.click('#aeon-btn');
await page.waitForTimeout(50);
results.reverseAfterClicks = {
  aeon: await page.textContent('#aeon-out'),
  svelteBadge: await page.textContent('#svelte-badge'),
};

console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();

const ok =
  errors.length === 0 &&
  results.initial.svelteReadsAeon === "Svelte sees Aeon's count as: 0" &&
  results.afterAeonClicks.svelteReadsAeon === "Svelte sees Aeon's count as: 3" &&
  results.afterSvelteClicks.aeon === 'Aeon-rendered count: 0' &&
  results.reverseInitial.svelteBadge === 'seen by Svelte: 0' &&
  results.reverseAfterClicks.svelteBadge === 'seen by Svelte: 3';
process.exit(ok ? 0 : 1);
