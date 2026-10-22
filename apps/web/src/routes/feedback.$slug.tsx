import { createFileRoute } from "@tanstack/react-router";

import { FeedbackPage } from "../features/feedback/feedback-page";
export const Route = createFileRoute("/feedback/$slug")({ component: Page });
function Page() {
  const { slug } = Route.useParams();
  return <FeedbackPage key={slug} slug={slug} />;
}
