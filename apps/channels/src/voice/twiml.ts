import type { Request, Response } from "express";
import twilio from "twilio";
import { config, hasOpenAI } from "./../config.js";

// #5 — Vera voice. DECISION (locked): Twilio Media Streams <-> OpenAI Realtime
// (gpt-realtime-2). See docs/ARCHITECTURE.md.
//
// TwiML: disclose recording up front (trust & safety), then <Connect><Stream>
// the raw call audio to our WebSocket bridge. caseId/phone ride along as Stream
// <Parameter>s so the bridge knows which case it's working.
export function voiceTwiml(req: Request, res: Response) {
  const caseId = (req.query.caseId ?? req.body?.caseId ?? "") as string;
  const phone = (req.query.phone ?? req.body?.From ?? "") as string;
  const twiml = new twilio.twiml.VoiceResponse();

  // Disclosure first — recording + who we are (authenticate the call).
  twiml.say(
    "Hello, this is Vera from TrustLine, calling on a recorded line about the verification we texted you. " +
      "I will only ask the questions from that text, and I will never ask for full card or I.D. numbers."
  );

  if (!hasOpenAI || !config.publicUrl) {
    twiml.say(
      "Our voice assistant is not available right now. Please use the secure link we texted you. Goodbye."
    );
    twiml.hangup();
    return res.type("text/xml").send(twiml.toString());
  }

  // wss:// base derived from the public URL (ngrok in dev, Cloud Run in prod).
  const wssBase = config.publicUrl.replace(/^http/, "ws");
  const connect = twiml.connect();
  const stream = connect.stream({ url: `${wssBase}/voice/stream` });
  if (caseId) stream.parameter({ name: "caseId", value: String(caseId) });
  if (phone) stream.parameter({ name: "phone", value: String(phone) });

  res.type("text/xml").send(twiml.toString());
}
