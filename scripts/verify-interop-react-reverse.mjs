// Verifies the reverse direction: hostReact() mounting a real React
// component as a leaf inside an Aeon `html` template, with a prop that
// changes over time via an Aeon signal — proving real reactive prop
// forwarding, not just a one-shot mount.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--headless=new', '--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:8410/reverse.html');
await page.waitForSelector('#react-badge');

const results = {};
results.initial = {
  aeon: await page.textContent('#aeon-out'),
  reactBadge: await page.textContent('#react-badge'),
};

await page.click('#aeon-btn');
await page.click('#aeon-btn');
await page.click('#aeon-btn');
await page.waitForTimeout(50);
results.afterClicks = {
  aeon: await page.textContent('#aeon-out'),
  reactBadge: await page.textContent('#react-badge'),
};

console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();
const ok =
  errors.length === 0 &&
  results.initial.reactBadge === 'seen by React: 0' &&
  results.afterClicks.reactBadge === 'seen by React: 3';
process.exit(ok ? 0 : 1);
