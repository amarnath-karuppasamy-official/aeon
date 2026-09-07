// Shared headless-Chromium launch options for every verify-*.mjs /
// run-benchmark.mjs script in this repo.
//
// This sandbox's cloud environment ships a pre-installed Chromium at a fixed
// path (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers) so these scripts don't
// need to download a browser to run locally here. CI (and any other
// machine) won't have that exact path — there, `npx playwright install
// chromium` (see .github/workflows/ci.yml) installs into playwright-core's
// own default cache, and passing no `executablePath` lets it resolve that
// automatically. So: use the sandbox's fixed path only when it actually
// exists; otherwise fall back to playwright-core's normal resolution.
import { existsSync } from 'node:fs';

const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';

export function chromiumLaunchOptions() {
  const opts = {
    headless: true,
    args: ['--headless=new', '--no-sandbox'],
  };
  if (existsSync(SANDBOX_CHROMIUM)) {
    opts.executablePath = SANDBOX_CHROMIUM;
  }
  return opts;
}
