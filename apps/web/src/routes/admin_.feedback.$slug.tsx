import { createFileRoute } from "@tanstack/react-router";

import { AdminPage } from "../features/feedback/admin-page";
export const Route = createFileRoute("/admin_/feedback/$slug")({ component: Page });
function Page() {
  const { slug } = Route.useParams();
  return <AdminPage slug={slug} />;
}
