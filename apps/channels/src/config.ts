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
};

// True when real Twilio creds are present. Without them we run in DRY-RUN:
// log what we'd send instead of hitting Twilio, so the flow is demoable offline.
export const hasTwilio = Boolean(config.twilio.accountSid && config.twilio.authToken);

// Skip Twilio signature validation only in dev dry-run (no creds to validate with).
export const validateSignatures = hasTwilio && process.env.CHANNELS_SKIP_SIG !== "1";
