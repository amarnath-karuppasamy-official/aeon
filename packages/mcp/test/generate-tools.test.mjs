import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateComponentTool, generateServiceTool, generateRouteTool } from '../src/generate-tools.js';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aeon-mcp-generate-'));
}

test('generate_component actually writes a real file to disk', () => {
  const dir = tmpDir();
  const result = generateComponentTool({ name: 'UserProfile', targetDir: dir });

  const expectedPath = path.join(dir, 'src', 'components', 'UserProfile.js');
  assert.equal(result.path, expectedPath);
  assert.ok(fs.existsSync(expectedPath), 'component file should exist on disk');

  const onDisk = fs.readFileSync(expectedPath, 'utf8');
  assert.equal(onDisk, result.content);
  assert.match(onDisk, /export default defineComponent\(function UserProfile\(\)/);
  assert.match(onDisk, /@aeon-framework\/core/);
});

test('generate_service actually writes a real file to disk', () => {
  const dir = tmpDir();
  const result = generateServiceTool({ name: 'greeting', targetDir: dir });

  const expectedPath = path.join(dir, 'src', 'services', 'greeting.js');
  assert.ok(fs.existsSync(expectedPath));
  const onDisk = fs.readFileSync(expectedPath, 'utf8');
  assert.equal(onDisk, result.content);
  assert.match(onDisk, /createToken\('GreetingService'\)/);
  assert.match(onDisk, /createGreetingService/);
});

test('generate_route actually writes a real file to disk', () => {
  const dir = tmpDir();
  const result = generateRouteTool({ name: 'AboutPage', targetDir: dir });

  const expectedPath = path.join(dir, 'src', 'routes', 'AboutPage.js');
  assert.ok(fs.existsSync(expectedPath));
  const onDisk = fs.readFileSync(expectedPath, 'utf8');
  assert.equal(onDisk, result.content);
  assert.match(onDisk, /export const AboutPageRoute = \{ path: '\/about-page', component: AboutPage \}/);
});

test('generate_* refuses to overwrite an existing file by default', () => {
  const dir = tmpDir();
  generateComponentTool({ name: 'Dup', targetDir: dir });
  assert.throws(() => generateComponentTool({ name: 'Dup', targetDir: dir }), /already exists/);
});

test('generate_* overwrites when overwrite: true is passed', () => {
  const dir = tmpDir();
  generateComponentTool({ name: 'Dup2', targetDir: dir });
  const result = generateComponentTool({ name: 'Dup2', targetDir: dir, overwrite: true });
  assert.ok(fs.existsSync(result.path));
});

test('generate_* rejects an invalid name before touching the filesystem', () => {
  const dir = tmpDir();
  assert.throws(() => generateComponentTool({ name: '???', targetDir: dir }), /Invalid generator name/);
  assert.deepEqual(fs.readdirSync(dir), []);
});
