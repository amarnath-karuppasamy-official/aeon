// Runs create -> update -> clear several times per framework in the same
// headless Chromium, same machine, back to back, and reports median ms per
// operation. Correctness is checked separately in
// verify-benchmark-correctness.mjs — trust these numbers only alongside that.
import { chromium } from 'playwright-core';

const targets = [
  { name: 'Aeon', url: 'http://localhost:8500/index.html' },
  { name: 'Solid', url: 'http://localhost:8503/index.html' },
  { name: 'Preact', url: 'http://localhost:8502/index.html' },
  { name: 'Vue', url: 'http://localhost:8504/index.html' },
  { name: 'React', url: 'http://localhost:8501/index.html' },
];

const ROUNDS = 7; // discard nothing, report median — robust to one-off GC/scheduler noise

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  headless: true,
  args: ['--headless=new', '--no-sandbox'],
});

const results = {};

for (const { name, url } of targets) {
  const page = await browser.newPage();
  const timings = { create: [], update: [], clear: [] };

  for (let round = 0; round < ROUNDS; round++) {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('#btn-create');
    await page.click('#btn-create');
    await page.waitForFunction(() => window.__timings.length >= 1);
    await page.click('#btn-update');
    await page.waitForFunction(() => window.__timings.length >= 2);
    await page.click('#btn-clear');
    await page.waitForFunction(() => window.__timings.length >= 3);
    const t = await page.evaluate(() => window.__timings);
    for (const { op, ms } of t) timings[op].push(ms);
  }

  await page.close();
  results[name] = {
    create: Number(median(timings.create).toFixed(2)),
    update: Number(median(timings.update).toFixed(2)),
    clear: Number(median(timings.clear).toFixed(2)),
    rounds: ROUNDS,
  };
  console.log(`${name}: create=${results[name].create}ms update=${results[name].update}ms clear=${results[name].clear}ms`);
}

await browser.close();

const fs = await import('node:fs');
fs.writeFileSync('/home/claude/aeon/benchmark/results.json', JSON.stringify(results, null, 2));
console.log('\nWrote benchmark/results.json');
