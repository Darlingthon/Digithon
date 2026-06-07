import { NextResponse } from "next/server";
import { MOCK_CASES } from "@trustline/shared/fixtures";

// Mock OTP verification endpoint. Track B (Channels) replaces this with a real
// Twilio Verify check once issue #4 lands. The mock accepts "000000" as the
// demo OTP for any case in QUESTIONNAIRE_SENT state.
export async function POST(req: Request) {
  const { caseId, otp } = await req.json();

  if (!caseId || !otp) {
    return NextResponse.json({ error: "caseId and otp are required" }, { status: 400 });
  }

  const c = MOCK_CASES.find((x) => x.id === caseId);
  if (!c) {
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  }

  if (c.status !== "QUESTIONNAIRE_SENT") {
    const msg =
      c.status === "QUESTIONNAIRE_DONE" || c.status === "DECIDED"
        ? "Questionnaire already completed."
        : `Case not ready for questionnaire (status: ${c.status}).`;
    return NextResponse.json({ error: msg, code: "WRONG_STATE" }, { status: 409 });
  }

  // Mock: demo OTP is "000000"
  if (otp !== "000000") {
    return NextResponse.json({ error: "Incorrect code. Please try again.", code: "INVALID_OTP" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, caseId });
}
