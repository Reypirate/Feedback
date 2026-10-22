import type { createDb } from "@repo/db";
import type { Answers, PublicSurvey, StoredResponse, Submission } from "@repo/shared/feedback";

import { and, desc, eq, schema } from "@repo/db";
import {
  canonicalJson,
  definitionSchema,
  submissionSchema,
  validateAnswers,
} from "@repo/shared/feedback";

export class FeedbackError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409 | 422,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function createFeedbackStore(db: ReturnType<typeof createDb>) {
  async function getSurvey(slug: string, includeDraft = false): Promise<PublicSurvey> {
    const [survey] = await db.select().from(schema.surveys).where(eq(schema.surveys.slug, slug));
    if (!survey || (!includeDraft && survey.state === "draft") || !survey.activeVersionId)
      throw new FeedbackError(404, "This form link is unavailable.");
    const [version] = await db
      .select()
      .from(schema.surveyVersions)
      .where(
        and(
          eq(schema.surveyVersions.surveyId, survey.id),
          eq(schema.surveyVersions.id, survey.activeVersionId),
        ),
      );
    if (!version) throw new FeedbackError(404, "This form has not been published.");
    return {
      id: survey.id,
      slug,
      state: survey.state,
      versionId: version.id,
      definition: definitionSchema.parse(version.definition),
    };
  }

  async function submit(raw: unknown) {
    const parsed = submissionSchema.safeParse(raw);
    if (!parsed.success) throw new FeedbackError(400, "Invalid submission envelope.");
    const input: Submission = parsed.data;
    return db.transaction(async (tx) => {
      // Lifecycle changes and new writes serialize on this same row.
      const [survey] = await tx
        .select()
        .from(schema.surveys)
        .where(eq(schema.surveys.id, input.surveyId))
        .for("update");
      if (!survey || survey.state === "draft")
        throw new FeedbackError(404, "This form link is unavailable.");
      const [version] = await tx
        .select()
        .from(schema.surveyVersions)
        .where(
          and(
            eq(schema.surveyVersions.id, input.definitionVersionId),
            eq(schema.surveyVersions.surveyId, survey.id),
          ),
        );
      if (!version)
        throw new FeedbackError(
          409,
          "The form has changed. Keep a copy of your answers and reload the updated form.",
        );
      const definition = definitionSchema.parse(version.definition);
      if (
        input.selectedInstructorIds.some((id) => !definition.instructors.some((i) => i.id === id))
      )
        throw new FeedbackError(422, "Unknown instructor.");
      const validated = validateAnswers(definition, input.answers, input.selectedInstructorIds);
      if (Object.keys(validated.errors).length)
        throw new FeedbackError(422, "Please check your answers.", validated.errors);
      const canonical = {
        surveyId: input.surveyId,
        definitionVersionId: input.definitionVersionId,
        selectedInstructorIds: [...input.selectedInstructorIds].sort(),
        answers: validated.answers,
      };
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalJson(canonical)),
      );
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const [existing] = await tx
        .select()
        .from(schema.surveyResponses)
        .where(
          and(
            eq(schema.surveyResponses.surveyId, survey.id),
            eq(schema.surveyResponses.submissionKey, input.submissionKey),
          ),
        );
      if (existing) {
        if (existing.payloadHash !== hash)
          throw new FeedbackError(
            409,
            "This submission key has already been used with different answers.",
          );
        return { receipt: existing.id };
      }
      if (survey.state !== "open")
        throw new FeedbackError(409, "This survey is closed and cannot accept new responses.");
      if (survey.activeVersionId !== version.id)
        throw new FeedbackError(
          409,
          "The form has changed. Keep a copy of your answers and reload the updated form.",
        );
      const [row] = await tx
        .insert(schema.surveyResponses)
        .values({ ...canonical, submissionKey: input.submissionKey, payloadHash: hash })
        .returning({ id: schema.surveyResponses.id });
      if (!row) throw new Error("Feedback write failed.");
      return { receipt: row.id };
    });
  }

  async function isAdmin(userId: string) {
    const [row] = await db
      .select()
      .from(schema.feedbackAdmins)
      .where(eq(schema.feedbackAdmins.userId, userId));
    return Boolean(row);
  }

  async function results(slug: string, versionId?: string, member?: string) {
    const survey = await getSurvey(slug, true);
    const versions = await db
      .select({
        id: schema.surveyVersions.id,
        version: schema.surveyVersions.version,
        publishedAt: schema.surveyVersions.publishedAt,
      })
      .from(schema.surveyVersions)
      .where(eq(schema.surveyVersions.surveyId, survey.id))
      .orderBy(desc(schema.surveyVersions.version));
    const id = versionId ?? survey.versionId;
    const [version] = await db
      .select()
      .from(schema.surveyVersions)
      .where(and(eq(schema.surveyVersions.surveyId, survey.id), eq(schema.surveyVersions.id, id)));
    if (!version) throw new FeedbackError(404, "Definition version not found.");
    const rows = await db
      .select({
        id: schema.surveyResponses.id,
        definitionVersionId: schema.surveyResponses.definitionVersionId,
        answers: schema.surveyResponses.answers,
        selectedInstructorIds: schema.surveyResponses.selectedInstructorIds,
        createdAt: schema.surveyResponses.createdAt,
      })
      .from(schema.surveyResponses)
      .where(
        and(
          eq(schema.surveyResponses.surveyId, survey.id),
          eq(schema.surveyResponses.definitionVersionId, id),
        ),
      )
      .orderBy(desc(schema.surveyResponses.createdAt));
    const responses: StoredResponse[] = rows
      .map((r) => ({
        ...r,
        answers: r.answers as Answers,
        selectedInstructorIds: r.selectedInstructorIds as string[],
        createdAt: r.createdAt.toISOString(),
      }))
      .filter((r) => !member || r.answers.member_status === member);
    return {
      survey,
      definition: definitionSchema.parse(version.definition),
      versions,
      versionId: id,
      responses,
    };
  }

  async function changeState(slug: string, state: "open" | "closed", actorId: string) {
    return db.transaction(async (tx) => {
      const [survey] = await tx
        .select()
        .from(schema.surveys)
        .where(eq(schema.surveys.slug, slug))
        .for("update");
      if (!survey?.activeVersionId) throw new FeedbackError(404, "Published survey not found.");
      await tx.update(schema.surveys).set({ state }).where(eq(schema.surveys.id, survey.id));
      await tx.insert(schema.feedbackAudit).values({ surveyId: survey.id, actorId, action: state });
      return { state };
    });
  }
  return { getSurvey, submit, isAdmin, results, changeState };
}
export type FeedbackStore = ReturnType<typeof createFeedbackStore>;
