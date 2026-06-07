# Vera(Trustline) Agent Rules — 8-Hour Hackathon Mode

These rules apply to all implementation work in this repository. We are building under an **8-hour hackathon constraint**: optimize for maximum speed and a working, demoable result. No TDD.

# AGENTS.md — TrustLine (agent: "Vera")

> Working names. **TrustLine** = product, **Vera** = the AI agent persona. Not final.

## What this is

TrustLine is an AI "employee" that runs the **KYC (Know Your Customer) process end-to-end** and proves a measurable result. A single agent owns a verification case from start to finish: it verifies identity, collects a compliance questionnaire across multiple channels, screens the customer, reaches a decision, and produces a complete audit trail. When a customer stalls, the agent **calls them on the phone** to finish the job.

The guiding theme: *an AI employee that executes a valuable business workflow end-to-end and proves a measurable result.*

## Why it matters

KYC is a large, quantifiable cost-and-churn center, which makes the "measurable result" easy to demonstrate:

- ~70% of financial institutions report losing clients to slow or inefficient onboarding, with onboarding abandonment averaging ~10%.
- The average institution spends tens of millions per year on AML/KYC operations; individual identity checks run roughly $13–$130 each.
- Onboarding can take days to weeks, and a large share of periodic re-verification (re-KYC) is still done manually.

TrustLine attacks the slow, manual, high-drop-off parts of that workflow.

## What the agent does (product-level core flow)

Scope of the first build is the **consumer** core flow:

1. **Identity verification (IDV).** The customer completes document + liveness verification.
2. **Questionnaire dispatch.** The customer receives an SMS containing a one-time passcode (OTP), a link to complete the questionnaire online, and a phone number they can call to complete it by voice.
3. **Self-service completion.** The customer completes the questionnaire via the web link (OTP-gated) or by calling the provided number.
4. **Fallback outbound call.** If the customer has not completed the questionnaire within ~1 day, Vera calls them and walks them through it conversationally.
5. **Screening + decision.** The customer is screened (sanctions / PEP / adverse media) and the case is decided: clear, refer, or reject.
6. **Audit.** Every step, answer, and call transcript is logged for a complete, review-ready record.

The questionnaire depth is **risk-based**: low-risk customers get a short flow; higher-risk customers get additional enhanced-due-diligence (EDD) questions.

### Proactive re-verification (autocalling)

Beyond initial onboarding, Vera monitors existing customers and **automatically initiates outbound calls** when a case needs attention during the customer lifecycle:

- **ID document expiry.** When a customer's verified ID document is approaching or past its expiry date, Vera reaches out to re-verify identity with a fresh document.
- **Periodic questionnaire recheck (re-KYC).** When a customer's questionnaire is due for periodic refresh, Vera reaches out to confirm or update their answers.

The same channel and safety logic as onboarding applies: the customer is first invited to complete the refresh via the SMS link (OTP-gated), and if it is not done within the window, Vera calls them — always authenticating the call to the customer, disclosing recording, and never soliciting secrets by voice. This proactive lifecycle work is largely manual in the industry today, so it is a primary driver of the measurable result.

## Scope & phasing

- **Phase 1 — Consumer (now).** The end-to-end individual KYC flow described above.
- **Phase 2 — B2B / KYB (later).** Business verification, where a company case fans out into multiple individual checks (beneficial owners and directors), reusing the consumer flow per person.

Design choices in Phase 1 should keep Phase 2 cheap — e.g. treat a case as belonging to an entity that may be a person *or* a company.

## Success metrics (the measurable result)

The product is judged on before/after numbers, surfaced on a live dashboard:

- **Time-to-decision** (minutes vs. the manual baseline of days/weeks)
- **Completion rate** and **abandonment-rescue rate** (cases recovered by the fallback call)
- **Cost per verification** (agent marginal cost vs. the $13–$130 manual benchmark)
- **Straight-through-processing rate** (% cleared with no human touch)
- **Audit completeness** (transcript + checks logged per case)

## Domain glossary

- **KYC** — Know Your Customer; verifying who a customer is and assessing their risk.
- **IDV** — Identity Verification; document authenticity + liveness/selfie matching.
- **AML** — Anti-Money Laundering; the regulatory regime KYC supports.
- **AML screening** — checking a customer against sanctions lists, PEP lists, watchlists, and adverse media.
- **PEP** — Politically Exposed Person; higher-risk customer category.
- **CDD / EDD** — Customer Due Diligence / Enhanced Due Diligence; standard vs. deeper checks for higher-risk customers.
- **Risk-based tiering** — calibrating verification depth to the customer's assessed risk.
- **Re-KYC** — periodic re-verification of an existing customer.
- **KYB** — Know Your Business; the company-level equivalent of KYC (Phase 2).
- **Case** — one customer's verification journey and its current state.
- **Vera** — the AI agent that conducts the voice calls and drives the case.

## Trust & safety principles

These are product requirements, not nice-to-haves:

- **Authenticate the call to the customer.** An unsolicited "verify yourself" call resembles a phishing/vishing scam. Vera must prove the call is legitimate (e.g. by referencing a code the customer already has) before asking anything.
- **No secrets over voice.** Vera never solicits full sensitive identifiers (full card numbers, full ID/SSN, passwords) by phone; sensitive capture stays in secure channels.
- **Consent & disclosure.** Calls are consented/scheduled, and recording is disclosed at the start of the call.
- **Human handoff.** Routine cases are cleared automatically; edge cases are escalated to a human reviewer. The agent augments compliance officers, it does not replace them.
- **Auditability.** Every decision is explainable and backed by a stored trail.

## Tech stack (tools chosen)

- **Google Agent Development Kit (ADK)** — the agent framework / orchestration powering Vera (case logic, tools, decisioning).
- **OpenAI `gpt-realtime-2`** — the realtime speech model that powers Vera's spoken voice conversations.
- **Twilio** — telephony and messaging: Voice (calls), Verify (OTP), Messaging (SMS).
- **Sumsub** — identity verification and AML screening (and KYB for Phase 2).

## Architecture

> **TODO — to be added.** Component design, data flow, state model, and integration details are intentionally not specified yet.

## Notes for agents working in this repo

- Keep the questionnaire defined **once** and rendered to multiple channels (web + voice); answers normalize to the same fields regardless of channel.
- Treat trust & safety principles above as hard constraints in any generated code or copy.
- When in doubt about scope, build for **Phase 1 (consumer)** and leave clean extension points for **Phase 2 (B2B)**.

## Operating principle

- **Ship fast, demo first.** A working happy-path feature beats a perfectly tested one. Get something on screen, then improve.
- **Bias to action.** Don't ask for hand-holding. Make reasonable assumptions, state them briefly, and keep moving.
- **Timebox everything.** If an approach isn't working in ~15 minutes, switch tactics. Don't get stuck.

## Delivery workflow

- Skip formal PRDs. Capture scope as a short bullet list (1–3 lines) before starting a feature, then build.
- **No TDD.** Write code first. Add tests only where they save time (e.g., tricky business logic you'll iterate on).
- Build the happy path first. Handle edge cases only if they affect the demo.
- Break large work into the smallest demoable increments and ship them one at a time.

## Verification standard

- **Manual verification is the default.** Run the app, click through the flow, confirm it works.
- Use screenshots or a quick manual run as evidence — automated E2E is optional and only if it's faster than manual checking.
- Skip recorded Playwright videos and CI test wiring unless they're trivially cheap.
- For UI work, eyeball it: does it look good enough to demo? Iterate quickly on visual polish only where it matters for the pitch.

## Done criteria

- The feature works on the happy path and is demoable.
- Obvious crash/error states for the demo flow are handled.
- That's it — no coverage requirements, no formal verification notes.

## Code Conventions

- Use TypeScript, but prefer speed over strictness. `any` is acceptable when it unblocks you.
- Keep modules reasonably organized, but don't over-architect — inline is fine for a hackathon.
- Minimal docs: a one-line comment where intent isn't obvious. Skip exhaustive JSDoc.
- Reuse existing libraries and components aggressively. Don't build from scratch what you can pull in.

# Workflow Orchestration

## 1. Move Fast

- Skip plan mode for most work — just build. Only pause to think on genuinely ambiguous architectural forks.
- If something goes sideways, try the fastest workaround first; re-architect only if forced.

## 2. Subagent Strategy

- Use subagents to parallelize independent work (e.g., one builds backend, one builds UI) to maximize throughput.
- Keep them focused and short-lived.

## 3. Autonomous Building

- Given a feature or bug: just do it. Resolve failing builds/errors without being told how.
- Zero context switching for the user — keep the loop tight.

# Core Principles

- **Speed First**: The clock is the constraint. Working and visible beats correct and invisible.
- **Simplicity**: Smallest change that gets the demo working. Don't gold-plate.
- **No premature optimization**: Don't refactor, abstract, or optimize unless it's blocking the demo.

# Skills Usage

Skills are specialized instruction sets located in `.agents/skills/` (project) and `~/.agents/skills/` (user). Load them via the `skill` tool when a task matches their domain — but only when they speed you up.

## Trigger Rules (load when they save time)

- **Frontend / UI work** → load `frontend-design` when building web components or pages and you want it to look good for the demo.
- **shadcn/ui components** → load `shadcn` when adding shadcn components (fastest way to get polished UI).
- **Pre-demo polish pass** → load `polish` for a quick alignment/spacing cleanup right before showing UI work.
- **PRD authoring** → skip in hackathon mode unless explicitly requested.
- **Playwright** → load `playwright-best-practices` only if you decide an automated test is genuinely faster than manual checking.

## assistant-ui Stack

Load these when working in code that uses the `assistant-ui` library (chat UI, runtimes, tools, streaming):

- `assistant-ui` — architecture overview; load first when orienting in this code.
- `setup` — installing/configuring assistant-ui, scaffolding apps, troubleshooting init.
- `primitives` — customising `ThreadPrimitive`, `ComposerPrimitive`, `MessagePrimitive`, `ActionBarPrimitive`.
- `runtime` — `useLocalRuntime`, `useExternalStoreRuntime`, state hooks, thread/message data.
- `thread-list` — multi-thread management and custom thread-list UIs.
- `tools` — registering LLM tools, rendering tool UI, human-in-the-loop confirmations.
- `streaming` — `assistant-stream`, data-stream / assistant-transport protocols, encoders.
- `cloud` — assistant-cloud persistence, file uploads, auth.
- `update` — upgrading assistant-ui or AI SDK; detects versions and runs migrations. Use before any version bump.

## Discovery

- `find-skills` (user-level) — load when the user asks "is there a skill for X" or wants to extend capabilities.

## Usage Notes

- Always invoke skills via the `skill` tool — do not paraphrase or guess their contents.
- Skills compose, but in hackathon mode load only what directly accelerates the current task.

## Skill Operating Stack

- **GCP / ADK first:** use Google Agents CLI workflow/scaffold/adk-code/deploy/observability for Vera's backend, Cloud Run deployment, secrets, logs, and production-scale agent operations. Cloud Run is the default target; GKE is later only if needed.
- **OpenAI source of truth:** use `openai-docs` before changing `gpt-realtime-2`, Realtime API, speech, tool-calling, session, SIP/WebRTC/WebSocket, or pricing behavior. Vera's voice model is `gpt-realtime-2`.
- **Twilio source of truth:** use official Twilio skills for Conversation Relay, webhook architecture, and SMS. Voice calls must preserve the trust rules above: authenticate the call, disclose recording, and never ask for secrets by voice.
- **assistant-ui stack:** use assistant-ui skills for reviewer dashboards, chat/case UI, tool rendering, thread/case views, runtime wiring, streaming, persistence, auth, and upgrade work.
- **Persistence:** use Prisma skills for Cloud SQL/Postgres schema, migrations, and Prisma CLI usage.
- **Skill hygiene:** prefer official or high-reputation skills. Do not install random compliance, KYC, Sumsub, or security skills without review; use official vendor docs/API references for Sumsub.
