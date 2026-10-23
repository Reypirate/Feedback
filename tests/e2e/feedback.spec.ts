import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

async function expectScalesFit(page: Page) {
  const overflow = await page.locator(".scale").evaluateAll((scales) =>
    scales.flatMap((scale) => {
      const bounds = scale.getBoundingClientRect();
      return [...scale.querySelectorAll("label")]
        .filter((option) => {
          const rect = option.getBoundingClientRect();
          return rect.right > bounds.right + 1 || rect.left < bounds.left - 1;
        })
        .map((option) => option.textContent);
    }),
  );
  expect(overflow).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

async function requiredJourney(page: Page, instructor = false) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ardiente Training & Club Feedback" }),
  ).toBeVisible();
  if (instructor)
    await page.screenshot({ path: "test-results/ardiente-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Start form" }).click();
  if (instructor)
    await page.screenshot({ path: "test-results/ardiente-mobile-form.png", fullPage: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Please answer this question");
  await page
    .getByRole("radio", { name: "Senior — Member for one year or more", exact: true })
    .check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Training schedule", exact: true })).toBeVisible();
  await expectScalesFit(page);
  const fit = page.locator("#question-schedule_fit");
  for (const row of await fit.getByRole("group").all())
    await row.getByRole("radio", { name: "Very well", exact: true }).check();
  const attendance = page.locator("#question-session_attendance");
  for (const row of await attendance.getByRole("group").all())
    await row.getByRole("radio", { name: "Often", exact: true }).check();
  await page.getByRole("radio", { name: "No preference", exact: true }).check();
  await page
    .getByRole("radio", { name: "It would depend on my timetable for that semester", exact: true })
    .check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Senior classes", exact: true })).toBeVisible();
  await expectScalesFit(page);
  await page
    .getByRole("radio", { name: "Not applicable to me at this stage", exact: true })
    .check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Wednesday PT", exact: true })).toBeVisible();
  await expectScalesFit(page);
  await page.getByRole("radio", { name: "Often", exact: true }).check();
  await page.getByRole("radio", { name: "Very useful", exact: true }).check();
  await page.getByRole("radio", { name: "I have not attended PT", exact: true }).check();
  await expect(page.getByRole("radio", { name: "Very useful", exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Unsure", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  if (instructor) {
    await page.getByRole("checkbox", { name: "Joy", exact: true }).check();
    await page
      .getByRole("textbox", {
        name: "What has Joy done well, and what would you like Joy to continue doing?",
        exact: true,
      })
      .fill("Clear demonstrations — browser test.");
    page.once("dialog", (dialog) => void dialog.dismiss());
    await page.getByRole("checkbox", { name: "Joy", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Joy", exact: true })).toBeChecked();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("checkbox", { name: "Joy", exact: true }).uncheck();
    await page.getByRole("checkbox", { name: "Joy", exact: true }).check();
    await expect(
      page.getByRole("textbox", {
        name: "What has Joy done well, and what would you like Joy to continue doing?",
        exact: true,
      }),
    ).toHaveValue("");
    await page
      .getByRole("textbox", {
        name: "What has Joy done well, and what would you like Joy to continue doing?",
        exact: true,
      })
      .fill("Clear demonstrations — browser test.");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  } else await page.getByRole("button", { name: "Skip instructor feedback" }).click();
  await page.getByRole("button", { name: "Review answers" }).click();
  await expect(page.getByRole("heading", { name: "Review your answers" })).toBeVisible();
  await expect(
    page.getByText("How useful have the PT sessions been in supporting your dance training?", {
      exact: true,
    }),
  ).toHaveCount(0);
}

test("a member submits with all written and instructor feedback skipped and sees durable results", async ({
  page,
  request,
}) => {
  await requiredJourney(page);
  await page.getByRole("button", { name: "Edit About you", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Senior — Member for one year or more", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Submit feedback", exact: true }).click();
  await expect(
    page.getByText("Your response has been saved. You can safely close this tab."),
  ).toBeVisible();
  const receipt = await page.locator(".receipt code").textContent();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ardiente Training & Club Feedback" }),
  ).toBeVisible();
  const signin = await request.post("/api/auth/sign-in/email", {
    data: { email: "exco@example.test", password: "e2e-only-password-12345" },
    headers: { Origin: "http://127.0.0.1:4101" },
  });
  expect(signin.status()).toBe(200);
  const result = await request.get("/api/admin/feedback/ardiente");
  expect((await result.json()).responses.some((r: { id: string }) => r.id === receipt)).toBe(true);
});

test("mobile instructor journey recovers a committed submission after a lost response", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await requiredJourney(page, true);
  let dropped = false;
  const envelopes: string[] = [];
  await page.route("**/api/feedback/ardiente/responses", async (route) => {
    envelopes.push(route.request().postData() ?? "");
    if (!dropped) {
      dropped = true;
      await route.fetch();
      await route.abort("connectionreset");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Submit feedback", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry submission" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit About you", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Retry submission" }).click();
  await expect(
    page.getByText("Your response has been saved. You can safely close this tab."),
  ).toBeVisible();
  expect(envelopes).toHaveLength(2);
  expect(envelopes[0]).toBe(envelopes[1]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("EXCO signs in, reviews persisted feedback, filters and exports CSV", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Email", { exact: true }).fill("exco@example.test");
  await page.getByLabel("Password", { exact: true }).fill("e2e-only-password-12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Survey responses" })).toBeVisible();
  await page.getByLabel("Membership").selectOption("junior");
  await expect(page.getByRole("heading", { name: "No responses in this view yet." })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("ardiente-feedback.csv");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.request.post("/api/auth/sign-up/email", {
    data: {
      email: "member@example.test",
      password: "e2e-member-password-12345",
      name: "Ordinary member",
    },
    headers: { Origin: "http://127.0.0.1:4101" },
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "EXCO access required." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Survey responses" })).toHaveCount(0);
});

test("keyboard navigation and navigation warning preserve the active draft", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start form" }).click();
  await expect(page.getByRole("heading", { name: "About you", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("radio", { name: "Junior — Member for less than one year", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Space");
  page.once("dialog", (dialog) => void dialog.dismiss());
  await page.getByRole("link", { name: "EXCO access", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Junior — Member for less than one year", exact: true }),
  ).toBeChecked();
});

test("an empty API response offers a working preview without submitting anything", async ({
  page,
}) => {
  const submissions: string[] = [];
  await page.route("**/api/feedback/ardiente", (route) => route.fulfill({ status: 500, body: "" }));
  page.on("request", (request) => {
    if (request.url().endsWith("/responses")) submissions.push(request.method());
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("The form service is unavailable");
  await page.getByRole("link", { name: "Preview form", exact: true }).click();
  await expect(page.getByText("Form preview · Responses aren’t saved.")).toBeVisible();
  await page.getByRole("button", { name: "Start form", exact: true }).click();
  await expect(page.getByRole("heading", { name: "About you", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Alumni", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Training schedule", exact: true })).toBeVisible();
  expect(submissions).toEqual([]);
});

test("the cloud background can be paused and supports reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview");
  await expect(
    page.getByRole("heading", { name: "Ardiente Training & Club Feedback" }),
  ).toBeVisible();
  await expect(page.locator(".cloud-background canvas")).toHaveAttribute("aria-hidden", "true");
  await page.getByRole("button", { name: "Pause cloud animation", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play cloud animation", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/ardiente-cloud-preview.png", fullPage: true });
});

test("rating controls stay inside the form on small phones", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await requiredJourney(page);
});

test("review identifies required PT answers and counts only skipped optional questions", async ({
  page,
}) => {
  await requiredJourney(page);
  const exco = page
    .locator(".review-section")
    .filter({ has: page.getByRole("heading", { name: "17th EXCO", exact: true }) });
  await expect(exco).toContainText("3 optional questions skipped");
  await page.getByRole("button", { name: "Edit Wednesday PT", exact: true }).click();
  await page
    .locator("#question-pt_attendance")
    .getByRole("radio", { name: "Often", exact: true })
    .check();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  const pt = page
    .locator(".review-section")
    .filter({ has: page.getByRole("heading", { name: "Wednesday PT", exact: true }) });
  await expect(pt).toContainText(
    "How useful have the PT sessions been in supporting your dance training?",
  );
  await expect(pt).toContainText("Required answer missing");
  await expect(pt).toContainText("1 optional question skipped");
  await page.getByRole("button", { name: "Submit feedback", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Please answer this question.");
  await page.getByRole("button", { name: "Edit Wednesday PT", exact: true }).click();
  await page
    .locator("#question-pt_value")
    .getByRole("radio", { name: "Very useful", exact: true })
    .check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(pt).not.toContainText("Required answer missing");
  await expect(pt).toContainText("Very useful");
});
