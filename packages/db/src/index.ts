import { PrismaClient, CaseStatus } from "@prisma/client";

// Prisma singleton (avoids exhausting connections during Next.js dev HMR).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";

// ─────────────────────────── Case state machine ───────────────────────────
// Single source of truth for legal case transitions. Track A (the agent) is
// the primary driver, but any track can validate a transition before applying.

export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  CREATED: [CaseStatus.IDV_PENDING],
  IDV_PENDING: [CaseStatus.IDV_DONE, CaseStatus.NEEDS_REVIEW],
  IDV_DONE: [CaseStatus.QUESTIONNAIRE_SENT],
  QUESTIONNAIRE_SENT: [CaseStatus.QUESTIONNAIRE_DONE, CaseStatus.NEEDS_REVIEW],
  QUESTIONNAIRE_DONE: [CaseStatus.SCREENING],
  SCREENING: [CaseStatus.DECIDED, CaseStatus.NEEDS_REVIEW],
  DECIDED: [CaseStatus.REVERIFY_DUE],
  // proactive re-verification loop
  REVERIFY_DUE: [CaseStatus.REVERIFY_SENT],
  REVERIFY_SENT: [CaseStatus.IDV_PENDING, CaseStatus.QUESTIONNAIRE_SENT],
  // escalation can resolve back into the flow or to a decision
  NEEDS_REVIEW: [CaseStatus.SCREENING, CaseStatus.DECIDED],
};

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return CASE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: CaseStatus, to: CaseStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal case transition: ${from} -> ${to}`);
  }
}

export * from "./brain";
