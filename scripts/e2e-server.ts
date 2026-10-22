import { createAuth } from "../apps/api/auth";
import { createServerEnv } from "../apps/api/env-config";
import { publishFeedback } from "../apps/api/feedback-publish";
import { createDb, eq, schema, sql } from "../packages/db";
import { migrateDb } from "../packages/db/migrations";
import { createFeedbackDefinition } from "../packages/shared/feedback";

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
  const auth = createAuth(env, db, () => Promise.resolve());
  await auth.api.signUpEmail({
    body: { email: "exco@example.test", password: "e2e-only-password-12345", name: "Test EXCO" },
  });
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
