import { createAuth } from "../apps/api/auth";
import { createServerEnv } from "../apps/api/env-config";
import { publishFeedback } from "../apps/api/feedback-publish";
import { createDb, eq, schema, sql } from "../packages/db";
import { migrateDb } from "../packages/db/migrations";
import { createFeedbackDefinition } from "../packages/shared/feedback";

import { mkdirSync, writeFileSync } from "node:fs";

const databaseName = process.env.FEEDBACK_E2E_DATABASE_NAME;
if (!databaseName || !/^feedback_e2e_[a-f0-9]+$/u.test(databaseName))
  throw new Error("An isolated E2E database name is required.");
const baseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:password@localhost:5433/app_test";
const isolated = new URL(baseUrl);
isolated.pathname = `/${databaseName}`;
const root = createDb(baseUrl, { max: 1 });
try {
  await root.execute(sql`create database ${sql.identifier(databaseName)}`);
} finally {
  await root.$client.end();
}
process.env.DATABASE_URL = isolated.toString();
const env = createServerEnv(process.env);
const db = createDb(isolated.toString(), { max: 1 });
try {
  await migrateDb(db);
  // Seed signed sessions outside the production server. There is no test login endpoint.
  const auth = createAuth({ ...env, NODE_ENV: "test" }, db, () => Promise.resolve());
  async function session(path: string, body: Record<string, string>) {
    const response = await auth.handler(
      new Request(`${env.VITE_API_URL}/api/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: env.VITE_APP_URL },
        body: JSON.stringify(body),
      }),
    );
    if (!response.ok) throw new Error("Unable to create isolated browser test session.");
    return response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
  }
  const reader = await session("sign-up/email", {
    email: "exco@example.test",
    password: "e2e-only-password-12345",
    name: "Test EXCO",
  });
  const adminSession = await session("sign-in/email", {
    email: "exco@example.test",
    password: "e2e-only-password-12345",
  });
  const member = await session("sign-up/email", {
    email: "member@example.test",
    password: "e2e-member-password-12345",
    name: "Ordinary member",
  });
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    `test-results/${databaseName}-sessions.json`,
    JSON.stringify({ reader, admin: adminSession, member }),
  );
  const [admin] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, "exco@example.test"));
  await db.insert(schema.feedbackAdmins).values({ userId: admin.id });
  await publishFeedback(db, "ardiente", createFeedbackDefinition(), admin.id);
} finally {
  await db.$client.end();
}
// Exercise the actual production bundle and static-file server.
const bundle = "../apps/api/dist/index.js";
export default (await import(bundle)).default;
