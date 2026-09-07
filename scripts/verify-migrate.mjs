import { chromium } from 'playwright-core';
import { chromiumLaunchOptions } from './lib/launch-browser.mjs';
const browser = await chromium.launch(chromiumLaunchOptions());
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:8430/index.html');
await page.waitForSelector('.counter');

const results = {};
results.initial = await page.locator('.counter').innerText();

const buttons = page.locator('.counter button');
await buttons.nth(0).click(); // +1
await buttons.nth(0).click();
await buttons.nth(0).click();
results.afterThreeIncrements = await page.locator('.counter').innerText();

for (let i = 0; i < 4; i++) await buttons.nth(0).click(); // push count to 7, past the >5 branch
results.afterSevenTotal = await page.locator('.counter').innerText();

await buttons.nth(1).click(); // reset
results.afterReset = await page.locator('.counter').innerText();

console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
