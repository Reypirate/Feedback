# Supabase database certificate

`supabase-root-2021.crt` is the public Supabase Root 2021 CA certificate, downloaded from
[Supabase's certificate distribution](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt).
It is public trust material, not a private key or an application secret. It expires on
26 April 2031; replace it if Supabase rotates the database certificate authority.

For local migration tools, use `sslmode=verify-full&sslrootcert=ABSOLUTE_PATH` in the PostgreSQL connection URLs.
The database wrapper loads the CA explicitly for Postgres.js; Drizzle Kit's PostgreSQL
driver reads the same URL parameter. This works without disabling TLS verification.

Use forward slashes in Windows paths and URL-encode spaces. The Docker image includes
the certificate at `/app/certs/supabase-root-2021.crt`.

See [Supabase SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement).

The application runtime bundles this same public CA in
`packages/db/supabase-certificate.ts`. Hosted Supabase URLs therefore need only
`sslmode=verify-full`, without an absolute `sslrootcert` path on Vercel. Migration tools
use their own driver: the GitHub migration workflow supplies this CA via
`NODE_EXTRA_CA_CERTS`.
