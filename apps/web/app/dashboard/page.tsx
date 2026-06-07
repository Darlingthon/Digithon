import Link from "next/link";
import type { CaseSummary, CaseStatus, DecisionOutcome, RiskTierName } from "@trustline/shared";
import { MOCK_CASES } from "@trustline/shared/fixtures";

export default function DashboardPage() {
  const cases: CaseSummary[] = MOCK_CASES;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, letterSpacing: 2 }}>TRUSTLINE · VERA</p>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700 }}>Reviewer Dashboard</h1>
        </div>
        <Link href="/" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>← Home</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
        <StatCard label="Total cases" value={String(cases.length)} />
        <StatCard label="Decided" value={String(cases.filter((c) => c.status === "DECIDED").length)} />
        <StatCard label="Needs review" value={String(cases.filter((c) => c.status === "NEEDS_REVIEW").length)} accent="#e3a008" />
        <StatCard label="In progress" value={String(cases.filter((c) => !["DECIDED", "NEEDS_REVIEW"].includes(c.status)).length)} />
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
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
              <tr key={c.id} style={{ borderBottom: i < cases.length - 1 ? "1px solid var(--border)" : "none" }}>
                <td style={tdStyle}><span style={{ fontWeight: 600 }}>{c.entityName}</span></td>
                <td style={tdStyle}><StatusBadge status={c.status} /></td>
                <td style={tdStyle}><RiskBadge tier={c.riskTier} /></td>
                <td style={tdStyle}><span style={{ color: "var(--muted)", fontSize: 12 }}>{c.reason.replace(/_/g, " ")}</span></td>
                <td style={tdStyle}><span style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(c.createdAt)}</span></td>
                <td style={tdStyle}>{c.outcome ? <OutcomeBadge outcome={c.outcome} /> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <Link href={`/dashboard/${c.id}`} style={{ color: "var(--brain)", fontSize: 13, textDecoration: "none", fontWeight: 500 }}>
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card" style={accent ? { borderTop: `3px solid ${accent}` } : {}}>
      <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 500 }}>{children}</th>;
}

const tdStyle: React.CSSProperties = { padding: "14px 16px", verticalAlign: "middle" };

function StatusBadge({ status }: { status: CaseStatus }) {
  const map: Record<CaseStatus, { label: string; color: string }> = {
    CREATED: { label: "Created", color: "#8a93a6" },
    IDV_PENDING: { label: "IDV Pending", color: "#e3a008" },
    IDV_DONE: { label: "IDV Done", color: "#1d76db" },
    QUESTIONNAIRE_SENT: { label: "Q Sent", color: "#9b59b6" },
    QUESTIONNAIRE_DONE: { label: "Q Done", color: "#1d76db" },
    SCREENING: { label: "Screening", color: "#e3a008" },
    DECIDED: { label: "Decided", color: "#0e8a16" },
    REVERIFY_DUE: { label: "Reverify Due", color: "#e3a008" },
    REVERIFY_SENT: { label: "Reverify Sent", color: "#9b59b6" },
    NEEDS_REVIEW: { label: "Needs Review", color: "#d93f0b" },
  };
  const { label, color } = map[status] ?? { label: status, color: "#8a93a6" };
  return <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>;
}

function RiskBadge({ tier }: { tier: RiskTierName }) {
  const colors: Record<RiskTierName, string> = { LOW: "#0e8a16", MEDIUM: "#e3a008", HIGH: "#d93f0b" };
  const c = colors[tier];
  return <span style={{ background: c + "22", color: c, border: `1px solid ${c}44`, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>{tier}</span>;
}

function OutcomeBadge({ outcome }: { outcome: DecisionOutcome }) {
  const colors: Record<DecisionOutcome, string> = { CLEAR: "#0e8a16", REFER: "#e3a008", REJECT: "#d93f0b" };
  const c = colors[outcome];
  return <span style={{ background: c + "22", color: c, border: `1px solid ${c}44`, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>{outcome}</span>;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
