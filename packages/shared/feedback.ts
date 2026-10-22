import { z } from "zod";

const optionSchema = z.object({ id: z.string().min(1), label: z.string().min(1) }).strict();
const questionSchema = z
  .object({
    id: z.string().min(1),
    number: z.number().int().positive(),
    section: z.number().int().min(0).max(5),
    type: z.enum(["radio", "checkboxes", "textarea", "matrix"]),
    label: z.string().min(1),
    required: z.boolean(),
    help: z.string().optional(),
    options: z.array(optionSchema).optional(),
    rows: z.array(optionSchema).optional(),
    instructor: z.string().optional(),
    hideWhen: z.object({ question: z.string(), value: z.string() }).strict().optional(),
    showWhenSelected: z.object({ question: z.string(), value: z.string() }).strict().optional(),
  })
  .strict();
export const definitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().min(1),
    term: z.string().min(1),
    timezone: z.literal("Asia/Singapore"),
    exco: z.number().int().positive(),
    instructors: z.array(optionSchema),
    sections: z.array(z.object({ title: z.string(), description: z.string() }).strict()).length(6),
    questions: z.array(questionSchema).min(1),
  })
  .strict()
  .superRefine((definition, ctx) => {
    const ids = definition.questions.map((q) => q.id);
    const unique = (values: string[]) => new Set(values).size === values.length;
    if (!unique(ids) || !unique(definition.instructors.map((i) => i.id)))
      ctx.addIssue({ code: "custom", message: "IDs must be unique" });
    for (const q of definition.questions) {
      if (q.type !== "textarea" && (!q.options?.length || !unique(q.options.map((o) => o.id))))
        ctx.addIssue({ code: "custom", message: `Invalid options: ${q.id}` });
      if (q.type === "matrix" && (!q.rows?.length || !unique(q.rows.map((r) => r.id))))
        ctx.addIssue({ code: "custom", message: `Invalid rows: ${q.id}` });
      if (q.instructor && !definition.instructors.some((i) => i.id === q.instructor))
        ctx.addIssue({ code: "custom", message: `Unknown instructor: ${q.id}` });
      for (const condition of [q.hideWhen, q.showWhenSelected]) {
        if (!condition) continue;
        const parent = definition.questions.find((p) => p.id === condition.question);
        // Conditions only reference earlier unconditional questions, preventing cycles.
        if (
          !parent ||
          definition.questions.indexOf(parent) >= definition.questions.indexOf(q) ||
          parent.hideWhen ||
          parent.showWhenSelected ||
          parent.instructor ||
          !parent.options?.some((o) => o.id === condition.value)
        )
          ctx.addIssue({ code: "custom", message: `Invalid condition: ${q.id}` });
      }
    }
  });
export type Definition = z.infer<typeof definitionSchema>;
export type Question = Definition["questions"][number];
export type Answers = Record<string, string | string[] | Record<string, string>>;
export type FieldErrors = Record<string, string>;
const opts = (values: [string, string][]) => values.map(([id, label]) => ({ id, label }));
export const attendance = opts([
  ["always", "Always or almost always"],
  ["often", "Often"],
  ["sometimes", "Sometimes"],
  ["rarely", "Rarely"],
  ["never", "Never"],
]);
const slots = opts([
  ["wed_1930", "Wednesday 7:30pm–9pm · Rumba Technique"],
  ["wed_2100", "Wednesday 9pm–10:30pm · Cha Technique"],
  ["sat_0930", "Saturday 9:30am–11am · Cha Open Technique"],
]);
const instructors = opts([
  ["rosario", "Rosario"],
  ["azri", "Azri"],
  ["joy", "Joy"],
]);
const question = (
  number: number,
  section: number,
  id: string,
  type: Question["type"],
  label: string,
  required = false,
  extra: Partial<Question> = {},
): Question => ({ number, section, id, type, label, required, ...extra });

export function createFeedbackDefinition(term = "Current semester"): Definition {
  return definitionSchema.parse({
    schemaVersion: 1,
    title: "Ardiente Training & Club Feedback",
    term,
    timezone: "Asia/Singapore",
    exco: 17,
    instructors,
    sections: [
      {
        title: "About you",
        description: "A little context helps us understand our members’ needs.",
      },
      {
        title: "Training schedule",
        description:
          "All current training sessions are open to everyone. The class names below refer to this semester, as our dance genres change each semester.",
      },
      {
        title: "Senior classes",
        description:
          "We’d like to understand whether members are interested in dedicated senior classes when planning future training.",
      },
      {
        title: "Wednesday PT",
        description:
          "Our current PT sessions run on Wednesdays, 7:15pm–7:30pm, before dance training.",
      },
      {
        title: "Instructor feedback",
        description:
          "This entire section is optional. Please answer only for instructors you have trained with this semester. Specific examples are helpful. You may comment on explanations, demonstrations, pacing, choreography, individual corrections, encouragement and opportunities to ask questions.",
      },
      {
        title: "17th EXCO",
        description:
          "We’d appreciate your feedback on your experience in Ardiente under the 17th EXCO. You may comment on communication, training arrangements, events, member support or the overall club experience.",
      },
    ],
    questions: [
      question(
        1,
        0,
        "member_status",
        "radio",
        "Which best describes your current membership status in Ardiente?",
        true,
        {
          options: opts([
            ["junior", "Junior — Member for less than one year"],
            ["senior", "Senior — Member for one year or more"],
            ["alumni", "Alumni"],
          ]),
        },
      ),
      question(
        2,
        1,
        "schedule_fit",
        "matrix",
        "How well do the current training times work for you?",
        true,
        {
          rows: slots,
          options: opts([
            ["very_well", "Very well"],
            ["somewhat_well", "Somewhat well"],
            ["neutral", "Neutral"],
            ["not_very_well", "Not very well"],
            ["not_at_all", "Not at all"],
          ]),
        },
      ),
      question(
        3,
        1,
        "session_attendance",
        "matrix",
        "How often have you attended each training session this semester?",
        true,
        {
          rows: slots,
          options: attendance,
          help: "Your self-reported frequency, rather than attendance-register percentages.",
        },
      ),
      question(
        4,
        1,
        "attendance_barriers",
        "checkboxes",
        "What makes it difficult for you to attend training regularly or stay for the full session?",
        false,
        {
          help: "Select all that apply. Skip this question if you have no difficulties attending.",
          options: opts([
            ["academic_workload", "Academic workload"],
            ["commitment_clash", "Clashes with classes, work, other CCAs or personal commitments"],
            ["late_wednesday", "The late Wednesday finishing time"],
            ["early_saturday", "The early Saturday starting time"],
            ["travel", "Long journey or transport arrangements"],
            ["early_thursday", "Early commitments on Thursday morning"],
            ["consecutive_fatigue", "Tiredness from attending two consecutive Wednesday sessions"],
            ["learning_fit", "The class content or difficulty does not suit my learning needs"],
            ["other", "Other"],
          ]),
        },
      ),
      question(
        4,
        1,
        "attendance_barriers_other",
        "textarea",
        "Other attendance difficulties",
        false,
        { showWhenSelected: { question: "attendance_barriers", value: "other" } },
      ),
      question(
        5,
        1,
        "weekday_preference",
        "radio",
        "Which weekday training arrangement would work better for you?",
        true,
        {
          help: "Please consider the timings independently of the dance genres, as genres change each semester.",
          options: opts([
            ["both_wednesday", "Two Wednesday sessions — 7:30pm–9pm and 9pm–10:30pm"],
            [
              "split_tuesday_wednesday",
              "Sessions split across Tuesday and Wednesday — 7:30pm–9pm on each day",
            ],
            ["no_preference", "No preference"],
            ["neither", "Neither arrangement works well for me"],
          ]),
        },
      ),
      question(
        6,
        1,
        "tuesday_feasibility",
        "radio",
        "If one weekday session moved to Tuesday, 7:30pm–9pm, would you be able to attend regularly?",
        true,
        {
          options: opts([
            ["yes", "Yes"],
            ["no", "No"],
            ["depends_on_timetable", "It would depend on my timetable for that semester"],
            ["unsure", "Unsure"],
          ]),
        },
      ),
      question(
        7,
        1,
        "schedule_comments",
        "textarea",
        "Do you have any other feedback or suggestions about training days and times?",
        false,
        {
          help: "You may explain your answers above, comment on Saturday training, or suggest alternative arrangements.",
        },
      ),
      question(
        8,
        2,
        "senior_class_interest",
        "radio",
        "How interested would you be in attending dedicated senior classes if offered?",
        true,
        {
          options: opts([
            ["very_interested", "Very interested"],
            ["somewhat_interested", "Somewhat interested"],
            ["neutral", "Neutral"],
            ["not_very_interested", "Not very interested"],
            ["not_interested", "Not interested at all"],
            ["not_applicable", "Not applicable to me at this stage"],
          ]),
        },
      ),
      question(
        9,
        2,
        "senior_class_comments",
        "textarea",
        "What would you like dedicated senior classes to offer?",
        false,
        {
          help: "You may suggest a learning focus, difficulty level or class format. You can also share any concerns about introducing senior classes.",
        },
      ),
      question(
        10,
        3,
        "pt_attendance",
        "radio",
        "How often have you attended PT this semester?",
        true,
        {
          options: attendance.map((o) =>
            o.id === "never" ? { ...o, label: "I have not attended PT" } : o,
          ),
        },
      ),
      question(
        11,
        3,
        "pt_timing",
        "radio",
        "How suitable is the 7:15pm–7:30pm timing for you?",
        true,
        {
          options: opts([
            ["very_suitable", "Very suitable"],
            ["somewhat_suitable", "Somewhat suitable"],
            ["neutral", "Neutral"],
            ["somewhat_unsuitable", "Somewhat unsuitable"],
            ["very_unsuitable", "Very unsuitable"],
            ["unsure", "Unsure"],
          ]),
        },
      ),
      question(
        12,
        3,
        "pt_value",
        "radio",
        "How useful have the PT sessions been in supporting your dance training?",
        true,
        {
          hideWhen: { question: "pt_attendance", value: "never" },
          options: opts([
            ["very_useful", "Very useful"],
            ["somewhat_useful", "Somewhat useful"],
            ["neutral", "Neutral"],
            ["not_very_useful", "Not very useful"],
            ["not_useful", "Not useful at all"],
            ["insufficient_experience", "I have not attended enough sessions to comment"],
          ]),
        },
      ),
      question(13, 3, "pt_comments", "textarea", "What should we keep or change about PT?", false, {
        help: "You may comment on the timing, 15-minute duration, exercise intensity, variety of exercises or how sessions are conducted. If you have difficulty attending, you can share why here too.",
      }),
      ...instructors.flatMap((i, index) => [
        question(
          14 + index * 3,
          4,
          `${i.id}_well`,
          "textarea",
          `What has ${i.label} done well, and what would you like ${i.label} to continue doing?`,
          false,
          { instructor: i.id },
        ),
        question(
          15 + index * 3,
          4,
          `${i.id}_improve`,
          "textarea",
          `What could ${i.label} improve or do differently to support your learning?`,
          false,
          { instructor: i.id },
        ),
        question(
          16 + index * 3,
          4,
          `${i.id}_other`,
          "textarea",
          `Do you have any other comments for ${i.label}?`,
          false,
          { instructor: i.id },
        ),
      ]),
      question(23, 5, "exco_well", "textarea", "What has the 17th EXCO done well?"),
      question(
        24,
        5,
        "exco_improve",
        "textarea",
        "What could the 17th EXCO improve or do differently?",
      ),
      question(
        25,
        5,
        "exco_other",
        "textarea",
        "Is there anything else you would like to share with the 17th EXCO?",
      ),
    ],
  });
}

export function isVisible(q: Question, answers: Answers, selected: string[]): boolean {
  if (q.instructor && !selected.includes(q.instructor)) return false;
  if (q.hideWhen && answers[q.hideWhen.question] === q.hideWhen.value) return false;
  if (q.showWhenSelected) {
    const parent = answers[q.showWhenSelected.question];
    return Array.isArray(parent) && parent.includes(q.showWhenSelected.value);
  }
  return true;
}

export function visibleAnswers(
  definition: Definition,
  answers: Answers,
  selected: string[],
): Answers {
  return Object.fromEntries(
    definition.questions
      .filter((q) => isVisible(q, answers, selected) && answers[q.id] !== undefined)
      .map((q) => [q.id, answers[q.id]]),
  );
}

export function validateAnswers(
  definition: Definition,
  input: unknown,
  selected: string[],
  section?: number,
) {
  const errors: FieldErrors = {};
  const output: Answers = {};
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { answers: output, errors: { form: "Answers must be an object." } };
  const values = input as Record<string, unknown>;
  for (const key of Object.keys(values))
    if (!definition.questions.some((q) => q.id === key)) errors[key] = "Unknown question.";
  for (const q of definition.questions) {
    if (section !== undefined && q.section !== section) continue;
    // Hidden input is discarded even when a malicious client supplies it.
    if (!isVisible(q, values as Answers, selected)) continue;
    const value = values[q.id];
    const fail = (message: string) => {
      errors[q.id] = message;
    };
    const validOption = (v: unknown) => typeof v === "string" && q.options?.some((o) => o.id === v);
    if (value === undefined || value === "") {
      if (q.required) fail("Please answer this question.");
      continue;
    }
    if (q.type === "textarea") {
      if (typeof value !== "string" || value.length > 2000)
        fail("Please use text of no more than 2,000 characters.");
      else if (value.trim()) output[q.id] = value.trim();
    } else if (q.type === "radio") {
      if (!validOption(value)) fail("Please select a listed option.");
      else output[q.id] = value as string;
    } else if (q.type === "checkboxes") {
      if (
        !Array.isArray(value) ||
        value.length > (q.options?.length ?? 0) ||
        new Set(value).size !== value.length ||
        !value.every(validOption)
      )
        fail("Please select only listed options, once each.");
      else if (value.length) output[q.id] = [...value].sort();
    } else {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        fail("Please answer each session.");
        continue;
      }
      const rows = value as Record<string, unknown>;
      if (Object.keys(rows).some((id) => !q.rows?.some((r) => r.id === id)))
        fail("Unknown session.");
      const matrix: Record<string, string> = {};
      for (const row of q.rows ?? []) {
        if (!validOption(rows[row.id])) {
          if (q.required || rows[row.id] !== undefined)
            fail(`Please choose an answer for ${row.label}.`);
        } else matrix[row.id] = rows[row.id] as string;
      }
      output[q.id] = matrix;
    }
  }
  return { answers: output, errors };
}

export const submissionSchema = z
  .object({
    surveyId: z.string().uuid(),
    definitionVersionId: z.string().uuid(),
    submissionKey: z.string().uuid(),
    selectedInstructorIds: z
      .array(z.string().min(1).max(40))
      .max(3)
      .refine((v) => new Set(v).size === v.length, "Duplicate instructors"),
    answers: z.record(z.string().max(100), z.unknown()),
  })
  .strict();
export type Submission = z.infer<typeof submissionSchema>;
export type PublicSurvey = {
  id: string;
  slug: string;
  state: "draft" | "open" | "closed";
  versionId: string;
  definition: Definition;
};
export type StoredResponse = {
  id: string;
  definitionVersionId: string;
  createdAt: string;
  answers: Answers;
  selectedInstructorIds: string[];
};
export const successMessage =
  "Thank you for sharing your feedback! We'll take your responses into consideration as we review our training arrangements and club experience.";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonicalJson(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function answerLabel(q: Question, value: Answers[string] | undefined): string {
  if (value === undefined || value === "" || (Array.isArray(value) && !value.length))
    return "Skipped";
  const label = (id: string) => q.options?.find((o) => o.id === id)?.label ?? id;
  if (typeof value === "string") return q.type === "textarea" ? value : label(value);
  if (Array.isArray(value)) return value.map(label).join("; ");
  return (q.rows ?? [])
    .map((r) => `${r.label}: ${value[r.id] ? label(value[r.id]) : "Skipped"}`)
    .join("\n");
}
