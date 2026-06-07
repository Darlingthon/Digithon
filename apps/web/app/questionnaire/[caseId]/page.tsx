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

  if (error) return <Screen title="Something went wrong" body={error} />;
  if (!payload) return <Screen title="Loading your questionnaire…" body="This will only take a moment." loading />;
  if (done) return <Screen title="All done." body="Your answers have been submitted. You will hear from us shortly." success />;

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

  const pct = Math.round(((step + 1) / questions.length) * 100);

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "var(--panel)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.07em", color: "var(--brand)" }}>TRUSTLINE</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Question {step + 1} of {questions.length}</span>
      </div>

      {/* Progress */}
      <div style={{ height: 3, background: "var(--border-light)" }}>
        <div style={{ height: "100%", background: "var(--brand)", width: `${pct}%`, transition: "width 0.3s ease" }} />
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 520 }}>
          {/* Risk tier badge */}
          {q.tier && q.tier !== "LOW" && (
            <div style={{ marginBottom: 16 }}>
              {q.tier === "HIGH" ? (
                <span style={{ background: "var(--error-bg)", color: "var(--error)", border: "1px solid var(--error-border)", borderRadius: 4, padding: "3px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
                  ENHANCED DUE DILIGENCE
                </span>
              ) : (
                <span style={{ background: "var(--warning-bg)", color: "var(--warning)", border: "1px solid var(--warning-border)", borderRadius: 4, padding: "3px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
                  ADDITIONAL CHECK
                </span>
              )}
            </div>
          )}

          {/* Question */}
          <h2 style={{ fontSize: "1.25rem", marginBottom: 24, lineHeight: 1.4 }}>{q.label}</h2>

          <QuestionInput q={q} value={answers[q.field]} onChange={setAnswer} />

          {error && (
            <div style={{ background: "var(--error-bg)", border: "1px solid var(--error-border)", borderRadius: 6, padding: "9px 12px", fontSize: 13, color: "var(--error)", marginTop: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            {step > 0 && (
              <button
                onClick={() => { setError(null); setStep((s) => s - 1); }}
                style={{
                  padding: "11px 20px", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)",
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={next}
              disabled={submitting || (q.required && !answered)}
              style={{
                flex: 1, padding: "11px 20px", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer",
                background: (submitting || (q.required && !answered)) ? "var(--border)" : "var(--brand)",
                color: (submitting || (q.required && !answered)) ? "var(--muted)" : "#fff",
                border: "none",
                transition: "background 0.15s",
              }}
            >
              {submitting ? "Submitting…" : isLast ? "Submit answers" : "Next →"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 32px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "var(--subtle)", letterSpacing: "0.04em" }}>TrustLine · Vera — your answers are encrypted and stored securely</span>
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
  const baseBtn: React.CSSProperties = {
    flex: 1, padding: "12px 0", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer",
    border: "1.5px solid var(--border)", transition: "all 0.12s",
  };

  if (q.type === "boolean") {
    return (
      <div style={{ display: "flex", gap: 10 }}>
        {[true, false].map((opt) => (
          <button
            key={String(opt)}
            onClick={() => onChange(opt)}
            style={{
              ...baseBtn,
              background: value === opt ? "var(--brand)" : "var(--panel)",
              color: value === opt ? "#fff" : "var(--text)",
              borderColor: value === opt ? "var(--brand)" : "var(--border)",
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
              ...baseBtn,
              flex: "none", padding: "12px 16px", textAlign: "left",
              background: value === opt ? "var(--brand-muted)" : "var(--panel)",
              color: value === opt ? "var(--brand)" : "var(--text)",
              borderColor: value === opt ? "var(--brand)" : "var(--border)",
              fontWeight: value === opt ? 700 : 500,
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

  return (
    <textarea
      value={value as string ?? ""}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      style={{ ...inputStyle, resize: "vertical", height: "auto", padding: "10px 14px" }}
      placeholder="Type your answer here…"
    />
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 7, fontSize: 14,
  background: "var(--panel)", border: "1.5px solid var(--border)", color: "var(--text)",
  outline: "none", boxSizing: "border-box",
};

function Screen({ title, body, loading, success }: { title: string; body: string; loading?: boolean; success?: boolean }) {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.07em", color: "var(--brand)" }}>TRUSTLINE</span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 420, textAlign: "center", padding: "0 24px" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>
            {success ? "✓" : loading ? "·" : "⚠"}
          </div>
          <h1 style={{ fontSize: "1.4rem", marginBottom: 10 }}>{title}</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0, lineHeight: 1.6 }}>{body}</p>
        </div>
      </div>
    </main>
  );
}
