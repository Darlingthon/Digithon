import { config } from "./config.js";
import { sendSms, startOtp, checkOtp } from "./twilio.js";
import { caseActions } from "./caseClient.js";
import { audit, createOtpSession, markOtpVerified } from "./store.js";
import { getCase } from "@trustline/db";
import { questionsForTier, type RiskTier } from "@trustline/shared";

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

// Invite SMS: the very first touch — a link to start identity verification.
// No OTP and no state change (the case is still IDV_PENDING); the OTP is sent
// later by dispatchQuestionnaire once IDV passes.
export async function sendInvite(caseId: string, phone: string): Promise<{ caseId: string; link: string; smsSid: string }> {
  const link = `${config.appUrl}/idv/${caseId}`;
  const body =
    `TrustLine: please verify your identity to continue.\n` +
    `Start here: ${link}\n` +
    `Reply STOP to opt out.`;
  const { sid: smsSid } = await sendSms(phone, body);
  await audit(caseId, "INVITE_SENT", { link, smsSid });
  return { caseId, link, smsSid };
}

export async function dispatchQuestionnaire(caseId: string, phone: string): Promise<DispatchResult> {
  // IDV has passed by now — link goes straight to the OTP gate + questionnaire.
  const link = `${config.appUrl}/verify/${caseId}`;

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

// After answers are collected (web or voice), text the customer a copy of what
// we recorded with a disclaimer to call back and correct anything wrong. The
// alphanumeric sender is one-way, so we point them at the call-in line.
export async function sendAnswersConfirmation(caseId: string) {
  const c = await getCase(caseId);
  const phone = c.entity.phone;
  if (!phone) return { caseId, skipped: "no phone on file" };
  const resp = c.responses?.[0];
  if (!resp) return { caseId, skipped: "no answers recorded" };

  const answers = (resp.answers ?? {}) as Record<string, unknown>;
  const questions = questionsForTier(c.riskTier as RiskTier);
  const labelFor = (k: string) => questions.find((q) => q.field === k)?.label ?? camelToLabel(k);
  const fmt = (v: unknown) => (typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));
  const lines = Object.entries(answers).map(([k, v]) => `• ${labelFor(k)}: ${fmt(v)}`);
  if (!lines.length) return { caseId, skipped: "empty answers" };

  const callIn = config.callInNumber || "our verification line";
  const body =
    `TrustLine — please review the answers we recorded:\n` +
    `${lines.join("\n")}\n\n` +
    `If anything is wrong, call ${callIn} and Vera will correct it.`;
  const { sid } = await sendSms(phone, body);
  await audit(caseId, "ANSWERS_CONFIRMATION_SENT", { smsSid: sid, count: lines.length });
  return { caseId, smsSid: sid, count: lines.length };
}

function camelToLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
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
