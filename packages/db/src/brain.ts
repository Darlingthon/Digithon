import crypto from "node:crypto";
import {
  AnswerChannel,
  CaseStatus,
  DecisionOutcome,
  IdvStatus,
  Prisma,
  RiskTier,
  ScreeningType,
} from "@prisma/client";
import { assertTransition, prisma } from "./index";

const QUESTIONNAIRE_ID = "consumer-kyc";
const MANUAL_BASELINE_DAYS = 5;
const MANUAL_COST_BENCHMARK_USD: [number, number] = [13, 130];
const AGENT_COST_PER_VERIFICATION_USD = 0.9;

type JsonRecord = Record<string, unknown>;

export class BrainError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export async function listCases(orgId: string) {
  const cases = await prisma.case.findMany({
    where: { orgId },
    include: { entity: true, decision: true },
    orderBy: { createdAt: "desc" },
  });
  return cases.map(toCaseSummary);
}

export async function getCase(caseId: string, orgId?: string) {
  const item = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      entity: true,
      idvChecks: { orderBy: { createdAt: "desc" } },
      responses: { orderBy: { createdAt: "desc" } },
      screenings: { orderBy: { createdAt: "desc" } },
      decision: true,
      calls: { orderBy: { startedAt: "desc" } },
      auditEvents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!item) throw new BrainError(`Case not found: ${caseId}`, 404);
  if (orgId && item.orgId !== orgId) throw new BrainError(`Forbidden`, 403);
  return item;
}

export async function getAudit(caseId: string) {
  await ensureCase(caseId);
  return prisma.auditEvent.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
  });
}

export async function startCase(input: {
  entityName: string;
  orgId: string;
  phone?: string;
  email?: string;
  country?: string;
  riskTier?: RiskTier;
}) {
  const created = await prisma.case.create({
    data: {
      status: CaseStatus.IDV_PENDING,
      riskTier: input.riskTier ?? RiskTier.LOW,
      org: { connect: { id: input.orgId } },
      entity: {
        create: {
          fullName: input.entityName,
          phone: input.phone,
          email: input.email,
          country: input.country,
        },
      },
      auditEvents: {
        create: [
          { type: "CASE_CREATED", actor: "system" },
          { type: "CASE_STARTED", actor: "vera", data: { status: CaseStatus.IDV_PENDING } },
        ],
      },
    },
    include: { entity: true, decision: true },
  });
  return toCaseSummary(created);
}

export async function markIdvDone(caseId: string, passed: boolean, rawResult?: JsonRecord) {
  const item = await ensureCase(caseId);
  const target = passed ? CaseStatus.IDV_DONE : CaseStatus.NEEDS_REVIEW;
  assertTransition(item.status, target);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.idvCheck.create({
      data: {
        caseId,
        status: passed ? IdvStatus.PASSED : IdvStatus.FAILED,
        livenessPass: passed,
        rawResult: toJson(rawResult),
      },
    });
    await tx.auditEvent.create({
      data: {
        caseId,
        type: passed ? "IDV_PASSED" : "IDV_FAILED",
        actor: "vera",
        data: toJson(rawResult),
      },
    });
    return tx.case.update({
      where: { id: caseId },
      data: { status: target },
      include: { entity: true, decision: true },
    });
  });

  return toCaseSummary(updated);
}

export async function dispatchQuestionnaire(caseId: string) {
  return transitionWithAudit(caseId, CaseStatus.QUESTIONNAIRE_SENT, "QUESTIONNAIRE_SENT", {
    questionnaireId: QUESTIONNAIRE_ID,
  });
}

export async function recordAnswers(
  caseId: string,
  channel: "WEB" | "VOICE",
  answers: JsonRecord,
) {
  const item = await ensureCase(caseId);
  if (item.status !== CaseStatus.QUESTIONNAIRE_SENT && item.status !== CaseStatus.REVERIFY_SENT) {
    throw new BrainError(`Case ${caseId} is not waiting for questionnaire answers`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.questionnaireResponse.create({
      data: {
        caseId,
        questionnaireId: QUESTIONNAIRE_ID,
        channel: channel as AnswerChannel,
        answers: answers as Prisma.InputJsonValue,
        complete: true,
      },
    });
    await tx.auditEvent.create({
      data: {
        caseId,
        type: "QUESTIONNAIRE_COMPLETED",
        actor: channel === "VOICE" ? "vera" : "customer",
        data: toJson({ channel, questionnaireId: QUESTIONNAIRE_ID }),
      },
    });
    return tx.case.update({
      where: { id: caseId },
      data: { status: CaseStatus.QUESTIONNAIRE_DONE },
      include: { entity: true, decision: true },
    });
  });

  return toCaseSummary(updated);
}

export async function recordCallTranscript(
  caseId: string,
  transcript: unknown,
  providerRef?: string,
  recordingUrl?: string,
) {
  await ensureCase(caseId);
  const call = await prisma.$transaction(async (tx) => {
    const saved = await tx.call.create({
      data: {
        caseId,
        direction: "OUTBOUND",
        status: "COMPLETED",
        providerRef,
        transcript: transcript as Prisma.InputJsonValue,
        recordingUrl,
        endedAt: new Date(),
      },
    });
    await tx.auditEvent.create({
      data: {
        caseId,
        type: "CALL_TRANSCRIPT_RECORDED",
        actor: "vera",
        data: toJson({ callId: saved.id, providerRef }),
      },
    });
    return saved;
  });
  return call;
}

export async function runScreening(caseId: string) {
  const item = await getCase(caseId);
  if (item.status === CaseStatus.QUESTIONNAIRE_DONE) {
    assertTransition(item.status, CaseStatus.SCREENING);
    await prisma.case.update({ where: { id: caseId }, data: { status: CaseStatus.SCREENING } });
    await appendAudit(caseId, "SCREENING_STARTED", "vera");
  }

  const sumsub = await runSumsubAml(item);
  const hits = classifyAmlHits(item.entity.fullName, sumsub);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.screeningResult.deleteMany({ where: { caseId } });
    await tx.screeningResult.createMany({
      data: [
        {
          caseId,
          type: ScreeningType.SANCTIONS,
          hit: hits.sanctions,
          details: toJson({ source: sumsub.source, raw: sumsub.raw, error: sumsub.error }),
        },
        {
          caseId,
          type: ScreeningType.PEP,
          hit: hits.pep,
          details: toJson({ source: sumsub.source, raw: sumsub.raw, error: sumsub.error }),
        },
        {
          caseId,
          type: ScreeningType.ADVERSE_MEDIA,
          hit: hits.adverseMedia,
          details: toJson({ source: sumsub.source, raw: sumsub.raw, error: sumsub.error }),
        },
      ],
    });
    await tx.auditEvent.create({
      data: {
        caseId,
        type: hits.any ? "SCREENING_HIT" : "SCREENING_CLEAR",
        actor: "vera",
        data: toJson({ ...hits, provider: sumsub.source, error: sumsub.error }),
      },
    });
    return tx.case.findUniqueOrThrow({
      where: { id: caseId },
      include: { entity: true, decision: true },
    });
  });

  return toCaseSummary(updated);
}

export async function decide(caseId: string) {
  const item = await getCase(caseId);
  if (item.status !== CaseStatus.SCREENING && item.status !== CaseStatus.NEEDS_REVIEW) {
    throw new BrainError(`Case ${caseId} must be SCREENING or NEEDS_REVIEW before decision`);
  }

  const idv = item.idvChecks[0];
  const response = item.responses[0];
  const sanctionsHit = item.screenings.some((s) => s.type === ScreeningType.SANCTIONS && s.hit);
  const pepHit = item.screenings.some((s) => s.type === ScreeningType.PEP && s.hit);
  const adverseHit = item.screenings.some((s) => s.type === ScreeningType.ADVERSE_MEDIA && s.hit);
  const screeningError = item.screenings.some((s) => hasDetailsError(s.details));

  const reasons: string[] = [];
  let outcome: DecisionOutcome = DecisionOutcome.CLEAR;

  if (!idv || idv.status !== IdvStatus.PASSED) {
    outcome = DecisionOutcome.REJECT;
    reasons.push("IDV did not pass");
  }
  if (sanctionsHit) {
    outcome = DecisionOutcome.REJECT;
    reasons.push("Sanctions screening hit");
  }
  if (!response?.complete) {
    outcome = maxOutcome(outcome, DecisionOutcome.REFER);
    reasons.push("Questionnaire incomplete");
  }
  if (pepHit) {
    outcome = maxOutcome(outcome, DecisionOutcome.REFER);
    reasons.push("PEP screening hit requires human review");
  }
  if (adverseHit) {
    outcome = maxOutcome(outcome, DecisionOutcome.REFER);
    reasons.push("Adverse media screening hit requires human review");
  }
  if (item.riskTier === RiskTier.HIGH) {
    outcome = maxOutcome(outcome, DecisionOutcome.REFER);
    reasons.push("High-risk tier requires enhanced due diligence review");
  }
  if (screeningError) {
    outcome = maxOutcome(outcome, DecisionOutcome.REFER);
    reasons.push("AML screening provider returned an error or uncertain result");
  }
  if (reasons.length === 0) {
    reasons.push("IDV passed", "Questionnaire complete", "No sanctions, PEP, or adverse-media hits");
  }

  const targetStatus =
    outcome === DecisionOutcome.CLEAR || outcome === DecisionOutcome.REJECT
      ? CaseStatus.DECIDED
      : CaseStatus.NEEDS_REVIEW;

  if (item.status !== targetStatus) assertTransition(item.status, targetStatus);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.decision.upsert({
      where: { caseId },
      create: {
        caseId,
        outcome,
        reasons: reasons as Prisma.InputJsonValue,
        automated: outcome !== DecisionOutcome.REFER,
      },
      update: {
        outcome,
        reasons: reasons as Prisma.InputJsonValue,
        automated: outcome !== DecisionOutcome.REFER,
      },
    });
    await tx.auditEvent.create({
      data: {
        caseId,
        type: outcome === DecisionOutcome.REFER ? "ESCALATED_TO_REVIEW" : "DECISION_MADE",
        actor: "vera",
        data: toJson({ outcome, reasons }),
      },
    });
    return tx.case.update({
      where: { id: caseId },
      data: {
        status: targetStatus,
        decidedAt: targetStatus === CaseStatus.DECIDED ? new Date() : item.decidedAt,
      },
      include: { entity: true, decision: true },
    });
  });

  return toCaseSummary(updated);
}

// Remember how the questionnaire should be collected after IDV: "CALL" (Vera
// phones immediately) or "SMS" (link texted, with a Vera auto-call fallback).
export async function setQuestionnaireDelivery(caseId: string, channel: "CALL" | "SMS") {
  await ensureCase(caseId);
  await prisma.case.update({ where: { id: caseId }, data: { qDelivery: channel } });
  return { caseId, qDelivery: channel };
}

// Language Vera speaks + transcribes on the call (ISO-639-1, e.g. "en", "bg").
export async function setCaseLanguage(caseId: string, language: string) {
  await ensureCase(caseId);
  await prisma.case.update({ where: { id: caseId }, data: { language } });
  return { caseId, language };
}

// SMS-mode cases that have been waiting for questionnaire answers longer than
// `thresholdMs` and haven't been auto-called yet — the Channels sweep rings these.
export async function dueForFallbackCall(thresholdMs: number) {
  const cutoff = new Date(Date.now() - thresholdMs);
  const cases = await prisma.case.findMany({
    where: {
      status: CaseStatus.QUESTIONNAIRE_SENT,
      qDelivery: "SMS",
      updatedAt: { lt: cutoff },
      entity: { phone: { not: null } },
      auditEvents: { none: { type: "FALLBACK_CALL_PLACED" } },
    },
    include: { entity: true },
  });
  return cases.map((c) => ({ caseId: c.id, phone: c.entity.phone as string }));
}

// Record that the Vera auto-call has been placed, so the sweep doesn't ring twice.
export async function markFallbackCallPlaced(caseId: string, providerRef?: string) {
  return appendAudit(caseId, "FALLBACK_CALL_PLACED", "vera", { providerRef });
}

// Run the back half of the pipeline (AML screening → decision) once the
// customer's answers are in. Live channels (web self-serve, Vera voice) call
// this so a case finishes on its own instead of stalling at QUESTIONNAIRE_DONE.
export async function finalizeCase(caseId: string) {
  await runScreening(caseId);
  return decide(caseId);
}

export async function getMetrics(orgId?: string) {
  const cases = await prisma.case.findMany({
    ...(orgId ? { where: { orgId } } : {}),
    include: {
      responses: true,
      decision: true,
      auditEvents: true,
      calls: true,
    },
  });
  const totalCases = cases.length;
  const decided = cases.filter((c) => c.decidedAt);
  const avgTimeToDecisionMins =
    decided.length === 0
      ? 0
      : round(
          decided.reduce((sum, c) => {
            return sum + (c.decidedAt!.getTime() - c.createdAt.getTime()) / 60000;
          }, 0) / decided.length,
        );

  const completed = cases.filter((c) => c.responses.some((r) => r.complete)).length;
  const rescued = cases.filter(
    (c) => c.calls.some((call) => call.status === "COMPLETED") && c.responses.some((r) => r.channel === "VOICE"),
  ).length;
  const clearAutomated = cases.filter(
    (c) => c.decision?.outcome === DecisionOutcome.CLEAR && c.decision.automated,
  ).length;
  const auditComplete = cases.filter((c) => hasCompleteAudit(c.auditEvents.map((e) => e.type))).length;

  return {
    avgTimeToDecisionMins,
    manualBaselineDays: MANUAL_BASELINE_DAYS,
    completionRate: ratio(completed, totalCases),
    abandonmentRescueRate: ratio(rescued, totalCases),
    costPerVerificationUsd: AGENT_COST_PER_VERIFICATION_USD,
    manualCostBenchmarkUsd: MANUAL_COST_BENCHMARK_USD,
    straightThroughRate: ratio(clearAutomated, totalCases),
    auditCompleteness: ratio(auditComplete, totalCases),
    totalCases,
  };
}

async function ensureCase(caseId: string) {
  const item = await prisma.case.findUnique({
    where: { id: caseId },
    include: { entity: true, decision: true },
  });
  if (!item) throw new BrainError(`Case not found: ${caseId}`, 404);
  return item;
}

async function transitionWithAudit(caseId: string, target: CaseStatus, eventType: string, data?: JsonRecord) {
  const item = await ensureCase(caseId);
  assertTransition(item.status, target);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.auditEvent.create({
      data: { caseId, type: eventType, actor: "vera", data: toJson(data) },
    });
    return tx.case.update({
      where: { id: caseId },
      data: { status: target },
      include: { entity: true, decision: true },
    });
  });
  return toCaseSummary(updated);
}

async function appendAudit(caseId: string, type: string, actor: string, data?: JsonRecord) {
  return prisma.auditEvent.create({
    data: { caseId, type, actor, data: toJson(data) },
  });
}

function toCaseSummary(item: {
  id: string;
  status: CaseStatus;
  riskTier: RiskTier;
  reason: string;
  createdAt: Date;
  decidedAt?: Date | null;
  entity: { fullName: string };
  decision?: { outcome: DecisionOutcome } | null;
}) {
  return {
    id: item.id,
    entityName: item.entity.fullName,
    status: item.status,
    riskTier: item.riskTier,
    reason: item.reason,
    createdAt: item.createdAt.toISOString(),
    decidedAt: item.decidedAt?.toISOString() ?? null,
    outcome: item.decision?.outcome ?? null,
  };
}

type SumsubResult = {
  source: "sumsub" | "sumsub_mock";
  raw?: unknown;
  error?: string;
};

async function runSumsubAml(item: Awaited<ReturnType<typeof getCase>>): Promise<SumsubResult> {
  const token = process.env.SUMSUB_APP_TOKEN;
  const secret = process.env.SUMSUB_SECRET_KEY;
  const baseUrl = process.env.SUMSUB_BASE_URL ?? "https://api.sumsub.com";
  const levelName = process.env.SUMSUB_LEVEL_NAME;

  if (!token || !secret) {
    return { source: "sumsub_mock", raw: { mode: "credentials_missing" } };
  }

  try {
    let applicantId = item.idvChecks.find((check) => check.providerRef)?.providerRef;
    if (!applicantId) {
      if (!levelName) {
        return {
          source: "sumsub_mock",
          raw: { mode: "level_name_missing" },
        };
      }
      const created = await sumsubRequest<{ id?: string }>(
        baseUrl,
        token,
        secret,
        "POST",
        `/resources/applicants?levelName=${encodeURIComponent(levelName)}`,
        {
          externalUserId: item.id,
          email: item.entity.email,
          phone: item.entity.phone,
          fixedInfo: nameToFixedInfo(item.entity.fullName, item.entity.country),
        },
      );
      applicantId = created.id;
      if (applicantId) {
        await prisma.idvCheck.create({
          data: {
            caseId: item.id,
            provider: "sumsub",
            providerRef: applicantId,
            status: IdvStatus.PENDING,
            rawResult: created as Prisma.InputJsonValue,
          },
        });
        await appendAudit(item.id, "SUMSUB_APPLICANT_CREATED", "vera", { applicantId });
      }
    }

    if (!applicantId) return { source: "sumsub_mock", error: "No Sumsub applicant id returned" };

    const raw = await sumsubRequest(
      baseUrl,
      token,
      secret,
      "POST",
      `/resources/applicants/${encodeURIComponent(applicantId)}/recheck/aml`,
    );
    return { source: "sumsub", raw };
  } catch (error) {
    return { source: "sumsub", error: error instanceof Error ? error.message : String(error) };
  }
}

async function sumsubRequest<T = unknown>(
  baseUrl: string,
  token: string,
  secret: string,
  method: "GET" | "POST",
  path: string,
  body?: JsonRecord,
): Promise<T> {
  const ts = Math.floor(Date.now() / 1000).toString();
  const bodyText = body ? JSON.stringify(body) : "";
  const sig = crypto.createHmac("sha256", secret).update(ts + method + path + bodyText).digest("hex");
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-App-Token": token,
      "X-App-Access-Sig": sig,
      "X-App-Access-Ts": ts,
    },
    body: bodyText || undefined,
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const description = parsed?.description ?? parsed?.message ?? res.statusText;
    throw new Error(`Sumsub ${res.status}: ${description}`);
  }
  return parsed as T;
}

function nameToFixedInfo(fullName: string, country?: string | null) {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return {
    firstName: firstName || fullName,
    lastName: rest.join(" ") || "Customer",
    country: country ?? undefined,
  };
}

function classifyAmlHits(fullName: string, sumsub: SumsubResult) {
  const name = fullName.toLowerCase();
  const raw = JSON.stringify(sumsub.raw ?? {}).toLowerCase();
  const source = `${name} ${raw}`;
  const sanctions = /testsanc|mocksanc|sanction/.test(source);
  const pep = /testpep|\bpep\b|politically exposed/.test(source);
  const adverseMedia = /mockmedi|adverse|media|crime/.test(source);
  return {
    sanctions,
    pep,
    adverseMedia,
    any: sanctions || pep || adverseMedia,
  };
}

function maxOutcome(current: DecisionOutcome, next: DecisionOutcome) {
  const rank = {
    [DecisionOutcome.CLEAR]: 0,
    [DecisionOutcome.REFER]: 1,
    [DecisionOutcome.REJECT]: 2,
  };
  return rank[next] > rank[current] ? next : current;
}

function hasDetailsError(details: Prisma.JsonValue) {
  return Boolean(details && typeof details === "object" && "error" in details && (details as JsonRecord).error);
}

function ratio(part: number, total: number) {
  return total === 0 ? 0 : round(part / total);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function hasCompleteAudit(types: string[]) {
  return ["CASE_CREATED", "IDV_PASSED", "QUESTIONNAIRE_COMPLETED"].every((type) =>
    types.includes(type),
  );
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === undefined || value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}
