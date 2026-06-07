import Link from "next/link";
import { getMetrics } from "@trustline/db";
import type { Metrics } from "@trustline/shared";

export default async function Home() {
  let m: Metrics;
  try {
    m = await getMetrics();
  } catch {
    m = {
      avgTimeToDecisionMins: 0,
      manualBaselineDays: 5,
      completionRate: 0,
      abandonmentRescueRate: 0,
      costPerVerificationUsd: 0.9,
      manualCostBenchmarkUsd: [13, 130],
      straightThroughRate: 0,
      auditCompleteness: 0,
      totalCases: 0,
    };
  }

  return (
    <main className="container">
      <p className="muted" style={{ letterSpacing: 2, fontSize: 12 }}>TRUSTLINE · VERA</p>
      <h1 style={{ fontSize: 40, margin: "8px 0 4px" }}>An AI employee that runs KYC end-to-end.</h1>
      <p className="muted" style={{ maxWidth: 560 }}>
        Vera handles identity verification, questionnaires, AML screening, and decisioning
        — automatically, end-to-end.
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

      <div style={{ marginTop: 28, display: "flex", gap: 16, alignItems: "center" }}>
        <Link href="/dashboard" style={{ background: "#1d76db", color: "#fff", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
          Open Reviewer Dashboard →
        </Link>
        <span className="muted" style={{ fontSize: 13 }}>{m.totalCases} case{m.totalCases !== 1 ? "s" : ""} in system</span>
      </div>
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
