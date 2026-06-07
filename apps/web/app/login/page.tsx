export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.07em", color: "var(--brand)" }}>TRUSTLINE</span>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: "1.8rem", marginBottom: 10 }}>Welcome back</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Sign in to access your organisation&apos;s KYC dashboard.
            </p>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "32px 28px" }}>
            <a
              href="/auth/login"
              style={{
                display: "block", width: "100%", padding: "13px 0",
                background: "var(--brand)", color: "#fff",
                borderRadius: 7, fontSize: 14, fontWeight: 600,
                textAlign: "center", textDecoration: "none",
              }}
            >
              Sign in with WorkOS →
            </a>
          </div>

          <p style={{ marginTop: 20, fontSize: 12, color: "var(--subtle)" }}>
            New organisation?{" "}
            <a href="/auth/login?intent=sign-up" style={{ color: "var(--brand)", textDecoration: "none" }}>Create an account</a>
          </p>
        </div>
      </div>

      <div style={{ padding: "16px 32px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "var(--subtle)", letterSpacing: "0.04em" }}>TrustLine · Vera — secure identity verification</span>
      </div>
    </main>
  );
}
