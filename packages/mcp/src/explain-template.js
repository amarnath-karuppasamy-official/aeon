// explain_template — Aeon's unique MCP tool: given the body of an
// `html`...`` template (with `${N}` standing in for each interpolation, in
// order), report exactly what Aeon's REAL compiler decides each binding is.
//
// How this stays honest (not a guess, not a regex re-implementation that
// could drift from dom.js): it deep-imports and calls dom.js's actual
// `compile(strings)` function directly (re-exported, internal-only, as
// `__internal_compile` — see packages/core/src/dom.js's bottom comment).
// That function is the literal same code Aeon's renderer runs at template
// call-time; nothing here re-derives the attribute-prefix rules. compile()
// only inspects the *strings* half of a tagged template (values never
// affect binding-kind classification — see dom.js), so no fabricated
// runtime values are needed to get a real answer; the only "fixture" this
// module builds is the strings array itself, parsed from the `${N}` input.
//
// compile() needs a `document` (it does `document.createElement('template')`
// and parses real HTML via `.innerHTML`), so this installs the same
// throwaway happy-dom `Window` @aeon-framework/ssr uses for the same
// reason, once per process.
import { Window } from 'happy-dom';

let compileFn = null;
let domReady = false;

function ensureDom() {
  if (domReady) return;
  const window = new Window({ url: 'http://localhost/' });
  globalThis.window = window;
  globalThis.document = window.document;
  domReady = true;
}

// Resolves the sibling @aeon-framework/core package's dom.js by relative
// path rather than a bare "@aeon-framework/core/..." specifier, because
// core's package.json declares an "exports" map that only whitelists ".";
// a bare deep specifier would be rejected by Node's package-exports
// enforcement even though this file (dom.js) really exists on disk. Scoped
// packages keep the same `@scope/pkg/src/...` shape whether resolved from a
// workspace checkout (packages/mcp, packages/core) or an installed
// node_modules/@aeon-framework/{mcp,core} layout, so the same relative path
// (".." twice out of mcp's own package dir, into the sibling package) works
// in both. If it doesn't resolve (e.g. a package manager that hoists
// differently), this throws a clear, actionable error instead of silently
// guessing.
async function loadCompile() {
  if (compileFn) return compileFn;
  const candidates = [
    '../../core/src/dom.js', // workspace checkout: packages/mcp/src -> packages/core/src
    '@aeon-framework/core/src/dom.js', // in case a future core exports map whitelists this
  ];
  let lastErr;
  for (const spec of candidates) {
    try {
      const mod = await import(spec);
      if (typeof mod.__internal_compile === 'function') {
        compileFn = mod.__internal_compile;
        return compileFn;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `explain_template could not load @aeon-framework/core's internal compile() — ` +
      `tried: ${candidates.join(', ')}. Last error: ${lastErr && lastErr.message}`
  );
}

/** Split `<div ?x=${0} @click=${1}>${2}</div>` into a strings[] array, TemplateStringsArray-shaped enough for compile(). */
export function parseTemplateBody(template) {
  if (typeof template !== 'string') throw new Error('template must be a string.');
  const parts = template.split(/\$\{(\d+)\}/);
  // parts alternates: [str0, "0", str1, "1", str2, ...]
  const strings = [];
  const slotOrder = [];
  for (let i = 0; i < parts.length; i += 2) {
    strings.push(parts[i]);
    if (i + 1 < parts.length) slotOrder.push(Number(parts[i + 1]));
  }
  return { strings, slotOrder };
}

const KIND_NOTES = {
  attribute:
    'Plain HTML attribute binding — el.setAttribute(name, value) (removeAttribute when the value is null/false). Value is stringified.',
  property:
    'DOM PROPERTY binding (.prop=) — el[name] = value, assigned directly, NOT stringified. Value must match the element\'s actual property type (e.g. a real boolean for .checked=/.disabled=, not the string "false").',
  event:
    'Real event binding (@event=) — this creates an actual el.addEventListener(name, value) call. The value MUST be a function; unlike the other three attribute kinds it is used as-is (never re-invoked as a reactive getter — the function itself IS the listener).',
  boolean:
    'Boolean attribute binding (?bool=) — el.toggleAttribute(name, !!value): presence/absence only, the attribute never carries the value itself.',
  node: 'Node-content binding — becomes child content (text, a nested html`` template, an array of these, or a raw Node). Wrap it in a function (`${() => ...}`) to make it reactive.',
};

// Curated, not exhaustive: attribute-kind names that read like they SHOULD
// be one of Aeon's other three special kinds (because they are exactly
// that in React/Vue/lit-html/Angular) but, in Aeon, are NOT — they fall
// through to the plain `attribute` kind silently. This is deliberately a
// denylist of known footguns, not a blanket warning on every custom
// attribute (`class=`, `id=`, `href=`, `data-*=`, etc. are all completely
// legitimate `attribute`-kind bindings with nothing wrong with them).
const FOOTGUN_ATTR_NAMES = {
  ref: 'Aeon has no ref= binding — there is no fifth binding kind. This becomes a literal string attribute named "ref", silently. Use onMount() inside the component to get element access instead, or drive behavior via .prop=/@event= bindings.',
  key: 'Aeon has no key= attribute-style keyed-list pattern. This becomes a literal string attribute named "key", silently, and does NOT get Aeon to reconcile rows by key. Use the list(itemsFn, keyFn, renderFn) export from @aeon-framework/core instead.',
  model: 'Aeon has no v-model-style two-way-binding shorthand. This becomes a literal string attribute named "model", silently. Bind the value explicitly with .prop= and update the signal explicitly with @event=.',
};

/**
 * Explain what Aeon's real compiler decides every `${N}` interpolation in
 * `template` (the body of an html`...` tagged template, `${N}` placeholders
 * numbered in order) is bound as.
 */
export async function explainTemplate({ template }) {
  if (!template || typeof template !== 'string') {
    throw new Error('template is required (the body of an html`...` template, using ${N} placeholders).');
  }
  ensureDom();
  const compile = await loadCompile();
  const { strings, slotOrder } = parseTemplateBody(template);
  const slotCount = strings.length - 1;

  const { partDescriptors } = compile(strings);
  const byIndex = new Map(partDescriptors.map((d) => [d.index, d]));

  const bindings = [];
  for (let i = 0; i < slotCount; i++) {
    const reportedSlot = slotOrder[i] ?? i;
    const desc = byIndex.get(i);
    if (!desc) {
      bindings.push({
        slot: reportedSlot,
        kind: null,
        name: null,
        note: 'No binding was produced for this interpolation — it likely landed somewhere compile() could not attach a marker to (e.g. inside a tag name, or malformed markup around it).',
        warning: null,
      });
      continue;
    }
    const kind = desc.kind;
    const name = desc.name ?? null;
    let warning = null;
    if (kind === 'attribute' && name && Object.prototype.hasOwnProperty.call(FOOTGUN_ATTR_NAMES, name)) {
      warning = `NOT a real Aeon binding kind: ${FOOTGUN_ATTR_NAMES[name]}`;
    }
    bindings.push({
      slot: reportedSlot,
      kind,
      name,
      note: KIND_NOTES[kind] || null,
      warning,
    });
  }

  bindings.sort((a, b) => a.slot - b.slot);
  return { template, slotCount, bindings };
}
