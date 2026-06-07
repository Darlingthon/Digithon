"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import type { Metrics } from "@trustline/shared";

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    const res = await fetch("/api/metrics");
    if (res.ok) {
      setMetrics(await res.json());
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, letterSpacing: 2 }}>TRUSTLINE · VERA</p>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700 }}>Live Metrics</h1>
          {lastRefresh && (
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              Last updated {lastRefresh.toLocaleTimeString()} · auto-refreshes every 30s
            </p>
          )}
        </div>
        <Link href="/dashboard" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>← Dashboard</Link>
      </div>

      {!metrics ? (
        <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          {/* Primary KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
            <KpiCard
              label="Time to Decision"
              value={`${metrics.avgTimeToDecisionMins} min`}
              sub="Vera average"
              benchmark={`vs ${metrics.manualBaselineDays} days manual`}
              positive
              bar={{ value: metrics.avgTimeToDecisionMins, max: metrics.manualBaselineDays * 24 * 60, invert: true }}
            />
            <KpiCard
              label="Cost / Verification"
              value={`$${metrics.costPerVerificationUsd.toFixed(2)}`}
              sub="Vera marginal cost"
              benchmark={`vs $${metrics.manualCostBenchmarkUsd[0]}–$${metrics.manualCostBenchmarkUsd[1]} manual`}
              positive
              bar={{ value: metrics.costPerVerificationUsd, max: metrics.manualCostBenchmarkUsd[1], invert: true }}
            />
            <KpiCard
              label="Straight-through Rate"
              value={`${Math.round(metrics.straightThroughRate * 100)}%`}
              sub="cleared with no human touch"
              benchmark="industry avg ~30%"
              positive
              bar={{ value: metrics.straightThroughRate, max: 1 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 16 }}>
            <KpiCard
              label="Completion Rate"
              value={`${Math.round(metrics.completionRate * 100)}%`}
              sub="of started KYC flows completed"
              benchmark="industry avg ~60–70%"
              positive
              bar={{ value: metrics.completionRate, max: 1 }}
            />
            <KpiCard
              label="Abandonment Rescue Rate"
              value={`${Math.round(metrics.abandonmentRescueRate * 100)}%`}
              sub="abandoned cases recovered by Vera call"
              benchmark="manual: ~0%"
              positive
              bar={{ value: metrics.abandonmentRescueRate, max: 1 }}
            />
          </div>

          {/* Before/After summary table */}
          <div className="card" style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
              Before / After at a Glance
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: 12 }}>
                  <th style={thStyle}>Metric</th>
                  <th style={{ ...thStyle, color: "#d93f0b" }}>Manual (Before)</th>
                  <th style={{ ...thStyle, color: "#0e8a16" }}>Vera (After)</th>
                  <th style={thStyle}>Improvement</th>
                </tr>
              </thead>
              <tbody>
                <CompareRow
                  label="Time to decision"
                  before={`${metrics.manualBaselineDays} days`}
                  after={`${metrics.avgTimeToDecisionMins} min`}
                  delta={`${Math.round((metrics.manualBaselineDays * 24 * 60) / metrics.avgTimeToDecisionMins)}× faster`}
                />
                <CompareRow
                  label="Cost per verification"
                  before={`$${metrics.manualCostBenchmarkUsd[0]}–$${metrics.manualCostBenchmarkUsd[1]}`}
                  after={`$${metrics.costPerVerificationUsd.toFixed(2)}`}
                  delta={`${Math.round(metrics.manualCostBenchmarkUsd[0] / metrics.costPerVerificationUsd)}–${Math.round(metrics.manualCostBenchmarkUsd[1] / metrics.costPerVerificationUsd)}× cheaper`}
                />
                <CompareRow
                  label="Straight-through rate"
                  before="~30%"
                  after={`${Math.round(metrics.straightThroughRate * 100)}%`}
                  delta={`${Math.round((metrics.straightThroughRate - 0.3) * 100) >= 0 ? "+" : ""}${Math.round((metrics.straightThroughRate - 0.3) * 100)}pp`}
                  last
                />
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Total cases: <strong style={{ color: "var(--text)" }}>{metrics.totalCases}</strong></div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Audit completeness: <strong style={{ color: "#0e8a16" }}>{Math.round(metrics.auditCompleteness * 100)}%</strong></div>
          </div>
        </>
      )}
    </main>
  );
}

function KpiCard({
  label, value, sub, benchmark, positive, bar,
}: {
  label: string; value: string; sub: string; benchmark: string; positive: boolean;
  bar: { value: number; max: number; invert?: boolean };
}) {
  const pct = Math.min((bar.invert ? 1 - bar.value / bar.max : bar.value / bar.max) * 100, 100);
  const barColor = positive ? "#0e8a16" : "#d93f0b";
  return (
    <div className="card">
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{value}</div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{sub}</div>
      {/* progress bar */}
      <div style={{ background: "var(--border)", borderRadius: 4, height: 4, margin: "10px 0 6px", overflow: "hidden" }}>
        <div style={{ background: barColor, width: `${pct}%`, height: "100%", borderRadius: 4, transition: "width 0.5s" }} />
      </div>
      <div style={{ color: "#e3a008", fontSize: 11, fontWeight: 600 }}>{benchmark}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: "left", padding: "8px 12px", fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 13 };

function CompareRow({ label, before, after, delta, last }: { label: string; before: string; after: string; delta: string; last?: boolean }) {
  return (
    <tr style={{ borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <td style={{ ...tdStyle, color: "var(--muted)" }}>{label}</td>
      <td style={{ ...tdStyle, color: "#d93f0b", fontWeight: 600 }}>{before}</td>
      <td style={{ ...tdStyle, color: "#0e8a16", fontWeight: 600 }}>{after}</td>
      <td style={{ ...tdStyle, color: "#e3a008", fontWeight: 600 }}>{delta}</td>
    </tr>
  );
}
