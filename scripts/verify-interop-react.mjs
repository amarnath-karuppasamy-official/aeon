import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--headless=new', '--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:8410/index.html');
await page.waitForSelector('#aeon-out');

const results = {};
results.initial = {
  react: await page.textContent('#react-out'),
  aeon: await page.textContent('#aeon-out'),
  reactReadsAeon: await page.textContent('#react-reads-aeon'),
};

// React's own state should be fully independent of Aeon's.
await page.click('#react-btn');
await page.click('#react-btn');
results.afterReactClicks = {
  react: await page.textContent('#react-out'),
  aeon: await page.textContent('#aeon-out'),
};

// Clicking the Aeon-rendered button should update the signal, and React
// (via useAeonSignal) should pick it up without any Aeon-side knowledge of React.
await page.click('#aeon-btn');
await page.click('#aeon-btn');
await page.click('#aeon-btn');
await page.waitForTimeout(50);
results.afterAeonClicks = {
  aeon: await page.textContent('#aeon-out'),
  reactReadsAeon: await page.textContent('#react-reads-aeon'),
};

console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
