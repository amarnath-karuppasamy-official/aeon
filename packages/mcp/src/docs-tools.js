// search_docs — a lightweight, dependency-free (no embeddings/vector store,
// per the project's "stay lightweight" priority) case-insensitive substring
// search over Aeon's real docs: the repo's README.md plus every package's
// hand-written src/index.d.ts. No index is built ahead of time; it reads
// the real files fresh on every call, so results can never go stale.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Locate the Aeon monorepo's `packages/` directory by walking up from this
 * module's own location looking for `<dir>/core/package.json` — i.e. this
 * only succeeds when @aeon-framework/mcp is running from inside (or as a
 * workspace sibling within) a real Aeon monorepo checkout. That's the
 * expected home for docs/conventions tooling like this. When it can't be
 * found (e.g. installed standalone in an unrelated project with no sibling
 * `packages/core`), search_docs/get_conventions degrade to returning
 * nothing found rather than guessing — see README's MCP section for this
 * documented limitation.
 */
export function findPackagesDir(startDir = __dirname) {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'core', 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

export function findRepoRoot(startDir = __dirname) {
  const packagesDir = findPackagesDir(startDir);
  return packagesDir ? path.dirname(packagesDir) : null;
}

/** Every doc source file this tool searches: README.md + each package's src/index.d.ts. */
export function collectDocSources(startDir = __dirname) {
  const repoRoot = findRepoRoot(startDir);
  if (!repoRoot) return [];
  const sources = [];
  const readmePath = path.join(repoRoot, 'README.md');
  if (fs.existsSync(readmePath)) {
    sources.push({ file: 'README.md', content: fs.readFileSync(readmePath, 'utf8') });
  }
  const packagesDir = path.join(repoRoot, 'packages');
  for (const pkg of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const dtsPath = path.join(packagesDir, pkg.name, 'src', 'index.d.ts');
    if (fs.existsSync(dtsPath)) {
      sources.push({
        file: `packages/${pkg.name}/src/index.d.ts`,
        content: fs.readFileSync(dtsPath, 'utf8'),
      });
    }
  }
  return sources;
}

/**
 * Case-insensitive substring search with a few lines of context per match,
 * ranked by number of matches in the file (most relevant file first).
 */
export function searchDocs({ query }, opts = {}) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('query is required.');
  }
  const sources = opts.sources || collectDocSources(opts.startDir);
  const needle = query.trim().toLowerCase();
  const results = [];

  for (const { file, content } of sources) {
    const lines = content.split('\n');
    const matches = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(needle)) {
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        matches.push({
          line: i + 1,
          excerpt: lines.slice(start, end).join('\n'),
        });
      }
    }
    if (matches.length) results.push({ file, matchCount: matches.length, matches });
  }

  results.sort((a, b) => b.matchCount - a.matchCount);
  return { query, results };
}
