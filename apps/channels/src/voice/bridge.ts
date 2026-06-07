import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { getCase, recordAnswers, recordCallTranscript, finalizeCase } from "@trustline/db";
import { sendAnswersConfirmation } from "../sms.js";
import { questionsForTier, languageName, type Question } from "@trustline/shared";
import { config, hasOpenAI } from "./../config.js";
import { hangUp } from "./../twilio.js";

// ── Vera voice bridge ──────────────────────────────────────────────────────
// Twilio Media Streams (G.711 μ-law 8kHz) <-> OpenAI Realtime (gpt-realtime-2,
// audio/pcmu in+out) — audio is a straight base64 passthrough, no transcoding.
//
// Follows Twilio's official speech-assistant-openai-realtime reference: let
// server_vad manage turns + responses, and handle interruptions with a MARK
// QUEUE + conversation.item.truncate (so barge-in is clean, not choppy). We add
// caller transcription, the questionnaire tool, and auto-hangup on completion.

const OPENAI_WS = `wss://api.openai.com/v1/realtime?model=${config.openai.model}`;

export function attachVoiceBridge(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    if (!req.url || !req.url.startsWith("/voice/stream")) return; // ignore others
    wss.handleUpgrade(req, socket, head, (ws) => handleTwilioStream(ws));
  });
  console.log(`🎙️  voice bridge on /voice/stream  (openai: ${hasOpenAI ? "live" : "disabled"})`);
}

function handleTwilioStream(twilioWs: WebSocket) {
  let streamSid = "";
  let callSid = "";
  let caseId = "";
  let openai: WebSocket | null = null;
  let openaiReady = false;
  let greeted = false;
  let pendingSession: unknown = null; // sent on session.created

  // Interruption tracking (Twilio reference pattern).
  let latestMediaTimestamp = 0;
  let lastAssistantItem: string | null = null;
  let responseStartTimestampTwilio: number | null = null;
  let markQueue: string[] = [];

  // Completion / auto-hangup.
  let answersSubmitted = false;
  let finishing = false; // tool submitted ok → wrapping up
  let endMarkSent = false;
  let goodbyeFallbackSent = false;
  let sawAudioThisResponse = false; // did the current response speak any audio?
  let pendingRetry = false; // tool failed → ask the caller to retry

  // Transcript.
  const transcript: { role: "vera" | "customer"; text: string }[] = [];
  let veraBuf = "";

  const sendToTwilio = (obj: unknown) => {
    if (twilioWs.readyState === WebSocket.OPEN) twilioWs.send(JSON.stringify(obj));
  };
  const sendToOpenAI = (obj: unknown) => {
    if (openai && openai.readyState === WebSocket.OPEN) openai.send(JSON.stringify(obj));
  };

  // Send a Twilio mark after each chunk of Vera audio; Twilio echoes it back
  // once that audio finishes playing, which is how we know real playback progress.
  function sendMark() {
    if (!streamSid) return;
    sendToTwilio({ event: "mark", streamSid, mark: { name: "responsePart" } });
    markQueue.push("responsePart");
  }

  // Caller started talking over Vera → truncate her audio at the point actually
  // heard and flush Twilio's playback buffer. Mark queue ensures we only do this
  // while audio is genuinely playing (avoids spurious cuts).
  function handleSpeechStarted() {
    if (markQueue.length > 0 && responseStartTimestampTwilio != null && lastAssistantItem) {
      const audioEndMs = Math.max(0, latestMediaTimestamp - responseStartTimestampTwilio);
      sendToOpenAI({
        type: "conversation.item.truncate",
        item_id: lastAssistantItem,
        content_index: 0,
        audio_end_ms: audioEndMs,
      });
      sendToTwilio({ event: "clear", streamSid });
      markQueue = [];
      lastAssistantItem = null;
      responseStartTimestampTwilio = null;
    }
  }

  // ── Twilio → us ──
  twilioWs.on("message", (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.event) {
      case "start":
        streamSid = msg.start?.streamSid ?? "";
        callSid = msg.start?.callSid ?? "";
        caseId = msg.start?.customParameters?.caseId ?? "";
        latestMediaTimestamp = 0;
        responseStartTimestampTwilio = null;
        console.log(`🎙️  stream start case=${caseId || "?"} call=${callSid}`);
        openConnectionToOpenAI(caseId).catch((e) => console.error("openai connect failed:", e));
        break;
      case "media":
        latestMediaTimestamp = Number(msg.media?.timestamp ?? latestMediaTimestamp);
        if (openaiReady && msg.media?.payload) {
          sendToOpenAI({ type: "input_audio_buffer.append", audio: msg.media.payload });
        }
        break;
      case "mark":
        if (msg.mark?.name === "endcall") {
          // Goodbye finished playing → short grace, then hang up.
          setTimeout(() => {
            hangUp(callSid).catch(() => {});
            finalize();
          }, 600);
        } else if (markQueue.length > 0) {
          markQueue.shift();
        }
        break;
      case "stop":
        finalize();
        break;
    }
  });

  twilioWs.on("close", finalize);

  // ── connect + configure OpenAI Realtime ──
  async function openConnectionToOpenAI(id: string) {
    if (!hasOpenAI) {
      console.warn("voice: OPENAI_API_KEY missing — closing stream");
      return finalize();
    }
    const caseData = id ? await getCase(id).catch(() => null) : null;
    const tier = (caseData?.riskTier ?? "LOW") as "LOW" | "MEDIUM" | "HIGH";
    const name = caseData?.entity?.fullName ?? "the customer";
    const questions = questionsForTier(tier);
    // Per-case language (falls back to the configured default). Drives both what
    // Vera speaks and the transcription language so accented audio isn't mis-read.
    const langCode = (caseData?.language as string) || config.openai.transcribeLanguage;
    const langName = languageName(langCode);

    pendingSession = {
      type: "session.update",
      session: {
        type: "realtime",
        output_modalities: ["audio"],
        instructions: buildInstructions(name, questions, langName),
        audio: {
          input: {
            format: { type: "audio/pcmu" },
            // server_vad manages turn-taking AND auto-creates Vera's responses;
            // we never create per-turn responses ourselves. Threshold tuned up a
            // touch to resist phone-echo false triggers.
            turn_detection: { type: "server_vad", threshold: config.openai.vadThreshold },
            transcription: {
              model: config.openai.transcribeModel,
              // Pin the call's language so accented phone audio doesn't get
              // mis-detected as another language, and prime the model with the
              // KYC vocabulary it should expect so terms/numbers come through.
              ...(langCode ? { language: langCode } : {}),
              prompt: buildTranscriptionPrompt(questions),
            },
          },
          output: { format: { type: "audio/pcmu" }, voice: config.openai.voice },
        },
        tools: [submitTool(questions)],
      },
    };

    openai = new WebSocket(OPENAI_WS, {
      headers: { Authorization: `Bearer ${config.openai.apiKey}` },
    });
    openai.on("message", (raw) => handleOpenAIEvent(JSON.parse(raw.toString())));
    openai.on("error", (e) => console.error("openai ws error:", e.message));
    openai.on("close", () => {
      openaiReady = false;
    });
  }

  function handleOpenAIEvent(evt: any) {
    switch (evt.type) {
      case "session.created":
        if (pendingSession) sendToOpenAI(pendingSession);
        break;
      case "session.updated":
        openaiReady = true;
        if (!greeted) {
          greeted = true;
          // Nudge Vera to begin per her instructions (greet + disclose + ask Q1).
          sendToOpenAI({
            type: "conversation.item.create",
            item: { type: "message", role: "user", content: [{ type: "input_text", text: "Start the call now." }] },
          });
          sendToOpenAI({ type: "response.create" });
        }
        break;
      case "response.created":
        sawAudioThisResponse = false;
        break;
      case "response.output_audio.delta":
        if (evt.delta) {
          sawAudioThisResponse = true;
          sendToTwilio({ event: "media", streamSid, media: { payload: evt.delta } });
          if (responseStartTimestampTwilio == null) responseStartTimestampTwilio = latestMediaTimestamp;
          if (evt.item_id) lastAssistantItem = evt.item_id;
          sendMark();
        }
        break;
      case "input_audio_buffer.speech_started":
        handleSpeechStarted();
        break;
      case "response.output_audio_transcript.delta":
        veraBuf += evt.delta ?? "";
        break;
      case "response.output_audio_transcript.done":
        if (veraBuf.trim()) transcript.push({ role: "vera", text: veraBuf.trim() });
        veraBuf = "";
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (evt.transcript?.trim()) transcript.push({ role: "customer", text: evt.transcript.trim() });
        break;
      case "response.function_call_arguments.done":
        handleToolCall(evt);
        break;
      case "response.done":
        // Reset audio-timing trackers so the next response starts clean.
        responseStartTimestampTwilio = null;
        lastAssistantItem = null;
        if (pendingRetry) {
          pendingRetry = false;
          sendToOpenAI({ type: "response.create" }); // ask the caller to retry
        } else if (finishing && !endMarkSent) {
          if (sawAudioThisResponse) {
            // Vera already spoke her goodbye in this turn → schedule hangup once
            // Twilio finishes playing it.
            endMarkSent = true;
            sendToTwilio({ event: "mark", streamSid, mark: { name: "endcall" } });
            setTimeout(() => {
              hangUp(callSid).catch(() => {});
              finalize();
            }, 9000); // fallback if the endcall mark never returns
          } else if (!goodbyeFallbackSent) {
            // She called the tool silently — generate one short goodbye.
            goodbyeFallbackSent = true;
            sendToOpenAI({ type: "response.create" });
          }
        }
        break;
      case "error":
        console.error("openai event error:", evt.error?.message ?? evt);
        break;
    }
  }

  async function handleToolCall(evt: any) {
    if (evt.name !== "submit_questionnaire") return;
    let answers: Record<string, unknown> = {};
    try {
      answers = JSON.parse(evt.arguments ?? "{}");
    } catch {
      /* ignore malformed */
    }
    let ok = true;
    try {
      if (caseId) await recordAnswers(caseId, "VOICE", answers);
      answersSubmitted = true;
      console.log(`✅ voice answers recorded for ${caseId}`);
      if (caseId) {
        // Text the customer a copy of their answers with a correct-if-wrong note.
        sendAnswersConfirmation(caseId)
          .then((r) => console.log(`✉ answers confirmation:`, JSON.stringify(r)))
          .catch((e) => console.warn("sendAnswersConfirmation failed:", (e as Error).message));
        // Answers are in — run AML screening + decision so the case finishes on
        // its own once Vera hangs up (best-effort; won't block the call).
        finalizeCase(caseId)
          .then((d) => console.log(`🏁 case ${caseId} finalized: ${d.outcome ?? d.status}`))
          .catch((e) => console.warn("finalizeCase failed:", (e as Error).message));
      }
    } catch (e) {
      ok = false;
      console.warn("recordAnswers failed:", (e as Error).message);
    }
    sendToOpenAI({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: evt.call_id,
        output: JSON.stringify({ ok, message: ok ? "saved" : "could not save, ask them to retry" }),
      },
    });
    // ok: Vera already says goodbye in this same turn — DON'T create a second
    // response (that's the double-goodbye). We just hang up after this response
    // (response.done handles it; with a fallback if she called the tool silently).
    if (ok) finishing = true;
    else pendingRetry = true; // retry needs a fresh response
  }

  let finalized = false;
  async function finalize() {
    if (finalized) return;
    finalized = true;
    try {
      openai?.close();
    } catch {
      /* noop */
    }
    if (caseId && transcript.length) {
      await recordCallTranscript(caseId, { turns: transcript, answersSubmitted }, callSid).catch((e) =>
        console.warn("recordCallTranscript failed:", (e as Error).message)
      );
      console.log(`📝 transcript saved for ${caseId} (${transcript.length} turns)`);
    }
  }
}

// ── prompt + tool builders ──
function buildInstructions(name: string, questions: Question[], language = "English"): string {
  const list = questions.map((q, i) => `${i + 1}. ${q.voicePrompt}  (record as: ${q.field})`).join("\n");
  return [
    `You are Vera, an AI verification officer for TrustLine, on a recorded phone call with ${name}.`,
    ``,
    `LANGUAGE: Speak entirely in ${language}. Conduct the whole call in ${language} — greeting, questions, confirmations, and goodbye. If the customer switches to another language, follow them, but otherwise stay in ${language}.`,
    ``,
    `OPEN THE CALL: greet ${name} by name and, in the same short opening, say you're Vera from TrustLine calling on a recorded line about the verification link already texted to them — then go straight into the first question. One or two natural sentences, no long preamble.`,
    ``,
    `Speak naturally and warmly, like a friendly human agent — short, conversational sentences, not formal or robotic. Keep a brisk pace.`,
    ``,
    `Trust & safety — NEVER violate:`,
    `- The call is recorded; you state this in your opening line and reaffirm if asked.`,
    `- You are calling about the verification link already texted to ${name}. If they doubt it's really you, tell them to use the secure link in that text rather than sharing anything by voice.`,
    `- NEVER ask for full card numbers, full ID/SSN, or passwords. Only ask the questions below.`,
    ``,
    `Your job: complete this KYC questionnaire by voice. Ask ONE question at a time, in order, using natural spoken language. Briefly confirm answers you're unsure about.`,
    ``,
    `Questions:`,
    list,
    ``,
    `When every question is answered, in that SAME final turn: give a short thank-you and goodbye AND call the submit_questionnaire tool with the normalized fields. Do not wait or add a separate closing turn — speak the goodbye and call the tool together.`,
  ].join("\n");
}

// Prime the transcription model with the vocabulary it should expect on this
// call (the questionnaire's answer options + topics), so short, accented, or
// low-bitrate phone answers like income bands and numbers come through right.
function buildTranscriptionPrompt(questions: Question[]): string {
  const terms = new Set<string>();
  for (const q of questions) {
    for (const opt of q.options ?? []) terms.add(opt);
  }
  const vocab = Array.from(terms).join(", ");
  return [
    "This is a KYC verification phone call between an agent (Vera) and a customer.",
    "Topics: occupation, annual income band, source of funds, source of wealth,",
    "politically exposed person (PEP), expected monthly transaction volume, foreign accounts.",
    vocab ? `Likely answers include: ${vocab}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function submitTool(questions: Question[]) {
  const properties: Record<string, unknown> = {};
  for (const q of questions) {
    properties[q.field] =
      q.type === "boolean"
        ? { type: "boolean", description: q.label }
        : q.type === "number"
          ? { type: "number", description: q.label }
          : q.options
            ? { type: "string", enum: q.options, description: q.label }
            : { type: "string", description: q.label };
  }
  return {
    type: "function",
    name: "submit_questionnaire",
    description: "Submit the customer's questionnaire answers once all questions are answered.",
    parameters: {
      type: "object",
      properties,
      required: questions.filter((q) => q.required !== false).map((q) => q.field),
    },
  };
}
