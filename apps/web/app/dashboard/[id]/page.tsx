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
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Link href="/dashboard" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>← All cases</Link>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{c.entityName}</h1>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <StatusBadge status={c.status} />
              <RiskBadge tier={c.riskTier} />
              {c.outcome && <OutcomeBadge outcome={c.outcome} />}
              <span style={{ color: "var(--muted)", fontSize: 12, alignSelf: "center" }}>{c.reason.replace(/_/g, " ")}</span>
            </div>
          </div>
          {timeMins !== null && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{timeMins}m</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>time to decision</div>
            </div>
          )}
        </div>
      </div>

      {/* State machine progress bar */}
      <StateMachineBar status={c.status} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
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
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No IDV checks yet.</p>
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

      {/* Questionnaire answers */}
      <Section title="Questionnaire Answers" style={{ marginTop: 16 }}>
        {c.questionnaireResponses.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>No answers recorded yet.</p>
        ) : c.questionnaireResponses.map((r, i) => (
          <div key={i}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <span style={{ background: "#1d76db22", color: "#1d76db", border: "1px solid #1d76db44", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>{r.channel}</span>
              <span style={{ color: "var(--muted)", fontSize: 12, alignSelf: "center" }}>{fmtDate(r.createdAt)}</span>
              {r.complete && <span style={{ color: "#0e8a16", fontSize: 12, alignSelf: "center" }}>✓ Complete</span>}
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
      <Section title="AML Screening" style={{ marginTop: 16 }}>
        {c.screeningResults.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Screening not yet run.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {c.screeningResults.map((s) => <ScreeningRow key={s.id} hit={s} />)}
          </div>
        )}
      </Section>

      {/* Decision */}
      {c.decision && (
        <Section title="Decision" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <OutcomeBadge outcome={c.decision.outcome} />
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{c.decision.automated ? "Automated (STP)" : "Human reviewed"}</span>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>· {fmtDate(c.decision.createdAt)}</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text)", fontSize: 14, lineHeight: 1.8 }}>
            {c.decision.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </Section>
      )}

      {/* Audit Timeline */}
      <Section title="Audit Timeline" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {c.auditEvents.map((e, i) => <AuditRow key={e.id} event={e} last={i === c.auditEvents.length - 1} />)}
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={style}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}

function ScreeningRow({ hit }: { hit: ScreeningHit }) {
  const label = { SANCTIONS: "Sanctions", PEP: "PEP", ADVERSE_MEDIA: "Adverse Media" }[hit.type];
  const color = hit.hit ? "#d93f0b" : "#0e8a16";
  const icon = hit.hit ? "✗ HIT" : "✓ Clear";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
      <span style={{ color, fontWeight: 700, fontSize: 12, minWidth: 56 }}>{icon}</span>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
      {hit.hit && hit.details && (
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{JSON.stringify(hit.details)}</span>
      )}
    </div>
  );
}

function AuditRow({ event, last }: { event: AuditEventSummary; last: boolean }) {
  const actorColor: Record<string, string> = {
    vera: "#1d76db",
    system: "#8a93a6",
    sumsub: "#9b59b6",
    twilio: "#0e8a16",
    customer: "#e3a008",
  };
  const color = actorColor[event.actor] ?? "#8a93a6";
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, marginTop: 4, flexShrink: 0 }} />
        {!last && <div style={{ width: 1, flex: 1, background: "var(--border)", margin: "4px 0" }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 14, minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{event.type.replace(/_/g, " ")}</span>
          <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600 }}>{event.actor}</span>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(event.createdAt)}</span>
        </div>
        {event.data && (
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{JSON.stringify(event.data)}</div>
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
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 8 }}>
      {STATUS_STEPS.map((s, i) => {
        const done = currentIdx >= i && !isTerminal;
        const active = i === currentIdx && !isTerminal;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1, gap: 4 }}>
            <div style={{
              flex: 1, height: 4, borderRadius: 2,
              background: active ? "#1d76db" : done ? "#0e8a16" : "var(--border)",
              transition: "background 0.2s",
            }} />
            {i === STATUS_STEPS.length - 1 && (
              <span style={{ fontSize: 10, color: done ? "#0e8a16" : "var(--muted)", whiteSpace: "nowrap" }}>
                {s.replace(/_/g, " ")}
              </span>
            )}
          </div>
        );
      })}
      {isTerminal && (
        <span style={{ fontSize: 11, color: "#d93f0b", fontWeight: 700, whiteSpace: "nowrap" }}>NEEDS REVIEW</span>
      )}
    </div>
  );
}

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
  return <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 6, padding: "3px 10px", fontSize: 13, fontWeight: 600 }}>{label}</span>;
}

function RiskBadge({ tier }: { tier: RiskTierName }) {
  const colors: Record<RiskTierName, string> = { LOW: "#0e8a16", MEDIUM: "#e3a008", HIGH: "#d93f0b" };
  const c = colors[tier];
  return <span style={{ background: c + "22", color: c, border: `1px solid ${c}44`, borderRadius: 6, padding: "3px 10px", fontSize: 13, fontWeight: 600 }}>{tier} RISK</span>;
}

function OutcomeBadge({ outcome }: { outcome: DecisionOutcome }) {
  const colors: Record<DecisionOutcome, string> = { CLEAR: "#0e8a16", REFER: "#e3a008", REJECT: "#d93f0b" };
  const c = colors[outcome];
  return <span style={{ background: c + "22", color: c, border: `1px solid ${c}44`, borderRadius: 6, padding: "3px 10px", fontSize: 13, fontWeight: 600 }}>{outcome}</span>;
}

function IdvBadge({ status }: { status: "PENDING" | "PASSED" | "FAILED" }) {
  const colors = { PENDING: "#e3a008", PASSED: "#0e8a16", FAILED: "#d93f0b" };
  const c = colors[status];
  return <span style={{ color: c, fontWeight: 600 }}>{status}</span>;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function camelToLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}
