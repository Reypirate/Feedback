import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  createFeedbackDefinition,
  validateAnswers,
  visibleAnswers,
} from "./feedback";

const definition = createFeedbackDefinition();
export const minimalAnswers = {
  member_status: "junior",
  schedule_fit: { wed_1930: "very_well", wed_2100: "neutral", sat_0930: "not_at_all" },
  session_attendance: { wed_1930: "always", wed_2100: "often", sat_0930: "never" },
  weekday_preference: "no_preference",
  tuesday_feasibility: "depends_on_timetable",
  senior_class_interest: "not_applicable",
  pt_attendance: "never",
  pt_timing: "unsure",
};
describe("feedback validation", () => {
  it("accepts a complete response with all comments and instructors skipped", () => {
    expect(validateAnswers(definition, minimalAnswers, []).errors).toEqual({});
  });
  it("requires every matrix row and visible PT usefulness", () => {
    const result = validateAnswers(
      definition,
      { ...minimalAnswers, schedule_fit: { wed_1930: "very_well" }, pt_attendance: "often" },
      [],
    );
    expect(Object.keys(result.errors).sort()).toEqual(["pt_value", "schedule_fit"]);
  });
  it("discards hidden answers both for storage and review", () => {
    const input = {
      ...minimalAnswers,
      pt_value: "very_useful",
      rosario_well: "Private",
      attendance_barriers_other: "Other",
    };
    expect(validateAnswers(definition, input, []).answers).toEqual(minimalAnswers);
    expect(visibleAnswers(definition, input, [])).toEqual(minimalAnswers);
  });
  it("rejects unknown fields, options, duplicate checkbox values, types and long text", () => {
    const { errors } = validateAnswers(
      definition,
      {
        ...minimalAnswers,
        invented: "yes",
        member_status: "admin",
        attendance_barriers: ["travel", "travel"],
        exco_well: "x".repeat(2001),
        pt_timing: {},
      },
      [],
    );
    expect(Object.keys(errors).sort()).toEqual([
      "attendance_barriers",
      "exco_well",
      "invented",
      "member_status",
      "pt_timing",
    ]);
  });
  it("does not require comments after choosing an instructor or Other", () => {
    expect(
      validateAnswers(definition, { ...minimalAnswers, attendance_barriers: ["other"] }, ["joy"])
        .errors,
    ).toEqual({});
  });
  it("validates only the current step during navigation", () => {
    expect(validateAnswers(definition, { member_status: "alumni" }, [], 0).errors).toEqual({});
  });
  it("canonicalises unordered choices and object keys", () => {
    const a = validateAnswers(
      definition,
      { ...minimalAnswers, attendance_barriers: ["travel", "other"], exco_well: "  Hello  " },
      [],
    ).answers;
    const b = validateAnswers(
      definition,
      { exco_well: "Hello", attendance_barriers: ["other", "travel"], ...minimalAnswers },
      [],
    ).answers;
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
});
