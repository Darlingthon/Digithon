import { NextResponse } from "next/server";
import { getCase, BrainError } from "@trustline/db";

export async function POST(req: Request) {
  const { caseId, otp } = await req.json();

  if (!caseId || !otp) {
    return NextResponse.json({ error: "caseId and otp are required" }, { status: 400 });
  }

  let c: Awaited<ReturnType<typeof getCase>>;
  try {
    c = await getCase(caseId);
  } catch (err) {
    if (err instanceof BrainError && err.status === 404) {
      return NextResponse.json({ error: "case not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  if (c.status !== "QUESTIONNAIRE_SENT") {
    const msg =
      c.status === "QUESTIONNAIRE_DONE" || c.status === "DECIDED"
        ? "Questionnaire already completed."
        : `Case not ready for questionnaire (status: ${c.status}).`;
    return NextResponse.json({ error: msg, code: "WRONG_STATE" }, { status: 409 });
  }

  // Demo OTP — Twilio Verify replaces this when TWILIO_* env vars are set (Track B)
  if (otp !== "000000") {
    return NextResponse.json({ error: "Incorrect code. Please try again.", code: "INVALID_OTP" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, caseId });
}
