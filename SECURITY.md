# Security Policy

## Supported versions

Aeon is pre-1.0 (see [VERSIONING.md](./VERSIONING.md)). Until 1.0, security
fixes land on the latest `0.x` release of each affected package — there is no
parallel backport branch yet. After 1.0, this section will list which major
versions receive security patches and for how long.

| Package                    | Supported          |
| --------------------------- | ------------------- |
| All `@aeon-framework/*` packages, latest published version | ✅ |
| Anything older than latest  | ❌ (please upgrade first) |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**
A public issue gives attackers a head start before a fix ships.

Instead, report privately using GitHub's built-in advisory flow:

1. Go to the [Security tab](https://github.com/Aeon-framework/aeon/security) of the `Aeon-framework/aeon` repository.
2. Click **"Report a vulnerability"**.
3. Include as much of the following as you can:
   - Which package(s) and version(s) are affected.
   - A minimal reproduction (a code snippet or a small repo is ideal).
   - The impact you believe it has (e.g. XSS via unescaped template
     interpolation, prototype pollution, SSRF in a fetch helper, arbitrary
     code execution via the CLI or codemods).
   - Whether you're aware of it being exploited in the wild.

If GitHub Security Advisories aren't available to you for some reason, open a
regular issue titled only "Security contact needed" with no details, and a
maintainer will follow up with a private channel.

## What to expect

- **Acknowledgement:** within 3 business days.
- **Triage:** we'll confirm whether it's a real vulnerability, its severity,
  and which packages/versions are affected, within 7 days of acknowledgement.
- **Fix & disclosure:** for confirmed vulnerabilities, we aim to ship a patch
  and publish a GitHub Security Advisory (with credit to the reporter, unless
  you prefer to stay anonymous) as soon as a fix is ready — critical issues
  are prioritized over everything else in the backlog. We'll coordinate a
  disclosure timeline with you rather than unilaterally setting one.

## Scope

In scope: any `@aeon-framework/*` package published from this monorepo
(`core`, `router`, `forms`, `di`, `http`, `i18n`, `animate`, `ssr`, `ssg`,
`cli`, `compiler`, `interop`, `migrate`, `testing`, `devtools`, `mcp`,
`create-aeon`), and the `aeon-framework.github.io` site's build/deploy
pipeline itself.

Out of scope: vulnerabilities in third-party dependencies (please report
those upstream — though we do want to know if Aeon is misusing a dependency
in a way that creates a vulnerability), and social engineering / physical
attacks against maintainers.

## A note on the AOT compiler and codemods

`@aeon-framework/compiler` and `@aeon-framework/migrate` both parse and
transform your source code at build time. A bug there that causes incorrect
*or unsafe* code generation (e.g. losing an escaping boundary) is treated as
a security issue, not just a correctness bug — please report it through this
same process rather than as a regular bug.
