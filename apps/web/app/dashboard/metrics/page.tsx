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
          <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>Metrics</span>
        </div>
        {lastRefresh && (
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Updated {lastRefresh.toLocaleTimeString()} · refreshes every 30s
          </span>
        )}
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: "1.75rem", marginBottom: 4 }}>Live Metrics</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>Vera vs. manual KYC · real-time</p>
        </div>

        {!metrics ? (
          <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</div>
        ) : (
          <>
            {/* Primary KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--border)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
              <KpiCell
                label="Time to Decision"
                value={metrics.avgTimeToDecisionMins === 0 ? "—" : `${metrics.avgTimeToDecisionMins} min`}
                benchmark={`vs ${metrics.manualBaselineDays} days manual`}
                bar={{ value: metrics.avgTimeToDecisionMins, max: metrics.manualBaselineDays * 24 * 60, invert: true }}
              />
              <KpiCell
                label="Cost / Verification"
                value={`$${metrics.costPerVerificationUsd.toFixed(2)}`}
                benchmark={`vs $${metrics.manualCostBenchmarkUsd[0]}–$${metrics.manualCostBenchmarkUsd[1]} manual`}
                bar={{ value: metrics.costPerVerificationUsd, max: metrics.manualCostBenchmarkUsd[1], invert: true }}
              />
              <KpiCell
                label="Straight-through Rate"
                value={`${Math.round(metrics.straightThroughRate * 100)}%`}
                benchmark="industry avg ~30%"
                bar={{ value: metrics.straightThroughRate, max: 1 }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <KpiCard
                label="Completion Rate"
                value={`${Math.round(metrics.completionRate * 100)}%`}
                sub="of started KYC flows completed"
                benchmark="industry avg ~60–70%"
                bar={{ value: metrics.completionRate, max: 1 }}
              />
              <KpiCard
                label="Abandonment Rescue Rate"
                value={`${Math.round(metrics.abandonmentRescueRate * 100)}%`}
                sub="abandoned cases recovered by Vera call"
                benchmark="manual baseline: ~0%"
                bar={{ value: metrics.abandonmentRescueRate, max: 1 }}
              />
            </div>

            {/* Before / After table */}
            <div className="card">
              <p className="label" style={{ marginBottom: 16 }}>Before / After at a Glance</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <Th>Metric</Th>
                    <Th accent="var(--error)">Manual (Before)</Th>
                    <Th accent="var(--success)">Vera (After)</Th>
                    <Th>Improvement</Th>
                  </tr>
                </thead>
                <tbody>
                  <CompareRow
                    label="Time to decision"
                    before={`${metrics.manualBaselineDays} days`}
                    after={`${metrics.avgTimeToDecisionMins} min`}
                    delta={metrics.avgTimeToDecisionMins > 0 ? `${Math.round((metrics.manualBaselineDays * 24 * 60) / metrics.avgTimeToDecisionMins)}× faster` : "—"}
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
                    delta={`${(metrics.straightThroughRate - 0.3) >= 0 ? "+" : ""}${Math.round((metrics.straightThroughRate - 0.3) * 100)}pp`}
                    last
                  />
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 20, justifyContent: "flex-end" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Total cases: <strong style={{ color: "var(--text)" }}>{metrics.totalCases}</strong></span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Audit completeness: <strong style={{ color: "var(--success)" }}>{Math.round(metrics.auditCompleteness * 100)}%</strong></span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function KpiCell({ label, value, benchmark, bar }: {
  label: string; value: string; benchmark: string;
  bar: { value: number; max: number; invert?: boolean };
}) {
  const pct = Math.min((bar.invert ? 1 - bar.value / bar.max : bar.value / bar.max) * 100, 100);
  return (
    <div style={{ background: "var(--panel)", padding: "24px 28px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: "1.875rem", fontWeight: 700, fontFamily: "var(--font-playfair), serif", letterSpacing: "-0.02em", color: "var(--text)" }}>{value}</div>
      <div style={{ background: "var(--border-light)", borderRadius: 2, height: 3, margin: "12px 0 6px", overflow: "hidden" }}>
        <div style={{ background: "var(--success)", width: `${pct}%`, height: "100%", transition: "width 0.5s" }} />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{benchmark}</div>
    </div>
  );
}

function KpiCard({ label, value, sub, benchmark, bar }: {
  label: string; value: string; sub: string; benchmark: string;
  bar: { value: number; max: number; invert?: boolean };
}) {
  const pct = Math.min((bar.invert ? 1 - bar.value / bar.max : bar.value / bar.max) * 100, 100);
  return (
    <div className="card">
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: "1.875rem", fontWeight: 700, fontFamily: "var(--font-playfair), serif", letterSpacing: "-0.02em", color: "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{sub}</div>
      <div style={{ background: "var(--border-light)", borderRadius: 2, height: 3, margin: "12px 0 6px", overflow: "hidden" }}>
        <div style={{ background: "var(--success)", width: `${pct}%`, height: "100%", transition: "width 0.5s" }} />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{benchmark}</div>
    </div>
  );
}

function Th({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: accent ?? "var(--muted)", background: "var(--panel-raised)" }}>
      {children}
    </th>
  );
}

function CompareRow({ label, before, after, delta, last }: { label: string; before: string; after: string; delta: string; last?: boolean }) {
  return (
    <tr style={{ borderBottom: last ? "none" : "1px solid var(--border-light)" }}>
      <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-secondary)" }}>{label}</td>
      <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--error)", fontWeight: 600 }}>{before}</td>
      <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--success)", fontWeight: 600 }}>{after}</td>
      <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--brand)", fontWeight: 700 }}>{delta}</td>
    </tr>
  );
}
