"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type IdvState = "loading" | "ready" | "mock" | "processing" | "success" | "failed" | "error";

export default function IdvPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<IdvState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;

    let sdk: { destroy?: () => void; launch?: (el: HTMLElement) => void } | null = null;

    const init = async () => {
      const res = await fetch("/api/sumsub", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      if (!res.ok) { setState("error"); setErrorMsg("Could not initialise identity verification."); return; }
      const { token, isMock } = await res.json();

      if (isMock) { setState("mock"); return; }

      if (!(window as any).snsWebSdk) {
        await loadScript("https://static.sumsub.com/idensic/static/sns-websdk-builder.js");
      }

      const snsWebSdk = (window as any).snsWebSdk;
      sdk = snsWebSdk
        .init(token, () =>
          fetch("/api/sumsub", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ caseId }),
          })
            .then((r) => r.json())
            .then((d) => d.token)
        )
        .withConf({ lang: "en" })
        .on("idCheck.onStepCompleted", () => setState("processing"))
        .on("idCheck.onApplicantStatusChanged", async (payload: any) => {
          const reviewResult = payload?.reviewResult?.reviewAnswer;
          if (reviewResult === "GREEN") {
            await markIdv(caseId, true, payload);
            setState("success");
            setTimeout(() => router.push(`/verify/${caseId}`), 2000);
          } else if (reviewResult === "RED") {
            await markIdv(caseId, false, payload);
            setState("failed");
          }
        })
        .on("idCheck.onError", (err: any) => {
          setState("error");
          setErrorMsg(String(err?.message ?? "Unknown SDK error"));
        })
        .build();

      if (!containerRef.current) { setState("error"); setErrorMsg("SDK container not ready."); return; }
      sdk.launch(containerRef.current);
      setState("ready");
    };

    init().catch((err) => { setState("error"); setErrorMsg(String(err?.message ?? err)); });

    return () => { sdk?.destroy?.(); };
  }, [caseId, router]);

  const simulateResult = async (passed: boolean) => {
    setState("processing");
    await markIdv(caseId!, passed, { demo: true });
    setState(passed ? "success" : "failed");
    if (passed) setTimeout(() => router.push(`/verify/${caseId}`), 2000);
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "var(--panel)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.07em", color: "var(--brand)" }}>TRUSTLINE</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Identity Verification</span>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 600 }}>
          {/* Page title */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{ fontSize: "1.6rem", marginBottom: 8 }}>Identity Verification</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
              We need to verify your identity before proceeding. This takes about 2 minutes.
            </p>
          </div>

          {state === "loading" && (
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "48px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
              Initialising verification…
            </div>
          )}

          {state === "mock" && (
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "40px 32px", textAlign: "center" }}>
              <div style={{ display: "inline-block", background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "var(--warning)", letterSpacing: "0.07em", marginBottom: 20 }}>
                DEMO MODE
              </div>
              <h2 style={{ fontSize: "1.2rem", marginBottom: 10 }}>Sumsub not configured</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 28px", lineHeight: 1.6 }}>
                No Sumsub keys are set. Simulate an IDV outcome to continue the demo flow.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={() => simulateResult(true)} style={actionBtn("var(--success)", "var(--success-bg)", "var(--success-border)")}>
                  ✓ Simulate Pass
                </button>
                <button onClick={() => simulateResult(false)} style={actionBtn("var(--error)", "var(--error-bg)", "var(--error-border)")}>
                  ✗ Simulate Fail
                </button>
              </div>
            </div>
          )}

          {state === "processing" && (
            <StatusCard
              bg="var(--info-bg)" border="var(--info-border)"
              title="Processing…"
              body="Analysing your verification. Please wait."
            />
          )}

          {state === "success" && (
            <StatusCard
              bg="var(--success-bg)" border="var(--success-border)" titleColor="var(--success)"
              title="Verification passed"
              body="Redirecting you to the next step…"
            />
          )}

          {state === "failed" && (
            <StatusCard
              bg="var(--error-bg)" border="var(--error-border)" titleColor="var(--error)"
              title="Verification failed"
              body="We were unable to verify your identity. Please contact support."
            />
          )}

          {state === "error" && (
            <StatusCard
              bg="var(--error-bg)" border="var(--error-border)" titleColor="var(--error)"
              title="Something went wrong"
              body={errorMsg ?? "An error occurred."}
            />
          )}

          <div ref={containerRef} style={{ display: state === "ready" ? "block" : "none" }} />
        </div>
      </div>

      <div style={{ padding: "16px 32px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "var(--subtle)", letterSpacing: "0.04em" }}>TrustLine · Vera — secure identity verification</span>
      </div>
    </main>
  );
}

function StatusCard({ bg, border, title, body, titleColor }: { bg: string; border: string; title: string; body: string; titleColor?: string }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: "36px 32px", textAlign: "center" }}>
      <h2 style={{ fontSize: "1.1rem", marginBottom: 8, color: titleColor ?? "var(--text)" }}>{title}</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>{body}</p>
    </div>
  );
}

function actionBtn(color: string, bg: string, border: string): React.CSSProperties {
  return {
    padding: "11px 24px", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer",
    background: bg, color, border: `1.5px solid ${border}`,
  };
}

async function markIdv(caseId: string, passed: boolean, rawResult: unknown) {
  await fetch(`/api/cases/${caseId}/actions/mark-idv-done`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ passed, rawResult }),
  });
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
