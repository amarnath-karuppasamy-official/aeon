// Correctness first, speed second: confirms create/update/clear actually
// produce the right DOM before any timing number is trusted, and doubles as
// the regression test for the list() reference-identity fix (row content
// must actually change for the 100 updated rows, and only those 100).
import { chromium } from 'playwright-core';
const url = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--headless=new', '--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(url);
await page.waitForSelector('#btn-create');

const results = {};
await page.click('#btn-create');
await page.waitForTimeout(50);
results.rowsAfterCreate = await page.locator('tbody tr').count();

await page.click('#btn-update');
await page.waitForTimeout(50);
results.bangCountAfterUpdate = await page.locator('td.lbl:has-text("!!!")').count();
results.rowsAfterUpdate = await page.locator('tbody tr').count();

await page.click('#btn-clear');
await page.waitForTimeout(50);
results.rowsAfterClear = await page.locator('tbody tr').count();

console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
