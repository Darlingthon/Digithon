import { BrainError, dispatchQuestionnaire, getCase } from "@trustline/db";
import { NextResponse } from "next/server";
import { channelsUrl } from "@/lib/channels";

// Called after IDV passes. Advances IDV_DONE → QUESTIONNAIRE_SENT and, when the
// Channels service is reachable, sends a REAL Twilio Verify OTP + SMS. Falls
// back to an in-process Brain advance (demo OTP 000000) if Channels is down.
export async function POST(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await context.params;
    const c = await getCase(caseId);
    const phone = c.entity.phone;
    const base = channelsUrl();

    if (base && phone) {
      try {
        const r = await fetch(`${base}/dispatch/${caseId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        if (r.ok) {
          const data = await r.json();
          return NextResponse.json({ live: true, ...data });
        }
        // Channels reachable but case already advanced / errored — fall through.
      } catch {
        // Channels unreachable — fall back to in-process advance below.
      }
    }

    return NextResponse.json({ live: false, case: await dispatchQuestionnaire(caseId) });
  } catch (error) {
    return toError(error);
  }
}

function toError(error: unknown) {
  if (error instanceof BrainError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
}
