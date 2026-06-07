import { config } from "./config.js";
import { sendSms, startOtp, checkOtp } from "./twilio.js";
import { caseActions } from "./caseClient.js";
import { audit, createOtpSession, markOtpVerified } from "./store.js";

// #4 — Questionnaire dispatch over SMS.
// Per AGENTS.md the customer gets: an OTP, a link to complete online, and a
// number they can call. We deliver the OTP via Twilio Verify (its own anti-fraud
// SMS) and a second SMS with the OTP-gated link + the call-in number. Trust &
// safety: OTP only, no secrets solicited, opt-out line included.

export interface DispatchResult {
  caseId: string;
  status: string;
  link: string;
  otpSid: string;
  smsSid: string;
}

export async function dispatchQuestionnaire(caseId: string, phone: string): Promise<DispatchResult> {
  const link = `${config.appUrl}/q/${caseId}`;

  // 1) OTP via Verify (Twilio sends the code).
  const { sid: otpSid } = await startOtp(phone);
  await createOtpSession(caseId, otpSid);

  // 2) SMS with the link + call-in number (the code arrives via Verify).
  const callIn = config.callInNumber || "our verification line";
  const body =
    `TrustLine: please finish your verification.\n` +
    `Complete it online: ${link}\n` +
    `Or call ${callIn} and our assistant Vera will help.\n` +
    `Enter the code we just texted to continue. Reply STOP to opt out.`;
  const { sid: smsSid } = await sendSms(phone, body);

  // 3) Advance the case via the Brain (the spine) + audit.
  const summary = await caseActions.dispatchQuestionnaire(caseId);
  await audit(caseId, "SMS_SENT", { link, otpSid, smsSid });

  return { caseId, status: summary.status, link, otpSid, smsSid };
}

// Redeemed by the web OTP gate (#6): verify the code, unlock the questionnaire.
export async function verifyOtp(caseId: string, phone: string, code: string): Promise<boolean> {
  const ok = await checkOtp(phone, code);
  if (ok) {
    await markOtpVerified(caseId);
    await audit(caseId, "OTP_VERIFIED", { channel: "sms" });
  }
  return ok;
}
