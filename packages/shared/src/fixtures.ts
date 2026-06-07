// Mock data + a mock CaseActions implementation. Tracks build against these
// immediately and swap to live endpoints as Track A lands them. Keeps all three
// people unblocked from minute one.

import type { CaseActions, CaseSummary, Metrics } from "./index.js";

export const MOCK_CASES: CaseSummary[] = [
  {
    id: "case_demo_alice",
    entityName: "Alice Andersson",
    status: "DECIDED",
    riskTier: "LOW",
    reason: "ONBOARDING",
    createdAt: "2026-06-07T08:00:00.000Z",
    decidedAt: "2026-06-07T08:04:00.000Z",
    outcome: "CLEAR",
  },
  {
    id: "case_demo_bob",
    entityName: "Bob Belov",
    status: "QUESTIONNAIRE_SENT",
    riskTier: "MEDIUM",
    reason: "ONBOARDING",
    createdAt: "2026-06-07T08:10:00.000Z",
    outcome: null,
  },
  {
    id: "case_demo_carol",
    entityName: "Carol Castellano",
    status: "NEEDS_REVIEW",
    riskTier: "HIGH",
    reason: "ONBOARDING",
    createdAt: "2026-06-07T08:12:00.000Z",
    outcome: "REFER",
  },
];

export const MOCK_METRICS: Metrics = {
  avgTimeToDecisionMins: 4.2,
  manualBaselineDays: 5,
  completionRate: 0.82,
  abandonmentRescueRate: 0.37,
  costPerVerificationUsd: 0.9,
  manualCostBenchmarkUsd: [13, 130],
  straightThroughRate: 0.68,
  auditCompleteness: 1.0,
  totalCases: MOCK_CASES.length,
};

/** In-memory mock of the agent's CaseActions — no DB, no network. */
export function createMockCaseActions(): CaseActions {
  const cases = new Map<string, CaseSummary>(MOCK_CASES.map((c) => [c.id, c]));
  let counter = cases.size;

  const get = (id: string): CaseSummary => {
    const c = cases.get(id);
    if (!c) throw new Error(`mock: case ${id} not found`);
    return c;
  };
  const patch = (id: string, next: Partial<CaseSummary>): CaseSummary => {
    const updated = { ...get(id), ...next };
    cases.set(id, updated);
    return updated;
  };

  return {
    async startCase({ entityName }) {
      const id = `case_mock_${++counter}`;
      const c: CaseSummary = {
        id,
        entityName,
        status: "IDV_PENDING",
        riskTier: "LOW",
        reason: "ONBOARDING",
        createdAt: "2026-06-07T09:00:00.000Z",
        outcome: null,
      };
      cases.set(id, c);
      return c;
    },
    async markIdvDone(caseId, passed) {
      return patch(caseId, { status: passed ? "IDV_DONE" : "NEEDS_REVIEW" });
    },
    async dispatchQuestionnaire(caseId) {
      return patch(caseId, { status: "QUESTIONNAIRE_SENT" });
    },
    async recordAnswers(caseId) {
      return patch(caseId, { status: "QUESTIONNAIRE_DONE" });
    },
    async runScreening(caseId) {
      return patch(caseId, { status: "SCREENING" });
    },
    async decide(caseId) {
      return patch(caseId, {
        status: "DECIDED",
        outcome: "CLEAR",
        decidedAt: "2026-06-07T09:05:00.000Z",
      });
    },
  };
}
