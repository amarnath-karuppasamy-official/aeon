// Whole-file scanner that finds every `html`...`` ` tagged template literal in
// a plain JS/TS/JSX/TSX source file and extracts it as a `${N}`-placeholder
// body (the same shape @aeon-framework/mcp's explainTemplate/parseTemplateBody
// already consume) plus the real source line of each interpolation.
//
// This is a careful text scanner, NOT a full JS parser — same trade-off
// tools/vscode-aeon/src/binding-hover.js already made (see its
// isInsideAeonHtmlMarkup): tracking template-literal / interpolation
// nesting (so a `${cond ? html`<a .x=${1}>` : null}` inside another
// template resolves per-frame) plus enough of plain-JS lexing (line
// comments, block comments, quoted strings) that a stray backtick or brace
// inside an unrelated string/comment doesn't desync the scan. It does not
// implement a full ECMAScript grammar (regex literals containing backticks,
// for instance, aren't specially handled) — matching this project's
// established "best-effort static text scan, never eval" discipline for
// tooling that reads real project files (see
// packages/mcp/src/inspect-project.js's scrapeRouteFile).
//
// Returns: Array<{ line: number, body: string, slotLines: number[] }>
// - `line` is the 1-based source line the template's opening backtick is on.
// - `body` is the template's markup with each `${...}` interpolation
//   replaced by `${N}` (N in encounter order) — ready to pass straight into
//   @aeon-framework/mcp's `explainTemplate({ template: body })`.
// - `slotLines[N]` is the 1-based source line the Nth interpolation's `${`
//   actually starts on (which is what a caller wants to report against, not
//   the template's opening line, for a multi-line template).
export function extractHtmlTemplates(source) {
  const templates = [];
  const stack = [];
  let i = 0;
  let line = 1;
  const n = source.length;

  const isTagged = (idx) => /\bhtml$/.test(source.slice(Math.max(0, idx - 4), idx));

  while (i < n) {
    const ch = source[i];
    const top = stack[stack.length - 1];

    if (!top) {
      // Top-level JS: only comments, quoted strings, and backticks matter —
      // everything else is opaque code we don't need to understand.
      if (ch === '\n') { line++; i++; continue; }
      if (ch === '/' && source[i + 1] === '/') {
        while (i < n && source[i] !== '\n') i++;
        continue;
      }
      if (ch === '/' && source[i + 1] === '*') {
        i += 2;
        while (i < n && !(source[i] === '*' && source[i + 1] === '/')) { if (source[i] === '\n') line++; i++; }
        i += 2;
        continue;
      }
      if (ch === "'" || ch === '"') {
        const quote = ch;
        i++;
        while (i < n && source[i] !== quote) {
          if (source[i] === '\\') i++;
          if (source[i] === '\n') line++;
          i++;
        }
        i++;
        continue;
      }
      if (ch === '`') {
        stack.push({ kind: 'template', tagged: isTagged(i), body: '', slotLines: [], slotIndex: 0, startLine: line });
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (top.kind === 'interp') {
      // Inside a `${...}` interpolation's JS expression — real code, so it
      // gets the same comment/string handling as top level, plus brace
      // depth tracking to find the matching `}`, plus recursion into any
      // nested template literal (which may itself be `html`-tagged, e.g.
      // conditional rendering: `${() => cond() ? html`<a>` : html`<b>`}`).
      if (ch === '\n') { line++; i++; continue; }
      if (ch === '\\') { i += 2; continue; }
      if (ch === '/' && source[i + 1] === '/') {
        while (i < n && source[i] !== '\n') i++;
        continue;
      }
      if (ch === '/' && source[i + 1] === '*') {
        i += 2;
        while (i < n && !(source[i] === '*' && source[i + 1] === '/')) { if (source[i] === '\n') line++; i++; }
        i += 2;
        continue;
      }
      if (ch === "'" || ch === '"') {
        const quote = ch;
        i++;
        while (i < n && source[i] !== quote) {
          if (source[i] === '\\') i++;
          if (source[i] === '\n') line++;
          i++;
        }
        i++;
        continue;
      }
      if (ch === '`') {
        stack.push({ kind: 'template', tagged: isTagged(i), body: '', slotLines: [], slotIndex: 0, startLine: line });
        i++;
        continue;
      }
      if (ch === '{') { top.braceDepth++; i++; continue; }
      if (ch === '}') {
        top.braceDepth--;
        i++;
        if (top.braceDepth === 0) stack.pop();
        continue;
      }
      i++;
      continue;
    }

    // top.kind === 'template': inside a template literal's markup/text body.
    if (ch === '\\') {
      top.body += ch + (source[i + 1] || '');
      i += 2;
      continue;
    }
    if (ch === '`') {
      stack.pop();
      i++;
      if (top.tagged) templates.push({ line: top.startLine, body: top.body, slotLines: top.slotLines });
      continue;
    }
    if (ch === '$' && source[i + 1] === '{') {
      top.slotLines.push(line);
      top.body += `\${${top.slotIndex}}`;
      top.slotIndex++;
      stack.push({ kind: 'interp', braceDepth: 1 });
      i += 2;
      continue;
    }
    if (ch === '\n') { line++; top.body += ch; i++; continue; }
    top.body += ch;
    i++;
  }

  return templates;
}
