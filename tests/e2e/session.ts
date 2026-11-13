import type { Page } from "@playwright/test";

import { readFileSync } from "node:fs";

export function sessionCookie(role: "reader" | "admin" | "member"): string {
  const name = process.env.FEEDBACK_E2E_DATABASE_NAME;
  if (!name || !/^feedback_e2e_[a-f0-9]+$/u.test(name))
    throw new Error("Isolated browser test session required.");
  return JSON.parse(readFileSync(`test-results/${name}-sessions.json`, "utf8"))[role];
}

export async function useSession(page: Page, role: "admin" | "member") {
  await page.context().addCookies(
    sessionCookie(role)
      .split("; ")
      .map((cookie) => {
        const separator = cookie.indexOf("=");
        return {
          name: cookie.slice(0, separator),
          value: cookie.slice(separator + 1),
          url: "http://127.0.0.1:4101",
          httpOnly: true,
          sameSite: "Lax" as const,
        };
      }),
  );
}
