import { createApp } from "../../apps/api/app-factory";
import { createAuth } from "../../apps/api/auth";
import { createServerEnv } from "../../apps/api/env-config";
import { publishFeedback } from "../../apps/api/feedback-publish";
import { createFeedbackStore } from "../../apps/api/feedback-store";
import { createDb, eq, schema, sql } from "../../packages/db";
import { migrateDb } from "../../packages/db/migrations";
import { createFeedbackDefinition } from "../../packages/shared/feedback";

import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";

const baseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:password@localhost:5433/app_test";
const databaseName = `feedback_google_${crypto.randomUUID().replaceAll("-", "")}`;
const isolated = new URL(baseUrl);
isolated.pathname = `/${databaseName}`;
const root = createDb(baseUrl, { max: 1 });
const db = createDb(isolated.toString(), { max: 2 });
const env = createServerEnv({
  NODE_ENV: "production",
  DATABASE_URL: isolated.toString(),
  BETTER_AUTH_SECRET: "google-integration-test-only-secret-32-characters",
  GOOGLE_CLIENT_ID: "integration-test.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-only-secret",
});
const auth = createAuth(env, db, () => Promise.resolve());
const { app } = createApp({
  env,
  feedback: createFeedbackStore(db),
  auth: {
    handler: (request) => auth.handler(request),
    getSession: (headers) => auth.api.getSession({ headers }),
  },
});
const adminEmail = "google-exco@example.test";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicKey = {
  ...keys.publicKey.export({ format: "jwk" }),
  kid: "local-google-test",
  alg: "RS256",
  use: "sig",
};
let token = "";
const calls: string[] = [];
let requestNumber = 0;
let created = false;
const originalFetch = globalThis.fetch;
let provider: ReturnType<typeof Bun.serve>;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

function signedToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: publicKey.kid })).toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({
      iss: "https://accounts.google.com",
      aud: env.GOOGLE_CLIENT_ID,
      sub: "test-google-exco",
      email: adminEmail,
      email_verified: true,
      name: "Test EXCO",
      iat: now,
      exp: now + 3600,
      ...overrides,
    }),
  ).toString("base64url");
  const input = `${header}.${payload}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), keys.privateKey).toString("base64url")}`;
}
function post(body: unknown) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: env.VITE_APP_URL,
      "X-Forwarded-For": `192.0.2.${++requestNumber}`,
    },
    body: JSON.stringify(body),
  };
}
function cookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
}
async function begin() {
  const response = await app.request(
    "/api/auth/sign-in/social",
    post({
      provider: "google",
      callbackURL: `${env.VITE_APP_URL}/admin`,
      errorCallbackURL: `${env.VITE_APP_URL}/admin?error=google_sign_in`,
    }),
  );
  expect(response.status).toBe(200);
  const destination = new URL((await response.json()).url);
  expect(destination.hostname).toBe("accounts.google.com");
  expect(destination.searchParams.get("code_challenge")).toBeTruthy();
  return { destination, cookie: cookie(response) };
}
async function callback(overrides: Record<string, unknown> = {}) {
  token = signedToken(overrides);
  const flow = await begin();
  return app.request(
    `/api/auth/callback/google?code=local-test-code&state=${encodeURIComponent(flow.destination.searchParams.get("state")!)}`,
    {
      headers: { Cookie: flow.cookie },
    },
  );
}

beforeAll(async () => {
  await root.execute(sql`create database ${sql.identifier(databaseName)}`);
  created = true;
  await migrateDb(db);
  const [admin] = await db
    .insert(schema.user)
    .values({ id: crypto.randomUUID(), email: adminEmail, name: "Test EXCO", emailVerified: false })
    .returning();
  await db.insert(schema.feedbackAdmins).values({ userId: admin.id });
  await db.insert(schema.user).values({
    id: crypto.randomUUID(),
    email: "member@example.test",
    name: "Member",
    emailVerified: false,
  });
  await publishFeedback(db, "ardiente", createFeedbackDefinition(), admin.id);
  provider = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      calls.push(path);
      if (path === "/token") {
        const body = new URLSearchParams(await request.text());
        expect(body.get("grant_type")).toBe("authorization_code");
        expect(body.get("code_verifier")).toBeTruthy();
        return Response.json({
          access_token: "local-test-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          id_token: token,
        });
      }
      if (path === "/certs") return Response.json({ keys: [publicKey] });
      return new Response("Unmodelled provider endpoint", { status: 501 });
    },
  });
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        if (url.href === "https://oauth2.googleapis.com/token")
          return originalFetch(new Request(new URL("/token", provider.url), request));
        if (url.href === "https://www.googleapis.com/oauth2/v3/certs")
          return originalFetch(new URL("/certs", provider.url));
        throw new Error(`Unexpected external request in Google authentication test: ${url.origin}`);
      },
      { preconnect: originalFetch.preconnect },
    ),
  );
});
afterAll(async () => {
  fetchSpy?.mockRestore();
  provider?.stop(true);
  await db.$client.end();
  try {
    if (created) await root.execute(sql`drop database ${sql.identifier(databaseName)}`);
  } finally {
    await root.$client.end();
  }
});

describe("Google-only EXCO authentication", () => {
  it("disables password sign-in and public password registration in production", async () => {
    for (const path of ["sign-in/email", "sign-up/email"]) {
      const response = await app.request(
        `/api/auth/${path}`,
        post({ email: adminEmail, password: "test-password-12345", name: "Test EXCO" }),
      );
      expect(response.status).not.toBe(200);
    }
  });
  it("links a verified Google identity to the provisioned EXCO and authorises the dashboard", async () => {
    const response = await callback();
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(`${env.VITE_APP_URL}/admin`);
    const results = await app.request("/api/admin/feedback/ardiente", {
      headers: { Cookie: cookie(response) },
    });
    expect(results.status).toBe(200);
    expect(calls).toContain("/token");
    const [user] = await db.select().from(schema.user).where(eq(schema.user.email, adminEmail));
    expect(user.emailVerified).toBe(true);
    const accounts = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, user.id));
    expect(accounts.map((account) => account.providerId)).toEqual(["google"]);
  });
  it("does not register an unprovisioned Google identity", async () => {
    const response = await callback({ sub: "outsider", email: "outsider@example.test" });
    expect(response.headers.get("Location")).toContain("error=");
    expect(
      await db.select().from(schema.user).where(eq(schema.user.email, "outsider@example.test")),
    ).toEqual([]);
    expect(
      (await app.request("/api/admin/feedback/ardiente", { headers: { Cookie: cookie(response) } }))
        .status,
    ).toBe(401);
  });
  it("refuses unverified Google email claims even for an existing EXCO", async () => {
    const response = await callback({ email_verified: false });
    expect(response.status).toBe(403);
    expect(
      (await app.request("/api/admin/feedback/ardiente", { headers: { Cookie: cookie(response) } }))
        .status,
    ).toBe(401);
  });
  it("rejects a token issued for a different application", async () => {
    const response = await callback({ aud: "another-app.apps.googleusercontent.com" });
    expect(response.status).toBe(403);
    expect(
      (await app.request("/api/admin/feedback/ardiente", { headers: { Cookie: cookie(response) } }))
        .status,
    ).toBe(401);
  });
  it("rejects direct ID-token sign-in because the app uses the redirect flow", async () => {
    const count = calls.length;
    const response = await app.request(
      "/api/auth/sign-in/social",
      post({
        provider: "google",
        idToken: { token: signedToken() },
        callbackURL: `${env.VITE_APP_URL}/admin`,
      }),
    );
    expect(response.status).not.toBe(200);
    expect(calls.length).toBe(count);
  });
  it("does not grant EXCO privileges to another valid Google user", async () => {
    const response = await callback({ sub: "member", email: "member@example.test" });
    expect(response.headers.get("Location")).toBe(`${env.VITE_APP_URL}/admin`);
    expect(
      (await app.request("/api/admin/feedback/ardiente", { headers: { Cookie: cookie(response) } }))
        .status,
    ).toBe(403);
  });
  it("rejects a changed OAuth state before contacting the token endpoint", async () => {
    const flow = await begin();
    const count = calls.length;
    const response = await app.request(
      "/api/auth/callback/google?code=local-test-code&state=tampered",
      { headers: { Cookie: flow.cookie } },
    );
    expect(response.headers.get("Location")).toContain("error=");
    expect(calls.length).toBe(count);
  });
});
