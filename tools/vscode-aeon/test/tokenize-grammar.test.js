// Real, programmatic proof that syntaxes/aeon-html.tmLanguage.json actually
// assigns the four distinct Aeon binding scopes correctly, and does NOT
// apply Aeon/HTML highlighting inside a plain (untagged) template literal.
//
// No VS Code / Extension Development Host involved: this loads the grammar
// file through vscode-textmate (the exact same tokenizer engine VS Code
// itself uses to turn a .tmLanguage.json into scopes) + vscode-oniguruma
// (the real regex engine TextMate grammars require — JS RegExp cannot
// evaluate Oniguruma syntax), tokenizes real Aeon template source line by
// line, and asserts on the actual returned scope names. This is the
// "vscode-textmate + vscode-oniguruma direct library" verification route
// described in the task: a fully scriptable, no-GUI-required way to prove
// the grammar itself is correct.
//
// Run with: node test/tokenize-grammar.test.js  (also wired as `npm test`)
'use strict';
const fs = require('fs');
const path = require('path');
const oniguruma = require('vscode-oniguruma');
const { Registry, parseRawGrammar, INITIAL } = require('vscode-textmate');

const GRAMMAR_PATH = path.join(__dirname, '..', 'syntaxes', 'aeon-html.tmLanguage.json');

let failures = 0;
let checks = 0;

function assert(cond, message) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL: ${message}`);
  } else {
    console.log(`ok:   ${message}`);
  }
}

async function loadOniguruma() {
  const wasmPath = require.resolve('vscode-oniguruma/release/onig.wasm');
  const wasmBin = fs.readFileSync(wasmPath).buffer;
  await oniguruma.loadWASM(wasmBin);
  return {
    createOnigScanner(patterns) {
      return new oniguruma.OnigScanner(patterns);
    },
    createOnigString(s) {
      return new oniguruma.OnigString(s);
    },
  };
}

// text.html.basic (VS Code's built-in HTML grammar) and source.js (VS
// Code's built-in JS grammar) are NOT bundled in this repo — the real
// extension relies on VS Code providing both at runtime (a normal
// assumption for "inject into source.js" / "reuse the built-in HTML
// grammar" extensions). But vscode-textmate treats an *unresolved* include
// target as a hard failure of the whole containing rule, not a silent
// no-op (confirmed empirically: a begin/end rule whose own `patterns`
// includes an unresolved scope tokenizes as if the rule never matched at
// all) — so standing this grammar up outside VS Code needs *some* stub
// standing in for each, or every rule that reaches for source.js/
// text.html.basic (which is most of them: the interpolation body, and the
// tag's own attribute-value fallback) would falsely appear broken here.
// These stubs are minimal-but-real grammars (loaded through the same
// Registry/parseRawGrammar path as the grammar under test) whose only job
// is to resolve the include and contribute a harmless scope — they are not
// a claim about what VS Code's actual bundled grammars tokenize into, only
// enough for THIS grammar's own rules (which are what's under test) to run
// end-to-end the way they will once a real source.js/text.html.basic sits
// next to them.
// Deliberately non-greedy (one char at a time, stopping at `}` / `<` / '`'):
// a stub that matched greedily across the *whole rest of the line* would
// swallow past the real delimiters (the interpolation's closing `}`, the
// next tag's `<`) that the grammar under test relies on to end its own
// begin/end rules, which is not how a real embedded-language grammar
// (source.js/text.html.basic) behaves — it also stops at the boundaries
// its host construct expects.
const STUB_SOURCE_JS = {
  scopeName: 'source.js',
  patterns: [{ match: '[^}`]', name: 'source.js.stub-token' }],
};
const STUB_HTML_BASIC = {
  scopeName: 'text.html.basic',
  patterns: [{ match: '[^<`]', name: 'text.html.basic.stub-token' }],
};

async function buildRegistry() {
  const vscodeOnigurumaLib = await loadOniguruma();
  const grammarSource = fs.readFileSync(GRAMMAR_PATH, 'utf8');
  const rawGrammar = parseRawGrammar(grammarSource, GRAMMAR_PATH);

  const registry = new Registry({
    onigLib: Promise.resolve(vscodeOnigurumaLib),
    loadGrammar: async (scopeName) => {
      if (scopeName === rawGrammar.scopeName) return rawGrammar;
      if (scopeName === 'source.js') return STUB_SOURCE_JS;
      if (scopeName === 'text.html.basic') return STUB_HTML_BASIC;
      return null;
    },
  });
  return { registry, scopeName: rawGrammar.scopeName };
}

function tokenizeLines(grammar, lines) {
  let ruleStack = INITIAL;
  const out = [];
  for (const line of lines) {
    const result = grammar.tokenizeLine(line, ruleStack);
    out.push({ line, tokens: result.tokens });
    ruleStack = result.ruleStack;
  }
  return out;
}

function scopesAt(tokenized, lineIndex, col) {
  const { tokens } = tokenized[lineIndex];
  const tok = tokens.find((t) => col >= t.startIndex && col < t.endIndex);
  return tok ? tok.scopes : [];
}

function hasScope(scopes, needle) {
  return scopes.some((s) => s.includes(needle));
}

async function main() {
  const { registry, scopeName } = await buildRegistry();
  const grammar = await registry.loadGrammar(scopeName);
  if (!grammar) throw new Error('grammar failed to load');

  // --- 1. All four binding kinds inside a real html`` tagged template ------
  // Mirrors the exact case named in the task and the shape of real usage in
  // examples/demo-app (Contact.js's `.value=`, `@input=`, and README's
  // `attr=`/`.prop=`/`@event=`/`?bool=` line). Kept on one tag, one line, so
  // column offsets are easy to reason about and check precisely.
  const src1 =
    'const view = html`<div class=${cls} .value=${val} @click=${fn} ?disabled=${dis}></div>`;';
  const tok1 = tokenizeLines(grammar, [src1]);

  const classCol = src1.indexOf('class');
  const valueCol = src1.indexOf('.value') + 1; // land on "value", after the dot
  const clickCol = src1.indexOf('@click') + 1; // land on "click", after the @
  const disabledCol = src1.indexOf('?disabled') + 1; // land on "disabled", after the ?

  const classScopes = scopesAt(tok1, 0, classCol);
  const valueScopes = scopesAt(tok1, 0, valueCol);
  const clickScopes = scopesAt(tok1, 0, clickCol);
  const disabledScopes = scopesAt(tok1, 0, disabledCol);

  assert(
    hasScope(classScopes, 'entity.other.attribute-name.html') &&
      !classScopes.some((s) => s.startsWith('entity.other.attribute-name') && s !== 'entity.other.attribute-name.html'),
    `plain "class=" gets the ordinary HTML attribute scope, not an Aeon-specific one (got: ${JSON.stringify(classScopes)})`
  );
  assert(
    hasScope(valueScopes, 'entity.other.attribute-name.property.aeon'),
    `".value=" gets the property scope (got: ${JSON.stringify(valueScopes)})`
  );
  assert(
    hasScope(clickScopes, 'entity.other.attribute-name.event.aeon'),
    `"@click=" gets the event scope (got: ${JSON.stringify(clickScopes)})`
  );
  assert(
    hasScope(disabledScopes, 'entity.other.attribute-name.boolean.aeon'),
    `"?disabled=" gets the boolean scope (got: ${JSON.stringify(disabledScopes)})`
  );

  // All four scopes must be pairwise distinct (the actual differentiating
  // value asked for: someone glancing at the markup can visually tell kinds
  // apart because their scope names, and therefore theme colors, differ).
  const kindScopeOf = (scopes) =>
    scopes.find((s) => s.startsWith('entity.other.attribute-name'));
  const four = [classScopes, valueScopes, clickScopes, disabledScopes].map(kindScopeOf);
  assert(
    new Set(four).size === 4,
    `all four binding kinds produce distinct attribute-name scopes (got: ${JSON.stringify(four)})`
  );

  // The interpolation values themselves get real JS embedding, not treated
  // as literal HTML text — spot check one.
  const clsExprCol = src1.indexOf('cls');
  const clsExprScopes = scopesAt(tok1, 0, clsExprCol);
  assert(
    hasScope(clsExprScopes, 'meta.embedded.line.js.aeon'),
    `an interpolation value ("cls") is scoped as embedded JS (got: ${JSON.stringify(clsExprScopes)})`
  );

  // --- 2. Multiline template + node-content interpolation, matching real
  //        examples/demo-app/src/pages/Contact.js usage shape -------------
  const src2lines = [
    'export function Contact() {',
    '  return html`',
    '    <label>',
    '      ${label}<br />',
    '      <input',
    '        type=${type}',
    '        .value=${() => ctrl.value.value}',
    '        @blur=${() => ctrl.markTouched()}',
    '      />',
    '    </label>',
    '  `;',
    '}',
  ];
  const tok2 = tokenizeLines(grammar, src2lines);
  const typeCol = src2lines[5].indexOf('type');
  const dotValueCol = src2lines[6].indexOf('.value') + 1;
  const atBlurCol = src2lines[7].indexOf('@blur') + 1;
  const typeScopes = scopesAt(tok2, 5, typeCol);
  assert(
    hasScope(typeScopes, 'entity.other.attribute-name.html') &&
      !typeScopes.some((s) => s.startsWith('entity.other.attribute-name') && s !== 'entity.other.attribute-name.html'),
    `multiline: "type=" is a plain attribute scope (got: ${JSON.stringify(typeScopes)})`
  );
  assert(
    hasScope(scopesAt(tok2, 6, dotValueCol), 'entity.other.attribute-name.property.aeon'),
    `multiline: ".value=" is the property scope (got: ${JSON.stringify(scopesAt(tok2, 6, dotValueCol))})`
  );
  assert(
    hasScope(scopesAt(tok2, 7, atBlurCol), 'entity.other.attribute-name.event.aeon'),
    `multiline: "@blur=" is the event scope (got: ${JSON.stringify(scopesAt(tok2, 7, atBlurCol))})`
  );

  // --- 3. Negative case: a PLAIN (untagged) template literal must NOT pick
  //        up any Aeon/embedded-HTML scoping at all ------------------------
  const src3 = 'const notMarkup = `<div .value=${x} @click=${y} ?disabled=${z}></div>`;';
  const tok3 = tokenizeLines(grammar, [src3]);
  const plainValueCol = src3.indexOf('.value') + 1;
  const plainClickCol = src3.indexOf('@click') + 1;
  const plainScopes = scopesAt(tok3, 0, plainValueCol);
  const plainScopes2 = scopesAt(tok3, 0, plainClickCol);
  // The only scope this whole test run's root grammar ever contributes is
  // its own top-level scopeName ("inline.aeon-html") — that's just the
  // Registry's necessary root wrapper here, not an Aeon-specific scope, so
  // it's excluded from this check. Nothing beyond it (no meta.tag.aeon, no
  // entity.other.attribute-name.*.aeon, no meta.embedded.block.html.aeon)
  // should appear for an untagged template literal.
  const isRootOnly = (s) => s === 'inline.aeon-html';
  assert(
    plainScopes.every(isRootOnly),
    `untagged template literal: ".value=" gets NO Aeon/tag scoping (got: ${JSON.stringify(plainScopes)})`
  );
  assert(
    plainScopes2.every(isRootOnly),
    `untagged template literal: "@click=" gets NO Aeon/tag scoping (got: ${JSON.stringify(plainScopes2)})`
  );
  // Sanity: the base scope for that whole line should just be the grammar's
  // top-level scope with nothing injected, i.e. we never even entered
  // meta.embedded.block.html.aeon.
  assert(
    !hasScope(plainScopes, 'meta.embedded.block.html.aeon'),
    `untagged template literal: never enters the html-injection block (got: ${JSON.stringify(plainScopes)})`
  );

  // --- 4. Negative case: a similarly-named but different tag (`sql`,
  //        `styled.div`, a bare identifier "htmlx") must not trigger either,
  //        proving the (?<=\bhtml) lookbehind is a real word-boundary match
  //        and not just "contains html". --------------------------------
  const src4 = 'const x = htmlx`<div .value=${a}></div>`; const y = sql`.value=${b}`;';
  const tok4 = tokenizeLines(grammar, [src4]);
  const dotValueColX = src4.indexOf('.value=') + 1;
  const secondDotValueCol = src4.lastIndexOf('.value=') + 1;
  assert(
    !hasScope(scopesAt(tok4, 0, dotValueColX), 'property.aeon'),
    `"htmlx\`...\`" (not exactly "html") does not trigger the property scope (got: ${JSON.stringify(
      scopesAt(tok4, 0, dotValueColX)
    )})`
  );
  assert(
    !hasScope(scopesAt(tok4, 0, secondDotValueCol), 'property.aeon'),
    `"sql\`...\`" does not trigger the property scope (got: ${JSON.stringify(
      scopesAt(tok4, 0, secondDotValueCol)
    )})`
  );

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
