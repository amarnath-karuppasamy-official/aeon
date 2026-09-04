// Check 2: unused named imports from @aeon-framework/* packages.
//
// Deliberately simple: a basic identifier-usage text scan, not a real
// type-checker/binding resolver. It finds `import { a, b as c } from
// '@aeon-framework/x'`-shaped statements, then for each locally-bound name
// checks whether that identifier text appears anywhere else in the file. No
// scope analysis — a local variable that happens to shadow the imported
// name would produce a false negative (looks "used" when it isn't really),
// never a false positive, which is the safer direction for a lint-style check.
const IMPORT_RE = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+(['"])(@aeon-framework\/[^'"]+)\2/g;

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) if (source[i] === '\n') line++;
  return line;
}

/**
 * @param {string} file
 * @param {string} source
 * @returns {Array<{severity: 'warning', rule: 'unused-import', file: string, line: number, message: string}>}
 */
export function checkUnusedImports(file, source) {
  const findings = [];
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(source))) {
    const specifiersText = m[1];
    const pkg = m[3];
    const blockStart = m.index + m[0].indexOf(specifiersText);
    const specifiers = specifiersText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const spec of specifiers) {
      const aliasMatch = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(spec);
      const localName = aliasMatch ? aliasMatch[2] : spec;
      if (!/^[A-Za-z_$][\w$]*$/.test(localName)) continue; // skip anything we can't confidently parse

      // Everywhere else in the file, minus this one import statement's own text.
      const withoutThisImport = source.slice(0, m.index) + source.slice(m.index + m[0].length);
      const usageRe = new RegExp(`\\b${localName}\\b`);
      if (usageRe.test(withoutThisImport)) continue;

      const specOffsetInBlock = specifiersText.indexOf(spec);
      const absoluteIndex = blockStart + (specOffsetInBlock >= 0 ? specOffsetInBlock : 0);
      findings.push({
        severity: 'warning',
        rule: 'unused-import',
        file,
        line: lineAt(source, absoluteIndex),
        message: `\`${localName}\` is imported from \`${pkg}\` but never used in this file.`,
      });
    }
  }
  return findings;
}
