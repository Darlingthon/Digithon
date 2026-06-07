"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Re-runs the server component (and its getCase fetch) on an interval so the
// audit timeline + pipeline state update live during the demo, without a manual
// reload. Auto-stops once the case is terminal; click to pause/resume.
export default function AutoRefresh({ intervalMs = 2500, active = true }: { intervalMs?: number; active?: boolean }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const running = active && !paused;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [running, intervalMs, router]);

  const color = running ? "var(--success)" : "var(--muted)";
  return (
    <button
      onClick={() => setPaused((p) => !p)}
      title={running ? "Live — click to pause" : "Paused — click to resume"}
      style={{
        display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
        background: "transparent", border: "1px solid var(--border)", borderRadius: 20,
        padding: "4px 10px", fontSize: 12, fontWeight: 600, color,
      }}
    >
      <style>{`@keyframes tl-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, animation: running ? "tl-pulse 1.4s ease-in-out infinite" : "none" }} />
      {running ? (active ? "Live" : "Live") : "Paused"}
    </button>
  );
}
