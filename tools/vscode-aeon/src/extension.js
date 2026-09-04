// Aeon VS Code extension activation entry point.
//
// Beyond the TextMate injection grammar (wired declaratively in
// package.json's contributes.grammars, no code needed for that part), this
// registers a hover provider: hovering over one of Aeon's four binding
// prefixes (attr=, .prop=, @event=, ?bool=) inside an html`...` template
// shows the real explanation of what that binding compiles to.
//
// The explanation text is NOT copy-pasted from packages/mcp — it's produced
// by actually importing and calling that package's real explainTemplate(),
// which itself runs Aeon's real compiler (packages/core/src/dom.js's
// compile()). See src/binding-hover.js for the vscode-API-free logic this
// wraps (offset/line scanning), and test/hover.test.js for a plain-node
// test of that logic. See explainBindingAt()'s call site below for how the
// two are wired together.
const vscode = require('vscode');
const { isInsideAeonHtmlMarkup, findAttrTokenAt, explainBindingAt } = require('./binding-hover.js');

const AEON_LANGUAGES = ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'];

// Resolved lazily (dynamic import, since @aeon-framework/mcp is an ESM
// package) and cached — same "load once" shape explain-template.js itself
// uses for its own compile() import.
let explainTemplatePromise = null;
function loadExplainTemplate() {
  if (!explainTemplatePromise) {
    // Relative path out of this repo's tools/vscode-aeon into
    // packages/mcp/src, the same "resolve the sibling package by relative
    // path across a monorepo checkout" approach explain-template.js itself
    // uses to reach packages/core (see that file's comment on why: a bare
    // "@aeon-framework/mcp" specifier depends on hoisting/symlinking that
    // isn't guaranteed once this extension is packaged/installed standalone
    // via `vsce package`, whereas the relative path always works from a
    // checkout of this repo).
    explainTemplatePromise = import('../../../packages/mcp/src/explain-template.js').then(
      (mod) => mod.explainTemplate
    );
  }
  return explainTemplatePromise;
}

function activate(context) {
  const hoverProvider = {
    async provideHover(document, position) {
      const explainTemplate = await loadExplainTemplate().catch(() => null);
      if (!explainTemplate) return undefined;

      const fullText = document.getText();
      const offset = document.offsetAt(position);
      const line = document.lineAt(position.line).text;
      const col = position.character;

      if (!isInsideAeonHtmlMarkup(fullText, offset)) return undefined;
      const token = findAttrTokenAt(line, col);
      if (!token) return undefined;

      let result;
      try {
        result = await explainBindingAt(explainTemplate, fullText, offset, line, col);
      } catch {
        return undefined;
      }
      if (!result) return undefined;

      const { binding } = result;
      const kindLabel = binding.kind ? binding.kind.toUpperCase() : 'unknown';
      const lines = [`**Aeon binding — ${kindLabel}**`, '', binding.note || '_No explanation available._'];
      if (binding.warning) lines.push('', `⚠️ ${binding.warning}`);
      const range = new vscode.Range(
        position.line,
        token.start,
        position.line,
        token.end
      );
      return new vscode.Hover(new vscode.MarkdownString(lines.join('\n')), range);
    },
  };

  for (const lang of AEON_LANGUAGES) {
    context.subscriptions.push(vscode.languages.registerHoverProvider(lang, hoverProvider));
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
