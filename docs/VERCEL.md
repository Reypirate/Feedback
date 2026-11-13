# Vercel deployment and CI/CD

[Documentation index](README.md)

The root [`vercel.json`](../vercel.json) deploys two services as one Vercel project.
[Vercel Services is in Beta](https://vercel.com/docs/services).

| Service | Source               | Runtime            | Public paths        |
| ------- | -------------------- | ------------------ | ------------------- |
| `api`   | `apps/api/server.ts` | Hono on Node.js 24 | `/api` and `/api/*` |
| `web`   | `apps/web`           | Vite static assets | All remaining paths |

The root Dockerfile combines the API and website for an alternative container deployment;
deploying it as a third `app` service would duplicate those components. Hono already owns
the `/api` prefix. The web service's local rewrite serves `index.html` for extensionless
SPA routes. Files with extensions and Vite's `/@` modules keep their original paths so
the HTML fallback cannot replace JavaScript, stylesheets or development modules.

There are no internal HTTP callers in this architecture. Browser requests use the public
same-origin API, including `/api/runtime.js` and `/api/auth/*`. Consequently no service
bindings are declared: bindings supply runtime function URLs and cannot configure a static
Vite build or browser code. Supabase uses a database connection, not a Vercel service binding.
See [routing](https://vercel.com/docs/services/routing) and
[bindings](https://vercel.com/docs/services/bindings).

## Project settings and environment

Import the repository into one Vercel project with its Root Directory at the repository
root (`.`). Keep build settings in the individual services in `vercel.json`.
Set the project's Node.js version to 24.x; the service runtime identifier is `node`.
Configure environment variables in Vercel, separately for Production and Preview.
Local `.env` files are excluded from uploads and must not be committed.

| Variable               | Production value                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Supabase transaction-pooler PostgreSQL URL, port `6543`, with `sslmode=verify-full` |
| `BETTER_AUTH_SECRET`   | A stable random secret with at least 32 characters                                  |
| `GOOGLE_CLIENT_ID`     | Existing Google OAuth web client ID                                                 |
| `GOOGLE_CLIENT_SECRET` | Existing Google OAuth web client secret                                             |
| `VITE_APP_URL`         | The public HTTPS site origin, without a trailing slash                              |
| `VITE_API_URL`         | The same public site origin                                                         |
| `BETTER_AUTH_URL`      | That origin followed by `/api/auth`                                                 |

Enter raw values in dashboard fields, without surrounding quotes. The Supabase HTTPS
Project URL and publishable key are not PostgreSQL connection strings. Copy the pooler
URL from the Supabase Connect dialog; do not guess its hostname or username. The runtime
disables prepared statements, limits each Vercel instance to one database connection and
uses Supabase's public CA certificate bundled in code. Remove any machine-specific
`sslrootcert=C:/...` parameter from the hosted URL. TLS verification stays enabled.
See [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

Add the production origin to the Google client's authorized JavaScript origins and add
`https://YOUR_DOMAIN/api/auth/callback/google` as an authorized redirect URI. Keep the
EXCO account provisioned in the same database used by the API.
See [Google authentication setup](GOOGLE-AUTH-SETUP.md).

Use a separate Supabase project or database for Preview. When public URL variables are
omitted on Vercel, the API derives the origin from `VERCEL_URL`; set all three URL values
explicitly when using a custom domain. Preview Google login needs an authorized callback
for a stable preview domain, with its own client configuration if needed. A random preview
URL is not automatically authorized by Google. Production mode is enforced on Vercel;
test password login cannot be enabled by preview settings.

SMTP and storage credentials are optional and are not required for Google-only feedback
collection. No Supabase service-role key is required by this application's database driver.

## GitHub Actions deployment

[`ci-cd.yml`](../.github/workflows/ci-cd.yml) runs on pull requests, pushes to `main`,
and manual dispatch. Deployment waits for formatting/lint/types/migration checks, unit
tests, PostgreSQL integration tests, browser tests, production builds, Vercel service
routing and security checks. Vercel's native Git deployment is disabled in `vercel.json`
so Git pushes cannot bypass that gate.

Configure these in GitHub Settings > Secrets and variables > Actions:

| Kind                | Name                | Value                                                                  |
| ------------------- | ------------------- | ---------------------------------------------------------------------- |
| Repository variable | `VERCEL_ORG_ID`     | Team/account ID from Vercel project settings or `.vercel/project.json` |
| Repository variable | `VERCEL_PROJECT_ID` | Project ID from Vercel settings or `.vercel/project.json`              |
| Environment secret  | `VERCEL_TOKEN`      | Token scoped to the intended Vercel team/project                       |

Create GitHub environments named `production` and `preview`. Restrict production to
`main` and protect the branch with required checks/review. Configure required environment
reviewers before allowing PR previews to access deployment credentials. Store the token
directly in GitHub; do not paste it into chat. Without both repository variables, the
deployment job is skipped while validation still runs.

The deployment job installs frozen dependencies without the deployment token, pulls the
selected Vercel environment, builds all services, then uploads that prebuilt output.
`main` releases use `--prod`; same-repository PRs use Preview after environment approval.
Fork and Dependabot PRs run checks without deployment credentials. The workflow reports
the resulting deployment URL. No environment files or deployment credentials are uploaded
as build artifacts. A manual run on another branch targets Preview.

See [CI checks](CI.md) and [Vercel CLI deployment](https://vercel.com/docs/cli/deploy).

## Database releases

Apply schema migrations separately before deploying code that needs them. The manually
dispatched [`database-migrate.yml`](../.github/workflows/database-migrate.yml) runs only
from `main`, using the protected `production` environment and its
`DATABASE_MIGRATION_URL` secret. Use Supabase's direct or session-pooler URL for migrations,
with `sslmode=verify-full` and no Windows certificate path. The workflow supplies the
committed public CA through `NODE_EXTRA_CA_CERTS` for Drizzle's PostgreSQL driver.

Builds and deployments do not migrate the production database or publish survey versions.
Publish reviewed question changes separately using the feedback setup instructions.

## Local verification

```bash
pnpm vercel:check
pnpm dev:vercel
```

`dev:vercel` runs both services locally without cloud authentication. Configure the API
environment as described in the normal local setup. `pnpm test:vercel` starts Vercel on
port `4310` with test-only credentials and checks API routing, JSON 404s, SPA deep links,
runtime public settings and browser assets. It makes no database writes. CI runs this on
Linux; Vercel's Windows builder installation can require symlink privileges.
