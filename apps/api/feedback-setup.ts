import { createDb, eq, schema } from "@repo/db";
import { createFeedbackDefinition } from "@repo/shared/feedback";
import { z } from "zod";

import { createAuth } from "./auth";
import { createServerEnv } from "./env-config";
import { publishFeedback } from "./feedback-publish";

const env = createServerEnv(process.env);
const email = z.email().parse(process.env.FEEDBACK_ADMIN_EMAIL);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  .parse(process.env.SURVEY_SLUG ?? "ardiente");
const db = createDb(process.env.DATABASE_MIGRATION_URL || env.DATABASE_URL, { max: 1 });
try {
  let [admin] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  if (!admin) {
    const password = z.string().min(12).parse(process.env.FEEDBACK_ADMIN_PASSWORD);
    const auth = createAuth(env, db, () => Promise.resolve());
    await auth.api.signUpEmail({ body: { email, password, name: "Ardiente EXCO" } });
    [admin] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  }
  if (!admin) throw new Error("Unable to provision EXCO account.");
  await db.insert(schema.feedbackAdmins).values({ userId: admin.id }).onConflictDoNothing();
  const published = await publishFeedback(
    db,
    slug,
    createFeedbackDefinition(process.env.SURVEY_TERM ?? "Current semester"),
    admin.id,
    process.argv.includes("--new-version"),
  );
  console.log(
    `Published ${slug}, version ${published.version}. Form: /feedback/${slug}. EXCO: /admin/feedback/${slug}`,
  );
} finally {
  await db.$client.end();
}
