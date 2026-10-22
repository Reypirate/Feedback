import type { Answers, Question } from "@repo/shared/feedback";
// ponytail: rating questions listed by id; move to a definition field if another survey needs it
const scaleQuestions = new Set(["senior_class_interest", "pt_attendance", "pt_timing", "pt_value"]);
const scalePoints = 5;
type Props = {
  question: Question;
  number: number;
  value: Answers[string] | undefined;
  onChange: (value: Answers[string]) => void;
  error?: string;
  disabled?: boolean;
};
export function QuestionField({ question: q, number, value, onChange, error, disabled }: Props) {
  const helpId = `${q.id}-help`;
  const errorId = `${q.id}-error`;
  const describedBy = [q.help && helpId, error && errorId].filter(Boolean).join(" ") || undefined;
  const scale = q.type === "matrix" || scaleQuestions.has(q.id);
  const radio = (
    o: { id: string; label: string },
    name: string,
    current: string | undefined,
    update: (value: string) => void,
    className: string,
  ) => (
    <label key={o.id} className={`${className} ${current === o.id ? "is-selected" : ""}`}>
      <input
        type="radio"
        name={name}
        value={o.id}
        checked={current === o.id}
        onChange={() => update(o.id)}
        disabled={disabled}
        aria-describedby={describedBy}
      />
      <span>{o.label}</span>
    </label>
  );
  const choices = (name: string, current: string | undefined, update: (value: string) => void) => {
    const options = q.options ?? [];
    if (!scale)
      return (
        <div className="choice-list">
          {options.map((o) => radio(o, name, current, update, "choice"))}
        </div>
      );
    const extra = options.slice(scalePoints);
    return (
      <>
        <div className="scale">
          {options
            .slice(0, scalePoints)
            .map((o) => radio(o, name, current, update, "scale-option"))}
        </div>
        {extra.length > 0 && (
          <div className="choice-list scale-extra">
            {extra.map((o) => radio(o, name, current, update, "choice"))}
          </div>
        )}
      </>
    );
  };
  return (
    <fieldset
      className={`question ${error ? "has-error" : ""}`}
      id={`question-${q.id}`}
      disabled={disabled}
      aria-invalid={Boolean(error)}
    >
      <legend>
        <span className="question-number">{number.toString().padStart(2, "0")}</span>
        <span>
          {q.label}
          <span className="field-tag">{q.required ? "Required" : "Optional"}</span>
        </span>
      </legend>
      {q.help && (
        <p id={helpId} className="field-help">
          {q.help}
        </p>
      )}
      {q.type === "radio" && choices(q.id, typeof value === "string" ? value : undefined, onChange)}
      {q.type === "checkboxes" && (
        <div className="choice-list">
          {q.options?.map((o) => {
            const selected = Array.isArray(value) ? value : [];
            return (
              <label
                key={o.id}
                className={`choice ${selected.includes(o.id) ? "is-selected" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(o.id)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, o.id]
                        : selected.filter((id) => id !== o.id),
                    )
                  }
                  aria-describedby={describedBy}
                />
                <span>{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
      {q.type === "textarea" && (
        <>
          <label className="sr-only" htmlFor={q.id}>
            {q.label}
          </label>
          <textarea
            id={q.id}
            value={typeof value === "string" ? value : ""}
            maxLength={2000}
            rows={4}
            placeholder="Optional feedback"
            onChange={(event) => onChange(event.target.value)}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
          />
          <span className="character-count">
            {typeof value === "string" ? value.length : 0} / 2,000
          </span>
        </>
      )}
      {q.type === "matrix" && (
        <div className="matrix-rows">
          {q.rows?.map((row) => {
            const matrix = value && typeof value === "object" && !Array.isArray(value) ? value : {};
            return (
              <fieldset className="matrix-row" key={row.id}>
                <legend>{row.label}</legend>
                {choices(`${q.id}-${row.id}`, matrix[row.id], (answer) =>
                  onChange({ ...matrix, [row.id]: answer }),
                )}
              </fieldset>
            );
          })}
        </div>
      )}
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </fieldset>
  );
}
