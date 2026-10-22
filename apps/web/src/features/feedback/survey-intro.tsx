import type { Definition } from "@repo/shared/feedback";

import { ArrowRight, Check } from "lucide-react";

export function SurveyIntro({
  definition,
  onStart,
}: {
  definition: Definition;
  onStart: () => void;
}) {
  return (
    <section className="intro-panel">
      <p className="term-label">{definition.term}</p>
      <h1>{definition.title}</h1>
      <p className="intro-description">
        Tell us what’s working and what could improve — from training times and PT to instructors
        and the {definition.exco}th EXCO.
      </p>
      <p className="intro-description">
        We’re also asking about moving one Wednesday session to Tuesday and interest in senior
        classes.
      </p>
      <div className="intro-info">
        <p>No name or email required.</p>
        <p>All written responses and instructor feedback are optional.</p>
      </div>
      <button className="primary-button" onClick={onStart}>
        Start form <ArrowRight size={18} />
      </button>
      <details className="collection-details">
        <summary>How your feedback is handled</summary>
        <p>
          Authorised EXCO members can review responses. No name, email, student ID or account
          identity is stored with your feedback. Hosting providers may keep operational logs, so
          avoid identifying details in comments. Answers stay in this tab until you submit;
          reloading discards them.
        </p>
      </details>
    </section>
  );
}

export function SurveySidebar({ definition, step }: { definition: Definition; step: number }) {
  return (
    <aside className="form-sidebar">
      <p className="term-label">{definition.term}</p>
      <ol className="section-nav" aria-label="Survey sections">
        {definition.sections.map((section, index) => (
          <li
            key={section.title}
            className={step === index ? "current" : step > index ? "visited" : ""}
          >
            <span>{step > index ? <Check size={15} /> : index + 1}</span>
            {section.title}
          </li>
        ))}
        <li className={step === 6 ? "current" : ""}>
          <span>7</span>Review
        </li>
      </ol>
    </aside>
  );
}
