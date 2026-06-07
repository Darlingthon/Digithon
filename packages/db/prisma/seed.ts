// Seed 3 demo cases spanning the state machine, so every track has realistic
// data to build against. Idempotent-ish: wipes and re-creates demo rows.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // clean (order matters for FKs)
  await prisma.auditEvent.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.screeningResult.deleteMany();
  await prisma.questionnaireResponse.deleteMany();
  await prisma.idvCheck.deleteMany();
  await prisma.call.deleteMany();
  await prisma.otpSession.deleteMany();
  await prisma.case.deleteMany();
  await prisma.entity.deleteMany();

  // 1) Alice — clean, fully decided (the happy path)
  const alice = await prisma.entity.create({
    data: { type: "PERSON", fullName: "Alice Andersson", email: "alice@example.com", phone: "+15551230001", country: "SE" },
  });
  const aliceCase = await prisma.case.create({
    data: {
      id: "case_demo_alice", // stable id — matches @trustline/shared fixtures
      entityId: alice.id,
      status: "DECIDED",
      riskTier: "LOW",
      decidedAt: new Date("2026-06-07T08:04:00Z"),
      idvChecks: { create: { status: "PASSED", documentType: "PASSPORT", livenessPass: true, documentExp: new Date("2030-01-01") } },
      responses: { create: { questionnaireId: "consumer-kyc", channel: "WEB", complete: true, answers: { occupation: "Engineer", annualIncomeBand: "50k-150k", sourceOfFunds: "Salary" } } },
      screenings: { create: [{ type: "SANCTIONS", hit: false }, { type: "PEP", hit: false }, { type: "ADVERSE_MEDIA", hit: false }] },
      decision: { create: { outcome: "CLEAR", automated: true, reasons: ["IDV passed", "No screening hits", "Low risk tier"] } },
    },
  });
  await prisma.auditEvent.createMany({
    data: [
      { caseId: aliceCase.id, type: "CASE_CREATED", actor: "system" },
      { caseId: aliceCase.id, type: "IDV_PASSED", actor: "vera" },
      { caseId: aliceCase.id, type: "QUESTIONNAIRE_COMPLETED", actor: "customer", data: { channel: "WEB" } },
      { caseId: aliceCase.id, type: "SCREENING_CLEAR", actor: "vera" },
      { caseId: aliceCase.id, type: "DECISION_MADE", actor: "vera", data: { outcome: "CLEAR" } },
    ],
  });

  // 2) Bob — questionnaire sent, awaiting completion (fallback-call candidate)
  const bob = await prisma.entity.create({
    data: { type: "PERSON", fullName: "Bob Belov", email: "bob@example.com", phone: "+15551230002", country: "US" },
  });
  const bobCase = await prisma.case.create({
    data: {
      id: "case_demo_bob", // stable id — matches @trustline/shared fixtures
      entityId: bob.id,
      status: "QUESTIONNAIRE_SENT",
      riskTier: "MEDIUM",
      idvChecks: { create: { status: "PASSED", documentType: "DRIVERS_LICENSE", livenessPass: true, documentExp: new Date("2027-05-01") } },
      otpSessions: { create: { channel: "sms", verified: false } },
    },
  });
  await prisma.auditEvent.createMany({
    data: [
      { caseId: bobCase.id, type: "CASE_CREATED", actor: "system" },
      { caseId: bobCase.id, type: "IDV_PASSED", actor: "vera" },
      { caseId: bobCase.id, type: "SMS_SENT", actor: "vera", data: { link: true, otp: true } },
    ],
  });

  // 3) Carol — high risk, screening hit, escalated to human review
  const carol = await prisma.entity.create({
    data: { type: "PERSON", fullName: "Carol Castellano", email: "carol@example.com", phone: "+15551230003", country: "MT" },
  });
  const carolCase = await prisma.case.create({
    data: {
      id: "case_demo_carol", // stable id — matches @trustline/shared fixtures
      entityId: carol.id,
      status: "NEEDS_REVIEW",
      riskTier: "HIGH",
      idvChecks: { create: { status: "PASSED", documentType: "PASSPORT", livenessPass: true, documentExp: new Date("2026-09-01") } },
      responses: { create: { questionnaireId: "consumer-kyc", channel: "VOICE", complete: true, answers: { occupation: "Investor", isPep: true, sourceOfWealthDetail: "Family business sale" } } },
      screenings: { create: [{ type: "PEP", hit: true, details: { match: "Regional official" } }, { type: "SANCTIONS", hit: false }] },
      calls: { create: { direction: "OUTBOUND", status: "COMPLETED", transcript: { turns: [{ role: "vera", text: "Calling to confirm your details, referencing the code from your SMS." }] } } },
    },
  });
  await prisma.auditEvent.createMany({
    data: [
      { caseId: carolCase.id, type: "CASE_CREATED", actor: "system" },
      { caseId: carolCase.id, type: "IDV_PASSED", actor: "vera" },
      { caseId: carolCase.id, type: "OUTBOUND_CALL_COMPLETED", actor: "vera" },
      { caseId: carolCase.id, type: "QUESTIONNAIRE_COMPLETED", actor: "customer", data: { channel: "VOICE" } },
      { caseId: carolCase.id, type: "SCREENING_HIT", actor: "vera", data: { type: "PEP" } },
      { caseId: carolCase.id, type: "ESCALATED_TO_REVIEW", actor: "vera" },
    ],
  });

  // 4) Dan — IDV passed, ready to dispatch the questionnaire (the live demo
  //    starting point: channels /dispatch advances IDV_DONE -> QUESTIONNAIRE_SENT).
  const dan = await prisma.entity.create({
    data: { type: "PERSON", fullName: "Dan Dvorak", email: "dan@example.com", phone: "+15551230004", country: "CZ" },
  });
  const danCase = await prisma.case.create({
    data: {
      id: "case_demo_dan", // stable id — matches @trustline/shared fixtures
      entityId: dan.id,
      status: "IDV_DONE",
      riskTier: "LOW",
      idvChecks: { create: { status: "PASSED", documentType: "PASSPORT", livenessPass: true, documentExp: new Date("2031-03-01") } },
    },
  });
  await prisma.auditEvent.createMany({
    data: [
      { caseId: danCase.id, type: "CASE_CREATED", actor: "system" },
      { caseId: danCase.id, type: "IDV_PASSED", actor: "vera" },
    ],
  });

  console.log("✅ Seeded 4 demo cases: Alice (CLEAR), Bob (QUESTIONNAIRE_SENT), Carol (NEEDS_REVIEW), Dan (IDV_DONE)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
