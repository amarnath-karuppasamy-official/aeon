# Versioning policy

## Where we are

Every `@aeon-framework/*` package is currently pre-1.0 (`0.x`). Per
[semver](https://semver.org/), that means breaking changes can land in a
minor bump (`0.1.x` → `0.2.0`), and we do use that room while the API surface
is still settling — this is a deliberate, temporary trade-off in exchange for
being able to fix design mistakes quickly while adoption is still small,
rather than carrying them forward.

That said: every 0.x package here already gets *patch* releases for bug
fixes without breaking anything, and we treat "breaking on a minor bump"
as something to use sparingly, not casually — each package's changelog
entry says explicitly when a release contains a breaking change and what
migrating looks like.

## What 1.0 means

Aeon reaches 1.0, package by package, once:

1. **The public API is one we're willing to commit to.** Not "probably
   final" — actually final enough that we'd rather add a new API alongside
   an old one than break the old one.
2. **Test coverage includes the real failure modes**, not just the happy
   path — every package should have both unit tests (`node --test`, real
   `happy-dom`) and, for anything DOM-rendering-related, a real-browser test
   (see `.github/workflows/browser-tests.yml`) exercising the same code path
   a real user's browser would take, including HTML-parser normalization
   quirks (attribute casing, whitespace, self-closing tags) that a mocked
   DOM won't reproduce.
3. **CI is green on every supported Node version** and has been for a
   meaningful stretch, not just at the moment of tagging.
4. **There's a real migration guide** for anyone moving off the last 0.x
   release, if 1.0 changes anything from the final 0.x API.

`@aeon-framework/core` reaching 1.0 is the one that matters most — the other
packages can follow at their own pace once their own APIs are stable, and a
1.0 `core` does not require every other package to also be at 1.0
simultaneously.

## After 1.0: what you can rely on

Once a package is at 1.0:

- **No breaking changes without a major version bump.** A "breaking change"
  includes: removing or renaming a public export, changing a function's
  argument order or return shape, changing default behavior in a way that
  changes existing output, and dropping support for a previously-supported
  Node version.
- **Deprecation before removal.** Where practical, a feature scheduled for
  removal gets at least one minor release emitting a deprecation warning
  (`console.warn`, once, from `aeon check`/build tooling, or in the
  package's own runtime) before it's actually removed in the next major.
- **Security patches land on the latest major**, and — once there's more
  than one supported major in the wild — on any major still within its
  support window (this policy will be filled in with concrete version
  numbers once 1.0 ships and there's a second major to support).
- **A CHANGELOG entry for every release**, in each package, describing what
  changed and why, with explicit call-outs for anything breaking.

## Node.js support

Aeon supports Node.js versions still receiving upstream security support
(currently: active LTS and current release lines — see `engines` in each
package's `package.json`, kept in sync with `.github/workflows/ci.yml`'s test
matrix). Dropping support for an EOL Node version is not treated as a
breaking change requiring a major bump, but will always be called out in that
release's notes.

## Questions about a specific package's stability

If you're unsure whether a specific export is stable enough to build on, ask
in a [Discussion](https://github.com/Aeon-framework/aeon/discussions) — the
answer is often "yes, that one's solid" even inside an overall 0.x package,
since some corners of the API (like `signal`/`computed`/`effect` in `core`)
have been stable in practice for a while even though the package as a whole
hasn't formally reached 1.0 yet.
