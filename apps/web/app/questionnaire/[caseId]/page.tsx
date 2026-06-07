// Stub for issue #10 — questionnaire renderer (schema-driven, assistant-ui).
// OTP gate redirects here after successful verification.
export default async function QuestionnairePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ maxWidth: 480, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Questionnaire</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          OTP verified for case <code>{caseId}</code>.<br />
          Full questionnaire UI coming in issue #10.
        </p>
      </div>
    </main>
  );
}
