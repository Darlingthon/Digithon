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
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Minimal header */}
      <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.07em", color: "var(--brand)" }}>TRUSTLINE</span>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <h1 style={{ fontSize: "1.6rem", marginBottom: 10 }}>Confirm your identity</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              We sent a 6-digit code to your registered phone number. Enter it below to access your questionnaire.
            </p>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "32px 28px" }}>
            {success ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--success-bg)", border: "1px solid var(--success-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 20 }}>✓</div>
                <p style={{ fontWeight: 700, color: "var(--success)", margin: 0 }}>Verified. Redirecting…</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }} onPaste={handlePaste}>
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
                        width: 44, height: 52,
                        textAlign: "center", fontSize: 22, fontWeight: 700,
                        background: "var(--panel-raised)",
                        border: `1.5px solid ${error ? "var(--error-border)" : digit ? "var(--brand)" : "var(--border)"}`,
                        borderRadius: 6, color: "var(--text)", outline: "none",
                        transition: "border-color 0.15s",
                        fontFamily: "var(--font-playfair), serif",
                      }}
                    />
                  ))}
                </div>

                {error && (
                  <div style={{ background: "var(--error-bg)", border: "1px solid var(--error-border)", borderRadius: 6, padding: "9px 12px", fontSize: 13, color: "var(--error)", marginBottom: 16 }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={submit}
                  disabled={loading || otp.join("").length < 6}
                  style={{
                    width: "100%", padding: "12px 0",
                    background: loading || otp.join("").length < 6 ? "var(--border)" : "var(--brand)",
                    color: loading || otp.join("").length < 6 ? "var(--muted)" : "#fff",
                    border: "none", borderRadius: 7, fontSize: 14, fontWeight: 600,
                    cursor: loading || otp.join("").length < 6 ? "not-allowed" : "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  {loading ? "Verifying…" : "Continue"}
                </button>
              </>
            )}
          </div>

          <p style={{ textAlign: "center", color: "var(--subtle)", fontSize: 12, marginTop: 20 }}>
            Demo: use code <code style={{ color: "var(--muted)", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 5px" }}>000000</code>
          </p>
        </div>
      </div>

      <div style={{ padding: "16px 32px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "var(--subtle)", letterSpacing: "0.04em" }}>TrustLine · Vera — secure identity verification</span>
      </div>
    </main>
  );
}
