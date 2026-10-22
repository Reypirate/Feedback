import { afterEach, describe, expect, it, vi } from "vitest";

import { feedbackRequest } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("feedback API responses", () => {
  it("reports empty proxy responses without leaking a JSON parsing error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(feedbackRequest("/feedback/ardiente")).rejects.toMatchObject({
      status: 500,
      message: "The form service is unavailable. Please try again later.",
    });
  });
  it("rejects an empty success or HTML response as an unavailable service", async () => {
    for (const body of ["", "<!doctype html><html>Not found</html>"]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
      await expect(feedbackRequest("/feedback/ardiente")).rejects.toMatchObject({ status: 502 });
    }
  });
  it("preserves structured validation errors for editable failed submissions", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: "Check your answers.", fields: { member_status: "Required" } },
            { status: 422 },
          ),
        ),
    );
    await expect(feedbackRequest("/feedback/ardiente")).rejects.toMatchObject({
      status: 422,
      fields: { member_status: "Required" },
    });
  });
  it("returns valid JSON and handles unreachable services", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ receipt: "saved" })));
    expect(await feedbackRequest("/feedback/ardiente")).toEqual({ receipt: "saved" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(feedbackRequest("/feedback/ardiente")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("couldn’t be reached"),
    });
  });
});
