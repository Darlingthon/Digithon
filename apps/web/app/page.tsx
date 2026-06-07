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
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Nav strip */}
      <nav style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--panel)",
        padding: "0 32px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", color: "var(--brand)" }}>
          TRUSTLINE
        </span>
        <Link
          href="/dashboard"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--panel)",
            background: "var(--brand)",
            padding: "6px 16px",
            borderRadius: 6,
            display: "inline-block",
          }}
        >
          Open Dashboard
        </Link>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "72px 32px 56px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--brand)", marginBottom: 16 }}>
          Vera · KYC Automation
        </p>
        <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", fontWeight: 700, lineHeight: 1.1, color: "var(--text)", maxWidth: 640, marginBottom: 20 }}>
          An AI employee that runs KYC end-to-end.
        </h1>
        <p style={{ fontSize: "1.0625rem", color: "var(--text-secondary)", maxWidth: 520, lineHeight: 1.7, marginBottom: 40 }}>
          Vera handles identity verification, compliance questionnaires, AML screening, and decisioning — automatically, with a full audit trail.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Link
            href="/dashboard"
            style={{
              background: "var(--brand)",
              color: "#fff",
              padding: "11px 24px",
              borderRadius: 7,
              fontWeight: 600,
              fontSize: 14,
              display: "inline-block",
            }}
          >
            Reviewer Dashboard →
          </Link>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {m.totalCases} case{m.totalCases !== 1 ? "s" : ""} processed
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 32px" }}>
        <hr />
      </div>

      {/* KPI strip */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 32px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 24 }}>
          Live performance
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 1, background: "var(--border)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <KpiCell
            label="Avg. time to decision"
            value={m.avgTimeToDecisionMins === 0 ? "—" : `${m.avgTimeToDecisionMins} min`}
            vs={`vs ${m.manualBaselineDays} days manual`}
          />
          <KpiCell
            label="Straight-through rate"
            value={`${Math.round(m.straightThroughRate * 100)}%`}
            vs="no human touch"
          />
          <KpiCell
            label="Cost per verification"
            value={`$${m.costPerVerificationUsd.toFixed(2)}`}
            vs={`vs $${m.manualCostBenchmarkUsd[0]}–${m.manualCostBenchmarkUsd[1]} manual`}
          />
        </div>
      </div>

      {/* Track overview */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 32px 72px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 24 }}>
          System components
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <TrackCard
            color="var(--brain)"
            letter="A"
            name="Brain"
            what="Agent orchestration, decisioning, and full audit trail."
          />
          <TrackCard
            color="var(--channels)"
            letter="B"
            name="Channels"
            what="Twilio SMS/OTP delivery and Vera outbound voice calls."
          />
          <TrackCard
            color="var(--frontend)"
            letter="C"
            name="Frontend"
            what="IDV flow, questionnaire, and reviewer dashboard."
          />
        </div>
      </div>
    </main>
  );
}

function KpiCell({ label, value, vs }: { label: string; value: string; vs: string }) {
  return (
    <div style={{ background: "var(--panel)", padding: "24px 28px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: "1.875rem", fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-playfair), serif", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{vs}</div>
    </div>
  );
}

function TrackCard({ color, letter, name, what }: { color: string; letter: string; name: string; what: string }) {
  return (
    <div style={{
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderTop: `3px solid ${color}`,
      borderRadius: 8,
      padding: "20px 22px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.05em" }}>{letter}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{name}</span>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{what}</p>
    </div>
  );
}
