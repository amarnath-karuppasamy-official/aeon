// @aeon-framework/compiler — the first real milestone toward an Aeon AOT
// compiler: a whole-PROJECT static analysis pass, not runtime binding
// optimization and not whole-program dead-code elimination (see the
// "Static analysis" section of the README for the honest scope line).
//
// analyzeProject() never eval()s/import()s a target project's code — every
// check here is a real static text scan (see check-bindings.js,
// check-imports.js, check-routes.js for how each one earns "real": the
// binding-kind check runs Aeon's actual compiler via
// @aeon-framework/mcp's explainTemplate(), not a lookalike regex).
import fs from 'node:fs';
import path from 'node:path';
import { checkBindings } from './check-bindings.js';
import { checkUnusedImports } from './check-imports.js';
import { checkRoutes } from './check-routes.js';

const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.aeon']);

function listSourceFiles(root) {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(path.join(dir, entry.name));
      }
    }
  }
  walk(root);
  return files.sort();
}

/**
 * Run every static-analysis check against a real project on disk.
 *
 * @param {{ projectDir: string }} args
 * @returns {Promise<{ severity: 'error'|'warning', rule: string, file: string, line: number, message: string }[]>}
 */
export async function analyzeProject({ projectDir }) {
  if (!projectDir || typeof projectDir !== 'string') {
    throw new Error('projectDir is required.');
  }
  const root = path.resolve(projectDir);
  if (!fs.existsSync(root)) {
    throw new Error(`${root} does not exist.`);
  }

  const srcDir = path.join(root, 'src');
  const files = listSourceFiles(srcDir);

  const findings = [];
  for (const absFile of files) {
    const relFile = path.relative(root, absFile);
    const source = fs.readFileSync(absFile, 'utf8');

    findings.push(...(await checkBindings(relFile, source)));
    findings.push(...checkUnusedImports(relFile, source));
    findings.push(...checkRoutes(relFile, source));
  }

  findings.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
  return findings;
}
