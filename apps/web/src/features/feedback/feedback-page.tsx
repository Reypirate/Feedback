import type { Answers, FieldErrors, PublicSurvey, Submission } from "@repo/shared/feedback";

import {
  answerLabel,
  isVisible,
  successMessage,
  validateAnswers,
  visibleAnswers,
} from "@repo/shared/feedback";
import { useQuery } from "@tanstack/react-query";
import { Link, useBlocker } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, MoveUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FeedbackApiError, feedbackRequest, jsonPost } from "./api";
import { QuestionField } from "./question";
import { SurveyIntro, SurveySidebar } from "./survey-intro";

export function FeedbackPage({ slug = "ardiente" }: { slug?: string }) {
  const survey = useQuery({
    queryKey: ["survey", slug],
    queryFn: () => feedbackRequest<PublicSurvey>(`/feedback/${encodeURIComponent(slug)}`),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    refetchOnReconnect: false,
  });
  if (survey.isPending)
    return (
      <div className="status-card" aria-live="polite">
        <h1>Loading form…</h1>
      </div>
    );
  if (survey.isError)
    return (
      <div className="status-card" role="alert">
        <h1>
          {survey.error instanceof FeedbackApiError && survey.error.status === 404
            ? "This form is unavailable."
            : "We couldn’t load the form."}
        </h1>
        <p>{survey.error.message}</p>
        <button className="primary-button" onClick={() => void survey.refetch()}>
          Try again <ArrowRight size={17} />
        </button>
        <Link className="secondary-button" to="/preview">
          Preview form
        </Link>
      </div>
    );
  if (survey.data.state === "closed")
    return (
      <div className="status-card">
        <h1>This feedback round has closed.</h1>
        <p>
          Thank you for helping shape Ardiente. Please check with EXCO for the next feedback round.
        </p>
      </div>
    );
  return <SurveyForm key={survey.data.versionId} survey={survey.data} />;
}

export function SurveyForm({
  survey,
  preview = false,
}: {
  survey: PublicSurvey;
  preview?: boolean;
}) {
  const definition = survey.definition;
  const [step, setStep] = useState(-1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [receipt, setReceipt] = useState("");
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [editing, setEditing] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const pending = useRef<Submission | null>(null);
  const inFlight = useRef(false);
  const form = useForm<{ answers: Answers; selected: string[] }>({
    defaultValues: { answers: {}, selected: [] },
  });
  const answers = useWatch({ control: form.control, name: "answers" });
  const selected = useWatch({ control: form.control, name: "selected" });
  const dirty = !receipt && (Object.keys(answers).length > 0 || selected.length > 0 || uncertain);
  useBlocker({
    shouldBlockFn: () =>
      dirty &&
      !window.confirm("Leave this form? Your answers are only kept in this tab and will be lost."),
    enableBeforeUnload: dirty,
  });
  useEffect(() => {
    if (step >= 0) heading.current?.focus();
  }, [step, receipt]);
  useEffect(() => {
    if (Object.keys(errors).length) errorSummary.current?.focus();
  }, [errors]);
  function changeAnswer(id: string, value: Answers[string]) {
    const next = { ...answers, [id]: value };
    const visible = visibleAnswers(definition, next, selected);
    if (Object.keys(next).some((key) => !(key in visible)))
      setNotice("Answers in the hidden follow-up were cleared.");
    form.setValue("answers", visible);
    setErrors({});
    setFailure("");
  }
  function changeInstructors(next: string[]) {
    const visible = visibleAnswers(definition, answers, next);
    if (Object.keys(answers).some((key) => !(key in visible)))
      setNotice("Comments for deselected instructors were cleared.");
    form.setValue("selected", next);
    form.setValue("answers", visible);
  }
  function next() {
    const checked = validateAnswers(definition, answers, selected, step);
    if (Object.keys(checked.errors).length) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setNotice("");
    setStep(editing ? 6 : step + 1);
    setEditing(false);
  }
  async function submit() {
    if (inFlight.current || preview) return;
    if (!pending.current) {
      const checked = validateAnswers(definition, answers, selected);
      if (Object.keys(checked.errors).length) {
        setErrors(checked.errors);
        return;
      }
      pending.current = {
        surveyId: survey.id,
        definitionVersionId: survey.versionId,
        submissionKey: crypto.randomUUID(),
        selectedInstructorIds: selected,
        answers: checked.answers,
      };
    }
    inFlight.current = true;
    setSending(true);
    setFailure("");
    try {
      const result = await feedbackRequest<{ receipt: string }>(
        `/feedback/${encodeURIComponent(survey.slug)}/responses`,
        jsonPost(pending.current),
      );
      setReceipt(result.receipt);
      setUncertain(false);
      form.reset();
      pending.current = null;
    } catch (error) {
      const definiteFailure =
        error instanceof FeedbackApiError && error.status >= 400 && error.status < 500;
      setUncertain(!definiteFailure);
      setFailure(
        error instanceof Error ? error.message : "The connection was interrupted. Please retry.",
      );
      if (definiteFailure) {
        pending.current = null;
        setNeedsReload(error.status === 409);
        if (error.fields) setErrors(error.fields);
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }
  if (receipt)
    return (
      <div className="success-card">
        <h1 ref={heading} tabIndex={-1}>
          Feedback submitted
        </h1>
        <p>{successMessage}</p>
        <div className="receipt">
          Submission receipt <code>{receipt}</code>
        </div>
        <p className="subtle">Your response has been saved. You can safely close this tab.</p>
      </div>
    );
  if (step === -1) return <SurveyIntro definition={definition} onStart={() => setStep(0)} />;
  return (
    <div className="form-layout">
      <SurveySidebar definition={definition} step={step} />
      <div className="form-panel">
        <div className="step-meta">
          <span>{step < 6 ? `Step ${step + 1} of 6` : "Review"}</span>
          <span>{step < 6 ? `${Math.round((step / 6) * 100)}% complete` : ""}</span>
        </div>
        <progress
          className="progress-track"
          aria-label="Survey progress"
          max={6}
          value={Math.min(step, 6)}
        />
        <h1 ref={heading} tabIndex={-1} className="section-title">
          {step < 6 ? definition.sections[step]?.title : "Review your answers"}
        </h1>
        {step !== 0 && (
          <p className="section-description">
            {step < 6
              ? definition.sections[step]?.description
              : "Check your answers before submitting."}
          </p>
        )}
        {Object.keys(errors).length > 0 && (
          <div className="error-summary" role="alert" ref={errorSummary} tabIndex={-1}>
            <strong>Please check the questions below.</strong>
            <ul>
              {Object.entries(errors).map(([id, message]) => (
                <li key={id}>
                  <button
                    className="text-button"
                    onClick={() => {
                      const q = definition.questions.find((q) => q.id === id);
                      if (q && step !== q.section) {
                        setStep(q.section);
                        setEditing(true);
                      } else
                        document
                          .getElementById(`question-${id}`)
                          ?.querySelector<HTMLInputElement>("input, textarea")
                          ?.focus();
                    }}
                  >
                    {message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {notice && (
          <p className="notice" aria-live="polite">
            {notice}
          </p>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (step < 6) next();
            else void submit();
          }}
        >
          <fieldset className="form-fields" disabled={sending || uncertain}>
            {step === 4 && (
              <div className="instructor-picker">
                <h2>Who did you train with?</h2>
                <p className="field-help">
                  Select any instructors you’d like to give feedback on, or skip this section.
                </p>
                <div className="instructor-options">
                  {definition.instructors.map((i) => (
                    <label
                      className={`instructor-chip ${selected.includes(i.id) ? "is-selected" : ""}`}
                      key={i.id}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(i.id)}
                        onChange={(event) =>
                          changeInstructors(
                            event.target.checked
                              ? [...selected, i.id]
                              : selected.filter((id) => id !== i.id),
                          )
                        }
                      />
                      {i.label}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    changeInstructors([]);
                    setStep(5);
                  }}
                >
                  Skip instructor feedback <ArrowRight size={14} />
                </button>
              </div>
            )}
            {step < 6 &&
              definition.questions
                .filter((q) => q.section === step && isVisible(q, answers, selected))
                .map((q) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    value={answers[q.id]}
                    error={errors[q.id]}
                    onChange={(value) => changeAnswer(q.id, value)}
                  />
                ))}
            {step === 6 &&
              definition.sections.map((section, index) => (
                <section className="review-section" key={section.title}>
                  <div className="review-heading">
                    <h2>{section.title}</h2>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={`Edit ${section.title}`}
                      onClick={() => {
                        setStep(index);
                        setEditing(true);
                      }}
                    >
                      Edit <MoveUpRight size={13} />
                    </button>
                  </div>
                  {index === 4 && !selected.length ? (
                    <p className="subtle">Skipped</p>
                  ) : (
                    definition.questions
                      .filter((q) => q.section === index && isVisible(q, answers, selected))
                      .map((q) => (
                        <div className="review-answer" key={q.id}>
                          <h3>{q.label}</h3>
                          <p>{answerLabel(q, answers[q.id])}</p>
                        </div>
                      ))
                  )}
                </section>
              ))}
          </fieldset>
          {failure && (
            <div className="error-summary" role="alert">
              <strong>{failure}</strong>
              {needsReload && !uncertain && (
                <p>
                  Keep a copy before loading the current form.{" "}
                  <a
                    download="ardiente-feedback-draft.json"
                    href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ definition, answers, selectedInstructorIds: selected }, null, 2))}`}
                  >
                    Save a copy of my answers
                  </a>{" "}
                  ·{" "}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => window.location.reload()}
                  >
                    Reload form
                  </button>
                </p>
              )}
              {uncertain && (
                <p>
                  The save may have reached us. Your answers are locked while we confirm. Retry
                  sends exactly the same submission and cannot create a duplicate.
                </p>
              )}
            </div>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={sending || uncertain}
              onClick={() => {
                setErrors({});
                setNotice("");
                setStep(editing ? 6 : step - 1);
                setEditing(false);
              }}
            >
              <ArrowLeft size={16} />
              {editing ? "Back to review" : "Back"}
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={sending || (preview && step === 6)}
            >
              {step < 6
                ? editing
                  ? "Save & review"
                  : step === 5
                    ? "Review answers"
                    : "Continue"
                : preview
                  ? "Preview only"
                  : sending
                    ? "Saving feedback…"
                    : uncertain
                      ? "Retry submission"
                      : "Submit feedback"}
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
        <p className="form-footnote">
          {step === 6
            ? "Your response is submitted only when you select Submit feedback."
            : "Your answers are kept in this tab. Reloading will discard them."}
        </p>
      </div>
    </div>
  );
}
