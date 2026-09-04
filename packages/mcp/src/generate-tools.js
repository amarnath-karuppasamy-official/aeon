// generate_component / generate_service / generate_route — thin fs-writing
// wrappers around @aeon-framework/cli's real, pure generator functions
// (packages/cli/src/generate.mjs). This module deliberately duplicates
// nothing about *what* gets scaffolded — it imports the exact same
// `generators` map `aeon generate <kind> <Name>` uses on the command line —
// and only adds the fs.writeFileSync side effect, mirroring
// packages/cli/bin/aeon.mjs's own `generate()` function (refuse to
// overwrite, mkdir -p the destination directory, write, return the path).
import fs from 'node:fs';
import path from 'node:path';
import { generators } from '@aeon-framework/cli/src/generate.mjs';

/**
 * Scaffold a real file on disk for `kind` ('component' | 'service' | 'route').
 * @param {'component'|'service'|'route'} kind
 * @param {string} name
 * @param {string} targetDir - project root to write into (same meaning as
 *   `aeon generate <kind> <Name>`'s cwd).
 * @param {{ overwrite?: boolean }} [opts]
 * @returns {{ path: string, relativePath: string, content: string, name: string }}
 */
export function writeGenerated(kind, name, targetDir, opts = {}) {
  const generator = generators[kind];
  if (!generator) {
    throw new Error(`Unknown generator kind "${kind}" — expected one of: ${Object.keys(generators).join(', ')}`);
  }
  if (!targetDir || typeof targetDir !== 'string') {
    throw new Error('targetDir is required (the project root to write into).');
  }
  const root = path.resolve(targetDir);
  const { relativePath, content, name: generatedName } = generator(name);
  const dest = path.join(root, relativePath);
  if (fs.existsSync(dest) && !opts.overwrite) {
    throw new Error(`${dest} already exists. Pass overwrite: true to replace it.`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  return { path: dest, relativePath, content, name: generatedName };
}

export function generateComponentTool({ name, targetDir, overwrite }) {
  const result = writeGenerated('component', name, targetDir, { overwrite });
  return result;
}

export function generateServiceTool({ name, targetDir, overwrite }) {
  const result = writeGenerated('service', name, targetDir, { overwrite });
  return result;
}

export function generateRouteTool({ name, targetDir, overwrite }) {
  const result = writeGenerated('route', name, targetDir, { overwrite });
  return result;
}
