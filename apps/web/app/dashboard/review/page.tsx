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
      await fetchCases(); // refresh the queue
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, letterSpacing: 2 }}>TRUSTLINE · VERA</p>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700 }}>Review Queue</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
            Cases flagged <span style={{ color: "#e3a008", fontWeight: 600 }}>REFER</span> by Vera awaiting human decision
          </p>
        </div>
        <Link href="/dashboard" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>← Dashboard</Link>
      </div>

      {loading ? (
        <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading queue…</div>
      ) : cases.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <p style={{ color: "var(--muted)", fontSize: 15, margin: 0 }}>No cases need review right now.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {cases.map((c) => <ReviewCard key={c.id} c={c} onAction={(action) => openModal(c, action)} />)}
        </div>
      )}

      {/* Decision modal */}
      {modal && (
        <div style={{
          position: "fixed", inset: 0, background: "#0009", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 50,
        }} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="card" style={{ width: "100%", maxWidth: 440, padding: 32 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>
              {modal.action === "CLEAR" ? "Approve" : "Reject"} — {modal.entityName}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 20px" }}>
              This decision will be recorded in the audit trail and cannot be undone.
            </p>

            <label style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 6 }}>
              Reason <span style={{ color: "#d93f0b" }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={modal.action === "CLEAR"
                ? "e.g. PEP risk assessed, source of funds verified, approved for onboarding."
                : "e.g. Insufficient documentation, unable to verify source of funds."}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13,
                background: "var(--bg)", border: "2px solid var(--border)", color: "var(--text)",
                outline: "none", resize: "vertical", boxSizing: "border-box", marginBottom: 4,
              }}
            />

            {submitError && <div style={{ color: "#d93f0b", fontSize: 13, marginBottom: 8 }}>{submitError}</div>}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={closeModal} style={btnStyle("ghost")}>Cancel</button>
              <button
                onClick={submitDecision}
                disabled={submitting || !reason.trim()}
                style={{
                  ...btnStyle(modal.action === "CLEAR" ? "approve" : "reject"),
                  flex: 1,
                  opacity: (submitting || !reason.trim()) ? 0.6 : 1,
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
  const riskColors: Record<string, string> = { LOW: "#0e8a16", MEDIUM: "#e3a008", HIGH: "#d93f0b" };
  const rc = riskColors[c.riskTier] ?? "#8a93a6";
  const waitMins = Math.round((Date.now() - new Date(c.createdAt).getTime()) / 60000);
  const waitLabel = waitMins < 60 ? `${waitMins}m` : `${Math.round(waitMins / 60)}h`;

  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 24px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{c.entityName}</span>
          <span style={{ background: rc + "22", color: rc, border: `1px solid ${rc}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{c.riskTier}</span>
          <span style={{ background: "#e3a00822", color: "#e3a008", border: "1px solid #e3a00844", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>NEEDS REVIEW</span>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          {c.reason.replace(/_/g, " ")} · waiting {waitLabel} · <code style={{ fontSize: 11 }}>{c.id}</code>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <Link
          href={`/dashboard/${c.id}`}
          style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" }}
        >
          View case
        </Link>
        <button onClick={() => onAction("CLEAR")} style={actionBtn("#0e8a16")}>✓ Approve</button>
        <button onClick={() => onAction("REJECT")} style={actionBtn("#d93f0b")}>✗ Reject</button>
      </div>
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
    background: color + "22", color, border: `1.5px solid ${color}55`,
  };
}

function btnStyle(variant: "ghost" | "approve" | "reject"): React.CSSProperties {
  const map = {
    ghost: { background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--border)" },
    approve: { background: "#0e8a16", color: "#fff", border: "none" },
    reject: { background: "#d93f0b", color: "#fff", border: "none" },
  };
  return { padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", ...map[variant] };
}
