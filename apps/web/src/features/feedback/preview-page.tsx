import type { PublicSurvey } from "@repo/shared/feedback";

import { createFeedbackDefinition } from "@repo/shared/feedback";

import { SurveyForm } from "./feedback-page";

const preview: PublicSurvey = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "ardiente",
  state: "open",
  versionId: "00000000-0000-4000-8000-000000000002",
  definition: createFeedbackDefinition(),
};
export function PreviewPage() {
  return (
    <>
      <p className="preview-notice">Form preview · Responses aren’t saved.</p>
      <SurveyForm survey={preview} preview />
    </>
  );
}
