import type { FeedbackStore } from "./feedback-store";
import type { ApiEnv, GetSession } from "./session";

import { responsesCsv } from "@repo/shared/feedback-results";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { FeedbackError } from "./feedback-store";
import { createRequireSession } from "./session";

export function createFeedbackRoutes(
  store: FeedbackStore,
  getSession: GetSession,
  origins: string[],
) {
  const routes = new Hono<ApiEnv>();
  routes.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    if (c.req.method === "POST") {
      const origin = c.req.header("Origin");
      if (
        (origin && !origins.includes(origin)) ||
        !c.req.header("Content-Type")?.toLowerCase().startsWith("application/json")
      )
        throw new HTTPException(403, { message: "Untrusted request." });
    }
    await next();
  });
  routes.use(
    "*",
    bodyLimit({
      maxSize: 64 * 1024,
      onError: (c) => c.json({ error: "Submission is too large." }, 413),
    }),
  );
  routes.get("/feedback/:slug", async (c) => c.json(await store.getSurvey(c.req.param("slug"))));
  routes.post("/feedback/:slug/responses", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new FeedbackError(400, "Invalid JSON body.");
    }
    const survey = await store.getSurvey(c.req.param("slug"));
    if (!body || typeof body !== "object" || !("surveyId" in body) || body.surveyId !== survey.id)
      throw new FeedbackError(400, "Survey does not match this form.");
    return c.json(await store.submit(body));
  });
  routes.use("/admin/*", createRequireSession(getSession));
  routes.use("/admin/*", async (c, next) => {
    if (!(await store.isAdmin(c.get("user").id)))
      throw new HTTPException(403, { message: "EXCO access is required." });
    await next();
  });
  const filters = z.object({
    version: z.string().uuid().optional(),
    member: z.enum(["junior", "senior", "alumni"]).optional(),
  });
  routes.get("/admin/feedback/:slug", async (c) => {
    const filter = filters.parse(c.req.query());
    return c.json(await store.results(c.req.param("slug"), filter.version, filter.member));
  });
  routes.get("/admin/feedback/:slug/export", async (c) => {
    const filter = filters.parse(c.req.query());
    const data = await store.results(c.req.param("slug"), filter.version, filter.member);
    c.header("Content-Disposition", 'attachment; filename="ardiente-feedback.csv"');
    c.header("Content-Type", "text/csv; charset=utf-8");
    return c.body(responsesCsv(data.definition, data.responses));
  });
  routes.post("/admin/feedback/:slug/state", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new FeedbackError(400, "Invalid JSON body.");
    }
    const parsed = z
      .object({ state: z.enum(["open", "closed"]) })
      .strict()
      .parse(body);
    return c.json(await store.changeState(c.req.param("slug"), parsed.state, c.get("user").id));
  });
  routes.onError((err, c) => {
    if (err instanceof FeedbackError)
      return c.json({ error: err.message, fields: err.fields }, err.status);
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    if (err instanceof z.ZodError) return c.json({ error: "Invalid request parameters." }, 400);
    // Database errors can contain parameters; never log them or private answers.
    console.error(`[Feedback Error] ${c.get("requestId")}: operation failed`);
    return c.json({ error: "Feedback is temporarily unavailable. Please try again." }, 500);
  });
  return routes;
}
