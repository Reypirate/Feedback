# Ardiente feedback form

For a UI preview without an API or Supabase connection, run `pnpm preview:form` and open
http://127.0.0.1:4000/preview. This uses the current survey configuration, lets you navigate
and review the form, and disables final submission. It does not save responses. Live API
failures display a readable message with a link to this preview instead of a JSON parser error.

The public form is at `/` (the `ardiente` survey) or `/feedback/<slug>`. EXCO signs in at
`/admin` or `/admin/feedback/<slug>`. The six sections cover all 25 survey questions,
followed by review and submission. Every comment and all instructor feedback are optional.
The default term label is **Current semester**; change `SURVEY_TERM` before publishing.

## Supabase setup

1. Create/select the intended Supabase project. Copy connection strings from its **Connect**
   panel. Use the pooled runtime string for `DATABASE_URL` and a direct or session-pooler
   string for `DATABASE_MIGRATION_URL`. URL-encode special characters in the password and
   retain TLS (`sslmode=require`). See [Supabase's Drizzle guide](https://supabase.com/docs/guides/database/drizzle)
   and [connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).
2. Run `pnpm install --frozen-lockfile`, then `Copy-Item .env.example .env` in PowerShell.
   Fill both connection strings and generate `BETTER_AUTH_SECRET` with
   `bun -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. Set `FEEDBACK_ADMIN_EMAIL` to the intended EXCO account and `FEEDBACK_ADMIN_PASSWORD`
   to a unique password of at least 12 characters. This password is used only when creating
   a new account. Existing accounts retain their password. Set `SURVEY_TERM` and optionally
   `SURVEY_SLUG`. Leave SMTP settings empty if mail is not configured.
4. Review and apply migrations: `pnpm db:migrate`. Then run `pnpm feedback:setup` to
   explicitly provision that EXCO account and publish the first survey definition.
5. Run `pnpm dev` and open http://localhost:4000. For production, set the public HTTPS app,
   API and auth URLs, then run `pnpm build` and `pnpm start` using the deployment guide.

These commands act on the database you configure; no hosted Supabase project is provisioned
by the source changes. Docker is optional for development when using hosted Supabase.

Drizzle and Better Auth connect from the Hono server; no Supabase keys or connection strings
are sent to the browser. Prepared statements are disabled for transaction pooling. Migrations
enable RLS on all application and auth tables with no public policies, so Supabase Data API
clients cannot read answers or account tables. The server uses the trusted database-owner
connection and checks EXCO access itself. Do not add broad `anon`/`authenticated` policies.
Supabase Auth is not used; database hosting and account authentication are separate here.

## Publication and access

Definitions are validated snapshots in `survey_versions`. Repeating setup with the same
definition is idempotent. After changing published questions, labels, options or branching,
review the changes and run `pnpm feedback:setup --new-version`. This appends a new version;
database triggers prevent changing or deleting a published snapshot. A closed survey remains
closed when a new version is published. EXCO can explicitly reopen it in the dashboard.
Use a different `SURVEY_SLUG` for a separate collection round.

Public signup never grants EXCO privileges. Trusted setup adds the selected account to
`feedback_admins`. Every results, export and lifecycle endpoint checks a server-verified
Better Auth session and that table. Self-reported membership answers cannot grant permissions.
Keep the setup password out of source control and remove it from the environment after setup.

The dashboard separates versions, filters Junior/Senior/Alumni, shows option counts and
explicit denominators, and exports only the chosen scope. Checkbox percentages use answered
responses and can sum above 100%. PT usefulness excludes non-attendees; uncertainty, not
applicable and missing answers remain distinct. Written feedback is a separate EXCO view;
membership-filtered comment groups below five are hidden as a provisional display rule.
Authorised raw access and exports remain available; this suppression does not guarantee anonymity.

## Submission and privacy

The form collects no respondent name, email, account ID, IP address or user-agent in response
rows. Existing signed-in identities are not attached. Members should avoid identifying details
in comments. Hosting and authentication infrastructure may retain operational logs; the form
does not promise complete anonymity or enforce one response per person.

Drafts remain in memory in the current tab. There is no silent local-storage saving. Navigation
warns before discarding answers. Back, review edits and branch changes retain visible answers;
hidden follow-ups are cleared. Submission success appears only after the database commits.

A random key identifies a logical submission. A lost response locks editing and retries the
same envelope. Row locking and a unique survey/key constraint yield one response and receipt
across concurrent retries. Reusing a key with different content conflicts. A committed retry
still succeeds after closure or publication of a new version. New stale/closed submissions fail
without discarding the member's draft. CSV exports escape quotes/newlines and neutralise formula
prefixes. Private feedback failures are logged without database parameters or answer text.

## Verification

```text
pnpm check
pnpm db:check
pnpm db:check-drift
pnpm services:test
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
```

Integration and browser tests use `TEST_DATABASE_URL` (default port 5433, database `app_test`)
solely as a connection for creating randomly named disposable databases. The test role needs
`CREATEDB`. Never set this to a production instance. Tests apply the real migrations and clean
up their own databases. Browser tests exercise the production bundle, an actual EXCO account,
persisted submissions, a committed write with a lost response, mobile overflow, keyboard use,
review edits and access denial. CI includes PostgreSQL for both suites.

The local `skills/` directory is intentionally Git-ignored. It includes the completed
`Form Build/SKILL.md` entry point, references updated for Supabase, and `agents/openai.yaml`.
Keep a separate copy if you need to transfer those personal skill files to another checkout.
