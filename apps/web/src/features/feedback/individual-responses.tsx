import type { Definition, StoredResponse } from "@repo/shared/feedback";

import { answerLabel, isVisible } from "@repo/shared/feedback";
import { readingCheck } from "@repo/shared/feedback-results";
import { useState } from "react";

const submittedAt = (value: string) =>
  new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function IndividualResponses({
  definition,
  responses,
}: {
  definition: Definition;
  responses: StoredResponse[];
}) {
  const [selectedId, setSelectedId] = useState("");
  const index = Math.max(
    0,
    responses.findIndex((response) => response.id === selectedId),
  );
  const response = responses[index];
  if (!response) return null;
  return (
    <div className="individual-panel">
      <p className="notice">
        Private EXCO view. Each response may include a member's name and contact details.
      </p>
      <div className="response-navigation">
        <label htmlFor="response-select">Choose response</label>
        <select
          id="response-select"
          value={response.id}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {responses.map((item, position) => (
            <option key={item.id} value={item.id}>
              {position + 1}.{" "}
              {typeof item.answers.respondent_name === "string"
                ? item.answers.respondent_name
                : "Unnamed response"}{" "}
              · {submittedAt(item.createdAt)}
            </option>
          ))}
        </select>
        <div className="response-paging">
          <button
            className="secondary-button"
            disabled={index === 0}
            onClick={() => setSelectedId(responses[index - 1].id)}
          >
            Previous response
          </button>
          <span aria-live="polite">
            Response {index + 1} of {responses.length}
          </span>
          <button
            className="secondary-button"
            disabled={index === responses.length - 1}
            onClick={() => setSelectedId(responses[index + 1].id)}
          >
            Next response
          </button>
        </div>
      </div>
      <article className="individual-response">
        <h2>
          {typeof response.answers.respondent_name === "string"
            ? response.answers.respondent_name
            : "Individual response"}
        </h2>
        <p className="subtle">Submitted {submittedAt(response.createdAt)} (Singapore time)</p>
        <p className="response-receipt">Receipt: {response.id}</p>
        {readingCheck(definition, response) && (
          <p className="notice">
            {readingCheck(definition, response)}. Review this alongside the member's full feedback.
          </p>
        )}
        {definition.sections.map((section, sectionIndex) => (
          <section className="review-section" key={section.title}>
            <h3>{section.title}</h3>
            {definition.questions
              .filter((question) => question.section === sectionIndex)
              .map((question) => (
                <div className="review-answer" key={question.id}>
                  <h4>{question.label}</h4>
                  <p>
                    {isVisible(question, response.answers, response.selectedInstructorIds)
                      ? answerLabel(question, response.answers[question.id])
                      : "Not asked"}
                  </p>
                </div>
              ))}
          </section>
        ))}
      </article>
    </div>
  );
}
