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
- **No required build step for the framework itself.** `@aeon/core` is
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

1. **npm + bundler** (the normal path) — `@aeon/core` has zero runtime
   dependencies and `"sideEffects": false`, so a bundler tree-shakes away
   whatever you don't import.
2. **No build step at all** — `examples/no-build/index.html` imports
   `@aeon/core` straight from its source files with a plain
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
| `@aeon/core` | `signal`, `computed`, `effect`, `batch`, the `html` template tag, `render`, `list` (keyed lists), `mount`, `onMount`/`onCleanup` |
| `@aeon/router` | `createRouter`, hash or history mode, params, `outlet`, `link` |
| `@aeon/forms` | `control`, `group`, composable `validators` |
| `@aeon/di` | `createToken`, `provide`, `inject`, scoped `Container` |
| `@aeon/cli` | `aeon new / dev / build / migrate` — esbuild-powered, zero config |
| `@aeon/interop` | Embed Aeon inside React/Vue (and vice versa) — `AeonView`, `useAeonSignal` |
| `@aeon/migrate` | Codemod: converts a defined subset of React function components to Aeon |

## Quickstart

```sh
npm install
node packages/cli/bin/aeon.mjs new my-app
cd my-app && npm install
npx aeon dev .      # dev server with live rebuild
npx aeon build .     # production bundle to dist/
```

Or run the included demo app (counter, DI-provided service, hash router with
route params, keyed list reconciliation, reactive form validation):

```sh
npm run demo         # aeon dev examples/demo-app
```

## A component

```js
import { html, signal, mount } from '@aeon/core';

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
import { createRouter, outlet, link } from '@aeon/router';

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

## Forms

```js
import { control, group, validators } from '@aeon/forms';

const form = group({
  email: control('', [validators.required(), validators.email()]),
});

// form.controls.email.value / .errors / .touched / .valid are all signals —
// bind them directly in a template, no separate "form state" object.
```

## DI

```js
import { createToken, provide, inject } from '@aeon/di';

const Logger = createToken('Logger');
provide(Logger, () => ({ log: (msg) => console.log(msg) }));

// anywhere downstream:
const logger = inject(Logger);
```

## Interop — using Aeon alongside another framework

Aeon owns a real DOM node, not a virtual one, so embedding it inside another
framework is just "call `mount()` when the host mounts, call `dispose()` when
the host unmounts" — no reconciliation conflict is possible because Aeon
never touches nodes it wasn't given.

**Aeon inside React:**

```jsx
import { AeonView, useAeonSignal } from '@aeon/interop/react';
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

**Aeon inside Vue** works the same way (`@aeon/interop/vue`, a
`defineComponent` wrapper plus a `useAeonSignal` composable built on
`shallowRef`). A **vanilla** entry point (`@aeon/interop/vanilla`) covers any
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
(`@aeon/migrate`, built on Babel's parser/traverse/generator) converts:

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
- Bidirectional interop with React and Vue (`@aeon/interop`), verified with
  headless-browser tests that check both isolation and signal sync in both
  directions
- A scoped, tested React→Aeon migration codemod (`@aeon/migrate` /
  `aeon migrate`) that converts a defined subset correctly and safely bails
  out — leaving the original untouched — on everything outside that subset
- A real-DOM performance benchmark against React/Vue/Preact/Solid
  (`benchmark/*`), including two real bugs the benchmark caught and fixed
  (see "Performance" above) — Aeon now sits in the same tier as
  React/Preact/Vue on this benchmark, behind Solid

Not yet built — the honest gap list for anything claiming to seriously
compete with Angular: SSR/hydration, a real compiler (current templates are
tagged-literal + runtime-parsed, not compile-time optimized), TypeScript
types, animations, HTTP client, CLI code generators, testing utilities,
devtools, i18n, a migration codemod that covers more than the current
`useState`-only subset, and — the actually hard part — an ecosystem and
community.

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
  cli/      scaffold, dev server, build/migrate (+ starter template/)
  interop/  embed Aeon in React/Vue and vice versa
  migrate/  React → Aeon codemod (Babel-based)
examples/
  demo-app/           exercises every package together
  minimal-app/         the counter used for size measurements
  no-build/             @aeon/core via native ESM, zero tooling
  standalone-drop-in/   @aeon/core via a plain <script> tag
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
