// A tiny, hand-rolled syntax "highlighter" for the JS/TS/shell code samples
// on this site — deliberately not a real tokenizer/parser and not a
// dependency. It's a handful of regexes run in priority order (comments and
// strings first, so keywords inside them are never re-matched) that wrap
// recognizable tokens in <span class="tok-*"> for the site's own CSS to
// color. Good enough for docs code samples; not meant to be a general-
// purpose highlighter.
const KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'const', 'let', 'var', 'function',
  'return', 'if', 'else', 'for', 'while', 'new', 'class', 'extends',
  'async', 'await', 'of', 'in', 'typeof', 'true', 'false', 'null',
  'undefined', 'this', 'throw', 'try', 'catch', 'finally', 'static', 'get',
  'set', 'switch', 'case', 'break', 'continue', 'do', 'instanceof', 'void',
  'yield', 'interface', 'type', 'implements', 'extends', 'as', 'npx', 'npm',
]);

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TOKEN_RE =
  /(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|(\$\{|\}|[.,;:(){}[\]=><+\-*/!?&|]+)|(\b[a-zA-Z_$][\w$]*\b)/g;

/** Highlight a plain-text code string into an HTML string of <span>-wrapped tokens. */
export function highlight(code) {
  let out = '';
  let last = 0;
  for (const m of code.matchAll(TOKEN_RE)) {
    out += esc(code.slice(last, m.index));
    const [full, comment, template, string, number, punct, ident] = m;
    if (comment) out += `<span class="tok-com">${esc(comment)}</span>`;
    else if (template) out += `<span class="tok-str">${esc(template)}</span>`;
    else if (string) out += `<span class="tok-str">${esc(string)}</span>`;
    else if (number) out += `<span class="tok-num">${esc(number)}</span>`;
    else if (punct) out += `<span class="tok-punct">${esc(punct)}</span>`;
    else if (ident) out += KEYWORDS.has(ident) ? `<span class="tok-kw">${esc(ident)}</span>` : esc(ident);
    last = m.index + full.length;
  }
  out += esc(code.slice(last));
  return out;
}
