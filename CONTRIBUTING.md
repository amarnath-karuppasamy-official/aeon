# Contributing to Aeon

Thanks for considering a contribution — this is genuinely how Aeon gets
better. This doc covers how the repo is laid out, how to run things locally,
and what we expect from a pull request.

Please also read the [Code of Conduct](./CODE_OF_CONDUCT.md) — it applies
everywhere in this project's spaces.

## Repository layout

This is an npm workspaces monorepo:

- `packages/*` — every published `@aeon-framework/*` package (`core`,
  `router`, `forms`, `di`, `http`, `i18n`, `animate`, `ssr`, `ssg`, `cli`,
  `compiler`, `interop`, `migrate`, `testing`, `devtools`, `mcp`) plus
  `create-aeon`.
- `examples/*` — small real apps exercising specific features (interop,
  no-build usage, a minimal app, a standalone drop-in bundle).
- `benchmark/*` — a real, reproducible benchmark comparing Aeon against
  React/Vue/Preact/Solid on the same create/update/clear workload in the same
  headless Chromium. Correctness is verified separately from timing — see
  `scripts/verify-benchmark-correctness.mjs` — trust a timing number only
  alongside a passing correctness check.
- `site/` — the docs + landing site at https://aeon-framework.github.io/,
  itself a real Aeon app built and prerendered with Aeon's own tooling
  (we dogfood the framework for our own site — if it's awkward to build,
  that's a bug).
- `scripts/` — verification and build tooling used in CI and locally.
- `tools/vscode-aeon` — the VS Code extension.

## Getting set up

```sh
git clone https://github.com/Aeon-framework/aeon.git
cd aeon
npm install --workspaces --include-workspace-root
```

Node 18+ is required (see `engines` in `package.json`).

## Running things locally

```sh
npm test                    # every package's test suite (node --test, real happy-dom)
npm run portability-check   # proves core's reactivity has zero DOM dependency
npm run build                # builds every package/example that has a build script
npm run demo                 # runs the demo app's dev server
npm run site:dev             # runs the docs/landing site's dev server
npm run site:prerender       # prerenders the site to static HTML
npm run site:verify          # boots the prerendered site in real headless Chromium and checks it
```

Every PR's CI run does the equivalent of `npm test` plus `npm run
portability-check` plus a real build, across the Node versions in
`.github/workflows/ci.yml`. If those pass locally, CI should pass too.

## Before you open a PR

1. **Add a test that fails without your fix, then passes with it.** For a bug
   fix, this means literally reverting your change locally and confirming the
   new test catches it — "I fixed it" and "I proved it was broken and now
   isn't" are different claims, and we want the second one. For DOM/rendering
   behavior specifically, prefer testing through the real compiled template
   path (`html\`...\`` + `render`/`hydrate`) over mocking internals, and if
   your change touches anything the DOM parser could normalize differently
   than you expect (attribute casing, whitespace, self-closing tags), don't
   assume — check it in a real parser. That exact class of bug (an
   `.innerHTML=`-style property binding silently becoming a no-op because
   HTML parsing lowercases attribute names) has shipped to production once
   already; more coverage here is always welcome.
2. **Keep the change scoped.** Small, focused PRs get reviewed faster than
   ones that mix a fix with a refactor with a new feature.
3. **Update docs/types alongside behavior.** If you change a public API,
   update the corresponding `.d.ts`, `README.md` section, and/or `site/src/pages/docs/*`
   page in the same PR.
4. **Don't bump versions or publish yourself** — a maintainer handles version
   bumps and npm publishing as part of merging/releasing.

## Commit and PR conventions

- Commit messages: a short imperative summary line, then (for anything
  non-trivial) a body explaining *why*, not just *what* — the diff already
  shows what changed.
- PRs: fill in the PR template. Link the issue it fixes/closes, if any.
- One logical change per PR where reasonably possible.

## Design principles to keep in mind

Aeon has a few opinions baked into its design that PRs should respect:

- **No virtual DOM.** Templates compile once; signals bind directly to the
  DOM nodes/attributes/properties they control. Don't introduce diffing.
- **Plain functions over ceremony.** No decorators, no `NgModule`-style
  registration, no `reflect-metadata`. Components, DI tokens, and providers
  are plain functions/objects.
- **Function = reactive, plain value = static.** A binding's reactivity is
  inferred from whether the interpolated value is a function
  (`${() => sig.value}`) or a plain value (`${staticString}`) — don't add a
  second, inconsistent way to opt into reactivity.
- **SSR/SSG run the real client renderer**, not a parallel string-based
  renderer. `renderToString()` runs actual `render()` against a headless DOM.
  Keep it that way — a second renderer is a second place for bugs to diverge.
- **Honesty over marketing in docs and benchmark claims.** If something is
  "not yet implemented" or "a known limitation," say so directly in the docs
  rather than glossing over it. The `site/`'s own docs already do this
  ("what's real vs. what's next") — keep that standard.

## Reporting bugs / requesting features

Please use the issue templates (`.github/ISSUE_TEMPLATE/`) rather than a
blank issue — they ask for exactly the information that speeds up triage
(repro, expected vs. actual, Aeon/Node version).

**Security vulnerabilities:** do not open a public issue — see
[SECURITY.md](./SECURITY.md) instead.

## Questions

Open a [Discussion](https://github.com/Aeon-framework/aeon/discussions)
rather than an issue for open-ended questions, "how do I..." usage
questions, or design proposals that aren't yet a concrete bug/feature ask.
