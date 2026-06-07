import twilio from "twilio";
import { config, hasTwilio } from "./config.js";

// Lazily construct the client so the service boots without creds (dry-run).
let client: ReturnType<typeof twilio> | null = null;
function getClient() {
  if (!client) client = twilio(config.twilio.accountSid, config.twilio.authToken);
  return client;
}

/** Send an SMS via the Messaging Service (preferred) or a from-number. */
export async function sendSms(to: string, body: string): Promise<{ sid: string }> {
  if (!hasTwilio) {
    console.log(`📭 [dry-run] SMS → ${to}\n${body}\n`);
    return { sid: `SM_dryrun_${Date.now()}` };
  }
  const msg = await getClient().messages.create({
    to,
    body,
    ...(config.twilio.messagingServiceSid
      ? { messagingServiceSid: config.twilio.messagingServiceSid }
      : { from: config.twilio.fromNumber }),
    ...(config.publicUrl ? { statusCallback: `${config.publicUrl}/webhooks/sms-status` } : {}),
  });
  return { sid: msg.sid };
}

/** Start a Twilio Verify OTP — Twilio sends the code SMS to the customer. */
export async function startOtp(to: string): Promise<{ sid: string }> {
  if (!hasTwilio || !config.twilio.verifyServiceSid) {
    console.log(`🔑 [dry-run] OTP sent to ${to} (use code 123456 to verify)`);
    return { sid: `VE_dryrun_${Date.now()}` };
  }
  const v = await getClient()
    .verify.v2.services(config.twilio.verifyServiceSid)
    .verifications.create({ to, channel: "sms" });
  return { sid: v.sid };
}

/** Place an outbound call; Twilio fetches TwiML from `twimlUrl` when answered. */
export async function startCall(to: string, twimlUrl: string): Promise<{ sid: string }> {
  if (!hasTwilio) {
    console.log(`📞 [dry-run] outbound call → ${to}\n   TwiML: ${twimlUrl}`);
    return { sid: `CA_dryrun_${Date.now()}` };
  }
  const call = await getClient().calls.create({
    to,
    from: config.twilio.fromNumber,
    url: twimlUrl,
    ...(config.publicUrl ? { statusCallback: `${config.publicUrl}/webhooks/call-status` } : {}),
  });
  return { sid: call.sid };
}

/** Hang up an in-progress call (used to auto-end after the questionnaire). */
export async function hangUp(callSid: string): Promise<void> {
  if (!hasTwilio || !callSid) {
    console.log(`📴 [dry-run] hang up ${callSid}`);
    return;
  }
  await getClient().calls(callSid).update({ status: "completed" });
}

/** Check a Verify OTP code. Dry-run accepts "123456". */
export async function checkOtp(to: string, code: string): Promise<boolean> {
  if (!hasTwilio || !config.twilio.verifyServiceSid) {
    return code === "123456";
  }
  const check = await getClient()
    .verify.v2.services(config.twilio.verifyServiceSid)
    .verificationChecks.create({ to, code });
  return check.status === "approved";
}
