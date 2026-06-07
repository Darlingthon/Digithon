"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CaseSummary } from "@trustline/shared";

interface ReviewModalState {
  caseId: string;
  entityName: string;
  action: "CLEAR" | "REJECT" | null;
}

export default function ReviewQueuePage() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ReviewModalState | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchCases = async () => {
    const res = await fetch("/api/cases");
    if (res.ok) {
      const data = await res.json();
      setCases((data.cases as CaseSummary[]).filter((c) => c.status === "NEEDS_REVIEW"));
    }
    setLoading(false);
  };

  useEffect(() => { fetchCases(); }, []);

  const openModal = (c: CaseSummary, action: "CLEAR" | "REJECT") => {
    setModal({ caseId: c.id, entityName: c.entityName, action });
    setReason("");
    setSubmitError(null);
  };

  const closeModal = () => { setModal(null); setReason(""); setSubmitError(null); };

  const submitDecision = async () => {
    if (!modal || !reason.trim()) { setSubmitError("A reason is required."); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/cases/${modal.caseId}/actions/human-review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome: modal.action, reason }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSubmitError(d.error ?? "Failed to submit decision.");
        return;
      }
      closeModal();
      await fetchCases();
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top bar */}
      <div style={{
        background: "var(--panel)",
        borderBottom: "1px solid var(--border)",
        padding: "0 32px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", color: "var(--brand)" }}>TRUSTLINE</Link>
          <span style={{ color: "var(--border)", fontSize: 18 }}>|</span>
          <Link href="/dashboard" style={{ fontSize: 13, color: "var(--muted)" }}>Cases</Link>
          <span style={{ color: "var(--border)", fontSize: 14 }}>›</span>
          <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>Review Queue</span>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: "1.75rem", marginBottom: 6 }}>Review Queue</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
            Cases flagged <span style={{ color: "var(--warning)", fontWeight: 600 }}>REFER</span> by Vera awaiting human decision
          </p>
        </div>

        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading queue…</div>
        ) : cases.length === 0 ? (
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "56px 32px", textAlign: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--success-bg)", border: "1px solid var(--success-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 18, color: "var(--success)" }}>✓</div>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>No cases need review right now.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cases.map((c) => <ReviewCard key={c.id} c={c} onAction={(action) => openModal(c, action)} />)}
          </div>
        )}
      </div>

      {/* Decision modal */}
      {modal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(26,18,8,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: "blur(2px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, width: "100%", maxWidth: 460, padding: "32px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: 4 }}>
              {modal.action === "CLEAR" ? "Approve" : "Reject"} — {modal.entityName}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 24px", lineHeight: 1.5 }}>
              This decision will be recorded in the audit trail and cannot be undone.
            </p>

            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
              Reason <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={modal.action === "CLEAR"
                ? "e.g. PEP risk assessed, source of funds verified, approved for onboarding."
                : "e.g. Insufficient documentation, unable to verify source of funds."}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 7, fontSize: 13,
                background: "var(--panel-raised)", border: "1.5px solid var(--border)", color: "var(--text)",
                outline: "none", resize: "vertical", boxSizing: "border-box", marginBottom: 4,
                lineHeight: 1.5,
              }}
            />

            {submitError && (
              <div style={{ background: "var(--error-bg)", border: "1px solid var(--error-border)", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "var(--error)", marginBottom: 12 }}>
                {submitError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={closeModal} style={ghostBtn}>Cancel</button>
              <button
                onClick={submitDecision}
                disabled={submitting || !reason.trim()}
                style={{
                  flex: 1, padding: "11px 20px", borderRadius: 7, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
                  background: modal.action === "CLEAR" ? "var(--brand)" : "var(--error)",
                  color: "#fff",
                  opacity: (submitting || !reason.trim()) ? 0.55 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {submitting ? "Submitting…" : modal.action === "CLEAR" ? "✓ Approve" : "✗ Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ReviewCard({ c, onAction }: { c: CaseSummary; onAction: (a: "CLEAR" | "REJECT") => void }) {
  const riskColors: Record<string, { color: string; bg: string; border: string }> = {
    LOW:    { color: "var(--success)", bg: "var(--success-bg)", border: "var(--success-border)" },
    MEDIUM: { color: "var(--warning)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
    HIGH:   { color: "var(--error)",   bg: "var(--error-bg)",   border: "var(--error-border)" },
  };
  const risk = riskColors[c.riskTier] ?? riskColors.MEDIUM;
  const waitMins = Math.round((Date.now() - new Date(c.createdAt).getTime()) / 60000);
  const waitLabel = waitMins < 60 ? `${waitMins}m` : `${Math.round(waitMins / 60)}h`;

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", alignItems: "center", gap: 20, padding: "18px 24px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{c.entityName}</span>
          <span style={{ background: risk.bg, color: risk.color, border: `1px solid ${risk.border}`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{c.riskTier}</span>
          <span style={{ background: "var(--warning-bg)", color: "var(--warning)", border: "1px solid var(--warning-border)", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>NEEDS REVIEW</span>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12.5 }}>
          {c.reason.replace(/_/g, " ")} · waiting {waitLabel} · <code style={{ fontSize: 11, fontFamily: "monospace", color: "var(--subtle)" }}>{c.id}</code>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <Link href={`/dashboard/${c.id}`} style={{
          padding: "8px 14px", borderRadius: 7, fontSize: 13, fontWeight: 600,
          background: "var(--panel-raised)", color: "var(--text)", border: "1px solid var(--border)",
          display: "inline-block",
        }}>
          View case
        </Link>
        <button onClick={() => onAction("CLEAR")} style={decisionBtn("var(--success)", "var(--success-bg)", "var(--success-border)")}>✓ Approve</button>
        <button onClick={() => onAction("REJECT")} style={decisionBtn("var(--error)", "var(--error-bg)", "var(--error-border)")}>✗ Reject</button>
      </div>
    </div>
  );
}

function decisionBtn(color: string, bg: string, border: string): React.CSSProperties {
  return {
    padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer",
    background: bg, color, border: `1.5px solid ${border}`,
  };
}

const ghostBtn: React.CSSProperties = {
  padding: "11px 20px", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer",
  background: "var(--panel-raised)", color: "var(--text-secondary)", border: "1px solid var(--border)",
};
