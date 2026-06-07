import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { getCase, recordAnswers, recordCallTranscript } from "@trustline/db";
import { questionsForTier, type Question } from "@trustline/shared";
import { config, hasOpenAI } from "./../config.js";

// ── Vera voice bridge ──────────────────────────────────────────────────────
// Twilio Media Streams (G.711 μ-law 8kHz, base64) <-> OpenAI Realtime
// (gpt-realtime-2, audio/pcmu in+out). Both sides speak μ-law, so audio is a
// straight base64 passthrough — no transcoding. Exact schema verified against
// the OpenAI Realtime docs (session.audio.{input,output}.format = audio/pcmu;
// client input_audio_buffer.append{audio}; server response.output_audio.delta{delta}).

const OPENAI_WS = `wss://api.openai.com/v1/realtime?model=${config.openai.model}`;

export function attachVoiceBridge(server: Server) {
  // noServer: we route the upgrade ourselves so only /voice/stream is handled.
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
  let answersSubmitted = false;
  const transcript: { role: "vera" | "customer"; text: string }[] = [];
  let veraBuf = "";

  const sendToTwilio = (obj: unknown) => {
    if (twilioWs.readyState === WebSocket.OPEN) twilioWs.send(JSON.stringify(obj));
  };
  const sendToOpenAI = (obj: unknown) => {
    if (openai && openai.readyState === WebSocket.OPEN) openai.send(JSON.stringify(obj));
  };

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
        console.log(`🎙️  stream start case=${caseId || "?"} call=${callSid}`);
        openConnectionToOpenAI(caseId).catch((e) => console.error("openai connect failed:", e));
        break;
      case "media":
        // base64 μ-law from caller → OpenAI input buffer (passthrough).
        if (openaiReady && msg.media?.payload) {
          sendToOpenAI({ type: "input_audio_buffer.append", audio: msg.media.payload });
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

    openai = new WebSocket(OPENAI_WS, {
      headers: { Authorization: `Bearer ${config.openai.apiKey}` },
    });

    openai.on("open", () => {
      // Configure session: μ-law both ways, server-side VAD, Vera persona, tool.
      sendToOpenAI({
        type: "session.update",
        session: {
          type: "realtime",
          instructions: buildInstructions(name, questions),
          audio: {
            input: { format: { type: "audio/pcmu" }, turn_detection: { type: "semantic_vad" } },
            output: { format: { type: "audio/pcmu" }, voice: config.openai.voice },
          },
          tools: [submitTool(questions)],
        },
      });
      // Vera speaks first (greeting + first question).
      sendToOpenAI({ type: "response.create" });
    });

    openai.on("message", (raw) => handleOpenAIEvent(JSON.parse(raw.toString())));
    openai.on("error", (e) => console.error("openai ws error:", e.message));
    openai.on("close", () => {
      openaiReady = false;
    });
  }

  function handleOpenAIEvent(evt: any) {
    switch (evt.type) {
      case "session.updated":
        openaiReady = true;
        break;
      case "response.output_audio.delta":
        // μ-law audio from Vera → Twilio (passthrough).
        if (evt.delta) sendToTwilio({ event: "media", streamSid, media: { payload: evt.delta } });
        break;
      case "input_audio_buffer.speech_started":
        // Caller barged in — stop Vera's current playback on Twilio.
        sendToTwilio({ event: "clear", streamSid });
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
    } catch (e) {
      ok = false;
      console.warn("recordAnswers failed:", (e as Error).message);
    }
    // Return the tool result so Vera can close out the call.
    sendToOpenAI({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: evt.call_id,
        output: JSON.stringify({ ok, message: ok ? "saved" : "could not save, please retry" }),
      },
    });
    sendToOpenAI({ type: "response.create" });
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
function buildInstructions(name: string, questions: Question[]): string {
  const list = questions.map((q, i) => `${i + 1}. ${q.voicePrompt}  (record as: ${q.field})`).join("\n");
  return [
    `You are Vera, an AI verification officer for TrustLine, on a recorded phone call with ${name}.`,
    ``,
    `Trust & safety — NEVER violate:`,
    `- Recording was already disclosed; reaffirm if asked.`,
    `- You are calling about the verification link already texted to ${name}. If they doubt it's really you, tell them to use the secure link in that text rather than sharing anything by voice.`,
    `- NEVER ask for full card numbers, full ID/SSN, or passwords. Only ask the questions below.`,
    ``,
    `Your job: warmly and briefly complete this KYC questionnaire by voice. Ask ONE question at a time, in order, using natural spoken language. Briefly confirm answers you're unsure about.`,
    ``,
    `Questions:`,
    list,
    ``,
    `When every question is answered, call the submit_questionnaire tool with the normalized fields, then thank them and say goodbye.`,
  ].join("\n");
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
