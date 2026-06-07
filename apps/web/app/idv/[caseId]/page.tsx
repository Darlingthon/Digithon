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
      // Get applicant token from our backend
      const res = await fetch("/api/sumsub", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      if (!res.ok) { setState("error"); setErrorMsg("Could not initialise identity verification."); return; }
      const { token, isMock } = await res.json();

      if (isMock) {
        // Sumsub keys not configured — show demo mode
        setState("mock");
        return;
      }

      // Load Sumsub Web SDK dynamically (avoids SSR issues)
      if (!(window as any).snsWebSdk) {
        await loadScript("https://static.sumsub.com/idensic/static/sns-websdk-builder.js");
      }

      const snsWebSdk = (window as any).snsWebSdk;
      sdk = snsWebSdk
        .init(token, () =>
          // Token refresh callback
          fetch("/api/sumsub", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ caseId }),
          })
            .then((r) => r.json())
            .then((d) => d.token)
        )
        .withConf({ lang: "en" })
        .on("idCheck.onStepCompleted", () => {
          setState("processing");
        })
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

  // Demo mode: simulate IDV pass/fail without real Sumsub
  const simulateResult = async (passed: boolean) => {
    setState("processing");
    await markIdv(caseId!, passed, { demo: true });
    setState(passed ? "success" : "failed");
    if (passed) setTimeout(() => router.push(`/verify/${caseId}`), 2000);
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 640, padding: "0 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, letterSpacing: 2 }}>TRUSTLINE · VERA</p>
          <h1 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700 }}>Identity Verification</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0" }}>
            We need to verify your identity before proceeding. This takes about 2 minutes.
          </p>
        </div>

        {state === "loading" && (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            Initialising verification…
          </div>
        )}

        {state === "mock" && (
          <div className="card" style={{ padding: 36, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🧪</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Demo Mode</h2>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 24px" }}>
              Sumsub keys not configured. Simulate an IDV outcome for the demo.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={() => simulateResult(true)} style={btnStyle("#0e8a16")}>✓ Simulate Pass</button>
              <button onClick={() => simulateResult(false)} style={btnStyle("#d93f0b")}>✗ Simulate Fail</button>
            </div>
          </div>
        )}

        {state === "processing" && (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ margin: 0, fontWeight: 600 }}>Processing your verification…</p>
          </div>
        )}

        {state === "success" && (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#0e8a16" }}>Verification passed</h2>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Redirecting you to the next step…</p>
          </div>
        )}

        {state === "failed" && (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>❌</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#d93f0b" }}>Verification failed</h2>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
              We were unable to verify your identity. Please contact support.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <p style={{ color: "#d93f0b", fontWeight: 600, margin: 0 }}>{errorMsg ?? "An error occurred."}</p>
          </div>
        )}

        {/* Sumsub SDK mounts here when keys are present */}
        <div ref={containerRef} style={{ display: state === "ready" ? "block" : "none" }} />
      </div>
    </main>
  );
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

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700,
    background: color + "22", color, border: `2px solid ${color}44`, cursor: "pointer",
  };
}
