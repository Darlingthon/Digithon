"use client";

import Link from "next/link";
import { useState } from "react";
import { LANGUAGES } from "@trustline/shared/questionnaire";

type Mode = "CALL" | "SMS";

type Result = {
  caseId?: string;
  mode?: Mode;
  status?: string;
  entityName?: string;
  link?: string;
  smsSid?: string;
  message?: string;
  error?: string;
};

const MODES: { key: Mode; label: string; blurb: string }[] = [
  { key: "CALL", label: "Vera calls", blurb: "After IDV, Vera phones the customer and runs the questionnaire by voice." },
  { key: "SMS", label: "SMS link", blurb: "After IDV, we text the questionnaire link — Vera auto-calls if it's not filled in time." },
];

export default function NewCasePage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [riskTier, setRiskTier] = useState("LOW");
  const [language, setLanguage] = useState("en");
  const [mode, setMode] = useState<Mode>("CALL");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const canSubmit = !!name && !!phone;

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/cases/auto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, email, riskTier, mode, language }),
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
      <h1 style={{ margin: "4px 0 6px", fontSize: 26, fontWeight: 700 }}>New verification</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, fontSize: 14 }}>
        Vera texts the customer an identity-check link. Once they pass IDV, she collects
        the questionnaire over the channel you pick — then screening and the decision run on their own.
      </p>

      <form onSubmit={run} className="card" style={{ display: "grid", gap: 16, marginTop: 20 }}>
        <div>
          <label style={label}>Collect the questionnaire by</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {MODES.map((m) => {
              const active = mode === m.key;
              return (
                <button
                  type="button"
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  style={{
                    padding: "10px 8px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    background: active ? "var(--brand)" : "var(--bg)",
                    color: active ? "#fff" : "var(--text)",
                    border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
            {MODES.find((m) => m.key === mode)!.blurb}
          </p>
        </div>

        <div>
          <label style={label}>Full name *</label>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ivan Petrov" required />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={label}>Phone *</label>
            <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+359…" required />
          </div>
          <div>
            <label style={label}>Email</label>
            <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ivan@example.com" />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={label}>Risk tier</label>
            <select style={input} value={riskTier} onChange={(e) => setRiskTier(e.target.value)}>
              <option value="LOW">Low — usually auto-cleared</option>
              <option value="MEDIUM">Medium — PEP + volume</option>
              <option value="HIGH">High — human review</option>
            </select>
          </div>
          <div>
            <label style={label}>Call language</label>
            <select style={input} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={running || !canSubmit}
          style={{
            padding: "12px 16px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 14,
            cursor: running || !canSubmit ? "default" : "pointer",
            background: running ? "var(--border)" : "var(--brand)", color: "#fff",
          }}
        >
          {running ? "Sending IDV link…" : "Start verification"}
        </button>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          A real SMS is sent to this number. For the link to open on the phone,
          <code style={{ margin: "0 4px" }}>NEXT_PUBLIC_APP_URL</code> must be publicly reachable (ngrok).
        </p>
      </form>

      {result && (
        <div className="card" style={{ marginTop: 16 }}>
          {result.error ? (
            <p style={{ color: "#dc2626", margin: 0 }}>❌ {result.error}</p>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ background: "var(--brand)", color: "#fff", padding: "4px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700 }}>
                  ✉ IDV link sent
                </span>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>{result.entityName} · {result.mode === "CALL" ? "Vera will call" : "SMS questionnaire"}</span>
              </div>
              {result.message && <p style={{ margin: "12px 0 0", fontSize: 14 }}>{result.message}</p>}
              {result.link && (
                <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                  Or open the IDV step directly: <a href={result.link} style={{ color: "var(--brand)", fontWeight: 600 }}>{result.link}</a>
                </p>
              )}
              {result.caseId && (
                <Link href={`/dashboard/${result.caseId}`} style={{ display: "inline-block", marginTop: 14, color: "var(--brand)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                  View case + audit trail →
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}
