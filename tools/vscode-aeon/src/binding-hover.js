// Pure, vscode-API-free logic backing the hover provider in extension.js.
// Split out on purpose so it can be unit-tested with plain `node` (no
// Extension Development Host, no `vscode` module) — see ../test/hover.test.js.
//
// This does NOT reimplement Aeon's attribute-prefix -> binding-kind rules.
// It only (a) figures out, from plain text, whether an offset sits inside an
// `html`...`` ` template body (not inside a nested `${...}` interpolation),
// and (b) finds the attribute token touching that offset. The actual
// classification is delegated to explainTemplate(), which runs Aeon's real
// compiler (packages/core/src/dom.js's compile()) — see explainBindingAt()
// below and packages/mcp/src/explain-template.js.

/**
 * Walks `text` from the start, tracking template-literal / interpolation
 * nesting, and reports whether `offset` lands inside the *markup* body of an
 * `html`...`` `` tagged template (as opposed to: plain code, a non-`html`
 * tagged/untagged template literal, or inside a `${...}` interpolation
 * nested within one). This mirrors the same begin/end + nested-interpolation
 * shape the TextMate grammar (aeon-html.tmLanguage.json) uses, just written
 * as a scanner instead of a declarative grammar, because a hover provider
 * gets plain document text/offsets, not TextMate scopes.
 */
function isInsideAeonHtmlMarkup(text, offset) {
  // A stack of frames, innermost last. Two kinds:
  //  - { kind: 'template', tagged }   — inside a template literal's markup
  //    body (between its opening backtick, or the end of its last `}`, and
  //    its next `${`/closing backtick).
  //  - { kind: 'interp', braceDepth } — inside a `${...}` interpolation's
  //    JS expression (between `${` and the matching `}`).
  // A `${...}` can itself contain a nested (possibly `html`-tagged)
  // template literal, which pushes its own 'template' frame — that's what
  // makes a hover inside `${cond ? html\`<p .x=${1}></p>\` : null}` resolve
  // per-frame instead of the whole interpolation being treated as opaque.
  const stack = [];
  let i = 0;
  while (i < offset && i < text.length) {
    const ch = text[i];
    const top = stack[stack.length - 1];

    if (!top) {
      // Top level: only backticks matter. A `html` tag immediately before
      // one starts a tagged (Aeon markup) template; anything else starts an
      // ordinary one.
      if (ch === '`') {
        const before = text.slice(Math.max(0, i - 4), i);
        stack.push({ kind: 'template', tagged: /\bhtml$/.test(before) });
      }
      i++;
      continue;
    }

    if (top.kind === 'interp') {
      if (ch === '\\') { i += 2; continue; }
      if (ch === '{') { top.braceDepth++; i++; continue; }
      if (ch === '}') {
        top.braceDepth--;
        i++;
        if (top.braceDepth === 0) stack.pop();
        continue;
      }
      if (ch === '`') {
        const before = text.slice(Math.max(0, i - 4), i);
        stack.push({ kind: 'template', tagged: /\bhtml$/.test(before) });
        i++;
        continue;
      }
      i++;
      continue;
    }

    // top.kind === 'template': inside a template literal's markup body.
    if (ch === '\\') { i += 2; continue; }
    if (ch === '`') { stack.pop(); i++; continue; }
    if (ch === '$' && text[i + 1] === '{') {
      stack.push({ kind: 'interp', braceDepth: 1 });
      i += 2;
      continue;
    }
    i++;
  }
  const top = stack[stack.length - 1];
  return !!top && top.kind === 'template' && top.tagged;
}

// Matches one attribute token: an optional Aeon binding prefix (`.` `@` `?`),
// a name, and `=`. Used to find the token touching the hover offset within a
// single line of markup.
const ATTR_TOKEN_RE = /([.?@])?([a-zA-Z_$][\w$-]*)(=)/g;

/**
 * Given one line of text and a character offset into it, finds the
 * attribute token (prefix + name) the offset falls within or immediately
 * touches, or null.
 */
function findAttrTokenAt(line, col) {
  ATTR_TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_TOKEN_RE.exec(line))) {
    const start = m.index;
    const end = start + m[0].length;
    if (col >= start && col <= end) {
      return { prefix: m[1] || '', name: m[2], raw: (m[1] || '') + m[2], start, end };
    }
  }
  return null;
}

/**
 * Full hover lookup: text + offset (absolute) + line/col -> either null (not
 * a hoverable Aeon binding) or { raw, explain } where `explain` is the real
 * explainTemplate() result for a minimal synthetic fragment built from the
 * exact token under the cursor.
 */
async function explainBindingAt(explainTemplate, fullText, offset, line, col) {
  if (!isInsideAeonHtmlMarkup(fullText, offset)) return null;
  const token = findAttrTokenAt(line, col);
  if (!token) return null;
  // A minimal single-binding fragment that exercises the REAL compiler
  // (via explainTemplate -> compile()) on exactly the prefix+name found
  // under the cursor, e.g. `<x .value=${0}></x>` or `<x ?disabled=${0}></x>`.
  const template = `<x ${token.raw}=\${0}></x>`;
  const result = await explainTemplate({ template });
  const binding = result.bindings[0];
  if (!binding) return null;
  return { token, binding };
}

module.exports = { isInsideAeonHtmlMarkup, findAttrTokenAt, explainBindingAt };
