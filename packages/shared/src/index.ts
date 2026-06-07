// Shared, framework-agnostic types + the case-action API contract.
// These mirror the Prisma enums (kept as string unions so non-Prisma callers,
// e.g. the Python agent's TS-facing fixtures or the frontend, don't need the
// Prisma client). Source of truth for the DB shape lives in @trustline/db.

export * from "./questionnaire";

export type CaseStatus =
  | "CREATED"
  | "IDV_PENDING"
  | "IDV_DONE"
  | "QUESTIONNAIRE_SENT"
  | "QUESTIONNAIRE_DONE"
  | "SCREENING"
  | "DECIDED"
  | "REVERIFY_DUE"
  | "REVERIFY_SENT"
  | "NEEDS_REVIEW";

export type DecisionOutcome = "CLEAR" | "REFER" | "REJECT";
export type RiskTierName = "LOW" | "MEDIUM" | "HIGH";
export type CaseReason = "ONBOARDING" | "REKYC_PERIODIC" | "ID_EXPIRY";
// LANGUAGES / languageName / LanguageCode live in ./questionnaire (re-exported
// above) so Next client components can import them via the subpath.

// ─────────────────── Case-action API contract ───────────────────
// The agent (Track A) exposes these; Channels (B) and Frontend (C) call them.
// Build against the mock implementation in ./fixtures until the real ones land.

export interface CaseSummary {
  id: string;
  entityName: string;
  status: CaseStatus;
  riskTier: RiskTierName;
  reason: CaseReason;
  createdAt: string;
  decidedAt?: string | null;
  outcome?: DecisionOutcome | null;
}

export interface CaseActions {
  startCase(input: { entityName: string; phone?: string; email?: string }): Promise<CaseSummary>;
  markIdvDone(caseId: string, passed: boolean): Promise<CaseSummary>;
  dispatchQuestionnaire(caseId: string): Promise<CaseSummary>;
  recordAnswers(caseId: string, channel: "WEB" | "VOICE", answers: Record<string, unknown>): Promise<CaseSummary>;
  runScreening(caseId: string): Promise<CaseSummary>;
  decide(caseId: string): Promise<CaseSummary>;
}

// ─────────────────── Case detail (reviewer dashboard) ───────────────────

export interface IdvCheckSummary {
  id: string;
  status: "PENDING" | "PASSED" | "FAILED";
  provider: string;
  providerRef?: string | null;
  documentType?: string | null;
  livenessPass?: boolean | null;
  createdAt: string;
}

export interface ScreeningHit {
  id: string;
  type: "SANCTIONS" | "PEP" | "ADVERSE_MEDIA";
  hit: boolean;
  details?: Record<string, unknown> | null;
}

export interface QuestionnaireAnswerSummary {
  channel: "WEB" | "VOICE";
  answers: Record<string, unknown>;
  complete: boolean;
  createdAt: string;
}

export interface DecisionSummary {
  outcome: DecisionOutcome;
  reasons: string[];
  automated: boolean;
  reviewedBy?: string | null;
  createdAt: string;
}

export interface AuditEventSummary {
  id: string;
  type: string;
  actor: string;
  data?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CaseDetail extends CaseSummary {
  email?: string | null;
  phone?: string | null;
  idvChecks: IdvCheckSummary[];
  questionnaireResponses: QuestionnaireAnswerSummary[];
  screeningResults: ScreeningHit[];
  decision?: DecisionSummary | null;
  auditEvents: AuditEventSummary[];
}

// ─────────────────── Metrics (Track A → Track C dashboard) ───────────────────

export interface Metrics {
  avgTimeToDecisionMins: number;
  manualBaselineDays: number; // for the before/after comparison
  completionRate: number; // 0..1
  abandonmentRescueRate: number; // 0..1, cases recovered by fallback call
  costPerVerificationUsd: number;
  manualCostBenchmarkUsd: [number, number]; // [13, 130]
  straightThroughRate: number; // 0..1
  auditCompleteness: number; // 0..1
  totalCases: number;
}
