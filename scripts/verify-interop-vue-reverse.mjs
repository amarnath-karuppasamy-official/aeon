// Verifies the reverse direction: hostVue() mounting a real Vue component
// as a leaf inside an Aeon `html` template, with a prop that changes over
// time via an Aeon signal.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--headless=new', '--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:8420/reverse.html');
await page.waitForSelector('#vue-badge');

const results = {};
results.initial = {
  aeon: await page.textContent('#aeon-out'),
  vueBadge: await page.textContent('#vue-badge'),
};

await page.click('#aeon-btn');
await page.click('#aeon-btn');
await page.click('#aeon-btn');
await page.waitForTimeout(50);
results.afterClicks = {
  aeon: await page.textContent('#aeon-out'),
  vueBadge: await page.textContent('#vue-badge'),
};

console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();
const ok =
  errors.length === 0 &&
  results.initial.vueBadge === 'seen by Vue: 0' &&
  results.afterClicks.vueBadge === 'seen by Vue: 3';
process.exit(ok ? 0 : 1);
