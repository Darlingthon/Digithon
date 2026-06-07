import { BrainError, getCase, dispatchQuestionnaire } from "@trustline/db";
import { NextResponse } from "next/server";
import { channelsUrl, channelsPost } from "@/lib/channels";

// Fires right after IDV passes. Collects the questionnaire over the channel
// chosen at case creation (Case.qDelivery):
//   - CALL → advance to QUESTIONNAIRE_SENT, then Vera phones the customer now.
//   - SMS  → text the questionnaire link + OTP (Channels advances the case);
//            the Channels sweep auto-calls later if it isn't filled in time.
export async function POST(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await context.params;
    const c = await getCase(caseId);
    const phone = c.entity.phone ?? undefined;
    const mode = c.qDelivery === "CALL" ? "CALL" : "SMS";
    const base = channelsUrl();

    if (mode === "CALL") {
      await dispatchQuestionnaire(caseId); // IDV_DONE → QUESTIONNAIRE_SENT (no SMS)
      if (base && phone) {
        try {
          const call = await channelsPost<{ callSid: string }>(`/calls/${caseId}`, { phone });
          return NextResponse.json({ mode, channel: "call", ...call });
        } catch (e) {
          return NextResponse.json({ mode, channel: "call", warning: (e as Error).message });
        }
      }
      return NextResponse.json({ mode, channel: "call", warning: "channels unavailable — case advanced, call not placed" });
    }

    // SMS: text the questionnaire link + OTP via Channels (which advances state).
    if (base && phone) {
      try {
        const data = await channelsPost(`/dispatch/${caseId}`, { phone });
        return NextResponse.json({ mode, channel: "sms", ...(data as object) });
      } catch {
        // fall through to in-process advance (demo OTP)
      }
    }
    return NextResponse.json({ mode, channel: "sms", case: await dispatchQuestionnaire(caseId) });
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
