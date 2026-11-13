import { serveStatic } from "hono/bun";

import { env } from "./env";
import app from "./server";

if (env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: env.STATIC_ROOT }));
  app.get("*", serveStatic({ path: `${env.STATIC_ROOT}/index.html` }));
}

export type { ApiRoutes } from "./app-factory";

export default {
  fetch: app.fetch,
  port: env.PORT,
};
