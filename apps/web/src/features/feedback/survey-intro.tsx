import type { Definition } from "@repo/shared/feedback";

import { ArrowRight, Check, ListChecks } from "lucide-react";

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
      <div className="intro-info">
        <p>Takes about 5 minutes, longer if you write comments.</p>
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

type Progress = {
  definition: Definition;
  step: number;
  reached: number;
  onNavigate: (step: number) => void;
  disabled: boolean;
};

export function SectionList({ definition, step, reached, onNavigate, disabled }: Progress) {
  return (
    <ol className="section-nav" aria-label="Survey sections">
      {definition.sections.map((section, index) => {
        const done = step !== index && reached > index;
        return (
          <li key={section.title} className={step === index ? "current" : done ? "visited" : ""}>
            <button
              type="button"
              disabled={disabled || index > reached}
              aria-current={step === index ? "step" : undefined}
              onClick={() => onNavigate(index)}
            >
              <span aria-hidden>{done ? <Check size={15} /> : index + 1}</span>
              {section.title}
            </button>
          </li>
        );
      })}
      <li className={step === 6 ? "current" : ""}>
        <button
          type="button"
          disabled={disabled || reached < 6}
          aria-current={step === 6 ? "step" : undefined}
          onClick={() => onNavigate(6)}
        >
          <span aria-hidden>
            <ListChecks size={14} />
          </span>
          Review
        </button>
      </li>
    </ol>
  );
}

export function SurveySidebar(props: Progress) {
  return (
    <aside className="form-sidebar">
      <p className="term-label">{props.definition.term}</p>
      <SectionList {...props} />
    </aside>
  );
}
