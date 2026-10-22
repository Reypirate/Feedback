import type { Definition, PublicSurvey, StoredResponse } from "@repo/shared/feedback";

import { distribution } from "@repo/shared/feedback-results";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, LockKeyhole, LogOut } from "lucide-react";
import { useState } from "react";

import { env } from "../../env";
import { authClient } from "../../lib/auth";
import { FeedbackApiError, feedbackRequest, jsonPost } from "./api";

type Results = {
  survey: PublicSurvey;
  definition: Definition;
  versions: { id: string; version: number; publishedAt: string }[];
  versionId: string;
  responses: StoredResponse[];
};

export function AdminPage({ slug = "ardiente" }: { slug?: string }) {
  const { data: session, isPending } = authClient.useSession();
  if (isPending)
    return (
      <div className="status-card" aria-live="polite">
        Checking your session…
      </div>
    );
  if (!session) return <AdminLogin />;
  return <AdminResults key={`${session.user.id}-${slug}`} slug={slug} userId={session.user.id} />;
}
function AdminLogin() {
  const [failure, setFailure] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="login-card">
      <h1>EXCO sign in</h1>
      <p>Sign in to view survey responses.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setFailure("");
          const data = new FormData(event.currentTarget);
          try {
            const result = await authClient.signIn.email({
              email: String(data.get("email")),
              password: String(data.get("password")),
            });
            if (result.error) setFailure(result.error.message ?? "Unable to sign in.");
          } catch {
            setFailure("Couldn’t connect. Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {failure && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
        <button className="primary-button" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className="form-footnote">Access is limited to accounts provisioned for EXCO.</p>
    </div>
  );
}
function AdminResults({ slug, userId }: { slug: string; userId: string }) {
  const [version, setVersion] = useState("");
  const [member, setMember] = useState("");
  const [tab, setTab] = useState<"summary" | "comments">("summary");
  const [failure, setFailure] = useState("");
  const [changing, setChanging] = useState(false);
  const params = new URLSearchParams();
  if (version) params.set("version", version);
  if (member) params.set("member", member);
  const path = `/admin/feedback/${encodeURIComponent(slug)}`;
  const query = useQuery({
    queryKey: ["feedback-results", userId, slug, version, member],
    queryFn: () => feedbackRequest<Results>(`${path}?${params}`),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  if (query.isPending)
    return (
      <div className="status-card" aria-live="polite">
        Loading your feedback…
      </div>
    );
  if (query.isError)
    return (
      <div className="status-card" role="alert">
        <LockKeyhole size={28} />
        <h1>
          {query.error instanceof FeedbackApiError && query.error.status === 403
            ? "EXCO access required."
            : "Results are unavailable."}
        </h1>
        <p>{query.error.message}</p>
        <button className="secondary-button" onClick={() => void authClient.signOut()}>
          Sign out
        </button>
      </div>
    );
  const data = query.data;
  async function changeState() {
    const state = data.survey.state === "open" ? "closed" : "open";
    if (
      !window.confirm(
        `${state === "closed" ? "Close" : "Reopen"} this survey? ${state === "closed" ? "New responses will stop being accepted." : "Members will be able to submit again."}`,
      )
    )
      return;
    setChanging(true);
    setFailure("");
    try {
      await feedbackRequest(`${path}/state`, jsonPost({ state }));
      await query.refetch();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setChanging(false);
    }
  }
  return (
    <div className="dashboard">
      <div className="dashboard-heading">
        <div>
          <h1>Survey responses</h1>
          <p>
            {data.definition.title} · {data.definition.term}
          </p>
        </div>
        <button className="text-button" onClick={() => void authClient.signOut()}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
      <div className="dashboard-toolbar">
        <label>
          Definition version
          <select
            value={version || data.versionId}
            onChange={(event) => setVersion(event.target.value)}
          >
            {data.versions.map((v) => (
              <option value={v.id} key={v.id}>
                Version {v.version}
              </option>
            ))}
          </select>
        </label>
        <label>
          Membership
          <select value={member} onChange={(event) => setMember(event.target.value)}>
            <option value="">All members</option>
            <option value="junior">Junior</option>
            <option value="senior">Senior</option>
            <option value="alumni">Alumni</option>
          </select>
        </label>
        <a className="secondary-button" href={`${env.VITE_API_URL}/api${path}/export?${params}`}>
          <Download size={16} />
          Export CSV
        </a>
        <button className="secondary-button" disabled={changing} onClick={() => void changeState()}>
          {data.survey.state === "open" ? "Close survey" : "Reopen survey"}
        </button>
      </div>
      {failure && (
        <p className="error-summary" role="alert">
          {failure}
        </p>
      )}
      <div className="stats-grid">
        <div>
          <span>FINAL RESPONSES</span>
          <strong>{data.responses.length}</strong>
          <p>In the selected version and membership filter</p>
        </div>
        <div>
          <span>COLLECTION STATUS</span>
          <strong className="state-label">{data.survey.state}</strong>
          <p>Version history is kept separately</p>
        </div>
        <div>
          <span>SURVEY VERSION</span>
          <strong>{data.versions.find((v) => v.id === data.versionId)?.version}</strong>
          <p>{data.definition.term}</p>
        </div>
      </div>
      <div className="dashboard-tabs">
        <button aria-pressed={tab === "summary"} onClick={() => setTab("summary")}>
          Response overview
        </button>
        <button aria-pressed={tab === "comments"} onClick={() => setTab("comments")}>
          Written feedback
        </button>
      </div>
      {data.responses.length === 0 ? (
        <div className="empty-state">
          <h2>No responses in this view yet.</h2>
          <p>Try another membership filter or return after members have shared their feedback.</p>
        </div>
      ) : tab === "summary" ? (
        <div className="results-grid">
          {data.definition.questions
            .filter((q) => q.type !== "textarea")
            .flatMap((q) =>
              (q.rows ?? [{ id: undefined, label: "" }]).map((row) => {
                const result = distribution(data.definition, data.responses, q, row.id);
                return (
                  <section className="result-card" key={`${q.id}-${row.id}`}>
                    <span className="eyebrow">QUESTION {q.number}</span>
                    <h2>{q.label}</h2>
                    {row.label && <h3>{row.label}</h3>}
                    <p className="result-denominator">
                      {result.answered} answered / {result.asked} asked · {result.skipped} skipped ·{" "}
                      {result.notAsked} not asked
                    </p>
                    {result.options.map((o) => (
                      <div className="result-bar" key={o.id}>
                        <div>
                          <span>{o.label}</span>
                          <strong>
                            {o.count}{" "}
                            <small>
                              ({o.percent === null ? "No data" : `${Math.round(o.percent)}%`})
                            </small>
                          </strong>
                        </div>
                        <div className="bar-track">
                          <span style={{ width: `${o.percent ?? 0}%` }} />
                        </div>
                      </div>
                    ))}
                    {q.type === "checkboxes" && (
                      <p className="subtle">
                        Multiple selections allowed. Percentages use only people who answered;
                        skipping does not confirm an absence of barriers.
                      </p>
                    )}
                  </section>
                );
              }),
            )}
        </div>
      ) : (
        <div className="comments-panel">
          <div className="notice">
            Private EXCO view. Comments can contain identifying details; share summaries
            thoughtfully. Selecting an instructor does not prove attendance.
          </div>
          {member && data.responses.length < 5 ? (
            <div className="empty-state">
              Filtered comments are hidden for groups smaller than five. Use All members for the
              authorised raw review.
            </div>
          ) : (
            data.definition.questions
              .filter((q) => q.type === "textarea")
              .map((q) => {
                const comments = data.responses
                  .map((r) => r.answers[q.id])
                  .filter((v): v is string => typeof v === "string" && Boolean(v.trim()));
                return (
                  <section className="comment-group" key={q.id}>
                    <h2>{q.label}</h2>
                    <p className="subtle">{comments.length} non-empty responses</p>
                    {comments.length ? (
                      comments.map((comment, index) => (
                        <blockquote key={`${q.id}-${index}`}>{comment}</blockquote>
                      ))
                    ) : (
                      <p className="subtle">No written feedback for this prompt.</p>
                    )}
                  </section>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}
