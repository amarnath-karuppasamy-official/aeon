// Check 1: binding-kind validation across a whole project.
//
// Reuses (never re-implements) @aeon-framework/mcp's explainTemplate(),
// which itself deep-imports and calls @aeon-framework/core's REAL compile()
// (packages/core/src/dom.js) — see explain-template.js's top-of-file
// comment. That's what keeps this check honest: it's asking the actual
// compiler what each binding is, not guessing from a second copy of the
// attribute-prefix rules.
import { explainTemplate } from '@aeon-framework/mcp';
import { extractHtmlTemplates } from './scan-templates.js';

/**
 * @param {string} file - path to report findings against
 * @param {string} source - the file's real source text
 * @returns {Promise<Array<{severity: 'error', rule: 'binding-footgun', file: string, line: number, message: string}>>}
 */
export async function checkBindings(file, source) {
  const findings = [];
  const templates = extractHtmlTemplates(source);
  for (const tpl of templates) {
    if (!tpl.body.includes('${')) continue; // no interpolations, nothing to classify
    const { bindings } = await explainTemplate({ template: tpl.body });
    for (const b of bindings) {
      if (!b.warning) continue;
      const line = tpl.slotLines[b.slot] ?? tpl.line;
      findings.push({
        severity: 'error',
        rule: 'binding-footgun',
        file,
        line,
        message: `${b.name ? `\`${b.name}=\`` : 'binding'}: ${b.warning}`,
      });
    }
  }
  return findings;
}
