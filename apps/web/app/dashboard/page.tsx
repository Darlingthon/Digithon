"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CaseSummary, CaseStatus, DecisionOutcome, RiskTierName } from "@trustline/shared";

export default function DashboardPage() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/cases")
        .then((r) => r.json())
        .then((d) => { if (active) setCases(d.cases ?? []); })
        .finally(() => { if (active) setLoading(false); });
    load();
    if (!live) return () => { active = false; };
    const t = setInterval(load, 2500); // live auto-refresh for the demo
    return () => { active = false; clearInterval(t); };
  }, [live]);

  const needsReview = cases.filter((c) => c.status === "NEEDS_REVIEW").length;

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
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", color: "var(--brand)" }}>
            TRUSTLINE
          </Link>
          <span style={{ color: "var(--border)", fontSize: 18 }}>|</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>Cases</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={() => setLive((v) => !v)}
            title={live ? "Live — click to pause" : "Paused — click to resume"}
            style={{
              display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
              background: "transparent", border: "1px solid var(--border)", borderRadius: 20,
              padding: "4px 10px", fontSize: 12, fontWeight: 600, color: live ? "var(--success)" : "var(--muted)",
            }}
          >
            <style>{`@keyframes tl-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: live ? "var(--success)" : "var(--muted)", animation: live ? "tl-pulse 1.4s ease-in-out infinite" : "none" }} />
            {live ? "Live" : "Paused"}
          </button>
          {needsReview > 0 && (
            <Link href="/dashboard/review" style={{
              fontSize: 12, fontWeight: 700,
              background: "var(--warning-bg)", color: "var(--warning)",
              border: "1px solid var(--warning-border)",
              padding: "5px 12px", borderRadius: 20,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--warning)", display: "inline-block" }} />
              {needsReview} need{needsReview === 1 ? "s" : ""} review
            </Link>
          )}
          <Link href="/new" style={{ background: "var(--brand)", color: "#fff", padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>+ New case</Link>
          <Link href="/dashboard/metrics" style={{ fontSize: 13, color: "var(--muted)" }}>
            Metrics →
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>
        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: "1.75rem", marginBottom: 4 }}>Case Queue</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
            {loading ? "Loading…" : `${cases.length} case${cases.length !== 1 ? "s" : ""} total`}
          </p>
        </div>

        {/* Summary stat row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          <StatPill label="Total" value={String(cases.length)} />
          <StatPill label="Decided" value={String(cases.filter((c) => c.status === "DECIDED").length)} />
          <StatPill label="Needs review" value={String(needsReview)} accent={needsReview > 0 ? "var(--warning)" : undefined} />
          <StatPill label="In progress" value={String(cases.filter((c) => !["DECIDED", "NEEDS_REVIEW"].includes(c.status)).length)} />
        </div>

        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: 14, padding: "48px 0", textAlign: "center" }}>Loading cases…</div>
        ) : cases.length === 0 ? (
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "48px 32px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
            No cases yet.
          </div>
        ) : (
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <Th>Entity</Th>
                  <Th>Status</Th>
                  <Th>Risk</Th>
                  <Th>Reason</Th>
                  <Th>Created</Th>
                  <Th>Outcome</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < cases.length - 1 ? "1px solid var(--border-light)" : "none", transition: "background 0.1s" }}>
                    <td style={td}><span style={{ fontWeight: 600, color: "var(--text)" }}>{c.entityName}</span></td>
                    <td style={td}><StatusBadge status={c.status} /></td>
                    <td style={td}><RiskBadge tier={c.riskTier} /></td>
                    <td style={td}><span style={{ color: "var(--muted)", fontSize: 12.5 }}>{c.reason.replace(/_/g, " ")}</span></td>
                    <td style={td}><span style={{ color: "var(--muted)", fontSize: 12.5, whiteSpace: "nowrap" }}>{fmtDate(c.createdAt)}</span></td>
                    <td style={td}>{c.outcome ? <OutcomeBadge outcome={c.outcome} /> : <span style={{ color: "var(--subtle)" }}>—</span>}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <Link href={`/dashboard/${c.id}`} style={{ fontSize: 12.5, color: "var(--brand)", fontWeight: 600 }}>
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function StatPill({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "16px 20px",
      borderLeft: accent ? `3px solid ${accent}` : undefined,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: accent ?? "var(--text)", fontFamily: "var(--font-playfair), serif" }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", background: "var(--panel-raised)" }}>
      {children}
    </th>
  );
}

const td: React.CSSProperties = { padding: "13px 16px", verticalAlign: "middle" };

function StatusBadge({ status }: { status: CaseStatus }) {
  const map: Record<CaseStatus, { label: string; color: string; bg: string; border: string }> = {
    CREATED:            { label: "Created",        color: "var(--neutral)",  bg: "var(--neutral-bg)",  border: "var(--neutral-border)" },
    IDV_PENDING:        { label: "IDV Pending",    color: "var(--warning)",  bg: "var(--warning-bg)",  border: "var(--warning-border)" },
    IDV_DONE:           { label: "IDV Done",       color: "var(--info)",     bg: "var(--info-bg)",     border: "var(--info-border)" },
    QUESTIONNAIRE_SENT: { label: "Q Sent",         color: "var(--channels)", bg: "#F5F3FF",            border: "#DDD6FE" },
    QUESTIONNAIRE_DONE: { label: "Q Done",         color: "var(--info)",     bg: "var(--info-bg)",     border: "var(--info-border)" },
    SCREENING:          { label: "Screening",      color: "var(--warning)",  bg: "var(--warning-bg)",  border: "var(--warning-border)" },
    DECIDED:            { label: "Decided",        color: "var(--success)",  bg: "var(--success-bg)",  border: "var(--success-border)" },
    REVERIFY_DUE:       { label: "Reverify Due",   color: "var(--warning)",  bg: "var(--warning-bg)",  border: "var(--warning-border)" },
    REVERIFY_SENT:      { label: "Reverify Sent",  color: "var(--channels)", bg: "#F5F3FF",            border: "#DDD6FE" },
    NEEDS_REVIEW:       { label: "Needs Review",   color: "var(--error)",    bg: "var(--error-bg)",    border: "var(--error-border)" },
  };
  const { label, color, bg, border } = map[status] ?? { label: status, color: "var(--neutral)", bg: "var(--neutral-bg)", border: "var(--neutral-border)" };
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 4, padding: "2px 8px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function RiskBadge({ tier }: { tier: RiskTierName }) {
  const map: Record<RiskTierName, { color: string; bg: string; border: string }> = {
    LOW:    { color: "var(--success)", bg: "var(--success-bg)", border: "var(--success-border)" },
    MEDIUM: { color: "var(--warning)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
    HIGH:   { color: "var(--error)",   bg: "var(--error-bg)",   border: "var(--error-border)" },
  };
  const { color, bg, border } = map[tier];
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 4, padding: "2px 8px", fontSize: 11.5, fontWeight: 600 }}>
      {tier}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: DecisionOutcome }) {
  const map: Record<DecisionOutcome, { color: string; bg: string; border: string }> = {
    CLEAR:  { color: "var(--success)", bg: "var(--success-bg)", border: "var(--success-border)" },
    REFER:  { color: "var(--warning)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
    REJECT: { color: "var(--error)",   bg: "var(--error-bg)",   border: "var(--error-border)" },
  };
  const { color, bg, border } = map[outcome];
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 4, padding: "2px 8px", fontSize: 11.5, fontWeight: 600 }}>
      {outcome}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
