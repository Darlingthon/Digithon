"use client";

import Link from "next/link";
import { useState } from "react";

type Result = {
  caseId?: string;
  status?: string;
  outcome?: string | null;
  reasons?: string[];
  entityName?: string;
  error?: string;
};

const OUTCOME_COLOR: Record<string, string> = {
  CLEAR: "#16a34a",
  REFER: "#e3a008",
  REJECT: "#dc2626",
};

export default function NewCasePage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [riskTier, setRiskTier] = useState("LOW");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/cases/auto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, email, riskTier }),
      });
      setResult(await res.json());
    } catch (err) {
      setResult({ error: (err as Error).message });
    } finally {
      setRunning(false);
    }
  }

  const label: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 };
  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "var(--bg)", color: "var(--text)",
    border: "1px solid var(--border)", borderRadius: 8, fontSize: 14,
  };

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, letterSpacing: 2 }}>TRUSTLINE · VERA</p>
        <Link href="/dashboard" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>Dashboard →</Link>
      </div>
      <h1 style={{ margin: "4px 0 6px", fontSize: 26, fontWeight: 700 }}>New verification — autopilot</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, fontSize: 14 }}>
        Enter a name and Vera runs the entire KYC case on her own — identity check,
        questionnaire, AML screening, and a decision — with a full audit trail.
      </p>

      <form onSubmit={run} className="card" style={{ display: "grid", gap: 16, marginTop: 20 }}>
        <div>
          <label style={label}>Full name *</label>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ivan Petrov" required />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={label}>Phone</label>
            <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+359…" />
          </div>
          <div>
            <label style={label}>Email</label>
            <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ivan@example.com" />
          </div>
        </div>
        <div>
          <label style={label}>Risk tier</label>
          <select style={input} value={riskTier} onChange={(e) => setRiskTier(e.target.value)}>
            <option value="LOW">Low — short questionnaire, usually auto-cleared</option>
            <option value="MEDIUM">Medium — adds PEP + volume questions</option>
            <option value="HIGH">High — enhanced due diligence → human review</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={running || !name}
          style={{
            padding: "12px 16px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 14,
            cursor: running || !name ? "default" : "pointer",
            background: running ? "var(--border)" : "var(--brain)", color: "#fff",
          }}
        >
          {running ? "Vera is working…" : "Run full case"}
        </button>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          Tip: include “pep” in the name (e.g. “John Pep”) to watch it get escalated to the review queue.
        </p>
      </form>

      {result && (
        <div className="card" style={{ marginTop: 16 }}>
          {result.error ? (
            <p style={{ color: "#dc2626", margin: 0 }}>❌ {result.error}</p>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  background: OUTCOME_COLOR[result.outcome ?? ""] ?? "var(--border)", color: "#fff",
                  padding: "4px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                }}>
                  {result.outcome ?? result.status}
                </span>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>{result.entityName} · {result.status}</span>
              </div>
              {result.reasons && (
                <ul style={{ margin: "12px 0 0", paddingLeft: 18, color: "var(--text)", fontSize: 14 }}>
                  {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
              <Link href={`/dashboard/${result.caseId}`} style={{ display: "inline-block", marginTop: 14, color: "var(--brain)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                View case + audit trail →
              </Link>
            </>
          )}
        </div>
      )}
    </main>
  );
}
