import type { Request, Response } from "express";
import twilio from "twilio";

// #5 placeholder — Vera voice. DECISION (locked): Twilio Media Streams <->
// OpenAI Realtime (gpt-realtime-2). See docs/ARCHITECTURE.md.
//
// For now this only does the disclosure (trust & safety) and exits. Issue #5
// replaces the body with <Start><Recording> + <Connect><Stream> to the
// OpenAI Realtime bridge.
export function voiceTwiml(_req: Request, res: Response) {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    "Hello, this is Vera from TrustLine. This call is recorded. " +
      "I will only continue using the code from your text message and will never ask for full card or I.D. numbers."
  );
  twiml.say("Our voice assistant is coming online shortly. Please use the link we texted you for now. Goodbye.");
  twiml.hangup();
  res.type("text/xml").send(twiml.toString());
}
