import { createRequire } from "node:module";
const require = createRequire(new URL("../../packages/db/package.json", import.meta.url));
const postgres = require("postgres");

export default async function teardown() {
  const databaseName = process.env.FEEDBACK_E2E_DATABASE_NAME;
  if (!databaseName || !/^feedback_e2e_[a-f0-9]+$/u.test(databaseName))
    throw new Error("Refusing to clean up an unrecognised test database.");
  const client = postgres(
    process.env.TEST_DATABASE_URL ?? "postgres://postgres:password@localhost:5433/app_test",
    { max: 1, prepare: false },
  );
  try {
    await client`drop database if exists ${client(databaseName)} with (force)`;
  } finally {
    await client.end();
  }
}
