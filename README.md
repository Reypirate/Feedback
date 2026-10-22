# Ardiente Feedback

A six-section feedback form for Ardiente’s training schedule, senior classes, Wednesday PT,
instructors and the 17th EXCO. Members can review and edit answers before submitting;
all written feedback and instructor feedback are optional.

Built with the existing React 19/Vite, TanStack Router, React Hook Form and Hono/Bun
monorepo. Responses and Better Auth account tables live in **Supabase PostgreSQL**, accessed
through server-side Drizzle. The EXCO dashboard provides version and membership filters,
counts with explicit denominators, restricted comments, CSV export and open/close controls.

## Start locally

To preview the form without configuring a database, run `pnpm preview:form` and open
http://127.0.0.1:4000/preview. Preview responses are not submitted or saved.

Use Node.js 22.23.3 (or another supported version in `package.json`), pnpm 10.33.3 and
Bun 1.3.13 or newer.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Fill `.env` with your Supabase pooled runtime connection, direct/session migration
connection, generated auth secret and intended EXCO credentials. The term label defaults to
**Current semester**. Follow [Feedback setup](docs/FEEDBACK.md) for the exact configuration.

```powershell
pnpm db:migrate
pnpm feedback:setup
pnpm dev
```

Open http://localhost:4000 for the form and http://localhost:4000/admin for EXCO access.
Setup explicitly provisions the specified EXCO account and publishes the initial immutable
survey definition. Public signup does not grant EXCO access.

## Commands

| Command                             | Purpose                                                  |
| ----------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                          | Run web (4000) and API (4001)                            |
| `pnpm check`                        | Formatting, lint, types, unit tests and builds           |
| `pnpm build` / `pnpm start`         | Build and serve the production app                       |
| `pnpm db:migrate`                   | Apply reviewed, committed migrations                     |
| `pnpm feedback:setup`               | Provision the configured EXCO account and first survey   |
| `pnpm feedback:setup --new-version` | Explicitly publish a changed definition as a new version |
| `pnpm services:test`                | Start isolated local PostgreSQL on port 5433             |
| `pnpm test:integration`             | Verify real persistence, auth, constraints and retries   |
| `pnpm test:e2e`                     | Build and test member and EXCO browser journeys          |

Database tests create disposable databases through `TEST_DATABASE_URL`; use only a test
instance with `CREATEDB` permission. Browser tests also require installed Playwright Chromium.
Supabase credentials and hosting must be configured before using the form with live responses.

Read [Feedback setup and operation](docs/FEEDBACK.md) for privacy, publication, versioning,
permissions and testing. The [documentation index](docs/README.md) retains the underlying
monorepo’s architecture, API, deployment and contribution guides.
