import { createApp } from "../../apps/api/app";
import { createAuth } from "../../apps/api/auth";
import { createServerEnv } from "../../apps/api/env-config";
import { publishFeedback } from "../../apps/api/feedback-publish";
import { createFeedbackStore } from "../../apps/api/feedback-store";
import { createDb, eq, schema, sql } from "../../packages/db";
import { migrateDb } from "../../packages/db/migrations";
import { createFeedbackDefinition } from "../../packages/shared/feedback";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

const baseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:password@localhost:5433/app_test";
const databaseName = `feedback_test_${crypto.randomUUID().replaceAll("-", "")}`;
const isolated = new URL(baseUrl);
isolated.pathname = `/${databaseName}`;
const root = createDb(baseUrl, { max: 1 });
const db = createDb(isolated.toString(), { max: 5 });
const store = createFeedbackStore(db);
const env = createServerEnv({
  NODE_ENV: "test",
  DATABASE_URL: isolated.toString(),
  BETTER_AUTH_SECRET: "feedback-integration-test-only-secret-32-characters",
});
const auth = createAuth(env, db, () => Promise.resolve());
const { app } = createApp({
  env,
  feedback: store,
  auth: {
    handler: (r) => auth.handler(r),
    getSession: (headers) => auth.api.getSession({ headers }),
  },
});
let created = false;
let actorId = "";
let adminCookie = "";
let memberCookie = "";
const definition = createFeedbackDefinition();
const answers = {
  member_status: "senior",
  schedule_fit: { wed_1930: "very_well", wed_2100: "neutral", sat_0930: "not_at_all" },
  session_attendance: { wed_1930: "always", wed_2100: "often", sat_0930: "never" },
  weekday_preference: "no_preference",
  tuesday_feasibility: "depends_on_timetable",
  senior_class_interest: "not_applicable",
  pt_attendance: "never",
  pt_timing: "unsure",
};
const post = (body: unknown, cookie?: string) => ({
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: env.VITE_APP_URL,
    ...(cookie ? { Cookie: cookie } : {}),
  },
  body: JSON.stringify(body),
});
async function fixture() {
  const slug = `survey-${crypto.randomUUID()}`;
  const published = await publishFeedback(db, slug, definition, actorId);
  return {
    slug,
    input: {
      surveyId: published.surveyId,
      definitionVersionId: published.versionId,
      submissionKey: crypto.randomUUID(),
      selectedInstructorIds: [],
      answers,
    },
  };
}
beforeAll(async () => {
  await root.execute(sql`create database ${sql.identifier(databaseName)}`);
  created = true;
  await migrateDb(db);
  for (const [email, isAdmin] of [
    ["exco@example.com", true],
    ["member@example.com", false],
  ] as const) {
    const response = await app.request(
      "/api/auth/sign-up/email",
      post({ email, password: "test-only-secure-password", name: "Integration account" }),
    );
    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const [user] = await db.select().from(schema.user).where(eq(schema.user.email, email));
    if (isAdmin) {
      actorId = user.id;
      adminCookie = cookie;
      await db.insert(schema.feedbackAdmins).values({ userId: user.id });
    } else memberCookie = cookie;
  }
});
afterAll(async () => {
  await db.$client.end();
  try {
    if (created) await root.execute(sql`drop database ${sql.identifier(databaseName)}`);
  } finally {
    await root.$client.end();
  }
});
describe("durable feedback boundaries", () => {
  it("runs the documented setup CLI and safely repeats provisioning and publication", async () => {
    const slug = `cli-${crypto.randomUUID()}`;
    const setupEnv = {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: isolated.toString(),
      DATABASE_MIGRATION_URL: isolated.toString(),
      BETTER_AUTH_SECRET: "feedback-cli-test-secret-at-least-32-characters",
      FEEDBACK_ADMIN_EMAIL: "cli-exco@example.com",
      FEEDBACK_ADMIN_PASSWORD: "test-only-cli-admin-password",
      SURVEY_SLUG: slug,
      SURVEY_TERM: "CLI semester",
    };
    async function runSetup() {
      const child = Bun.spawn(["bun", "--no-env-file", "apps/api/feedback-setup.ts"], {
        cwd: new URL("../../", import.meta.url).pathname.replace(/^\/([A-Z]:)/u, "$1"),
        env: setupEnv,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [exitCode, stderr] = await Promise.all([
        child.exited,
        new Response(child.stderr).text(),
      ]);
      expect(stderr).not.toContain("Cannot find");
      expect(exitCode).toBe(0);
    }
    await runSetup();
    await runSetup();
    const data = await store.results(slug);
    expect(data.versions).toHaveLength(1);
    expect(data.definition.term).toBe("CLI semester");
    const [admin] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, setupEnv.FEEDBACK_ADMIN_EMAIL));
    expect(await store.isAdmin(admin.id)).toBe(true);
  });
  it("stores one anonymous response and acknowledges a lost-response retry", async () => {
    const { slug, input } = await fixture();
    const first = await app.request(`/api/feedback/${slug}/responses`, post(input));
    expect(first.status).toBe(200);
    const retry = await app.request(`/api/feedback/${slug}/responses`, post(input));
    expect(await retry.json()).toEqual(await first.json());
    const rows = await db
      .select()
      .from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.surveyId, input.surveyId));
    expect(rows).toHaveLength(1);
    expect(rows[0].answers).toEqual(answers);
    expect(Object.keys(rows[0])).not.toContain("userId");
  });
  it("serialises concurrent retries, detects changed payloads and accepts retries after close", async () => {
    const { input } = await fixture();
    const receipts = await Promise.all(Array.from({ length: 5 }, () => store.submit(input)));
    expect(new Set(receipts.map((r) => r.receipt)).size).toBe(1);
    await expect(
      store.submit({ ...input, answers: { ...answers, exco_well: "Changed" } }),
    ).rejects.toMatchObject({ status: 409 });
    const [survey] = await db
      .select()
      .from(schema.surveys)
      .where(eq(schema.surveys.id, input.surveyId));
    await store.changeState(survey.slug, "closed", actorId);
    expect(await store.submit(input)).toEqual(receipts[0]);
    await expect(
      store.submit({ ...input, submissionKey: crypto.randomUUID() }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects forged fields and removes hidden feedback on direct requests", async () => {
    const { input, slug } = await fixture();
    const invalid = await app.request(
      `/api/feedback/${slug}/responses`,
      post({ ...input, answers: { ...answers, invented: "bad" } }),
    );
    expect(invalid.status).toBe(422);
    const hidden = {
      ...input,
      answers: { ...answers, pt_value: "very_useful", joy_well: "Hidden private comment" },
    };
    await store.submit(hidden);
    const data = await store.results(slug);
    expect(data.responses[0].answers).toEqual(answers);
    await expect(
      store.submit({ ...input, selectedInstructorIds: ["invented"] }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("denies every admin endpoint to anonymous and non-admin sessions", async () => {
    const { slug } = await fixture();
    for (const cookie of [undefined, memberCookie]) {
      for (const suffix of ["", "/export", "/state"]) {
        const response = await app.request(
          `/api/admin/feedback/${slug}${suffix}`,
          suffix === "/state"
            ? post({ state: "closed" }, cookie)
            : { headers: cookie ? { Cookie: cookie } : {} },
        );
        expect(response.status).toBe(cookie ? 403 : 401);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
      }
    }
  });
  it("allows a real EXCO session to filter and export, and audits lifecycle changes", async () => {
    const { slug, input } = await fixture();
    await store.submit({ ...input, answers: { ...answers, exco_well: "  =HYPERLINK(1)" } });
    const results = await app.request(`/api/admin/feedback/${slug}?member=junior`, {
      headers: { Cookie: adminCookie },
    });
    expect(results.status).toBe(200);
    expect((await results.json()).responses).toEqual([]);
    const csv = await app.request(`/api/admin/feedback/${slug}/export?member=senior`, {
      headers: { Cookie: adminCookie },
    });
    expect(csv.status).toBe(200);
    expect(await csv.text()).toContain("'=HYPERLINK(1)");
    expect(csv.headers.get("Cache-Control")).toBe("no-store");
    const close = await app.request(
      `/api/admin/feedback/${slug}/state`,
      post({ state: "closed" }, adminCookie),
    );
    expect(close.status).toBe(200);
    const audit = await db
      .select()
      .from(schema.feedbackAudit)
      .where(eq(schema.feedbackAudit.surveyId, input.surveyId));
    expect(audit.map((r) => r.action)).toEqual(["publish:1", "closed"]);
  });
  it("keeps immutable old definitions, rejects stale new writes and enforces survey ownership", async () => {
    const { slug, input } = await fixture();
    await store.submit(input);
    await publishFeedback(db, slug, createFeedbackDefinition("Next semester"), actorId, true);
    expect((await store.getSurvey(slug)).definition.term).toBe("Next semester");
    expect((await store.results(slug, input.definitionVersionId)).definition.term).toBe(
      "Current semester",
    );
    await expect(
      store.submit({ ...input, submissionKey: crypto.randomUUID() }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await store.submit(input)).toHaveProperty("receipt");
    await expect(
      db
        .update(schema.surveyVersions)
        .set({ definition: {} })
        .where(eq(schema.surveyVersions.id, input.definitionVersionId))
        .execute(),
    ).rejects.toThrow();
    const other = await fixture();
    await expect(
      db
        .insert(schema.surveyResponses)
        .values({
          surveyId: other.input.surveyId,
          definitionVersionId: input.definitionVersionId,
          submissionKey: crypto.randomUUID(),
          payloadHash: "hash",
          answers,
          selectedInstructorIds: [],
        })
        .execute(),
    ).rejects.toThrow();
    await expect(
      db
        .update(schema.surveys)
        .set({ activeVersionId: input.definitionVersionId })
        .where(eq(schema.surveys.id, other.input.surveyId))
        .execute(),
    ).rejects.toThrow();
  });
  it("hides drafts, rejects cross-origin and oversized bodies, and enables RLS", async () => {
    const slug = `draft-${crypto.randomUUID()}`;
    await db.insert(schema.surveys).values({ slug });
    expect((await app.request(`/api/feedback/${slug}`)).status).toBe(404);
    const f = await fixture();
    const untrusted = post(f.input);
    untrusted.headers.Origin = "https://untrusted.example";
    expect((await app.request(`/api/feedback/${f.slug}/responses`, untrusted)).status).toBe(403);
    expect(
      (await app.request(`/api/feedback/${f.slug}/responses`, post({ text: "x".repeat(70000) })))
        .status,
    ).toBe(413);
    const rls = await db.execute(
      sql`select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`,
    );
    expect(rls).toHaveLength(0);
  });
});
