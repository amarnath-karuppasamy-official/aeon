// get_conventions — Aeon's curated idioms, written by hand but cross-checked
// against the real source it describes (packages/core/src/dom.js's
// walkForParts()/AttrPart, and its list() export) rather than from memory,
// specifically so the two documented "footguns" are accurate:
//   (a) there is no `ref=` binding — attribute/property/event/boolean are
//       the only four kinds walkForParts() ever produces; anything else
//       (including `ref=`) falls through to the plain 'attribute' kind and
//       becomes a literal string attribute, no error, no warning.
//   (b) there's no `key=` attribute-style keyed-list pattern — keyed lists
//       go through core's `list(itemsFn, keyFn, renderFn)` export.
// explain_template (src/explain-template.js) demonstrates both of these
// live, against the real compiler, rather than just asserting them here.

export const CONVENTIONS = `# Aeon conventions

## Signals, not a virtual DOM
Aeon has no virtual DOM and no re-render/diff pass. State lives in signals;
templates bind directly to the real DOM once, and only the specific
DOM node/attribute touched by a changed signal is patched.

- \`signal(initial)\` — a writable reactive cell (\`.value\` get/set, \`.peek()\` to
  read without subscribing, \`.update(fn)\`).
- \`computed(fn)\` — a read-only signal derived from other signals.
- \`effect(fn)\` — runs \`fn\` now and again whenever a signal it read changes.
  Returns a stop function. This is what every reactive template binding
  compiles down to internally.

## The four template binding kinds — and ONLY these four
Aeon's compiler (packages/core/src/dom.js, walkForParts()) inspects each
attribute's *name prefix* on an interpolated attribute and classifies it
into exactly one of four kinds. There is no fifth kind:

- \`attr=\${v}\` (no prefix) — kind \`attribute\`. \`el.setAttribute(name, v)\`
  (or removeAttribute when v is null/false). Value is stringified.
- \`.prop=\${v}\` (\`.\` prefix) — kind \`property\`. \`el[name] = v\` — a real DOM
  property assignment, NOT stringified. Use for things like \`.value=\`,
  \`.checked=\` where you need the actual property type (boolean, etc.), not
  a string.
- \`@event=\${fn}\` (\`@\` prefix) — kind \`event\`. \`el.addEventListener(name, fn)\`.
  The value MUST be a function — it is used directly as the listener, never
  invoked as a reactive getter (unlike the other three kinds).
- \`?bool=\${v}\` (\`?\` prefix) — kind \`boolean\`. \`el.toggleAttribute(name, !!v)\`
  — presence/absence only, no value.

A plain \`\${v}\` in element/text content (not inside a tag) is a fifth,
separate thing — a *node* binding — content (text, a nested \`html\`\`\`\`
template, an array of these, or a raw Node).

### Footgun 1: there is no \`ref=\` binding
Frameworks like React/lit-html have an element-ref pattern; Aeon does not.
Writing \`<div ref=\${fn}>\` does NOT call \`fn\` with the element — the \`ref\`
prefix isn't recognized, so it silently falls through to the default
\`attribute\` kind: \`el.setAttribute('ref', String(fn))\`, i.e. \`fn\`'s
source code stringified into a literal \`ref="..."\` attribute. No error is
thrown. To get an element
reference, use \`onMount()\` inside the component and query/hold a local
variable, or drive behavior through \`.prop=\`/\`@event=\` bindings instead.

### Footgun 2: there is no \`key=\` attribute for lists
There is no \`key=\${id}\`-on-a-repeated-element pattern either. Keyed list
reconciliation goes through the dedicated \`list(itemsFn, keyFn, renderFn)\`
export from \`@aeon-framework/core\`, used inside a node binding:
\`\${() => list(() => todos.value, t => t.id, t => html\`<li>\${t.text}</li>\`)}\`
Writing \`key=\${t.id}\` on a plain repeated element does nothing special —
same as footgun 1, it becomes a literal \`key="..."\` attribute and Aeon will
NOT reconcile/reposition those rows by key.

## Components
\`defineComponent(fn)\` is an identity wrapper (kept for API stability /
future compile hooks) around a plain function returning an \`html\`\`\`\`
template. \`onMount(fn)\` runs after the component's DOM is attached.
\`onCleanup(fn)\` registers teardown tied to the nearest \`mount()\`/unmount.

## Dependency injection
\`createToken(description)\` makes a unique injectable handle. \`provide(token,
factoryOrValue)\` registers it (on the global root container, or a scoped
\`Container\`/\`createChild()\`). \`inject(token)\` resolves it, throwing if
nothing is registered.

## Router
\`createRouter(routeTable, { mode })\` — \`mode\` is \`'history'\` (default) or
\`'hash'\`. Bind \`\${() => outlet(router)}\` in a template to render the
matched route's component; \`link(router, to, children)\` for SPA navigation
without a full page load.
`;

export function getConventionsTool() {
  return { text: CONVENTIONS };
}
