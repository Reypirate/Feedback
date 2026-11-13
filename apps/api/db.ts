import { createDb } from "@repo/db";

import { env } from "./env";

export const db = createDb(env.DATABASE_URL, {
  max: process.env.VERCEL === "1" ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
});
