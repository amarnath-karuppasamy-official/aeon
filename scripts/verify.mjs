import { chromium } from 'playwright-core';
import { chromiumLaunchOptions } from './lib/launch-browser.mjs';

const browser = await chromium.launch(chromiumLaunchOptions());
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || String(e)));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`REQUEST FAILED: ${r.url()} ${r.failure()?.errorText}`); });
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

await page.goto('http://localhost:8123/index.html');
await page.waitForTimeout(1000);
if (errors.length) {
  console.log('ERRORS BEFORE WAIT:', errors);
}
console.log('BODY HTML:', await page.content());
await page.waitForSelector('h1', { timeout: 5000 });

const results = {};

// 1. Basic render
results.title = await page.textContent('h1');

// 2. Signals: counter reactivity
await page.click('text=+1');
await page.click('text=+1');
await page.click('text=+1');
results.counterAfter3Clicks = await page.textContent('main p');

// 3. DI
await page.click('text=Say hello');
results.greeting = await page.locator('section', { hasText: 'DI, no decorators' }).locator('p').textContent();

// 4. Router navigation
await page.click('nav >> text=Users');
await page.waitForSelector('ul.users');
results.usersListText = (await page.textContent('ul.users')).replace(/\s+/g, ' ').trim();
results.hashAfterNav = await page.evaluate(() => location.hash);

// 5. Keyed list: shuffle then check row count stable and links still work
const beforeCount = await page.locator('ul.users li').count();
await page.click('text=Shuffle');
const afterCount = await page.locator('ul.users li').count();
results.userRowCountStableAfterShuffle = beforeCount === afterCount;

// 6. Navigate to detail via dynamic route param
await page.click('ul.users li >> nth=0 >> a');
await page.waitForTimeout(50);
results.detailHash = await page.evaluate(() => location.hash);
results.detailHeading = await page.textContent('main h2');

// 7. Forms: validation + submission
await page.click('nav >> text=Contact');
await page.waitForSelector('form');
await page.click('button[type=submit]');
results.errorsShownOnEmptySubmit = await page.locator('.error').count();
await page.fill('input[type=text]', 'Ada Lovelace');
await page.fill('input[type=email]', 'ada@example.com');
await page.fill('textarea', 'This is a sufficiently long message.');
await page.click('button[type=submit]');
await page.waitForTimeout(50);
console.log('MAIN AFTER SUBMIT:', await page.locator('main').innerHTML());
results.formSubmittedText = await page.locator('main p', { hasText: 'Thanks' }).textContent();

// 8. Bundle size sanity (already known from build log) + no console errors
results.consoleErrors = errors;

console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
