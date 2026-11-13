import type { ApiEnv } from "./session";
import type { Hono } from "hono";

import { createApp } from "./app-factory";
import { createAuth } from "./auth";
import { db } from "./db";
import { env } from "./env";
import { createFeedbackStore } from "./feedback-store";
import { sendMail } from "./mailer";

const auth = createAuth(env, db, sendMail);
const { app } = createApp({
  env,
  feedback: createFeedbackStore(db),
  auth: {
    handler: (request) => auth.handler(request),
    getSession: (headers) => auth.api.getSession({ headers }),
  },
});

// Vercel's Hono adapter consumes the app directly; Bun's combined server wraps it.
export default app satisfies Hono<ApiEnv>;
