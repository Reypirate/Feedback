import { createFileRoute } from "@tanstack/react-router";

import { AdminPage } from "../features/feedback/admin-page";
export const Route = createFileRoute("/admin")({ component: AdminPage });
