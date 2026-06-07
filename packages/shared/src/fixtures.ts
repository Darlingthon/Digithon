// Mock data + a mock CaseActions implementation. Tracks build against these
// immediately and swap to live endpoints as Track A lands them. Keeps all three
// people unblocked from minute one.

import type { CaseActions, CaseSummary, CaseDetail, Metrics } from "./index.js";

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

export const MOCK_CASE_DETAILS: CaseDetail[] = [
  {
    id: "case_demo_alice",
    entityName: "Alice Andersson",
    email: "alice@example.com",
    phone: "+46701234567",
    status: "DECIDED",
    riskTier: "LOW",
    reason: "ONBOARDING",
    createdAt: "2026-06-07T08:00:00.000Z",
    decidedAt: "2026-06-07T08:04:00.000Z",
    outcome: "CLEAR",
    idvChecks: [
      {
        id: "idv_alice_1",
        status: "PASSED",
        provider: "sumsub",
        providerRef: "sumsub_applicant_alice",
        documentType: "PASSPORT",
        livenessPass: true,
        createdAt: "2026-06-07T08:01:00.000Z",
      },
    ],
    questionnaireResponses: [
      {
        channel: "WEB",
        answers: {
          occupation: "Software Engineer",
          sourceOfFunds: "Employment",
          politicallyExposed: false,
          country: "SE",
        },
        complete: true,
        createdAt: "2026-06-07T08:02:30.000Z",
      },
    ],
    screeningResults: [
      { id: "scr_alice_sanctions", type: "SANCTIONS", hit: false },
      { id: "scr_alice_pep", type: "PEP", hit: false },
      { id: "scr_alice_media", type: "ADVERSE_MEDIA", hit: false },
    ],
    decision: {
      outcome: "CLEAR",
      reasons: ["IDV passed", "No screening hits", "Low-risk questionnaire answers"],
      automated: true,
      createdAt: "2026-06-07T08:04:00.000Z",
    },
    auditEvents: [
      { id: "ae_1", type: "CASE_CREATED", actor: "system", createdAt: "2026-06-07T08:00:00.000Z" },
      { id: "ae_2", type: "IDV_INITIATED", actor: "vera", createdAt: "2026-06-07T08:00:30.000Z" },
      { id: "ae_3", type: "IDV_PASSED", actor: "sumsub", data: { documentType: "PASSPORT" }, createdAt: "2026-06-07T08:01:00.000Z" },
      { id: "ae_4", type: "SMS_SENT", actor: "twilio", data: { phone: "+46701234567" }, createdAt: "2026-06-07T08:01:10.000Z" },
      { id: "ae_5", type: "QUESTIONNAIRE_COMPLETED", actor: "customer", data: { channel: "WEB" }, createdAt: "2026-06-07T08:02:30.000Z" },
      { id: "ae_6", type: "SCREENING_DONE", actor: "sumsub", data: { hits: 0 }, createdAt: "2026-06-07T08:03:30.000Z" },
      { id: "ae_7", type: "DECISION_MADE", actor: "vera", data: { outcome: "CLEAR" }, createdAt: "2026-06-07T08:04:00.000Z" },
    ],
  },
  {
    id: "case_demo_bob",
    entityName: "Bob Belov",
    email: "bob@example.com",
    phone: "+35988765432",
    status: "QUESTIONNAIRE_SENT",
    riskTier: "MEDIUM",
    reason: "ONBOARDING",
    createdAt: "2026-06-07T08:10:00.000Z",
    outcome: null,
    idvChecks: [
      {
        id: "idv_bob_1",
        status: "PASSED",
        provider: "sumsub",
        providerRef: "sumsub_applicant_bob",
        documentType: "ID_CARD",
        livenessPass: true,
        createdAt: "2026-06-07T08:11:00.000Z",
      },
    ],
    questionnaireResponses: [],
    screeningResults: [],
    decision: null,
    auditEvents: [
      { id: "ae_b1", type: "CASE_CREATED", actor: "system", createdAt: "2026-06-07T08:10:00.000Z" },
      { id: "ae_b2", type: "IDV_INITIATED", actor: "vera", createdAt: "2026-06-07T08:10:20.000Z" },
      { id: "ae_b3", type: "IDV_PASSED", actor: "sumsub", data: { documentType: "ID_CARD" }, createdAt: "2026-06-07T08:11:00.000Z" },
      { id: "ae_b4", type: "SMS_SENT", actor: "twilio", data: { phone: "+35988765432" }, createdAt: "2026-06-07T08:11:15.000Z" },
    ],
  },
  {
    id: "case_demo_carol",
    entityName: "Carol Castellano",
    email: "carol@example.com",
    phone: "+15551234567",
    status: "NEEDS_REVIEW",
    riskTier: "HIGH",
    reason: "ONBOARDING",
    createdAt: "2026-06-07T08:12:00.000Z",
    outcome: "REFER",
    idvChecks: [
      {
        id: "idv_carol_1",
        status: "PASSED",
        provider: "sumsub",
        providerRef: "sumsub_applicant_carol",
        documentType: "PASSPORT",
        livenessPass: true,
        createdAt: "2026-06-07T08:13:00.000Z",
      },
    ],
    questionnaireResponses: [
      {
        channel: "VOICE",
        answers: {
          occupation: "Government Official",
          sourceOfFunds: "Government Salary",
          politicallyExposed: true,
          country: "US",
          eddSourceOfWealth: "Public service",
          eddExpectedActivity: "Regular transfers",
        },
        complete: true,
        createdAt: "2026-06-07T08:20:00.000Z",
      },
    ],
    screeningResults: [
      { id: "scr_carol_sanctions", type: "SANCTIONS", hit: false },
      { id: "scr_carol_pep", type: "PEP", hit: true, details: { matchScore: 0.91, listName: "US-PEP-LIST" } },
      { id: "scr_carol_media", type: "ADVERSE_MEDIA", hit: false },
    ],
    decision: {
      outcome: "REFER",
      reasons: ["PEP match detected (score 0.91)", "High-risk jurisdiction", "Enhanced due diligence required"],
      automated: false,
      reviewedBy: null,
      createdAt: "2026-06-07T08:25:00.000Z",
    },
    auditEvents: [
      { id: "ae_c1", type: "CASE_CREATED", actor: "system", createdAt: "2026-06-07T08:12:00.000Z" },
      { id: "ae_c2", type: "IDV_INITIATED", actor: "vera", createdAt: "2026-06-07T08:12:30.000Z" },
      { id: "ae_c3", type: "IDV_PASSED", actor: "sumsub", data: { documentType: "PASSPORT" }, createdAt: "2026-06-07T08:13:00.000Z" },
      { id: "ae_c4", type: "SMS_SENT", actor: "twilio", data: { phone: "+15551234567" }, createdAt: "2026-06-07T08:13:10.000Z" },
      { id: "ae_c5", type: "OUTBOUND_CALL_INITIATED", actor: "vera", data: { reason: "questionnaire_fallback" }, createdAt: "2026-06-07T08:18:00.000Z" },
      { id: "ae_c6", type: "QUESTIONNAIRE_COMPLETED", actor: "customer", data: { channel: "VOICE" }, createdAt: "2026-06-07T08:20:00.000Z" },
      { id: "ae_c7", type: "SCREENING_DONE", actor: "sumsub", data: { hits: 1, pepHit: true }, createdAt: "2026-06-07T08:24:00.000Z" },
      { id: "ae_c8", type: "DECISION_MADE", actor: "vera", data: { outcome: "REFER", reason: "PEP match" }, createdAt: "2026-06-07T08:25:00.000Z" },
      { id: "ae_c9", type: "ESCALATED_TO_REVIEWER", actor: "vera", createdAt: "2026-06-07T08:25:05.000Z" },
    ],
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
