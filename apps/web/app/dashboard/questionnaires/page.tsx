"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface QuestionnaireRow {
  id: string;
  name: string;
  riskTier: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  questions: unknown[];
}

const tierColor: Record<string, string> = {
  LOW: "var(--success)",
  MEDIUM: "var(--warning)",
  HIGH: "var(--error)",
};
const tierBg: Record<string, string> = {
  LOW: "var(--success-bg)",
  MEDIUM: "var(--warning-bg)",
  HIGH: "var(--error-bg)",
};

export default function QuestionnairesPage() {
  const [rows, setRows] = useState<QuestionnaireRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/questionnaires")
      .then((r) => r.json())
      .then((d) => setRows(d.questionnaires ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top bar */}
      <div style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/dashboard" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.07em", color: "var(--brand)", textDecoration: "none" }}>TRUSTLINE</Link>
          <span style={{ color: "var(--border)", fontSize: 16 }}>/</span>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Questionnaires</span>
        </div>
        <Link
          href="/dashboard/questionnaires/new"
          style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--brand)", padding: "6px 16px", borderRadius: 6, textDecoration: "none" }}
        >
          + New questionnaire
        </Link>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: 6 }}>Questionnaire templates</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
            Each active template is served to applicants based on their risk tier. Only one template per tier can be active at a time.
          </p>
        </div>

        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: 14, textAlign: "center", padding: "60px 0" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "48px 32px", textAlign: "center" }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 20px" }}>No questionnaire templates yet.</p>
            <Link href="/dashboard/questionnaires/new" style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--brand)", padding: "9px 20px", borderRadius: 6, textDecoration: "none" }}>
              Create your first template
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((q) => (
              <div key={q.id} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{q.name}</span>
                    <span style={{ background: tierBg[q.riskTier] ?? "var(--neutral-bg)", color: tierColor[q.riskTier] ?? "var(--neutral)", border: `1px solid ${tierColor[q.riskTier] ?? "var(--neutral-border)"}20`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
                      {q.riskTier}
                    </span>
                    {q.isActive && (
                      <span style={{ background: "var(--brand-muted)", color: "var(--brand)", border: "1px solid var(--brand)20", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>v{q.version} · {Array.isArray(q.questions) ? q.questions.length : 0} questions · created {new Date(q.createdAt).toLocaleDateString()}</span>
                </div>
                <Link
                  href={`/dashboard/questionnaires/${q.id}`}
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", background: "var(--panel-raised)", border: "1px solid var(--border)", padding: "7px 16px", borderRadius: 6, textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  Edit →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
