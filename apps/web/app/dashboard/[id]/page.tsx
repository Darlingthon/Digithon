import Link from "next/link";
import { notFound } from "next/navigation";
import { getCase } from "@trustline/db";
import type {
  CaseDetail,
  CaseStatus,
  DecisionOutcome,
  RiskTierName,
  AuditEventSummary,
  ScreeningHit,
} from "@trustline/shared";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let raw: Awaited<ReturnType<typeof getCase>>;
  try {
    raw = await getCase(id);
  } catch {
    return notFound();
  }

  const c: CaseDetail = {
    id: raw.id,
    entityName: raw.entity.fullName,
    email: raw.entity.email,
    phone: raw.entity.phone,
    status: raw.status as CaseStatus,
    riskTier: raw.riskTier as RiskTierName,
    reason: raw.reason as CaseDetail["reason"],
    createdAt: raw.createdAt.toISOString(),
    decidedAt: raw.decidedAt?.toISOString() ?? null,
    outcome: (raw.decision?.outcome ?? null) as DecisionOutcome | null,
    idvChecks: raw.idvChecks.map((idv) => ({
      id: idv.id,
      status: idv.status as "PENDING" | "PASSED" | "FAILED",
      provider: idv.provider,
      providerRef: idv.providerRef,
      documentType: idv.documentType,
      livenessPass: idv.livenessPass,
      createdAt: idv.createdAt.toISOString(),
    })),
    questionnaireResponses: raw.responses.map((r) => ({
      channel: r.channel as "WEB" | "VOICE",
      answers: r.answers as Record<string, unknown>,
      complete: r.complete,
      createdAt: r.createdAt.toISOString(),
    })),
    screeningResults: raw.screenings.map((s) => ({
      id: s.id,
      type: s.type as "SANCTIONS" | "PEP" | "ADVERSE_MEDIA",
      hit: s.hit,
      details: s.details as Record<string, unknown> | null,
    })),
    decision: raw.decision
      ? {
          outcome: raw.decision.outcome as DecisionOutcome,
          reasons: raw.decision.reasons as string[],
          automated: raw.decision.automated,
          reviewedBy: null,
          createdAt: raw.decision.createdAt.toISOString(),
        }
      : null,
    auditEvents: raw.auditEvents.map((e) => ({
      id: e.id,
      type: e.type,
      actor: e.actor,
      data: e.data as Record<string, unknown> | null,
      createdAt: e.createdAt.toISOString(),
    })),
  };

  const timeMins = c.decidedAt
    ? Math.round((new Date(c.decidedAt).getTime() - new Date(c.createdAt).getTime()) / 60000)
    : null;

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
        gap: 16,
      }}>
        <Link href="/" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", color: "var(--brand)" }}>TRUSTLINE</Link>
        <span style={{ color: "var(--border)", fontSize: 18 }}>|</span>
        <Link href="/dashboard" style={{ fontSize: 13, color: "var(--muted)" }}>Cases</Link>
        <span style={{ color: "var(--border)", fontSize: 14 }}>›</span>
        <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{c.entityName}</span>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 32px" }}>
        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: "1.875rem", marginBottom: 10 }}>{c.entityName}</h1>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <StatusBadge status={c.status} />
              <RiskBadge tier={c.riskTier} />
              {c.outcome && <OutcomeBadge outcome={c.outcome} />}
              <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{c.reason.replace(/_/g, " ")}</span>
            </div>
          </div>
          {timeMins !== null && (
            <div style={{ textAlign: "right", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 20px" }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--font-playfair), serif", color: "var(--text)" }}>{timeMins}m</div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Time to decision</div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 28 }}>
          <StateMachineBar status={c.status} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* Contact */}
          <Section title="Contact">
            <Row label="Email" value={c.email ?? "—"} />
            <Row label="Phone" value={c.phone ?? "—"} />
            <Row label="Created" value={fmtDate(c.createdAt)} />
            {c.decidedAt && <Row label="Decided" value={fmtDate(c.decidedAt)} />}
          </Section>

          {/* IDV */}
          <Section title="Identity Verification">
            {c.idvChecks.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No IDV checks yet.</p>
            ) : c.idvChecks.map((idv) => (
              <div key={idv.id}>
                <Row label="Status" value={<IdvBadge status={idv.status} />} />
                <Row label="Document" value={idv.documentType ?? "—"} />
                <Row label="Liveness" value={idv.livenessPass === true ? "✓ Pass" : idv.livenessPass === false ? "✗ Fail" : "—"} />
                <Row label="Provider ref" value={idv.providerRef ?? "—"} />
                <Row label="At" value={fmtDate(idv.createdAt)} />
              </div>
            ))}
          </Section>
        </div>

        {/* Questionnaire */}
        <Section title="Questionnaire Answers" style={{ marginBottom: 16 }}>
          {c.questionnaireResponses.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No answers recorded yet.</p>
          ) : c.questionnaireResponses.map((r, i) => (
            <div key={i}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                <ChannelBadge channel={r.channel} />
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(r.createdAt)}</span>
                {r.complete && <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 600 }}>✓ Complete</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {Object.entries(r.answers).map(([k, v]) => (
                  <Row key={k} label={camelToLabel(k)} value={String(v)} />
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* AML Screening */}
        <Section title="AML Screening" style={{ marginBottom: 16 }}>
          {c.screeningResults.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Screening not yet run.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {c.screeningResults.map((s) => <ScreeningRow key={s.id} hit={s} />)}
            </div>
          )}
        </Section>

        {/* Decision */}
        {c.decision && (
          <Section title="Decision" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
              <OutcomeBadge outcome={c.decision.outcome} />
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {c.decision.automated ? "Automated · Vera" : "Human reviewed"}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>· {fmtDate(c.decision.createdAt)}</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.9, color: "var(--text-secondary)" }}>
              {c.decision.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Section>
        )}

        {/* Audit timeline */}
        <Section title="Audit Timeline">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {c.auditEvents.map((e, i) => (
              <AuditRow key={e.id} event={e} last={i === c.auditEvents.length - 1} />
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={style}>
      <p className="label" style={{ marginBottom: 14 }}>{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right", maxWidth: "62%", color: "var(--text)" }}>{value}</span>
    </div>
  );
}

function ScreeningRow({ hit }: { hit: ScreeningHit }) {
  const label = { SANCTIONS: "Sanctions", PEP: "PEP", ADVERSE_MEDIA: "Adverse Media" }[hit.type];
  const color = hit.hit ? "var(--error)" : "var(--success)";
  const bg = hit.hit ? "var(--error-bg)" : "var(--success-bg)";
  const border = hit.hit ? "var(--error-border)" : "var(--success-border)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", background: bg, borderRadius: 6, border: `1px solid ${border}` }}>
      <span style={{ color, fontWeight: 700, fontSize: 11.5 }}>{hit.hit ? "✗ HIT" : "✓ Clear"}</span>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
      {hit.hit && hit.details && (
        <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{JSON.stringify(hit.details)}</span>
      )}
    </div>
  );
}

function AuditRow({ event, last }: { event: AuditEventSummary; last: boolean }) {
  const actorColors: Record<string, string> = {
    vera: "var(--brand)",
    system: "var(--neutral)",
    sumsub: "var(--channels)",
    twilio: "var(--success)",
    customer: "var(--warning)",
  };
  const color = actorColors[event.actor] ?? "var(--neutral)";
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: 5 }} />
        {!last && <div style={{ width: 1, flex: 1, background: "var(--border)", margin: "4px 0" }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 16, minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{event.type.replace(/_/g, " ")}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color, background: color + "15", border: `1px solid ${color}30`, borderRadius: 3, padding: "1px 6px" }}>{event.actor}</span>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(event.createdAt)}</span>
        </div>
        {event.data && (
          <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2, fontFamily: "monospace" }}>{JSON.stringify(event.data)}</div>
        )}
      </div>
    </div>
  );
}

const STATUS_STEPS: CaseStatus[] = [
  "CREATED", "IDV_PENDING", "IDV_DONE", "QUESTIONNAIRE_SENT",
  "QUESTIONNAIRE_DONE", "SCREENING", "DECIDED",
];

function StateMachineBar({ status }: { status: CaseStatus }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  const isTerminal = status === "NEEDS_REVIEW";
  const labels: Record<string, string> = {
    CREATED: "Start", IDV_PENDING: "IDV", IDV_DONE: "IDV Done",
    QUESTIONNAIRE_SENT: "Q Sent", QUESTIONNAIRE_DONE: "Q Done", SCREENING: "Screen", DECIDED: "Done",
  };
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {STATUS_STEPS.map((s, i) => {
        const done = !isTerminal && currentIdx > i;
        const active = !isTerminal && i === currentIdx;
        return (
          <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ height: 3, borderRadius: 2, background: active ? "var(--brand)" : done ? "var(--success)" : "var(--border)" }} />
            {(active || i === 0 || i === STATUS_STEPS.length - 1) && (
              <span style={{ fontSize: 10, color: active ? "var(--brand)" : done ? "var(--success)" : "var(--muted)", fontWeight: active ? 700 : 400 }}>
                {labels[s]}
              </span>
            )}
          </div>
        );
      })}
      {isTerminal && <span style={{ fontSize: 11, color: "var(--error)", fontWeight: 700, whiteSpace: "nowrap", marginLeft: 8 }}>NEEDS REVIEW</span>}
    </div>
  );
}

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
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 4, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
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
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 4, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
      {tier} RISK
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
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 4, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
      {outcome}
    </span>
  );
}

function IdvBadge({ status }: { status: "PENDING" | "PASSED" | "FAILED" }) {
  const map = {
    PENDING: { color: "var(--warning)", bg: "var(--warning-bg)" },
    PASSED:  { color: "var(--success)", bg: "var(--success-bg)" },
    FAILED:  { color: "var(--error)",   bg: "var(--error-bg)" },
  };
  const { color } = map[status];
  return <span style={{ color, fontWeight: 600, fontSize: 13 }}>{status}</span>;
}

function ChannelBadge({ channel }: { channel: "WEB" | "VOICE" }) {
  return (
    <span style={{ background: "var(--info-bg)", color: "var(--info)", border: "1px solid var(--info-border)", borderRadius: 4, padding: "2px 8px", fontSize: 11.5, fontWeight: 600 }}>
      {channel}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function camelToLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}
