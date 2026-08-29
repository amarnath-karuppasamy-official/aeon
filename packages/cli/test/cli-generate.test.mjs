import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliBin = path.join(__dirname, '..', 'bin', 'aeon.mjs');

function runCli(args, cwd) {
  return execFileSync(process.execPath, [cliBin, ...args], { cwd, encoding: 'utf8' });
}

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aeon-cli-generate-'));
}

test('aeon generate component <Name> writes a real file to src/components/', () => {
  const dir = mktemp();
  try {
    const out = runCli(['generate', 'component', 'UserCard'], dir);
    const file = path.join(dir, 'src', 'components', 'UserCard.js');
    assert.ok(fs.existsSync(file), 'generated file exists');
    assert.match(out, /generated component UserCard/);
    const content = fs.readFileSync(file, 'utf8');
    assert.match(content, /export default defineComponent\(function UserCard\(\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('aeon g service <Name> (alias) writes a real file to src/services/', () => {
  const dir = mktemp();
  try {
    runCli(['g', 'service', 'Billing'], dir);
    const file = path.join(dir, 'src', 'services', 'billing.js');
    assert.ok(fs.existsSync(file));
    const content = fs.readFileSync(file, 'utf8');
    assert.match(content, /export const BillingService = createToken\('BillingService'\);/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('aeon generate route <Name> writes a real file to src/routes/', () => {
  const dir = mktemp();
  try {
    runCli(['generate', 'route', 'Settings'], dir);
    const file = path.join(dir, 'src', 'routes', 'Settings.js');
    assert.ok(fs.existsSync(file));
    const content = fs.readFileSync(file, 'utf8');
    assert.match(content, /export const SettingsRoute = \{ path: '\/settings', component: Settings \};/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('generate refuses to overwrite an existing file', () => {
  const dir = mktemp();
  try {
    runCli(['generate', 'component', 'Dup'], dir);
    assert.throws(() => runCli(['generate', 'component', 'Dup'], dir));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
