"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Question } from "@trustline/shared";

export default function EditQuestionnairePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [name, setName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/questionnaires/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const q = d.questionnaire;
        if (q) {
          setName(q.name);
          setQuestions(q.questions ?? []);
          setIsActive(q.isActive);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const setQuestion = (i: number, patch: Partial<Question>) => {
    setQuestions((prev) => prev.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  };
  const addQuestion = () => setQuestions((prev) => [...prev, { field: "", type: "text", label: "", voicePrompt: "", required: true, tier: "LOW" }]);
  const removeQuestion = (i: number) => setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  const moveUp = (i: number) => {
    if (i === 0) return;
    setQuestions((prev) => { const a = [...prev]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; });
  };
  const moveDown = (i: number) => {
    if (i === questions.length - 1) return;
    setQuestions((prev) => { const a = [...prev]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; });
  };

  const save = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    const invalid = questions.find((q) => !q.field.trim() || !q.label.trim());
    if (invalid) { setError("All questions must have a field key and label."); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/questionnaires/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, questions, isActive }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Save failed."); return; }
      router.push("/dashboard/questionnaires");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</span>
    </main>
  );

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/dashboard" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.07em", color: "var(--brand)", textDecoration: "none" }}>TRUSTLINE</Link>
          <span style={{ color: "var(--border)", fontSize: 16 }}>/</span>
          <Link href="/dashboard/questionnaires" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>Questionnaires</Link>
          <span style={{ color: "var(--border)", fontSize: 16 }}>/</span>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Edit</span>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 32px" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: 28 }}>Edit questionnaire</h1>

        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "24px", marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Template name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>Active (served to applicants)</span>
          </label>
        </div>

        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Questions</h2>
          <button onClick={addQuestion} style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", background: "var(--panel)", color: "var(--brand)", border: "1.5px solid var(--brand)", padding: "6px 14px", borderRadius: 6 }}>
            + Add question
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {questions.map((q, i) => (
            <QuestionEditor
              key={i}
              q={q}
              index={i}
              total={questions.length}
              onChange={(patch) => setQuestion(i, patch)}
              onRemove={() => removeQuestion(i)}
              onMoveUp={() => moveUp(i)}
              onMoveDown={() => moveDown(i)}
            />
          ))}
        </div>

        {error && (
          <div style={{ background: "var(--error-bg)", border: "1px solid var(--error-border)", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "var(--error)", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/dashboard/questionnaires" style={{ padding: "11px 20px", borderRadius: 7, fontSize: 14, fontWeight: 600, color: "var(--text)", background: "var(--panel)", border: "1px solid var(--border)", textDecoration: "none" }}>
            Cancel
          </Link>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: "11px 0", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", background: saving ? "var(--border)" : "var(--brand)", color: saving ? "var(--muted)" : "#fff", border: "none" }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </main>
  );
}

function QuestionEditor({ q, index, total, onChange, onRemove, onMoveUp, onMoveDown }: {
  q: Question; index: number; total: number;
  onChange: (p: Partial<Question>) => void;
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.06em" }}>QUESTION {index + 1}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onMoveUp} disabled={index === 0} style={iconBtnStyle}>↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1} style={iconBtnStyle}>↓</button>
          <button onClick={onRemove} style={{ ...iconBtnStyle, color: "var(--error)" }}>×</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Field key</label>
          <input value={q.field} onChange={(e) => onChange({ field: e.target.value.replace(/\s/g, "_") })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Type</label>
          <select value={q.type} onChange={(e) => onChange({ type: e.target.value as Question["type"] })} style={inputStyle}>
            <option value="text">Text</option>
            <option value="boolean">Yes / No</option>
            <option value="single_select">Single select</option>
            <option value="number">Number</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Label</label>
        <input value={q.label} onChange={(e) => onChange({ label: e.target.value })} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Voice prompt</label>
        <input value={q.voicePrompt} onChange={(e) => onChange({ voicePrompt: e.target.value })} style={inputStyle} />
      </div>
      {q.type === "single_select" && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Options (comma-separated)</label>
          <input value={(q.options ?? []).join(", ")} onChange={(e) => onChange({ options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} style={inputStyle} />
        </div>
      )}
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={q.required ?? false} onChange={(e) => onChange({ required: e.target.checked })} />
          Required
        </label>
        <div>
          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginRight: 6 }}>MIN TIER</label>
          <select value={q.tier} onChange={(e) => onChange({ tier: e.target.value as Question["tier"] })} style={{ fontSize: 13, padding: "4px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--panel-raised)", color: "var(--text)" }}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 6, fontSize: 14, border: "1.5px solid var(--border)", background: "var(--panel-raised)", color: "var(--text)", boxSizing: "border-box", outline: "none" };
const iconBtnStyle: React.CSSProperties = { padding: "3px 8px", fontSize: 13, cursor: "pointer", background: "var(--panel-raised)", border: "1px solid var(--border)", borderRadius: 5, color: "var(--muted)" };
