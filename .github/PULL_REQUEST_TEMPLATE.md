## What does this change?

<!-- A short description of the change and why it's needed. -->

## Related issue(s)

<!-- Closes #123, or "N/A" -->

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (fix or feature that would change existing behavior — see [VERSIONING.md](../VERSIONING.md))
- [ ] Documentation only
- [ ] Tooling / CI

## Checklist

- [ ] I added a test that fails without this change and passes with it (for
      a bug fix, I confirmed this by reverting my fix locally and seeing the
      test fail — see [CONTRIBUTING.md](../CONTRIBUTING.md)).
- [ ] `npm test` passes locally.
- [ ] `npm run portability-check` passes locally (only relevant if you
      touched `packages/core/src/signal.js`).
- [ ] I updated the relevant `.d.ts` file(s) if this changes a public API.
- [ ] I updated `README.md` / `site/src/pages/docs/*` if this changes
      documented behavior.
- [ ] This is not a version bump or npm publish — those are handled by a
      maintainer as part of merging/releasing.

## Anything else reviewers should know?

<!-- Design trade-offs, things you're unsure about, follow-up work you're deliberately leaving out of scope. -->
