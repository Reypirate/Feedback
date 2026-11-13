# Google sign-in for EXCO

Members submit feedback without signing in. EXCO sign in with a provisioned Google account
such as `ardiente@sa.smu.edu.sg`; public registration and production password login are disabled.

1. In Google Cloud, choose the OAuth project and create a Web application OAuth client.
   Configure the consent-screen audience so the intended account can use the application.
   An Internal audience requires membership in that project's Google Workspace organization;
   sharing an email suffix does not by itself establish that membership.
2. Add the website's origin to authorized JavaScript origins. For local development this
   is `http://localhost:4000`. Add the API callback to authorized redirect URIs:
   `http://localhost:4001/api/auth/callback/google` locally, and
   `https://YOUR_DOMAIN/api/auth/callback/google` for same-origin production hosting.
3. Put the client ID and secret in server variables `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`. Dashboard fields take raw values without surrounding quotes.
   Keep the secret in your ignored local `.env` or hosting environment, never in Git.
4. Keep `BETTER_AUTH_SECRET` stable and set `VITE_APP_URL`, `VITE_API_URL` and
   `BETTER_AUTH_URL` for the intended environment. The auth URL ends in `/api/auth`.
5. Use the trusted [feedback setup](FEEDBACK.md) process to provision the EXCO email in
   the application's database, then sign in through `/admin` using that exact Google account.

The application requests basic Google identity through Better Auth. No newsletter, Gmail
or Drive permissions are needed. Preview domains require their own authorized callback;
use an isolated preview database and stable preview domain when testing Google login.

If Google reports that the app can only be used within its organization, review the
OAuth audience and Google Workspace membership. If the app says sign-in is unavailable,
check that both Google credentials are configured and the callback URI matches exactly.

See [Google OAuth web-server applications](https://developers.google.com/identity/protocols/oauth2/web-server),
[Better Auth Google provider](https://www.better-auth.com/docs/authentication/google)
and [Vercel deployment](VERCEL.md).
