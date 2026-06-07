import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Load the repo-root .env (single source of env for all services).
loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv(); // also pick up a local .env if present

export const config = {
  // Cloud Run injects PORT (8080); fall back to CHANNELS_PORT then 4000 locally.
  port: Number(process.env.PORT ?? process.env.CHANNELS_PORT ?? 4000),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  // public base URL of THIS service (ngrok in dev) — used for Twilio callbacks
  publicUrl: process.env.CHANNELS_PUBLIC_URL ?? "",
  callInNumber: process.env.TWILIO_PHONE_NUMBER ?? "",

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID ?? "",
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID ?? "",
    fromNumber: process.env.TWILIO_PHONE_NUMBER ?? "",
  },

  // Brain's CaseActions HTTP API; empty -> use in-memory mock (fixtures).
  brainUrl: process.env.BRAIN_URL ?? "",

  // SMS-questionnaire fallback: if a texted questionnaire isn't filled within
  // this window, Vera auto-calls the customer. Default 24h; set short to demo.
  questionnaireFallbackMs: Number(process.env.QUESTIONNAIRE_FALLBACK_MS ?? 24 * 60 * 60 * 1000),
  // How often the sweep checks for stalled questionnaires.
  questionnaireSweepMs: Number(process.env.QUESTIONNAIRE_SWEEP_MS ?? 30_000),

  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    // Vera's realtime speech model (per AGENTS.md).
    model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2",
    voice: process.env.OPENAI_REALTIME_VOICE ?? "marin",
    // Transcribe the CALLER's audio too, for a complete two-sided audit trail.
    // gpt-4o-transcribe (full) is markedly more accurate than -mini on low-bitrate
    // 8kHz phone audio. Pin the language so it doesn't drift to e.g. German on an
    // accented "uh-huh"; override OPENAI_TRANSCRIBE_LANGUAGE="" to auto-detect.
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe",
    transcribeLanguage: process.env.OPENAI_TRANSCRIBE_LANGUAGE ?? "en",
    // server_vad turn detection (lower latency than semantic_vad). Higher
    // threshold = less likely to false-trigger on phone echo.
    vadThreshold: Number(process.env.OPENAI_VAD_THRESHOLD ?? 0.6),
    vadSilenceMs: Number(process.env.OPENAI_VAD_SILENCE_MS ?? 600),
    // Only treat caller speech as a real interruption once it's sustained this
    // long. Long enough to ignore echo/short blips, short enough that Vera
    // yields quickly instead of talking over you.
    bargeGateMs: Number(process.env.OPENAI_BARGE_GATE_MS ?? 500),
  },
};

// True when the OpenAI Realtime bridge can run (voice #5). Without a key the
// /voice route still discloses + exits gracefully (no live bridge).
export const hasOpenAI = Boolean(config.openai.apiKey);

// True when real Twilio creds are present. Without them we run in DRY-RUN:
// log what we'd send instead of hitting Twilio, so the flow is demoable offline.
export const hasTwilio = Boolean(config.twilio.accountSid && config.twilio.authToken);

// Skip Twilio signature validation only in dev dry-run (no creds to validate with).
export const validateSignatures = hasTwilio && process.env.CHANNELS_SKIP_SIG !== "1";
