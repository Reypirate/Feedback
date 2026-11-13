# CI and dependency updates

[Documentation index](README.md)

## Checks

The `CI / CD` workflow calls the reusable validation workflows on pushes to `main` and
on pull requests. Each check runs independently,
so a secret-scanner failure does not prevent tests from running. Manual runs are available
through `workflow_dispatch`. Security checks also run every Monday at 06:00 UTC.

| Workflow          | Check                          | What it verifies                                                                       |
| ----------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| Security Checks   | CodeQL (javascript-typescript) | JavaScript and TypeScript security analysis, uploaded to code scanning                 |
| Security Checks   | Dependency audit               | `pnpm audit` against the complete frozen dependency graph, including development tools |
| Security Checks   | Gitleaks                       | Secrets in Git history, with PR read access and commenting disabled                    |
| Code Quality      | Lint, type check, and build    | Formatting, oxlint, TypeScript, migration history/schema drift, and production builds  |
| Unit Tests        | Unit tests                     | Workspace Vitest suites, including API HTTP tests and frontend jsdom tests             |
| Integration Tests | Integration tests              | Committed migrations and actual Better Auth/PostgreSQL flows in isolated databases     |
| Build             | Production build               | Both application bundles, uploaded as the `production-build` artifact                  |
| E2E Tests         | E2E tests                      | Production build and Chromium smoke tests; reports/traces upload on failure            |
| Vercel Services   | Multi-service routing          | API paths, SPA links, runtime settings and frontend assets through Vercel dev          |
| Release Please    | release-please                 | Maintains a release PR and publishes the GitHub release after that PR is merged        |

Application jobs share `.github/actions/setup/action.yml`: Node 22.23.3, Bun 1.3.13, pnpm
from the root `packageManager` field, a pnpm store cache, and a frozen lockfile install.
Third-party actions use immutable commit SHAs with version comments; Dependabot monitors
the workflows and the composite action. No application credentials are needed for tests.

jsdom 30 requires Node `^22.22.2 || ^24.15.0 || >=26.0.0`. The package engine range and
development setup follow those requirements. CI and Docker build stages use Node 22.23.3;
the container server runs on Bun and Vercel's Hono service runs on Node.js 24.

The integration and browser workflows each own a PostgreSQL 17 service and use isolated
test databases. Browser tests cover form submission, consent validation, Google login
availability and provisioned EXCO access without contacting Google's OAuth service.

The migration-history check supplies a placeholder `DATABASE_URL` because Drizzle requires
connection settings when loading its configuration. History and schema-drift checks work
offline and do not need a PostgreSQL service or a developer's `.env`.

Code Quality retains a build to check the whole workspace together. Build separately retains
downloadable production outputs; E2E builds the exact checkout it will serve in Chromium.

## GitHub setup

The deployment job waits for every validation workflow, including a Vercel Services
routing test. Set up the Vercel project IDs, protected environments and token as described
in [Vercel deployment and CI/CD](VERCEL.md). Until the project IDs are configured, deployment
is skipped. Production uses `main`; reviewed same-repository PRs can deploy previews.
Native Vercel Git deployment is disabled so it cannot bypass the CI checks.

The separately dispatched production database migration workflow runs only on `main`.
It never runs during a build or ordinary deployment. Survey publication remains a separate
reviewed step. Dependency overrides pin patched transitive tools where upstream Vercel
dependencies lag; re-run the service routing test when changing them.

Gitleaks scans full Git history. `.gitleaksignore` documents one exact historical false
positive: an empty password variable consumed the following literal survey-slug line.
No file or secret rule is broadly excluded.

Let workflows run once before configuring required checks in a new repository. Require the
validation checks above; Release Please only runs on `main` and should not be required
on ordinary pull requests. Run every validation workflow for documentation-only PRs too,
so required checks do not remain pending.

Use CodeQL advanced setup for `security-checks.yml`. If CodeQL default setup is already
enabled, switch to advanced setup to avoid conflicting configurations. Code scanning is
available for this public repository; private copies need the appropriate GitHub plan.
See [GitHub's setup guide](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configuring-advanced-setup-for-code-scanning).

Gitleaks uses the job's automatic `github.token`, with only `contents: read` and
`pull-requests: read`. Personal repositories do not need a Gitleaks license. Organization
copies need `GITLEAKS_LICENSE`; if Dependabot needs it, configure it as a Dependabot secret
as well. PR code is run through `pull_request` with no repository write permissions.
See [Gitleaks](https://github.com/gitleaks/gitleaks-action) and
[Dependabot's Actions restrictions](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-on-actions).

## Releases

The root package is released as one template. Private workspace packages remain internal.
Version tracking lives in `package.json` and `.release-please-manifest.json`. When reusing
this setup in a new repository, review `release-please-config.json` and change or remove its
`bootstrap-sha` so release history starts at a commit that exists in your repository.

Use Conventional Commits, for example `fix: handle expired sessions` or `feat: add profile
settings`. Release Please creates a PR with a root package version bump, changelog, and
manifest update. Review and merge it when ready to tag a GitHub release. It does not publish
packages to npm or deploy an application.

Release Please owns the root `CHANGELOG.md` layout. Oxfmt excludes that generated file
through `/CHANGELOG.md` in `.oxfmtrc.json` so a new release's Markdown layout does not fail
Code Quality. Review release-note content in the release PR; application code and authored
documentation continue to use the normal formatting checks.

In Settings > Actions > General, allow GitHub Actions to create pull requests. The release
job requests `contents: write`, `issues: write`, and `pull-requests: write`; validation jobs
keep read-only repository access.

The workflow defaults to `github.token`. PRs created with this token do not automatically
trigger other Actions workflows. To get automatic validation on release PRs, provide a
repository-scoped token as the `RELEASE_PLEASE_TOKEN` Actions secret with Contents, Issues,
and Pull requests write access. Alternatively, manually close and reopen the release PR
from your own account to trigger its `pull_request` checks before merging.
See [Release Please authentication](https://github.com/googleapis/release-please-action#github-credentials).

## Reviewing Dependabot PRs

Dependabot proposes dependency and action updates; opening a PR does not change `main`.
A version-update PR does not by itself mean the old dependency has a known vulnerability.
Security updates are linked to advisories/Dependabot alerts. Prioritize those alerts, then
review ordinary updates for compatibility and regressions.

1. Read the changed manifests, lockfile, upstream release notes, and any breaking changes.
2. Refresh the branch against current `main` and let the complete validation suite run.
3. For package updates, require a frozen install, types, unit tests, integration, production
   build, browser tests, and audit to pass. UI-library changes also need a visual/keyboard
   check of the affected component; the existing browser smoke suite does not exercise every
   reusable component.
4. Merge passing, understood updates. Resolve failures before merging; hold major upgrades
   until their runtime requirements and migration work are understood. Automatic merging is
   not configured.

Weekly minor/patch development-tool updates are grouped to reduce noise. Major updates stay
separate. Action minor/patch updates are grouped too; major action upgrades remain individual.
These groups do not replace review or CI.
