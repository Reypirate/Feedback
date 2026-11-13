/// <reference types="node" />

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index";
import { supabaseRootCertificate } from "./supabase-certificate";

import { readFileSync } from "node:fs";

export const createDb = (url: string, options?: postgres.Options<Record<string, never>>) => {
  const connectionUrl = new URL(url);
  const certificate = connectionUrl.searchParams.get("sslrootcert");
  connectionUrl.searchParams.delete("sslrootcert");
  const hostedSupabase =
    connectionUrl.hostname.endsWith(".supabase.co") ||
    connectionUrl.hostname.endsWith(".pooler.supabase.com");
  const ssl =
    certificate && certificate !== "system"
      ? { ca: readFileSync(certificate, "utf8"), rejectUnauthorized: true }
      : hostedSupabase
        ? { ca: supabaseRootCertificate, rejectUnauthorized: true }
        : undefined;
  return drizzle(
    postgres(connectionUrl.toString(), {
      prepare: false,
      ...(hostedSupabase ? { max_pipeline: 1 } : {}),
      ...(ssl ? { ssl } : {}),
      ...options,
    }),
    { schema },
  );
};

export { schema };
export * from "drizzle-orm";
