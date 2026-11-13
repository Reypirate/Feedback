import Ajv from "ajv";

import { readFileSync } from "node:fs";

const schemaPath = process.argv[2];
const schema = schemaPath
  ? JSON.parse(readFileSync(schemaPath, "utf8"))
  : await fetch("https://openapi.vercel.sh/vercel.json", {
      signal: AbortSignal.timeout(15_000),
    }).then((response) => {
      if (!response.ok) throw new Error(`Vercel schema download failed: ${response.status}`);
      return response.json();
    });
const configuration = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
// The published schema declares draft-04 but uses newer numeric exclusive bounds.
// Evaluate its unchanged constraints with draft-07 rather than its outdated declaration.
delete schema.$schema;
const validator = new Ajv({ strict: false, allErrors: true, validateFormats: false }).compile(
  schema,
);
if (!validator(configuration)) {
  console.error(validator.errors);
  process.exitCode = 1;
} else {
  console.log(`Vercel configuration is valid: ${Object.keys(configuration.services).join(", ")}.`);
}
