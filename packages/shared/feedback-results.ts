import type { Definition, Question, StoredResponse } from "./feedback";

import { isVisible } from "./feedback";

export function distribution(
  _definition: Definition,
  responses: StoredResponse[],
  q: Question,
  rowId?: string,
) {
  const asked = responses.filter((r) => isVisible(q, r.answers, r.selectedInstructorIds));
  const answered = asked.filter((r) => {
    const value = r.answers[q.id];
    return rowId
      ? value && typeof value === "object" && !Array.isArray(value) && value[rowId] !== undefined
      : value !== undefined;
  });
  const denominator = answered.length;
  return {
    total: responses.length,
    asked: asked.length,
    answered: denominator,
    skipped: asked.length - denominator,
    notAsked: responses.length - asked.length,
    options: (q.options ?? []).map((o) => {
      const count = answered.filter((r) => {
        const value = r.answers[q.id];
        return rowId
          ? typeof value === "object" && !Array.isArray(value) && value[rowId] === o.id
          : Array.isArray(value)
            ? value.includes(o.id)
            : value === o.id;
      }).length;
      return { ...o, count, percent: denominator ? (count / denominator) * 100 : null };
    }),
  };
}

export function csvCell(value: string) {
  const safe = /^[\s]*[=+\-@\t\r]/u.test(value) || /^[\t\r]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function responsesCsv(definition: Definition, responses: StoredResponse[]) {
  const columns = definition.questions.flatMap<{
    q: Question;
    row: string | undefined;
    label: string;
  }>((q) =>
    q.type === "matrix"
      ? (q.rows ?? []).map((r) => ({ q, row: r.id, label: `${q.id} · ${r.label}` }))
      : [{ q, row: undefined, label: q.id }],
  );
  const header = [
    "response_id",
    "definition_version",
    "submitted_at",
    ...columns.map((c) => c.label),
  ];
  const rows = responses.map((r) => [
    r.id,
    r.definitionVersionId,
    r.createdAt,
    ...columns.map(({ q, row }) => {
      if (!isVisible(q, r.answers, r.selectedInstructorIds)) return "[Not asked]";
      const value = r.answers[q.id];
      if (value === undefined) return "[Skipped]";
      const label = (id: string) => q.options?.find((o) => o.id === id)?.label ?? id;
      if (typeof value === "string") return q.type === "textarea" ? value : label(value);
      if (Array.isArray(value)) return value.map(label).join("; ");
      return row && value[row] ? label(value[row]) : "[Skipped]";
    }),
  ]);
  return "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
