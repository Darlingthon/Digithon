import { MOCK_METRICS } from "@trustline/shared/fixtures";

// Foundation landing page. Confirms the scaffold boots and the shared package
// resolves. Track C replaces this with the real dashboard (issue #7).
export default function Home() {
  const m = MOCK_METRICS;
  return (
    <main className="container">
      <p className="muted" style={{ letterSpacing: 2, fontSize: 12 }}>TRUSTLINE · VERA</p>
      <h1 style={{ fontSize: 40, margin: "8px 0 4px" }}>An AI employee that runs KYC end-to-end.</h1>
      <p className="muted" style={{ maxWidth: 560 }}>
        Foundation scaffold is live. The data model, case state machine, shared
        questionnaire, and mock API are ready — the three tracks can build in
        parallel from here.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, margin: "28px 0" }}>
        <Stat label="Avg time to decision" value={`${m.avgTimeToDecisionMins} min`} sub={`vs ${m.manualBaselineDays} days manual`} />
        <Stat label="Straight-through rate" value={`${Math.round(m.straightThroughRate * 100)}%`} sub="no human touch" />
        <Stat label="Cost / verification" value={`$${m.costPerVerificationUsd.toFixed(2)}`} sub={`vs $${m.manualCostBenchmarkUsd[0]}–${m.manualCostBenchmarkUsd[1]}`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Track color="var(--brain)" name="A · Brain" what="Agent core, decisioning, audit" />
        <Track color="var(--channels)" name="B · Channels" what="Twilio SMS/OTP + Vera voice" />
        <Track color="var(--frontend)" name="C · Frontend" what="IDV, questionnaire, dashboard" />
      </div>

      <p className="muted" style={{ marginTop: 28, fontSize: 13 }}>
        Mock API: <code>/api/cases</code> · <code>/api/metrics</code>
      </p>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card">
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>{sub}</div>
    </div>
  );
}

function Track({ color, name, what }: { color: string; name: string; what: string }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontWeight: 700 }}>{name}</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{what}</div>
    </div>
  );
}
