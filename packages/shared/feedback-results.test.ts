import type { StoredResponse } from "./feedback";

import { describe, expect, it } from "vitest";

import { createFeedbackDefinition } from "./feedback";
import { csvCell, distribution, readingCheck, responsesCsv } from "./feedback-results";
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
  it("flags a reading mismatch without treating it as a rating and preserves identity in CSV", () => {
    const response = {
      ...responses[0],
      answers: {
        respondent_name: "Test Member",
        telegram_username: "@member",
        reading_note: " RHYTHM ",
        data_consent: ["agree"],
      },
    };
    expect(readingCheck(definition, response)).toBe("Reading check matched");
    expect(readingCheck(definition, { ...response, answers: { reading_note: "other" } })).toBe(
      "Reading check needs review",
    );
    const csv = responsesCsv(definition, [response]);
    expect(csv).toContain("Test Member");
    expect(csv).toContain("telegram_username");
    const legacy = {
      ...definition,
      questions: definition.questions.filter((question) => !question.attentionAnswer),
    };
    expect(readingCheck(legacy, response)).toBeNull();
  });
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
