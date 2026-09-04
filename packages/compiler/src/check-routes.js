// Check 3: unreachable routes, from a project's real `createRouter([...])`
// call.
//
// Same safety discipline as @aeon-framework/mcp's inspect_project
// (packages/mcp/src/inspect-project.js's scrapeRouteFile): a best-effort
// static text scan of the route table, never eval()/import() of the
// (untrusted) project file. Two real problems this can actually prove from
// @aeon-framework/router's own matchRoute() (packages/router/src/index.js):
// it iterates the route table in order and returns the FIRST match, so —
//   (a) a `path: '*'` catch-all NOT last in the table makes every route
//       after it unreachable (the catch-all's `(.*)` pattern matches
//       everything, so it wins first), and
//   (b) two routes with the literal same `path` string — the second can
//       never be reached, first match wins.
function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) if (source[i] === '\n') line++;
  return line;
}

/** Extract the top-level `{...}` route-object entries of a `createRouter([...])` array. */
function extractRouteEntries(source) {
  const callIdx = source.search(/createRouter\s*\(/);
  if (callIdx === -1) return null;
  const arrayOpen = source.indexOf('[', callIdx);
  if (arrayOpen === -1) return null;

  const entries = [];
  let i = arrayOpen + 1;
  let sqDepth = 1;
  let braceDepth = 0;
  let entryStart = -1;
  const n = source.length;

  while (i < n && sqDepth > 0) {
    const ch = source[i];
    if (ch === '[') sqDepth++;
    else if (ch === ']') {
      sqDepth--;
      if (sqDepth === 0) break;
    } else if (ch === '{') {
      if (braceDepth === 0) entryStart = i;
      braceDepth++;
    } else if (ch === '}') {
      braceDepth--;
      if (braceDepth === 0 && entryStart !== -1) {
        entries.push({ start: entryStart, end: i + 1, text: source.slice(entryStart, i + 1) });
        entryStart = -1;
      }
    }
    i++;
  }
  return entries;
}

/**
 * @param {string} file
 * @param {string} source
 * @returns {Array<{severity: 'error'|'warning', rule: string, file: string, line: number, message: string}>}
 */
export function checkRoutes(file, source) {
  const entries = extractRouteEntries(source);
  if (!entries || entries.length === 0) return [];

  const findings = [];
  const routes = entries.map((entry) => {
    const pathMatch = /path\s*:\s*(['"`])([^'"`]*)\1/.exec(entry.text);
    if (!pathMatch) return null;
    const absoluteIndex = entry.start + pathMatch.index;
    return { path: pathMatch[2], line: lineAt(source, absoluteIndex) };
  });

  // (a) catch-all not last.
  const catchAllIndex = routes.findIndex((r) => r && r.path === '*');
  if (catchAllIndex !== -1 && catchAllIndex !== routes.length - 1) {
    const catchAllLine = routes[catchAllIndex].line;
    for (let idx = catchAllIndex + 1; idx < routes.length; idx++) {
      const r = routes[idx];
      if (!r) continue;
      findings.push({
        severity: 'warning',
        rule: 'unreachable-route',
        file,
        line: r.line,
        message: `Route \`${r.path}\` is unreachable — the catch-all route \`path: '*'\` on line ${catchAllLine} comes before it and matches every path first (@aeon-framework/router's matchRoute() returns the first match).`,
      });
    }
  }

  // (b) duplicate literal paths — first occurrence is reachable, every later one isn't.
  const seenAt = new Map();
  for (const r of routes) {
    if (!r) continue;
    if (seenAt.has(r.path)) {
      const firstLine = seenAt.get(r.path);
      findings.push({
        severity: 'error',
        rule: 'route-collision',
        file,
        line: r.line,
        message: `Route \`${r.path}\` is already defined on line ${firstLine} — this entry can never be reached (matchRoute() returns the first match).`,
      });
    } else {
      seenAt.set(r.path, r.line);
    }
  }

  return findings;
}
