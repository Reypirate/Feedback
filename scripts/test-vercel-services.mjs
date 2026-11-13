import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const metadata = JSON.parse(
  readFileSync(new URL("../node_modules/vercel/package.json", import.meta.url), "utf8"),
);
const binary =
  typeof metadata.bin === "string" ? metadata.bin : (metadata.bin.vercel ?? metadata.bin.vc);
const cli = fileURLToPath(new URL(`../node_modules/vercel/${binary}`, import.meta.url));
const origin = "http://127.0.0.1:4310";
let log = "";
const logPath = join(tmpdir(), `ardiente-vercel-${process.pid}.log`);
writeFileSync(logPath, "");
const child = spawn(
  process.execPath,
  [cli, "dev", "--local", "--listen", "127.0.0.1:4310", "--yes"],
  {
    cwd: root,
    detached: process.platform !== "win32",
    windowsHide: true,
    env: {
      ...process.env,
      VERCEL_TELEMETRY_DISABLED: "1",
      DATABASE_URL: "postgres://postgres:password@127.0.0.1:5432/vercel_smoke_unused",
      BETTER_AUTH_SECRET: "vercel-routing-test-only-secret-at-least-32-characters",
      BETTER_AUTH_URL: `${origin}/api/auth`,
      VITE_APP_URL: origin,
      VITE_API_URL: origin,
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      SMTP_HOST: "",
      SMTP_PORT: "",
      SMTP_FROM: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
for (const stream of [child.stdout, child.stderr])
  stream.on("data", (chunk) => {
    log += chunk.toString();
    appendFileSync(logPath, chunk);
  });
console.log(
  "Starting Vercel services with test-only configuration; no deployment or database writes.",
);

async function ready() {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vercel exited with ${child.exitCode}.\n${log}`);
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(2000) });
      const body = await response.text();
      if (response.ok && JSON.parse(body).status === "ok") return;
    } catch {
      /* Both framework development servers need time to start. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Vercel services did not become ready.\n${log}`);
}

try {
  await ready();
  for (const path of ["/api", "/api/not-a-route"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 404, path);
    assert.deepEqual(await response.json(), { error: "Not Found" });
  }
  for (const path of ["/", "/admin", "/feedback/ardiente"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /<title>Ardiente feedback<\/title>/u);
  }
  const runtime = await fetch(`${origin}/api/runtime.js`);
  const script = await runtime.text();
  assert.equal(runtime.status, 200);
  assert.equal(runtime.headers.get("cache-control"), "no-store");
  assert.ok(script.includes(origin));
  assert.ok(!script.includes("BETTER_AUTH_SECRET"));
  assert.ok(!script.includes("DATABASE_URL"));
  for (const path of ["/src/main.tsx", "/@vite/client", "/@react-refresh"]) {
    const asset = await fetch(`${origin}${path}`);
    assert.equal(asset.status, 200, path);
    assert.match(asset.headers.get("content-type") ?? "", /javascript/u, path);
    const source = await asset.text();
    assert.ok(source.trim().length > 0, path);
    assert.doesNotMatch(source, /^\s*<!doctype html/iu, path);
  }
  console.log(
    "Vercel service routing passed: API paths, JSON 404s, SPA links, runtime settings and frontend assets.",
  );
} finally {
  if (child.pid) {
    if (process.platform === "win32")
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* Already stopped. */
      }
    }
  }
}
