import type { createDb } from "@repo/db";
import type { Definition } from "@repo/shared/feedback";

import { desc, eq, schema } from "@repo/db";
import { canonicalJson, definitionSchema } from "@repo/shared/feedback";

// Trusted CLI boundary. No public publication or role-management endpoint.
export async function publishFeedback(
  db: ReturnType<typeof createDb>,
  slug: string,
  definition: Definition,
  actorId: string,
  allowNewVersion = false,
) {
  const snapshot = definitionSchema.parse(definition);
  return db.transaction(async (tx) => {
    await tx.insert(schema.surveys).values({ slug }).onConflictDoNothing();
    const [survey] = await tx
      .select()
      .from(schema.surveys)
      .where(eq(schema.surveys.slug, slug))
      .for("update");
    if (!survey) throw new Error("Unable to create survey.");
    const [previous] = await tx
      .select()
      .from(schema.surveyVersions)
      .where(eq(schema.surveyVersions.surveyId, survey.id))
      .orderBy(desc(schema.surveyVersions.version))
      .limit(1);
    if (previous && canonicalJson(previous.definition) === canonicalJson(snapshot))
      return { surveyId: survey.id, versionId: previous.id, version: previous.version };
    if (previous && !allowNewVersion)
      throw new Error(
        "The published definition has changed. Review it, then rerun with --new-version to publish a new immutable snapshot.",
      );
    const [version] = await tx
      .insert(schema.surveyVersions)
      .values({
        surveyId: survey.id,
        version: (previous?.version ?? 0) + 1,
        definition: snapshot,
        createdBy: actorId,
      })
      .returning();
    if (!version) throw new Error("Unable to publish survey.");
    await tx
      .update(schema.surveys)
      .set({ activeVersionId: version.id, state: survey.state === "draft" ? "open" : survey.state })
      .where(eq(schema.surveys.id, survey.id));
    await tx
      .insert(schema.feedbackAudit)
      .values({ surveyId: survey.id, actorId, action: `publish:${version.version}` });
    return { surveyId: survey.id, versionId: version.id, version: version.version };
  });
}
