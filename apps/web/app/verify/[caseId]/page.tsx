"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useRef } from "react";

export default function VerifyPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleInput = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    if (digits.length === 6) {
      setOtp(digits);
      inputs.current[5]?.focus();
    }
  };

  const submit = async () => {
    const code = otp.join("");
    if (code.length < 6) { setError("Enter all 6 digits."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
      } else {
        setSuccess(true);
        setTimeout(() => router.push(`/questionnaire/${caseId}`), 1200);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <div className="card" style={{ padding: 36, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Enter your code</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 28px" }}>
            We sent a 6-digit code to your phone. Enter it below to access your questionnaire.
          </p>

          {success ? (
            <div style={{ color: "#0e8a16", fontWeight: 700, fontSize: 16 }}>✓ Verified! Redirecting…</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }} onPaste={handlePaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleInput(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    style={{
                      width: 44, height: 52, textAlign: "center", fontSize: 22, fontWeight: 700,
                      background: "var(--bg)", border: `2px solid ${error ? "#d93f0b" : digit ? "#1d76db" : "var(--border)"}`,
                      borderRadius: 8, color: "var(--text)", outline: "none",
                    }}
                  />
                ))}
              </div>

              {error && (
                <div style={{ color: "#d93f0b", fontSize: 13, marginBottom: 16 }}>{error}</div>
              )}

              <button
                onClick={submit}
                disabled={loading || otp.join("").length < 6}
                style={{
                  width: "100%", padding: "12px 0", background: "#1d76db", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Verifying…" : "Continue"}
              </button>

              <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 16 }}>
                Demo: use code <code style={{ color: "var(--text)" }}>000000</code>
              </p>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, marginTop: 16 }}>
          TrustLine · Vera — secure identity verification
        </p>
      </div>
    </main>
  );
}
