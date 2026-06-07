import { BrainError, recordAnswers, finalizeCase } from "@trustline/db";
import { NextResponse } from "next/server";
import { channelsUrl } from "@/lib/channels";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await context.params;
    const body = await request.json();
    const recorded = await recordAnswers(caseId, body.channel === "VOICE" ? "VOICE" : "WEB", body.answers ?? {});
    // Text the customer a copy of their answers + a correct-if-wrong disclaimer.
    const base = channelsUrl();
    if (base) {
      await fetch(`${base}/confirm/${caseId}`, { method: "POST" }).catch(() => {});
    }
    // Answers are in — run AML screening + decision so the case finishes on its
    // own (live self-serve flow). Best-effort: a screening failure shouldn't
    // lose the customer's answers, which are already persisted above.
    const decided = await finalizeCase(caseId).catch(() => null);
    return NextResponse.json({ case: decided ?? recorded });
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
