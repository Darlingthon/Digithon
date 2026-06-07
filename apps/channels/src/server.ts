import http from "node:http";
import express from "express";
import { config, hasTwilio, hasOpenAI } from "./config.js";
import { dispatchQuestionnaire, verifyOtp } from "./sms.js";
import { startCall } from "./twilio.js";
import { verifyTwilioSignature, inboundSms, smsStatus } from "./webhooks.js";
import { voiceTwiml } from "./voice/twiml.js";
import { attachVoiceBridge } from "./voice/bridge.js";

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio webhooks are form-encoded
app.use(express.json()); // internal/demo triggers

app.get("/health", (_req, res) =>
  res.json({ ok: true, twilio: hasTwilio ? "live" : "dry-run", voice: hasOpenAI ? "live" : "disabled" })
);

// ── Internal trigger: dispatch the questionnaire to a case (Brain/demo calls this) ──
app.post("/dispatch/:caseId", async (req, res) => {
  const { phone } = req.body ?? {};
  if (!phone) return res.status(400).json({ error: "phone required (E.164)" });
  try {
    res.json(await dispatchQuestionnaire(req.params.caseId, phone));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── OTP gate: the web questionnaire (#6) posts the code here to unlock ──
app.post("/otp/verify", async (req, res) => {
  const { caseId, phone, code } = req.body ?? {};
  if (!caseId || !phone || !code)
    return res.status(400).json({ error: "caseId, phone, code required" });
  const ok = await verifyOtp(caseId, phone, code);
  res.status(ok ? 200 : 401).json({ verified: ok });
});

// ── #5 fallback/outbound call: Vera rings the customer to finish by voice ──
// POST /calls/:caseId  { phone }
app.post("/calls/:caseId", async (req, res) => {
  const { caseId } = req.params;
  const { phone } = req.body ?? {};
  if (!phone) return res.status(400).json({ error: "phone required (E.164)" });
  if (!config.publicUrl)
    return res.status(409).json({ error: "set CHANNELS_PUBLIC_URL so Twilio can fetch the voice TwiML" });
  try {
    const url = `${config.publicUrl}/voice?caseId=${encodeURIComponent(caseId)}&phone=${encodeURIComponent(phone)}`;
    const { sid } = await startCall(phone, url);
    res.json({ caseId, callSid: sid });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── Twilio webhooks (signature-validated) ──
app.post("/webhooks/sms", verifyTwilioSignature, inboundSms);
app.post("/webhooks/sms-status", verifyTwilioSignature, smsStatus);
app.post("/webhooks/call-status", verifyTwilioSignature, (req, res) => {
  console.log(`📞 call ${req.body?.CallSid}: ${req.body?.CallStatus}`);
  res.sendStatus(204);
});

// ── Voice (#5): inbound/outbound TwiML → Media Streams bridge ──
app.post("/voice", verifyTwilioSignature, voiceTwiml);

// HTTP + WebSocket (the Media Streams bridge upgrades on /voice/stream).
const server = http.createServer(app);
attachVoiceBridge(server);

server.listen(config.port, () => {
  console.log(`🟢 channels on :${config.port}  (twilio: ${hasTwilio ? "live" : "dry-run"}, voice: ${hasOpenAI ? "live" : "disabled"})`);
  if (!config.publicUrl) console.log("   set CHANNELS_PUBLIC_URL (ngrok) for Twilio callbacks + voice");
});
