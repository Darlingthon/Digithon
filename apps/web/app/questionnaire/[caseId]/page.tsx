"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Question, RiskTierName } from "@trustline/shared";

interface QuestionnairePayload {
  id: string;
  version: number;
  riskTier: RiskTierName;
  questions: Question[];
}

export default function QuestionnairePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();

  const [payload, setPayload] = useState<QuestionnairePayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | boolean | number>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    // Fetch case to get risk tier, then load questionnaire schema
    fetch(`/api/cases/${caseId}`)
      .then((r) => { if (!r.ok) throw new Error("case fetch failed"); return r.json(); })
      .then((data) => {
        const tier: RiskTierName = data.case?.riskTier ?? "LOW";
        return fetch(`/api/questionnaire?riskTier=${tier}`);
      })
      .then((r) => { if (!r.ok) throw new Error("questionnaire fetch failed"); return r.json(); })
      .then(setPayload)
      .catch(() => setError("Failed to load questionnaire. Please try again."));
  }, [caseId]);

  if (error) return <Screen icon="⚠️" title="Error" body={error} />;
  if (!payload) return <Screen icon="⏳" title="Loading…" body="Preparing your questionnaire." />;
  if (done) return <Screen icon="✓" title="All done!" body="Your answers have been submitted. You will receive confirmation shortly." />;

  const questions = payload.questions;
  const q = questions[step];
  const isLast = step === questions.length - 1;
  const answered = answers[q.field] !== undefined && answers[q.field] !== "";

  const setAnswer = (val: string | boolean | number) =>
    setAnswers((prev) => ({ ...prev, [q.field]: val }));

  const next = () => {
    if (!answered && q.required) { setError("Please answer this question to continue."); return; }
    setError(null);
    if (!isLast) { setStep((s) => s + 1); return; }
    submit();
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/actions/record-answers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: "WEB", answers }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Submission failed.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push(`/dashboard/${caseId}`), 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 520, padding: "0 24px" }}>
        {/* Progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "var(--muted)" }}>
            <span>Question {step + 1} of {questions.length}</span>
            <span>{payload.riskTier} risk · {payload.id} v{payload.version}</span>
          </div>
          <div style={{ background: "var(--border)", borderRadius: 4, height: 4, overflow: "hidden" }}>
            <div style={{ background: "#1d76db", width: `${((step + 1) / questions.length) * 100}%`, height: "100%", transition: "width 0.3s" }} />
          </div>
        </div>

        <div className="card" style={{ padding: 36 }}>
          {/* EDD badge */}
          {q.tier === "HIGH" && (
            <div style={{ background: "#d93f0b22", color: "#d93f0b", border: "1px solid #d93f0b44", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, display: "inline-block", marginBottom: 12 }}>
              ENHANCED DUE DILIGENCE
            </div>
          )}
          {q.tier === "MEDIUM" && (
            <div style={{ background: "#e3a00822", color: "#e3a008", border: "1px solid #e3a00844", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, display: "inline-block", marginBottom: 12 }}>
              ADDITIONAL CHECK
            </div>
          )}

          <h2 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}>{q.label}</h2>

          <QuestionInput q={q} value={answers[q.field]} onChange={setAnswer} />

          {error && <div style={{ color: "#d93f0b", fontSize: 13, marginTop: 12 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            {step > 0 && (
              <button onClick={() => { setError(null); setStep((s) => s - 1); }} style={btnStyle("secondary")}>
                ← Back
              </button>
            )}
            <button
              onClick={next}
              disabled={submitting || (q.required && !answered)}
              style={{ ...btnStyle("primary"), flex: 1, opacity: (submitting || (q.required && !answered)) ? 0.6 : 1 }}
            >
              {submitting ? "Submitting…" : isLast ? "Submit" : "Next →"}
            </button>
          </div>
        </div>

        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, marginTop: 16 }}>
          TrustLine · Vera — your answers are encrypted and stored securely
        </p>
      </div>
    </main>
  );
}

function QuestionInput({
  q, value, onChange,
}: {
  q: Question;
  value: string | boolean | number | undefined;
  onChange: (v: string | boolean | number) => void;
}) {
  if (q.type === "boolean") {
    return (
      <div style={{ display: "flex", gap: 10 }}>
        {[true, false].map((opt) => (
          <button
            key={String(opt)}
            onClick={() => onChange(opt)}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
              background: value === opt ? "#1d76db" : "var(--bg)",
              color: value === opt ? "#fff" : "var(--text)",
              border: `2px solid ${value === opt ? "#1d76db" : "var(--border)"}`,
            }}
          >
            {opt ? "Yes" : "No"}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === "single_select" && q.options) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {q.options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: "12px 16px", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer", textAlign: "left",
              background: value === opt ? "#1d76db" : "var(--bg)",
              color: value === opt ? "#fff" : "var(--text)",
              border: `2px solid ${value === opt ? "#1d76db" : "var(--border)"}`,
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === "number") {
    return (
      <input
        type="number"
        value={value as number ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        style={inputStyle}
        placeholder="Enter a number"
      />
    );
  }

  // text
  return (
    <textarea
      value={value as string ?? ""}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      style={{ ...inputStyle, resize: "vertical", height: "auto", padding: "10px 12px" }}
      placeholder="Type your answer here…"
    />
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14,
  background: "var(--bg)", border: "2px solid var(--border)", color: "var(--text)",
  outline: "none", boxSizing: "border-box",
};

function btnStyle(variant: "primary" | "secondary"): React.CSSProperties {
  return {
    padding: "12px 20px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", border: "none",
    background: variant === "primary" ? "#1d76db" : "var(--panel)",
    color: variant === "primary" ? "#fff" : "var(--text)",
  };
}

function Screen({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div className="card" style={{ maxWidth: 420, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>{title}</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>{body}</p>
      </div>
    </main>
  );
}
