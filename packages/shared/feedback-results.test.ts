import type { StoredResponse } from "./feedback";

import { describe, expect, it } from "vitest";

import { createFeedbackDefinition } from "./feedback";
import { csvCell, distribution, responsesCsv } from "./feedback-results";
const definition = createFeedbackDefinition();
const responses: StoredResponse[] = [
  {
    id: "a",
    definitionVersionId: "v1",
    createdAt: "2026-10-22",
    selectedInstructorIds: [],
    answers: { pt_attendance: "never", tuesday_feasibility: "depends_on_timetable" },
  },
  {
    id: "b",
    definitionVersionId: "v1",
    createdAt: "2026-10-22",
    selectedInstructorIds: [],
    answers: {
      pt_attendance: "often",
      pt_value: "insufficient_experience",
      tuesday_feasibility: "yes",
      attendance_barriers: ["travel", "other"],
    },
  },
];
describe("results", () => {
  it("preserves uncertain responses in the feasibility denominator", () => {
    const q = definition.questions.find((q) => q.id === "tuesday_feasibility")!;
    expect(
      distribution(definition, responses, q).options.find((o) => o.id === "yes"),
    ).toMatchObject({ count: 1, percent: 50 });
    expect(distribution(definition, [], q).options[0]?.percent).toBeNull();
  });
  it("separates hidden, skipped and insufficient experience", () => {
    const q = definition.questions.find((q) => q.id === "pt_value")!;
    expect(distribution(definition, responses, q)).toMatchObject({
      asked: 1,
      answered: 1,
      skipped: 0,
      notAsked: 1,
    });
    const barriers = definition.questions.find((q) => q.id === "attendance_barriers")!;
    expect(distribution(definition, responses, barriers)).toMatchObject({
      answered: 1,
      skipped: 1,
    });
  });
  it("escapes CSV text and neutralises formulas including whitespace and control prefixes", () => {
    for (const text of ["=1+1", "  +1", "-1", "@SUM(A1)", "\ttext", "\rtext"])
      expect(csvCell(text)).toContain("'");
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(responsesCsv(definition, responses)).toContain("[Not asked]");
    expect(responsesCsv(definition, responses)).toContain("[Skipped]");
  });
});
