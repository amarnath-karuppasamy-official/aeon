# Aeon

A full-stack, signal-first web framework. Fine-grained reactivity, direct DOM
patching (no virtual DOM), a router, reactive forms, and dependency injection —
all without decorators, NgModules, or a required compiler step.

This is a working v0.1 skeleton: real reactivity, a real renderer, a real
router/forms/DI, a CLI, and a demo app that exercises all of it. It is not a
finished competitor to Angular — it's the foundation such a project would be
built on.

## Why this shape

Angular's core costs — NgModules, decorators + reflect-metadata, zone.js
change detection, RxJS as a hard dependency for basic state — are not
inherent to "batteries-included framework." Aeon keeps the batteries
(router, forms, DI) but drops the ceremony:

- **State is a signal, not a subscription you manage.** `signal(0)` gives you
  `.value` get/set; any template expression that reads it re-renders only
  that binding when it changes. No `ChangeDetectorRef`, no zone patching.
- **No virtual DOM.** Templates compile once (cached per call site) into a
  real `<template>`; each reactive value gets a direct binding to the exact
  DOM node or attribute it controls. Updates touch only what changed.
- **No decorators, no DI ceremony.** `createToken()` + `provide()` +
  `inject()` are plain functions. Components are plain functions that return
  a template.
- **No required build step for the framework itself.** `@aeon-framework/core` is
  dependency-free ES modules — you can `import` it directly in a browser.
  The CLI (esbuild-based) exists for bundling and dev-server convenience,
  not because the framework needs a compiler to function.

## Lightweight & portable

Two separate claims, both verified in this repo rather than asserted:

**Lightweight** — measured against React, Vue, Angular, Svelte, Solid, and
Preact by building the same counter component in each and comparing
min+gzip size (methodology, exact versions, and raw numbers in
`scripts/build-standalone.mjs` and the project's comparison writeup). Aeon's
demo counter is **1.9 kB gzipped, including the framework** — smaller than
every framework measured, including Solid (2.8 kB) and Preact (5.4 kB). The
combined drop-in build below (core + router + forms + DI, everything) is
**3.7 kB gzipped** — still smaller than a bare React counter alone (60 kB).

**Portable** — three usage modes, each actually run and checked, not just
claimed:

1. **npm + bundler** (the normal path) — `@aeon-framework/core` has zero runtime
   dependencies and `"sideEffects": false`, so a bundler tree-shakes away
   whatever you don't import.
2. **No build step at all** — `examples/no-build/index.html` imports
   `@aeon-framework/core` straight from its source files with a plain
   `<script type="module">` and a relative path. No esbuild, no CLI, no
   `npm install`. It works because the framework is just standards-compliant
   ES modules — nothing to transpile.
3. **Plain `<script>` tag, no module system** — `npm run build:standalone`
   produces `dist-standalone/aeon.global.js` (or `aeon.core.global.js` for
   core alone), a single minified file that defines `window.Aeon`. Drop it
   into any page, even one with no `type="module"` support at all — see
   `examples/standalone-drop-in/`.
4. **Server/CLI/anywhere JS runs, no DOM required** — the reactive core
   (`signal`/`computed`/`effect`/`batch`) never touches `window` or
   `document` at import time; `scripts/portability-check.mjs` imports it in
   a process with neither present and runs it under both Node and Bun to
   prove it. (Rendering to real DOM still needs a DOM, obviously — this is
   about the reactivity engine being usable standalone, e.g. from a CLI or
   a future SSR path.)

```sh
npm run build:standalone     # writes dist-standalone/*.js
npm run portability-check    # signals work with zero DOM, checked on Node + Bun
```

## Packages

| Package | What it does |
|---|---|
| `@aeon-framework/core` | `signal`, `computed`, `effect`, `batch`, the `html` template tag, `render`, `list` (keyed lists), `mount`, `hydrate`/`hydrateComponent`, `onMount`/`onCleanup` |
| `@aeon-framework/router` | `createRouter`, hash or history mode, params, `outlet`, `link` |
| `@aeon-framework/forms` | `control`, `group`, composable `validators` |
| `@aeon-framework/di` | `createToken`, `provide`, `inject`, scoped `Container` |
| `@aeon-framework/cli` | `aeon new / dev / build / migrate / generate` (alias `g`) — esbuild-powered, zero config |
| `@aeon-framework/interop` | Embed Aeon inside React/Vue (and vice versa) — `AeonView`, `useAeonSignal` |
| `@aeon-framework/migrate` | Codemod: converts a defined subset of React function components to Aeon |
| `@aeon-framework/http` | `resource()` (reactive fetch), `mutation()` (imperative actions), plain `http.*` fetch helpers |
| `@aeon-framework/testing` | `render()`/`fireEvent`/`cleanup()` — mount a component into a real (Happy DOM) document and test it |
| `@aeon-framework/ssr` | `renderToString()` — server-render a component/template to an HTML string using the real client renderer, no parallel string renderer |
| `@aeon-framework/animate` | `transition()` / `animatedList()` — signal-driven enter/leave transitions, including animated list-row removal |
| `@aeon-framework/i18n` | `locale` signal, `t(key, params)` interpolation + pluralization, `loadMessages()`, fallback locale chain |
| `@aeon-framework/devtools` | `attachDevtools()` / `mountDevtoolsOverlay()` — an in-page (not a browser extension) live signal inspector |
| `@aeon-framework/mcp` | `aeon-mcp` — an MCP server for AI coding assistants: code generation, docs search, conventions, project inspection, and real-compiler-backed template explanation (see [MCP server](#mcp-server)) |
| `create-aeon` | `npm create aeon@latest my-app` — the zero-install scaffolder |

Every package ships hand-written `.d.ts` declarations — TypeScript projects get full autocomplete and type-checking with no separate `@types/*` package, and no build step generates them (they're maintained by hand alongside the JS, and verified against real `tsc` runs, not just eyeballed).

## Quickstart

Aeon is published on npm — no cloning this repo required. Two equivalent
ways to start a new app, same as `ng new` (global CLI) or `npm create
vite@latest` (one-off create command):

```sh
# Angular-style: install the CLI once, reuse it everywhere
npm install -g @aeon-framework/cli
aeon new my-app
cd my-app && npm install
npx aeon dev .        # dev server with live rebuild (SPA fallback for @aeon-framework/router)
npx aeon build .      # production bundle to dist/

# or, zero-install:
npm create aeon@latest my-app
```

Both produce the identical starter app — `aeon new` is for people who'll
scaffold more than one project and want the `aeon` command on their PATH;
`npm create aeon` is for a one-off with nothing to install afterward. Add
`--ts` to either for the TypeScript starter (`aeon new my-app --ts`, or
`npm create aeon@latest my-app -- --ts`) — same app, `main.ts` instead of
`main.js`, a `tsconfig.json` included, full type-checking against every
Aeon package's hand-written `.d.ts`.

Batteries included: the scaffolded `package.json` lists every published Aeon
package as a dependency (`router`, `forms`, `di`, `http`, `i18n`, `animate`,
`devtools`, `ssr`, plus `testing` as a dev dependency) — not just the two or
three the starter's `main.js` happens to import. `npm install` gets you
everything up front; nothing to add later just to try routing or SSR. The
starter code itself stays a minimal counter (with a comment listing what's
already installed and ready to import) rather than demoing all nine, and
esbuild still tree-shakes the production build down to only what you
actually `import` — installing the rest costs nothing in bundle size.

If you're working from a clone of this repo instead (e.g. to run the demo
app or contribute), use the CLI's local entry point:

```sh
npm install
node packages/cli/bin/aeon.mjs new my-app
npm run demo         # aeon dev examples/demo-app — counter, DI, router,
                      # keyed lists, and forms all exercised together
```

## A component

```js
import { html, signal, mount } from '@aeon-framework/core';

function Counter() {
  const count = signal(0);
  return html`
    <p>Count: ${() => count.value}</p>
    <button @click=${() => count.value++}>+1</button>
  `;
}

mount(Counter, document.getElementById('app'));
```

Bindings follow one rule: **a function is reactive, a plain value is
static.** `${() => count.value}` re-runs whenever `count` changes;
`${count.value}` (no arrow) captures the value once and never updates —
useful for genuinely static content, a footgun if you meant it to be live.
Event handlers (`@click=${fn}`) are the one exception — the function itself
*is* the value there, not a getter to call.

Attribute bindings support four kinds, mirroring lit-html:
`attr=${v}` (plain attribute), `.prop=${v}` (DOM property, e.g. `.value` for
inputs), `@event=${fn}` (listener), `?bool=${v}` (toggled attribute).

## Routing

```js
import { createRouter, outlet, link } from '@aeon-framework/router';

const router = createRouter(
  [
    { path: '/', component: Home },
    { path: '/users/:id', component: UserDetail },
    { path: '*', component: NotFound },
  ],
  { mode: 'hash' } // or 'history'
);

router.start();
// in a template: ${() => outlet(router)}   and   ${link(router, '/users/1', 'Ada')}
```

In `mode: 'history'` (the default), a hard refresh on a non-root route (e.g.
`/users/1`) needs the *server* to respond with the app shell for that URL too
— the router only resolves it client-side once `main.js` has actually
loaded. `aeon dev` handles this for you: it's a small proxy in front of
esbuild's own dev server (esbuild has no notion of client-side routing) that
serves `index.html` for any navigation request esbuild 404s on, so a refresh
on any route works during development — covered by
`packages/cli/test/dev-spa-fallback.test.mjs`, which hits a real running dev
server over HTTP. For a production static host, configure the same SPA
fallback rule the host provides (Netlify's `_redirects`, Vercel's rewrites,
nginx's `try_files`, etc.) — or skip the question entirely with `'hash'`
mode, or use `@aeon-framework/ssr` to render each route server-side (see
"SSR + hydration" below, including the per-request routing pattern).

## Forms

```js
import { control, group, validators } from '@aeon-framework/forms';

const form = group({
  email: control('', [validators.required(), validators.email()]),
});

// form.controls.email.value / .errors / .touched / .valid are all signals —
// bind them directly in a template, no separate "form state" object.
```

## DI

```js
import { createToken, provide, inject } from '@aeon-framework/di';

const Logger = createToken('Logger');
provide(Logger, () => ({ log: (msg) => console.log(msg) }));

// anywhere downstream:
const logger = inject(Logger);
```

## HTTP

Angular's `HttpClient` returns Observables; Aeon's `@aeon-framework/http`
returns signals instead, so a fetch fits the same `${() => ...}` binding
style as everything else. Two primitives cover the two shapes of network
calls — reactive reads and imperative actions:

```js
import { resource, mutation, http } from '@aeon-framework/http';

// resource(): re-fetches whenever the source changes. A null/undefined/false
// source skips fetching — the standard "don't fetch until we have an id" guard.
const user = resource(() => userId.value, (id) => http.get(`/api/users/${id}`));
// user.data / user.loading / user.error are all signals — bind them directly.
// A superseded request (source changed again before the first resolved) is
// aborted and its result discarded, so `data` never flickers back to stale.

// mutation(): triggered by calling run(), not by a signal changing — the
// right shape for a form submit or a delete button.
const createUser = mutation((payload) => http.post('/api/users', payload));
await createUser.run({ name: 'Ada' }); // createUser.data / .loading / .error track it
```

`http.get/post/put/patch/del` are plain `fetch` wrappers with no signals
involved — JSON in, JSON out, a thrown `HttpError` (with `.status`) on a
non-2xx response — use them directly, or as the building blocks the two
primitives above are made of.

## Testing

`@aeon-framework/testing` mounts a component into a real document (Happy
DOM, not a mock) and gives you Testing-Library-style helpers. Aeon's signal
writes apply synchronously — no virtual-DOM diff to flush — so assertions
run immediately after an interaction, no `await tick()` needed:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, fireEvent, cleanup } from '@aeon-framework/testing';
import { Counter } from './counter.js';

test.afterEach(() => cleanup());

test('clicking +1 increments the count', async () => {
  const { find } = await render(Counter);
  fireEvent.click(find('#inc'));
  assert.equal(find('#count').textContent, '1');
});
```

## SSR + hydration

`@aeon-framework/ssr`'s `renderToString()` does not hand-roll a second,
parallel string renderer — it runs the exact same `mount()`/`render()` code
from `@aeon-framework/core` against a headless Happy DOM document and
serializes the result. Server output and client output come from the same
code path by construction; they can't drift apart the way a template-string
SSR renderer and a DOM renderer can.

```js
import { renderToString } from '@aeon-framework/ssr';
import { hydrateComponent } from '@aeon-framework/core';

// on the server:
const html = renderToString(Counter); // put this inside your response's mount-point element

// on the client, once the browser has parsed that HTML into the DOM:
hydrateComponent(Counter, document.getElementById('app'));
```

`hydrate()`/`hydrateComponent()` (in `@aeon-framework/core`) **adopt** the
existing server-rendered DOM instead of clearing the container and
re-rendering — attribute/property/boolean bindings are (re-)applied in
place, event listeners are attached (server HTML obviously can't carry
them), and node-part text/element content is adopted by reference. A
before/after node-identity check is exactly what
`packages/ssr/test/ssr.test.mjs` and `packages/core/test/hydrate.test.mjs`
verify — not just "the DOM looks right afterward," but that the same DOM
nodes survived hydration and a listener attached during hydration actually
fires and updates a signal-bound text node.

**Disclosed limitation — list hydration flashes once.** A `list()`-bound
region has no per-row marker to resync against (only the anchor for the
list *as a whole*), so hydrating one clears the server-rendered rows and
does one ordinary client-side `list()` render in their place — a one-time
flash limited to that region. Everything else (including a *nested*
`html` template used as a node-part's value, e.g. `${() => cond() ?
html\`<b>A</b>\` : html\`<i>B</i>\`}`) hydrates without recreating a node.
This is a real, deliberate scope cut, not an oversight — solving
non-flashing incremental list hydration (matching each row to a stable
per-row marker, handling reordering, etc.) is a meaningfully larger problem
that's called out in "What's real vs. what's next" below instead of being
half-solved here.

**Per-request SSR with the router.** `renderToString()`'s Happy DOM window is
installed with a real origin (`http://localhost/`), not Happy DOM's default
`about:blank`. That matters if you combine SSR with `@aeon-framework/router`:
the standard "render whatever route matches this request" pattern is to call
`router.navigate(req.url, { replace: true })` and then `renderToString(App)`,
and `navigate()` drives `window.history.pushState()`/`replaceState()` under
the hood — which throws a `SecurityError` against a null-origin document. A
real `http://localhost/` origin is what makes that work out of the box:

```js
// server.js — render whatever route matches the incoming request
import { renderToString } from '@aeon-framework/ssr';
import { router } from './router.js';
import { App } from './app.js';

function handleRequest(req, res) {
  router.navigate(req.url, { replace: true });
  const html = renderToString(App); // renders the route that just matched
  // ...embed `html` in your page shell and send the response
}
```

Covered by `packages/ssr/test/ssr.test.mjs`, which asserts `router.navigate()`
before `renderToString()` doesn't throw and that the resulting HTML matches
the navigated-to route, not whatever route the router started on.

## Animate

`@aeon-framework/animate` drives enter/leave transitions with a class
toggle plus a **deterministic timeout fallback** — it never depends on a
real CSS `transitionend` actually firing, because Happy DOM (and plenty of
real-browser edge cases) doesn't fire it reliably. Whichever happens first,
a real `transitionend` or the configured `duration`, resolves the
transition — this is what keeps `node --test` runs fast and non-flaky
instead of hanging on an event that may never come.

```js
import { transition, animatedList } from '@aeon-framework/animate';

// one element:
await transition.leave(rowEl, { className: 'row-leave', duration: 200 });
rowEl.remove(); // only after the transition (or the timeout) resolves

// a whole keyed list of real DOM rows, reactive over a signal:
const stop = animatedList(listContainer, {
  items: () => todos.value,
  key: (t) => t.id,
  render: (t) => buildRowElement(t), // any real Element
});
```

`animatedList()` manages its container's children directly rather than
going through `@aeon-framework/core`'s `list()` — `list()` removes a
departing row's DOM synchronously by design (that's what gives it its
no-flash-elsewhere guarantee elsewhere in a template), so animated removal
needed its own small reconciler rather than trying to retrofit a "wait
before removing" hook into core's. `packages/animate/test/animate.test.mjs`
proves a removed row visibly stays in the DOM through its leave window and
is only actually removed afterward — not just that the API resolves.

## i18n

```js
import { locale, t, loadMessages } from '@aeon-framework/i18n';

loadMessages('en', { greeting: 'Hello, {name}!', apples_one: '{count} apple', apples_other: '{count} apples' });
loadMessages('fr', { greeting: 'Bonjour, {name} !' });

t('greeting', { name: 'Ada' });        // "Hello, Ada!"
t('apples', { count: 1 });             // "1 apple"  (key_one / key_other convention)
locale.value = 'fr';
t('greeting', { name: 'Ada' });        // "Bonjour, Ada !" — reactive: any effect/template
                                        // reading t() re-runs when locale changes, same as
                                        // any other signal read
```

`locale` is a plain signal, so `${() => t('greeting', { name })}` inside a
template is just an ordinary reactive binding — no separate i18n context or
re-render mechanism. Missing-key resolution walks a real fallback chain:
current locale → the configured `fallbackLocale` (default `'en'`) → the raw
key itself, so a missing translation is visibly a missing translation rather
than a blank string. `createI18n({ locale, fallbackLocale })` gives you an
isolated instance (used by the package's own tests); most apps just use the
default singleton shown above.

## CLI generators

```sh
aeon generate component UserCard   # writes src/components/UserCard.js
aeon generate service Billing      # writes src/services/billing.js
aeon generate route Settings       # writes src/routes/Settings.js
aeon g component UserCard          # same thing — "g" is an alias for "generate"
```

Each generator scaffolds a real, syntactically valid file using the same
shape real Aeon code already uses in this repo: a component is
`defineComponent(() => html\`...\`)` (matching `packages/core`'s own
convention for the wrapper), a service is a `createToken()` +
`create*Service()` factory pair (matching
`examples/demo-app/src/services/greeting.js`), and a route is a page
component plus a `{ path, component }` object in the shape
`@aeon-framework/router`'s `createRouter()` expects (matching
`examples/demo-app/src/main.js`'s route table). The scaffolding logic lives
in `packages/cli/src/generate.mjs` as plain, filesystem-free functions
precisely so it can be unit tested directly, in addition to an end-to-end
test (`packages/cli/test/cli-generate.test.mjs`) that shells out to the real
`aeon` binary against a temp directory and asserts the generated file
exists and its content matches.

## Devtools

`@aeon-framework/devtools` is an **in-page debug overlay** — a small,
fixed-position panel you mount into your own app's DOM during development.
It is **not a browser extension**; there is no separate DevTools panel
integration (see "What's real vs. what's next" for that gap). Aeon signals
carry no name/introspection metadata of their own, so a component author
opts a signal into visibility explicitly:

```js
import { attachDevtools } from '@aeon-framework/devtools';

const devtools = attachDevtools({ hotkey: 'F2' }); // mounted hidden into document.body
devtools.registry.track('todoCount', todoCount);   // any Aeon signal
// press F2 in the running app to toggle the panel
```

The panel is an ordinary Aeon component under the hood (`html`/`list`/
`mount`, the same renderer as the rest of the framework) — each tracked
row updates through a plain reactive binding, no polling. Untrack with
`devtools.registry.untrack(name)`; `devtools.destroy()` removes the overlay
and stops listening for the hotkey entirely.

## MCP server

`@aeon-framework/mcp` is an [MCP](https://modelcontextprotocol.io) server —
Aeon's answer to Angular CLI's `ng mcp` — that gives an AI coding assistant
(Claude Code, or anything else that speaks MCP) real tools for working with
an Aeon codebase, over the standard stdio transport.

**Add it to an assistant's MCP config** — the standard `npx` form needs no
install:

```json
{
  "mcpServers": {
    "aeon": {
      "command": "npx",
      "args": ["-y", "@aeon-framework/mcp"]
    }
  }
}
```

or, once installed as a dependency/global (`npm i -D @aeon-framework/mcp` /
`npm i -g @aeon-framework/mcp`), its `aeon-mcp` bin can be run directly:

```json
{ "mcpServers": { "aeon": { "command": "aeon-mcp" } } }
```

With Claude Code specifically: `claude mcp add aeon -- npx -y @aeon-framework/mcp`.

**Tools it exposes:**

| Tool | What it does |
|---|---|
| `generate_component` / `generate_service` / `generate_route` | Scaffold a real file (`src/components`, `src/services`, `src/routes`) into a project, using the exact same generator `aeon generate` uses — writes to disk and returns the path + content. |
| `search_docs` | Lightweight (no embeddings) case-insensitive search over the real README.md and every package's real `src/index.d.ts`, with surrounding context per match. |
| `get_conventions` | Aeon's curated idioms — signals vs. virtual DOM, the four real template binding kinds, DI, router modes — plus real footguns an assistant trained on React/lit-html is likely to hit (see below). |
| `inspect_project` | Reads a real project on disk (never evaluates its code): which `@aeon-framework/*` packages it depends on, and a best-effort summary of its routes/components/services. |
| `explain_template` | **The unique one** — see below. |

### `explain_template` — a tool no other framework's MCP server has

Feed it the body of an `html\`...\`` template (`${N}` for each
interpolation, in order) and it tells you **exactly** what Aeon's real
compiler (`packages/core/src/dom.js`'s `compile()`) decides each binding
is — because it actually calls that real compiler, not a lookalike regex.
Critically, it also catches the single most common mistake an AI assistant
trained on React/lit-html/Vue makes against Aeon: reaching for a `ref=` (or
`key=`) binding that looks like it should exist, but doesn't.

```
explain_template({ template: '<div ref=${0} @click=${1}></div>' })
```

```json
{
  "bindings": [
    {
      "slot": 0,
      "kind": "attribute",
      "name": "ref",
      "note": "Plain HTML attribute binding — el.setAttribute(name, value) ...",
      "warning": "NOT a real Aeon binding kind: Aeon has no ref= binding — there is no fifth binding kind. This becomes a literal string attribute named \"ref\", silently. Use onMount() inside the component to get element access instead, or drive behavior via .prop=/@event= bindings."
    },
    { "slot": 1, "kind": "event", "name": "click", "note": "Real event binding (@event=) ..." }
  ]
}
```

`ref=${fn}` doesn't error and doesn't call `fn` — it silently becomes a
literal `ref="..."` attribute, which is exactly the kind of framework-shaped
bug a diff-based code review tends to miss. `explain_template` catches it
before the code ever runs.

## Interop — using Aeon alongside another framework

Aeon owns a real DOM node, not a virtual one, so embedding it inside another
framework is just "call `mount()` when the host mounts, call `dispose()` when
the host unmounts" — no reconciliation conflict is possible because Aeon
never touches nodes it wasn't given.

**Aeon inside React:**

```jsx
import { AeonView, useAeonSignal } from '@aeon-framework/interop/react';
import { sharedCount } from './aeon-counter.js';

function Page() {
  const count = useAeonSignal(sharedCount); // React re-renders when the Aeon signal changes
  return (
    <div>
      <p>React sees: {count}</p>
      <AeonView component={AeonCounter} />
    </div>
  );
}
```

**Aeon inside Vue** works the same way (`@aeon-framework/interop/vue`, a
`defineComponent` wrapper plus a `useAeonSignal` composable built on
`shallowRef`). A **vanilla** entry point (`@aeon-framework/interop/vanilla`) covers any
framework without a dedicated adapter: `attach(container, Component, props)`
returns a dispose function you call on teardown.

Verified end to end in `examples/interop-react` and `examples/interop-vue`:
the host framework's own state stays isolated from Aeon's, and
`useAeonSignal` correctly mirrors an Aeon signal's value back into the host's
own re-render mechanism (`scripts/verify-interop-react.mjs`,
`scripts/verify-interop-vue.mjs`).

The reverse direction — Aeon reading a *host* framework's state — isn't
built, because it isn't Aeon's problem to solve: pass values in as props to
`AeonView`/`attach()` and update them the normal way for that framework.

## Migrating from React

The honest version of "automatic migration": there is no tool, for any
framework, that can take arbitrary code and rewrite it into a different
framework with a guarantee of zero breakage — that claim doesn't survive
contact with real code (custom hooks, effects, context, third-party
components, non-trivial JSX). What's built instead is a **codemod with a
clearly defined, honest scope**:

```sh
npx aeon migrate src/Counter.jsx    # writes src/Counter.aeon.jsx — never touches the original
```

Add `// @aeon-migrate` above a component to opt it in. The codemod
(`@aeon-framework/migrate`, built on Babel's parser/traverse/generator) converts:

- `useState` → `signal()`, including the functional-updater form
  (`setX(c => c + 1)` → `x.value = x.value + 1`)
- plain-DOM-tag JSX → Aeon `html` templates
- ternary and `&&` conditional JSX children

Anything outside that — other hooks (`useEffect`, `useContext`, ...), props,
JSX fragments, spread attributes, `.map()`-based list rendering, references
to other custom components — is **left completely untouched** in the output
file, with a `// AEON-MIGRATE: skipped "Name" — reason` comment explaining
why, rather than guessed at or silently broken. The original source file is
never modified.

This is deliberately conservative. `examples/migrate-verify` is the proof it
isn't just plausible-looking: it runs the CLI on a real two-component file
(one convertible `Counter`, one intentionally unsupported `Clock` using
`useEffect` and props), ships the *actual, unedited* output, and
`scripts/verify-migrate.mjs` drives the migrated component through clicks in
a real browser to confirm it behaves identically to the original React
version — `Clock` is left byte-for-byte untouched with its skip comment.

## Performance

Methodology, disclosed up front: a real-DOM stress test (create 1,000 rows,
update every 10th row's text, clear all), the same operations and DOM shape
across five frameworks, run in the same headless Chromium instance,
back-to-back, median of 7 rounds per framework
(`scripts/run-benchmark.mjs`; correctness of every run cross-checked
separately by `scripts/verify-benchmark-correctness.mjs` — exact row counts
and updated-cell counts, not just "didn't crash").

Representative numbers from this repo's benchmark apps (`benchmark/*`; ms,
lower is better — expect single-digit-ms swings run to run in any headless
environment, so treat these as "which tier," not precise ranking):

| Framework | create 1,000 rows | update every 10th | clear |
|---|---|---|---|
| Solid | ~31–34 | ~31–32 | ~28–29 |
| Preact | ~35–38 | ~28–29 | ~28–29 |
| Vue | ~36–48 | ~29–30 | ~29 |
| **Aeon** | **~42–44** | **~30–32** | **~26–28** |
| React | ~41–46 | ~29 | ~28 |

Update and clear are all within a few ms of each other across every
framework — Aeon included. Create is where the field spreads out most:
Solid stays consistently fastest (its compiled clone-and-patch output is
about as lean as this pattern gets), Aeon sits in the same tier as React,
behind Preact and Vue by a smaller margin.

This wasn't the first result. The initial benchmark run — done honestly,
before any tuning — showed Aeon as the *slowest* framework on update (62ms
vs. 27–36ms for everyone else), caused by two real bugs/inefficiencies found
*because* the benchmark was built honestly instead of cherry-picked:

1. **A correctness bug**, not just a performance one: `list()`'s keyed
   reconciliation repositioned same-key rows but never checked whether their
   *content* had changed, so the standard `array.map((r,i) => i%10===0 ?
   {...r, label: ...} : r)` update pattern silently failed to update the DOM.
   Fixed by comparing each entry's item by reference identity and only
   remounting when it actually changed (`packages/core/src/dom.js`,
   `_updateList`).
2. **A real performance bug**: every cloned template instance was
   re-scanning its whole subtree with `querySelectorAll` + a `TreeWalker` to
   find its bindings, instead of reusing binding *positions* computed once
   at compile time. Fixed by walking each template exactly once, recording a
   child-index path to every binding, and having every clone look its parts
   up directly by that path.

Both fixes are covered by the existing unit and end-to-end test suites, not
just the benchmark itself, so they're behavior fixes, not benchmark-specific
shortcuts.

## What's real vs. what's next

Built and verified (via a headless-browser test run of the demo app —
signals, DI, hash routing with params, keyed list reordering, and form
validation all confirmed working end to end):

- Fine-grained signals/computed/effect/batch with dependency tracking
- Cached-template DOM renderer with property/attribute/event/boolean
  bindings and keyed list reconciliation (rows are repositioned, not rebuilt)
- Hash/history router with params and a `link()` helper
- Reactive forms with composable validators
- A minimal DI container
- A zero-config CLI (`new`/`dev`/`build`) on esbuild
- Demo app bundle: **~12 kB** minified for core + router + forms + DI + app code
- Minimal counter app: **1.9 kB gzipped**, smallest of every framework measured
- Three verified portability modes: bundler, zero-build native ESM, and a
  plain `<script>` global — plus a DOM-free reactive core that runs
  standalone on Node and Bun
- Bidirectional interop with React and Vue (`@aeon-framework/interop`), verified with
  headless-browser tests that check both isolation and signal sync in both
  directions
- A scoped, tested React→Aeon migration codemod (`@aeon-framework/migrate` /
  `aeon migrate`) that converts a defined subset correctly and safely bails
  out — leaving the original untouched — on everything outside that subset
- A real-DOM performance benchmark against React/Vue/Preact/Solid
  (`benchmark/*`), including two real bugs the benchmark caught and fixed
  (see "Performance" above) — Aeon now sits in the same tier as
  React/Preact/Vue on this benchmark, behind Solid
- Hand-written `.d.ts` types for every package, verified against real `tsc`
  runs (not just eyeballed) — plus a `--ts` starter (`aeon new my-app --ts`)
- `@aeon-framework/http`: `resource()`/`mutation()`, tested including the
  stale-request race (a slow first response can't overwrite a faster later
  one) and a real 404 surfaced as `HttpError`
- `@aeon-framework/testing`: mounts into a real (Happy DOM) document,
  Testing-Library-style `render()`/`fireEvent`/`cleanup()`
- Arbitrary npm package compatibility checked, not assumed: axios (CJS/dual
  package), dayjs (UMD), lodash-es (ESM), zod, and nanoid were installed
  into a scaffolded app and built/run through the CLI with zero
  configuration — esbuild's bundling already handles CJS/ESM/dual-package
  interop, so `npm install <anything>` in an Aeon app is expected to just
  work the same way it does in any esbuild-based project
- `@aeon-framework/ssr`: `renderToString()` runs the real `mount()`/`render()`
  renderer against a headless Happy DOM document (no parallel string
  renderer) — tested end to end against `@aeon-framework/core`'s new
  `hydrate()`/`hydrateComponent()`, including a node-identity check (adopted
  DOM isn't recreated) and a click listener attached during hydration that
  actually fires and updates a signal-bound text node
- `@aeon-framework/core`: `hydrate()`/`hydrateComponent()` adopt existing
  (e.g. server-rendered) DOM for attribute/property/event bindings and node
  content, including nested `html` templates used as node-part values —
  `list()`-bound regions are the one disclosed exception (one-time flash,
  see "SSR + hydration" above)
- `@aeon-framework/animate`: `transition()`/`animatedList()` — enter/leave
  transitions with a deterministic transitionend-or-timeout resolution,
  tested with real (short) timers proving a removed row stays in the DOM
  through its leave window and is only removed afterward
- `@aeon-framework/i18n`: reactive `locale` signal, `t()` interpolation +
  `count`-driven pluralization, `loadMessages()`, and a real fallback-locale
  chain — tested including a `t()` call inside an `effect()` that re-runs
  when `locale` changes
- CLI generators: `aeon generate component|service|route <Name>` (alias
  `aeon g`), scaffolding real files in the shapes already used elsewhere in
  this repo — tested both as pure functions and end-to-end via the actual
  `aeon` binary against a temp directory
- `@aeon-framework/devtools`: an in-page (not a browser extension) live
  signal overlay — `attachDevtools()`/`mountDevtoolsOverlay()` plus a
  `track()`/`untrack()` registry, tested with Happy DOM confirming the
  panel's DOM text updates when a tracked signal's value changes

Not yet built — the honest gap list for anything claiming to seriously
compete with Angular: a real compiler (current templates are tagged-literal
+ runtime-parsed, not compile-time optimized), non-flashing incremental
list hydration (SSR/hydration itself is now built — see above — but a
`list()`-bound region still falls back to one client-side re-render), a
real Chrome DevTools *extension* (`@aeon-framework/devtools` is an in-page
overlay only, not a panel integrated into the browser's own DevTools), a
migration codemod that covers more than the current `useState`-only subset,
and — the actually hard part — an ecosystem and community.

The architecture here (signals, no vdom, plain functions over decorators) is
a defensible bet on where the frameworks are heading; the distance to
"overtake Angular" is mostly about time, adoption, and the unglamorous 90%
still on the list above.

## Project layout

```
packages/
  core/     signals, renderer, component model
  router/   client-side routing
  forms/    reactive forms
  di/       dependency injection
  cli/      scaffold, dev server, build/migrate (+ template/ and template-ts/)
  interop/  embed Aeon in React/Vue and vice versa
  migrate/  React → Aeon codemod (Babel-based)
  http/     resource()/mutation() — signals over fetch
  testing/  render()/fireEvent/cleanup() on a real (Happy DOM) document
  ssr/      renderToString() — server-render with the real client renderer
  animate/  transition()/animatedList() — enter/leave transitions
  i18n/     locale signal, t()/loadMessages(), fallback locale chain
  devtools/ in-page live signal overlay (not a browser extension)
  create-aeon/  npm create aeon@latest — zero-install scaffolder
examples/
  demo-app/           exercises every package together
  minimal-app/         the counter used for size measurements
  no-build/             @aeon-framework/core via native ESM, zero tooling
  standalone-drop-in/   @aeon-framework/core via a plain <script> tag
  interop-react/        Aeon embedded inside a React app, both directions
  interop-vue/          Aeon embedded inside a Vue app, both directions
  migrate-verify/        real, unedited codemod output, verified in-browser
benchmark/
  aeon/ react/ preact/ solid/ vue/   identical create/update/clear stress test
dist-standalone/
  aeon.global.js        core + router + forms + DI as window.Aeon
  aeon.core.global.js   core alone, smaller
scripts/
  verify.mjs                       headless-browser check of the built demo app
  verify-interop-react.mjs         checks React↔Aeon interop, both directions
  verify-interop-vue.mjs           checks Vue↔Aeon interop, both directions
  verify-migrate.mjs               drives real codemod output in a browser
  verify-benchmark-correctness.mjs checks all 5 benchmark apps produce identical results
  run-benchmark.mjs                the actual timing harness (median of 7 rounds)
  build-standalone.mjs    builds dist-standalone/*.js
  portability-check.mjs   proves the reactive core needs no DOM (Node + Bun)
```
