import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--headless=new', '--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:8420/index.html');
await page.waitForSelector('#aeon-out');

const results = {};
results.initial = {
  vue: await page.textContent('#vue-out'),
  aeon: await page.textContent('#aeon-out'),
  vueReadsAeon: await page.textContent('#vue-reads-aeon'),
};

await page.click('#vue-btn');
await page.click('#vue-btn');
results.afterVueClicks = {
  vue: await page.textContent('#vue-out'),
  aeon: await page.textContent('#aeon-out'),
};

await page.click('#aeon-btn');
await page.click('#aeon-btn');
await page.click('#aeon-btn');
await page.waitForTimeout(50);
results.afterAeonClicks = {
  aeon: await page.textContent('#aeon-out'),
  vueReadsAeon: await page.textContent('#vue-reads-aeon'),
};

console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
