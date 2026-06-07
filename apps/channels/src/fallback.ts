import { config } from "./config.js";
import { dueForFallbackCall, markFallbackCallPlaced } from "@trustline/db";
import { startCall } from "./twilio.js";

// Abandonment rescue (#5): SMS-mode cases whose questionnaire hasn't been filled
// within config.questionnaireFallbackMs get a Vera voice call. We poll the Brain
// so the timer survives restarts (no lost in-memory setTimeout).
export function startFallbackSweep() {
  if (!config.publicUrl) {
    console.log("   ⤷ questionnaire fallback sweep OFF (set CHANNELS_PUBLIC_URL so Twilio can fetch the voice TwiML)");
    return;
  }

  const threshold = config.questionnaireFallbackMs;
  const every = config.questionnaireSweepMs;

  const tick = async () => {
    try {
      const due = await dueForFallbackCall(threshold);
      for (const { caseId, phone } of due) {
        const url = `${config.publicUrl}/voice?caseId=${encodeURIComponent(caseId)}&phone=${encodeURIComponent(phone)}`;
        try {
          const { sid } = await startCall(phone, url);
          await markFallbackCallPlaced(caseId, sid);
          console.log(`📞 fallback: Vera auto-calling ${caseId} (${phone}) — questionnaire unfilled`);
        } catch (e) {
          console.warn(`fallback call failed for ${caseId}:`, (e as Error).message);
        }
      }
    } catch (e) {
      console.warn("fallback sweep error:", (e as Error).message);
    }
  };

  const timer = setInterval(tick, every);
  timer.unref?.();
  console.log(
    `   ⤷ questionnaire fallback sweep: every ${Math.round(every / 1000)}s, auto-call after ${Math.round(threshold / 1000)}s unfilled`,
  );
}
