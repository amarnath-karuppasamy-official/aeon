// inspect_project — reads a REAL project on disk (never evaluates its code)
// and reports which @aeon-framework/* packages it depends on plus a
// best-effort summary of its routes/components/services directories.
import fs from 'node:fs';
import path from 'node:path';

const CODE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

function listCodeFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && CODE_EXTENSIONS.includes(path.extname(e.name)))
    .map((e) => e.name)
    .sort();
}

/**
 * Best-effort static scrape of a route file's `path:` string and its
 * exported `...Route`-shaped object — a plain string search, never
 * require()/import()/eval of the (untrusted) project file.
 */
function scrapeRouteFile(fullPath) {
  const source = fs.readFileSync(fullPath, 'utf8');
  const pathMatch = /path\s*:\s*(['"`])([^'"`]*)\1/.exec(source);
  const exportMatch = /export\s+const\s+([A-Za-z0-9_]+)\s*=/.exec(source);
  return {
    routePath: pathMatch ? pathMatch[2] : null,
    exportName: exportMatch ? exportMatch[1] : null,
  };
}

/**
 * @param {{ projectDir: string }} args
 */
export function inspectProject({ projectDir }) {
  if (!projectDir || typeof projectDir !== 'string') {
    throw new Error('projectDir is required.');
  }
  const root = path.resolve(projectDir);
  if (!fs.existsSync(root)) {
    throw new Error(`${root} does not exist.`);
  }

  const pkgPath = path.join(root, 'package.json');
  let aeonPackages = [];
  let projectName = null;
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    projectName = pkg.name || null;
    const depSections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    const seen = new Map();
    for (const section of depSections) {
      const deps = pkg[section];
      if (!deps) continue;
      for (const [name, version] of Object.entries(deps)) {
        if (name.startsWith('@aeon-framework/') && !seen.has(name)) {
          seen.set(name, { name, version, via: section });
        }
      }
    }
    aeonPackages = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  const routesDir = path.join(root, 'src', 'routes');
  const routes = listCodeFiles(routesDir).map((file) => {
    const scraped = scrapeRouteFile(path.join(routesDir, file));
    return { file, ...scraped };
  });

  const componentsDir = path.join(root, 'src', 'components');
  const components = listCodeFiles(componentsDir);

  const servicesDir = path.join(root, 'src', 'services');
  const services = listCodeFiles(servicesDir);

  return {
    projectDir: root,
    projectName,
    aeonPackages,
    routes,
    components,
    services,
  };
}
