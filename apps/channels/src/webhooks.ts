import type { Request, Response, NextFunction } from "express";
import twilio from "twilio";
import { config, validateSignatures } from "./config.js";

// Validate X-Twilio-Signature on every Twilio-facing webhook (per
// twilio-webhook-architecture). Skipped only in dev dry-run (no auth token).
export function verifyTwilioSignature(req: Request, res: Response, next: NextFunction) {
  if (!validateSignatures) return next();
  const signature = req.header("X-Twilio-Signature") ?? "";
  const url = `${config.publicUrl}${req.originalUrl}`;
  const valid = twilio.validateRequest(config.twilio.authToken, signature, url, req.body ?? {});
  if (!valid) return res.status(403).send("Forbidden");
  next();
}

// Inbound SMS — e.g. a customer replying. Minimal TwiML ack for now.
export function inboundSms(req: Request, res: Response) {
  const from = req.body?.From;
  const text = (req.body?.Body ?? "").trim();
  console.log(`📨 inbound SMS from ${from}: ${text}`);
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message("Thanks — open the link we sent to finish your verification, or call us and Vera will help.");
  res.type("text/xml").send(twiml.toString());
}

// Delivery status callback — async, no TwiML, return 204. Idempotent by design.
export function smsStatus(req: Request, res: Response) {
  const { MessageSid, MessageStatus, ErrorCode } = req.body ?? {};
  if (MessageStatus === "failed" || MessageStatus === "undelivered") {
    console.warn(`❌ SMS ${MessageSid} ${MessageStatus} (error ${ErrorCode})`);
  }
  res.sendStatus(204);
}
