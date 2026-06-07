import express from "express";
import { config, hasTwilio } from "./config.js";
import { dispatchQuestionnaire, verifyOtp } from "./sms.js";
import { verifyTwilioSignature, inboundSms, smsStatus } from "./webhooks.js";
import { voiceTwiml } from "./voice/twiml.js";

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio webhooks are form-encoded
app.use(express.json()); // internal/demo triggers

app.get("/health", (_req, res) =>
  res.json({ ok: true, twilio: hasTwilio ? "live" : "dry-run" })
);

// ── Internal trigger: dispatch the questionnaire to a case (Brain/demo calls this) ──
// POST /dispatch/:caseId  { phone }
app.post("/dispatch/:caseId", async (req, res) => {
  const { phone } = req.body ?? {};
  if (!phone) return res.status(400).json({ error: "phone required (E.164)" });
  try {
    const result = await dispatchQuestionnaire(req.params.caseId, phone);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── OTP gate: the web questionnaire (#6) posts the code here to unlock ──
// POST /otp/verify  { caseId, phone, code }
app.post("/otp/verify", async (req, res) => {
  const { caseId, phone, code } = req.body ?? {};
  if (!caseId || !phone || !code)
    return res.status(400).json({ error: "caseId, phone, code required" });
  const ok = await verifyOtp(caseId, phone, code);
  res.status(ok ? 200 : 401).json({ verified: ok });
});

// ── Twilio webhooks (signature-validated) ──
app.post("/webhooks/sms", verifyTwilioSignature, inboundSms);
app.post("/webhooks/sms-status", verifyTwilioSignature, smsStatus);

// ── Voice (#5 placeholder) ──
app.post("/voice", verifyTwilioSignature, voiceTwiml);

app.listen(config.port, () => {
  console.log(`🟢 channels on :${config.port}  (twilio: ${hasTwilio ? "live" : "dry-run"})`);
  if (!config.publicUrl) console.log("   set CHANNELS_PUBLIC_URL (ngrok) for Twilio callbacks");
});
