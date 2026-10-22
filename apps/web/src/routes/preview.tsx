import { createFileRoute } from "@tanstack/react-router";

import { PreviewPage } from "../features/feedback/preview-page";
export const Route = createFileRoute("/preview")({ component: PreviewPage });
